import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Fills public.key_events (the Schedule) from today through the Sunday on or after two weeks from today, Eastern time.
//   sports      -> free league feeds (MLB, NHL, NBA official; NFL and college football via ESPN; soccer/WNBA via TheSportsDB), only marquee games (see sportsImportance) or games a Marqit question is about
//   finance     -> Finnhub earnings calendar, only the household-name companies in WATCH
//   pop culture -> TMDB, the most popular movie releases and new TV series that week
// Tech launches, awards shows and news events have no feed: add them by hand in the admin page.
//
// Safe to run as often as you like: rows are updated in place (source + external_id), and rows an admin
// removed (admin_hidden) are never brought back. Each source runs on its own, so one failing does not
// stop the others; the JSON reply says what each one did.
//
// Secrets: TMDB_API_KEY (already set), FINNHUB_API_KEY (free key from finnhub.io; earnings are skipped
// without it). Sports needs no key.
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
// Today through the Sunday on or after two weeks from today (Eastern), so the Schedule always reaches at least two weeks
// ahead. Earlier days are already stored by earlier runs.
function weekDates(): string[] {
  const today = etDate(new Date());
  const end = addDays(today, 14);
  const dow = new Date(end + 'T12:00:00Z').getUTCDay(); // 0 = Sunday
  const last = dow === 0 ? end : addDays(end, 7 - dow);
  const out: string[] = [];
  for (let d = today; d <= last && out.length < 28; d = addDays(d, 1)) out.push(d);
  return out;
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

// ---------------------------------------------------------------- sports (free official league feeds, no keys)
//   MLB  statsapi.mlb.com        NHL  api-web.nhle.com        NBA  cdn.nba.com (season schedule file)
//   NFL, Premier League, Champions League, MLS, WNBA: TheSportsDB free "next games of a league" lookup.
// Each league is fetched on its own and reports its own errors; one failing never stops the rest.
const SOCCER = new Set(['Champions League', 'Premier League', 'MLS']);
const TSDB_LEAGUES: [string, string, string][] = [
  ['4328', 'Premier League', 'EPL'], ['4480', 'Champions League', 'UCL'],
  ['4346', 'MLS', 'MLS'], ['4516', 'WNBA', 'WNBA'],
];

// What counts as marquee. Edit here to show more or fewer games.
//   Any postseason game. NFL: primetime kickoffs (7pm Eastern or later). College football: ranked vs ranked, or any top-10 team. Champions League: all.
//   A game a Marqit question is about is always shown (set by the caller).
function sportsImportance(badge: string, start: Date, postseason: boolean, marquee = false): number {
  if (postseason) return 2;
  if (badge === 'NCAAF') return marquee ? 2 : 1; // college football: ranked vs ranked, or a top-10 team
  if (badge === 'NFL') return etHour(start) >= 19 ? 2 : 1;
  if (badge === 'Champions League') return 2;
  return 1;
}

// ---- Playoff series that are already decided.
// Postseason schedules list every game a best-of series could need. When a team has clinched, the remaining
// games are never played, and listing them shows visitors a game that does not exist. These helpers say "this
// series is over" for each league's feed; callers skip any game that has not started in such a series.
function gameStarted(status: any): boolean {
  const a = String(status?.abstractGameState || '').toLowerCase();
  return a === 'live' || a === 'final';
}
function mlbSeriesOver(s: any): boolean {
  if (!s) return false;
  if (s.isOver === true) return true;
  // Fallback if isOver is missing: somebody already has a majority of the series' games.
  const total = Number(s.totalGames), wins = Math.max(Number(s.wins) || 0, Number(s.losses) || 0);
  return total > 0 && wins >= Math.floor(total / 2) + 1;
}
function nhlSeriesOver(s: any): boolean {
  if (!s) return false;
  const need = Number(s.neededToWin);
  return need > 0 && Math.max(Number(s.topSeedWins) || 0, Number(s.bottomSeedWins) || 0) >= need;
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

async function sportsRows(dates: string[], questions: any[], _deadline: number, report: any): Promise<Row[]> {
  const inWindow = new Set(dates);
  const first = dates[0], last = dates[dates.length - 1];
  const rows = new Map<string, Row>();
  // complete: leagues whose feed answered with the expected structure for the whole window. Only those are trusted to say
  // "this stored game is gone" (see the clean-up after the upsert); a feed that failed or came back malformed never hides anything.
  const rep = { kept: 0, per_league: {} as Record<string, string | number>, errors: [] as string[], finished_series_skipped: {} as Record<string, number>, complete: [] as string[] };
  report.sports = rep;

  // One game from any feed. Returns true if kept.
  function add(badge: string, key: string, home: string, away: string, startIso: string, venue: string | null, postseason: boolean, statusText: string, marquee = false): boolean {
    const t = Date.parse(startIso);
    if (!home || !away || isNaN(t)) return false;
    const startDate = new Date(t);
    const day = etDate(startDate);
    if (!inWindow.has(day)) return false;
    const q = findQuestion(questions, home, away, day);
    const importance = q ? 3 : sportsImportance(badge, startDate, postseason, marquee);
    if (importance < 2) return false;
    rows.set(badge + ':' + key, {
      category: 'sports',
      title: (SOCCER.has(badge) ? `${home} vs ${away}` : `${away} at ${home}`).slice(0, 140),
      subtitle: venue ? venue.slice(0, 140) : null,
      league: badge, starts_at: startDate.toISOString(), all_day: false, importance,
      status: /cancel/i.test(statusText) ? 'cancelled' : /postpon|suspend|delay/i.test(statusText) ? 'postponed' : 'scheduled',
      url: null, source: 'sports', external_id: badge + ':' + key, question_id: q ? q.id : null,
    });
    return true;
  }
  async function league(name: string, fn: () => Promise<number>) {
    try { rep.per_league[name] = await fn(); } catch (e) { rep.per_league[name] = 'failed'; rep.errors.push(`${name}: ${String(e).slice(0, 90)}`); }
  }

  // MLB: official stats API, whole window in one call. gameType R = regular season, anything else is postseason.
  // The postseason schedule lists every game a series COULD need ("Game 6 / Game 7, if necessary"). Once a team has
  // won the series those games will never be played, so they are skipped here (seriesStatus says whether the series is over).
  await league('MLB', async () => {
    const d = await fetchJson(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${addDays(first, -1)}&endDate=${addDays(last, 1)}&hydrate=venue,seriesStatus`);
    let n = 0, skippedOver = 0;
    if (Array.isArray(d?.dates)) rep.complete.push('MLB');
    for (const day of (d?.dates || [])) for (const g of (day.games || [])) {
      const post = g.gameType !== 'R' && g.gameType !== 'S';
      if (post && !gameStarted(g.status) && mlbSeriesOver(g.seriesStatus)) { skippedOver++; continue; }
      if (add('MLB', String(g.gamePk), String(g.teams?.home?.team?.name || ''), String(g.teams?.away?.team?.name || ''), g.gameDate, g.venue?.name || null, post, String(g.status?.detailedState || ''))) n++;
    }
    if (skippedOver) rep.finished_series_skipped.MLB = skippedOver;
    return n;
  });

  // NHL: schedule endpoint returns a week starting at the date given. gameType 3 = playoffs.
  await league('NHL', async () => {
    let n = 0, skippedOver = 0, weeksOk = true;
    const seen = new Set<string>();
    for (const start of [first, addDays(first, 7), addDays(first, 14), addDays(first, 21)]) {
      if (start > addDays(last, 1) && start !== first) break;
      const d = await fetchJson(`https://api-web.nhle.com/v1/schedule/${start}`);
      if (!Array.isArray(d?.gameWeek)) weeksOk = false;
      for (const w of (d?.gameWeek || [])) for (const g of (w.games || [])) {
        if (seen.has(String(g.id))) continue; seen.add(String(g.id));
        // Playoffs: a game that has not started in a series somebody already won is never played.
        if (g.gameType === 3 && /^(FUT|PRE)$/i.test(String(g.gameState || '')) && nhlSeriesOver(g.seriesStatus)) { skippedOver++; continue; }
        const nm = (t: any) => `${t?.placeName?.default || ''} ${t?.commonName?.default || ''}`.trim();
        if (add('NHL', String(g.id), nm(g.homeTeam), nm(g.awayTeam), g.startTimeUTC, g.venue?.default || null, g.gameType === 3, String(g.gameScheduleState || ''))) n++;
      }
    }
    if (skippedOver) rep.finished_series_skipped.NHL = skippedOver;
    if (weeksOk) rep.complete.push('NHL');
    return n;
  });

  // NBA: one season schedule file. Game ids starting 004 are playoff games. The file has no "series over" flag, so it is
  // worked out from the results already in it: two teams meet in one series per postseason, and the first to 4 wins takes it.
  // Any game of that pair that has not been played yet is then a game nobody will play.
  await league('NBA', async () => {
    const d = await fetchJson('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json');
    const days: any[] = d?.leagueSchedule?.gameDates || [];
    if (Array.isArray(d?.leagueSchedule?.gameDates)) rep.complete.push('NBA');
    const pair = (g: any) => [String(g?.homeTeam?.teamId || ''), String(g?.awayTeam?.teamId || '')].sort().join('-');
    const wins = new Map<string, number>();
    for (const gd of days) for (const g of (gd.games || [])) {
      if (!String(g.gameId).startsWith('004') || Number(g.gameStatus) !== 3) continue;
      const hs = Number(g.homeTeam?.score), as = Number(g.awayTeam?.score);
      if (!isFinite(hs) || !isFinite(as) || hs === as) continue;
      const k = pair(g) + '|' + String((hs > as ? g.homeTeam : g.awayTeam)?.teamId || '');
      wins.set(k, (wins.get(k) || 0) + 1);
    }
    const over = (g: any) => { const [a, b] = pair(g).split('-'); return Math.max(wins.get(pair(g) + '|' + a) || 0, wins.get(pair(g) + '|' + b) || 0) >= 4; };
    let n = 0, skippedOver = 0;
    for (const gd of days) for (const g of (gd.games || [])) {
      const t = Date.parse(g.gameDateTimeUTC);
      if (isNaN(t) || !inWindow.has(etDate(new Date(t)))) continue;
      const playoff = String(g.gameId).startsWith('004');
      if (playoff && Number(g.gameStatus) === 1 && over(g)) { skippedOver++; continue; }
      const nm = (x: any) => `${x?.teamCity || ''} ${x?.teamName || ''}`.trim();
      if (add('NBA', String(g.gameId), nm(g.homeTeam), nm(g.awayTeam), g.gameDateTimeUTC, g.arenaName || null, playoff, '')) n++;
    }
    if (skippedOver) rep.finished_series_skipped.NBA = skippedOver;
    return n;
  });

  // NFL and college football: ESPN's scoreboard (the same source the site's live scores use). ESPN answers a single date
  // but rejects date ranges (HTTP 400), so this asks for one day at a time. Replaces TheSportsDB for the NFL, which missed
  // Sunday games. NFL: primetime or playoff games. College football: ranked vs ranked, or any top-10 team. Any game a
  // Marqit question is about is always kept (add() sets importance 3).
  for (const [badge, path, extra] of [['NFL', 'football/nfl', ''], ['NCAAF', 'football/college-football', '&groups=80&limit=300']] as [string, string, string][]) {
    await league(badge, async () => {
      const rankOf = (c: any) => { const r = Number(c?.curatedRank?.current); return r >= 1 && r <= 25 ? r : 99; };
      const seen = new Set<string>();
      let n = 0, daysOk = true;
      for (const day of dates) {
        const d = await fetchJson(`https://site.api.espn.com/apis/site/v2/sports/${path}/scoreboard?dates=${day.replace(/-/g, '')}${extra}`, { 'user-agent': 'curl/8.5.0' });
        if (!Array.isArray(d?.events)) daysOk = false;
        for (const e of (d?.events || [])) {
          const id = String(e?.id || '');
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const c = e?.competitions?.[0];
          const home = (c?.competitors || []).find((x: any) => x.homeAway === 'home');
          const away = (c?.competitors || []).find((x: any) => x.homeAway === 'away');
          if (!home || !away) continue;
          const rh = rankOf(home), ra = rankOf(away);
          const marquee = (rh < 99 && ra < 99) || rh <= 10 || ra <= 10;
          const post = badge === 'NFL' && Number(e?.season?.type) === 3;
          if (add(badge, id, String(home.team?.displayName || ''), String(away.team?.displayName || ''), String(e.date || ''), c?.venue?.fullName || null,
            post, String(e?.status?.type?.description || e?.status?.type?.name || ''), marquee)) n++;
        }
      }
      if (daysOk) rep.complete.push(badge);
      return n;
    });
  }

  // Soccer and WNBA: the free TheSportsDB feed lists the next games of one league per request.
  const tsdbKey = Deno.env.get('THESPORTSDB_API_KEY') || '123';
  for (const [id, badge] of TSDB_LEAGUES) {
    await league(badge, async () => {
      const d = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${tsdbKey}/eventsnextleague.php?id=${id}`);
      let n = 0;
      for (const e of (d?.events || [])) {
        const ts = String(e.strTimestamp || '');
        const iso = ts ? (/Z$|[+-]\d\d:?\d\d$/.test(ts) ? ts : ts.replace(' ', 'T') + 'Z') : '';
        if (iso && add(badge, String(e.idEvent), String(e.strHomeTeam || ''), String(e.strAwayTeam || ''), iso, e.strVenue || null, /playoff|final/i.test(String(e.strRound || '') + String(e.strEvent || '')), String(e.strStatus || ''))) n++;
      }
      return n;
    });
    await sleep(2200);
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
  const topMovies = (movies?.results || []).filter((m: any) => inWindow.has(String(m.release_date || '')) && (m.popularity || 0) >= 10).slice(0, 16);
  const topShows = (shows?.results || []).filter((s: any) => inWindow.has(String(s.first_air_date || '')) && (s.popularity || 0) >= 8).slice(0, 16);
  for (const m of topMovies) rows.push({
    category: 'pop_culture', title: String(m.title || '').slice(0, 140), subtitle: 'In theaters', league: 'Movie',
    starts_at: m.release_date + 'T12:00:00.000Z', all_day: true, importance: (m.popularity || 0) >= 25 ? 2 : 1, status: 'scheduled',
    url: 'https://www.themoviedb.org/movie/' + m.id, source: 'tmdb', external_id: 'movie:' + m.id, question_id: null,
  });
  for (const s of topShows) rows.push({
    category: 'pop_culture', title: String(s.name || '').slice(0, 140), subtitle: 'New series', league: 'TV',
    starts_at: s.first_air_date + 'T12:00:00.000Z', all_day: true, importance: (s.popularity || 0) >= 15 ? 2 : 1, status: 'scheduled',
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

    // Games stored by an earlier run that the feed no longer lists: a game that was dropped, or the "Game 6 / Game 7" of a
    // series that has ended. The upsert above only ever adds, so without this they stay on the site forever.
    // They are hidden, not deleted: status 'cancelled' is invisible to visitors (see the key_events policy), and if a
    // later run lists the game again the upsert sets it straight back to 'scheduled'. Safety rails: only leagues whose feed
    // answered completely this run (report.sports.complete), only games that have not started, only this week's window.
    if (want('sports') && report.sports && Array.isArray(report.sports.complete) && report.sports.complete.length) {
      try {
        const keep = new Set(all.filter((r) => r.source === 'sports').map((r) => r.external_id));
        const inWin = new Set(dates);
        const { data: stored } = await admin.from('key_events').select('id, league, external_id, starts_at')
          .eq('source', 'sports').in('league', report.sports.complete).in('status', ['scheduled', 'postponed'])
          .gt('starts_at', now).lt('starts_at', addDays(dates[dates.length - 1], 2) + 'T00:00:00Z').limit(1000);
        const stale = (stored || []).filter((r: any) => inWin.has(etDate(new Date(r.starts_at))) && !keep.has(r.external_id));
        for (let i = 0; i < stale.length; i += 100) {
          await admin.from('key_events').update({ status: 'cancelled', updated_at: now }).in('id', stale.slice(i, i + 100).map((r: any) => r.id));
        }
        report.sports_hidden_stale = stale.length;
      } catch (e) { report.sports_hidden_stale = 'failed: ' + String(e).slice(0, 100); }
    }

    // Keep three weeks of history, no more.
    const cutoff = new Date(Date.now() - 21 * 86400000).toISOString();
    await admin.from('key_events').delete().lt('starts_at', cutoff);

    return new Response(JSON.stringify(report), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300) }), { status: 500 });
  }
});
