-- Ambassador applications from playmarqit.com/ambassador. Run once in the Supabase SQL editor. Safe to run again.
-- Nobody can read or write the table directly; the page uses submit_ambassador_application() only.
-- You read applications in Supabase: Table Editor > ambassador_applications.
create table if not exists public.ambassador_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  email text not null check (char_length(email) between 5 and 120),
  handle text not null default '' check (char_length(handle) <= 120),
  audience text not null default '' check (char_length(audience) <= 400),
  over_18 boolean not null check (over_18),
  status text not null default 'new'
);
create unique index if not exists ambassador_applications_email_key on public.ambassador_applications (lower(email));
alter table public.ambassador_applications enable row level security;
revoke all on public.ambassador_applications from anon, authenticated;

create or replace function public.submit_ambassador_application(p_name text, p_email text, p_handle text, p_audience text, p_over18 boolean)
returns text language plpgsql security definer set search_path = public as $$
declare n text := btrim(coalesce(p_name, '')); e text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(n) < 1 or char_length(n) > 80 then return 'bad_name'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 120 then return 'bad_email'; end if;
  if not coalesce(p_over18, false) then return 'must_be_18'; end if;
  if (select count(*) from public.ambassador_applications where created_at > now() - interval '1 hour') >= 100 then return 'busy'; end if;
  insert into public.ambassador_applications (name, email, handle, audience, over_18)
    values (n, e, left(btrim(coalesce(p_handle, '')), 120), left(btrim(coalesce(p_audience, '')), 400), true)
    on conflict (lower(email)) do nothing;
  return 'ok';
end $$;
revoke all on function public.submit_ambassador_application(text, text, text, text, boolean) from public;
grant execute on function public.submit_ambassador_application(text, text, text, text, boolean) to anon, authenticated;
