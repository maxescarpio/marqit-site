-- Remembers each team's last known season leaders (who leads in passing, points, goals, ...).
-- ESPN only lists leaders on a game that has not started yet, so some teams have none on a given day.
-- The scoreboard function saves leaders whenever it sees them and shows the saved copy when ESPN has none.
-- Key looks like 'NFL:17' (league:ESPN team id). Only the edge function (service role) touches this table.
create table if not exists public.team_leaders (
  key text primary key,
  leaders jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.team_leaders enable row level security;
