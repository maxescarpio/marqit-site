-- NOT YET APPLIED. Run in the Supabase SQL editor after review.
-- Usernames never contain spaces. This closes up every existing username that has one
-- ("David Torres" -> "DavidTorres"). If the closed-up name is already taken (any capitalization),
-- a number is added to the end so the unique index on lower(username) still holds.
-- Then it adds a rule so a space can never be saved again.
do $$
declare
  r record;
  base text;
  candidate text;
  n int;
begin
  for r in select id, username from public.profiles where username ~ '\s' loop
    base := regexp_replace(r.username, '\s+', '', 'g');
    if base = '' then base := 'player'; end if;
    candidate := base;
    n := 1;
    while exists (select 1 from public.profiles p where lower(p.username) = lower(candidate) and p.id <> r.id) loop
      n := n + 1;
      candidate := left(base, 24 - length(n::text)) || n::text;
    end loop;
    update public.profiles set username = candidate where id = r.id;
  end loop;
end $$;

alter table public.profiles
  drop constraint if exists profiles_username_no_spaces;
alter table public.profiles
  add constraint profiles_username_no_spaces check (username !~ '\s');
