-- Leagues: private leagues a player can create or join by invite code. Separate from groups (groups stay one-per-person
-- and keep feeding the group-vs-group board). A player can be in up to 10 leagues; a league holds up to 50 players.
-- Free for everyone: create, join, leave, see the season standings and past champions.
-- Marqit+ commissioner tools (the league creator, or whoever inherits it): rename, remove a player, reset the invite code,
-- close the season (records the winner and starts a new one), plus weekly and monthly standings for any member who is Marqit+.
-- Score = correct calls on settled, non-voided questions. No prizes, no money, nothing about entries.
--
-- Everything goes through the functions below. The tables have row security on and NO direct access for anyone.

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  season_start date not null default ((now() at time zone 'America/New_York')::date),
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);
create index if not exists league_members_user_idx on public.league_members (user_id);

create table if not exists public.league_history (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_start date not null,
  season_end date not null,
  winner_user_id uuid references public.profiles(id) on delete set null,
  winner_name text,
  winner_right integer,
  winner_settled integer,
  closed_at timestamptz not null default now()
);
create index if not exists league_history_league_idx on public.league_history (league_id, closed_at desc);

alter table public.leagues enable row level security;
alter table public.league_members enable row level security;
alter table public.league_history enable row level security;
revoke all on public.leagues, public.league_members, public.league_history from anon, authenticated;

-- ---------- helpers ----------
create or replace function public.mq_league_member(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.league_members where league_id = p_league and user_id = auth.uid());
$$;

create or replace function public.mq_league_commissioner(p_league uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.leagues where id = p_league and created_by = auth.uid());
$$;

-- ---------- create / join / leave ----------
create or replace function public.create_league(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
  v_code text;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then raise exception 'Your account has been suspended.'; end if;
  if char_length(v_name) < 2 or char_length(v_name) > 40 then raise exception 'League names are 2 to 40 characters.'; end if;
  if (select count(*) from public.league_members where user_id = uid) >= 10 then raise exception 'You can be in up to 10 leagues.'; end if;
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 10));
    exit when not exists (select 1 from public.leagues where invite_code = v_code);
  end loop;
  insert into public.leagues (name, invite_code, created_by) values (v_name, v_code, uid) returning id into v_id;
  insert into public.league_members (league_id, user_id) values (v_id, uid);
  return v_id;
end; $$;

create or replace function public.join_league(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.profiles where id = uid and banned) then raise exception 'Your account has been suspended.'; end if;
  select id into v_id from public.leagues where invite_code = upper(btrim(coalesce(p_code, '')));
  if v_id is null then raise exception 'No league has that code.'; end if;
  if exists (select 1 from public.league_members where league_id = v_id and user_id = uid) then return v_id; end if;
  if (select count(*) from public.league_members where league_id = v_id) >= 50 then raise exception 'This league is full (50 players).'; end if;
  if (select count(*) from public.league_members where user_id = uid) >= 10 then raise exception 'You can be in up to 10 leagues.'; end if;
  insert into public.league_members (league_id, user_id) values (v_id, uid);
  return v_id;
end; $$;

create or replace function public.leave_league(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Not signed in'; end if;
  delete from public.league_members where league_id = p_league and user_id = uid;
  if not found then return; end if;
  if not exists (select 1 from public.league_members where league_id = p_league) then
    delete from public.leagues where id = p_league;
  elsif exists (select 1 from public.leagues where id = p_league and created_by = uid) then
    update public.leagues set created_by = (select user_id from public.league_members where league_id = p_league order by joined_at limit 1)
    where id = p_league;
  end if;
end; $$;

-- ---------- reading ----------
create or replace function public.my_leagues()
returns table (id uuid, name text, invite_code text, member_count integer, is_commissioner boolean, season_start date)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.invite_code,
         (select count(*)::int from public.league_members x where x.league_id = l.id),
         (l.created_by = auth.uid()),
         l.season_start
  from public.leagues l
  join public.league_members m on m.league_id = l.id and m.user_id = auth.uid()
  order by m.joined_at;
$$;

-- p_period: 'season' (free) | 'week' = last 7 days | 'month' = this calendar month (both Marqit+).
create or replace function public.league_standings(p_league uuid, p_period text default 'season')
returns table (user_id uuid, username text, avatar_emoji text, calls integer, right_calls integer, pct integer, is_commissioner boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/New_York')::date;
  v_from date;
  v_start date;
begin
  if not public.mq_league_member(p_league) then raise exception 'You are not in this league.'; end if;
  select season_start into v_start from public.leagues where id = p_league;
  if p_period = 'week' then v_from := v_today - 6;
  elsif p_period = 'month' then v_from := date_trunc('month', v_today)::date;
  else v_from := v_start; end if;
  if p_period in ('week', 'month') and not public.is_marqit_plus() then
    raise exception 'Weekly and monthly standings are part of Marqit+.';
  end if;
  return query
    select m.user_id,
           coalesce(pr.username, 'Player'),
           pr.avatar_emoji,
           count(q.id)::int,
           (count(q.id) filter (where p.choice = q.correct_answer))::int,
           case when count(q.id) = 0 then 0 else round(100.0 * count(q.id) filter (where p.choice = q.correct_answer) / count(q.id))::int end,
           (l.created_by = m.user_id)
    from public.league_members m
    join public.leagues l on l.id = m.league_id
    join public.profiles pr on pr.id = m.user_id
    left join public.predictions p on p.user_id = m.user_id
    left join public.daily_questions q on q.id = p.question_id
         and q.question_date >= v_from and q.question_date <= v_today
         and q.resolved and coalesce(q.voided, false) = false and q.correct_answer in ('yes', 'no')
    where m.league_id = p_league
    group by m.user_id, pr.username, pr.avatar_emoji, l.created_by
    order by 5 desc, 6 desc, 4 desc, 2 asc;
end; $$;

create or replace function public.league_history(p_league uuid)
returns table (season_start date, season_end date, winner_name text, winner_right integer, winner_settled integer)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mq_league_member(p_league) then raise exception 'You are not in this league.'; end if;
  return query
    select h.season_start, h.season_end, h.winner_name, h.winner_right, h.winner_settled
    from public.league_history h where h.league_id = p_league order by h.closed_at desc limit 50;
end; $$;

-- ---------- commissioner tools (Marqit+) ----------
create or replace function public.mq_league_commissioner_plus(p_league uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.mq_league_commissioner(p_league) then raise exception 'Only the league commissioner can do that.'; end if;
  if not public.is_marqit_plus() then raise exception 'Commissioner tools are part of Marqit+.'; end if;
end; $$;

create or replace function public.league_rename(p_league uuid, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := btrim(coalesce(p_name, ''));
begin
  perform public.mq_league_commissioner_plus(p_league);
  if char_length(v_name) < 2 or char_length(v_name) > 40 then raise exception 'League names are 2 to 40 characters.'; end if;
  update public.leagues set name = v_name where id = p_league;
end; $$;

create or replace function public.league_remove_member(p_league uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.mq_league_commissioner_plus(p_league);
  if p_user = auth.uid() then raise exception 'Use Leave league to remove yourself.'; end if;
  delete from public.league_members where league_id = p_league and user_id = p_user;
end; $$;

create or replace function public.league_reset_code(p_league uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  perform public.mq_league_commissioner_plus(p_league);
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 10));
    exit when not exists (select 1 from public.leagues where invite_code = v_code);
  end loop;
  update public.leagues set invite_code = v_code where id = p_league;
  return v_code;
end; $$;

-- Records the current leader as the season winner (if anyone has a settled call) and starts a fresh season today.
create or replace function public.league_close_season(p_league uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'America/New_York')::date;
  v_start date;
  w record;
begin
  perform public.mq_league_commissioner_plus(p_league);
  select season_start into v_start from public.leagues where id = p_league;
  select * into w from public.league_standings(p_league, 'season') s order by s.right_calls desc, s.pct desc, s.calls desc limit 1;
  insert into public.league_history (league_id, season_start, season_end, winner_user_id, winner_name, winner_right, winner_settled)
  values (p_league, v_start, v_today,
          case when w.calls > 0 then w.user_id end,
          case when w.calls > 0 then w.username end,
          case when w.calls > 0 then w.right_calls end,
          case when w.calls > 0 then w.calls end);
  update public.leagues set season_start = v_today where id = p_league;
end; $$;

-- ---------- permissions: signed-in players only ----------
revoke all on function public.mq_league_member(uuid), public.mq_league_commissioner(uuid), public.mq_league_commissioner_plus(uuid),
  public.create_league(text), public.join_league(text), public.leave_league(uuid), public.my_leagues(),
  public.league_standings(uuid, text), public.league_history(uuid), public.league_rename(uuid, text),
  public.league_remove_member(uuid, uuid), public.league_reset_code(uuid), public.league_close_season(uuid)
  from public, anon;
grant execute on function public.create_league(text), public.join_league(text), public.leave_league(uuid), public.my_leagues(),
  public.league_standings(uuid, text), public.league_history(uuid), public.league_rename(uuid, text),
  public.league_remove_member(uuid, uuid), public.league_reset_code(uuid), public.league_close_season(uuid)
  to authenticated;
-- The three helpers stay callable only from inside the other functions.
