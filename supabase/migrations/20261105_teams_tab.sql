-- Teams tab: each player picks favorite teams and players, can rename the tab and make it their landing tab.
-- Stored per player; row security means you can only see and change your own rows.
-- Open to every signed-in player for now. To make it Marqit+ only later, run:
--   create or replace function public.mq_teams_open() returns boolean language sql stable as $$ select false $$;
-- and set TEAMS_PLUS_ONLY = true at the top of teams.js. (Nothing else changes.)

create table if not exists public.user_teams_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tab_name text not null default 'Teams' check (char_length(btrim(tab_name)) between 1 and 20 and tab_name !~ '[<>]'),
  make_default boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_team_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('team', 'player')),
  league text not null check (league in ('nba', 'nfl', 'mlb', 'nhl', 'wnba', 'mls', 'epl')),
  espn_id text not null check (espn_id ~ '^[0-9]{1,10}$'),
  name text not null check (char_length(name) between 1 and 80),
  meta text not null default '' check (char_length(meta) <= 80),
  created_at timestamptz not null default now(),
  unique (user_id, kind, league, espn_id)
);
create index if not exists user_team_picks_user_idx on public.user_team_picks (user_id, created_at);

-- Switch for "free for everyone now, Marqit+ only later".
create or replace function public.mq_teams_open()
returns boolean language sql stable as $$ select true $$;

-- At most 25 picks per player.
create or replace function public.mq_team_pick_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.user_team_picks where user_id = new.user_id) >= 25 then
    raise exception 'You can keep up to 25 teams and players.';
  end if;
  return new;
end; $$;
drop trigger if exists user_team_picks_limit on public.user_team_picks;
create trigger user_team_picks_limit before insert on public.user_team_picks
  for each row execute function public.mq_team_pick_limit();

alter table public.user_teams_prefs enable row level security;
alter table public.user_team_picks enable row level security;

drop policy if exists "own prefs read" on public.user_teams_prefs;
drop policy if exists "own prefs write" on public.user_teams_prefs;
drop policy if exists "own prefs update" on public.user_teams_prefs;
create policy "own prefs read" on public.user_teams_prefs for select to authenticated using (user_id = auth.uid());
create policy "own prefs write" on public.user_teams_prefs for insert to authenticated
  with check (user_id = auth.uid() and (public.mq_teams_open() or public.is_marqit_plus()));
create policy "own prefs update" on public.user_teams_prefs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and (public.mq_teams_open() or public.is_marqit_plus()));

drop policy if exists "own picks read" on public.user_team_picks;
drop policy if exists "own picks add" on public.user_team_picks;
drop policy if exists "own picks delete" on public.user_team_picks;
create policy "own picks read" on public.user_team_picks for select to authenticated using (user_id = auth.uid());
create policy "own picks add" on public.user_team_picks for insert to authenticated
  with check (user_id = auth.uid() and (public.mq_teams_open() or public.is_marqit_plus()));
create policy "own picks delete" on public.user_team_picks for delete to authenticated using (user_id = auth.uid());

revoke all on public.user_teams_prefs, public.user_team_picks from anon, authenticated;
grant select, insert, update on public.user_teams_prefs to authenticated;
grant select, insert, delete on public.user_team_picks to authenticated;
revoke all on function public.mq_team_pick_limit() from public, anon, authenticated;
