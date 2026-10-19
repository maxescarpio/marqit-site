import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fills public.key_events (the Schedule) for the rest of the current Monday-Sunday week, Eastern time.
//   sports      -> TheSportsDB, only marquee games (see sportsImportance) or games a Marqit question is about
//   finance     -> Finnhub earnings calendar, only the household-name companies in WATCH
//   pop culture -> TMDB, the most popular movie releases and new TV series that week
// Tech launches, awards shows and news events have no feed: add them by hand in the admin page.
//
// Safe to run as often as you like: rows are updated in place (source + external_id), and rows an admin
// removed (admin_hidden) are never brought back. Each source runs on its own, so one failing does not
// stop the others; the JSON reply says what each one did.
//
// Secrets: TMDB_API_KEY (already set), FINNHUB_API_KEY (free key from finnhub.io; earnings are skipped
// without it), THESPORTSDB_API_KEY (optional; the free key "123" allows 5 games per league per day and
// 30 requests a minute, a paid key lifts both).
// Test one source: POST ...?only=tmdb  (comma separated: tmdb,earnings,sports)

const UA = 'MarqitBot/1.0 (https://playmarqit.com; schedule lookup)';
const TZ = 'America/New_York';
const BUDGET_MS = 110000; // stop calling the sports feed after this long so the run always finishes

type Row = {
  category: string; title: string; subtitle: string | null; league: string | null;
  starts_at: string; all_day: boolean; importance: number; status: string; url: string | null;
  source: string; external_id: string; question_id: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function etDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
function etHour(d: Date): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(d));
}
function addDays(dateStr: string, n: number): string {
  return new Date(Date.parse(dateStr + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}
// Today through Sunday (Eastern). Earlier days of the week are already stored by earlier runs.
function weekDates(): string[] {
  const today = etDate(new Date());
  const dow = new Date(today + 'T12:00:00Z').getUTCDay(); // 0 = Sunday
  const left = dow === 0 ? 1 : 8 - dow;
  return Array.from({ length: left }, (_, i) => addDays(today, i));
}

// Never put the URL in the error: some feeds take the key in the query string.
async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(15000) });
    if (res.status === 429 && attempt < 2) {
      try { await res.body?.cancel(); } catch (_) { /* ignore */ }
      await sleep(6000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(new URL(url).hostname + ' ' + res.status);
    return await res.json();
  }
  throw new Error('request failed');
}

// ---------------------------------------------------------------- sports
const SPORTS = ['American_Football', 'Baseball', 'Basketball', 'Ice_Hockey', 'Soccer'];
// League names exactly as TheSportsDB titles them (lowercased) -> the badge shown on the site.
// Leagues not listed here are ignored; the reply lists the ones it skipped so this list can be extended.
const LEAGUES: Record<string, string> = {
  'nfl': 'NFL', 'mlb': 'MLB', 'nba': 'NBA', 'nhl': 'NHL', 'wnba': 'WNBA',
  'uefa champions league': 'Champions League',
  'english premier league': 'Premier League',
  'american major league soccer': 'MLS',
};
const SOCCER = new Set(['Champions League', 'Premier League', 'MLS']);

// What counts as marquee. Edit here to show more or fewer games.
//   NFL: primetime kickoffs (7pm Eastern or later). MLB: October and November are the postseason.
//   Champions League: all. Anything else only if the round or name says playoff or final.
//   A game a Marqit question is about is always shown (set by the caller).
function sportsImportance(badge: string, start: Date, text: string): number {
  const month = Number(etDate(start).slice(5, 7));
  if (badge === 'NFL') return etHour(start) >= 19 ? 2 : 1;
  if (badge === 'MLB') return (month === 10 || month === 11) ? 2 : 1;
  if (badge === 'Champions League') return 2;
  if (/playoff|final|semi|quarter|round of|game [1-7]\b/i.test(text)) return 2;
  return 1;
}

// TheSportsDB sends UTC. A game without a time becomes an all-day row.
function eventStart(e: any): { iso: string; allDay: boolean } | null {
  const ts = typeof e.strTimestamp === 'string' ? e.strTimestamp.trim() : '';
  if (ts) {
    const t = Date.parse(/Z$|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts.replace(' ', 'T') + 'Z');
    if (!isNaN(t)) return { iso: new Date(t).toISOString(), allDay: false };
  }
  if (e.dateEvent && /^\d{4}-\d\d-\d\d$/.test(e.dateEvent)) return { iso: e.dateEvent + 'T12:00:00.000Z', allDay: true };
  return null;
}

function mentions(text: string, team: string): boolean {
  const t = team.toLowerCase();
  const nick = t.split(/\s+/).pop() || t;
  return text.includes(t) || (nick.length >= 4 && text.includes(nick));
}
function findQuestion(questions: any[], home: string, away: string, day: string): any | null {
  const dayMs = Date.parse(day + 'T12:00:00Z');
  return questions.find((q) => {
    if (Math.abs(Date.parse(q.question_date + 'T12:00:00Z') - dayMs) > 86400000) return false;
    const text = String(q.question_text || '').toLowerCase();
    return mentions(text, home) && mentions(text, away);
  }) || null;
}

async function sportsRows(dates: string[], questions: any[], deadline: number, report: any): Promise<Row[]> {
  const key = Deno.env.get('THESPORTSDB_API_KEY') || '123';
  const gap = key === '123' ? 2200 : 700; // stay under the free 30 requests a minute
  const base = `https://www.thesportsdb.com/api/v1/json/${key}`;
  const inWindow = new Set(dates);
  const rows = new Map<string, Row>();
  const unmatched: Record<string, number> = {};
  const rep = { requests: 0, seen: 0, kept: 0, partial: false, free_key: key === '123', unmatched_leagues: unmatched, errors: [] as string[] };
  report.sports = rep;
  // The feed groups by UTC date, so late Eastern games sit on the next date: ask for one day more.
  const queryDates = [...dates, addDays(dates[dates.length - 1], 1)];
  outer:
  for (const d of queryDates) {
    for (const sport of SPORTS) {
      if (Date.now() > deadline) { rep.partial = true; break outer; }
      try {
        const data = await fetchJson(`${base}/eventsday.php?d=${d}&s=${sport}`);
        for (const e of (data?.events || [])) {
          rep.seen++;
          const badge = LEAGUES[String(e.strLeague || '').trim().toLowerCase()];
          if (!badge) { const n = String(e.strLeague || '?'); unmatched[n] = (unmatched[n] || 0) + 1; continue; }
          const start = eventStart(e);
          const home = String(e.strHomeTeam || '').trim(), away = String(e.strAwayTeam || '').trim();
          if (!start || !e.idEvent || !home || !away) continue;
          const startDate = new Date(start.iso);
          const day = start.allDay ? start.iso.slice(0, 10) : etDate(startDate);
          if (!inWindow.has(day)) continue;
          const q = findQuestion(questions, home, away, day);
          const importance = q ? 3 : sportsImportance(badge, startDate, `${e.strEvent || ''} ${e.strRound || ''}`);
          if (importance < 2) continue;
          const st = String(e.strStatus || '');
          rows.set(String(e.idEvent), {
            category: 'sports',
            title: (SOCCER.has(badge) ? `${home} vs ${away}` : `${away} at ${home}`).slice(0, 140),
            subtitle: e.strVenue ? String(e.strVenue).slice(0, 140) : null,
            league: badge, starts_at: start.iso, all_day: start.allDay, importance,
            status: /cancel/i.test(st) ? 'cancelled' : /postpon|suspend|delay/i.test(st) ? 'postponed' : 'scheduled',
            url: null, source: 'thesportsdb', external_id: String(e.idEvent), question_id: q ? q.id : null,
          });
        }
      } catch (e) { rep.errors.push(`${d} ${sport}: ${String(e).slice(0, 80)}`); }
      rep.requests++;
      await sleep(gap);
    }
  }
  rep.kept = rows.size;
  return [...rows.values()];
}

// ---------------------------------------------------------------- earnings
// Household names only, ticker -> [display name, tier]. Tier 2 shows in the "Today" row on the home page.
const WATCH: Record<string, [string, number]> = {
  AAPL: ['Apple', 2], MSFT: ['Microsoft', 2], GOOGL: ['Alphabet (Google)', 2], AMZN: ['Amazon', 2], META: ['Meta', 2],
  NVDA: ['Nvidia', 2], TSLA: ['Tesla', 2], NFLX: ['Netflix', 2], AVGO: ['Broadcom', 1], ORCL: ['Oracle', 1],
  CRM: ['Salesforce', 1], ADBE: ['Adobe', 1], AMD: ['AMD', 2], INTC: ['Intel', 2], QCOM: ['Qualcomm', 1], IBM: ['IBM', 2],
  UBER: ['Uber', 1], ABNB: ['Airbnb', 1], PYPL: ['PayPal', 1], SHOP: ['Shopify', 1], SNAP: ['Snap', 1], PINS: ['Pinterest', 1],
  SPOT: ['Spotify', 1], PLTR: ['Palantir', 1], COIN: ['Coinbase', 1], HOOD: ['Robinhood', 1], DASH: ['DoorDash', 1],
  RBLX: ['Roblox', 1], EA: ['Electronic Arts', 1], TTWO: ['Take-Two', 1], RIVN: ['Rivian', 1], SOFI: ['SoFi', 1],
  JPM: ['JPMorgan Chase', 2], BAC: ['Bank of America', 2], WFC: ['Wells Fargo', 2], C: ['Citigroup', 2], GS: ['Goldman Sachs', 2],
  MS: ['Morgan Stanley', 2], V: ['Visa', 2], MA: ['Mastercard', 2], AXP: ['American Express', 1],
  JNJ: ['Johnson & Johnson', 2], PFE: ['Pfizer', 1], UNH: ['UnitedHealth', 2], LLY: ['Eli Lilly', 2], MRK: ['Merck', 1], ABBV: ['AbbVie', 1],
  KO: ['Coca-Cola', 2], PEP: ['PepsiCo', 2], MCD: ["McDonald's", 2], SBUX: ['Starbucks', 1], CMG: ['Chipotle', 1],
  WMT: ['Walmart', 2], TGT: ['Target', 2], COST: ['Costco', 2], HD: ['Home Depot', 2], LOW: ["Lowe's", 1],
  NKE: ['Nike', 2], LULU: ['Lululemon', 1], DIS: ['Disney', 2], CMCSA: ['Comcast', 1], T: ['AT&T', 1], VZ: ['Verizon', 1],
  TMUS: ['T-Mobile', 1], WBD: ['Warner Bros. Discovery', 1], BA: ['Boeing', 2], GE: ['GE Aerospace', 2], GM: ['General Motors', 2],
  F: ['Ford', 2], CAT: ['Caterpillar', 1], DE: ['Deere', 1], LMT: ['Lockheed Martin', 1], XOM: ['Exxon Mobil', 2], CVX: ['Chevron', 2],
  PG: ['Procter & Gamble', 2], DAL: ['Delta Air Lines', 1], UAL: ['United Airlines', 1],
};
const EARNINGS_TIME: Record<string, string> = { bmo: 'Before the open', amc: 'After the close', dmh: 'During market hours' };

async function earningsRows(dates: string[], report: any): Promise<Row[]> {
  const key = Deno.env.get('FINNHUB_API_KEY');
  if (!key) { report.earnings = 'skipped: no FINNHUB_API_KEY'; return []; }
  const inWindow = new Set(dates);
  const data = await fetchJson(`https://finnhub.io/api/v1/calendar/earnings?from=${dates[0]}&to=${dates[dates.length - 1]}&token=${encodeURIComponent(key)}`);
  const list: any[] = data?.earningsCalendar || [];
  const rows = new Map<string, Row>();
  for (const it of list) {
    const sym = String(it.symbol || '').toUpperCase();
    const w = WATCH[sym];
    const date = String(it.date || '');
    if (!w || !inWindow.has(date)) continue;
    rows.set(sym + ':' + date, {
      category: 'finance', title: `${w[0]} earnings`, subtitle: EARNINGS_TIME[String(it.hour || '')] || 'Time not confirmed',
      league: sym, starts_at: date + 'T12:00:00.000Z', all_day: true, importance: w[1], status: 'scheduled',
      url: null, source: 'finnhub', external_id: sym + ':' + date, question_id: null,
    });
  }
  report.earnings = { in_feed: list.length, kept: rows.size };
  return [...rows.values()];
}

// ---------------------------------------------------------------- movies and TV (TMDB)
function tmdbGet(path: string, params: string): Promise<any> {
  const key = Deno.env.get('TMDB_API_KEY')!;
  const q = `https://api.themoviedb.org/3/${path}?${params}&language=en-US`;
  return key.startsWith('eyJ') ? fetchJson(q, { authorization: 'Bearer ' + key }) : fetchJson(q + '&api_key=' + encodeURIComponent(key));
}

async function tmdbRows(dates: string[], report: any): Promise<Row[]> {
  if (!Deno.env.get('TMDB_API_KEY')) { report.tmdb = 'skipped: no TMDB_API_KEY'; return []; }
  const from = dates[0], to = dates[dates.length - 1];
  const inWindow = new Set(dates);
  const rows: Row[] = [];
  const movies = await tmdbGet('discover/movie', `region=US&with_release_type=2%7C3&release_date.gte=${from}&release_date.lte=${to}&sort_by=popularity.desc&include_adult=false&with_original_language=en&page=1`);
  const shows = await tmdbGet('discover/tv', `first_air_date.gte=${from}&first_air_date.lte=${to}&sort_by=popularity.desc&include_adult=false&with_original_language=en&page=1`);
  const topMovies = (movies?.results || []).filter((m: any) => inWindow.has(String(m.release_date || '')) && (m.popularity || 0) >= 25).slice(0, 6);
  const topShows = (shows?.results || []).filter((s: any) => inWindow.has(String(s.first_air_date || '')) && (s.popularity || 0) >= 15).slice(0, 6);
  for (const m of topMovies) rows.push({
    category: 'pop_culture', title: String(m.title || '').slice(0, 140), subtitle: 'In theaters', league: 'Movie',
    starts_at: m.release_date + 'T12:00:00.000Z', all_day: true, importance: 2, status: 'scheduled',
    url: 'https://www.themoviedb.org/movie/' + m.id, source: 'tmdb', external_id: 'movie:' + m.id, question_id: null,
  });
  for (const s of topShows) rows.push({
    category: 'pop_culture', title: String(s.name || '').slice(0, 140), subtitle: 'New series', league: 'TV',
    starts_at: s.first_air_date + 'T12:00:00.000Z', all_day: true, importance: 2, status: 'scheduled',
    url: 'https://www.themoviedb.org/tv/' + s.id, source: 'tmdb', external_id: 'tv:' + s.id, question_id: null,
  });
  report.tmdb = {
    movies_in_feed: (movies?.results || []).length, movies_kept: topMovies.length,
    shows_in_feed: (shows?.results || []).length, shows_kept: topShows.length,
    top_popularity: [...(movies?.results || []), ...(shows?.results || [])].slice(0, 6).map((x: any) => Math.round(x.popularity || 0)),
  };
  return rows.filter((r) => r.title.length >= 2);
}

// ---------------------------------------------------------------- run
Deno.serve(async (req: Request) => {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token !== serviceRoleKey) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const deadline = Date.now() + BUDGET_MS;
  const only = new URL(req.url).searchParams.get('only');
  const want = (s: string) => !only || only.split(',').map((x) => x.trim()).includes(s);

  try {
    const dates = weekDates();
    const report: any = { window: { from: dates[0], to: dates[dates.length - 1] } };
    const all: Row[] = [];

    // Each source on its own: one failing must not take the others down.
    if (want('tmdb')) { try { all.push(...await tmdbRows(dates, report)); } catch (e) { report.tmdb = 'failed: ' + String(e).slice(0, 120); } }
    if (want('earnings')) { try { all.push(...await earningsRows(dates, report)); } catch (e) { report.earnings = 'failed: ' + String(e).slice(0, 120); } }
    if (want('sports')) {
      try {
        const { data: qs } = await admin.from('daily_questions').select('id, question_text, question_date')
          .eq('category', 'sports').gte('question_date', addDays(dates[0], -1)).lte('question_date', addDays(dates[dates.length - 1], 1));
        all.push(...await sportsRows(dates, qs || [], deadline, report));
      } catch (e) { report.sports = 'failed: ' + String(e).slice(0, 120); }
    }

    // Rows an admin removed stay removed.
    const { data: hidden } = await admin.from('key_events').select('source, external_id').eq('admin_hidden', true).not('external_id', 'is', null);
    const hiddenKeys = new Set((hidden || []).map((h: any) => h.source + '|' + h.external_id));
    const rows = all.filter((r) => !hiddenKeys.has(r.source + '|' + r.external_id));
    const now = new Date().toISOString();
    let upserted = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100).map((r) => ({ ...r, updated_at: now }));
      const { error } = await admin.from('key_events').upsert(chunk, { onConflict: 'source,external_id' });
      if (error) throw error;
      upserted += chunk.length;
    }
    report.upserted = upserted;
    report.skipped_hidden = all.length - rows.length;

    // Keep three weeks of history, no more.
    const cutoff = new Date(Date.now() - 21 * 86400000).toISOString();
    await admin.from('key_events').delete().lt('starts_at', cutoff);

    return new Response(JSON.stringify(report), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500 });
  }
});
