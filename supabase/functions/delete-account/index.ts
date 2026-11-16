import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const authHeader = req.headers.get('Authorization') ?? '';
    // Who is asking? Taken from their own session token, never from the request body.
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });
    const { data: u, error: uerr } = await asUser.auth.getUser();
    if (uerr || !u?.user) return json({ error: 'not_signed_in' }, 401);
    const id = u.user.id;

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    // Two references block deletion (no cascade); clear them first.
    await admin.from('profiles').update({ referred_by_user_id: null }).eq('referred_by_user_id', id);
    await admin.from('client_errors').update({ user_id: null }).eq('user_id', id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: 'delete_failed', detail: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'server_error' }, 500);
  }
});
