import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Puts the small circle photo on the daily questions, automatically.
//
// ONE real person per question, always (never a poster, logo, badge or group shot):
//   show / movie -> the biggest of its top-billed actors (TMDB cast photo)
//   team         -> its head coach, read from the team's Wikipedia page (current, not AI memory)
//   person       -> Wikipedia/Commons free portrait, then (sports) TheSportsDB player photo
//   company      -> the company's best-known leader (the AI names them as a person)
// Only head-and-shoulders style photos are accepted, so a face is never cropped away in the circle.
// If no good photo is found the question simply has no photo. Rows set by hand in the admin page
// are never overwritten.
// Secrets: TMDB_API_KEY, THESPORTSDB_API_KEY (optional), GEMINI_API_KEY and/or ANTHROPIC_API_KEY.

const UA = 'MarqitBot/1.0 (https://playmarqit.com; photo lookup for prediction questions)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const TAKE_MODEL = 'claude-sonnet-5-5';
const MAX_PER_RUN = 12;
const RETRY_MINUTES = 15;

type Side = { name: string; type: string; search: string };

const PROMPT = `You pick the photo for the daily prediction questions on Marqit. Each question gets ONE small round photo of ONE real person. For every question below, say who or what the photo should be about.

Return, per question:
- "subject": {"name": short display name (max 22 characters), "type": one of "person" | "team" | "show" | "movie", "search": the text to look it up with}.
- "vs": always null. Never return a second side.

What to return:
- A question about a TV show: type "show", search = the series title, for example "The Diplomat". (Its biggest lead actor is looked up for you.)
- A question about a movie: type "movie", search = the film title. (Its biggest lead actor is looked up for you.)
- A question about a game, team or league: type "team", search = the full official name of the team the question is about, for example "Dallas Cowboys". (Its head coach is looked up for you.) In a matchup choose the first-named team.
- A question about a named player, athlete, fighter, artist or celebrity: type "person", search = their full name as it would be titled on English Wikipedia.
- A question about a company, or about a product, launch, console or event run by a company, with no person named, MUST use that company's best-known current leader or founder as a person (type "person"): SpaceX, Starlink or a Falcon 9 or Starship launch -> "Elon Musk"; Tesla -> "Elon Musk"; Nvidia -> "Jensen Huang"; Meta -> "Mark Zuckerberg"; Apple -> "Tim Cook"; Sony or PlayStation -> Sony's current CEO; and the same for Google, Microsoft, Amazon, OpenAI and so on.
- Every news question gets a face. If no person or company is named, pick the single most prominent, recognizable person tied to the topic, such as the leader of the company or organization hosting the event, or the best-known leader in that field, and use that person (type "person"). Choose a famous, household-name person who certainly has a Wikipedia article with a photo (for a tech or AI event: the best-known leader in that field, such as Sam Altman, Jensen Huang, Elon Musk, Mark Zuckerberg or Sundar Pichai), never an obscure editor, researcher or spokesperson. Only choose someone you are sure currently holds that role. Return subject null only if you cannot name anyone with confidence.

Rules:
- Never use a logo, poster, product, rocket, building or group. Always end up with one person.
- Politicians and government figures are allowed (official portraits are free to use).
- Return null for private individuals, and for anything about death, crime or tragedy.
- If you are not sure of the exact title or name, return null.

Reply with JSON only: {"items":[{"i":0,"subject":{"name":"The Diplomat","type":"show","search":"The Diplomat"},"vs":null}]}`;

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

// Wikipedia: a FREELY LICENSED portrait for an article title. The photo is shown in a circle, so
// only head-and-shoulders style shots are accepted: a wide photo (a group, a stadium, a person
// standing far away) would cut a face off or show several people, so those are skipped.
async function wikiPhoto(title: string): Promise<string | null> {
  const data = await getJson(`${WIKI_API}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages%7Cpageprops&piprop=thumbnail&pithumbsize=400&pilicense=free&ppprop=disambiguation&redirects=1&format=json&formatversion=2`);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  if (page.pageprops && 'disambiguation' in page.pageprops) return null;
  const t = page.thumbnail;
  if (!t || typeof t.source !== 'string') return null;
  if (/\.svg/i.test(t.source)) return null; // drawn logos are not photos
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//.test(t.source)) return null;
  const ratio = Number(t.width) / Number(t.height);
  if (!Number.isFinite(ratio) || ratio > 1.2 || ratio < 0.6) return null;
  return t.source;
}

// TMDB: for a show or movie, the photo of its biggest top-billed actor (never the poster).
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
  const dateOf = (r: any) => Date.parse(kind === 'tv' ? r.first_air_date : r.release_date) || 0;
  let pick = [...results].sort((a: any, b: any) => b.popularity - a.popularity)[0];
  if (kind === 'movie') {
    const now = Date.now(), from = now - 548 * 86400000, to = now + 366 * 86400000;
    const recent = results.filter((r: any) => dateOf(r) >= from && dateOf(r) <= to);
    if (recent.length) pick = recent.sort((a: any, b: any) => b.popularity - a.popularity)[0];
  }
  const credits = await tmdbGet(`${kind}/${pick.id}/credits`, 'x=1');
  // Among the three top-billed actors that have a photo, the best-known one (highest TMDB popularity).
  const lead = (credits?.cast || []).filter((c: any) => c.profile_path).slice(0, 3)
    .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))[0];
  return lead ? { url: `https://image.tmdb.org/t/p/w342${lead.profile_path}`, label: String(lead.name || '') } : null;
}

function sportsBase(): string { return `https://www.thesportsdb.com/api/v1/json/${Deno.env.get('THESPORTSDB_API_KEY') || '123'}`; }
function sized(url: string): string { return /\.(png|jpe?g)$/i.test(url) ? url + '/small' : url; }
async function sportsSearch(endpoint: string, param: string, name: string): Promise<any> {
  const words = name.trim().split(/\s+/);
  const variants = [name.trim(), words.join('_'), ...(words.length > 1 ? [words.slice(1).join(' ')] : [])];
  for (const v of variants) {
    try { return await getJson(`${sportsBase()}/${endpoint}?${param}=${encodeURIComponent(v)}`); }
    catch (e) { if (!String(e).includes(' 404')) throw e; }
  }
  return null;
}
async function sportsPlayerPhoto(name: string): Promise<string | null> {
  const data = await sportsSearch('searchplayers.php', 'p', name);
  const players: any[] = data?.player || [];
  if (!players.length) return null;
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = players.find((p) => norm(p.strPlayer) === norm(name));
  if (!hit) return null;
  const img = hit.strThumb || hit.strCutout || hit.strRender;
  return typeof img === 'string' && /^https:\/\//.test(img) ? sized(img) : null;
}

// A team is shown as its head coach or manager, read from the team's own Wikipedia page (so it is
// current, not from the AI's memory). Team logos are protected, so they are not used.
async function coachPhoto(team: string): Promise<{ url: string; label: string } | null> {
  const data = await getJson(`${WIKI_API}?action=query&titles=${encodeURIComponent(team)}&prop=revisions&rvprop=content&rvslots=main&redirects=1&format=json&formatversion=2`);
  const text: string = (data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content || '').slice(0, 15000);
  const m = text.match(/\|\s*(?:head[ _]?coach|manager|coach)\s*=\s*(?:\{\{[^\[\]{}]*?\|\s*)?(?:\{\{[^}]*\}\}\s*)*\[\[([^\]|#]+)/i);
  if (!m) return null;
  const article = m[1].trim();
  const url = await wikiPhoto(article);
  const label = article.replace(/\s*\(.*\)\s*$/, '');
  return url ? { url, label } : null;
}

// Always one person: any other kind of subject (company, product, other) gets no photo.
async function findPhoto(side: Side, category: string): Promise<{ url: string; label?: string } | null> {
  let found: { url: string; label?: string } | null = null;
  switch (side.type) {
    case 'show': found = await tmdbLead('tv', side.search); break;
    case 'movie': found = await tmdbLead('movie', side.search); break;
    case 'team': found = await coachPhoto(side.search); break;
    case 'person': {
      let u = await wikiPhoto(side.search);
      if (!u && category === 'sports') { try { u = await sportsPlayerPhoto(side.search); } catch (_) { u = null; } }
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
    const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const { data: qs, error } = await admin.from('daily_questions')
      .select('id, category, question_text, question_date')
      .gte('question_date', since).order('question_date', { ascending: false }).limit(60);
    if (error) throw error;
    const ids = (qs || []).map((q: any) => q.id);
    if (!ids.length) return new Response(JSON.stringify({ missing: 0 }), { status: 200 });

    // Done = it has a photo, or it was tried less than RETRY_MINUTES ago and found none.
    const { data: have, error: hErr } = await admin.from('question_visuals').select('question_id, subject_image_url, updated_at').in('question_id', ids);
    if (hErr) throw hErr;
    const fresh = Date.now() - RETRY_MINUTES * 60000;
    const done = new Set((have || []).filter((r: any) => r.subject_image_url || Date.parse(r.updated_at) > fresh).map((r: any) => r.question_id));
    const todo = (qs || []).filter((q: any) => !done.has(q.id)).slice(0, MAX_PER_RUN);
    if (!todo.length) return new Response(JSON.stringify({ missing: 0 }), { status: 200 });

    const list = todo.map((q: any, i: number) => `${i}. [${q.category}] ${q.question_text}`).join('\n');
    const items = parseItems(await askModel(PROMPT, list, 3000));
    if (!items.length) throw new Error('no usable JSON from model');
    const byI = new Map<number, any>(items.map((it: any) => [Number(it.i), it]));

    const report: any[] = [];
    for (let i = 0; i < todo.length; i++) {
      const q = todo[i];
      const it = byI.get(i);
      if (!it) continue;
      const subject = cleanSide(it.subject); // one person per question, never a face-off
      let row: any = { question_id: q.id, subject_name: null, subject_image_url: null, vs_name: null, vs_image_url: null, updated_at: new Date().toISOString() };
      try {
        if (subject) {
          const subImg = await findPhoto(subject, q.category);
          if (subImg) row = { ...row, subject_name: subImg.label || subject.name, subject_image_url: subImg.url };
        }
      } catch (e) {
        report.push({ q: q.question_text.slice(0, 60), error: String(e).slice(0, 100) });
        continue;
      }
      const { error: wErr } = await admin.from('question_visuals').upsert(row, { onConflict: 'question_id' });
      if (wErr) throw wErr;
      report.push({ q: q.question_text.slice(0, 60), photo: !!row.subject_image_url, subject: subject ? subject.type + ':' + subject.search : null, label: row.subject_name, img: row.subject_image_url });
    }
    return new Response(JSON.stringify({ missing: todo.length, report }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
