// friend-activity-push: ONE push a day that carries real news instead of "don't forget":
// a rival or buddy has already made today's calls. Never says which side anyone picked.
// Only goes to people with notifications on who haven't made all of today's calls yet,
// and only if at least one rival/buddy has played. Nothing is sent otherwise.
// Triggered by Supabase Cron ("Friend activity push", 17:30 UTC = 12:30 PM ET).
// Auth: the cron job sends the service role key.
// TESTING: body {"dry_run": true} returns who would be notified and the text, sends nothing.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const providedToken = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (providedToken !== serviceRoleKey) {
      return new Response(JSON.stringify({ error: 'Not authorized.' }), { status: 401 });
    }

    let dryRun = false;
    try { const b = await req.json(); if (b && b.dry_run === true) dryRun = true; } catch (_) { /* no body */ }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

    const { data: qs } = await admin.from('daily_questions').select('id').eq('question_date', today);
    const qIds = (qs || []).map((q: any) => q.id);
    if (qIds.length === 0) return new Response(JSON.stringify({ sent: 0, note: 'No questions today.' }), { status: 200 });

    // Everyone who has made at least one call today, and how many.
    const { data: preds } = await admin.from('predictions').select('user_id, question_id').in('question_id', qIds);
    const countBy = new Map<string, number>();
    for (const p of preds || []) countBy.set(p.user_id, (countBy.get(p.user_id) || 0) + 1);
    const played = new Set(countBy.keys());

    // People with push on who still have calls to make.
    const { data: pushUsers } = await admin.from('profiles').select('id, username').eq('notify_push', true);
    const targets = (pushUsers || []).filter((u: any) => (countBy.get(u.id) || 0) < qIds.length);
    if (targets.length === 0) return new Response(JSON.stringify({ sent: 0, note: 'No one to notify.' }), { status: 200 });
    const targetIds = targets.map((t: any) => t.id);

    const { data: rivals } = await admin.from('rivals').select('user_id, rival_id').in('user_id', targetIds);
    const { data: buddiesA } = await admin.from('buddies').select('user_id, buddy_id').in('user_id', targetIds);
    const { data: buddiesB } = await admin.from('buddies').select('user_id, buddy_id').in('buddy_id', targetIds);

    const rivalsOf = new Map<string, string[]>();
    for (const r of rivals || []) rivalsOf.set(r.user_id, [...(rivalsOf.get(r.user_id) || []), r.rival_id]);
    const buddiesOf = new Map<string, Set<string>>();
    const addBuddy = (a: string, b: string) => { if (!buddiesOf.has(a)) buddiesOf.set(a, new Set()); buddiesOf.get(a)!.add(b); };
    for (const b of buddiesA || []) addBuddy(b.user_id, b.buddy_id);
    for (const b of buddiesB || []) addBuddy(b.buddy_id, b.user_id);

    // Usernames for any rival we might name.
    const rivalIds = Array.from(new Set((rivals || []).map((r: any) => r.rival_id)));
    const nameOf = new Map<string, string>();
    if (rivalIds.length) {
      const { data: names } = await admin.from('profiles').select('id, username').in('id', rivalIds);
      for (const n of names || []) nameOf.set(n.id, n.username);
    }

    let sent = 0, failed = 0;
    const preview: any[] = [];
    for (const t of targets) {
      const playedRivals = (rivalsOf.get(t.id) || []).filter((id) => played.has(id));
      const playedBuddies = Array.from(buddiesOf.get(t.id) || []).filter((id) => played.has(id) && id !== t.id);

      let title = '', body = '';
      if (playedRivals.length > 0) {
        const nm = nameOf.get(playedRivals[0]);
        title = nm ? `${nm} already made today's calls` : 'Your rival already made today\'s calls';
        body = 'Your turn. Make yours before they lock.';
      } else if (playedBuddies.length > 0) {
        const n = playedBuddies.length;
        title = n === 1 ? '1 of your buddies already played today' : `${n} of your buddies already played today`;
        body = 'Make your calls before they lock.';
      } else {
        continue; // nothing real to say, so say nothing
      }

      if (dryRun) { preview.push({ user: t.username, title, body }); continue; }

      const res = await fetch(supabaseUrl + '/functions/v1/send-push', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + serviceRoleKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: t.id, title, body, url: 'https://playmarqit.com/', tag: 'friend-activity' })
      }).catch(() => null);
      if (res && res.ok) sent++; else failed++;
    }

    if (dryRun) return new Response(JSON.stringify({ dry_run: true, would_send: preview.length, preview }), { status: 200 });
    return new Response(JSON.stringify({ sent, failed }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
