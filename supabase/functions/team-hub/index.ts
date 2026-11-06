// Teams tab data (ESPN public feed, unofficial). Cached. Public, read-only, no keys.
//   GET .../functions/v1/team-hub?action=teams&league=nba            -> { teams: [{ id, name, abbr, logo }] }
//   GET .../functions/v1/team-hub?action=roster&league=nba&id=13     -> { players: [{ id, name, pos, jersey, hs }] }
//   GET .../functions/v1/team-hub?action=team&league=nba&id=13       -> record, results, upcoming, last season, injuries, headlines,
//                                                                       top players with stats (leaders), home/road record, season numbers
const UA = 'curl/8.5.0';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const SPORTS: Record<string, string> = {
  nfl: 'football/nfl', nba: 'basketball/nba', mlb: 'baseball/mlb', nhl: 'hockey/nhl',
  mls: 'soccer/usa.1', epl: 'soccer/eng.1', laliga: 'soccer/esp.1', bundesliga: 'soccer/ger.1',
  seriea: 'soccer/ita.1', ligue1: 'soccer/fra.1', nwsl: 'soccer/usa.nwsl',
  ncaaf: 'football/college-football', ncaam: 'basketball/mens-college-basketball', ncaaw: 'basketball/womens-college-basketball',
  wnba: 'basketball/wnba',
};
// College feeds list far more schools than a person follows; these ESPN groups keep the list to the top division.
const TEAM_GROUPS: Record<string, string> = { ncaaf: '&groups=80', ncaam: '&groups=50', ncaaw: '&groups=50' };
// Leagues the scoreboard function can give top players (season leaders) for, and the key it uses.
const SB_KEY: Record<string, string> = { nfl: 'NFL', nba: 'NBA', mlb: 'MLB', nhl: 'NHL', wnba: 'WNBA', mls: 'MLS', epl: 'EPL', ncaaf: 'NCAAF' };
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/';
const cache = new Map<string, { at: number; body: unknown }>();

async function j(url: string): Promise<any> {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(new URL(url).hostname + ' ' + r.status);
  return r.json();
}
async function cached<T>(key: string, ttl: number, make: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.body as T;
  const body = await make();
  cache.set(key, { at: Date.now(), body });
  if (cache.size > 400) cache.delete(cache.keys().next().value as string);
  return body;
}
const s = (v: unknown) => (v == null ? '' : String(v));
const reply = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: CORS });
const espnLink = (u: string) => (/^https:\/\/([a-z0-9-]+\.)*espn\.com\//i.test(u) ? u : '');

function logoOf(t: any): string {
  const l = Array.isArray(t?.logos) && t.logos[0]?.href ? t.logos[0].href : t?.logo;
  return /^https:\/\/a\.espncdn\.com\//.test(s(l)) ? s(l) : '';
}
function scoreOf(c: any): string {
  const v = c?.score;
  if (v && typeof v === 'object') return s(v.displayValue ?? v.value);
  return s(v);
}

async function teamsList(lg: string) {
  return cached('teams:' + lg, 86400000, async () => {
    const d = await j(`${SITE}${SPORTS[lg]}/teams?limit=500${TEAM_GROUPS[lg] || ''}`);
    return (d?.sports?.[0]?.leagues?.[0]?.teams || [])
      .map((x: any) => x?.team).filter((t: any) => t?.id)
      .map((t: any) => ({ id: s(t.id), name: s(t.displayName), abbr: s(t.abbreviation), logo: logoOf(t) }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  });
}

function flattenRoster(d: any): any[] {
  const a = Array.isArray(d?.athletes) ? d.athletes : [];
  // NBA/MLB style: flat list. NFL/NHL style: groups with .items.
  return a.flatMap((x: any) => (Array.isArray(x?.items) ? x.items : [x]));
}
async function roster(lg: string, id: string) {
  return cached(`roster:${lg}:${id}`, 6 * 3600000, async () => {
    const d = await j(`${SITE}${SPORTS[lg]}/teams/${id}/roster`);
    const players = flattenRoster(d).filter((p: any) => p?.id).map((p: any) => {
      const hs = s(p?.headshot?.href);
      return {
        id: s(p.id), name: s(p.fullName || p.displayName), pos: s(p?.position?.abbreviation || p?.position?.displayName),
        jersey: s(p.jersey), hs: /^https:\/\/a\.espncdn\.com\//.test(hs) ? hs : '',
      };
    });
    return { players };
  });
}

async function leagueInjuries(lg: string) {
  return cached('inj:' + lg, 900000, async () => {
    const d = await j(`${SITE}${SPORTS[lg]}/injuries`);
    const out: Record<string, any[]> = {};
    for (const t of Array.isArray(d?.injuries) ? d.injuries : []) {
      const rows = (Array.isArray(t?.injuries) ? t.injuries : []).map((i: any) => ({
        name: s(i?.athlete?.displayName || i?.athlete?.fullName), pos: s(i?.athlete?.position?.abbreviation),
        status: s(i?.status), date: s(i?.date).slice(0, 10),
        detail: s(i?.details?.type || i?.type?.description || i?.shortComment).slice(0, 200),
        comment: s(i?.longComment || i?.shortComment).slice(0, 400),
      })).filter((r: any) => r.name);
      out[s(t?.id)] = rows;
    }
    return out;
  });
}

function parseSchedule(d: any, id: string) {
  const out: { date: string; opp: string; home: boolean; us: string; them: string; result: string; done: boolean; state: string }[] = [];
  for (const e of Array.isArray(d?.events) ? d.events : []) {
    const comp = e?.competitions?.[0]; if (!comp) continue;
    const cs: any[] = Array.isArray(comp.competitors) ? comp.competitors : [];
    const me = cs.find((c) => s(c?.team?.id) === id || s(c?.id) === id), opp = cs.find((c) => c !== me);
    if (!me || !opp) continue;
    const done = !!comp?.status?.type?.completed;
    const us = scoreOf(me), them = scoreOf(opp);
    let result = '';
    if (done) result = me.winner === true ? 'W' : opp.winner === true ? 'L' : (us && us === them ? 'T' : '');
    out.push({
      date: s(e.date || comp.date), opp: s(opp?.team?.displayName || opp?.team?.shortDisplayName), home: me.homeAway === 'home',
      us, them, result, done, state: s(comp?.status?.type?.state),
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

async function teamSummary(lg: string, id: string) {
  return cached(`team:${lg}:${id}`, 600000, async () => {
    const [t, sc, inj, news, hub] = await Promise.allSettled([
      j(`${SITE}${SPORTS[lg]}/teams/${id}`),
      j(`${SITE}${SPORTS[lg]}/teams/${id}/schedule`),
      leagueInjuries(lg),
      j(`${SITE}${SPORTS[lg]}/news?team=${id}&limit=8`),
      SB_KEY[lg]
        ? fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/scoreboard?team=${SB_KEY[lg]}:${id}`, { signal: AbortSignal.timeout(12000) }).then((r) => r.json())
        : Promise.resolve(null),
    ]);
    const team = t.status === 'fulfilled' ? (t.value?.team || {}) : {};
    if (!team.id && !team.displayName) throw new Error('not found');
    const sched = sc.status === 'fulfilled' ? parseSchedule(sc.value, id) : [];
    const results = sched.filter((g) => g.done).slice(-8).reverse();
    const upcoming = sched.filter((g) => !g.done && g.state !== 'in').slice(0, 5);
    const live = sched.find((g) => g.state === 'in') || null;
    // Last season's final record (history): same schedule feed, one season back.
    let lastSeason: { year: number; record: string } | null = null;
    try {
      const yr = Number(sc.status === 'fulfilled' ? sc.value?.season?.year : 0);
      if (yr > 2000) {
        const prev = await cached(`prev:${lg}:${id}:${yr}`, 86400000, () => j(`${SITE}${SPORTS[lg]}/teams/${id}/schedule?season=${yr - 1}`));
        const g = parseSchedule(prev, id).filter((x) => x.done);
        if (g.length) {
          const w = g.filter((x) => x.result === 'W').length, l = g.filter((x) => x.result === 'L').length, tt = g.filter((x) => x.result === 'T').length;
          lastSeason = { year: yr - 1, record: `${w}-${l}${tt ? '-' + tt : ''}` };
        }
      }
    } catch { /* history is a bonus; skip quietly */ }
    const injuries = inj.status === 'fulfilled' ? (inj.value[id] || []) : [];
    const headlines = news.status === 'fulfilled'
      ? (Array.isArray(news.value?.articles) ? news.value.articles : []).map((a: any) => ({
        headline: s(a?.headline).slice(0, 160), date: s(a?.published).slice(0, 10), url: espnLink(s(a?.links?.web?.href)),
      })).filter((a: any) => a.headline && a.url).slice(0, 6)
      : [];
    // Top players with their season numbers, home/road record and season stats (same source as the ribbon's team panel).
    const sbd: any = hub.status === 'fulfilled' && hub.value && !hub.value.error ? hub.value : {};
    const leaders = (Array.isArray(sbd.leaders) ? sbd.leaders : []).slice(0, 3).map((l: any) => ({
      id: '', name: s(l?.full || l?.name), pos: s(l?.pos), label: s(l?.label), line: s(l?.line), num: s(l?.num),
      hs: /^https:\/\/a\.espncdn\.com\//.test(s(l?.hs)) ? s(l.hs) : '',
    })).filter((l: any) => l.name);
    return {
      leaders, home: s(sbd.home), road: s(sbd.road),
      seasonStats: (Array.isArray(sbd.stats) ? sbd.stats : []).slice(0, 6).map((x: any) => ({ label: s(x?.label), value: s(x?.value) })),
      id, league: lg, name: s(team.displayName), abbr: s(team.abbreviation), logo: logoOf(team), color: /^[0-9a-f]{6}$/i.test(s(team.color)) ? '#' + team.color : '',
      record: s(team?.record?.items?.[0]?.summary), standing: s(team?.standingSummary),
      live, upcoming, results, lastSeason, injuries, headlines,
    };
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const u = new URL(req.url);
  const action = u.searchParams.get('action') || '', lg = (u.searchParams.get('league') || '').toLowerCase(), id = u.searchParams.get('id') || '';
  if (!SPORTS[lg]) return reply({ error: 'bad league' }, 400);
  try {
    if (action === 'teams') return reply({ teams: await teamsList(lg) });
    if (!/^\d{1,10}$/.test(id)) return reply({ error: 'bad id' }, 400);
    if (action === 'roster') return reply(await roster(lg, id));
    if (action === 'team') return reply(await teamSummary(lg, id));
    return reply({ error: 'bad action' }, 400);
  } catch (e) {
    const msg = String(e);
    return reply({ error: msg.includes('not found') ? 'not found' : 'unavailable' }, msg.includes('not found') ? 404 : 502);
  }
});
