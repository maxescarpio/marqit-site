-- Schedule: key dates across sports, finance, tech, pop culture and news.
-- Filled automatically by the fetch-key-events edge function (sports, earnings, movie/TV
-- premieres) and by hand from the admin page (tech launches, awards shows, news events).
create table if not exists public.key_events (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('sports','finance','tech','pop_culture','news')),
  title text not null check (char_length(title) between 2 and 140),
  subtitle text check (subtitle is null or char_length(subtitle) <= 140),   -- e.g. "After close", "Prime Video"
  league text check (league is null or char_length(league) <= 40),           -- small badge, e.g. "NFL", "MLB", "Earnings"
  starts_at timestamptz not null,
  all_day boolean not null default false,                                    -- all-day rows store noon UTC of the date
  importance smallint not null default 1 check (importance between 1 and 3), -- 3 = tied to a Marqit question, 2 = marquee
  status text not null default 'scheduled' check (status in ('scheduled','postponed','cancelled')),
  url text check (url is null or url ~* '^https://'),
  source text not null default 'manual',                                     -- 'thesportsdb', 'finnhub', 'tmdb', 'manual'
  external_id text,                                                          -- id in the source feed, so reruns update instead of duplicating
  question_id uuid references public.daily_questions(id) on delete set null, -- the Marqit question about this event, if any
  admin_hidden boolean not null default false,                               -- an admin removed this feed row; the feed must not bring it back
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint key_events_source_external_id_key unique (source, external_id)
);
create index if not exists key_events_starts_at_idx on public.key_events (starts_at);

alter table public.key_events enable row level security;
grant select on public.key_events to anon, authenticated;

drop policy if exists "Key events are public" on public.key_events;
create policy "Key events are public" on public.key_events
  for select to anon, authenticated
  using (status <> 'cancelled' and not admin_hidden);

drop policy if exists "Admins read all key events" on public.key_events;
create policy "Admins read all key events" on public.key_events
  for select to authenticated
  using (public.is_marqit_admin());

-- Admin: add one event by hand.
create or replace function public.admin_add_key_event(
  p_category text, p_title text, p_subtitle text, p_league text,
  p_starts_at timestamptz, p_all_day boolean, p_importance smallint, p_url text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  if coalesce(p_url,'') <> '' and p_url !~* '^https://' then raise exception 'links must start with https://'; end if;
  insert into public.key_events(category, title, subtitle, league, starts_at, all_day, importance, url, source)
  values (p_category, trim(p_title), nullif(trim(p_subtitle),''), nullif(trim(p_league),''), p_starts_at,
          coalesce(p_all_day,false), coalesce(p_importance,2), nullif(trim(p_url),''), 'manual')
  returning id into v_id;
  return v_id;
end $$;
grant execute on function public.admin_add_key_event(text,text,text,text,timestamptz,boolean,smallint,text) to authenticated;

-- Admin: remove an event. Hand-added rows are deleted; feed rows are hidden so the next feed run doesn't re-add them.
create or replace function public.admin_remove_key_event(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  if exists (select 1 from public.key_events where id = p_id and source = 'manual') then
    delete from public.key_events where id = p_id;
  else
    update public.key_events set admin_hidden = true, updated_at = now() where id = p_id;
  end if;
end $$;
grant execute on function public.admin_remove_key_event(uuid) to authenticated;
