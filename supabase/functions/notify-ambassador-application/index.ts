// notify-ambassador-application: emails the owner when someone applies at playmarqit.com/ambassador.
// Called by a database trigger (service role key as the Authorization header). Body: { id, to }.
// Secrets: RESEND_API_KEY (already set). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatic.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FROM_ADDRESS = 'Marqit <noreply@playmarqit.com>';
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

Deno.serve(async (req: Request) => {
  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (token !== serviceRoleKey) return new Response(JSON.stringify({ error: 'Not authorized.' }), { status: 401 });
    if (!resendApiKey) return new Response(JSON.stringify({ error: 'RESEND_API_KEY secret is not set.' }), { status: 500 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || ''), to = String(body?.to || '');
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return new Response(JSON.stringify({ error: 'bad request' }), { status: 400 });

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceRoleKey);
    const { data: a } = await admin.from('ambassador_applications').select('name, email, handle, audience, created_at').eq('id', id).maybeSingle();
    if (!a) return new Response(JSON.stringify({ error: 'not found' }), { status: 404 });

    const when = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(a.created_at));
    const row = (k: string, v: string) => `<tr><td style="padding:6px 14px 6px 0;color:#6B7280;vertical-align:top;">${k}</td><td style="padding:6px 0;">${esc(v) || '&ndash;'}</td></tr>`;
    const html = `<div style="font-family:sans-serif;max-width:520px;color:#17191D;">
      <p style="font-size:16px;"><b>New Marqit ambassador application</b></p>
      <table style="font-size:15px;border-collapse:collapse;">${row('Name', a.name)}${row('Email', a.email)}${row('Where they would share', a.handle)}${row('Anything else', a.audience)}${row('Applied', when + ' ET')}</table>
      <p style="margin-top:18px;font-size:14px;">Hit reply to write back to them. They are waiting on their personal link or code.</p></div>`;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_ADDRESS, to, reply_to: a.email, subject: `New ambassador application: ${a.name}`, html })
    });
    return new Response(JSON.stringify({ sent: r.ok }), { status: r.ok ? 200 : 502 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
