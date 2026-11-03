-- LAUNCH DAY ONLY. Do NOT run this until Stripe is live and PAID_LIVE is about to be switched on.
-- Until then Marqit+ is free for every signed-in player (is_marqit_plus() = signed in).
--
-- After this runs, every database-side Marqit+ perk (history & lean, similar questions, results explained, full archive,
-- weekly reports, insight reads) follows automatically, because they all call is_marqit_plus().
-- A member = a subscription row that is active, trialing or past_due (past_due = card failed, Stripe is retrying; we give a short grace).
-- To give someone free access (a comp), insert a row for them in marqit_plus_subscriptions with status 'active'.

create or replace function public.is_marqit_plus()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.marqit_plus_subscriptions s
    where s.user_id = auth.uid()
      and s.status in ('active', 'trialing', 'past_due')
  );
$$;
revoke all on function public.is_marqit_plus() from public, anon;
grant execute on function public.is_marqit_plus() to authenticated;

-- ROLLBACK (puts it back to "free for every signed-in player"):
-- create or replace function public.is_marqit_plus()
-- returns boolean language sql stable security definer set search_path = public as $$
--   select auth.uid() is not null;
-- $$;
