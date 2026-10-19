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
    const file = p.pageimage; // file name on Wikipedia or Commons
    if (!file) return null;
    // Only files hosted on Commons (the non-free ones used on Wikipedia are not on Commons, so they fall out here).
    const c = await wiki('commons.wikimedia.org', { action: 'query', titles: 'File:' + file, prop: 'imageinfo', iiprop: 'url|extmetadata', iiurlwidth: '240' });
    const page: any = Object.values(c?.query?.pages || {})[0];
    const ii = page?.imageinfo?.[0];
    trace.push('commons:' + (ii ? 'ok' : 'missing') + ' ' + file);
    if (!ii) return null;
    const m = ii.extmetadata || {};
    const lic = strip(m.LicenseShortName?.value || '');
    trace.push('license:' + lic);
    if (!OPEN_LICENSE.test(lic)) return null;
    // Special:FilePath redirects to a ready-made 240px thumbnail on upload.wikimedia.org.
    const thumb = 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(file) + '?width=240';
    return {
      found: true, photo: thumb, author: strip(m.Artist?.value || '') || 'Wikimedia Commons contributor',
      license: lic, licenseUrl: strip(m.LicenseUrl?.value || ''), pageUrl: String(ii.descriptionurl || ''),
    };
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
  const key = norm(name) + '|' + norm(team) + '|' + sport;
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
