import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Puts the small circle photo on the daily questions, automatically.
//
// ONE real person per question, always (never a poster, badge, logo or group shot):
//   shows / movies -> the biggest lead actor; games -> a head coach or star player;
//   companies -> the best-known leader or founder.
//   The AI names the person, Wikipedia/Commons supplies a free head-and-shoulders portrait
//   (TheSportsDB player photo as a sports fallback), and the link is checked to really load
//   before it is saved to question_visuals, which the Play page already reads.
// Rows set by hand in the admin page are never overwritten. Called by a database trigger when
// questions are inserted, and by a 5-minute cron as a retry. When nothing is missing it does
// nothing, before any AI call.
//
// Secrets: TMDB_API_KEY (themoviedb.org, free) for shows and movies.
//          THESPORTSDB_API_KEY (optional; falls back to TheSportsDB's public test key "123").
//          GEMINI_API_KEY and/or ANTHROPIC_API_KEY for the AI step (already set for the news writer).

const UA = 'MarqitBot/1.0 (https://playmarqit.com; photo lookup for prediction questions)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const TAKE_MODEL = 'claude-sonnet-5-5';
const MAX_PER_RUN = 12;
const RETRY_MINUTES = 15;

type Side = { name: string; type: string; search: string };

const PROMPT = `You pick the photo for the daily prediction questions on Marqit. Each question gets ONE small round photo of ONE real person. For every question below, say which single person the photo should show.

Return, per question:
- "subject": {"name": the person's short display name (max 22 characters), "type": "person", "search": the person's full name as their English Wikipedia article is titled}. Return null if no single suitable person exists.
- "vs": always null. Never return a second person or a head-to-head.

Who to pick (ALWAYS exactly one real person, never a team badge, poster, logo, product or group):
- A question about a TV show or a movie: the single biggest, best-known lead actor of that show or movie, for example "Keri Russell" for The Diplomat. Never the director or a minor cast member.
- A question about a game, team or league (NFL, NBA, MLB, NHL, soccer, college): the team's head coach or its single biggest star player, whoever is most famous and most current. For a game between two teams pick one person: the head coach or star of the team the question asks about ("Will the Cowboys defeat the Packers" -> the Cowboys' head coach or quarterback).
- A question about a named player, athlete, fighter, artist or celebrity: that person.
- A question about a company, or about a product, launch, console or event run by a company, with no person named: that company's best-known current leader or founder: SpaceX, Starlink, Tesla -> "Elon Musk"; Nvidia -> "Jensen Huang"; Meta -> "Mark Zuckerberg"; Apple -> "Tim Cook"; Sony or PlayStation -> Sony's current CEO; and the same for Google, Microsoft, Amazon, OpenAI and so on.
- An event (a summit, a keynote, an awards show) with no named person: the most prominent speaker named in the question, or the leader of the company hosting it. If nothing at all is named, return subject null.

Rules:
- The photo must show one person alone, so choose someone with a well-known solo portrait on Wikipedia.
- Politicians and government figures are allowed (official portraits are free to use).
- Return null for private individuals, and for anything about death, crime or tragedy.
- If you are not sure of the exact name or who currently holds the role, return null rather than guessing. Do not rely on old memory for who is a current coach or CEO; pick the person you are most certain about.

Reply with JSON only: {"items":[{"i":0,"subject":{"name":"Keri Russell","type":"person","search":"Keri Russell"},"vs":null}]}`;

// ---- the model: free Gemini key first, Claude as a backup (same as the news writer) ----
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

// A link only counts if it really loads as an image, so a circle is never left empty.
async function imageLoads(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(10000) });
    const ok = res.ok && /^image\//i.test(res.headers.get('content-type') || '');
    try { await res.body?.cancel(); } catch (_) { /* ignore */ }
    return ok;
  } catch (_) { return false; }
}

// ---- Wikipedia: a FREELY LICENSED photo for an article title ----
// pilicense=free asks Wikipedia for free images only; the URL check is a second lock, because
// free files live on Commons and fair-use logos and posters live on en.wikipedia.
async function wikiPhoto(title: string): Promise<string | null> {
  const data = await getJson(`${WIKI_API}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages%7Cpageprops&piprop=thumbnail&pithumbsize=400&pilicense=free&ppprop=disambiguation&redirects=1&format=json&formatversion=2`);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  if (page.pageprops && 'disambiguation' in page.pageprops) return null;
  const t = page.thumbnail;
  if (!t || typeof t.source !== 'string') return null;
  // Wikipedia hands out thumbnails from either host; both serve the same free Commons files.
  if (/\.svg/i.test(t.source)) return null; // drawn logos are not photos
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\/wikipedia\/commons\//.test(t.source)) return null;
  const ratio = Number(t.width) / Number(t.height);
  // The photo is shown in a circle, so only head-and-shoulders style shots work: a very wide
  // photo (a group, a stadium) or a full-length one would cut a face off or show several people.
  if (!Number.isFinite(ratio) || ratio > 1.3 || ratio < 0.6) return null;
  return t.source;
}

// ---- TMDB: posters for shows and movies ----
function tmdbRequest(path: string, query: string): Promise<any> {
  const key = Deno.env.get('TMDB_API_KEY');
  if (!key) throw new Error('TMDB_API_KEY is not set');
  const q = `https://api.themoviedb.org/3/${path}?query=${encodeURIComponent(query)}&include_adult=false&language=en-US&page=1`;
  // A v4 "read access token" (starts with eyJ) goes in a header; a v3 key goes in the URL.
  return key.startsWith('eyJ') ? getJson(q, { authorization: 'Bearer ' + key }) : getJson(q + '&api_key=' + encodeURIComponent(key));
}
async function tmdbPoster(kind: 'tv' | 'movie', title: string): Promise<string | null> {
  const data = await tmdbRequest('search/' + kind, title);
  const results = (data?.results || []).filter((r: any) => r.poster_path).slice(0, 5);
  if (!results.length) return null;
  const dateOf = (r: any) => Date.parse(kind === 'tv' ? r.first_air_date : r.release_date) || 0;
  let pick = results[0];
  if (kind === 'movie') {
    // Daily questions are about the film in the news right now: prefer a recent or upcoming release.
    const now = Date.now(), from = now - 548 * 86400000, to = now + 366 * 86400000;
    const recent = results.filter((r: any) => dateOf(r) >= from && dateOf(r) <= to);
    if (recent.length) pick = recent.sort((a: any, b: any) => b.popularity - a.popularity)[0];
  } else {
    pick = [...results].sort((a: any, b: any) => b.popularity - a.popularity)[0];
  }
  return `https://image.tmdb.org/t/p/w342${pick.poster_path}`;
}

// ---- TheSportsDB: team badges and player photos ----
function sportsBase(): string { return `https://www.thesportsdb.com/api/v1/json/${Deno.env.get('THESPORTSDB_API_KEY') || '123'}`; }
function sized(url: string): string { return /\.(png|jpe?g)$/i.test(url) ? url + '/small' : url; }
// TheSportsDB answers some searches with a 404 instead of an empty list, and is picky about
// spaces, so try the name a few ways. A 404 on every try means "not found"; any other failure
// (rate limit, outage) is thrown so the question is retried later.
async function sportsSearch(endpoint: string, param: string, name: string): Promise<any> {
  const words = name.trim().split(/\s+/);
  const variants = [name.trim(), words.join('_'), ...(words.length > 1 ? [words.slice(1).join(' ')] : [])];
  for (const v of variants) {
    try { return await getJson(`${sportsBase()}/${endpoint}?${param}=${encodeURIComponent(v)}`); }
    catch (e) { if (!String(e).includes(' 404')) throw e; }
  }
  return null;
}
async function sportsBadge(team: string): Promise<string | null> {
  const data = await sportsSearch('searchteams.php', 't', team);
  const teams: any[] = data?.teams || [];
  if (!teams.length) return null;
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = teams.find((t) => norm(t.strTeam) === norm(team));
  if (!hit) return null; // exact team name only: a wrong badge is worse than the drawn one
  const badge = hit.strBadge || hit.strTeamBadge;
  return typeof badge === 'string' && /^https:\/\//.test(badge) ? sized(badge) : null;
}
async function sportsPlayerPhoto(name: string): Promise<string | null> {
  const data = await sportsSearch('searchplayers.php', 'p', name);
  const players: any[] = data?.player || [];
  if (!players.length) return null;
  const norm = (s: string) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hit = players.find((p) => norm(p.strPlayer) === norm(name));
  if (!hit) return null; // only an exact name match: a wrong face is worse than no face
  const img = hit.strThumb || hit.strCutout || hit.strRender;
  return typeof img === 'string' && /^https:\/\//.test(img) ? sized(img) : null;
}

// Finds one photo for one side. Returns null when there is no usable photo, and THROWS when the
// source could not be asked (missing key, network), so that question is retried next run
// instead of being marked as done.
async function findPhoto(side: Side, category: string): Promise<string | null> {
  // Always one person: posters, team badges and group shots are never used.
  if (side.type !== 'person') return null;
  let url: string | null = await wikiPhoto(side.search);
  if (!url && category === 'sports') { try { url = await sportsPlayerPhoto(side.search); } catch (_) { url = null; } }
  return url && (await imageLoads(url)) ? url : null;
}

const TYPES = new Set(['person', 'team', 'show', 'movie', 'company', 'other']);
function cleanSide(s: any): Side | null {
  if (!s || typeof s.name !== 'string' || typeof s.search !== 'string') return null;
  const name = s.name.trim().slice(0, 40), search = s.search.trim();
  const type = TYPES.has(s.type) ? s.type : 'other';
  if (name.length < 2 || search.length < 2) return null;
  return { name, type, search };
}

Deno.serve(async (req: Request) => {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token !== serviceRoleKey) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Recent and upcoming questions (two days back covers timezone edges).
    const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const { data: qs, error } = await admin.from('daily_questions')
      .select('id, category, question_text, question_date')
      .gte('question_date', since).order('question_date', { ascending: false }).limit(60);
    if (error) throw error;
    const ids = (qs || []).map((q: any) => q.id);
    if (!ids.length) return new Response(JSON.stringify({ missing: 0 }), { status: 200 });

    // Done = it has a photo, or it was tried less than RETRY_MINUTES ago and found none.
    // A question with no photo is tried again later, so adding a key or a source fixes it
    // without anyone touching the data. Rows with a photo (including ones set by hand) are never touched.
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
      if (!it) continue; // the model skipped it: leave it for the next run
      const subject = cleanSide(it.subject), vs: Side | null = null; // one person per question, never a face-off
      let row: any = { question_id: q.id, subject_name: null, subject_image_url: null, vs_name: null, vs_image_url: null, updated_at: new Date().toISOString() };
      try {
        if (subject) {
          const subImg = await findPhoto(subject, q.category);
          if (vs) {
            const vsImg = subImg ? await findPhoto(vs, q.category) : null;
            // A face-off needs both faces, otherwise save nothing so the drawn matchup stays.
            if (subImg && vsImg) row = { ...row, subject_name: subject.name, subject_image_url: subImg, vs_name: vs.name, vs_image_url: vsImg };
          } else if (subImg) {
            row = { ...row, subject_name: subject.name, subject_image_url: subImg };
          }
        }
      } catch (e) {
        report.push({ q: q.question_text.slice(0, 60), error: String(e).slice(0, 100) });
        continue; // the source could not be asked (not "no photo"): try again next run
      }
      // Only questions with no photo reach this point, so this never overwrites one set by hand.
      const { error: wErr } = await admin.from('question_visuals').upsert(row, { onConflict: 'question_id' });
      if (wErr) throw wErr;
      report.push({ q: q.question_text.slice(0, 60), photo: !!row.subject_image_url, faceoff: !!row.vs_image_url, subject: subject ? subject.type + ':' + subject.search : null, vs: vs ? vs.type + ':' + vs.search : null, img: row.subject_image_url });
    }
    return new Response(JSON.stringify({ missing: todo.length, report }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
