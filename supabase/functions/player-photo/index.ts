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
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

const KNOWN = (m: any, k: string) => strip(m?.[k]?.value || '');
async function recent(name: string, team: string, trace: string[]) {
  const words = team.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const nick = norm(words[words.length - 1]), full = norm(team);
  const last = norm(name).split(' ').slice(-1)[0];
  const seen = new Set<string>();
  const cands: any[] = [];
  for (const term of [`${name} ${words[words.length - 1]}`, name]) {
    const c = await wiki('commons.wikimedia.org', {
      action: 'query', generator: 'search', gsrnamespace: '6', gsrsearch: term, gsrlimit: '40',
      prop: 'imageinfo', iiprop: 'url|extmetadata|size|timestamp', iiurlwidth: '240',
      iiextmetadatafilter: 'DateTimeOriginal|DateTime|LicenseShortName|LicenseUrl|Artist|Categories|ImageDescription',
    });
    for (const p of Object.values(c?.query?.pages || {}) as any[]) {
      if (seen.has(p.title)) continue; seen.add(p.title);
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const title = String(p.title).replace(/^File:/, '');
      if (!/\.(jpe?g|png)$/i.test(title) || !norm(title).includes(last)) continue;
      const m = ii.extmetadata || {};
      const lic = KNOWN(m, 'LicenseShortName');
      if (!OPEN_LICENSE.test(lic)) continue;
      const ratio = Number(ii.width) / Number(ii.height);
      if (!(ratio >= 0.55 && ratio <= 1.8)) continue;
      const hay = norm(title + ' ' + KNOWN(m, 'Categories') + ' ' + KNOWN(m, 'ImageDescription'));
      const teamHit = hay.includes(nick) || hay.includes(full);
      const yr = parseInt((KNOWN(m, 'DateTimeOriginal') || KNOWN(m, 'DateTime') || ii.timestamp || '').match(/(19|20)\d\d/)?.[0] || '0', 10);
      cands.push({ title, teamHit, yr, ratio, lic, m, ii });
    }
    if (cands.some((x) => x.teamHit)) break;
  }
  trace.push('cands:' + cands.map((x) => `${x.title}|team=${x.teamHit}|${x.yr}`).join(' ; '));
  const ok = cands.filter((x) => x.teamHit).sort((a, b) => b.yr - a.yr || Math.abs(a.ratio - 0.85) - Math.abs(b.ratio - 0.85));
  const w = ok[0];
  if (!w) return null;
  return {
    found: true, photo: 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(w.title) + '?width=240',
    author: KNOWN(w.m, 'Artist') || 'Wikimedia Commons contributor', license: w.lic, licenseUrl: KNOWN(w.m, 'LicenseUrl'), pageUrl: String(w.ii.descriptionurl || ''),
  };
}

async function lookup(name: string, team: string, sport: string, trace: string[] = []) {
  const sw = SPORT_WORDS[sport] || /./;
  const q = await wiki('en.wikipedia.org', {
    action: 'query', generator: 'search', gsrsearch: `${name} ${team}`, gsrlimit: '5',
    prop: 'pageimages|extracts', piprop: 'name', exintro: '1', explaintext: '1', exchars: '400', exlimit: '5',
  });
  const pages: any[] = Object.values(q?.query?.pages || {}).sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
  trace.push('pages:' + pages.map((p: any) => p.title + '|img=' + p.pageimage).join(' ; '));
  const want = norm(name), last = want.split(' ').slice(-1)[0];
  for (const p of pages) {
    const t = norm(String(p.title || '').replace(/\s*\(.*\)$/, ''));
    const okName = t === want || (t.includes(last) && want.split(' ')[0][0] === t[0]);
    if (!okName || !sw.test(String(p.extract || ''))) { trace.push('skip ' + p.title + ' name=' + okName); continue; }
    // Newest photo that shows the player with his CURRENT team (Wikipedia's lead image is often a college or old-team shot).
    const best = await recent(name, team, trace);
    if (best) return best;
    return null;
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
  const name = (u.searchParams.get('name') || '').trim(), team = (u.searchParams.get('team') || '').trim().slice(0, 60), sport = (u.searchParams.get('sport') || '').toLowerCase();
  if (!/^[\p{L}][\p{L} .'\-]{2,59}$/u.test(name) || !SPORT_WORDS[sport]) return new Response(JSON.stringify({ found: false, error: 'bad request' }), { status: 400, headers: CORS });
  const key = 'v2|' + norm(name) + '|' + norm(team) + '|' + sport;
  const send = (o: any) => new Response(JSON.stringify(o), { headers: { ...CORS, 'cache-control': 'public, max-age=86400' } });
  try {
    const hit = u.searchParams.get('debug') ? null : await dbGet(key);
    if (hit) {
      const age = Date.now() - new Date(hit.checked_at).getTime();
      if (hit.found && age < 90 * 86400000) return send({ found: true, photo: hit.photo, author: hit.author, license: hit.license, licenseUrl: hit.license_url, pageUrl: hit.page_url });
      if (!hit.found && age < 14 * 86400000) return send({ found: false });
    }
    const trace: string[] = [];
    const res = await lookup(name, team, sport, trace);
    if (u.searchParams.get('debug')) return new Response(JSON.stringify({ res, trace }), { headers: CORS });
    await dbSet(res
      ? { key, found: true, photo: res.photo, author: res.author, license: res.license, license_url: res.licenseUrl, page_url: res.pageUrl, checked_at: new Date().toISOString() }
      : { key, found: false, checked_at: new Date().toISOString() });
    return send(res || { found: false });
  } catch (e) {
    return new Response(JSON.stringify({ found: false, error: 'unavailable' }), { headers: CORS });
  }
});
