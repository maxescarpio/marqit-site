// Details for one movie, TV series or album, for the panel that opens when you click it in the
// "Today's events" strip.
//
// GET .../functions/v1/media-details?kind=movie&id=1400940        (id = TMDB id, from key_events.external_id "movie:1400940")
// GET .../functions/v1/media-details?kind=tv&id=12345
// GET .../functions/v1/media-details?kind=album&title=Artist: Album name   (the key_events title)
//  -> movie/tv: { kind, title, tagline, overview, releaseDate, runtime, seasons, episodes, rating, genres[],
//                 network, status, poster, thumb (small, for the strip), backdrop, trailer, cast: [{ name, character, photo }],
//                 scores: { rt, metacritic, imdb, tmdb: { avg, votes } }, money: { domesticTotal, worldwideTotal, budget },
//                 watch: { stream[], rent[], buy[], link } | null  (US, service names only; JustWatch data via TMDB) }
//     album:    { kind, title, artist, artistPhoto, cover, thumb (small, for the strip), releaseDate, label, tracks, genres[], link,
//                 trackList[{ n, title, lengthSec, explicit }], about { text, url } (Wikipedia, only when the page matches), upcoming (bool),
//                 fans, chart: { position (1-100 or null = not in the top 100), of } | null  (Deezer worldwide top albums, only once released) }
// Every block can be null when the source has nothing yet (a movie that opens today has no gross,
// an album that is not out yet is not on Deezer). Nothing here is invented.
//
// Sources: TMDB (details, cast, photos; needs the TMDB_API_KEY secret that fetch-key-events already uses),
//          OMDb (Rotten Tomatoes, Metacritic, IMDb, domestic box office total; optional OMDB_API_KEY secret,
//          skipped without it), Deezer public API (albums, no key).
// Opening-weekend and first-week figures have no free feed, so they are not shown here.
// Cached 30 minutes per item.

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const UA = 'MarqitBot/1.0 (https://playmarqit.com; event details)';
const IMG = 'https://image.tmdb.org/t/p/';
const TTL = 30 * 60 * 1000;
const cache = new Map<string, { at: number; body: string }>();

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { try { await r.body?.cancel(); } catch (_) { /* ignore */ } return null; }
    return await r.json();
  } catch (_) { return null; }
}

function tmdb(path: string, params = ''): Promise<any | null> {
  const key = Deno.env.get('TMDB_API_KEY');
  if (!key) return Promise.resolve(null);
  const q = `https://api.themoviedb.org/3/${path}?language=en-US${params ? '&' + params : ''}`;
  return key.startsWith('eyJ') ? getJson(q, { authorization: 'Bearer ' + key }) : getJson(q + '&api_key=' + encodeURIComponent(key));
}

const money = (v: any): number | null => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };
const img = (size: string, p: any) => (p ? IMG + size + p : null);

// "$123,456,789" -> 123456789
function dollars(s: any): number | null {
  const n = Number(String(s || '').replace(/[$,\s]/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

// status says why there are no scores: 'ok', 'no-key' (secret not set), 'no-imdb-id', 'http-401' (key rejected or not
// activated yet), or OMDb's own message ('Incorrect IMDb ID.', 'Request limit reached!', ...). Shown in the JSON so a
// missing score is easy to diagnose.
async function omdb(imdbId: string | null): Promise<{ rt: number | null; metacritic: number | null; imdb: number | null; domestic: number | null; status: string }> {
  const out = { rt: null as number | null, metacritic: null as number | null, imdb: null as number | null, domestic: null as number | null, status: 'ok' };
  const key = Deno.env.get('OMDB_API_KEY');
  if (!key) return { ...out, status: 'no-key' };
  if (!imdbId) return { ...out, status: 'no-imdb-id' };
  let d: any = null;
  try {
    const r = await fetch(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(key)}`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) { try { await r.body?.cancel(); } catch (_) { /* ignore */ } return { ...out, status: 'http-' + r.status }; }
    d = await r.json();
  } catch (_) { return { ...out, status: 'unreachable' }; }
  if (!d || d.Response === 'False') return { ...out, status: String(d?.Error || 'no-data').slice(0, 80) };
  out.domestic = dollars(d.BoxOffice);
  for (const r of (d.Ratings || [])) {
    const v = String(r.Value || '');
    if (r.Source === 'Rotten Tomatoes') { const n = parseInt(v, 10); out.rt = isFinite(n) ? n : null; }
    else if (r.Source === 'Metacritic') { const n = parseInt(v, 10); out.metacritic = isFinite(n) ? n : null; }
    else if (r.Source === 'Internet Movie Database') { const n = parseFloat(v); out.imdb = isFinite(n) ? n : null; }
  }
  return out;
}

async function screen(kind: 'movie' | 'tv', id: string) {
  const d = await tmdb(`${kind}/${id}`, 'append_to_response=credits,videos,external_ids,watch/providers,' + (kind === 'movie' ? 'release_dates' : 'content_ratings'));
  if (!d || d.success === false || !d.id) return null;

  let rating: string | null = null;
  let usDate: string | null = null; // US theatrical date, so it matches the strip (TMDB's default date is the earliest anywhere)
  if (kind === 'movie') {
    const us = (d.release_dates?.results || []).find((x: any) => x.iso_3166_1 === 'US');
    rating = (us?.release_dates || []).map((x: any) => x.certification).find((c: string) => c) || null;
    usDate = (us?.release_dates || []).filter((x: any) => x.type === 2 || x.type === 3)
      .map((x: any) => String(x.release_date || '').slice(0, 10)).filter(Boolean).sort()[0] || null;
  } else {
    rating = (d.content_ratings?.results || []).find((x: any) => x.iso_3166_1 === 'US')?.rating || null;
  }

  const trailer = (d.videos?.results || []).find((v: any) => v.site === 'YouTube' && v.type === 'Trailer' && v.official !== false)
    || (d.videos?.results || []).find((v: any) => v.site === 'YouTube' && v.type === 'Trailer');
  const crew = (d.credits?.crew || []) as any[];
  const directors = kind === 'movie' ? crew.filter((c) => c.job === 'Director').map((c) => String(c.name)).slice(0, 2) : (d.created_by || []).map((c: any) => String(c.name)).slice(0, 3);
  const writers = kind === 'movie' ? [...new Set(crew.filter((c) => /^(Screenplay|Writer|Story)$/.test(c.job)).map((c) => String(c.name)))].slice(0, 3) : [];
  const cast = (d.credits?.cast || []).slice(0, 6).map((c: any) => ({ name: c.name, character: c.character || null, photo: img('w185', c.profile_path) }));

  // Where to watch, US only. Service names only (the site keeps logos off). Data is JustWatch's, via TMDB.
  const wp = d['watch/providers']?.results?.US || null;
  const names = (a: any) => (Array.isArray(a) ? a : []).map((x: any) => String(x.provider_name || '')).filter(Boolean).slice(0, 6);
  const watch = wp && (names(wp.flatrate).length || names(wp.rent).length || names(wp.buy).length)
    ? { stream: names(wp.flatrate), rent: names(wp.rent), buy: names(wp.buy), link: typeof wp.link === 'string' && wp.link.startsWith('https://www.themoviedb.org/') ? wp.link : null }
    : null;

  const o = await omdb(d.external_ids?.imdb_id || d.imdb_id || null);
  const worldwide = kind === 'movie' ? money(d.revenue) : null;
  const domestic = o?.domestic ?? null;

  return {
    kind,
    title: kind === 'movie' ? d.title : d.name,
    tagline: d.tagline || null,
    overview: d.overview || null,
    releaseDate: (kind === 'movie' ? (usDate || d.release_date) : d.first_air_date) || null,
    runtime: kind === 'movie' ? (d.runtime || null) : ((d.episode_run_time || [])[0] || null),
    seasons: kind === 'tv' ? (d.number_of_seasons || null) : null,
    episodes: kind === 'tv' ? (d.number_of_episodes || null) : null,
    rating,
    genres: (d.genres || []).map((g: any) => g.name).slice(0, 3),
    studios: (d.production_companies || []).map((c: any) => String(c.name)).slice(0, 3),
    language: String(d.original_language || '').toUpperCase() || null,
    network: kind === 'tv' ? ((d.networks || [])[0]?.name || null) : ((d.production_companies || [])[0]?.name || null),
    status: d.status || null,
    poster: img('w342', d.poster_path),
    thumb: img('w154', d.poster_path),
    backdrop: img('w780', d.backdrop_path),
    trailer: trailer ? 'https://www.youtube.com/watch?v=' + trailer.key : null,
    directors, writers,
    cast,
    scores: {
      rt: o?.rt ?? null,
      metacritic: o?.metacritic ?? null,
      imdb: o?.imdb ?? null,
      tmdb: d.vote_count >= 20 ? { avg: Math.round(d.vote_average * 10) / 10, votes: d.vote_count } : null,
    },
    money: kind === 'movie' && (domestic || worldwide || money(d.budget))
      ? { domesticTotal: domestic, worldwideTotal: worldwide, budget: money(d.budget) }
      : null,
    watch,
    omdb: o.status,
    link: 'https://www.themoviedb.org/' + kind + '/' + d.id,
  };
}

// Deezer's worldwide top-albums chart (top 100), kept for an hour so busy days make one request, not one per click.
let chart: { at: number; ids: string[] } | null = null;
async function deezerChartIds(): Promise<string[]> {
  if (chart && Date.now() - chart.at < 3600000) return chart.ids;
  const c = await getJson('https://api.deezer.com/chart/0/albums?limit=100');
  const ids = (c?.data || []).map((x: any) => String(x.id));
  if (ids.length) chart = { at: Date.now(), ids };
  return ids;
}

// Album titles are stored as "Artist: Album name". Artists with a colon in the name are rare; the first ": " wins.
async function album(title: string) {
  const i = title.indexOf(': ');
  const artist = i > 0 ? title.slice(0, i).trim() : '';
  const name = i > 0 ? title.slice(i + 2).trim() : title.trim();
  if (!name) return null;
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // "and" and "&" are the same word for matching; only words of 3+ letters count, so "and"/"the"/"of" never match on their own.
  const words = (x: string) => new Set(norm(String(x).toLowerCase().replace(/&/g, ' and ')).split(' ').filter((w) => w.length > 2 && w !== 'and' && w !== 'the'));
  const want = words(artist);
  // Strict search first, then looser ones. A hit counts only if the album title matches exactly AND (no artist known, or the
  // artist shares a word with ours). Never fall back to "the first result": that can show a different album.
  const queries = [
    ...(artist ? [`artist:"${artist}" album:"${name}"`, `${artist} ${name}`] : []),
    `album:"${name}"`,
  ];
  let hit: any = null;
  for (const q of queries) {
    const s = await getJson('https://api.deezer.com/search/album?limit=10&q=' + encodeURIComponent(q));
    hit = (s?.data || []).find((a: any) => norm(a.title) === norm(name) && (want.size === 0 || [...words(a.artist?.name || '')].some((w) => want.has(w)))) || null;
    if (hit) break;
  }
  if (!hit) return await itunesAlbum(name, artist);
  const a = await getJson('https://api.deezer.com/album/' + hit.id);
  if (!a || a.error) return await itunesAlbum(name, artist);
  const today = new Date().toISOString().slice(0, 10);
  // Chart position only for albums that are already out. position null = not in the top 100. If the chart could not be fetched, chart stays null (nothing is claimed).
  const released = !!a.release_date && String(a.release_date) <= today;
  let chartInfo: { position: number | null; of: number } | null = null;
  if (released) {
    const ids = await deezerChartIds();
    if (ids.length) { const at = ids.indexOf(String(hit.id)); chartInfo = { position: at >= 0 ? at + 1 : null, of: ids.length }; }
  }
  const about = await wikiAbout(`${a.title} ${a.artist?.name || artist} album`, [String(a.title).split(' ')[0]]);
  const trackList = (a.tracks?.data || []).slice(0, 30).map((t: any, i: number) => ({ n: i + 1, title: String(t.title_short || t.title || ''), lengthSec: Number(t.duration) || null, explicit: !!t.explicit_lyrics }));
  return {
    kind: 'album',
    found: true,
    title: a.title,
    artist: a.artist?.name || artist || null,
    artistPhoto: a.artist?.picture_xl || a.artist?.picture_big || null,
    cover: a.cover_xl || a.cover_big || null,
    thumb: a.cover_medium || a.cover_big || null,
    releaseDate: a.release_date || null,
    upcoming: !released,
    label: a.label || null,
    tracks: a.nb_tracks || null,
    durationSec: a.duration || null,
    fans: Number(a.fans) > 0 ? Number(a.fans) : null,
    chart: chartInfo,
    genres: (a.genres?.data || []).map((g: any) => g.name).slice(0, 3),
    trackList, about,
    explicit: !!a.explicit_lyrics,
    link: a.link || null,
  };
}

// Albums that are not on Deezer yet (pre-release) often are on Apple's catalogue, with cover, track count and date.
async function itunesAlbum(name: string, artist: string) {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const r = await getJson(`https://itunes.apple.com/search?media=music&entity=album&limit=8&country=us&term=${encodeURIComponent((artist + ' ' + name).trim())}`);
  const first = (artist || '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2)[0] || '';
  const hit = (r?.results || []).find((x: any) => norm(String(x.collectionName || '')).replace(/ (deluxe|single|ep)$/, '') === norm(name) && (!first || String(x.artistName || '').toLowerCase().includes(first))) || null;
  if (!hit) return { kind: 'album', title: name, artist: artist || null, found: false };
  const rel = String(hit.releaseDate || '').slice(0, 10);
  const art = String(hit.artworkUrl100 || '').replace(/\/\d+x\d+bb/, '/600x600bb');
  const about = await wikiAbout(`${name} ${artist} album`, [name.split(' ')[0]]);
  return {
    kind: 'album', found: true, title: hit.collectionName, artist: hit.artistName || artist || null, artistPhoto: null,
    cover: art, thumb: art.replace('600x600bb', '300x300bb'), releaseDate: rel || null,
    upcoming: !!rel && rel > new Date().toISOString().slice(0, 10),
    label: String(hit.copyright || '').replace(/^[℗©]\s*\d{4}\s*/, '') || null,
    tracks: Number(hit.trackCount) || null, durationSec: null, fans: null, chart: null,
    genres: hit.primaryGenreName ? [String(hit.primaryGenreName)] : [], trackList: [], about,
    explicit: hit.collectionExplicitness === 'explicit',
    link: /^https:\/\/(music|itunes)\.apple\.com\//.test(String(hit.collectionViewUrl || '')) ? hit.collectionViewUrl : null,
  };
}

async function wikiAbout(query: string, must: string[]): Promise<{ text: string; url: string } | null> {
  const s = await getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`);
  for (const h of s?.query?.search || []) {
    const t = String(h.title || '');
    const sum = await getJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_')));
    const ex = String(sum?.extract || '');
    if (!ex || sum?.type === 'disambiguation') continue;
    if (!must.every((m) => (ex + ' ' + t).toLowerCase().includes(m.toLowerCase()))) continue;
    if (!/album|ep\b|record|release|studio/i.test(ex)) continue;
    const sentences = ex.match(/[^.!?]+[.!?]+(\s|$)/g) || [ex];
    let text = '';
    for (const sn of sentences) { if ((text + sn).length > 420 && text) break; text += sn; }
    return { text: text.trim(), url: String(sum?.content_urls?.desktop?.page || '') };
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const kind = u.searchParams.get('kind') || '';
  const id = (u.searchParams.get('id') || '').trim();
  const title = (u.searchParams.get('title') || '').trim().slice(0, 200);

  let key = '';
  if ((kind === 'movie' || kind === 'tv') && /^\d{1,9}$/.test(id)) key = kind + ':' + id;
  else if (kind === 'album' && title) key = 'album:' + title.toLowerCase();
  else return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: CORS });

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return new Response(hit.body, { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });

  try {
    const out = kind === 'album' ? await album(title) : await screen(kind as 'movie' | 'tv', id);
    if (!out) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: CORS });
    const body = JSON.stringify(out);
    cache.set(key, { at: Date.now(), body });
    return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 120) }), { status: 502, headers: CORS });
  }
});
