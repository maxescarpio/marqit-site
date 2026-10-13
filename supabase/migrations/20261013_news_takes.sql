-- News debates: one Yes/No question per news story, with a vote split and comments.
-- Questions here are NOT daily questions and never award points.
-- ADDITIVE ONLY: new columns on news_ticker plus new tables and functions.
-- Same access model as question comments: RLS on, no direct policies, everything goes through functions.

alter table public.news_ticker
  add column if not exists take_question text,
  add column if not exists take_checked boolean not null default false;

-- ---------- votes ----------
-- Guests vote by device id (same idea as guest picks); signed-in players vote by account.
create table if not exists public.news_take_votes (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_ticker(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  device_id text,
  choice text not null check (choice in ('yes', 'no')),
  created_at timestamptz not null default now(),
  check ((user_id is not null) <> (device_id is not null))
);
create unique index if not exists news_take_votes_user_uq on public.news_take_votes (news_id, user_id) where user_id is not null;
create unique index if not exists news_take_votes_device_uq on public.news_take_votes (news_id, device_id) where device_id is not null;
alter table public.news_take_votes enable row level security;

-- Cast a vote (one per story, no changing it). Returns nothing.
create or replace function public.vote_news_take(p_news_id uuid, p_choice text, p_device text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_device text := nullif(btrim(coalesce(p_device, '')), '');
begin
  if p_choice not in ('yes', 'no') then raise exception 'Bad choice'; end if;
  if not exists (select 1 from news_ticker where id = p_news_id and take_question is not null) then raise exception 'No such question'; end if;
  if auth.uid() is not null then
    insert into news_take_votes (news_id, user_id, choice) values (p_news_id, auth.uid(), p_choice)
    on conflict (news_id, user_id) where user_id is not null do nothing;
  else
    if v_device is null or char_length(v_device) < 8 or char_length(v_device) > 80 then raise exception 'Missing device'; end if;
    insert into news_take_votes (news_id, device_id, choice) values (p_news_id, v_device, p_choice)
    on conflict (news_id, device_id) where device_id is not null do nothing;
  end if;
end $function$;

-- Totals per story plus my own vote (by account, or by device when signed out).
create or replace function public.get_news_take_results(p_news_ids uuid[], p_device text default null)
 returns table(news_id uuid, yes_count bigint, no_count bigint, my_choice text)
 language sql stable security definer set search_path to 'public'
as $function$
  select n.id,
         count(*) filter (where v.choice = 'yes'),
         count(*) filter (where v.choice = 'no'),
         max(v.choice) filter (where (auth.uid() is not null and v.user_id = auth.uid())
                                  or (auth.uid() is null and p_device is not null and v.device_id = p_device))
  from news_ticker n
  left join news_take_votes v on v.news_id = n.id
  where n.id = any(p_news_ids)
  group by n.id;
$function$;

-- ---------- comments (same rules as question comments) ----------
create table if not exists public.news_comments (
  id uuid primary key default gen_random_uuid(),
  news_id uuid not null references public.news_ticker(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.news_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists news_comments_n_idx on public.news_comments (news_id, created_at);
create index if not exists news_comments_parent_idx on public.news_comments (parent_id);

create table if not exists public.news_comment_likes (
  comment_id uuid not null references public.news_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create table if not exists public.news_comment_reports (
  comment_id uuid not null references public.news_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.news_comments enable row level security;
alter table public.news_comment_likes enable row level security;
alter table public.news_comment_reports enable row level security;

create or replace function public.get_news_comments(p_news_ids uuid[])
 returns table(id uuid, news_id uuid, parent_id uuid, body text, created_at timestamptz,
               username text, avatar_emoji text, avatar_color text, likes bigint, mine boolean, is_me boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.news_id, c.parent_id, c.body, c.created_at,
         coalesce(p.username, 'player'), p.avatar_emoji, p.avatar_color,
         (select count(*) from news_comment_likes l where l.comment_id = c.id),
         exists(select 1 from news_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()),
         (c.user_id = auth.uid())
  from news_comments c
  left join profiles p on p.id = c.user_id
  where c.news_id = any(p_news_ids)
    and c.hidden = false
    and coalesce(p.banned, false) = false
  order by c.created_at asc
  limit 1000;
$function$;

create or replace function public.post_news_comment(p_news_id uuid, p_body text, p_parent_id uuid default null)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_parent_n uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to comment'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then raise exception 'Comments are 1 to 280 characters'; end if;
  if exists (select 1 from profiles where id = auth.uid() and banned) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from news_ticker where id = p_news_id) then raise exception 'No such story'; end if;
  if exists (select 1 from news_comments where user_id = auth.uid() and created_at > now() - interval '5 seconds') then
    raise exception 'Slow down a little';
  end if;
  if (select count(*) from news_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many comments, try again later';
  end if;
  if p_parent_id is not null then
    select coalesce(parent_id, id), news_id into p_parent_id, v_parent_n from news_comments where id = p_parent_id;
    if v_parent_n is null or v_parent_n <> p_news_id then raise exception 'Bad reply'; end if;
  end if;
  insert into news_comments (news_id, user_id, parent_id, body)
  values (p_news_id, auth.uid(), p_parent_id, v_body) returning id into v_id;
  return v_id;
end $function$;

create or replace function public.toggle_news_comment_like(p_comment_id uuid)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in to like'; end if;
  if exists (select 1 from news_comment_likes where comment_id = p_comment_id and user_id = auth.uid()) then
    delete from news_comment_likes where comment_id = p_comment_id and user_id = auth.uid();
    return false;
  end if;
  insert into news_comment_likes (comment_id, user_id) values (p_comment_id, auth.uid());
  return true;
end $function$;

create or replace function public.delete_my_news_comment(p_comment_id uuid)
 returns void language sql security definer set search_path to 'public'
as $function$
  delete from news_comments where id = p_comment_id and user_id = auth.uid();
$function$;

-- Three different reporters hide a comment automatically until an admin looks.
create or replace function public.report_news_comment(p_comment_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in to report'; end if;
  insert into news_comment_reports (comment_id, user_id) values (p_comment_id, auth.uid()) on conflict do nothing;
  if (select count(*) from news_comment_reports where comment_id = p_comment_id) >= 3 then
    update news_comments set hidden = true where id = p_comment_id;
  end if;
end $function$;

revoke all on function public.post_news_comment(uuid, text, uuid) from public, anon;
revoke all on function public.toggle_news_comment_like(uuid) from public, anon;
revoke all on function public.delete_my_news_comment(uuid) from public, anon;
revoke all on function public.report_news_comment(uuid) from public, anon;
grant execute on function public.vote_news_take(uuid, text, text) to anon, authenticated;
grant execute on function public.get_news_take_results(uuid[], text) to anon, authenticated;
grant execute on function public.get_news_comments(uuid[]) to anon, authenticated;
