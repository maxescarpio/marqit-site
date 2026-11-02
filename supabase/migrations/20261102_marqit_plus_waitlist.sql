-- Marqit+ waitlist: signed-in players can raise their hand for the paid plan. Demand test only.
create table if not exists public.marqit_plus_waitlist (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.marqit_plus_waitlist enable row level security;

drop policy if exists "Players read own waitlist row" on public.marqit_plus_waitlist;
create policy "Players read own waitlist row" on public.marqit_plus_waitlist
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Players join the waitlist" on public.marqit_plus_waitlist;
create policy "Players join the waitlist" on public.marqit_plus_waitlist
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Players leave the waitlist" on public.marqit_plus_waitlist;
create policy "Players leave the waitlist" on public.marqit_plus_waitlist
  for delete to authenticated using (user_id = auth.uid());

-- Admin: how many people want it.
create or replace function public.admin_marqit_plus_waitlist_count()
returns integer language plpgsql security definer set search_path = public as $$
declare caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then raise exception 'Not authorized'; end if;
  return (select count(*)::integer from public.marqit_plus_waitlist);
end;
$$;
revoke all on function public.admin_marqit_plus_waitlist_count() from public, anon;
grant execute on function public.admin_marqit_plus_waitlist_count() to authenticated;
