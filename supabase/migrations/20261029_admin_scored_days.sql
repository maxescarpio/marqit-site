-- Admin page: which days have had scoring run (public.day_resolutions has no public read policy).
-- Read-only; same admin check as the other admin_* functions.
create or replace function public.admin_scored_days(p_from date, p_to date)
returns table(target_date date)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;
  return query select dr.target_date from public.day_resolutions dr where dr.target_date between p_from and p_to;
end;
$$;
revoke all on function public.admin_scored_days(date, date) from public, anon;
grant execute on function public.admin_scored_days(date, date) to authenticated;
