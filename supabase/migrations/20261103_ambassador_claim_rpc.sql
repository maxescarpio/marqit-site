-- NOT YET APPLIED. Applying this was blocked at approval, so it needs the owner's go-ahead.
-- Lets a signed-in player credit the ambassador whose link brought them in.
-- Only brand-new accounts (created in the last 2 days) can claim, and each player can claim once.
-- Pending and active ambassadors both count, so no signups are lost while an agreement is still being signed;
-- payouts later still require an active ambassador.
create or replace function public.claim_ambassador_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_amb uuid;
  v_created timestamptz;
begin
  if v_uid is null then return false; end if;
  if p_code is null or p_code !~ '^[A-Za-z0-9]{3,20}$' then return false; end if;

  select id into v_amb
  from public.ambassadors
  where code = lower(p_code) and status in ('pending', 'active');
  if v_amb is null then return false; end if;

  select created_at into v_created from public.profiles where id = v_uid;
  if v_created is null or v_created < now() - interval '2 days' then return false; end if;

  insert into public.ambassador_referrals (user_id, ambassador_id, landing_source)
  values (v_uid, v_amb, 'ref_link')
  on conflict (user_id) do nothing;

  return true;
end;
$$;

revoke all on function public.claim_ambassador_code(text) from public, anon;
grant execute on function public.claim_ambassador_code(text) to authenticated;
