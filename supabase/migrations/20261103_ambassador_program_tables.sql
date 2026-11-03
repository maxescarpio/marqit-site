-- Ambassador and creator program tables. ALREADY APPLIED to the Marqit database on 2026-11-03.
-- Kept here so the repo matches the database. Locked to the server: RLS on, no policies.
create table if not exists public.ambassadors (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]{3,20}$'),
  name text not null,
  email text,
  school text,
  kind text not null default 'ambassador' check (kind in ('ambassador','creator')),
  status text not null default 'pending' check (status in ('pending','active','paused','ended')),
  agreement_signed_at timestamptz,
  w9_received boolean not null default false,
  payout_method text,
  payout_handle text,
  created_at timestamptz not null default now()
);

create table if not exists public.ambassador_referrals (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  ambassador_id uuid not null references public.ambassadors(id),
  landing_source text,
  captured_at timestamptz not null default now()
);
create index if not exists ambassador_referrals_ambassador_idx on public.ambassador_referrals (ambassador_id);

create table if not exists public.ambassador_payouts (
  id uuid primary key default gen_random_uuid(),
  ambassador_id uuid not null references public.ambassadors(id),
  referred_user_id uuid not null unique references public.profiles(id),
  amount_cents integer not null default 500 check (amount_cents >= 0),
  status text not null default 'pending' check (status in ('pending','eligible','paid','void')),
  first_payment_at timestamptz,
  eligible_at timestamptz,
  paid_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now()
);
create index if not exists ambassador_payouts_ambassador_idx on public.ambassador_payouts (ambassador_id, status);

alter table public.ambassadors enable row level security;
alter table public.ambassador_referrals enable row level security;
alter table public.ambassador_payouts enable row level security;
