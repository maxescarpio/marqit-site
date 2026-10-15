-- Remembers each trending item's chart rank per day so the Trending tab can show moves up and down.
-- Fully automatic: a trigger copies the rank every time the fetch job adds a trending row. No function redeploy needed.

create table if not exists public.trend_rank_history (
  day date not null,
  source_name text not null,
  title_key text not null,
  rank smallint not null,
  primary key (day, source_name, title_key)
);
alter table public.trend_rank_history enable row level security;

create or replace function public.mq_trend_key(p_title text)
 returns text language sql immutable
as $$ select left(regexp_replace(lower(coalesce(p_title, '')), '[^a-z0-9]+', '', 'g'), 80) $$;

create or replace function public.mq_record_trend_rank()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if new.kind = 'trend' and new.trend_rank is not null and coalesce(new.source_name, '') <> '' then
    insert into trend_rank_history (day, source_name, title_key, rank)
    values ((new.fetched_at at time zone 'America/New_York')::date, new.source_name, mq_trend_key(new.headline), new.trend_rank)
    on conflict (day, source_name, title_key) do update set rank = least(trend_rank_history.rank, excluded.rank);
  end if;
  return new;
end $function$;

drop trigger if exists mq_trend_rank_trg on public.news_ticker;
create trigger mq_trend_rank_trg after insert on public.news_ticker
  for each row execute function public.mq_record_trend_rank();

-- Start today's history from the trending rows that already exist.
insert into public.trend_rank_history (day, source_name, title_key, rank)
select (fetched_at at time zone 'America/New_York')::date, source_name, mq_trend_key(headline), min(trend_rank)
from public.news_ticker
where kind = 'trend' and trend_rank is not null and coalesce(source_name, '') <> ''
group by 1, 2, 3
on conflict do nothing;

-- Movement for a set of trending rows: previous rank (most recent earlier day), and whether any earlier data exists for that source.
create or replace function public.get_trend_moves(p_news_ids uuid[])
 returns table(news_id uuid, rank_now smallint, rank_prev smallint, has_history boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select n.id, n.trend_rank,
         (select h.rank from trend_rank_history h
           where h.source_name = n.source_name and h.title_key = mq_trend_key(n.headline)
             and h.day < (now() at time zone 'America/New_York')::date
           order by h.day desc limit 1),
         exists (select 1 from trend_rank_history h
                  where h.source_name = n.source_name and h.day < (now() at time zone 'America/New_York')::date)
  from news_ticker n
  where n.id = any(p_news_ids) and n.kind = 'trend' and n.trend_rank is not null;
$function$;
grant execute on function public.get_trend_moves(uuid[]) to anon, authenticated;
