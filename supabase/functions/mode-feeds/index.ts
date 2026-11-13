// Extra charts for the News and Pop culture modes. Public, no keys, cached per list in memory.
//   GET .../functions/v1/mode-feeds?kind=media    top 10 movies, TV seasons, podcasts and albums (Apple iTunes charts), 1 hour
//   GET .../functions/v1/mode-feeds?kind=markets  index, rate, crypto and commodity quotes with a small intraday line (Yahoo Finance), 2 minutes
//   GET .../functions/v1/mode-feeds?kind=crypto   top 10 coins by market cap (CoinGecko), 3 minutes
// Each list reports its own failure; one source being down never takes the others out.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const TTL: Record<string, number> = { media: 3600000, markets: 120000, crypto: 180000 };
const cache = new Map<string, { at: number; body: string }>();

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(new URL(url).hostname + ' ' + r.status);
  return r.json();
}

// ---------------------------------------------------------------- media charts
function parseItunes(d: any) {
  return (d?.feed?.entry || []).slice(0, 10).map((e: any, i: number) => ({
    rank: i + 1,
    title: String(e?.['im:name']?.label || ''),
    by: String(e?.['im:artist']?.label || ''),
    image: String((e?.['im:image'] || []).slice(-1)[0]?.label || '').replace(/\/\d+x\d+bb/, '/300x300bb'),
    genre: String(e?.category?.attributes?.label || ''),
    released: String(e?.['im:releaseDate']?.label || '').slice(0, 10),
    link: String(Array.isArray(e?.link) ? (e.link[0]?.attributes?.href || '') : (e?.link?.attributes?.href || e?.id?.label || '')),
    price: String(e?.['im:price']?.label || ''),
  })).filter((x: any) => x.title);
}
async function media() {
  const out: any = { movies: [], tv: [], podcasts: [], albums: [], errors: [] as string[] };
  const feeds: [string, string][] = [
    ['movies', 'topmovies'], ['tv', 'toptvseasons'], ['podcasts', 'toppodcasts'], ['albums', 'topalbums'],
  ];
  await Promise.all(feeds.map(async ([key, path]) => {
    try { out[key] = parseItunes(await getJson(`https://itunes.apple.com/us/rss/${path}/limit=10/json`)); }
    catch (e) { out.errors.push(key + ' ' + String(e).slice(0, 50)); }
  }));
  if (!out.tv.length) {
    try { out.tv = parseItunes(await getJson('https://itunes.apple.com/us/rss/toptvepisodes/limit=10/json')); } catch (e) { out.errors.push('tv2 ' + String(e).slice(0, 50)); }
  }
  return out;
}

// ---------------------------------------------------------------- market quotes
const QUOTES: [string, string, string][] = [
  ['^GSPC', 'S&P 500', 'stocks'], ['^DJI', 'Dow Jones', 'stocks'], ['^IXIC', 'Nasdaq', 'stocks'], ['^RUT', 'Russell 2000', 'stocks'],
  ['^VIX', 'Volatility (VIX)', 'stocks'], ['^TNX', '10-year Treasury yield', 'rates'], ['DX-Y.NYB', 'US dollar index', 'rates'],
  ['BTC-USD', 'Bitcoin', 'crypto'], ['ETH-USD', 'Ethereum', 'crypto'],
  ['GC=F', 'Gold', 'commodities'], ['CL=F', 'Crude oil', 'commodities'], ['NG=F', 'Natural gas', 'commodities'],
];
async function quote(sym: string, label: string, group: string) {
  const d = await getJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=15m`);
  const r = d?.chart?.result?.[0];
  const m = r?.meta || {};
  const price = Number(m.regularMarketPrice);
  const prev = Number(m.chartPreviousClose ?? m.previousClose);
  if (!isFinite(price)) throw new Error('no price');
  const closes: number[] = (r?.indicators?.quote?.[0]?.close || []).filter((x: any) => typeof x === 'number');
  const step = Math.max(1, Math.ceil(closes.length / 40));
  const spark = closes.filter((_, i) => i % step === 0);
  const change = isFinite(prev) && prev ? price - prev : null;
  return { symbol: sym, name: label, group, price, change, pct: change != null && prev ? (change / prev) * 100 : null, spark, state: String(m.marketState || '') };
}
async function markets() {
  const out: any = { quotes: [], errors: [] as string[] };
  const res = await Promise.all(QUOTES.map(async ([s, n, g]) => {
    try { return await quote(s, n, g); } catch (e) { out.errors.push(s + ' ' + String(e).slice(0, 40)); return null; }
  }));
  out.quotes = res.filter(Boolean);
  return out;
}

// ---------------------------------------------------------------- crypto top 10
async function crypto() {
  const d = await getJson('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&price_change_percentage=24h');
  return {
    coins: (Array.isArray(d) ? d : []).map((c: any, i: number) => ({
      rank: i + 1, symbol: String(c.symbol || '').toUpperCase(), name: String(c.name || ''), image: String(c.image || ''),
      price: Number(c.current_price) || null, pct: Number(c.price_change_percentage_24h) || 0, cap: Number(c.market_cap) || null,
    })),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const kind = (new URL(req.url).searchParams.get('kind') || '').toLowerCase();
  if (!TTL[kind]) return new Response(JSON.stringify({ error: 'bad kind' }), { status: 400, headers: CORS });
  const hit = cache.get(kind);
  let body: string;
  if (hit && Date.now() - hit.at < TTL[kind]) body = hit.body;
  else {
    try {
      const data = kind === 'media' ? await media() : kind === 'markets' ? await markets() : await crypto();
      body = JSON.stringify({ ...data, at: new Date().toISOString() });
      cache.set(kind, { at: Date.now(), body });
    } catch (e) {
      body = hit ? hit.body : JSON.stringify({ error: 'unavailable', detail: String(e).slice(0, 80) });
    }
  }
  return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=' + Math.floor(TTL[kind] / 20) } });
});
