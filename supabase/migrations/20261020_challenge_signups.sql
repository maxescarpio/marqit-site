-- Separate Marqit Challenge sign-up: name + email, no site account needed. Applied as migration challenge_signups.
create table if not exists public.challenge_signups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  email text not null check (char_length(email) between 5 and 120),
  user_id uuid references auth.users(id) on delete set null,
  source text,
  created_at timestamptz not null default now()
);
create unique index if not exists challenge_signups_email_key on public.challenge_signups (lower(email));
alter table public.challenge_signups enable row level security;

create or replace function public.challenge_signup(p_name text, p_email text, p_source text default 'challenge_page')
returns text language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_rows int;
begin
  if char_length(v_name) < 1 or char_length(v_name) > 60 then return 'bad_name'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 120 then return 'bad_email'; end if;
  insert into public.challenge_signups (name, email, user_id, source)
  values (v_name, v_email, auth.uid(), left(coalesce(p_source, 'challenge_page'), 40))
  on conflict (lower(email)) do nothing;
  get diagnostics v_rows = row_count;
  return case when v_rows = 1 then 'ok' else 'already' end;
end;
$$;
revoke all on function public.challenge_signup(text, text, text) from public;
grant execute on function public.challenge_signup(text, text, text) to anon, authenticated;

create or replace function public.admin_list_challenge_signups()
returns setof public.challenge_signups language plpgsql security definer set search_path = public as $$
declare caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then raise exception 'Not authorized'; end if;
  return query select * from public.challenge_signups order by created_at desc;
end;
$$;
revoke all on function public.admin_list_challenge_signups() from public, anon;
grant execute on function public.admin_list_challenge_signups() to authenticated;
