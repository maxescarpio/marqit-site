-- Lets players follow teams from the newer leagues on the Teams tab (college football, college basketball, soccer leagues).
-- Run once in the Supabase SQL editor. Safe to run again.
alter table public.user_team_picks drop constraint if exists user_team_picks_league_check;
alter table public.user_team_picks add constraint user_team_picks_league_check
  check (league in ('nba','nfl','mlb','nhl','wnba','mls','epl','laliga','bundesliga','seriea','ligue1','nwsl','ncaaf','ncaam','ncaaw'));
