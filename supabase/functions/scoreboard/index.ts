// Live scores, records and TV network for today's games, for the ribbon at the top of the site.
// Public, no key. Source: ESPN public scoreboard feed (unofficial; it rejects bot-like user agents, hence the plain one below).
// does, the ribbon simply falls back to showing time and teams). No logos are returned on purpose.
// Cached for 30 seconds so many visitors cost one request upstream.
//
// GET  .../functions/v1/scoreboard            -> { games: [...] }   (today)
// GET  .../functions/v1/scoreboard?dates=20261024 -> the same for one day (Eastern date)
// Each game: { league, home, away, state: 'pre'|'in'|'post', detail, network }
//   home/away: { name, abbr, score, record }

const FEEDS: [string, string][] = [
  ['NFL', 'football/nfl'], ['NBA', 'basketball/nba'], ['MLB', 'baseball/mlb'], ['NHL', 'hockey/nhl'],
  ['WNBA', 'basketball/wnba'], ['EPL', 'soccer/eng.1'], ['UCL', 'soccer/uefa.champions'], ['MLS', 'soccer/usa.1'],
  ['NCAAF', 'football/college-football'],
];
const UA = { 'user-agent': 'curl/8.5.0', accept: 'application/json' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const cache = new Map<string, { at: number; body: string }>();
const teamCache = new Map<string, { at: number; body: string }>();
const PATHS: Record<string, string> = Object.fromEntries(FEEDS);
// Season numbers worth showing first, in this order (ESPN stat names). Anything else is skipped.
const WANT = ['avgPointsFor', 'avgPointsAgainst', 'differential', 'winPercent', 'streak', 'pointsFor', 'pointsAgainst', 'gamesBehind'];

// ?team=NFL:28  -> record, standing and season numbers for one team
const hex = (v: any) => (/^[0-9a-fA-F]{6}$/.test(String(v || '')) ? '#' + String(v).toLowerCase() : null);

async function team(key: string) {
  const [league, id] = key.split(':');
  if (!PATHS[league] || !/^\d{1,6}$/.test(id || '')) return JSON.stringify({ error: 'bad team' });
  const hit = teamCache.get(key);
  if (hit && Date.now() - hit.at < 600000) return hit.body;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${PATHS[league]}/teams/${id}`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return JSON.stringify({ error: 'unavailable' });
  const t = (await res.json())?.team || {};
  const items = t?.record?.items || [];
  const total = items.find((i: any) => i.type === 'total') || items[0] || {};
  const stats = (total.stats || []).filter((x: any) => WANT.includes(x.name))
    .sort((a: any, b: any) => WANT.indexOf(a.name) - WANT.indexOf(b.name))
    .map((x: any) => ({ label: String(x.shortDisplayName || x.displayName || x.name), value: String(x.displayValue ?? x.value) }));
  // Season leaders: ESPN only lists them on a scoreboard game, so look up the team's next (or last) game day.
  let lead: any[] = [];
  try {
    const ev = (t.nextEvent || [])[0];
    const d = ev?.date ? new Date(ev.date) : null;
    if (d) {
      const et = new Date(d.getTime() - 5 * 3600000); // close enough to the Eastern calendar day
      const ds = et.getUTCFullYear() + String(et.getUTCMonth() + 1).padStart(2, '0') + String(et.getUTCDate()).padStart(2, '0');
      const sb = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${PATHS[league]}/scoreboard?dates=${ds}`, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (sb.ok) for (const e of (await sb.json())?.events || []) for (const c of e?.competitions?.[0]?.competitors || []) if (String(c?.team?.id) === id) lead = leaders(c);
    }
  } catch (_) { /* leaders are optional */ }
  const body = JSON.stringify({
    color: hex(t.color), alt: hex(t.alternateColor), leaders: lead,
    name: String(t.displayName || ''), record: total.summary || null, standing: t.standingSummary || null,
    home: items.find((i: any) => i.type === 'home')?.summary || null, road: items.find((i: any) => i.type === 'road')?.summary || null,
    stats,
  });
  teamCache.set(key, { at: Date.now(), body });
  return body;
}

// Season leaders for one side (passing/rushing/receiving, points/rebounds/assists, ...). Names and jersey
// numbers only: facts, not logos or photos.
function leaders(c: any) {
  const out: any[] = [];
  for (const g of c?.leaders || []) {
    const l = g?.leaders?.[0], a = l?.athlete;
    if (!a?.displayName) continue;
    out.push({
      key: String(g.name || ''), label: String(g.shortDisplayName || g.displayName || ''),
      name: String(a.shortName || a.displayName), full: String(a.displayName), num: a.jersey != null ? String(a.jersey) : null,
      pos: a.position?.abbreviation ? String(a.position.abbreviation) : null, line: String(l.displayValue || ''),
      // ESPN's own single-player headshot, used by the app ONLY when no free (Wikimedia Commons) photo exists.
      hs: /^https:\/\/a\.espncdn\.com\/i\/headshots\/[a-z0-9\/_\-.]+\.png$/i.test(String(a.headshot?.href || a.headshot || '')) ? String(a.headshot?.href || a.headshot) : null,
    });
    if (out.length >= 3) break;
  }
  return out;
}

function side(c: any) {
  const rec = (c?.records || []).find((r: any) => r.type === 'total') || (c?.records || [])[0];
  return {
    id: String(c?.team?.id || ''), name: String(c?.team?.displayName || ''), abbr: String(c?.team?.abbreviation || ''),
    color: hex(c?.team?.color), alt: hex(c?.team?.alternateColor), leaders: leaders(c),
    rank: Number(c?.curatedRank?.current) >= 1 && Number(c?.curatedRank?.current) <= 25 ? Number(c.curatedRank.current) : null,
    score: c?.score != null && c.score !== '' ? String(c.score) : null,
    record: rec?.summary ? String(rec.summary) : null,
  };
}

async function load(date: string | null) {
  const games: any[] = [];
  const errors: string[] = [];
  await Promise.all(FEEDS.map(async ([league, path]) => {
    try {
      const q = [date ? 'dates=' + date : '', league === 'NCAAF' ? 'groups=80&limit=300' : ''].filter(Boolean).join('&');
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard${q ? '?' + q : ''}`, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (!res.ok) { errors.push(league + ' ' + res.status); return; }
      const d = await res.json();
      for (const e of d?.events || []) {
        const comp = e?.competitions?.[0];
        const cs = comp?.competitors || [];
        const home = cs.find((c: any) => c.homeAway === 'home'), away = cs.find((c: any) => c.homeAway === 'away');
        if (!home || !away) continue;
        // College football: only games with a ranked (top 25) team, otherwise there are 60+ a Saturday.
        if (league === 'NCAAF' && !side(home).rank && !side(away).rank) continue;
        const t = e?.status?.type || {};
        const net = (comp?.broadcasts || []).flatMap((b: any) => b?.names || [])[0] || (comp?.geoBroadcasts || [])[0]?.media?.shortName || null;
        games.push({
          league, id: String(e.id || ''), start: e.date, state: String(t.state || 'pre'), detail: String(t.shortDetail || t.detail || ''),
          network: net, home: side(home), away: side(away),
        });
      }
    } catch (e) { errors.push(league + ' ' + String(e).slice(0, 60)); }
  }));
  return JSON.stringify({ games, errors, at: new Date().toISOString() });
}

// ?game=NHL:401892535 -> live detail: line score, team stats, player stats, recent plays (ESPN summary feed)
const gameCache = new Map<string, { at: number; body: string }>();
const num = (v: any) => (v == null ? '' : String(v));
async function game(key: string) {
  const [league, id] = key.split(':');
  if (!PATHS[league] || !/^\d{5,12}$/.test(id || '')) return JSON.stringify({ error: 'bad game' });
  const hit = gameCache.get(key);
  if (hit && Date.now() - hit.at < 10000) return hit.body;
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${PATHS[league]}/summary?event=${id}`, { headers: UA, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return JSON.stringify({ error: 'unavailable' });
  const d = await res.json();
  const comp = d?.header?.competitions?.[0] || {};
  const st = comp?.status?.type || {};
  const sides: any = {};
  for (const c of comp.competitors || []) {
    sides[c.homeAway] = {
      id: String(c.team?.id || ''), abbr: String(c.team?.abbreviation || ''), name: String(c.team?.displayName || ''),
      color: hex(c.team?.color), score: c.score != null ? String(c.score) : null, record: (c.record || []).find((r: any) => r.type === 'total')?.displayValue || null,
      lines: (c.linescores || []).map((l: any) => num(l.displayValue ?? l.value)),
    };
  }
  const idOf = (x: any) => String(x?.team?.id || '');
  const stats = (tid: string) => (d?.boxscore?.teams || []).find((t: any) => idOf(t) === tid)?.statistics || [];
  const a = stats(sides.away?.id), h = stats(sides.home?.id);
  const teamStats = a.map((s: any) => {
    const o = h.find((x: any) => (x.name || x.label) === (s.name || s.label));
    return o && s.displayValue != null ? { label: String(s.label || s.name), away: num(s.displayValue), home: num(o.displayValue) } : null;
  }).filter(Boolean).slice(0, 10);
  const players = (tid: string) => {
    const t = (d?.boxscore?.players || []).find((p: any) => idOf(p) === tid);
    return (t?.statistics || []).slice(0, 4).map((g: any) => {
      const labels: string[] = g.labels || [];
      let rows = (g.athletes || []).filter((x: any) => x?.athlete?.displayName && (x.stats || []).length).map((x: any) => ({
        name: String(x.athlete.shortName || x.athlete.displayName), pos: x.athlete.position?.abbreviation || null, num: x.athlete.jersey || null, stats: (x.stats || []).map(num),
      }));
      const pi = labels.indexOf('PTS');
      if (pi >= 0) rows = rows.sort((p: any, q: any) => (parseFloat(q.stats[pi]) || 0) - (parseFloat(p.stats[pi]) || 0));
      return { cat: String(g.text || g.name || ''), labels, rows: rows.slice(0, pi >= 0 ? 6 : 4) };
    }).filter((g: any) => g.rows.length);
  };
  let plays: any[] = Array.isArray(d?.plays) ? d.plays : [];
  if (!plays.length && d?.drives?.current?.plays) plays = d.drives.current.plays;
  const recent = plays.slice(-8).reverse().map((p: any) => ({
    t: String([p.period?.displayValue || (p.period?.number ? 'P' + p.period.number : ''), p.clock?.displayValue].filter(Boolean).join(' ')),
    text: String(p.text || p.shortText || '').slice(0, 160), score: !!p.scoringPlay,
  })).filter((p: any) => p.text);
  const body = JSON.stringify({
    state: String(st.state || 'pre'), detail: String(st.shortDetail || st.detail || ''), away: sides.away || null, home: sides.home || null,
    teamStats, players: { away: players(sides.away?.id), home: players(sides.home?.id) }, plays: recent, at: new Date().toISOString(),
  });
  gameCache.set(key, { at: Date.now(), body });
  if (gameCache.size > 60) gameCache.delete(gameCache.keys().next().value as string);
  return body;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const gk = new URL(req.url).searchParams.get('game');
  if (gk) {
    let body = JSON.stringify({ error: 'unavailable' });
    try { body = await game(gk); } catch (_) { /* keep the error body */ }
    return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=8' } });
  }
  const tk = new URL(req.url).searchParams.get('team');
  if (tk) {
    let body = JSON.stringify({ error: 'unavailable' });
    try { body = await team(tk); } catch (_) { /* keep the error body */ }
    return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
  }
  const dp = new URL(req.url).searchParams.get('dates');
  const date = dp && /^\d{8}$/.test(dp) ? dp : null;
  const key = date || 'today', ttl = date ? 300000 : 30000;
  const hit = cache.get(key);
  let body: string;
  if (hit && Date.now() - hit.at < ttl) body = hit.body;
  else { body = await load(date); cache.set(key, { at: Date.now(), body }); if (cache.size > 20) cache.delete(cache.keys().next().value as string); }
  return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=' + (ttl / 1000) } });
});
