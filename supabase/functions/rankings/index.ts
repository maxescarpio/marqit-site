// Current standings and charts for the Rankings panel. Public, no keys. Cached per list.
//   GET .../functions/v1/rankings?kind=nba|nfl|nhl|mlb   standings (ESPN public feed, unofficial), 10 min
//   GET .../functions/v1/rankings?kind=music             top 10 songs overall and by genre (pop, hip-hop, country, R&B, rock, Latin), top 10 artists with fans and top track, 1 hour
//   GET .../functions/v1/rankings?kind=markets           largest US-listed companies by market cap (Nasdaq public API), 5 min
//   GET .../functions/v1/rankings?kind=artist&id=246791&name=Drake  one artist: photo, fans, debut year, albums, top tracks, bio (Deezer, MusicBrainz, Wikipedia; listeners if LASTFM_API_KEY is set)
//   GET .../functions/v1/rankings?kind=song&id=<iTunes track id>&artist=..&title=..  one song: length, release date, album, genre, popularity, 30s preview, bio (iTunes, Deezer, Wikipedia; plays if LASTFM_API_KEY is set)
// Team badges come from TheSportsDB (free, already credited on the site); team colors from ESPN's team list; album art and artist photos from Apple and Deezer.

const UA = 'curl/8.5.0';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const cache = new Map<string, { at: number; body: string }>();
const TTL: Record<string, number> = { nba: 600000, nfl: 600000, nhl: 600000, mlb: 600000, music: 3600000, markets: 300000, artist: 3600000, song: 3600000 };
const SPORTS: Record<string, string> = { nba: 'basketball/nba', nfl: 'football/nfl', nhl: 'hockey/nhl', mlb: 'baseball/mlb' };

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(new URL(url).hostname + ' ' + r.status);
  return r.json();
}

// ---- team badges (TheSportsDB, cached a day) ----
const LEAGUE_NAME: Record<string, string> = { nba: 'NBA', nfl: 'NFL', nhl: 'NHL', mlb: 'MLB' };
const badgeCache = new Map<string, { at: number; map: Record<string, string> }>();
async function badges(kind: string): Promise<Record<string, string>> {
  const hit = badgeCache.get(kind);
  if (hit && Date.now() - hit.at < 86400000) return hit.map;
  const key = Deno.env.get('THESPORTSDB_API_KEY') || '123';
  const d = await getJson(`https://www.thesportsdb.com/api/v1/json/${key}/search_all_teams.php?l=${LEAGUE_NAME[kind]}`);
  const map: Record<string, string> = {};
  for (const t of d?.teams || []) {
    const b = String(t?.strBadge || t?.strTeamBadge || '');
    const n = String(t?.strTeam || '').toLowerCase();
    if (!/^https:\/\//.test(b) || !n) continue;
    const url = b + '/small';
    const w = n.split(/\s+/);
    map[n] = url;
    if (w.length > 1) map['~' + w.slice(-2).join(' ')] = map['~' + w.slice(-2).join(' ')] || url;
    map['~' + w[w.length - 1]] = map['~' + w[w.length - 1]] || url;
  }
  if (Object.keys(map).length) badgeCache.set(kind, { at: Date.now(), map });
  return map;
}
function badgeFor(map: Record<string, string>, name: string): string | null {
  const n = name.toLowerCase(), w = n.split(/\s+/);
  return map[n] || (w.length > 1 && map['~' + w.slice(-2).join(' ')]) || map['~' + w[w.length - 1]] || null;
}

function badgeCacheMiss(kind: string, name: string): boolean { return !!badgeCache.get(kind)?.map['!' + String(name).toLowerCase()]; }

// ---- standings ----
const stat = (e: any, name: string): string | null => {
  const s = (e?.stats || []).find((x: any) => x.name === name);
  return s ? String(s.displayValue ?? s.value ?? '') : null;
};
function collect(node: any, conf: string | null, out: any[]) {
  const c = node?.isConference ? String(node.abbreviation || node.name || '') : conf;
  const entries = node?.standings?.entries;
  if (Array.isArray(entries)) {
    const rows = entries.map((e: any) => ({
      id: String(e?.team?.id || ''), abbr: String(e?.team?.abbreviation || ''), name: String(e?.team?.displayName || ''),
      w: stat(e, 'wins'), l: stat(e, 'losses'), t: stat(e, 'ties'), otl: stat(e, 'otLosses'), pts: stat(e, 'points'),
      pct: stat(e, 'winPercent'), gb: stat(e, 'gamesBehind'), strk: stat(e, 'streak'), seed: Number(stat(e, 'playoffSeed')) || null,
    }));
    const key = (r: any) => (r.seed ? 1000 - r.seed : 0) + Number(r.pct || r.pts || 0) / 1000;
    rows.sort((a: any, b: any) => key(b) - key(a));
    out.push({ conf: c, name: String(node.name || ''), st: Number(node.standings.seasonType) || null, rows });
  }
  for (const ch of node?.children || []) collect(ch, c, out);
}
async function standings(kind: string) {
  const level = kind === 'nba' ? '' : '?level=3';
  const d = await getJson(`https://site.api.espn.com/apis/v2/sports/${SPORTS[kind]}/standings${level}`);
  const groups: any[] = [];
  collect(d, null, groups);
  try {
    const tl = await getJson(`https://site.api.espn.com/apis/site/v2/sports/${SPORTS[kind]}/teams?limit=100`);
    const col: Record<string, any> = {};
    for (const t of tl?.sports?.[0]?.leagues?.[0]?.teams || []) { const x = t?.team; if (x?.id) col[String(x.id)] = { logo: String(x.logos?.[0]?.href || '').replace(/^http:/, 'https:'), color: /^[0-9a-f]{6}$/i.test(x.color || '') ? '#' + x.color.toLowerCase() : null, alt: /^[0-9a-f]{6}$/i.test(x.alternateColor || '') ? '#' + x.alternateColor.toLowerCase() : null }; }
    for (const g of groups) for (const r of g.rows) Object.assign(r, col[r.id] || {});
  } catch (_) { /* colors are decoration */ }
  const partial = false;
  const season = d?.seasons?.[0]?.displayName || d?.season?.displayName || null;
  const st = groups[0]?.st;
  const phase = st === 1 ? 'Preseason' : st === 3 ? 'Postseason' : st === 2 ? 'Regular season' : null;
  return { kind, season, phase, groups, partial };
}

// ---- music ----
async function music() {
  const out: any = { countrySongs: [], songs: [], genres: {}, artists: [] };
  const errors: string[] = [];
  const itunes = (genre: string) => `https://itunes.apple.com/us/rss/topsongs/limit=10${genre}/json`;
  const parseSongs = (d: any) => (d?.feed?.entry || []).slice(0, 10).map((e: any, i: number) => ({ rank: i + 1, title: String(e?.['im:name']?.label || ''), artist: String(e?.['im:artist']?.label || ''), image: String((e?.['im:image'] || []).slice(-1)[0]?.label || '').replace(/\/\d+x\d+bb/, '/300x300bb'), id: String(e?.id?.attributes?.['im:id'] || ''), released: String(e?.['im:releaseDate']?.label || '').slice(0, 10), link: String(e?.id?.label || e?.link?.attributes?.href || ''), album: String(e?.['im:collection']?.['im:name']?.label || '') }));
  // iTunes genre ids: Pop 14, Hip-Hop/Rap 18, Country 6, R&B/Soul 15, Rock 21, Latin 12
  const GENRES: Record<string, number> = { pop: 14, hiphop: 18, country: 6, rnb: 15, rock: 21, latin: 12 };
  const artistsTask = getJson('https://api.deezer.com/chart/0/artists?limit=10').then(async (d) => {
    const base = (d?.data || []).slice(0, 10).map((a: any, i: number) => ({ rank: i + 1, id: Number(a?.id) || null, name: String(a?.name || ''), picture: String(a?.picture_medium || ''), link: String(a?.link || ''), fans: null as number | null, topTrack: '', photo: null as string | null }));
    // Fans and the most played track make each row worth reading. If Deezer says no, the plain row still works.
    await Promise.all(base.map(async (a: any) => {
      if (!a.id) return;
      try {
        const [info, top] = await Promise.all([getJson(`https://api.deezer.com/artist/${a.id}`), getJson(`https://api.deezer.com/artist/${a.id}/top?limit=1`)]);
        a.fans = Number(info?.nb_fan) || null;
        a.topTrack = String(top?.data?.[0]?.title_short || top?.data?.[0]?.title || '');
      } catch (_) { /* decoration */ }
      const [t, w] = await Promise.all([tsdb(a.name), wiki(`${a.name} musician`, [String(a.name).split(' ')[0]], 60, /singer|rapper|musician|band|songwriter|record producer|\bDJ\b|vocalist|group|duo|composer/i)]);
      a.photo = t?.thumb || w?.photo || null;
    }));
    out.artists = base;
  }).catch((e) => errors.push('artists ' + String(e).slice(0, 40)));
  await Promise.all([
    getJson(itunes('')).then((d) => { out.songs = parseSongs(d); }).catch((e) => errors.push('songs ' + String(e).slice(0, 40))),
    ...Object.entries(GENRES).map(([k, id]) => getJson(itunes('/genre=' + id)).then((d) => { out.genres[k] = parseSongs(d); if (k === 'country') out.countrySongs = out.genres[k]; }).catch((e) => errors.push(k + ' ' + String(e).slice(0, 40)))),
    artistsTask,
  ]);
  out.errors = errors;
  return out;
}

// ---- shared helpers for the detail panels ----
const NICE_UA = 'MarqitBot/1.0 (https://playmarqit.com; music details)';
const norm = (x: unknown) => String(x || '').toLowerCase().replace(/&/g, ' and ').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const nice = { 'user-agent': NICE_UA };
async function safe<T>(p: Promise<T>): Promise<T | null> { try { return await p; } catch (_) { return null; } }

// A few sentences from Wikipedia, only when the page really is about what we asked (every `must` word appears, and `about` matches when given).
// Also returns Wikipedia's one-line description ("Canadian rapper and singer") and its lead photo.
async function wiki(query: string, must: string[], max = 420, about?: RegExp): Promise<{ text: string; url: string; desc: string; photo: string } | null> {
  const s = await safe(getJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json&origin=*`, nice));
  for (const h of s?.query?.search || []) {
    const t = String(h.title || '');
    const sum = await safe(getJson('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/ /g, '_')), nice));
    const ex = String(sum?.extract || '');
    if (!ex || sum?.type === 'disambiguation') continue;
    const low = (ex + ' ' + t).toLowerCase();
    if (!must.every((m) => low.includes(m.toLowerCase()))) continue;
    if (about && !about.test(ex + ' ' + String(sum?.description || ''))) continue;
    const sentences = ex.match(/[^.!?]+[.!?]+(\s|$)/g) || [ex];
    let text = '';
    for (const sn of sentences) { if ((text + sn).length > max && text) break; text += sn; }
    let photo = String(sum?.thumbnail?.source || '');
    if (/^https:\/\/upload\.wikimedia\.org\//.test(photo)) photo = photo.replace(/\/\d+px-/, '/500px-'); else photo = '';
    return { text: text.trim(), url: String(sum?.content_urls?.desktop?.page || ''), desc: String(sum?.description || ''), photo };
  }
  return null;
}
// Listener and play counts. Needs a free Last.fm API key in the LASTFM_API_KEY secret; without it this is null.
async function lastfm(params: Record<string, string>): Promise<any | null> {
  const key = Deno.env.get('LASTFM_API_KEY');
  if (!key) return null;
  return safe(getJson('https://ws.audioscrobbler.com/2.0/?format=json&autocorrect=1&api_key=' + encodeURIComponent(key) + '&' + new URLSearchParams(params).toString(), nice));
}
// TheSportsDB artist art (promo thumb and wide fanart). Free key, already used for team badges.
async function tsdb(name: string): Promise<{ thumb: string; banner: string } | null> {
  const key = Deno.env.get('THESPORTSDB_API_KEY') || '123';
  const d = await safe(getJson(`https://www.thesportsdb.com/api/v1/json/${key}/searchartist.php?s=${encodeURIComponent(name)}`, nice));
  const a = (d?.artists || []).find((x: any) => norm(x.strArtist) === norm(name));
  if (!a) return null;
  const ok = (u: unknown) => (/^https:\/\/([a-z0-9-]+\.)*thesportsdb\.com\//i.test(String(u || '')) ? String(u) : '');
  return { thumb: ok(a.strArtistThumb), banner: ok(a.strArtistFanart) || ok(a.strArtistWideThumb) };
}
const num = (v: unknown): number | null => { const n = Number(v); return isFinite(n) && n > 0 ? n : null; };

// ---- one song ----
async function song(id: string, artist: string, title: string) {
  if (id && !/^\d{1,14}$/.test(id)) throw new Error('bad id');
  const lk = id ? await safe(getJson(`https://itunes.apple.com/lookup?id=${id}&country=us`)) : null;
  const it = (lk?.results || []).find((r: any) => r.wrapperType === 'track') || null;
  const name = String(it?.trackName || title || '');
  const by = String(it?.artistName || artist || '');
  if (!name) throw new Error('no title');
  // Deezer: popularity score, tempo and credited artists.
  const ds = await safe(getJson('https://api.deezer.com/search?limit=5&q=' + encodeURIComponent(`artist:"${by.split(/ & | feat\.? | x | and |, /i)[0]}" track:"${name.replace(/\(.*?\)/g, '').trim()}"`)));
  const dhit = (ds?.data || []).find((t: any) => norm(t.title_short || t.title) === norm(name)) || (ds?.data || [])[0] || null;
  const [dt, lfm, about, alb, more] = await Promise.all([
    dhit ? safe(getJson('https://api.deezer.com/track/' + dhit.id)) : Promise.resolve(null),
    lastfm({ method: 'track.getInfo', artist: by.split(/ & | feat\.? |, /i)[0], track: name }),
    wiki(`${name} ${by} song`, [name.replace(/\(.*?\)/g, '').trim().split(' ')[0]], 600, /song|single|track/i),
    it?.collectionId ? safe(getJson(`https://itunes.apple.com/lookup?id=${it.collectionId}&entity=song&country=us`)) : Promise.resolve(null),
    safe(getJson(`https://itunes.apple.com/search?media=music&entity=song&attribute=artistTerm&limit=40&country=us&term=${encodeURIComponent(by.split(/ & | feat\.? |, /i)[0])}`)),
  ]);
  const coll = (alb?.results || []).find((r: any) => r.wrapperType === 'collection') || null;
  const albumTracks = (alb?.results || []).filter((r: any) => r.wrapperType === 'track').sort((p: any, q: any) => (p.discNumber || 1) - (q.discNumber || 1) || (p.trackNumber || 0) - (q.trackNumber || 0)).slice(0, 40)
    .map((r: any) => ({ n: r.trackNumber || null, title: String(r.trackName || ''), lengthSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null, current: String(r.trackId) === String(it?.trackId), explicit: r.trackExplicitness === 'explicit' }));
  const seenM = new Set<string>([norm(name)]);
  const moreBy = (more?.results || []).filter((r: any) => r.wrapperType === 'track' && norm(r.artistName) === norm(by)).filter((r: any) => { const k = norm(r.trackName); if (!k || seenM.has(k)) return false; seenM.add(k); return true; }).slice(0, 5)
    .map((r: any) => ({ id: String(r.trackId || ''), title: String(r.trackName || ''), album: String(r.collectionName || ''), released: String(r.releaseDate || '').slice(0, 10), lengthSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null, cover: String(r.artworkUrl100 || '').replace(/\/\d+x\d+bb/, '/200x200bb'), preview: /^https:\/\//.test(String(r.previewUrl || '')) ? String(r.previewUrl) : null }));
  const t = lfm?.track || null;
  const art = String(it?.artworkUrl100 || '').replace(/\/\d+x\d+bb/, '/600x600bb');
  return {
    kind: 'song', title: name, artist: by, album: String(it?.collectionName || dt?.album?.title || ''),
    cover: art || String(dt?.album?.cover_big || ''),
    releaseDate: String(it?.releaseDate || dt?.release_date || '').slice(0, 10) || null,
    lengthSec: it?.trackTimeMillis ? Math.round(it.trackTimeMillis / 1000) : num(dt?.duration),
    genre: String(it?.primaryGenreName || '') || null,
    explicit: it ? it.trackExplicitness === 'explicit' : (dt ? !!dt.explicit_lyrics : null),
    trackNumber: num(it?.trackNumber), trackCount: num(it?.trackCount),
    bpm: num(dt?.bpm),
    popularity: num(dt?.rank),           // Deezer's own 0 to 1,000,000 score, not a stream count
    credits: (dt?.contributors || []).map((c: any) => String(c.name || '')).filter(Boolean).slice(0, 6),
    plays: num(t?.playcount), listeners: num(t?.listeners),   // Last.fm, only with the API key
    preview: /^https:\/\//.test(String(it?.previewUrl || dt?.preview || '')) ? String(it?.previewUrl || dt?.preview) : null,
    link: String(it?.trackViewUrl || ''), deezer: String(dhit?.link || ''),
    about, artistId: num(dhit?.artist?.id), artistPhoto: String(dhit?.artist?.picture_medium || '') || null,
    albumInfo: coll ? { name: String(coll.collectionName || ''), released: String(coll.releaseDate || '').slice(0, 10), label: String(coll.copyright || '').replace(/^[℗©]\s*\d{4}\s*/, '') || null, tracks: num(coll.trackCount), lengthSec: albumTracks.reduce((t: number, x: any) => t + (x.lengthSec || 0), 0) || null } : null,
    albumTracks, moreBy,
  };
}

// ---- one artist ----
async function artist(id: string, nameHint: string) {
  if (!/^\d{1,12}$/.test(id)) throw new Error('bad id');
  const [a, top, albums, related] = await Promise.all([
    getJson(`https://api.deezer.com/artist/${id}`),
    safe(getJson(`https://api.deezer.com/artist/${id}/top?limit=10`)),
    safe(getJson(`https://api.deezer.com/artist/${id}/albums?limit=300`)),
    safe(getJson(`https://api.deezer.com/artist/${id}/related?limit=6`)),
  ]);
  const name = String(a?.name || nameHint || '');
  // Discography: one row per title (deluxe and explicit copies collapse), newest first.
  const seen = new Set<string>(); const rows: any[] = [];
  for (const x of (albums?.data || []).slice().sort((p: any, q: any) => String(q.release_date).localeCompare(String(p.release_date)))) {
    const k = norm(x.title); if (!k || seen.has(k)) continue; seen.add(k);
    rows.push({ title: String(x.title || ''), year: String(x.release_date || '').slice(0, 4), type: String(x.record_type || 'album'), cover: String(x.cover_medium || '') });
  }
  const dated = rows.filter((r) => r.year && r.year !== '0000');
  const firstYear = dated.length ? Math.min(...dated.map((r) => Number(r.year))) : null;
  const lastYear = dated.length ? Math.max(...dated.map((r) => Number(r.year))) : null;
  const counts = { albums: rows.filter((r) => r.type === 'album').length, eps: rows.filter((r) => r.type === 'ep').length, singles: rows.filter((r) => r.type === 'single').length };
  const [mb, lfm, about, its, art] = await Promise.all([
    safe(getJson(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent('artist:"' + name + '"')}&fmt=json&limit=3`, nice)),
    lastfm({ method: 'artist.getInfo', artist: name }),
    wiki(`${name} musician`, [name.split(' ')[0]], 900, /singer|rapper|musician|band|songwriter|record producer|\bDJ\b|vocalist|group|duo|composer/i),
    safe(getJson(`https://itunes.apple.com/search?media=music&entity=song&attribute=artistTerm&limit=50&country=us&term=${encodeURIComponent(name)}`)),
    tsdb(name),
  ]);
  const m = (mb?.artists || []).find((x: any) => norm(x.name) === norm(name) && Number(x.score) >= 85) || null;
  const tags = (m?.tags || []).slice().sort((p: any, q: any) => (q.count || 0) - (p.count || 0)).slice(0, 4).map((t: any) => String(t.name));
  const place = [m?.['begin-area']?.name || m?.area?.name].filter(Boolean)[0] || null;
  const mine = (its?.results || []).filter((r: any) => r.wrapperType === 'track' && norm(r.artistName) === norm(name));
  const seenT = new Set<string>();
  const latest = mine.slice().sort((p: any, q: any) => String(q.releaseDate).localeCompare(String(p.releaseDate))).filter((r: any) => { const k = norm(r.trackName); if (!k || seenT.has(k)) return false; seenT.add(k); return true; }).slice(0, 6)
    .map((r: any) => ({ id: String(r.trackId || ''), title: String(r.trackName || ''), album: String(r.collectionName || ''), released: String(r.releaseDate || '').slice(0, 10), lengthSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : null, cover: String(r.artworkUrl100 || '').replace(/\/\d+x\d+bb/, '/200x200bb'), explicit: r.trackExplicitness === 'explicit', preview: /^https:\/\//.test(String(r.previewUrl || '')) ? String(r.previewUrl) : null }));
  const gc: Record<string, number> = {}; for (const r of mine) if (r.primaryGenreName) gc[r.primaryGenreName] = (gc[r.primaryGenreName] || 0) + 1;
  const genre = Object.entries(gc).sort((p, q) => q[1] - p[1])[0]?.[0] || null;
  const yr = (d: any) => (typeof d === 'string' && /^\d{4}/.test(d) ? d.slice(0, 4) : null);
  return {
    kind: 'artist', id: Number(id), name, picture: String(a?.picture_xl || a?.picture_big || a?.picture_medium || ''), photo: art?.thumb || about?.photo || null, banner: art?.banner || null, tagline: about?.desc || null, genre, latest, fans: num(a?.nb_fan), link: String(a?.link || ''),
    type: m?.type || null,                                   // Person or Group
    born: m?.type === 'Person' ? (m?.['life-span']?.begin || null) : null,
    formed: m?.type === 'Group' ? yr(m?.['life-span']?.begin) : null,
    ended: m?.['life-span']?.ended ? yr(m?.['life-span']?.end) : null,
    from: place, country: m?.country || null, tags,
    firstYear, lastYear, counts,
    listeners: num(lfm?.artist?.stats?.listeners), plays: num(lfm?.artist?.stats?.playcount),
    top: (top?.data || []).slice(0, 10).map((t: any) => ({ title: String(t?.title_short || t?.title || ''), album: String(t?.album?.title || ''), cover: String(t?.album?.cover_medium || ''), lengthSec: num(t?.duration), popularity: num(t?.rank), explicit: !!t?.explicit_lyrics, preview: /^https:\/\//.test(String(t?.preview || '')) ? String(t.preview) : null })),
    albums: rows.filter((r) => r.type !== 'single').slice(0, 8),
    related: (related?.data || []).slice(0, 6).map((r: any) => ({ id: Number(r.id) || null, name: String(r.name || ''), picture: String(r.picture_medium || '') })),
    about,
  };
}

// ---- markets ----
const NQ = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' };
// Sector tabs. Each list is a pool of well-known candidates (a few more than ten, so the top ten by market
// cap stays right as rankings move). "AI software" and "AI infrastructure" are themes rather than official
// sectors, so they are curated here. Edit the pools to change what a tab can show.
const SECTORS: Record<string, { label: string; syms: string[] }> = {
  tech: { label: 'Technology', syms: ['AAPL', 'MSFT', 'NVDA', 'AVGO', 'ORCL', 'CRM', 'ADBE', 'AMD', 'CSCO', 'IBM', 'INTU', 'QCOM', 'TXN', 'NOW', 'AMAT', 'MU', 'LRCX', 'PANW', 'ANET', 'KLAC', 'INTC', 'ACN'] },
  aiinfra: { label: 'AI infrastructure', syms: ['NVDA', 'TSM', 'AVGO', 'ASML', 'AMD', 'MU', 'AMAT', 'LRCX', 'KLAC', 'ARM', 'ANET', 'MRVL', 'DELL', 'SMCI', 'VRT', 'CRWV', 'CEG', 'VST'] },
  aisoft: { label: 'AI software', syms: ['MSFT', 'ORCL', 'PLTR', 'CRM', 'NOW', 'ADBE', 'INTU', 'PANW', 'APP', 'CRWD', 'SNOW', 'DDOG', 'WDAY', 'ADSK', 'TEAM'] },
  fin: { label: 'Financials', syms: ['JPM', 'V', 'MA', 'BAC', 'WFC', 'GS', 'MS', 'AXP', 'C', 'BLK', 'SCHW', 'SPGI', 'PGR', 'BX'] },
  health: { label: 'Healthcare', syms: ['LLY', 'UNH', 'JNJ', 'ABBV', 'MRK', 'TMO', 'ABT', 'ISRG', 'AMGN', 'PFE', 'DHR', 'BSX', 'GILD', 'VRTX'] },
  disc: { label: 'Consumer discretionary', syms: ['AMZN', 'TSLA', 'HD', 'MCD', 'BKNG', 'LOW', 'TJX', 'NKE', 'SBUX', 'MELI', 'ABNB', 'CMG', 'ORLY', 'GM', 'F', 'MAR'] },
  stap: { label: 'Consumer staples', syms: ['WMT', 'COST', 'PG', 'KO', 'PEP', 'PM', 'MDLZ', 'MO', 'CL', 'TGT', 'KMB', 'KDP', 'GIS', 'STZ', 'MNST', 'KR', 'HSY'] },
  energy: { label: 'Energy', syms: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'WMB', 'PSX', 'MPC', 'OXY', 'KMI', 'VLO', 'EPD'] },
  comm: { label: 'Communication', syms: ['GOOGL', 'GOOG', 'META', 'NFLX', 'DIS', 'TMUS', 'T', 'VZ', 'CMCSA', 'SPOT', 'EA', 'TTWO'] },
  ind: { label: 'Industrials', syms: ['GE', 'CAT', 'RTX', 'UNP', 'BA', 'HON', 'DE', 'LMT', 'UPS', 'ETN', 'GEV', 'ADP', 'WM', 'NOC'] },
};
function cleanName(n: unknown): string {
  return String(n || '').replace(/\s+(Class [A-Z]\b.*|Common Stock.*|Capital Stock.*|Ordinary Shares.*|American Depositary.*|Common Shares.*)$/i, '').trim();
}
// The ten biggest by market cap, one row per company (GOOG and GOOGL count once). `only` limits it to a pool of symbols.
function topCompanies(rows: any[], n: number, only?: Set<string>) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const r of rows) {
    if (only && !only.has(String(r.symbol || '').toUpperCase())) continue;
    const base = cleanName(r.name);
    const key = base.toLowerCase();
    if (!base || seen.has(key)) continue;
    const cap = Number(String(r.marketCap || '').replace(/[$,]/g, ''));
    if (!isFinite(cap) || cap <= 0) continue;
    seen.add(key);
    out.push({ symbol: String(r.symbol || ''), name: base, price: String(r.lastsale || ''), pct: String(r.pctchange || ''), cap });
  }
  out.sort((a, b) => b.cap - a.cap);
  return out.slice(0, n).map((x, i) => ({ rank: i + 1, ...x }));
}
async function markets() {
  const url = 'https://api.nasdaq.com/api/screener/stocks?tableonly=true&offset=0&sortcolumn=marketcap&sortorder=desc&limit=';
  let rows: any[] = [];
  let wide = false;
  // One wide pull covers every sector pool. If Nasdaq won't give that many rows, fall back to the original
  // 40-row pull: the overall list still works and the sector tabs just don't appear.
  try {
    const d = await getJson(url + '300', NQ);
    rows = d?.data?.table?.rows || d?.data?.rows || [];
    wide = rows.length >= 100;
  } catch (_) { /* fall back below */ }
  if (!wide) {
    const d = await getJson(url + '40', NQ);
    rows = d?.data?.table?.rows || d?.data?.rows || [];
  }
  const out: Record<string, unknown> = { kind: 'markets', companies: topCompanies(rows.slice(0, 40), 10) };
  if (wide) {
    const sectors: Record<string, { label: string; companies: any[] }> = {};
    for (const [key, s] of Object.entries(SECTORS)) {
      const companies = topCompanies(rows, 10, new Set(s.syms));
      if (companies.length >= 3) sectors[key] = { label: s.label, companies };
    }
    if (Object.keys(sectors).length) out.sectors = sectors;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const kind = (new URL(req.url).searchParams.get('kind') || '').toLowerCase();
  if (!TTL[kind]) return new Response(JSON.stringify({ error: 'bad kind' }), { status: 400, headers: CORS });
  const aid = new URL(req.url).searchParams.get('id') || '';
  const sp = new URL(req.url).searchParams;
  const ckey = kind === 'artist' ? 'artist:' + aid : kind === 'song' ? 'song:' + aid + ':' + (sp.get('title') || '') : kind;
  const hit = cache.get(ckey);
  let body: string;
  if (hit && Date.now() - hit.at < TTL[kind]) body = hit.body;
  else {
    try {
      const data = SPORTS[kind] ? await standings(kind) : kind === 'music' ? await music() : kind === 'artist' ? await artist(aid, (sp.get('name') || '').slice(0, 80)) : kind === 'song' ? await song(aid, (sp.get('artist') || '').slice(0, 120), (sp.get('title') || '').slice(0, 160)) : await markets();
      body = JSON.stringify({ ...data, at: new Date().toISOString() });
      cache.set(ckey, { at: (data as any).partial ? Date.now() - TTL[kind] + 45000 : Date.now(), body }); if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    } catch (e) {
      body = hit ? hit.body : JSON.stringify({ error: 'unavailable', detail: String(e).slice(0, 80) });
    }
  }
  return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=' + Math.floor(TTL[kind] / 20) } });
});
