// create-checkout-session
// A signed-in player asks to subscribe to Marqit+. Returns a Stripe Checkout URL.
// AUTH: the player's own login token. The price is fixed on the server (STRIPE_PRICE_ID), never taken from the browser.
// SECRETS (Supabase function secrets, set by the owner): STRIPE_SECRET_KEY, STRIPE_PRICE_ID. Optional: SITE_URL.

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
  const priceId = Deno.env.get('STRIPE_PRICE_ID');
  if (!stripeKey || !priceId) return json({ error: 'Payments are not set up yet.' }, 503);
  const siteUrl = (Deno.env.get('SITE_URL') || 'https://playmarqit.com').replace(/\/+$/, '');

  const token = (req.headers.get('Authorization') || '').replace('Bearer ', '');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const user = userData?.user;
  if (userErr || !user) return json({ error: 'Please sign in first.' }, 401);

  // Banned accounts cannot subscribe; people who already subscribe are sent to their existing plan.
  const { data: profile } = await admin.from('profiles').select('banned').eq('id', user.id).maybeSingle();
  if (!profile) return json({ error: 'Finish setting up your account first.' }, 400);
  if (profile.banned) return json({ error: 'This account cannot subscribe.' }, 403);
  const { data: existing } = await admin
    .from('marqit_plus_subscriptions').select('status, stripe_customer_id').eq('user_id', user.id).maybeSingle();
  if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
    return json({ error: 'You already have Marqit+.' }, 409);
  }

  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('line_items[0][price]', priceId);
  form.set('line_items[0][quantity]', '1');
  form.set('client_reference_id', user.id);
  form.set('subscription_data[metadata][user_id]', user.id);
  form.set('metadata[user_id]', user.id);
  form.set('success_url', siteUrl + '/?plus=success');
  form.set('cancel_url', siteUrl + '/?plus=cancelled');
  if (existing?.stripe_customer_id) form.set('customer', existing.stripe_customer_id);
  else if (user.email) form.set('customer_email', user.email);

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + stripeKey, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const session = await res.json();
  if (!res.ok || !session.url) {
    console.error('Stripe checkout error', session?.error?.message);
    return json({ error: 'Could not start checkout. Please try again.' }, 502);
  }
  return json({ url: session.url });
});
