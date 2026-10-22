// Current standings and charts for the Rankings panel. Public, no keys. Cached per list.
//   GET .../functions/v1/rankings?kind=nba|nfl|nhl|mlb   standings (ESPN public feed, unofficial), 10 min
//   GET .../functions/v1/rankings?kind=music             top 10 country songs, top 10 songs, top 10 artists, 1 hour
//   GET .../functions/v1/rankings?kind=markets           largest US-listed companies by market cap (Nasdaq public API), 5 min
//   GET .../functions/v1/rankings?kind=artist&id=246791  one artist: photo, fans, top tracks (Deezer)
// Team badges come from TheSportsDB (free, already credited on the site); team colors from ESPN's team list; album art and artist photos from Apple and Deezer.

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
    for (const t of tl?.sports?.[0]?.leagues?.[0]?.teams || []) { const x = t?.team; if (x?.id) col[String(x.id)] = { color: /^[0-9a-f]{6}$/i.test(x.color || '') ? '#' + x.color.toLowerCase() : null, alt: /^[0-9a-f]{6}$/i.test(x.alternateColor || '') ? '#' + x.alternateColor.toLowerCase() : null }; }
    for (const g of groups) for (const r of g.rows) Object.assign(r, col[r.id] || {});
  } catch (_) { /* colors are decoration */ }
  try {
    const bm = await badges(kind);
    const todo: any[] = [];
    for (const g of groups) for (const r of g.rows) { r.logo = badgeFor(bm, String(r.name || '')); if (!r.logo && !bm['!' + String(r.name).toLowerCase()]) todo.push(r); }
    // The free list endpoint only returns 10 teams, so look the rest up one by one (20 a time, remembered for a day).
    const key = Deno.env.get('THESPORTSDB_API_KEY') || '123';
    await Promise.all(todo.slice(0, 20).map(async (r) => {
      const n = String(r.name).toLowerCase();
      try {
        const d = await getJson(`https://www.thesportsdb.com/api/v1/json/${key}/searchteams.php?t=${encodeURIComponent(r.name)}`);
        const t = (d?.teams || []).find((x: any) => String(x?.strTeam || '').toLowerCase() === n && String(x?.strLeague || '') === LEAGUE_NAME[kind]);
        const b = String(t?.strBadge || t?.strTeamBadge || '');
        if (/^https:\/\//.test(b)) { bm[n] = b + '/small'; r.logo = bm[n]; } else bm['!' + n] = '1';
      } catch (_) { /* try again next time */ }
    }));
  } catch (_) { /* badges are decoration */ }
  const partial = groups.some((g: any) => g.rows.some((r: any) => !r.logo && !badgeCacheMiss(kind, r.name)));
  const season = d?.seasons?.[0]?.displayName || d?.season?.displayName || null;
  const st = groups[0]?.st;
  const phase = st === 1 ? 'Preseason' : st === 3 ? 'Postseason' : st === 2 ? 'Regular season' : null;
  return { kind, season, phase, groups, partial };
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
  const ckey = kind === 'artist' ? 'artist:' + aid : kind;
  const hit = cache.get(ckey);
  let body: string;
  if (hit && Date.now() - hit.at < TTL[kind]) body = hit.body;
  else {
    try {
      const data = SPORTS[kind] ? await standings(kind) : kind === 'music' ? await music() : kind === 'artist' ? await artist(aid) : await markets();
      body = JSON.stringify({ ...data, at: new Date().toISOString() });
      cache.set(ckey, { at: (data as any).partial ? Date.now() - TTL[kind] + 45000 : Date.now(), body }); if (cache.size > 100) cache.delete(cache.keys().next().value as string);
    } catch (e) {
      body = hit ? hit.body : JSON.stringify({ error: 'unavailable', detail: String(e).slice(0, 80) });
    }
  }
  return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=' + Math.floor(TTL[kind] / 20) } });
});
