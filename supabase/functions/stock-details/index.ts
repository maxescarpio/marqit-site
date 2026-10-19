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

async function nq(path: string): Promise<any | null> {
  try {
    const r = await fetch('https://api.nasdaq.com/api/' + path, { headers: H, signal: AbortSignal.timeout(10000) });
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
  const sym = (new URL(req.url).searchParams.get('symbol') || '').toUpperCase();
  if (!/^[A-Z][A-Z.\-]{0,5}$/.test(sym)) return new Response(JSON.stringify({ error: 'bad symbol' }), { status: 400, headers: CORS });
  const hit = cache.get(sym);
  let body: string;
  if (hit && Date.now() - hit.at < 1800000) body = hit.body;
  else {
    try { body = await load(sym); cache.set(sym, { at: Date.now(), body }); if (cache.size > 200) cache.delete(cache.keys().next().value as string); }
    catch (_) { body = JSON.stringify({ error: 'unavailable' }); }
  }
  return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=900' } });
});
