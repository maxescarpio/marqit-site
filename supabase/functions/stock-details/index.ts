// Fundamentals and analyst view for one stock, for the earnings panel on the site.
// Public, no key. Source: Nasdaq's public quote API (unofficial). Cached 30 minutes per symbol.
//
// GET .../functions/v1/stock-details?symbol=GE
//  -> { symbol, name, sector, price, marketCap, range52: [low, high], earningsDate,
//       analysts: { consensus, count, buy, hold, sell, target: { mean, low, high } },
//       valuation: { pe, forwardPe, epsTtm },
//       margins: { gross, operating, net }, revenueTtm }
// Every block can be null when Nasdaq has nothing for that symbol (ETFs, new listings).

const H = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', accept: 'application/json, text/plain, */*', origin: 'https://www.nasdaq.com', referer: 'https://www.nasdaq.com/' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const cache = new Map<string, { at: number; body: string }>();
const SB = Deno.env.get('SUPABASE_URL')!, SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SBH = { apikey: SK, authorization: 'Bearer ' + SK, 'content-type': 'application/json' };
// Results are kept in the database so a cold start never makes a visitor wait on Nasdaq.
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
async function refresh(sym: string): Promise<string> {
  const body = await load(sym);
  const o = JSON.parse(body);
  if (o && (o.price != null || o.analysts)) { cache.set(sym, { at: Date.now(), body }); await dbSet('d:' + sym, o); }
  return body;
}

async function nq(path: string): Promise<any | null> {
  try {
    const r = await fetch('https://api.nasdaq.com/api/' + path, { headers: H, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.data ?? null;
  } catch (_) { return null; }
}
// "$13,349,000" -> 13349000, "323,003,585,922" -> number, "N/A" -> null
function num(v: any): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[$,%\s]/g, '').replace(/^\((.*)\)$/, '-$1');
  if (s === '' || /^(n\/a|--|na)$/i.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}
const round = (n: number | null, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

async function load(sym: string) {
  const [summary, target, ratings, eps, fin, info] = await Promise.all([
    nq(`quote/${sym}/summary?assetclass=stocks`), nq(`analyst/${sym}/targetprice`), nq(`analyst/${sym}/ratings`),
    nq(`quote/${sym}/eps`), nq(`company/${sym}/financials?frequency=2`), nq(`quote/${sym}/info?assetclass=stocks`),
  ]);
  const sd = summary?.summaryData || {};
  const price = num(info?.primaryData?.lastSalePrice) ?? num(info?.secondaryData?.lastSalePrice);
  const range = String(sd?.FiftTwoWeekHighLow?.value || '').split('/').map(num); // "$388.84/$268.91" = high/low
  const range52 = range.length === 2 && range[0] != null && range[1] != null ? [Math.min(range[0], range[1]), Math.max(range[0], range[1])] : null;

  // Analysts
  let analysts: any = null;
  const co = target?.consensusOverview;
  if (co || ratings?.meanRatingType) {
    const buy = num(co?.buy) ?? 0, hold = num(co?.hold) ?? 0, sell = num(co?.sell) ?? 0;
    analysts = {
      consensus: ratings?.meanRatingType ? String(ratings.meanRatingType) : null,
      count: buy + hold + sell || null, buy, hold, sell,
      target: co ? { mean: num(co.priceTarget), low: num(co.lowPriceTarget), high: num(co.highPriceTarget) } : null,
    };
  }

  // Valuation from trailing and forward EPS
  const rows: any[] = eps?.earningsPerShare || [];
  const past = rows.filter((r) => r.type === 'PreviousQuarter').slice(-4).map((r) => num(r.earnings));
  const next = rows.filter((r) => r.type === 'UpcomingQuarter').slice(0, 4).map((r) => num(r.consensus));
  const epsTtm = past.length === 4 && past.every((x) => x != null) ? (past as number[]).reduce((a, b) => a + b, 0) : null;
  const epsFwd = next.length === 4 && next.every((x) => x != null) ? (next as number[]).reduce((a, b) => a + b, 0) : null;
  const valuation = price && (epsTtm || epsFwd) ? {
    pe: epsTtm && epsTtm > 0 ? round(price / epsTtm) : null,
    forwardPe: epsFwd && epsFwd > 0 ? round(price / epsFwd) : null,
    epsTtm: round(epsTtm, 2),
  } : null;

  // Margins from the last four reported quarters
  let margins: any = null, revenueTtm: number | null = null;
  const t = fin?.incomeStatementTable?.rows;
  if (Array.isArray(t)) {
    const sum = (label: RegExp) => {
      const row = t.find((r: any) => label.test(String(r.value1 || '')));
      if (!row) return null;
      const vals = ['value2', 'value3', 'value4', 'value5'].map((k) => num(row[k]));
      return vals.every((v) => v != null) ? (vals as number[]).reduce((a, b) => a + b, 0) : null;
    };
    const rev = sum(/^Total Revenue$/i), gp = sum(/^Gross Profit$/i), op = sum(/^Operating Income$/i), ni = sum(/^Net Income$/i);
    if (rev && rev > 0) {
      revenueTtm = rev * 1000; // statements are in thousands
      margins = { gross: gp != null ? round(gp / rev * 100) : null, operating: op != null ? round(op / rev * 100) : null, net: ni != null ? round(ni / rev * 100) : null };
    }
  }

  const ev = (info?.notifications || []).flatMap((n: any) => n?.eventTypes || []).find((e: any) => e?.eventName === 'Earnings Date');
  return JSON.stringify({
    symbol: sym, name: String(info?.companyName || '').replace(/\s+(Common Stock|Class [A-Z].*|Ordinary Shares.*)$/i, '') || null,
    sector: sd?.Sector?.value || null, price, marketCap: num(sd?.MarketCap?.value), range52,
    earningsDate: ev?.message ? String(ev.message).replace(/^Earnings Date\s*:\s*/i, '') : null,
    analysts, valuation, margins, revenueTtm, at: new Date().toISOString(),
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const warm = (u.searchParams.get('warm') || '').toUpperCase().split(',').map((x) => x.trim()).filter((x) => /^[A-Z][A-Z.\-]{0,5}$/.test(x)).slice(0, 12);
  if (warm.length) {
    let n = 0;
    for (let i = 0; i < warm.length; i += 3) {
      await Promise.all(warm.slice(i, i + 3).map(async (s) => {
        const row = await dbGet('d:' + s);
        if (row && Date.now() - row.at < 600000) return;
        try { await refresh(s); n++; } catch (_) { /* skip */ }
      }));
    }
    return new Response(JSON.stringify({ warmed: n, of: warm.length }), { headers: CORS });
  }
  const sym = (u.searchParams.get('symbol') || '').toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,5}$/.test(sym)) return new Response(JSON.stringify({ error: 'bad symbol' }), { status: 400, headers: CORS });
  const send = (body: string) => new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=300' } });
  const hit = cache.get(sym);
  if (hit && Date.now() - hit.at < 1800000) return send(hit.body);
  const row = await dbGet('d:' + sym);
  if (row) {
    const body = JSON.stringify(row.body);
    cache.set(sym, { at: row.at, body });
    if (Date.now() - row.at > 1800000) {
      // Stale: answer now, refresh behind the scenes.
      (globalThis as any).EdgeRuntime?.waitUntil?.(refresh(sym).catch(() => null));
    }
    return send(body);
  }
  try { return send(await refresh(sym)); }
  catch (_) { return new Response(JSON.stringify({ error: 'unavailable' }), { headers: CORS }); }
});
