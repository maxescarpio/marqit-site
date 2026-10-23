// Details for one movie, TV series or album, for the panel that opens when you click it in the
// "Today's events" strip.
//
// GET .../functions/v1/media-details?kind=movie&id=1400940        (id = TMDB id, from key_events.external_id "movie:1400940")
// GET .../functions/v1/media-details?kind=tv&id=12345
// GET .../functions/v1/media-details?kind=album&title=Artist: Album name   (the key_events title)
//  -> movie/tv: { kind, title, tagline, overview, releaseDate, runtime, seasons, episodes, rating, genres[],
//                 network, status, poster, thumb (small, for the strip), backdrop, trailer, cast: [{ name, character, photo }],
//                 scores: { rt, metacritic, imdb, tmdb: { avg, votes } }, money: { domesticTotal, worldwideTotal, budget } }
//     album:    { kind, title, artist, artistPhoto, cover, thumb (small, for the strip), releaseDate, label, tracks, genres[], link }
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

async function omdb(imdbId: string | null): Promise<{ rt: number | null; metacritic: number | null; imdb: number | null; domestic: number | null } | null> {
  const key = Deno.env.get('OMDB_API_KEY');
  if (!key || !imdbId) return null;
  const d = await getJson(`https://www.omdbapi.com/?i=${encodeURIComponent(imdbId)}&apikey=${encodeURIComponent(key)}`);
  if (!d || d.Response === 'False') return null;
  const out = { rt: null as number | null, metacritic: null as number | null, imdb: null as number | null, domestic: dollars(d.BoxOffice) };
  for (const r of (d.Ratings || [])) {
    const v = String(r.Value || '');
    if (r.Source === 'Rotten Tomatoes') { const n = parseInt(v, 10); out.rt = isFinite(n) ? n : null; }
    else if (r.Source === 'Metacritic') { const n = parseInt(v, 10); out.metacritic = isFinite(n) ? n : null; }
    else if (r.Source === 'Internet Movie Database') { const n = parseFloat(v); out.imdb = isFinite(n) ? n : null; }
  }
  return out;
}

async function screen(kind: 'movie' | 'tv', id: string) {
  const d = await tmdb(`${kind}/${id}`, 'append_to_response=credits,videos,external_ids,' + (kind === 'movie' ? 'release_dates' : 'content_ratings'));
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
  const cast = (d.credits?.cast || []).slice(0, 6).map((c: any) => ({ name: c.name, character: c.character || null, photo: img('w185', c.profile_path) }));

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
    network: kind === 'tv' ? ((d.networks || [])[0]?.name || null) : ((d.production_companies || [])[0]?.name || null),
    status: d.status || null,
    poster: img('w342', d.poster_path),
    thumb: img('w154', d.poster_path),
    backdrop: img('w780', d.backdrop_path),
    trailer: trailer ? 'https://www.youtube.com/watch?v=' + trailer.key : null,
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
    link: 'https://www.themoviedb.org/' + kind + '/' + d.id,
  };
}

// Album titles are stored as "Artist: Album name". Artists with a colon in the name are rare; the first ": " wins.
async function album(title: string) {
  const i = title.indexOf(': ');
  const artist = i > 0 ? title.slice(0, i).trim() : '';
  const name = i > 0 ? title.slice(i + 2).trim() : title.trim();
  if (!name) return null;
  const q = (artist ? `artist:"${artist}" ` : '') + `album:"${name}"`;
  const s = await getJson('https://api.deezer.com/search/album?limit=5&q=' + encodeURIComponent(q));
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const hit = (s?.data || []).find((a: any) => norm(a.title) === norm(name)) || (s?.data || [])[0];
  if (!hit) return { kind: 'album', title: name, artist: artist || null, found: false };
  const a = await getJson('https://api.deezer.com/album/' + hit.id);
  if (!a || a.error) return { kind: 'album', title: name, artist: artist || null, found: false };
  return {
    kind: 'album',
    found: true,
    title: a.title,
    artist: a.artist?.name || artist || null,
    artistPhoto: a.artist?.picture_xl || a.artist?.picture_big || null,
    cover: a.cover_xl || a.cover_big || null,
    thumb: a.cover_medium || a.cover_big || null,
    releaseDate: a.release_date || null,
    label: a.label || null,
    tracks: a.nb_tracks || null,
    durationSec: a.duration || null,
    genres: (a.genres?.data || []).map((g: any) => g.name).slice(0, 3),
    link: a.link || null,
  };
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
