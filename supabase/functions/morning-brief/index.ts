// morning-brief: Marqit+ daily email with the history for today's questions.
// Triggered by Supabase Cron (service role key as the Authorization header).
// Secrets: RESEND_API_KEY. Opt-in only (profiles.notify_morning_brief). Sends nothing when
// today has no admin-approved insights. Optional body: { "test_email": "you@example.com" } sends only to that address.
//
// Marqit+ is free for every signed-in player for now. When payments exist, filter the recipient
// list here to paying members (the same rule as is_marqit_plus() in the database).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Marqit <noreply@playmarqit.com>';
const LABELS: Record<string, string> = { sports: 'Sports', pop_culture: 'Pop culture', news: 'News' };

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (token !== serviceRoleKey) return new Response(JSON.stringify({ error: 'Not authorized.' }), { status: 401 });
    if (!resendApiKey) return new Response(JSON.stringify({ error: 'RESEND_API_KEY secret is not set.' }), { status: 500 });

    let testEmail: string | null = null;
    try { const b = await req.json(); if (b && typeof b.test_email === 'string') testEmail = b.test_email.toLowerCase(); } catch (_) { /* no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const todayET = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

    const { data: qs } = await admin.from('daily_questions')
      .select('id, category, question_text, slot, lock_time')
      .eq('question_date', todayET).order('slot', { ascending: true });
    const ids = (qs || []).map((q: any) => q.id);
    if (!ids.length) return new Response(JSON.stringify({ sent: 0, reason: 'no questions today' }), { status: 200 });

    const { data: ins } = await admin.from('question_insights')
      .select('question_id, bullets, lean_yes_pct, lean_basis').eq('status', 'approved').in('question_id', ids);
    const byQ: Record<string, any> = {};
    (ins || []).forEach((r: any) => { byQ[r.question_id] = r; });
    const items = (qs || []).filter((q: any) => byQ[q.id]);
    if (!items.length) return new Response(JSON.stringify({ sent: 0, reason: 'no approved insights today' }), { status: 200 });

    const blocks = items.map((q: any, i: number) => {
      const r = byQ[q.id];
      let lean = '';
      if (r.lean_yes_pct && r.lean_basis) {
        const yes = r.lean_yes_pct;
        const side = yes === 50 ? 'Toss-up' : (yes > 50 ? 'YES ' + yes : 'NO ' + (100 - yes)) + '%';
        lean = `<p style="margin:8px 0 0;font-size:13px;"><b>Lean: ${esc(side)}</b> <span style="color:#4B4E55;">${esc(r.lean_basis)}</span></p>`;
      }
      const lis = (r.bullets || []).map((b: string) => `<li style="margin:4px 0;">${esc(b)}</li>`).join('');
      return `<div style="border:1px solid #E4E3DD;border-radius:12px;padding:14px 16px;margin:14px 0;background:#fff;">
        <div style="font-size:12px;color:#8B8D93;">${i + 1} of ${items.length} · ${esc(LABELS[q.category] || q.category)}</div>
        <div style="font-weight:700;font-size:16px;margin:4px 0 8px;color:#17191D;">${esc(q.question_text)}</div>
        <ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.45;color:#17191D;">${lis}</ul>${lean}</div>`;
    }).join('');

    let query = admin.from('profiles').select('id, username').eq('notify_morning_brief', true);
    const { data: profiles, error: pErr } = await query;
    if (pErr) return new Response(JSON.stringify({ error: pErr.message }), { status: 500 });

    let sent = 0, failed = 0;
    for (const p of profiles || []) {
      const { data: u } = await admin.auth.admin.getUserById(p.id);
      const email = u?.user?.email;
      if (!email) { failed++; continue; }
      if (testEmail && email.toLowerCase() !== testEmail) continue;
      const { data: tok } = await admin.rpc('generate_unsubscribe_token', { p_user_id: p.id });
      const unsub = `https://playmarqit.com/unsubscribe.html?uid=${p.id}&token=${tok || ''}&kind=brief`;
      const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#17191D;">
        <p>Good morning${p.username ? ' ' + esc(p.username) : ''}. Here is the history behind today&rsquo;s calls.</p>${blocks}
        <p><a href="https://playmarqit.com">Make today&rsquo;s calls</a></p>
        <p style="font-size:12px;color:#8B8D93;">Based on historical data, not betting lines. For information only, not betting or financial advice. Marqit+ is always ad-free.</p>
        <p style="margin-top:20px;font-size:12px;color:#8B8D93;"><a href="${unsub}" style="color:#8B8D93;">Unsubscribe from the morning brief</a></p></div>`;
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_ADDRESS, to: email, subject: 'Your Marqit morning brief', html })
      });
      if (r.ok) sent++; else failed++;
    }
    return new Response(JSON.stringify({ sent, failed, date: todayET }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
