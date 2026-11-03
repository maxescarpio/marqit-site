-- Monthly ambassador report (admin only). Run once in the Supabase SQL editor.
-- Read-only report + one function that marks an ambassador's eligible payouts as paid (after you send the money).

create or replace function public.admin_ambassador_report(p_month date default date_trunc('month', now())::date)
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  v_start timestamptz := date_trunc('month', p_month)::timestamptz;
  v_end   timestamptz := (date_trunc('month', p_month) + interval '1 month')::timestamptz;
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(r)::jsonb order by r.owed_cents desc, r.name)
    from (
      select a.id, a.code, a.name, a.email, a.school, a.kind, a.status,
             a.agreement_signed_at is not null as agreement_signed,
             a.w9_received, a.payout_method, a.payout_handle,
             (select count(*) from ambassador_referrals f where f.ambassador_id = a.id) as signups_total,
             (select count(*) from ambassador_referrals f where f.ambassador_id = a.id and f.captured_at >= v_start and f.captured_at < v_end) as signups_month,
             (select count(*) from ambassador_payouts p where p.ambassador_id = a.id and p.first_payment_at >= v_start and p.first_payment_at < v_end) as subscribers_month,
             (select count(*) from ambassador_payouts p where p.ambassador_id = a.id and p.status <> 'void') as subscribers_total,
             (select count(*) from ambassador_payouts p where p.ambassador_id = a.id and p.status = 'pending') as pending_count,
             coalesce((select sum(amount_cents) from ambassador_payouts p where p.ambassador_id = a.id and p.status = 'pending'), 0) as pending_cents,
             (select count(*) from ambassador_payouts p where p.ambassador_id = a.id and p.status = 'eligible') as eligible_count,
             coalesce((select sum(amount_cents) from ambassador_payouts p where p.ambassador_id = a.id and p.status = 'eligible'), 0) as owed_cents,
             coalesce((select sum(amount_cents) from ambassador_payouts p where p.ambassador_id = a.id and p.status = 'paid'), 0) as paid_cents,
             coalesce((select sum(amount_cents) from ambassador_payouts p where p.ambassador_id = a.id and p.status = 'paid' and p.paid_at >= v_start and p.paid_at < v_end), 0) as paid_month_cents,
             (select count(*) from ambassador_payouts p where p.ambassador_id = a.id and p.status = 'void') as void_count
        from ambassadors a
    ) r
  ), '[]'::jsonb);
end $function$;

-- Marks every eligible payout for one ambassador as paid. Refuses unless they are active, signed, W-9 received and owed at least $25.
create or replace function public.admin_mark_ambassador_paid(p_ambassador uuid)
 returns integer language plpgsql security definer set search_path to 'public'
as $function$
declare
  a record;
  v_total integer;
  v_n integer;
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  select * into a from ambassadors where id = p_ambassador;
  if not found then raise exception 'Ambassador not found'; end if;
  if a.status <> 'active' then raise exception 'Ambassador is not active'; end if;
  if a.agreement_signed_at is null then raise exception 'No signed agreement on file'; end if;
  if not a.w9_received then raise exception 'W-9 not received'; end if;
  select coalesce(sum(amount_cents), 0) into v_total from ambassador_payouts where ambassador_id = p_ambassador and status = 'eligible';
  if v_total < 2500 then raise exception 'Owed balance is under the $25 minimum'; end if;
  update ambassador_payouts set status = 'paid', paid_at = now() where ambassador_id = p_ambassador and status = 'eligible';
  get diagnostics v_n = row_count;
  return v_n;
end $function$;

revoke all on function public.admin_ambassador_report(date) from public, anon;
revoke all on function public.admin_mark_ambassador_paid(uuid) from public, anon;
grant execute on function public.admin_ambassador_report(date) to authenticated;
grant execute on function public.admin_mark_ambassador_paid(uuid) to authenticated;
