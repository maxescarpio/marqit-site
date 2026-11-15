-- Campus boards: players can add their campus, and the Big Board gets a "Campus" view
-- plus a campus-vs-campus ranking.
--
-- profiles.school already exists (it was left unused when Greek-life features were removed
-- from groups). It is free text, so names are matched case-insensitively with spaces trimmed:
-- "UMD", "umd " and "Umd" are one campus. "UMD" and "University of Maryland" are NOT merged;
-- once the first campuses are known we can add a canonical list.
--
-- Nothing here changes scoring or the leaderboards that exist today.

begin;

alter table public.profiles add column if not exists school text;

-- Keep stored values tidy: trimmed, single spaces, max 60 chars; blank becomes null.
create or replace function public.profiles_clean_school()
returns trigger
language plpgsql
as $$
begin
  if new.school is not null then
    new.school := nullif(left(regexp_replace(btrim(new.school), '\s+', ' ', 'g'), 60), '');
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_clean_school on public.profiles;
create trigger profiles_clean_school
  before insert or update of school on public.profiles
  for each row execute function public.profiles_clean_school();

-- Top players on one campus. Same rules as state_top_players: hidden and banned players are left out.
create or replace function public.school_top_players(p_school text, p_limit integer default 5)
returns table(user_id uuid, username text, avatar_emoji text, avatar_color text, total_points bigint, current_streak integer)
language sql
stable
set search_path to 'public'
as $$
  select s.user_id, p.username::text, p.avatar_emoji::text, p.avatar_color::text,
         coalesce(s.total_points, 0)::bigint, coalesce(s.current_streak, 0)::int
  from streaks s
  join profiles p on p.id = s.user_id
  where lower(btrim(p.school)) = lower(btrim(p_school))
    and p.hide_from_leaderboard = false
    and p.banned = false
  order by coalesce(s.total_points, 0) desc, s.user_id
  limit greatest(1, least(coalesce(p_limit, 5), 50))
$$;

-- Campus vs campus: total points of visible players, only for campuses with enough players
-- to be a fair fight (default 3).
create or replace function public.top_schools(p_limit integer default 10, p_min_players integer default 3)
returns table(school text, players bigint, total_points bigint)
language sql
stable
set search_path to 'public'
as $$
  select mode() within group (order by btrim(p.school))::text as school,
         count(*)::bigint as players,
         coalesce(sum(s.total_points), 0)::bigint as total_points
  from profiles p
  left join streaks s on s.user_id = p.id
  where p.school is not null
    and p.hide_from_leaderboard = false
    and p.banned = false
  group by lower(btrim(p.school))
  having count(*) >= greatest(coalesce(p_min_players, 3), 1)
  order by 3 desc, 2 desc
  limit greatest(1, least(coalesce(p_limit, 10), 50))
$$;

grant execute on function public.school_top_players(text, integer) to anon, authenticated;
grant execute on function public.top_schools(integer, integer) to anon, authenticated;

commit;
