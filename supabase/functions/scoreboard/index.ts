// Live scores, records and TV network for today's games, for the ribbon at the top of the site.
// Public, no key. Source: ESPN public scoreboard feed (unofficial; it rejects bot-like user agents, hence the plain one below).
// does, the ribbon simply falls back to showing time and teams). No logos are returned on purpose.
// Cached for 30 seconds so many visitors cost one request upstream.
//
// GET  .../functions/v1/scoreboard            -> { games: [...] }
// Each game: { league, home, away, state: 'pre'|'in'|'post', detail, network }
//   home/away: { name, abbr, score, record }

const FEEDS: [string, string][] = [
  ['NFL', 'football/nfl'], ['NBA', 'basketball/nba'], ['MLB', 'baseball/mlb'], ['NHL', 'hockey/nhl'],
  ['WNBA', 'basketball/wnba'], ['EPL', 'soccer/eng.1'], ['UCL', 'soccer/uefa.champions'], ['MLS', 'soccer/usa.1'],
];
const UA = { 'user-agent': 'curl/8.5.0', accept: 'application/json' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
let cache: { at: number; body: string } | null = null;
const teamCache = new Map<string, { at: number; body: string }>();
const PATHS: Record<string, string> = Object.fromEntries(FEEDS);
// Season numbers worth showing first, in this order (ESPN stat names). Anything else is skipped.
const WANT = ['avgPointsFor', 'avgPointsAgainst', 'differential', 'winPercent', 'streak', 'pointsFor', 'pointsAgainst', 'gamesBehind'];

// ?team=NFL:28  -> record, standing and season numbers for one team
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
  const body = JSON.stringify({
    name: String(t.displayName || ''), record: total.summary || null, standing: t.standingSummary || null,
    home: items.find((i: any) => i.type === 'home')?.summary || null, road: items.find((i: any) => i.type === 'road')?.summary || null,
    stats,
  });
  teamCache.set(key, { at: Date.now(), body });
  return body;
}

function side(c: any) {
  const rec = (c?.records || []).find((r: any) => r.type === 'total') || (c?.records || [])[0];
  return {
    id: String(c?.team?.id || ''), name: String(c?.team?.displayName || ''), abbr: String(c?.team?.abbreviation || ''),
    score: c?.score != null && c.score !== '' ? String(c.score) : null,
    record: rec?.summary ? String(rec.summary) : null,
  };
}

async function load() {
  const games: any[] = [];
  const errors: string[] = [];
  await Promise.all(FEEDS.map(async ([league, path]) => {
    try {
      const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard`, { headers: UA, signal: AbortSignal.timeout(8000) });
      if (!res.ok) { errors.push(league + ' ' + res.status); return; }
      const d = await res.json();
      for (const e of d?.events || []) {
        const comp = e?.competitions?.[0];
        const cs = comp?.competitors || [];
        const home = cs.find((c: any) => c.homeAway === 'home'), away = cs.find((c: any) => c.homeAway === 'away');
        if (!home || !away) continue;
        const t = e?.status?.type || {};
        const net = (comp?.broadcasts || []).flatMap((b: any) => b?.names || [])[0] || (comp?.geoBroadcasts || [])[0]?.media?.shortName || null;
        games.push({
          league, start: e.date, state: String(t.state || 'pre'), detail: String(t.shortDetail || t.detail || ''),
          network: net, home: side(home), away: side(away),
        });
      }
    } catch (e) { errors.push(league + ' ' + String(e).slice(0, 60)); }
  }));
  return JSON.stringify({ games, errors, at: new Date().toISOString() });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const tk = new URL(req.url).searchParams.get('team');
  if (tk) {
    let body = JSON.stringify({ error: 'unavailable' });
    try { body = await team(tk); } catch (_) { /* keep the error body */ }
    return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
  }
  if (!cache || Date.now() - cache.at > 30000) cache = { at: Date.now(), body: await load() };
  return new Response(cache.body, { headers: { ...CORS, 'cache-control': 'public, max-age=30' } });
});
