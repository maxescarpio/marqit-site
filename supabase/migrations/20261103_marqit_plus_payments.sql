-- NOT YET APPLIED. Marqit+ paid subscriptions (Stripe) and the ambassador $5 payout rules.
-- Everything here is locked to the server: RLS on, and only the player's own subscription row is readable.
-- Payout rule: a credited ambassador earns $5 once per Qualifying Subscriber =
--   first paid payment cleared + still subscribed at day 30 + no refund or chargeback.

-- One row per paying (or formerly paying) player.
create table if not exists public.marqit_plus_subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'incomplete',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marqit_plus_subscriptions enable row level security;
drop policy if exists "own subscription readable" on public.marqit_plus_subscriptions;
create policy "own subscription readable" on public.marqit_plus_subscriptions
  for select to authenticated using (user_id = auth.uid());

-- Every Stripe event we have handled, so a retried event never pays anyone twice.
create table if not exists public.stripe_events (
  event_id text primary key,
  event_type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;

-- First paid payment of a credited player -> a pending $5 payout that becomes eligible 30 days later.
create or replace function public.ambassador_record_first_payment(p_user uuid, p_paid_at timestamptz)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amb uuid;
begin
  select ambassador_id into v_amb from public.ambassador_referrals where user_id = p_user;
  if v_amb is null then return false; end if;
  insert into public.ambassador_payouts (ambassador_id, referred_user_id, status, first_payment_at, eligible_at)
  values (v_amb, p_user, 'pending', p_paid_at, p_paid_at + interval '30 days')
  on conflict (referred_user_id) do nothing;
  return true;
end;
$$;

-- Refund or chargeback -> the payout is void, unless it was already paid out (that one is handled by hand).
create or replace function public.ambassador_void_payout(p_user uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.ambassador_payouts
     set status = 'void', void_reason = p_reason
   where referred_user_id = p_user and status in ('pending', 'eligible');
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

-- Run daily: pending payouts at day 30 become eligible only if the player is still subscribed
-- and the ambassador is active. Anyone who cancelled before day 30 stays pending until voided by hand.
create or replace function public.ambassador_mark_eligible()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  update public.ambassador_payouts p
     set status = 'eligible'
   where p.status = 'pending'
     and p.eligible_at <= now()
     and exists (select 1 from public.marqit_plus_subscriptions s
                  where s.user_id = p.referred_user_id and s.status in ('active', 'trialing'))
     and exists (select 1 from public.ambassadors a where a.id = p.ambassador_id and a.status = 'active');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.ambassador_record_first_payment(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.ambassador_void_payout(uuid, text) from public, anon, authenticated;
revoke all on function public.ambassador_mark_eligible() from public, anon, authenticated;
grant execute on function public.ambassador_record_first_payment(uuid, timestamptz) to service_role;
grant execute on function public.ambassador_void_payout(uuid, text) to service_role;
grant execute on function public.ambassador_mark_eligible() to service_role;
