// Season league leaders for the Rankings tab. Public, no keys. Cached 30 minutes per league.
//   GET .../functions/v1/leaders?league=nba|nfl|nhl|mlb
// Returns every stat category ESPN lists (points, assists, receptions, goals, home runs, ...), top 10 each,
// with ESPN's own player headshot link.

const UA = 'curl/8.5.0';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const SPORTS: Record<string, string> = { nba: 'basketball/nba', nfl: 'football/nfl', nhl: 'hockey/nhl', mlb: 'baseball/mlb' };
const cache = new Map<string, { at: number; body: string }>();
const hex = (v: unknown) => (/^[0-9a-f]{6}$/i.test(String(v || '')) ? '#' + String(v).toLowerCase() : null);
// Some feeds put a whole game line in displayValue (e.g. "8-19, 4 HR, 9 RBI"). Show the real number as the value and keep the line as small text.
function fmt(label: string, l: any): { value: string; sub: string } {
  const dv = String(l?.displayValue ?? ''), n = Number(l?.value);
  if (/^[-+]?[\d.,]+%?$/.test(dv)) return { value: dv, sub: '' };
  if (!isFinite(n)) return { value: dv, sub: '' };
  let v: string;
  if (Number.isInteger(n)) v = String(n);
  else if (/average|slugging|on.base|percentage|ops/i.test(label)) v = n >= 1 ? n.toFixed(3) : n.toFixed(3).replace(/^0/, '');
  else v = n.toFixed(2);
  return { value: v, sub: dv.length > 18 ? '' : dv };
}

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
          ...fmt(String(c?.displayName || ''), l),
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
