// Current standings and charts for the Rankings panel. Public, no keys. Cached per list.
//   GET .../functions/v1/rankings?kind=nba|nfl|nhl|mlb   standings (ESPN public feed, unofficial), 10 min
//   GET .../functions/v1/rankings?kind=music             top 10 country songs, top 10 songs, top 10 artists, 1 hour
//   GET .../functions/v1/rankings?kind=markets           largest US-listed companies by market cap (Nasdaq public API), 5 min
//   GET .../functions/v1/rankings?kind=artist&id=246791  one artist: photo, fans, top tracks (Deezer)
// Team colors come from ESPN's team list; album art and artist photos from Apple and Deezer.

const UA = 'curl/8.5.0';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const cache = new Map<string, { at: number; body: string }>();
const TTL: Record<string, number> = { nba: 600000, nfl: 600000, nhl: 600000, mlb: 600000, music: 3600000, markets: 300000, artist: 3600000 };
const SPORTS: Record<string, string> = { nba: 'basketball/nba', nfl: 'football/nfl', nhl: 'hockey/nhl', mlb: 'baseball/mlb' };

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(new URL(url).hostname + ' ' + r.status);
  return r.json();
}

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
    for (const t of tl?.sports?.[0]?.leagues?.[0]?.teams || []) { const x = t?.team; if (x?.id) col[String(x.id)] = { color: /^[0-9a-f]{6}$/i.test(x.color || '') ? '#' + x.color.toLowerCase() : null, alt: /^[0-9a-f]{6}$/i.test(x.alternateColor || '') ? '#' + x.alternateColor.toLowerCase() : null }; }
    for (const g of groups) for (const r of g.rows) Object.assign(r, col[r.id] || {});
  } catch (_) { /* colors are decoration */ }
  const season = d?.seasons?.[0]?.displayName || d?.season?.displayName || null;
  const st = groups[0]?.st;
  const phase = st === 1 ? 'Preseason' : st === 3 ? 'Postseason' : st === 2 ? 'Regular season' : null;
  return { kind, season, phase, groups };
}

// ---- music ----
async function music() {
  const out: any = { countrySongs: [], songs: [], artists: [] };
  const errors: string[] = [];
  const itunes = (genre: string) => `https://itunes.apple.com/us/rss/topsongs/limit=10${genre}/json`;
  const parseSongs = (d: any) => (d?.feed?.entry || []).slice(0, 10).map((e: any, i: number) => ({ rank: i + 1, title: String(e?.['im:name']?.label || ''), artist: String(e?.['im:artist']?.label || ''), image: String((e?.['im:image'] || []).slice(-1)[0]?.label || '').replace(/\/\d+x\d+bb/, '/300x300bb'), link: String(e?.id?.label || e?.link?.attributes?.href || ''), album: String(e?.['im:collection']?.['im:name']?.label || '') }));
  await Promise.all([
    getJson(itunes('/genre=6')).then((d) => { out.countrySongs = parseSongs(d); }).catch((e) => errors.push('country ' + String(e).slice(0, 40))),
    getJson(itunes('')).then((d) => { out.songs = parseSongs(d); }).catch((e) => errors.push('songs ' + String(e).slice(0, 40))),
    getJson('https://api.deezer.com/chart/0/artists?limit=10').then((d) => { out.artists = (d?.data || []).slice(0, 10).map((a: any, i: number) => ({ rank: i + 1, id: Number(a?.id) || null, name: String(a?.name || ''), picture: String(a?.picture_medium || ''), link: String(a?.link || '') })); }).catch((e) => errors.push('artists ' + String(e).slice(0, 40))),
  ]);
  out.errors = errors;
  return out;
}

// ---- one artist ----
async function artist(id: string) {
  if (!/^\d{1,12}$/.test(id)) throw new Error('bad id');
  const [a, top] = await Promise.all([getJson(`https://api.deezer.com/artist/${id}`), getJson(`https://api.deezer.com/artist/${id}/top?limit=5`)]);
  return { kind: 'artist', id: Number(id), name: String(a?.name || ''), picture: String(a?.picture_big || a?.picture_medium || ''), fans: Number(a?.nb_fan) || null, link: String(a?.link || ''),
    top: (top?.data || []).slice(0, 5).map((t: any) => ({ title: String(t?.title_short || t?.title || ''), album: String(t?.album?.title || ''), cover: String(t?.album?.cover_medium || '') })) };
}

// ---- markets ----
const NQ = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' };
async function markets() {
  const d = await getJson('https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=40&offset=0&sortcolumn=marketcap&sortorder=desc', NQ);
  const rows: any[] = d?.data?.table?.rows || d?.data?.rows || [];
  const seen = new Set<string>();
  const list: any[] = [];
  for (const r of rows) {
    const base = String(r.name || '').replace(/\s+(Class [A-Z]\b.*|Common Stock.*|Capital Stock.*|Ordinary Shares.*|American Depositary.*|Common Shares.*)$/i, '').trim();
    const key = base.toLowerCase();
    if (!base || seen.has(key)) continue;
    seen.add(key);
    const cap = Number(String(r.marketCap || '').replace(/[$,]/g, ''));
    if (!isFinite(cap) || cap <= 0) continue;
    list.push({ rank: list.length + 1, symbol: String(r.symbol || ''), name: base, price: String(r.lastsale || ''), pct: String(r.pctchange || ''), cap });
    if (list.length >= 10) break;
  }
  return { kind: 'markets', companies: list };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const kind = (new URL(req.url).searchParams.get('kind') || '').toLowerCase();
  if (!TTL[kind]) return new Response(JSON.stringify({ error: 'bad kind' }), { status: 400, headers: CORS });
  const aid = new URL(req.url).searchParams.get('id') || '';
  const ckey = kind === 'artist' ? 'artist:' + aid : kind;
  const hit = cache.get(ckey);
  let body: string;
  if (hit && Date.now() - hit.at < TTL[kind]) body = hit.body;
  else {
    try {
      const data = SPORTS[kind] ? await standings(kind) : kind === 'music' ? await music() : kind === 'artist' ? await artist(aid) : await markets();
      body = JSON.stringify({ ...data, at: new Date().toISOString() });
      cache.set(ckey, { at: Date.now(), body }); if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    } catch (e) {
      body = hit ? hit.body : JSON.stringify({ error: 'unavailable', detail: String(e).slice(0, 80) });
    }
  }
  return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=' + Math.floor(TTL[kind] / 2000) } });
});
