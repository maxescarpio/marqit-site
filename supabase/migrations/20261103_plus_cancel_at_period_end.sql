-- Marqit+: remember when a member has cancelled but still has time left, so the page can say "ends on <date>" instead of "renews".
-- Run in the Supabase SQL editor BEFORE deploying the matching stripe-webhook and merging the matching plus.js change.
alter table public.marqit_plus_subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
