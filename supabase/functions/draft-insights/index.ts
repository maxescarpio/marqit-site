// draft-insights
// Supabase Edge Function: drafts the 5 "Marqit+" bullet points (historical data + odds) for
// each posted daily question that doesn't have any yet.
//
// Drafts are written to question_insights as 'pending' -- NOTHING is shown to players until
// the admin approves (and optionally edits) them in admin.html. The admin gets a push
// notification when drafts are ready.
//
// Runs for today's and the next two days' questions (US Eastern), so insights are ready before the
// questions go live AND a lopsided question can be changed before anyone can answer it.
//
// HOUSE RULE: a question whose lean is under 25% or over 75% (LOPSIDED) is not a real question -- there is
// nothing left to predict. Those are flagged to the admin by push and in admin.html so the question can be
// rewritten or its line moved BEFORE it goes live. Questions that already have a row (pending, approved or rejected) are
// skipped, so it is safe to run as often as you like.
//
// SECRETS: ANTHROPIC_API_KEY. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatic.
// AUTH: call with the SUPABASE_SERVICE_ROLE_KEY as the bearer token.
// TESTING: pass {"test_date": "YYYY-MM-DD"} for one date, or {"question_id": "<uuid>"} for one question.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const CLAUDE_MODEL = 'claude-sonnet-5';
const MAX_PER_RUN = 6;
const BULLET_COUNT = 5;
const LOPSIDED_HIGH = 75; // house rule: allowed lean is 25-75. Under 25 or over 75 = too favored to one side
const LOPSIDED_LOW = 25;
const MAX_BULLET_CHARS = 240;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const CATEGORY_LABELS: Record<string, string> = {
  sports: 'Sports',
  pop_culture: 'Pop culture',
  news: 'News'
};

function dateStringET(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// Finds the last JSON object in the reply that satisfies `accept`, even if Claude wrote
// some sentences before it.
function extractJson(text: string, accept: (o: any) => boolean): any | null {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  for (let i = candidates.length - 1; i >= 0; i--) {
    try {
      const o = JSON.parse(candidates[i]);
      if (o && accept(o)) return o;
    } catch (_) { /* keep looking */ }
  }
  return null;
}

// Last problem seen talking to the API, reported back in the response so failures are visible.
let lastError = '';

async function callClaude(apiKey: string, system: string, userMsg: string, deadline: number): Promise<string | null> {
  const messages: any[] = [{ role: 'user', content: userMsg }];
  for (let turn = 0; turn < 4; turn++) {
    const remaining = deadline - Date.now();
    if (remaining < 8000) { console.error('Out of time before Claude call'); return null; }
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 4096,
          system: system,
          messages: messages,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }]
        }),
        signal: AbortSignal.timeout(remaining)
      });
    } catch (e) {
      console.error('Anthropic request failed or timed out:', String(e));
      lastError = 'request failed: ' + String(e).slice(0, 200);
      return null;
    }
    if (!res.ok) {
      const errText = await res.text();
      console.error('Anthropic API error', res.status, errText);
      lastError = 'Anthropic API ' + res.status + ': ' + errText.slice(0, 300);
      return null;
    }
    const data = await res.json();
    if (data.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: data.content });
      continue;
    }
    return (data.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
  }
  console.error('Too many pause_turn continuations');
  return null;
}

const SYSTEM_PROMPT = `You write the "Marqit+" insight panel for Marqit, a free daily prediction game where players call a YES/NO question before it locks. Each question gets exactly ${BULLET_COUNT} short bullet points and a lean. The panel exists to help a player reason their way to an answer.

THE TEST FOR EVERY BULLET
A player could already find the obvious facts in 30 seconds on Google, so those are worthless here. Before keeping a bullet, ask: does it contain an insight the player would not have found in a quick search, AND does it say how it pushes the answer toward YES or NO? If not, replace it.

BANNED (never use these as bullets)
- Win-loss records, standings, "both teams are 6-1", seeds, rankings with no insight attached.
- Series history, "they last met on...", all-time head-to-head records, "last time they played", old scores.
- Season averages stated on their own, bio facts, awards, "he is a veteran", anything a Wikipedia page would say.
- Anything that only restates the question, or a bullet with no stated implication for the outcome.

WHAT GOOD BULLETS LOOK LIKE
- Threshold math: what the player/team has to do versus what they normally do ("needs ~33 attempts to reach 230 yards at 7.1 per attempt, but has averaged 20").
- Distribution and hit rate: how often something has cleared this exact line in a stated sample, and how volatile it is.
- Matchup splits: how the opponent does against this exact type of player, play or situation (yards allowed to the position, pressure rate, defensive efficiency ranks), not generic team ranks.
- Game-script and usage logic: how the likely flow of the event changes volume or probability.
- Current-state swing factors: injuries, lineup or role changes, rest, weather, venue, schedule spot, with the numeric effect where known.
- For non-sports: the actual chart/ratings/earnings numbers today versus the threshold, the gap, and how fast it has been moving; base rates for this kind of event; panel or forecast-model views.
- Each bullet ends up answering "so what?" in plain words (this raises the chance / this makes it hard). Do not just list data.

HARD RULES
- Use web search. Every number must come from a source you actually found. NEVER invent or estimate a statistic. If you cannot verify something, use a different verified fact instead. Arithmetic on verified numbers is allowed and encouraged (state it plainly).
- Give the time frame and sample size ("last 8 games", "this season", "Nov 7 chart").
- NEVER cite betting lines, sportsbook odds, spreads, over/under numbers, player prop lines, or prediction-market prices. Historical data, base rates, usage, matchup data and published statistical models are fine. Say "as of <date>" for anything that moves.
- Mix the angles; do not give five bullets of the same type. Include at least one bullet that argues against the way the other four lean.
- Each bullet is one or two plain sentences, ${MAX_BULLET_CHARS} characters or fewer, no emojis, no markdown, no citations or links inside the text.
- Be neutral. Do not tell the player which way to pick.
- Do not state the final result even if known; if the outcome is already public, say so in your JSON instead (see below).

THE LEAN (REQUIRED)
Every question must get a lean. lean_yes_pct is a whole number 1-99 for the chance the answer is YES. Build it from the data: a historical hit rate over a stated sample, a published statistical model, or your own estimate reasoned from the numbers in your bullets. Never use betting lines or prediction markets. lean_basis is one plain sentence of at most 200 characters saying what it rests on. If it is your own estimate from the bullet data, begin it with "Marqit estimate:" and name the one or two numbers that drive it. When evidence is thin, move toward a sensible base rate rather than refusing. Never return null for the lean. Make sure the lean agrees with the direction your bullets point.

OUTPUT
Reply with ONE JSON object and nothing after it:
{"bullets": ["...", "...", "...", "...", "..."], "lean_yes_pct": 62, "lean_basis": "..."}
Exactly ${BULLET_COUNT} strings. Only if you cannot find enough verifiable facts, or the outcome is already public, reply instead with {"skip": "<short reason>"}.`;

async function draftInsights(
  apiKey: string,
  q: { question_text: string; category: string; question_date: string; resolution_criteria: string | null; lock_time: string | null },
  deadline: number
): Promise<{ bullets?: string[]; lean_yes_pct?: number | null; lean_basis?: string | null; skip?: string } | null> {
  const userMsg =
    `Question: ${q.question_text}\n` +
    `Category: ${CATEGORY_LABELS[q.category] || q.category}\n` +
    `Question date: ${q.question_date}\n` +
    (q.lock_time ? `Locks at: ${q.lock_time}\n` : '') +
    (q.resolution_criteria ? `How it resolves: ${q.resolution_criteria}\n` : '') +
    `Today's date (US Eastern): ${dateStringET(0)}\n\nWrite the ${BULLET_COUNT} Marqit+ bullet points.`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const text = await callClaude(apiKey, SYSTEM_PROMPT, userMsg, deadline);
    if (!text) continue;
    const obj = extractJson(text, (o) => Array.isArray(o.bullets) || typeof o.skip === 'string');
    if (!obj) continue;
    if (typeof obj.skip === 'string' && !Array.isArray(obj.bullets)) return { skip: obj.skip };
    const bullets = (obj.bullets as unknown[])
      .map((b) => (typeof b === 'string' ? b.replace(/<\/?cite[^>]*>/g, '').trim() : ''))
      .filter((b) => b.length > 0);
    if (bullets.length === BULLET_COUNT && bullets.every((b) => b.length <= MAX_BULLET_CHARS + 40)) {
      const pct = Number(obj.lean_yes_pct);
      const basis = typeof obj.lean_basis === 'string' ? obj.lean_basis.replace(/<\/?cite[^>]*>/g, '').trim() : '';
      const ok = Number.isInteger(pct) && pct >= 1 && pct <= 99 && basis.length > 0 && basis.length <= 220;
      if (!ok) { console.error(`Attempt ${attempt}: missing or invalid lean`); continue; }
      return { bullets, lean_yes_pct: pct, lean_basis: basis };
    }
    console.error(`Attempt ${attempt}: got ${bullets.length} bullets or one was too long`);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: CORS_HEADERS });
  }
  if (!anthropicApiKey) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY secret is not set.' }), { status: 500, headers: CORS_HEADERS });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const startedAt = Date.now();
  const deadline = startedAt + 125000;

  try {
    const body = await req.json().catch(() => ({}));

    // Which questions to cover.
    let query = admin
      .from('daily_questions')
      .select('id, question_text, category, question_date, resolution_criteria, lock_time')
      .eq('voided', false)
      .eq('resolved', false);
    if (typeof body.question_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.question_id)) {
      query = query.eq('id', body.question_id);
    } else if (typeof body.test_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.test_date)) {
      query = query.eq('question_date', body.test_date);
    } else {
      query = query.in('question_date', [dateStringET(0), dateStringET(1), dateStringET(2)]);
    }
    const { data: questions, error: qErr } = await query.order('question_date', { ascending: true }).order('slot', { ascending: true });
    if (qErr) throw qErr;

    const ids = (questions || []).map((q: any) => q.id);
    if (!ids.length) {
      return new Response(JSON.stringify({ drafted: 0, note: 'No open questions to cover.' }), { status: 200, headers: CORS_HEADERS });
    }

    // {"replace": true} with a question_id or test_date throws away the existing draft and writes a new one.
    if (body.replace === true && (body.question_id || body.test_date)) {
      await admin.from('question_insights').delete().in('question_id', ids);
    }
    const { data: existing } = await admin.from('question_insights').select('question_id').in('question_id', ids);
    const have = new Set((existing || []).map((r: any) => r.question_id));
    const todo = (questions || []).filter((q: any) => !have.has(q.id)).slice(0, MAX_PER_RUN);
    if (!todo.length) {
      return new Response(JSON.stringify({ drafted: 0, note: 'Every open question already has insights.' }), { status: 200, headers: CORS_HEADERS });
    }

    const settled = await Promise.allSettled(todo.map((q: any) => draftInsights(anthropicApiKey, q, deadline)));

    let drafted = 0;
    const details: any[] = [];
    for (let i = 0; i < todo.length; i++) {
      const q = todo[i];
      const r = settled[i];
      const result = r.status === 'fulfilled' ? r.value : null;
      if (!result || !result.bullets) {
        details.push({ question_id: q.id, drafted: false, reason: result && result.skip ? result.skip : ('no usable draft' + (lastError ? ' (' + lastError + ')' : '')) });
        continue;
      }
      const { error: insErr } = await admin.from('question_insights').insert({
        question_id: q.id,
        bullets: result.bullets,
        lean_yes_pct: result.lean_yes_pct ?? null,
        lean_basis: result.lean_basis ?? null,
        status: 'pending',
        source: 'claude'
      });
      if (insErr) {
        console.error('Insert error', q.id, insErr.message);
        details.push({ question_id: q.id, drafted: false, reason: insErr.message });
      } else {
        drafted++;
        details.push({ question_id: q.id, drafted: true });
      }
    }

    if (drafted > 0) {
      try {
        const { data: adminUserId } = await admin.rpc('get_admin_user_id');
        if (adminUserId) {
          // Lopsided questions get their own, louder push: change the question before it goes live.
          const lopsided: string[] = [];
          for (let i = 0; i < todo.length; i++) {
            const r = settled[i];
            const res = r.status === 'fulfilled' ? r.value : null;
            const pct = res && typeof res.lean_yes_pct === 'number' ? res.lean_yes_pct : null;
            if (pct !== null && (pct > LOPSIDED_HIGH || pct < LOPSIDED_LOW)) {
              const t = String(todo[i].question_text || '');
              lopsided.push(`${todo[i].question_date}: ${t.length > 70 ? t.slice(0, 67) + '...' : t} (${pct >= 50 ? pct + '% YES' : (100 - pct) + '% NO'})`);
            }
          }
          if (lopsided.length) {
            await fetch(`${supabaseUrl}/functions/v1/send-push`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_id: adminUserId,
                title: lopsided.length === 1 ? 'A question is lopsided. Change it before it goes live' : `${lopsided.length} questions are lopsided. Change them before they go live`,
                body: lopsided.join(' | '),
                url: 'https://playmarqit.com/admin.html',
                tag: 'lopsided-question'
              })
            });
          }
          await fetch(`${supabaseUrl}/functions/v1/send-push`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${serviceRoleKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: adminUserId,
              title: `${drafted} Marqit+ insight set${drafted > 1 ? 's' : ''} ready to review`,
              body: 'Tap to approve, edit, or reject before players see them.',
              url: 'https://playmarqit.com/admin.html'
            })
          });
        }
      } catch (e) {
        console.error('send-push call failed', e);
      }
    }

    return new Response(JSON.stringify({ drafted, seconds: Math.round((Date.now() - startedAt) / 1000), details }), { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS_HEADERS });
  }
});
