// Season league leaders for the Rankings tab. Public, no keys. Cached 30 minutes per league.
//   GET .../functions/v1/leaders?league=nba|nfl|nhl|mlb
// Returns every stat category ESPN lists (points, assists, receptions, goals, home runs, ...), top 10 each,
// with ESPN's own player headshot link.

const UA = 'curl/8.5.0';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const SPORTS: Record<string, string> = { nba: 'basketball/nba', nfl: 'football/nfl', nhl: 'hockey/nhl', mlb: 'baseball/mlb' };
const cache = new Map<string, { at: number; body: string }>();
const hex = (v: unknown) => (/^[0-9a-f]{6}$/i.test(String(v || '')) ? '#' + String(v).toLowerCase() : null);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const league = new URL(req.url).searchParams.get('league') || '';
  if (!SPORTS[league]) return new Response(JSON.stringify({ error: 'bad league' }), { status: 400, headers: CORS });
  const hit = cache.get(league);
  if (hit && Date.now() - hit.at < 1800000) return new Response(hit.body, { headers: CORS });
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v3/sports/${SPORTS[league]}/leaders`, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error('espn ' + r.status);
    const d = await r.json();
    const categories = (d?.leaders?.categories || []).map((c: any) => ({
      key: String(c?.name || ''), label: String(c?.displayName || c?.name || ''), abbr: String(c?.abbreviation || ''),
      leaders: (c?.leaders || []).slice(0, 10).map((l: any, i: number) => {
        const a = l?.athlete || {}, t = l?.team || a?.team || {}, hs = String(a?.headshot?.href || '');
        return {
          rank: i + 1, id: String(a?.id || ''), name: String(a?.displayName || a?.fullName || ''), pos: String(a?.position?.abbreviation || ''),
          team: String(t?.displayName || ''), abbr: String(t?.abbreviation || ''), color: hex(t?.color), alt: hex(t?.alternateColor),
          value: String(l?.displayValue ?? l?.value ?? ''),
          hs: /^https:\/\/a\.espncdn\.com\/i\/headshots\/[a-z0-9\/_\-.]+\.png$/i.test(hs) ? hs : null,
        };
      }),
    })).filter((c: any) => c.key && c.leaders.length);
    const body = JSON.stringify({ league, season: String(d?.requestedSeason?.displayName || d?.season?.displayName || ''), categories });
    if (categories.length) cache.set(league, { at: Date.now(), body });
    return new Response(body, { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers: CORS });
  }
});
