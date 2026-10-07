-- NOT YET APPLIED. Review before running.
-- Creates the profile + streak row inside the database the moment an account is
-- created, so it no longer depends on the browser finishing the sign-in flow.
-- On any failure it swallows the error so it can never block a signup; the app
-- still falls back to its own client-side profile creation.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uname text;
begin
  uname := coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'user_' || left(new.id::text, 8));
  begin
    insert into public.profiles (id, username, state, age_confirmed, signup_source)
    values (new.id, uname, nullif(new.raw_user_meta_data->>'state', ''), true,
            coalesce(nullif(new.raw_user_meta_data->>'signup_source', ''), 'organic'))
    on conflict (id) do nothing;
  exception when unique_violation then
    -- username already taken by someone else: use a guaranteed-unique variant
    insert into public.profiles (id, username, state, age_confirmed, signup_source)
    values (new.id, uname || '_' || left(new.id::text, 4), nullif(new.raw_user_meta_data->>'state', ''), true,
            coalesce(nullif(new.raw_user_meta_data->>'signup_source', ''), 'organic'))
    on conflict (id) do nothing;
  end;
  insert into public.streaks (user_id) values (new.id) on conflict do nothing;
  return new;
exception when others then
  return new; -- never block account creation
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- One-time backfill for accounts that signed up but never got a profile.
-- Players with the placeholder "user_xxxxxxxx" name are asked to pick a
-- username the next time they open the app (existing behavior).
insert into public.profiles (id, username, state, age_confirmed, signup_source)
select u.id,
       coalesce(nullif(u.raw_user_meta_data->>'username', ''), 'user_' || left(u.id::text, 8)),
       nullif(u.raw_user_meta_data->>'state', ''), true,
       coalesce(nullif(u.raw_user_meta_data->>'signup_source', ''), 'organic')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict do nothing;

insert into public.streaks (user_id)
select p.id from public.profiles p left join public.streaks s on s.user_id = p.id
where s.user_id is null
on conflict do nothing;
