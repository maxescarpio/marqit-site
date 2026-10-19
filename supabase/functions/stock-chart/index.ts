// Price history for the chart that opens when someone clicks an earnings cell in the ribbon.
// Public, no key. Source: Yahoo Finance's chart feed (same numbers as finance.yahoo.com; US quotes are
// about 15 minutes delayed). Cached 5 minutes per symbol and range so visitors never hit Yahoo directly.
//
// GET .../functions/v1/stock-chart?symbol=GE&range=1d|3m|6m|ytd
// -> { symbol, name, currency, prevClose, last, points: [[unixSeconds, price], ...] }

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const RANGES: Record<string, [string, string]> = { '1d': ['1d', '5m'], '3m': ['3mo', '1d'], '6m': ['6mo', '1d'], 'ytd': ['ytd', '1d'] };
const cache = new Map<string, { at: number; body: string }>();

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const symbol = (u.searchParams.get('symbol') || '').toUpperCase();
  const range = (u.searchParams.get('range') || '1d').toLowerCase();
  const err = (m: string, status = 400) => new Response(JSON.stringify({ error: m }), { status, headers: CORS });
  if (!/^[A-Z][A-Z.\-]{0,5}$/.test(symbol) || !RANGES[range]) return err('bad request');
  const key = symbol + ':' + range;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 300000) return new Response(hit.body, { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
  try {
    const [r, interval] = RANGES[range];
    const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${r}&interval=${interval}&includePrePost=false`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MarqitBot/1.0; https://playmarqit.com)', accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return err('unavailable', 502);
    const d = (await res.json())?.chart?.result?.[0];
    const ts: number[] = d?.timestamp || [];
    const cl: (number | null)[] = d?.indicators?.quote?.[0]?.close || [];
    const points: [number, number][] = [];
    for (let i = 0; i < ts.length; i++) if (cl[i] != null) points.push([ts[i], Math.round((cl[i] as number) * 100) / 100]);
    if (points.length < 2) return err('no data', 404);
    const m = d.meta || {};
    const body = JSON.stringify({
      symbol, name: String(m.shortName || m.longName || symbol), currency: String(m.currency || 'USD'),
      prevClose: m.chartPreviousClose ?? m.previousClose ?? null, last: m.regularMarketPrice ?? points[points.length - 1][1], points,
    });
    cache.set(key, { at: Date.now(), body });
    return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
  } catch (_) {
    return err('unavailable', 502);
  }
});
