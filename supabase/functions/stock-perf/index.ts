// Price change over several periods for a handful of stocks, for the Biggest Companies table.
// Public, no key. Source: Yahoo Finance daily closes (about 15 minutes delayed). Cached 30 minutes in the database.
//
// GET .../functions/v1/stock-perf?symbols=AAPL,MSFT
//  -> { AAPL: { m3, m6, ytd, y1 }, ... }   (percent changes, null when there isn't enough history)

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const SB = Deno.env.get('SUPABASE_URL')!, SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SBH = { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' };
const mem = new Map<string, { at: number; v: any }>();

async function dbGet(key: string): Promise<{ body: any; at: number } | null> {
  try {
    const r = await fetch(`${SB}/rest/v1/stock_cache?key=eq.${encodeURIComponent(key)}&select=body,fetched_at`, { headers: SBH, signal: AbortSignal.timeout(4000) });
    const rows = r.ok ? await r.json() : [];
    return rows[0] ? { body: rows[0].body, at: new Date(rows[0].fetched_at).getTime() } : null;
  } catch (_) { return null; }
}
async function dbSet(key: string, body: any) {
  try { await fetch(`${SB}/rest/v1/stock_cache`, { method: 'POST', headers: { ...SBH, prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ key, body, fetched_at: new Date().toISOString() }) }); } catch (_) { /* ignore */ }
}

async function fromYahoo(sym: string) {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d&includePrePost=false`, {
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; MarqitBot/1.0; https://playmarqit.com)', accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const d = (await res.json())?.chart?.result?.[0];
  const ts: number[] = d?.timestamp || [], cl: (number | null)[] = d?.indicators?.quote?.[0]?.close || [];
  const pts: [number, number][] = [];
  for (let i = 0; i < ts.length; i++) if (cl[i] != null) pts.push([ts[i], cl[i] as number]);
  if (pts.length < 20) return null;
  const last = Number(d?.meta?.regularMarketPrice) || pts[pts.length - 1][1];
  const now = pts[pts.length - 1][0];
  const pct = (base: number | undefined) => (base ? Math.round((last / base - 1) * 10000) / 100 : null);
  const at = (secsAgo: number) => pts.find((p) => p[0] >= now - secsAgo)?.[1];
  const jan1 = Date.UTC(new Date(now * 1000).getUTCFullYear(), 0, 1) / 1000;
  const prior = pts.filter((p) => p[0] < jan1).pop()?.[1];
  const oldest = pts[0][0] <= now - 330 * 86400 ? pts[0][1] : undefined; // need about a full year of history
  return { m3: pct(at(91 * 86400)), m6: pct(at(182 * 86400)), ytd: pct(prior), y1: pct(oldest) };
}

async function one(sym: string) {
  const m = mem.get(sym);
  if (m && Date.now() - m.at < 1800000) return m.v;
  const row = await dbGet('p:' + sym);
  if (row && Date.now() - row.at < 1800000) { mem.set(sym, { at: row.at, v: row.body }); return row.body; }
  try {
    const v = await fromYahoo(sym);
    if (v) { mem.set(sym, { at: Date.now(), v }); await dbSet('p:' + sym, v); return v; }
  } catch (_) { /* fall through to stale */ }
  return row ? row.body : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const syms = (new URL(req.url).searchParams.get('symbols') || '').toUpperCase().split(',').map((x) => x.trim()).filter((x) => /^[A-Z][A-Z.\-]{0,5}$/.test(x)).slice(0, 15);
  if (!syms.length) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400, headers: CORS });
  const out: Record<string, any> = {};
  await Promise.all(syms.map(async (s) => { out[s] = await one(s); }));
  return new Response(JSON.stringify(out), { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
});
