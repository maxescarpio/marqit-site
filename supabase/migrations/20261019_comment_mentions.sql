-- @mentions in comments (Play, News and Trending all use question_comments / news_comments).
-- ADDITIVE ONLY: one new table, two triggers, and a few functions. Nothing existing is changed or dropped.
--
-- How it works:
--   * A trigger on question_comments and news_comments reads every @username in a new comment's text
--     and writes one row per mentioned person into comment_mentions.
--   * The site calls get_my_mentions() to show the signed-in person a small "X mentioned you in Play"
--     notice, and mark_mentions_seen() once they have seen it.
--   * search_usernames() powers the suggestions that appear while someone types "@" in a comment box.
-- As with comments, the table has RLS on and no direct policies: everything goes through the functions.

create table if not exists public.comment_mentions (
  id uuid primary key default gen_random_uuid(),
  mentioned_id uuid not null references public.profiles(id) on delete cascade, -- who was tagged
  by_id uuid not null references public.profiles(id) on delete cascade,        -- who tagged them
  kind text not null check (kind in ('question', 'news')),
  comment_id uuid not null,   -- question_comments.id or news_comments.id, depending on kind
  target_id uuid not null,    -- the daily question or news item the comment is on
  created_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (kind, comment_id, mentioned_id)
);
create index if not exists comment_mentions_unseen_idx
  on public.comment_mentions (mentioned_id, created_at desc) where seen_at is null;
alter table public.comment_mentions enable row level security;

-- Internal: turn the @usernames in one comment into mention rows (max 5 people per comment,
-- never yourself, never banned accounts). Failures here must never block the comment itself.
create or replace function public.mq_mentions_from_comment(p_kind text, p_comment uuid, p_target uuid, p_author uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into comment_mentions (mentioned_id, by_id, kind, comment_id, target_id)
  select p.id, p_author, p_kind, p_comment, p_target
  from (
    select distinct lower(m[1]) as uname
    from regexp_matches(coalesce(p_body, ''), '(?<![A-Za-z0-9_])@([A-Za-z0-9_]{3,24})', 'g') as m
    limit 5
  ) t
  join profiles p on lower(p.username) = t.uname
  where p.id <> p_author and coalesce(p.banned, false) = false
  on conflict do nothing;
exception when others then
  null;
end $$;
revoke all on function public.mq_mentions_from_comment(text, uuid, uuid, uuid, text) from public, anon, authenticated;

create or replace function public.mq_trg_question_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.mq_mentions_from_comment('question', new.id, new.question_id, new.user_id, new.body);
  return new;
end $$;

create or replace function public.mq_trg_news_mentions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.mq_mentions_from_comment('news', new.id, new.news_id, new.user_id, new.body);
  return new;
end $$;
revoke all on function public.mq_trg_question_mentions() from public, anon, authenticated;
revoke all on function public.mq_trg_news_mentions() from public, anon, authenticated;

drop trigger if exists mq_question_comment_mentions on public.question_comments;
create trigger mq_question_comment_mentions after insert on public.question_comments
  for each row execute function public.mq_trg_question_mentions();

drop trigger if exists mq_news_comment_mentions on public.news_comments;
create trigger mq_news_comment_mentions after insert on public.news_comments
  for each row execute function public.mq_trg_news_mentions();

-- My unseen mentions from the last 14 days, newest first.
-- where_label is what the site shows: "Play" for daily questions, "Trending" or "News" for news items.
create or replace function public.get_my_mentions()
returns table(id uuid, kind text, target_id uuid, comment_id uuid, by_username text, avatar_emoji text,
              avatar_color text, where_label text, title text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.kind, m.target_id, m.comment_id,
         coalesce(p.username, 'someone'), p.avatar_emoji, p.avatar_color,
         case when m.kind = 'question' then 'Play'
              when n.kind = 'trend' then 'Trending'
              else 'News' end,
         coalesce(q.question_text, n.headline),
         m.created_at
  from comment_mentions m
  join profiles p on p.id = m.by_id
  left join daily_questions q on m.kind = 'question' and q.id = m.target_id
  left join news_ticker n on m.kind = 'news' and n.id = m.target_id
  where m.mentioned_id = auth.uid()
    and m.seen_at is null
    and m.created_at > now() - interval '14 days'
    and coalesce(p.banned, false) = false
  order by m.created_at desc
  limit 20;
$$;

-- Mark mentions as seen: the given ids, or all of mine when no ids are passed.
create or replace function public.mark_mentions_seen(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update comment_mentions set seen_at = now()
  where mentioned_id = auth.uid() and seen_at is null
    and (p_ids is null or id = any(p_ids));
$$;

-- Username suggestions while typing "@name". Signed-in only; 1 to 24 letters/numbers/underscores.
create or replace function public.search_usernames(p_prefix text)
returns table(username text, avatar_emoji text, avatar_color text)
language sql stable security definer set search_path = public as $$
  select p.username, p.avatar_emoji, p.avatar_color
  from profiles p
  where auth.uid() is not null
    and p_prefix ~ '^[A-Za-z0-9_]{1,24}$'
    and starts_with(lower(p.username), lower(p_prefix))
    and p.id <> auth.uid()
    and coalesce(p.banned, false) = false
  order by length(p.username), p.username
  limit 6;
$$;

revoke all on function public.get_my_mentions() from public, anon;
revoke all on function public.mark_mentions_seen(uuid[]) from public, anon;
revoke all on function public.search_usernames(text) from public, anon;
grant execute on function public.get_my_mentions() to authenticated;
grant execute on function public.mark_mentions_seen(uuid[]) to authenticated;
grant execute on function public.search_usernames(text) to authenticated;
