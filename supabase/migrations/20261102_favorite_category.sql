-- "My favorite": the category a player wants the site to lead with. Display preference only.
alter table public.profiles
  add column if not exists favorite_category text
  check (favorite_category is null or favorite_category in ('sports','pop_culture','news'));
grant update (favorite_category) on public.profiles to authenticated;
