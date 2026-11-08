// streak-reminder: emails anyone whose streak is on the line tonight: a real streak and today's calls not all made.
// People who still have a Streak Freeze get the email too (worded so they know the Freeze would be spent).
// Triggered by Supabase Cron ("Streak reminder", 22:30 UTC = 5:30 PM ET, about 90 minutes before the 7 PM lock).
// Secrets: RESEND_API_KEY. Auth: the cron job sends the service role key.
// TESTING: body {"dry_run": true} counts who would be emailed without sending anything;
//          body {"test_email": "you@example.com"} sends only to that address.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Marqit <noreply@playmarqit.com>';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function buildUnsubscribeUrl(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: token, error } = await admin.rpc('generate_unsubscribe_token', { p_user_id: userId });
  if (error || !token) {
    console.error('generate_unsubscribe_token failed for', userId, error?.message);
    return `https://playmarqit.com/unsubscribe.html?uid=${userId}`;
  }
  return `https://playmarqit.com/unsubscribe.html?uid=${userId}&token=${token}`;
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const authHeader = req.headers.get('Authorization') || '';
    const providedToken = authHeader.replace('Bearer ', '');
    if (providedToken !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Not authorized.' }), { status: 401 });
    }
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY secret is not set.' }), { status: 500 });
    }

    let dryRun = false;
    let testEmail: string | null = null;
    try {
      const b = await req.json();
      if (b && b.dry_run === true) dryRun = true;
      if (b && typeof b.test_email === 'string') testEmail = b.test_email.toLowerCase();
    } catch (_) { /* no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

    const { data: todayQuestions } = await admin.from('daily_questions').select('id').eq('question_date', today);
    if (!todayQuestions || todayQuestions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, note: 'No questions posted today.' }), { status: 200 });
    }
    const todayQuestionIds = todayQuestions.map((q: any) => q.id);

    // Everyone with a real streak, with or without a Freeze.
    const { data: atRiskStreaks } = await admin
      .from('streaks')
      .select('user_id, current_streak, freeze_available')
      .gt('current_streak', 0);

    if (!atRiskStreaks || atRiskStreaks.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0 }), { status: 200 });
    }

    let sent = 0;
    let failed = 0;
    let wouldSend = 0;
    let wouldSendWithFreeze = 0;

    for (const streakRow of atRiskStreaks) {
      const { data: profile } = await admin
        .from('profiles')
        .select('username, notify_on_resolve')
        .eq('id', streakRow.user_id)
        .maybeSingle();
      if (!profile || !profile.notify_on_resolve) continue;

      const { data: myPreds } = await admin
        .from('predictions')
        .select('question_id')
        .eq('user_id', streakRow.user_id)
        .in('question_id', todayQuestionIds);

      const answeredAll = myPreds && myPreds.length >= todayQuestionIds.length;
      if (answeredAll) continue;

      const hasFreeze = streakRow.freeze_available === true;

      if (dryRun) {
        wouldSend++;
        if (hasFreeze) wouldSendWithFreeze++;
        continue;
      }

      const { data: userRes } = await admin.auth.admin.getUserById(streakRow.user_id);
      const email = userRes?.user?.email;
      if (!email) { failed++; continue; }
      if (testEmail && email.toLowerCase() !== testEmail) continue;

      const unsubscribeUrl = await buildUnsubscribeUrl(admin, streakRow.user_id);
      const name = profile.username ? ' ' + esc(profile.username) : '';
      const n = streakRow.current_streak;

      const subject = hasFreeze
        ? `Your ${n}-day streak is on the line tonight`
        : `Your ${n}-day streak ends tonight`;
      const lead = hasFreeze
        ? `Hey${name} — you haven't made today's call yet. Your ${n}-day streak is on the line, and if you miss, your Streak Freeze gets used up to cover it.`
        : `Hey${name} — you haven't made today's call yet, and your ${n}-day streak is on the line.`;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: email,
          subject,
          html: `<p>${lead}</p><p><a href="https://playmarqit.com">Make your call before it locks</a></p><p style="margin-top:24px; font-size:12px; color:#8B8D93;"><a href="${unsubscribeUrl}" style="color:#8B8D93;">Unsubscribe from these emails</a></p>`
        })
      });

      if (emailRes.ok) sent++; else failed++;
    }

    if (dryRun) {
      return new Response(JSON.stringify({ dry_run: true, would_send: wouldSend, of_those_with_freeze: wouldSendWithFreeze }), { status: 200 });
    }
    return new Response(JSON.stringify({ sent, failed }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
