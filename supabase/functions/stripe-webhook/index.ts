// stripe-webhook
// Stripe calls this when something happens to a Marqit+ subscription. It keeps the subscription row up to date and
// drives the ambassador $5 payout:
//   first paid invoice          -> pending payout (eligible 30 days later)
//   refund / chargeback         -> payout voided
//   subscription ended/updated  -> status kept in sync (the daily job pays out only while still subscribed)
//
// AUTH: Stripe's signature (STRIPE_WEBHOOK_SECRET). Deploy with JWT verification OFF; the signature is the lock.
// Each Stripe event is handled once (stripe_events), so a retry never pays anyone twice.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const enc = new TextEncoder();

async function verifySignature(payload: string, header: string, secret: string): Promise<boolean> {
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find((p) => p[0] === 't')?.[1];
  const sigs = parts.filter((p) => p[0] === 'v1').map((p) => p[1]);
  if (!t || sigs.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // older than 5 minutes: reject
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(t + '.' + payload)));
  const expected = Array.from(mac).map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => s.length === expected.length && timingSafeEqual(s, expected));
}
function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const iso = (unix?: number | null) => (unix ? new Date(unix * 1000).toISOString() : null);

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!secret || !stripeKey) return new Response('Not configured', { status: 503 });

  const payload = await req.text();
  const ok = await verifySignature(payload, req.headers.get('Stripe-Signature') || '', secret);
  if (!ok) return new Response('Bad signature', { status: 400 });

  const event = JSON.parse(payload);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Handle each event only once.
  const { error: dupErr } = await admin.from('stripe_events').insert({ event_id: event.id, event_type: event.type });
  if (dupErr) {
    if (dupErr.code === '23505') return new Response('Already handled', { status: 200 });
    console.error('stripe_events insert failed', dupErr.message);
    return new Response('Error', { status: 500 });
  }

  async function stripeGet(path: string) {
    const r = await fetch('https://api.stripe.com/v1/' + path, { headers: { Authorization: 'Bearer ' + stripeKey } });
    return r.ok ? await r.json() : null;
  }
  async function userByCustomer(customerId?: string | null): Promise<string | null> {
    if (!customerId) return null;
    const { data } = await admin.from('marqit_plus_subscriptions').select('user_id').eq('stripe_customer_id', customerId).maybeSingle();
    return data?.user_id ?? null;
  }
  async function saveSubscription(userId: string, patch: Record<string, unknown>) {
    const { error } = await admin
      .from('marqit_plus_subscriptions')
      .upsert({ user_id: userId, updated_at: new Date().toISOString(), ...patch }, { onConflict: 'user_id' });
    if (error) throw new Error('subscription save failed: ' + error.message);
  }

  try {
    const obj = event.data.object;

    if (event.type === 'checkout.session.completed') {
      const userId = obj.client_reference_id || obj.metadata?.user_id;
      if (userId && obj.mode === 'subscription') {
        await saveSubscription(userId, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.subscription,
          status: 'active'
        });
      }
    } else if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const userId = obj.metadata?.user_id || (await userByCustomer(obj.customer));
      if (userId) {
        const periodEnd = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
        await saveSubscription(userId, {
          stripe_customer_id: obj.customer,
          stripe_subscription_id: obj.id,
          status: event.type === 'customer.subscription.deleted' ? 'canceled' : obj.status,
          current_period_end: iso(periodEnd)
        });
      }
    } else if (event.type === 'invoice.paid') {
      // Only the very first paid invoice of a subscription counts toward an ambassador's $5.
      if (obj.billing_reason === 'subscription_create' && (obj.amount_paid ?? 0) > 0) {
        const subId = obj.subscription || obj.parent?.subscription_details?.subscription;
        let userId: string | null =
          obj.subscription_details?.metadata?.user_id || obj.parent?.subscription_details?.metadata?.user_id || null;
        if (!userId && subId) userId = (await stripeGet('subscriptions/' + subId))?.metadata?.user_id ?? null;
        if (!userId) userId = await userByCustomer(obj.customer);
        if (!userId) throw new Error('invoice.paid: could not tell which player this belongs to');
        const paidAt = iso(obj.status_transitions?.paid_at) || new Date().toISOString();
        const { error } = await admin.rpc('ambassador_record_first_payment', { p_user: userId, p_paid_at: paidAt });
        if (error) throw new Error('record_first_payment failed: ' + error.message);
      }
    } else if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
      // A refund or a chargeback voids the ambassador's payout if it has not been paid yet.
      let customerId: string | null = obj.customer || null;
      if (!customerId && event.type === 'charge.dispute.created' && obj.charge) customerId = (await stripeGet('charges/' + obj.charge))?.customer ?? null;
      const userId = await userByCustomer(customerId);
      if (userId) {
        const { error } = await admin.rpc('ambassador_void_payout', {
          p_user: userId,
          p_reason: event.type === 'charge.refunded' ? 'refund' : 'chargeback'
        });
        if (error) throw new Error('void_payout failed: ' + error.message);
      }
    }
    return new Response('ok', { status: 200 });
  } catch (e) {
    // Let Stripe retry: forget that we saw this event.
    console.error('stripe-webhook failed', event.type, (e as Error).message);
    await admin.from('stripe_events').delete().eq('event_id', event.id);
    return new Response('Error', { status: 500 });
  }
});
