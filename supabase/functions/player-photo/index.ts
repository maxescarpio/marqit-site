// A freely licensed photo of one athlete, from Wikimedia Commons, with the credit the license requires.
// Public, no key needed to call. Only photos under Creative Commons or public-domain licenses are returned.
// Results (hits and misses) are remembered in public.player_photos so each player is looked up once.
//
// GET .../functions/v1/player-photo?name=Josh%20Allen&team=Buffalo%20Bills&sport=football
//  -> { found: true, photo, author, license, licenseUrl, pageUrl }  or  { found: false }

const UA = 'Marqit/1.0 (https://playmarqit.com; help@playmarqit.com)';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const SB = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SPORT_WORDS: Record<string, RegExp> = {
  football: /football|quarterback|wide receiver|running back|tight end|linebacker|cornerback|safety|lineman|NFL/i,
  basketball: /basketball|point guard|shooting guard|small forward|power forward|center|NBA|WNBA/i,
  hockey: /hockey|goaltender|goalie|defenseman|winger|NHL/i,
  baseball: /baseball|pitcher|catcher|outfielder|infielder|shortstop|first baseman|second baseman|third baseman|MLB/i,
};
const OPEN_LICENSE = /^(CC BY(-SA)?( [\d.]+)?|CC0|Public domain|PD)/i;

async function wiki(host: string, params: Record<string, string>): Promise<any> {
  const u = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: 'json', origin: '*', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(host + ' ' + r.status);
  return r.json();
}
const strip = (h: string) => String(h || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

const KNOWN = (m: any, k: string) => strip(m?.[k]?.value || '');
async function recent(name: string, team: string, trace: string[], teamOnPage = false) {
  const words = team.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const nick = norm(words[words.length - 1]), full = norm(team);
  // First and last name with generational suffixes dropped ("Ollie Gordon II" -> ollie / gordon). The file title must
  // contain BOTH, so a last-name-only match (a different Washington, a teammate, a relative) is never accepted.
  const ntoks = norm(name).split(' ').filter((t) => t && !/^(jr|sr|ii|iii|iv|v)$/.test(t));
  const first = ntoks[0] || '', last = ntoks[ntoks.length - 1] || '';
  const seen = new Set<string>();
  const cands: any[] = [];
  for (const term of [`${name} ${words[words.length - 1]}`, name]) {
    const c = await wiki('commons.wikimedia.org', {
      action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: term, gsrlimit: '40',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size|timestamp', iiurlwidth: '320',
      iiextmetadatafilter: 'DateTimeOriginal|DateTime|LicenseShortName|LicenseUrl|Artist|Categories|ImageDescription',
    });
    for (const p of Object.values(c?.query?.pages || {}) as any[]) {
      if (seen.has(p.title)) continue; seen.add(p.title);
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const title = String(p.title).replace(/^File:/, '');
      const nt = norm(title);
      if (!/\.(jpe?g|png)$/i.test(title) || !last || !nt.includes(last) || (ntoks.length > 1 && !nt.includes(first))) continue;
      const m = ii.extmetadata || {};
      const lic = KNOWN(m, 'LicenseShortName');
      if (!OPEN_LICENSE.test(lic)) continue;
      const ratio = Number(ii.width) / Number(ii.height);
      if (!(ratio >= 0.55 && ratio <= 1.8)) continue;
      const hay = norm(title + ' ' + KNOWN(m, 'Categories') + ' ' + KNOWN(m, 'ImageDescription'));
      const teamHit = hay.includes(nick) || hay.includes(full);
      const yr = parseInt((KNOWN(m, 'DateTimeOriginal') || KNOWN(m, 'DateTime') || ii.timestamp || '').match(/(19|20)\d\d/)?.[0] || '0', 10);
      // Hard rejects (not just a lower score): more than one person, event/appearance shots, college or pre-pro shots,
      // and non-photos. A photo that might show anyone but this player is worse than showing the initials badge.
      const multi = /[&,+]|\band\b|\bwith\b|\bvs\.?\b|\bversus\b|\bfeat\b|\bteammates?\b|\bbrothers?\b|\bduo\b|\btrio\b|\bplayers\b/i.test(title)
        || /left to right|from left|l-r|pictured with|alongside|\bwith (his|her|teammate)/i.test(KNOWN(m, 'ImageDescription'));
      const offField = /injur|white house|trump|biden|obama|ceremony|visit|demonstration|raptor|draft|combine|pro day|celebrat|bobblehead|card|statue|mural|autograph|fans?\b|college|universit|\bumd\b|\bncaa\b|high school|signing|press conference|parade|award|gala|interview/i.test(title)
        || /college|universit|\bncaa\b|high school/i.test(KNOWN(m, 'Categories'));
      if (multi || offField) continue;
      cands.push({ title, teamHit, yr, ratio, lic, m, ii, pen: 0 });
    }
    if (cands.some((x) => x.teamHit)) break;
  }
  trace.push('cands:' + cands.map((x) => `${x.title}|team=${x.teamHit}|${x.yr}`).join(' ; '));
  // A photo counts as "current team" if its file says so, or if it is from the last two seasons and the player's
  // Wikipedia article names this team (file descriptions rarely mention the team).
  const thisYr = new Date().getUTCFullYear();
  // Strict: the file itself must tie the photo to the player's CURRENT team, and it must be from the last 3 calendar
  // years (a Wikipedia article naming the team is no longer enough, which let a college photo through).
  const pool = cands.filter((x) => x.teamHit && x.yr >= thisYr - 2);
  // Prefer: clean single-player shots, newest year, close crops (portrait/square, "cropped") over wide action shots.
  const score = (x: any) => x.yr * 10 - x.pen * 60 + (x.teamHit ? 6 : 0) + (/cropped|portrait|headshot|profile/i.test(x.title) ? 8 : 0) + (x.ratio <= 1.1 ? 8 : x.ratio <= 1.4 ? 3 : 0);
  const ok = pool.sort((a, b) => score(b) - score(a));
  trace.push('pool:' + ok.map((x) => x.title + '=' + score(x)).join(' ; '));
  const w = ok[0];
  if (!w) return null;
  return {
    found: true, photo: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(w.title) + '?width=320',
    author: KNOWN(w.m, 'Artist') || 'Wikimedia Commons contributor', license: w.lic, licenseUrl: KNOWN(w.m, 'LicenseUrl'), pageUrl: String(w.ii.descriptionurl || ''),
  };
}

async function lookup(name: string, team: string, sport: string, trace: string[] = []) {
  const sw = SPORT_WORDS[sport] || /./;
  const q = await wiki('en.wikipedia.org', {
    action: 'query', generator: 'search', gsrsearch: `${name} ${team}`, gsrlimit: '5',
    prop: 'pageimages|extracts', piprop: 'name', exintro: '1', explaintext: '1', exchars: '900', exlimit: '5',
  });
  const pages: any[] = Object.values(q?.query?.pages || {}).sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
  trace.push('pages:' + pages.map((p: any) => p.title + '|img=' + p.pageimage).join(' ; '));
  const want = norm(name), last = want.split(' ').slice(-1)[0];
  for (const p of pages) {
    const t = norm(String(p.title || '').replace(/\s*\(.*\)$/, ''));
    const okName = t === want || (t.includes(last) && want.split(' ')[0][0] === t[0]);
    if (!okName || !sw.test(String(p.extract || ''))) { trace.push('skip ' + p.title + ' name=' + okName); continue; }
    // Newest photo that shows the player with his CURRENT team (Wikipedia's lead image is often a college or old-team shot).
    const nick = norm(team.split(/\s+/).slice(-1)[0] || '');
    return await recent(name, team, trace, !!nick && norm(String(p.extract || '')).includes(nick));
  }
  return null;
}


// A recent, openly licensed portrait of a business leader (CEO, founder). The Wikipedia article must name the company.
async function person(name: string, company: string, trace: string[]) {
  const want = norm(name), toks = want.split(' ').filter((t) => t.length > 1), last = toks[toks.length - 1] || want;
  // Any real word of the company name counts ("Super Micro" -> super / micro), not just the first, and short forms like "TSMC" still work.
  const coToks = norm(company).split(' ').filter((t) => t.length >= 2 && !/^(the|inc|corp|co|group|holdings|companies|company)$/.test(t));
  const ok = (p: any) => { if (!p) return false; const ex = norm(String(p.extract || '')); return coToks.some((t) => ex.includes(t)) && /chief executive|ceo|founder|founded|co founder|chairman|businessman|businessperson|business magnate|entrepreneur|executive|billionaire|investor|banker|engineer|computer scientist|president|philanthropist|engineer|coach|manager/i.test(String(p.extract || '')); };
  // The article under the person's own name first, then a search as a fallback.
  const d = await wiki('en.wikipedia.org', { action: 'query', titles: name, redirects: '1', prop: 'extracts|pageimages', piprop: 'name', exintro: '1', explaintext: '1', exchars: '1500' });
  let page: any = (Object.values(d?.query?.pages || {}) as any[]).find(ok);
  if (!page) {
    const q = await wiki('en.wikipedia.org', { action: 'query', generator: 'search', gsrsearch: `${name} ${company}`, gsrlimit: '6', prop: 'extracts|pageimages', piprop: 'name', exintro: '1', explaintext: '1', exchars: '1500', exlimit: '6' });
    const pages: any[] = (Object.values(q?.query?.pages || {}) as any[]).sort((x: any, y: any) => (x.index || 0) - (y.index || 0));
    page = pages.find((p: any) => norm(String(p.title || '').replace(/\s*\(.*\)$/, '')) === want && ok(p));
  }
  trace.push('page:' + (page?.title || 'none'));
  if (!page) return null;
  const pageTitle = norm(String(page.title || ''));
  const seen = new Set<string>(), cands: any[] = [];
  for (const term of [name, `${name} ${company}`]) {
    const c = await wiki('commons.wikimedia.org', {
      action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: term, gsrlimit: '40',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size|timestamp', iiurlwidth: '320',
      iiextmetadatafilter: 'DateTimeOriginal|DateTime|LicenseShortName|LicenseUrl|Artist',
    });
    for (const p of Object.values(c?.query?.pages || {}) as any[]) {
      if (seen.has(p.title)) continue; seen.add(p.title);
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const title = String(p.title).replace(/^File:/, '');
      const nt = norm(title), pt = pageTitle.split(' ').filter((t) => t.length > 1);
      if (!/\.(jpe?g|png)$/i.test(title) || !(toks.length > 1 ? toks.filter((t) => nt.includes(t)).length >= 2 : nt.includes(last)) && !(pt.length > 1 && pt.filter((t) => nt.includes(t)).length >= 2)) continue;
      const m = ii.extmetadata || {}, lic = KNOWN(m, 'LicenseShortName');
      if (!OPEN_LICENSE.test(lic)) continue;
      const ratio = Number(ii.width) / Number(ii.height);
      if (!(ratio >= 0.6 && ratio <= 1.5)) continue;
      const yr = parseInt((KNOWN(m, 'DateTimeOriginal') || KNOWN(m, 'DateTime') || ii.timestamp || '').match(/(19|20)\d\d/)?.[0] || '0', 10);
      const pen = /[&,]| and | with |panel|conference|summit|meeting|signing|ceremony|dinner|stage|crowd|trump|biden|obama|putin|modi|macron|xi |sunak|starmer/i.test(title) ? 1 : 0;
      cands.push({ title, yr, ratio, lic, m, ii, pen });
    }
    if (cands.length >= 6) break;
  }
  // The identity-checked article's own lead image: editors pick it as the best portrait of this exact person, so it is
  // trusted even when the filename does not spell out the name, and it gets a bonus over search hits.
  if (page.pageimage && !cands.some((x) => x.title === page.pageimage)) {
    try {
      const lt = 'File:' + String(page.pageimage).replace(/_/g, ' ');
      const c = await wiki('commons.wikimedia.org', { action: 'query', titles: lt, prop: 'imageinfo', iiprop: 'url|extmetadata|size|timestamp', iiurlwidth: '320', iiextmetadatafilter: 'DateTimeOriginal|DateTime|LicenseShortName|LicenseUrl|Artist' });
      for (const p of Object.values(c?.query?.pages || {}) as any[]) {
        const ii = p.imageinfo?.[0]; if (!ii) continue;
        const m = ii.extmetadata || {}, lic = KNOWN(m, 'LicenseShortName'), title = String(p.title).replace(/^File:/, '');
        const ratio = Number(ii.width) / Number(ii.height);
        if (!/\.(jpe?g|png)$/i.test(title) || !OPEN_LICENSE.test(lic) || !(ratio >= 0.5 && ratio <= 1.6)) continue;
        const yr = parseInt((KNOWN(m, 'DateTimeOriginal') || KNOWN(m, 'DateTime') || ii.timestamp || '').match(/(19|20)\d\d/)?.[0] || '0', 10);
        cands.push({ title, yr, ratio, lic, m, ii, pen: 0, lead: true });
      }
    } catch (_) { /* lead image is a bonus; search hits still stand */ }
  }
  const score = (x: any) => x.yr * 10 - x.pen * 80 + (x.lead ? 60 : 0) + (/portrait|headshot|cropped|official|\d{4}[-_ ]\d{2}/i.test(x.title) ? 8 : 0) + (x.ratio >= 0.7 && x.ratio <= 1.1 ? 8 : 0);
  cands.sort((a, b) => score(b) - score(a));
  trace.push('top:' + cands.slice(0, 5).map((x) => x.title + '=' + score(x)).join(' ; '));
  const w = cands[0];
  if (!w) return null;
  return {
    found: true, photo: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(w.title) + '?width=320',
    author: KNOWN(w.m, 'Artist') || 'Wikimedia Commons contributor', license: w.lic, licenseUrl: KNOWN(w.m, 'LicenseUrl'), pageUrl: String(w.ii.descriptionurl || ''),
  };
}

// A team's current head coach, from ESPN's core API (team -> coaches -> coach). The season in the URL can be the
// starting or the ending year of the season depending on the league, so a few years are tried.
const COACH_LEAGUES: Record<string, string> = {
  NFL: 'football/nfl', NBA: 'basketball/nba', NHL: 'hockey/nhl', MLB: 'baseball/mlb', NCAAF: 'football/college-football',
  WNBA: 'basketball/wnba', MLS: 'soccer/usa.1', EPL: 'soccer/eng.1',
};
// ESPN rejects bot-like user agents, so its requests use a plain one (same as the scoreboard function).
const ESPN_UA = { 'user-agent': 'curl/8.5.0', accept: 'application/json' };
async function coachName(league: string, id: string): Promise<string | null> {
  const path = COACH_LEAGUES[league]; if (!path) return null;
  const [sp, lg] = path.split('/');
  const y = new Date().getUTCFullYear();
  for (const yr of [y, y + 1, y - 1]) {
    try {
      const r = await fetch(`https://sports.core.api.espn.com/v2/sports/${sp}/leagues/${lg}/seasons/${yr}/teams/${id}/coaches`, { headers: ESPN_UA, signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const ref = (await r.json())?.items?.[0]?.$ref; if (!ref) continue;
      const c = await (await fetch(String(ref).replace(/^http:/, 'https:'), { headers: ESPN_UA, signal: AbortSignal.timeout(8000) })).json();
      const n = [c?.firstName, c?.lastName].filter(Boolean).join(' ').trim();
      if (n) return n;
    } catch (_) { /* try the next season */ }
  }
  return null;
}

async function dbGet(key: string) {
  const r = await fetch(`${SB}/rest/v1/player_photos?key=eq.${encodeURIComponent(key)}&select=*`, { headers: { apikey: KEY, authorization: 'Bearer ' + KEY } });
  const rows = r.ok ? await r.json() : [];
  return rows[0] || null;
}
async function dbSet(row: any) {
  await fetch(`${SB}/rest/v1/player_photos`, { method: 'POST', headers: { apikey: KEY, authorization: 'Bearer ' + KEY, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(row) });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  // ?credits=1 -> every CEO / founder photo we show, with its photographer and license, for the Credits section on the
  // About page. Public data only (the same credit the photo's Commons page carries).
  if (u.searchParams.get('credits')) {
    try {
      const r = await fetch(`${SB}/rest/v1/player_photos?found=eq.true&key=like.${encodeURIComponent('person|')}*&select=key,author,license,page_url&limit=1000`,
        { headers: { apikey: KEY, authorization: 'Bearer ' + KEY }, signal: AbortSignal.timeout(8000) });
      const rows = r.ok ? await r.json() : [];
      const credits = (Array.isArray(rows) ? rows : []).map((x: any) => ({ key: String(x.key || ''), author: String(x.author || ''), license: String(x.license || ''), pageUrl: String(x.page_url || '') }));
      return new Response(JSON.stringify({ credits }), { headers: { ...CORS, 'cache-control': 'public, max-age=3600' } });
    } catch (_) {
      return new Response(JSON.stringify({ credits: [] }), { headers: CORS });
    }
  }
  const name = (u.searchParams.get('name') || '').trim(), team = (u.searchParams.get('team') || '').trim().slice(0, 60), sport = (u.searchParams.get('sport') || '').toLowerCase();
  const isCoach = u.searchParams.get('kind') === 'coach';
  const coachLg = (u.searchParams.get('league') || '').toUpperCase(), coachId = (u.searchParams.get('id') || '').trim();
  const isPerson = u.searchParams.get('kind') === 'person';
  if (isCoach) {
    if (!COACH_LEAGUES[coachLg] || !/^\d{1,6}$/.test(coachId) || team.length < 3) return new Response(JSON.stringify({ found: false, error: 'bad request' }), { status: 400, headers: CORS });
  } else if (!/^[\p{L}][\p{L} .'\-]{2,59}$/u.test(name) || (!isPerson && !SPORT_WORDS[sport])) return new Response(JSON.stringify({ found: false, error: 'bad request' }), { status: 400, headers: CORS });
  const key = isCoach ? 'coach|' + coachLg + ':' + coachId : isPerson ? 'person|' + norm(name) + '|' + norm(team) : 'v4|' + norm(name) + '|' + norm(team) + '|' + sport;
  const send = (o: any) => new Response(JSON.stringify(o), { headers: { ...CORS, 'cache-control': 'public, max-age=86400' } });
  try {
    const hit = u.searchParams.get('debug') ? null : await dbGet(key);
    if (hit) {
      const age = Date.now() - new Date(hit.checked_at).getTime();
      if (hit.found && age < (isCoach ? 30 : 90) * 86400000) return send({ found: true, photo: hit.photo, author: hit.author, license: hit.license, licenseUrl: hit.license_url, pageUrl: hit.page_url });
      if (!hit.found && age < (isCoach ? 7 : 14) * 86400000) return send({ found: false });
    }
    const trace: string[] = [];
    let res: any;
    if (isCoach) {
      const cn = await coachName(coachLg, coachId);
      trace.push('coach:' + (cn || 'none'));
      res = cn ? await person(cn, team, trace) : null;
    } else res = isPerson ? await person(name, team, trace) : await lookup(name, team, sport, trace);
    if (u.searchParams.get('debug')) return new Response(JSON.stringify({ res, trace }), { headers: CORS });
    await dbSet(res
      ? { key, found: true, photo: res.photo, author: res.author, license: res.license, license_url: res.licenseUrl, page_url: res.pageUrl, checked_at: new Date().toISOString() }
      : { key, found: false, checked_at: new Date().toISOString() });
    return send(res || { found: false });
  } catch (e) {
    return new Response(JSON.stringify({ found: false, error: 'unavailable' }), { headers: CORS });
  }
});
