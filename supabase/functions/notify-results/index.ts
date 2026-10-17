// notify-results: sends the "your results are in" email to opted-in players who played that day.
// Triggered by a database trigger on day_resolutions, or by the admin account.
// Secrets: RESEND_API_KEY (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatic).
//
// Voided questions (e.g. a postponed game) show as "Void" with the admin's reason and are
// left out of the "X/Y" score: nobody gets them right or wrong.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ADMIN_EMAIL = 'maxescarpio3@gmail.com';
const FROM_ADDRESS = 'Marqit <noreply@playmarqit.com>';

const CATEGORY_LABELS: Record<string, string> = {
  sports: 'Sports',
  pop_culture: 'Pop culture',
  news: 'News'
};

const BRAND = {
  orange: '#F6C430',
  green: '#33D18B',
  red: '#F5644F',
  blue: '#4A6CFA',
  ink: '#17191D'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Results usually go out the morning after a day is played, so the wording follows the date.
function dayLabel(targetDate: string): { when: string; pretty: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });
  const todayET = fmt.format(new Date());
  const yesterdayET = fmt.format(new Date(Date.now() - 86400000));
  const pretty = new Date(targetDate + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const when = targetDate === todayET ? 'today' : targetDate === yesterdayET ? 'yesterday' : 'on ' + pretty;
  return { when, pretty };
}

async function buildUnsubscribeUrl(admin: ReturnType<typeof createClient>, userId: string): Promise<string> {
  const { data: token, error } = await admin.rpc('generate_unsubscribe_token', { p_user_id: userId });
  if (error || !token) {
    console.error('generate_unsubscribe_token failed for', userId, error?.message);
    return `https://playmarqit.com/unsubscribe.html?uid=${userId}`;
  }
  return `https://playmarqit.com/unsubscribe.html?uid=${userId}&token=${token}`;
}

function resultRow(label: string, mark: 'Correct' | 'Missed' | 'Pending' | 'Void', note?: string): string {
  const styles: Record<string, { bg: string; fg: string }> = {
    Correct: { bg: '#E4F9EF', fg: '#1B8F5A' },
    Missed: { bg: '#FDEAE8', fg: '#C23B2A' },
    Pending: { bg: '#F1F1EE', fg: '#8B8D93' },
    Void: { bg: '#F1F1EE', fg: '#6B6E75' }
  };
  const s = styles[mark];
  const noteRow = note
    ? `
      <tr>
        <td colspan="2" style="font-family:sans-serif; font-size:12px; color:#8B8D93; padding:0 0 6px;">${escapeHtml(note)}</td>
      </tr>`
    : '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0;">
      <tr>
        <td style="font-family:sans-serif; font-size:14px; color:${BRAND.ink}; padding:6px 0;">${label}</td>
        <td align="right" style="padding:6px 0;">
          <span style="display:inline-block; font-family:sans-serif; font-size:12px; font-weight:700; letter-spacing:0.2px; padding:3px 12px; border-radius:999px; background:${s.bg}; color:${s.fg};">${mark}</span>
        </td>
      </tr>${noteRow}
    </table>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '');

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY secret is not set.' }), { status: 500, headers: CORS_HEADERS });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Authorized two ways: the service role key as bearer, or signed in as the admin account.
    let authorized = token === serviceRoleKey;
    if (!authorized) {
      const { data: callerRes } = await admin.auth.getUser(token);
      authorized = callerRes?.user?.email === ADMIN_EMAIL;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), { status: 401, headers: CORS_HEADERS });
    }

    const body = await req.json().catch(() => ({}));
    if (!body.target_date) {
      return new Response(JSON.stringify({ error: 'target_date is required.' }), { status: 400, headers: CORS_HEADERS });
    }
    const targetDate = body.target_date;
    const { when, pretty } = dayLabel(targetDate);
    // test_email: if set, sends ONLY to this address (ignores notify_on_resolve).
    const testEmail: string | null = typeof body.test_email === 'string' ? body.test_email.toLowerCase() : null;

    let profiles: { id: string; username: string | null }[] | null = null;
    if (testEmail) {
      const { data: allProfiles, error: profilesError } = await admin.from('profiles').select('id, username');
      if (profilesError) {
        return new Response(JSON.stringify({ error: profilesError.message }), { status: 500, headers: CORS_HEADERS });
      }
      const matches: { id: string; username: string | null }[] = [];
      for (const p of allProfiles || []) {
        const { data: userRes } = await admin.auth.admin.getUserById(p.id);
        if (userRes?.user?.email?.toLowerCase() === testEmail) { matches.push(p); break; }
      }
      profiles = matches;
    } else {
      const { data: optedIn, error: profilesError } = await admin
        .from('profiles')
        .select('id, username')
        .eq('notify_on_resolve', true);
      if (profilesError) {
        return new Response(JSON.stringify({ error: profilesError.message }), { status: 500, headers: CORS_HEADERS });
      }
      profiles = optedIn;
    }

    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ sent: 0, failed: 0 }), { status: 200, headers: CORS_HEADERS });
    }

    let sent = 0;
    let failed = 0;

    for (const profile of profiles) {
      const { data: userRes } = await admin.auth.admin.getUserById(profile.id);
      const email = userRes?.user?.email;
      if (!email) { failed++; continue; }

      const { data: preds } = await admin
        .from('predictions')
        .select('choice, daily_questions!inner(category, correct_answer, resolved, voided, void_reason, question_date)')
        .eq('user_id', profile.id)
        .eq('daily_questions.question_date', targetDate);

      const { data: streakRow } = await admin
        .from('streaks')
        .select('current_streak, total_points')
        .eq('user_id', profile.id)
        .maybeSingle();

      const rows = (preds || []) as any[];
      // Voided questions are neither right nor wrong, so they stay out of the X/Y score.
      const scoredRows = rows.filter((p) => !p.daily_questions.voided);
      const total = scoredRows.length;
      const correct = scoredRows.filter((p) => p.daily_questions.resolved && p.choice === p.daily_questions.correct_answer).length;

      // Players who made no picks that day get no email. A test_email preview is always sent.
      if (rows.length === 0 && !testEmail) continue;

      const resultLine = total > 0
        ? `You called it ${correct}/${total} ${when}.`
        : `Your results are in.`;

      const breakdown = rows.map((p) => {
        const label = CATEGORY_LABELS[p.daily_questions.category] || p.daily_questions.category;
        if (p.daily_questions.voided) {
          const why = p.daily_questions.void_reason || 'This question was voided.';
          return resultRow(label, 'Void', `${why} No points either way.`);
        }
        const wasCorrect = p.daily_questions.resolved && p.choice === p.daily_questions.correct_answer;
        const mark: 'Correct' | 'Missed' | 'Pending' = p.daily_questions.resolved ? (wasCorrect ? 'Correct' : 'Missed') : 'Pending';
        return resultRow(label, mark);
      }).join('');

      const unsubscribeUrl = await buildUnsubscribeUrl(admin, profile.id);

      const streakCount = streakRow ? streakRow.current_streak : 0;
      const points = streakRow ? streakRow.total_points.toLocaleString() : '0';

      const html = `
        <div style="background:#F6F6F2; padding:24px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:400px; margin:0 auto;">
            <tr>
              <td>
                <p style="font-family:sans-serif; font-size:16px; color:${BRAND.ink}; margin:0 0 16px;">Hey${profile.username ? ' ' + profile.username : ''} — ${resultLine}</p>

                <div style="background:#FFFFFF; border:1px solid #E4E3DD; border-radius:16px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                  <div style="background:linear-gradient(90deg, ${BRAND.orange}, ${BRAND.red}); padding:16px 20px;">
                    <div style="font-family:sans-serif; font-weight:800; font-size:18px; color:#FFFFFF;">Marqit &middot; ${pretty}</div>
                    <div style="margin-top:4px; font-family:sans-serif; font-size:13px; color:#FFFFFF; opacity:0.95;">🔥 ${streakCount}-day streak &middot; ${points} pts</div>
                  </div>
                  <div style="padding:14px 20px 18px;">
                    ${breakdown || '<span style="font-family:sans-serif; font-size:13px; color:#8B8D93;">No calls made.</span>'}
                  </div>
                </div>

                <p style="margin-top:20px; text-align:center;">
                  <a href="https://playmarqit.com" style="display:inline-block; font-family:sans-serif; font-weight:700; font-size:14px; color:#FFFFFF; background:${BRAND.blue}; padding:10px 20px; border-radius:999px; text-decoration:none;">See it live &amp; share your card</a>
                </p>

                <p style="margin-top:28px; font-family:sans-serif; font-size:12px; color:#8B8D93; text-align:center;"><a href="${unsubscribeUrl}" style="color:#8B8D93;">Unsubscribe from these emails</a></p>
              </td>
            </tr>
          </table>
        </div>
      `;

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: FROM_ADDRESS,
          to: email,
          subject: total > 0 ? `You called it ${correct}/${total} ${when}` : 'Your results are in',
          html: html
        })
      });

      if (emailRes.ok) sent++; else failed++;
    }

    return new Response(JSON.stringify({ sent, failed }), { status: 200, headers: CORS_HEADERS });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: CORS_HEADERS });
  }
});
