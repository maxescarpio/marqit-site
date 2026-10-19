import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Puts a small round photo of ONE real person on each Trending card (news_ticker rows, kind 'trend').
// Same rules and sources as fill-question-photos: free Wikipedia/Wikimedia portraits, TMDB cast photos for
// shows and movies, a team's head coach from the team's Wikipedia page, TheSportsDB for athletes.
// Never a logo, poster or group shot. No good photo found = the card just has no photo.
// Secrets used: TMDB_API_KEY, THESPORTSDB_API_KEY (optional), GEMINI_API_KEY and/or ANTHROPIC_API_KEY.
// Run on a schedule (every 10 minutes); safe to run as often as you like.

const UA = 'MarqitBot/1.0 (https://playmarqit.com; photo lookup for trending topics)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const TAKE_MODEL = 'claude-sonnet-5-5';
const MAX_PER_RUN = 30;
const RETRY_MS = 6 * 3600000;
const tried = new Map<string, number>(); // news id -> last attempt (this instance)

type Side = { name: string; type: string; search: string };

const PROMPT = `You pick the photo for Trending cards on Marqit. Each card gets ONE small round photo of ONE real person. For every trending topic below, say who the photo should be about.

Return, per topic:
- "subject": {"name": short display name (max 22 characters), "type": one of "person" | "team" | "show" | "movie", "search": the text to look it up with}, or null.

What to return:
- A topic that is a named person (player, athlete, fighter, artist, celebrity, politician): type "person", search = their full name as it would be titled on English Wikipedia. If the topic names two people, pick the better-known one.
- A TV show: type "show", search = the series title. (Its biggest lead actor is looked up for you.)
- A movie: type "movie", search = the film title. (Its biggest lead actor is looked up for you.)
- A game, team or league: type "team", search = the full official name of the first-named team. (Its head coach is looked up for you.)
- A company, product, launch or event run by a company with no person named: use that company's best-known current leader or founder as a person (SpaceX -> "Elon Musk", Nvidia -> "Jensen Huang", Meta -> "Mark Zuckerberg", Apple -> "Tim Cook", and so on).
- Any other news topic: ONLY a person who is named in the topic's title or description. If nobody is named, return null. Never guess a famous person who is merely related to the topic (a golf tournament, a chart or an event with no named person gets null).
- Songs, albums and music charts: the artist, as type "person".

Rules:
- Never a logo, poster, product, building or group. Always end up with one person.
- Politicians and government figures are allowed.
- Return null for private individuals, and for anything about death, crime, disasters or tragedy.
- If you are not sure of the exact name or title, return null.

Reply with JSON only: {"items":[{"i":0,"subject":{"name":"Jensen Huang","type":"person","search":"Jensen Huang"}}]}`;

const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash'];
async function askModel(system: string, user: string, maxTokens: number): Promise<string> {
  const errors: string[] = [];
  const gKey = Deno.env.get('GEMINI_API_KEY');
  if (gKey) {
    for (const model of GEMINI_MODELS) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'x-goog-api-key': gKey, 'content-type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { maxOutputTokens: Math.max(maxTokens, 4096), temperature: 0.2, responseMimeType: 'application/json' },
          }),
          signal: AbortSignal.timeout(25000),
        });
        if (!res.ok) throw new Error(model + ' ' + res.status);
        const out = await res.json();
        const text = (out.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
        if (!text) throw new Error(model + ' empty reply');
        return text;
      } catch (e) { errors.push(String(e)); }
    }
  }
  const aKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (aKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': aKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: TAKE_MODEL, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
        signal: AbortSignal.timeout(60000),
      });
      if (!res.ok) throw new Error('anthropic ' + res.status);
      const out = await res.json();
      return (out.content || []).map((c: any) => c.text || '').join('');
    } catch (e) { errors.push(String(e)); }
  }
  throw new Error(errors.join(' | ') || 'no AI key set (GEMINI_API_KEY or ANTHROPIC_API_KEY)');
}

function parseItems(text: string): any[] {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try { const it = JSON.parse(m[0]).items; return Array.isArray(it) ? it : []; } catch (_) { return []; }
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(new URL(url).hostname + ' ' + res.status);
  return await res.json();
}

async function imageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) });
    const ok = res.ok && /^image\//i.test(res.headers.get('content-type') || '');
    try { await res.body?.cancel(); } catch (_) { /* ignore */ }
    return ok;
  } catch (_) { return false; }
}

// Freely licensed Wikipedia portrait; only head-and-shoulders shapes (the photo is shown in a circle).
async function wikiPhoto(title: string): Promise<string | null> {
  const data = await getJson(`${WIKI_API}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages%7Cpageprops&piprop=thumbnail&pithumbsize=400&pilicense=free&ppprop=disambiguation&redirects=1&format=json&formatversion=2`);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  if (page.pageprops && 'disambiguation' in page.pageprops) return null;
  const t = page.thumbnail;
  if (!t || typeof t.source !== 'string') return null;
  if (/\.svg/i.test(t.source)) return null;
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//.test(t.source)) return null;
  const ratio = Number(t.width) / Number(t.height);
  if (!Number.isFinite(ratio) || ratio > 2 || ratio < 0.5) return null;
  return t.source;
}

function tmdbGet(path: string, params: string): Promise<any> {
  const key = Deno.env.get('TMDB_API_KEY');
  if (!key) throw new Error('TMDB_API_KEY is not set');
  const q = `https://api.themoviedb.org/3/${path}?${params}&language=en-US`;
  return key.startsWith('eyJ') ? getJson(q, { authorization: 'Bearer ' + key }) : getJson(q + '&api_key=' + encodeURIComponent(key));
}
async function tmdbLead(kind: 'tv' | 'movie', title: string): Promise<{ url: string; label: string } | null> {
  const data = await tmdbGet('search/' + kind, `query=${encodeURIComponent(title)}&include_adult=false&page=1`);
  const results = (data?.results || []).slice(0, 5);
  if (!results.length) return null;
  const pick = [...results].sort((a: any, b: any) => b.popularity - a.popularity)[0];
  const credits = await tmdbGet(`${kind}/${pick.id}/credits`, 'x=1');
  const lead = (credits?.cast || []).filter((c: any) => c.profile_path).slice(0, 3)
    .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))[0];
  return lead ? { url: `https://image.tmdb.org/t/p/w342${lead.profile_path}`, label: String(lead.name || '') } : null;
}

async function tmdbPerson(name: string): Promise<string | null> {
  const data = await tmdbGet('search/person', `query=${encodeURIComponent(name)}&include_adult=false&page=1`);
  const norm = (x: string) => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = (data?.results || []).find((p: any) => p.profile_path && norm(p.name) === norm(name));
  return hit ? `https://image.tmdb.org/t/p/w342${hit.profile_path}` : null;
}

// Last resort: a photo from a news story that is actually about the same thing (headline contains the trend's words).
const STOP = new Set(['the', 'and', 'for', 'with', 'stock', 'news', 'live', 'week', 'game', 'from', 'that', 'this', 'new', 'vs', 'v']);
async function newsPhoto(admin: any, headline: string): Promise<string | null> {
  const words = headline.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !STOP.has(w));
  if (!words.length || words.length > 4) return null;
  let q = admin.from('news_ticker').select('image_url').eq('kind', 'news').not('image_url', 'is', null)
    .gte('fetched_at', new Date(Date.now() - 3 * 86400000).toISOString());
  for (const w of words) q = q.ilike('headline', `%${w}%`);
  const { data } = await q.order('fetched_at', { ascending: false }).limit(3);
  for (const r of data || []) if (typeof r.image_url === 'string' && /^https:\/\//.test(r.image_url) && (await imageLoads(r.image_url))) return r.image_url;
  return null;
}

// Topic fallback: the free lead image of the Wikipedia article that best matches the headline (products, places, events, games).
async function topicPhoto(headline: string): Promise<string | null> {
  const q = headline.replace(/\b(stock|news|live|vs?\.?|score|week \d+)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  if (q.length < 3) return null;
  const data = await getJson(`${WIKI_API}?action=query&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=500&pilicense=free&format=json&formatversion=2`);
  const pages = (data?.query?.pages || []).slice().sort((a: any, b: any) => (a.index || 0) - (b.index || 0));
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  for (const p of pages) {
    const t = p.thumbnail?.source;
    if (typeof t !== 'string' || /\.svg/i.test(t) || !/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(t)) continue;
    const title = String(p.title || '').toLowerCase();
    if (words.length && !words.some((w) => title.includes(w))) continue;
    return t;
  }
  return null;
}

function sportsBase(): string { return `https://www.thesportsdb.com/api/v1/json/${Deno.env.get('THESPORTSDB_API_KEY') || '123'}`; }
function sized(url: string): string { return /\.(png|jpe?g)$/i.test(url) ? url + '/small' : url; }
async function sportsPlayerPhoto(name: string): Promise<string | null> {
  const words = name.trim().split(/\s+/);
  const variants = [name.trim(), words.join('_')];
  let data: any = null;
  for (const v of variants) {
    try { data = await getJson(`${sportsBase()}/searchplayers.php?p=${encodeURIComponent(v)}`); break; }
    catch (e) { if (!String(e).includes(' 404')) throw e; }
  }
  const players: any[] = data?.player || [];
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = players.find((p) => norm(p.strPlayer) === norm(name));
  if (!hit) return null;
  const img = hit.strThumb || hit.strCutout || hit.strRender;
  return typeof img === 'string' && /^https:\/\//.test(img) ? sized(img) : null;
}

async function coachPhoto(team: string): Promise<{ url: string; label: string } | null> {
  const data = await getJson(`${WIKI_API}?action=query&titles=${encodeURIComponent(team)}&prop=revisions&rvprop=content&rvslots=main&redirects=1&format=json&formatversion=2`);
  const text: string = (data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '').slice(0, 15000);
  const m = text.match(/\|\s*(?:head[ _]?coach|manager|coach)\s*=\s*(?:\{\{[^\[\]{}]*?\|\s*)?(?:\{\{[^}]*\}\}\s*)*\[\[([^\]|#]+)/i);
  if (!m) return null;
  const article = m[1].trim();
  const url = await wikiPhoto(article);
  return url ? { url, label: article.replace(/\s*\(.*\)\s*$/, '') } : null;
}

async function findPhoto(side: Side, lane: string): Promise<{ url: string } | null> {
  let found: { url: string } | null = null;
  switch (side.type) {
    case 'show': found = await tmdbLead('tv', side.search); break;
    case 'movie': found = await tmdbLead('movie', side.search); break;
    case 'team': found = await coachPhoto(side.search); break;
    case 'person': {
      let u = await wikiPhoto(side.search);
      if (!u && lane === 'sports') { try { u = await sportsPlayerPhoto(side.search); } catch (_) { u = null; } }
      if (!u) { try { u = await tmdbPerson(side.search); } catch (_) { u = null; } }
      found = u ? { url: u } : null;
      break;
    }
    default: found = null;
  }
  return found && (await imageLoads(found.url)) ? found : null;
}

const TYPES = new Set(['person', 'team', 'show', 'movie']);
function cleanSide(s: any): Side | null {
  if (!s || typeof s.name !== 'string' || typeof s.search !== 'string') return null;
  const name = s.name.trim().slice(0, 40), search = s.search.trim();
  if (!TYPES.has(s.type) || name.length < 2 || search.length < 2) return null;
  return { name, type: s.type, search };
}

Deno.serve(async (req: Request) => {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token !== serviceRoleKey) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const since = new Date(Date.now() - 3 * 86400000).toISOString();
    const { data: rows, error } = await admin.from('news_ticker')
      .select('id, headline, summary, lane, trend_rank')
      .eq('kind', 'trend').is('image_url', null).gte('fetched_at', since)
      .order('trend_rank', { ascending: true }).limit(80);
    if (error) throw error;
    const now = Date.now();
    const todo = (rows || []).filter((r: any) => now - (tried.get(r.id) || 0) > RETRY_MS).slice(0, MAX_PER_RUN);
    if (!todo.length) return new Response(JSON.stringify({ missing: 0 }), { status: 200 });

    const list = todo.map((r: any, i: number) => `${i}. [${r.lane || 'news'}] ${r.headline}${r.summary ? ' — ' + String(r.summary).slice(0, 140) : ''}`).join('\n');
    const items = parseItems(await askModel(PROMPT, list, 3000));
    if (!items.length) throw new Error('no usable JSON from model');
    const byI = new Map<number, any>(items.map((it: any) => [Number(it.i), it]));

    const report: any[] = [];
    await Promise.all(todo.map(async (r: any, i: number) => {
      tried.set(r.id, now);
      const subject = cleanSide(byI.get(i)?.subject);
      try {
        let url: string | null = null;
        if (subject) { const img = await findPhoto(subject, String(r.lane || '')); url = img ? img.url : null; }
        let via = subject ? 'subject' : 'none';
        if (!url) { url = await newsPhoto(admin, String(r.headline)); if (url) via = 'news'; }
        if (!url) { try { const t = await topicPhoto(String(r.headline)); if (t && (await imageLoads(t))) { url = t; via = 'wiki'; } } catch (_) { /* none */ } }
        if (url) {
          const { error: wErr } = await admin.from('news_ticker').update({ image_url: url }).eq('id', r.id).is('image_url', null);
          if (wErr) throw wErr;
        }
        report.push({ h: r.headline.slice(0, 50), photo: !!url, via });
      } catch (e) {
        report.push({ h: r.headline.slice(0, 50), error: String(e).slice(0, 100) });
      }
    }));
    return new Response(JSON.stringify({ missing: todo.length, report }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
