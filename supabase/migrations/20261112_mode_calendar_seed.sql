-- Nov 12: fill the Schedule for the News and Pop culture modes.
-- Every date below was checked against its source: BLS release schedule (JOLTS, PPI), the Federal Reserve calendar
-- (FOMC Dec 8-9, minutes Dec 30), Nvidia's investor page (Q3 earnings Nov 17), Box Office Mojo and GamesRadar
-- (movie release dates). Thanksgiving is the 4th Thursday of November (Nov 26, 2026).
-- Rows use source 'curated' like the existing hand-added events, and can be removed in the admin page.

insert into public.key_events (category, title, subtitle, league, starts_at, all_day, importance, status, url, source, external_id)
values
  -- news and money
  ('finance', 'Nvidia earnings', 'Third quarter results', 'NVDA', '2026-11-17T12:00:00Z', true, 2, 'scheduled', null, 'curated', 'earn-nvda-2026-11-17'),
  ('finance', 'Home Depot earnings', 'Third quarter results', 'HD', '2026-11-17T12:00:00Z', true, 1, 'scheduled', null, 'curated', 'earn-hd-2026-11-17'),
  ('news', 'Thanksgiving', 'Banks and markets closed', 'Holiday', '2026-11-26T12:00:00Z', true, 2, 'scheduled', null, 'curated', 'holiday-thanksgiving-2026'),
  ('news', 'Black Friday', 'The biggest shopping day of the year', 'Holiday', '2026-11-27T12:00:00Z', true, 2, 'scheduled', null, 'curated', 'holiday-black-friday-2026'),
  ('news', 'Cyber Monday', 'Online holiday deals', 'Holiday', '2026-11-30T12:00:00Z', true, 1, 'scheduled', null, 'curated', 'holiday-cyber-monday-2026'),
  ('finance', 'Job openings (JOLTS)', 'October report, 10:00 AM ET', 'Jobs', '2026-12-01T15:00:00Z', false, 1, 'scheduled', null, 'curated', 'bls-jolts-2026-12-01'),
  ('finance', 'Fed meeting begins', 'Two-day FOMC meeting, decision Dec 9', 'Fed', '2026-12-08T12:00:00Z', true, 1, 'scheduled', null, 'curated', 'fed-fomc-start-2026-12-08'),
  ('finance', 'Producer prices (PPI)', 'November report, 8:30 AM ET', 'CPI', '2026-12-15T13:30:00Z', false, 1, 'scheduled', null, 'curated', 'bls-ppi-2026-12-15'),
  ('finance', 'Fed meeting minutes', 'From the Dec 8-9 meeting, 2:00 PM ET', 'Fed', '2026-12-30T19:00:00Z', false, 1, 'scheduled', null, 'curated', 'fed-minutes-2026-12-30'),
  -- movies
  ('pop_culture', 'The Hunger Games: Sunrise on the Reaping', 'In theaters', 'Movie', '2026-11-20T12:00:00Z', true, 2, 'scheduled', null, 'curated', 'movie-hunger-games-sunrise'),
  ('pop_culture', 'Focker In-Law', 'In theaters', 'Movie', '2026-11-25T12:00:00Z', true, 1, 'scheduled', null, 'curated', 'movie-focker-in-law'),
  ('pop_culture', 'The Adventures of Cliff Booth', 'In theaters', 'Movie', '2026-11-25T12:00:00Z', true, 1, 'scheduled', null, 'curated', 'movie-adventures-cliff-booth'),
  ('pop_culture', 'Violent Night 2', 'In theaters', 'Movie', '2026-12-04T12:00:00Z', true, 1, 'scheduled', null, 'curated', 'movie-violent-night-2'),
  ('pop_culture', 'Avengers: Doomsday', 'In theaters', 'Movie', '2026-12-18T12:00:00Z', true, 2, 'scheduled', null, 'curated', 'movie-avengers-doomsday'),
  ('pop_culture', 'Dune: Part Three', 'In theaters', 'Movie', '2026-12-18T12:00:00Z', true, 2, 'scheduled', null, 'curated', 'movie-dune-part-three'),
  ('pop_culture', 'The Angry Birds Movie 3', 'In theaters', 'Movie', '2026-12-23T12:00:00Z', true, 1, 'scheduled', null, 'curated', 'movie-angry-birds-3'),
  ('pop_culture', 'Jumanji 3', 'In theaters', 'Movie', '2026-12-25T12:00:00Z', true, 2, 'scheduled', null, 'curated', 'movie-jumanji-3')
on conflict (source, external_id) do nothing;

-- The weekly TMDB import adds the same movies once their week starts. When it does, drop the hand-added copy so
-- a movie never shows twice on the Schedule.
create or replace function public.key_events_drop_curated_dupes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'tmdb' and new.category = 'pop_culture' then
    delete from public.key_events c
     where c.source = 'curated' and c.category = 'pop_culture' and c.league = 'Movie'
       and (c.starts_at at time zone 'UTC')::date = (new.starts_at at time zone 'UTC')::date
       and (lower(new.title) like lower(c.title) || '%' or lower(c.title) like lower(new.title) || '%');
  end if;
  return new;
end;
$$;

drop trigger if exists key_events_drop_curated_dupes on public.key_events;
create trigger key_events_drop_curated_dupes
  after insert on public.key_events
  for each row execute function public.key_events_drop_curated_dupes();
