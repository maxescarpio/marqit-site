// create-portal-session
// A signed-in Marqit+ member asks to manage or cancel their subscription. Returns a Stripe Customer Portal URL.
// AUTH: the player's own login token. The customer is looked up on the server from their own subscription row, never taken from the browser.
// SECRETS (Supabase function secrets): STRIPE_SECRET_KEY. Optional: SITE_URL.
// The Stripe Customer Portal must be switched on in Stripe (Settings > Billing > Customer portal), in test mode and in live mode.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) return json({ error: 'Payments are not set up yet.' }, 503);
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://playmarqit.com').replace(/\/+$/, '');

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: 'Please sign in first.' }, 401);

  const { data: sub } = await admin
    .from('marqit_plus_subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (!sub?.stripe_customer_id) return json({ error: 'You do not have a Marqit+ subscription yet.' }, 404);

  const form = new URLSearchParams();
  form.set('customer', sub.stripe_customer_id);
  form.set('return_url', siteUrl + '/?plus=managed');

  const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const session = await res.json();
  if (!res.ok || !session.url) {
    console.error('Stripe portal error', session?.error?.message);
    return json({ error: 'Could not open subscription settings. Please try again, or email help@playmarqit.com.' }, 502);
  }
  return json({ url: session.url });
});
