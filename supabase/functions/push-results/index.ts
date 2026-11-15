// push-results: sends a push notification the moment a day's results are scored, so players
// don't have to wait for the morning to find out how they did.
//
// Triggered by a database trigger on day_resolutions (see 20261113_results_push.sql), the same
// moment the results email goes out. Only players who turned notifications on AND have a device
// registered are pushed, and each player gets at most one push per day (results_push_sent).
//
// AUTH: the service role key only (the trigger reads it from Vault). No one else can call this.
// TESTING: {"target_date":"2026-11-12","dry_run":true} lists who WOULD be pushed and the text,
// without sending anything or recording anything.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

// Short, specific, and a little loud. The title carries the score so it reads on a lock screen.
function buildMessage(correct: number, total: number, streak: number, points: number): { title: string; body: string } {
  let title: string;
  if (total > 0 && correct === total) title = total === 3 ? 'Perfect 3 for 3 \u{1F3AF}' : `You got all ${total}`;
  else if (correct === 0) title = `0 for ${total} today`;
  else title = `You went ${correct} for ${total}`;

  const parts: string[] = [];
  if (streak > 1) parts.push(`${streak}-day streak`);
  parts.push(`${points.toLocaleString('en-US')} pts`);
  const tail = correct === 0 ? 'New calls drop tomorrow. Get it back.' : 'See how you stacked up against the crowd.';
  return { title, body: `${parts.join(' · ')}. ${tail}` };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token !== serviceRoleKey) return json({ error: 'Unauthorized.' }, 401);
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const targetDate: string | undefined = body.target_date;
    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) return json({ error: 'target_date (YYYY-MM-DD) is required.' }, 400);
    const dryRun = body.dry_run === true;

    // Only people who turned notifications on AND actually have a device registered.
    const { data: subs } = await admin.from('push_subscriptions').select('user_id');
    const withDevice = Array.from(new Set((subs || []).map((s: any) => s.user_id)));
    if (withDevice.length === 0) return json({ pushed: 0, note: 'Nobody has a push device registered.' });
    const { data: profiles } = await admin.from('profiles').select('id').in('id', withDevice).eq('notify_push', true);
    const candidateIds = (profiles || []).map((p: any) => p.id);
    if (candidateIds.length === 0) return json({ pushed: 0, note: 'Nobody with a device has push turned on.' });

    // Already pushed for this day (re-triggers and retries must not double-send).
    const { data: doneRows } = await admin.from('results_push_sent').select('user_id').eq('target_date', targetDate).in('user_id', candidateIds);
    const done = new Set((doneRows || []).map((r: any) => r.user_id));

    let pushed = 0;
    let failed = 0;
    let skipped = 0;
    const preview: any[] = [];

    for (const userId of candidateIds) {
      if (done.has(userId)) { skipped++; continue; }

      const { data: preds } = await admin
        .from('predictions')
        .select('choice, daily_questions!inner(correct_answer, resolved, voided, question_date)')
        .eq('user_id', userId)
        .eq('daily_questions.question_date', targetDate);
      // Voided questions are neither right nor wrong. Unresolved ones can't be scored yet.
      const scored = ((preds || []) as any[]).filter((p) => p.daily_questions.resolved && !p.daily_questions.voided && p.daily_questions.correct_answer);
      if (scored.length === 0) { skipped++; continue; }
      const correct = scored.filter((p) => p.choice === p.daily_questions.correct_answer).length;

      const { data: streakRow } = await admin.from('streaks').select('current_streak, total_points').eq('user_id', userId).maybeSingle();
      const msg = buildMessage(correct, scored.length, streakRow?.current_streak ?? 0, streakRow?.total_points ?? 0);

      if (dryRun) { preview.push({ correct, total: scored.length, ...msg }); continue; }

      const res = await fetch(supabaseUrl + '/functions/v1/send-push', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + serviceRoleKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, title: msg.title, body: msg.body, url: 'https://playmarqit.com/', tag: 'results-' + targetDate })
      }).catch(() => null);
      if (res && res.ok) {
        pushed++;
        await admin.from('results_push_sent').upsert({ user_id: userId, target_date: targetDate }, { onConflict: 'user_id,target_date' });
      } else {
        failed++;
      }
    }

    if (dryRun) return json({ dry_run: true, target_date: targetDate, would_push: preview.length, skipped, preview });
    return json({ target_date: targetDate, pushed, failed, skipped });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
