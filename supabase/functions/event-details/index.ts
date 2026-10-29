// A picture and a short description for one Schedule event that has no feed of its own: tech launches, awards shows,
// news dates and anything added by hand in the admin page. Powers the thumbnail on those cards and the panel that
// opens when you click them.
//
// GET .../functions/v1/event-details?title=HomePod%20mini%202%20launch&badge=Apple
//  -> { found, title, image, credit: { author, license, pageUrl } | null, about: { text, url } | null }
//
// Source: Wikipedia (the article's lead picture and first sentences) and Wikimedia Commons (who took the picture and
// under what license). Only pictures that live on Commons under a Creative Commons or public-domain license are returned,
// so every picture can be shown with a link to its credit. Nothing is invented: when no article matches, found is false
// and the site shows a plain tile instead.
// Cached 6 hours per title (30 minutes when nothing was found).

const UA = 'Marqit/1.0 (https://playmarqit.com; help@playmarqit.com)';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'content-type': 'application/json' };
const OPEN_LICENSE = /^(CC BY(-SA)?( [\d.]+)?|CC0|Public domain|PD)/i;
// Badges an admin types as a label ("Awards", "Keynote") rather than the name of an organization: never searched for.
const GENERIC_BADGE = /^(awards?|keynote|event|events|news|tech|technology|launch|release|holiday|politics|sports?|music|movie|movies|tv|finance|economy|other|culture|pop culture)$/i;

const cache = new Map<string, { at: number; body: string; ttl: number }>();

async function wiki(host: string, params: Record<string, string>): Promise<any> {
  const u = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: 'json', origin: '*', ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(host + ' ' + r.status);
  return r.json();
}
const strip = (h: string) => String(h || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const norm = (s: string) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = /^(the|of|and|a|an|in|for|to|at|on)$/;
const toks = (s: string) => norm(s).split(' ').filter((w) => w.length >= 2 && !STOP.test(w)).map((w) => w.replace(/s$/, ''));

// What share of the search words appear in an article's title ("Daytime Emmy Awards" vs "Daytime Emmy Award" = 1).
function matchScore(cand: string, title: string): number {
  const ct = toks(cand), tt = new Set(toks(title));
  return ct.length ? ct.filter((w) => tt.has(w)).length / ct.length : 0;
}

// Search phrases, most specific first. "HomePod mini 2 launch" -> "HomePod mini 2", "HomePod mini", "HomePod".
// "iPhone Duo arrives in more countries" -> "iPhone Duo", then "iPhone".
function candidates(title: string, badge: string): string[] {
  const out: string[] = [];
  const add = (s: string) => { s = s.replace(/\s+/g, ' ').trim(); if (s.length >= 3 && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s); };
  const t0 = title.trim();
  const t1 = t0.replace(/\b(arrives?|arriving|launch(es|ed)?|available|availability|releases?|released|expands?|expanding|goes on sale|on sale|rolls? out|rollout|reveals?|revealed|unveils?|unveiled|announces?|announced|announcement|event|keynote|ceremony|preview|begins?|starts?)\b.*$/i, '').trim();
  const t2 = t1.replace(/^(the\s+)?\d+(st|nd|rd|th)\s+(annual\s+)?/i, '').replace(/\s+(19|20)\d\d$/, '').trim();
  const t3 = t2.replace(/\s+\d+(\.\d+)?$/, '').trim();
  const words = t3.split(/\s+/).filter(Boolean);
  add(t1); add(t2); add(t3);
  if (words.length > 2) add(words.slice(0, 2).join(' '));
  // A lone first word is only searched when it looks like a product name (iPhone, HomePod), not a plain word like "Daytime".
  if (words.length > 1 && words[0].length >= 4 && /[a-z][A-Z]/.test(words[0])) add(words[0]);
  add(t0);
  if (badge && !GENERIC_BADGE.test(badge)) add(badge);
  return out.slice(0, 6);
}

async function commonsCredit(file: string): Promise<{ author: string; license: string; pageUrl: string } | null> {
  const c = await wiki('commons.wikimedia.org', {
    action: 'query', titles: 'File:' + String(file).replace(/_/g, ' '), prop: 'imageinfo', iiprop: 'url|extmetadata',
    iiextmetadatafilter: 'LicenseShortName|Artist',
  });
  for (const p of Object.values(c?.query?.pages || {}) as any[]) {
    const ii = p.imageinfo?.[0]; if (!ii) continue;
    const m = ii.extmetadata || {};
    const lic = strip(m.LicenseShortName?.value || '');
    if (!OPEN_LICENSE.test(lic)) return null;
    const page = String(ii.descriptionurl || '');
    return { author: strip(m.Artist?.value || '') || 'Wikimedia Commons contributor', license: lic, pageUrl: /^https:\/\/commons\.wikimedia\.org\//.test(page) ? page : 'https://commons.wikimedia.org' };
  }
  return null;
}

function firstSentences(ex: string, max = 420): string {
  const s = ex.match(/[^.!?]+[.!?]+(\s|$)/g) || [ex];
  let text = '';
  for (const sn of s) { if ((text + sn).length > max && text) break; text += sn; }
  return text.trim();
}

async function lookup(title: string, badge: string) {
  let about: { text: string; url: string } | null = null, pageTitle = '';
  for (const cand of candidates(title, badge)) {
    const need = toks(cand).length <= 2 ? 1 : 0.6;
    const q = await wiki('en.wikipedia.org', {
      action: 'query', generator: 'search', gsrsearch: cand, gsrnamespace: '0', gsrlimit: '5',
      prop: 'pageimages|extracts|info', inprop: 'url', piprop: 'thumbnail|name', pithumbsize: '480', exintro: '1', explaintext: '1', exchars: '700', exlimit: '5',
    });
    const pages: any[] = Object.values(q?.query?.pages || {}).sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
    for (const p of pages) {
      const t = String(p.title || ''), ex = String(p.extract || '');
      if (/^(list of|index of)/i.test(t) || /may refer to|disambiguation/i.test(ex.slice(0, 200))) continue;
      if (matchScore(cand, t) < need) continue;
      // Remember the first article that fits, so the panel can still describe the event when its picture is not free to use.
      if (!about && ex) { about = { text: firstSentences(ex), url: String(p.fullurl || ('https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')))) }; pageTitle = t; }
      const src = String(p.thumbnail?.source || '');
      if (!p.pageimage || !/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(src)) continue; // local, non-free uploads are never used
      const credit = await commonsCredit(p.pageimage);
      if (!credit) continue;
      const own = ex ? { text: firstSentences(ex), url: String(p.fullurl || ('https://en.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')))) } : about;
      return { found: true, title: t, image: src, credit, about: own };
    }
  }
  return about ? { found: true, title: pageTitle, image: null, credit: null, about } : { found: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const title = (u.searchParams.get('title') || '').trim().slice(0, 140);
  const badge = (u.searchParams.get('badge') || '').trim().slice(0, 40);
  if (title.length < 2) return new Response(JSON.stringify({ found: false, error: 'bad request' }), { status: 400, headers: CORS });
  const key = norm(title) + '|' + norm(badge);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return new Response(hit.body, { headers: { ...CORS, 'cache-control': 'public, max-age=1800' } });
  try {
    const out = await lookup(title, badge);
    const body = JSON.stringify(out);
    cache.set(key, { at: Date.now(), body, ttl: out.found ? 6 * 3600000 : 30 * 60000 });
    if (cache.size > 300) cache.delete(cache.keys().next().value as string);
    return new Response(body, { headers: { ...CORS, 'cache-control': 'public, max-age=1800' } });
  } catch (_) {
    return new Response(JSON.stringify({ found: false, error: 'unavailable' }), { status: 502, headers: CORS });
  }
});
