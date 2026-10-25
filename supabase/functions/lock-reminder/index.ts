// lock-reminder
// Runs every 10 minutes (cron). About 1 hour before a question locks, sends a push
// notification to every player who turned on notifications and hasn't made that call yet.
// Each person gets each reminder at most once (tracked in lock_reminders_sent).
//
// AUTH: the service role key (cron reads it from Vault). No one else can call this.
// TESTING: {"dry_run": true, "as_of": "2026-09-21T23:30:00Z"} shows who WOULD be notified as of
// that moment, without sending anything.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (token !== serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: CORS_HEADERS });
  }
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const now = (typeof body.as_of === 'string' && !isNaN(Date.parse(body.as_of))) ? new Date(body.as_of) : new Date();
    const before = 60; // minutes before lock
    const windowMin = 10; // matches the cron cadence, so each question lands in exactly one run
    const lo = new Date(now.getTime() + (before - windowMin) * 60000);
    const hi = new Date(now.getTime() + before * 60000);

    const { data: questions, error: qErr } = await admin
      .from('daily_questions')
      .select('id, question_text, lock_time')
      .gt('lock_time', lo.toISOString())
      .lte('lock_time', hi.toISOString());
    if (qErr) return new Response(JSON.stringify({ error: qErr.message }), { status: 500, headers: CORS_HEADERS });
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ reminders: 0, note: 'No question locks in that window.' }), { status: 200, headers: CORS_HEADERS });
    }
    const qIds = questions.map((q: any) => q.id);

    // Only people who turned notifications on AND actually have a device registered.
    const { data: subs } = await admin.from('push_subscriptions').select('user_id');
    const withDevice = Array.from(new Set((subs || []).map((s: any) => s.user_id)));
    if (withDevice.length === 0) {
      return new Response(JSON.stringify({ reminders: 0, questions: questions.length, note: 'Nobody has a push device registered.' }), { status: 200, headers: CORS_HEADERS });
    }
    const { data: profiles } = await admin.from('profiles').select('id').in('id', withDevice).eq('notify_push', true);

    let sent = 0;
    let failed = 0;
    const wouldNotify: any[] = [];
    for (const p of profiles || []) {
      const { data: mine } = await admin.from('predictions').select('question_id').eq('user_id', p.id).in('question_id', qIds);
      const answered = new Set((mine || []).map((m: any) => m.question_id));
      let missing = questions.filter((q: any) => !answered.has(q.id));
      if (missing.length === 0) continue;

      const { data: already } = await admin.from('lock_reminders_sent').select('question_id').eq('user_id', p.id).in('question_id', missing.map((q: any) => q.id));
      const alreadySet = new Set((already || []).map((a: any) => a.question_id));
      missing = missing.filter((q: any) => !alreadySet.has(q.id));
      if (missing.length === 0) continue;

      const soonest = Math.min(...missing.map((q: any) => new Date(q.lock_time).getTime()));
      const mins = Math.max(1, Math.round((soonest - now.getTime()) / 60000));
      const when = mins >= 55 ? 'an hour' : mins + ' minutes';
      const title = missing.length === 1 ? 'A call locks in ' + when : missing.length + ' calls lock in ' + when;
      const first = String(missing[0].question_text || '');
      const bodyText = (first.length > 90 ? first.slice(0, 87) + '...' : first) + ' Make your call before it locks.';

      if (dryRun) {
        wouldNotify.push({ missing: missing.length, title });
        continue;
      }

      const res = await fetch(supabaseUrl + '/functions/v1/send-push', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + serviceRoleKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: p.id, title: title, body: bodyText, url: 'https://playmarqit.com/', tag: 'lock-reminder' })
      }).catch(() => null);
      if (res && res.ok) {
        sent++;
        await admin.from('lock_reminders_sent').upsert(missing.map((q: any) => ({ question_id: q.id, user_id: p.id })), { onConflict: 'question_id,user_id' });
      } else {
        failed++;
      }
    }

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, as_of: now.toISOString(), questions_in_window: questions.length, would_notify: wouldNotify.length, details: wouldNotify }), { status: 200, headers: CORS_HEADERS });
    }
    return new Response(JSON.stringify({ questions_in_window: questions.length, sent, failed }), { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS_HEADERS });
  }
});
