import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Puts the small circle photos on the daily questions, automatically.
//
// For every recent or upcoming daily question that has no row in question_visuals yet:
//   1. the AI says who or what the question is about (a person, company, show, place),
//      and for a head-to-head, the other side too;
//   2. each name is looked up on English Wikipedia and only a FREELY LICENSED photo
//      (hosted on Wikimedia Commons) is accepted. Logos and posters that are fair use are
//      never taken, so team matchups keep the site's drawn badges;
//   3. the result is saved to question_visuals, which the Play page already reads.
//
// A face-off (two sides) is only saved when BOTH photos are found, so a matchup never
// loses its badges for a half-empty picture. Rows set by hand in the admin page are never
// overwritten. Called by a database trigger the moment questions are inserted, and by a
// 5-minute cron as a retry. Safe to call as often as you like: when nothing is missing it
// does nothing.

const UA = 'MarqitBot/1.0 (https://playmarqit.com; photo lookup for prediction questions)';
const WIKI_API = 'https://en.wikipedia.org/w/api.php';
const TAKE_MODEL = 'claude-sonnet-5-5';
const MAX_PER_RUN = 12;

type Subject = { name: string; wiki: string };

const PROMPT = `You pick the photos for the daily prediction questions on Marqit. Each question gets small round photos of who or what it is about. For every question below, say who or what the photo should show.

Return, per question:
- "subject": the main real PERSON (athlete, coach, executive, artist, actor, fighter) or notable COMPANY, PRODUCT, TV SHOW, FILM or PLACE the question is about, as {"name": short display name (max 22 characters), "wiki": exact English Wikipedia article title}.
  For a COMPANY or PRODUCT, "wiki" may be the closely related article that is most likely to have a real photograph, for example "Falcon 9" for a SpaceX launch question or "Tesla Cybertruck" for a Cybertruck question. "name" stays what the question is about.
- "vs": only when the question is a head-to-head between two people or two companies (a fight, a tennis match, a rivalry), the other side in the same shape. Otherwise null.

Rules:
- Use only names that are written in the question text. Never add a person from your own memory.
- Sports TEAMS: return subject null. The site already draws team badges. A named athlete in a team question is fine as the subject.
- If you are not sure of the exact Wikipedia article title, return null for that side.
- Return null for politicians, government figures, private individuals, and anything about death, crime or tragedy.
- If a question has two people but you can only name one, return the one as subject and vs null.

Reply with JSON only: {"items":[{"i":0,"subject":{"name":"Bo Nix","wiki":"Bo Nix"},"vs":null}]}`;

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

// ---- Wikipedia: a free-licensed photo for an article title ----
// pilicense=free asks Wikipedia for free images only; the URL check is a second lock,
// because free files live on Commons and fair-use logos and posters live on en.wikipedia.
// Returns null when there is simply no usable photo, and throws when the lookup itself failed.
async function wikiPhoto(title: string): Promise<string | null> {
  const url = `${WIKI_API}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages%7Cpageprops&piprop=thumbnail&pithumbsize=240&pilicense=free&ppprop=disambiguation&redirects=1&format=json&formatversion=2`;
  const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error('wikipedia ' + res.status);
  const data = await res.json();
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  if (page.pageprops && 'disambiguation' in page.pageprops) return null;
  const t = page.thumbnail;
  if (!t || typeof t.source !== 'string') return null;
  if (!/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\//.test(t.source)) return null;
  const ratio = Number(t.width) / Number(t.height);
  if (!Number.isFinite(ratio) || ratio > 1.8 || ratio < 0.5) return null; // wide wordmarks do not crop to a circle
  return t.source;
}

function cleanSubject(s: any): Subject | null {
  if (!s || typeof s.name !== 'string' || typeof s.wiki !== 'string') return null;
  const name = s.name.trim().slice(0, 40), wiki = s.wiki.trim();
  if (name.length < 2 || wiki.length < 2) return null;
  return { name, wiki };
}

Deno.serve(async (req: Request) => {
  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token !== serviceRoleKey) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Recent and upcoming questions (a day back covers timezone edges).
    const since = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const { data: qs, error } = await admin.from('daily_questions')
      .select('id, category, question_text, question_date')
      .gte('question_date', since).order('question_date', { ascending: false }).limit(60);
    if (error) throw error;
    const ids = (qs || []).map((q: any) => q.id);
    if (!ids.length) return new Response(JSON.stringify({ missing: 0 }), { status: 200 });

    const { data: have, error: hErr } = await admin.from('question_visuals').select('question_id').in('question_id', ids);
    if (hErr) throw hErr;
    const done = new Set((have || []).map((r: any) => r.question_id));
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
      const subject = cleanSubject(it.subject), vs = cleanSubject(it.vs);
      let row: any = { question_id: q.id, subject_name: null, subject_image_url: null, vs_name: null, vs_image_url: null };
      try {
        if (subject) {
          const subImg = await wikiPhoto(subject.wiki);
          if (vs) {
            const vsImg = subImg ? await wikiPhoto(vs.wiki) : null;
            // A face-off needs both faces, otherwise save nothing so the drawn matchup stays.
            if (subImg && vsImg) row = { ...row, subject_name: subject.name, subject_image_url: subImg, vs_name: vs.name, vs_image_url: vsImg };
          } else if (subImg) {
            row = { ...row, subject_name: subject.name, subject_image_url: subImg };
          }
        }
      } catch (e) {
        report.push({ q: q.question_text.slice(0, 60), error: String(e).slice(0, 80) });
        continue; // lookup failed (not "no photo"): do not mark it done, try again next run
      }
      // ignoreDuplicates: never overwrite a photo someone set by hand in the admin page.
      const { error: wErr } = await admin.from('question_visuals').upsert(row, { onConflict: 'question_id', ignoreDuplicates: true });
      if (wErr) throw wErr;
      report.push({ q: q.question_text.slice(0, 60), photo: !!row.subject_image_url, faceoff: !!row.vs_image_url, subject: subject?.name || null, vs: vs?.name || null });
    }
    return new Response(JSON.stringify({ missing: todo.length, report }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
