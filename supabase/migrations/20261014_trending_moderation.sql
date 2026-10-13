-- Trending tab + comment moderation.
-- 1) Trending posts (links to posts on X, Instagram, TikTok, etc.) live in news_ticker with kind = 'post' (never auto-trimmed).
-- 2) Comments get a word screen: block (rejected), hold (author sees it, others don't until approved).
-- 3) Admin-only functions for the review queue, blocked terms, and posting updates.
-- Admin = is_marqit_admin(), same as the rest of the admin page.

alter table public.news_ticker
  add column if not exists kind text not null default 'news',
  add column if not exists lane text,
  add column if not exists body text,
  add column if not exists pinned boolean not null default false;
do $$ begin
  alter table public.news_ticker add constraint news_ticker_kind_chk check (kind in ('news', 'post'));
exception when duplicate_object then null; end $$;
create index if not exists news_ticker_kind_idx on public.news_ticker (kind, fetched_at desc);

alter table public.news_comments add column if not exists held boolean not null default false;
alter table public.question_comments add column if not exists held boolean not null default false;

-- ---------- blocked / held terms ----------
create table if not exists public.moderation_terms (
  id uuid primary key default gen_random_uuid(),
  pattern text not null,                       -- regular expression, lower case
  mode text not null check (mode in ('block', 'hold')),
  collapsed boolean not null default false,    -- true: match against letters only (catches "n i g g a", "n.i.g.g.a")
  note text,
  created_at timestamptz not null default now()
);
alter table public.moderation_terms enable row level security;

insert into public.moderation_terms (pattern, mode, collapsed, note)
select * from (values
  -- slurs: always rejected
  ('nigg+(a|er)s?', 'block', true, 'slur'),
  ('fagg+ots?', 'block', true, 'slur'),
  ('retard(s|ed)?', 'block', false, 'slur'),
  ('kikes?', 'block', false, 'slur'),
  ('spics?', 'block', false, 'slur'),
  ('coons?', 'block', false, 'slur'),
  ('wetbacks?', 'block', false, 'slur'),
  ('gooks?', 'block', false, 'slur'),
  ('beaners?', 'block', false, 'slur'),
  ('trann(y|ies)', 'block', false, 'slur'),
  -- threats and telling people to hurt themselves: always rejected
  ('kill\s+(yourself|urself|ur\s*self)', 'block', false, 'threat'),
  ('kys', 'block', false, 'threat'),
  ('go\s+die', 'block', false, 'threat'),
  ('hope\s+(you|u)\s+die', 'block', false, 'threat'),
  ('(you|u)\s+should\s+(just\s+)?die', 'block', false, 'threat'),
  ('(i|ill|i\s+will|im\s+going\s+to|im\s+gonna|we\s+will|we\s+ll)\s+(kill|shoot|stab)\s+(you|u)', 'block', false, 'threat'),
  ('(i|ill|i\s+will|im\s+going\s+to|im\s+gonna|we\s+will|we\s+ll)\s+(find|hurt|beat\s+up)\s+(you|u)', 'hold', false, 'possible threat'),
  -- borderline: held for review
  ('suicid\w*', 'hold', false, 'self-harm'),
  ('kill\s+(him|her|them|everyone|all)', 'hold', false, 'violence'),
  ('rap(e|ed|es|ing|ist|ists)', 'hold', false, 'sexual violence'),
  ('molest\w*', 'hold', false, 'sexual violence'),
  ('pedo\w*', 'hold', false, 'sexual violence'),
  ('porn\w*', 'hold', false, 'sexual content'),
  ('nudes?', 'hold', false, 'sexual content'),
  ('onlyfans', 'hold', false, 'sexual content'),
  ('nazis?', 'hold', false, 'hate'),
  ('hitler', 'hold', false, 'hate'),
  ('chinks?', 'hold', false, 'slur or idiom, review'),
  ('dox\w*', 'hold', false, 'doxxing'),
  ('fuck\s+(you|u|off)', 'hold', false, 'direct insult'),
  ('(you|u)(re|\s+are|\s+r)\s+(a\s+|an\s+)?(idiot|moron|loser|trash|garbage|dumbass|scum|clown|pathetic)', 'hold', false, 'direct insult'),
  ('shut\s+up\s+(you|u|idiot|moron)', 'hold', false, 'direct insult')
) as v(pattern, mode, collapsed, note)
where not exists (select 1 from public.moderation_terms);

-- Returns 'ok', 'hold' or 'block'. Links, emails and phone numbers are blocked.
create or replace function public.mq_screen_comment(p_body text)
 returns text language plpgsql stable security definer set search_path to 'public'
as $function$
declare
  t text := lower(coalesce(p_body, ''));
  norm text;
  letters text;
  r record;
  result text := 'ok';
begin
  if t ~ '(https?://|www\.)' then return 'block'; end if;
  if t ~ '\m[a-z0-9-]+\.(com|net|org|io|co|ly|gg|tv|xyz|me|app|link|click|info|biz|us|uk)\M' then return 'block'; end if;
  if t ~ '[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}' then return 'block'; end if;
  if t ~ '(\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}' then return 'block'; end if;

  norm := regexp_replace(translate(t, '0134578@$!', 'oieastbasi'), '[''’]', '', 'g');
  letters := regexp_replace(norm, '[^a-z]', '', 'g');

  for r in select pattern, mode, collapsed as c from moderation_terms loop
    if (r.c and letters ~ r.pattern) or ((not r.c) and norm ~ ('\m(' || r.pattern || ')\M')) then
      if r.mode = 'block' then return 'block'; end if;
      result := 'hold';
    end if;
  end loop;
  return result;
end $function$;
revoke all on function public.mq_screen_comment(text) from public, anon, authenticated;

-- ---------- posting: screen first ----------
create or replace function public.post_news_comment(p_news_id uuid, p_body text, p_parent_id uuid default null)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_parent_n uuid;
  v_screen text;
begin
  if auth.uid() is null then raise exception 'Sign in to comment'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then raise exception 'Comments are 1 to 280 characters'; end if;
  if exists (select 1 from profiles where id = auth.uid() and banned) then raise exception 'Not allowed'; end if;
  if not exists (select 1 from news_ticker where id = p_news_id) then raise exception 'No such story'; end if;
  v_screen := mq_screen_comment(v_body);
  if v_screen = 'block' then raise exception 'That comment breaks the Marqit rules (no slurs, threats, links or personal info).'; end if;
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
  insert into news_comments (news_id, user_id, parent_id, body, held)
  values (p_news_id, auth.uid(), p_parent_id, v_body, v_screen = 'hold') returning id into v_id;
  return v_id;
end $function$;

create or replace function public.post_question_comment(p_question_id uuid, p_body text, p_parent_id uuid default null)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_parent_q uuid;
  v_screen text;
begin
  if auth.uid() is null then raise exception 'Sign in to comment'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then raise exception 'Comments are 1 to 280 characters'; end if;
  if exists (select 1 from profiles where id = auth.uid() and banned) then raise exception 'Not allowed'; end if;
  v_screen := mq_screen_comment(v_body);
  if v_screen = 'block' then raise exception 'That comment breaks the Marqit rules (no slurs, threats, links or personal info).'; end if;
  if exists (select 1 from question_comments where user_id = auth.uid() and created_at > now() - interval '5 seconds') then
    raise exception 'Slow down a little';
  end if;
  if (select count(*) from question_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many comments, try again later';
  end if;
  if p_parent_id is not null then
    select coalesce(parent_id, id), question_id into p_parent_id, v_parent_q from question_comments where id = p_parent_id;
    if v_parent_q is null or v_parent_q <> p_question_id then raise exception 'Bad reply'; end if;
  end if;
  insert into question_comments (question_id, user_id, parent_id, body, held)
  values (p_question_id, auth.uid(), p_parent_id, v_body, v_screen = 'hold') returning id into v_id;
  return v_id;
end $function$;
revoke all on function public.post_news_comment(uuid, text, uuid) from public, anon;
revoke all on function public.post_question_comment(uuid, text, uuid) from public, anon;

-- ---------- reading: held comments are visible only to their author ----------
drop function if exists public.get_news_comments(uuid[]);
create function public.get_news_comments(p_news_ids uuid[])
 returns table(id uuid, news_id uuid, parent_id uuid, body text, created_at timestamptz,
               username text, avatar_emoji text, avatar_color text, likes bigint, mine boolean, is_me boolean, held boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.news_id, c.parent_id, c.body, c.created_at,
         coalesce(p.username, 'player'), p.avatar_emoji, p.avatar_color,
         (select count(*) from news_comment_likes l where l.comment_id = c.id),
         exists(select 1 from news_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()),
         (c.user_id = auth.uid()),
         c.held
  from news_comments c
  left join profiles p on p.id = c.user_id
  where c.news_id = any(p_news_ids)
    and c.hidden = false
    and (c.held = false or c.user_id = auth.uid())
    and coalesce(p.banned, false) = false
  order by c.created_at asc
  limit 1000;
$function$;
grant execute on function public.get_news_comments(uuid[]) to anon, authenticated;

drop function if exists public.get_question_comments(uuid[]);
create function public.get_question_comments(p_question_ids uuid[])
 returns table(id uuid, question_id uuid, parent_id uuid, body text, created_at timestamptz,
               username text, avatar_emoji text, avatar_color text, likes bigint, mine boolean, is_me boolean, held boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.question_id, c.parent_id, c.body, c.created_at,
         coalesce(p.username, 'player'), p.avatar_emoji, p.avatar_color,
         (select count(*) from question_comment_likes l where l.comment_id = c.id),
         exists(select 1 from question_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()),
         (c.user_id = auth.uid()),
         c.held
  from question_comments c
  left join profiles p on p.id = c.user_id
  where c.question_id = any(p_question_ids)
    and c.hidden = false
    and (c.held = false or c.user_id = auth.uid())
    and coalesce(p.banned, false) = false
  order by c.created_at asc
  limit 1000;
$function$;
grant execute on function public.get_question_comments(uuid[]) to anon, authenticated;

-- ---------- thread stats for the feed cards ----------
create or replace function public.get_news_thread_stats(p_news_ids uuid[])
 returns table(news_id uuid, comments bigint, votes bigint, last_body text, last_user text, last_at timestamptz)
 language sql stable security definer set search_path to 'public'
as $function$
  select n.id,
         (select count(*) from news_comments c where c.news_id = n.id and not c.hidden and not c.held),
         (select count(*) from news_take_votes v where v.news_id = n.id),
         lc.body, lc.username, lc.created_at
  from news_ticker n
  left join lateral (
    select c.body, coalesce(p.username, 'player') as username, c.created_at
    from news_comments c left join profiles p on p.id = c.user_id
    where c.news_id = n.id and not c.hidden and not c.held and coalesce(p.banned, false) = false
    order by c.created_at desc limit 1
  ) lc on true
  where n.id = any(p_news_ids);
$function$;
grant execute on function public.get_news_thread_stats(uuid[]) to anon, authenticated;

-- ---------- admin: review queue ----------
create or replace function public.admin_review_queue()
 returns table(kind text, id uuid, body text, created_at timestamptz, user_id uuid, username text,
               banned boolean, context text, held boolean, hidden boolean, reports bigint)
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  return query
    select 'news'::text, c.id, c.body, c.created_at, c.user_id, p.username, coalesce(p.banned, false),
           n.headline, c.held, c.hidden,
           (select count(*) from news_comment_reports r where r.comment_id = c.id)
    from news_comments c
    join news_ticker n on n.id = c.news_id
    left join profiles p on p.id = c.user_id
    where c.held or c.hidden
    union all
    select 'question'::text, c.id, c.body, c.created_at, c.user_id, p.username, coalesce(p.banned, false),
           q.question_text, c.held, c.hidden,
           (select count(*) from question_comment_reports r where r.comment_id = c.id)
    from question_comments c
    join daily_questions q on q.id = c.question_id
    left join profiles p on p.id = c.user_id
    where c.held or c.hidden
    order by 4 desc
    limit 200;
end $function$;

create or replace function public.admin_review_comment(p_kind text, p_id uuid, p_action text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  if p_kind = 'news' then
    if p_action = 'approve' then
      update news_comments set held = false, hidden = false where id = p_id;
      delete from news_comment_reports where comment_id = p_id;
    elsif p_action = 'delete' then
      delete from news_comments where id = p_id;
    else raise exception 'Bad action'; end if;
  elsif p_kind = 'question' then
    if p_action = 'approve' then
      update question_comments set held = false, hidden = false where id = p_id;
      delete from question_comment_reports where comment_id = p_id;
    elsif p_action = 'delete' then
      delete from question_comments where id = p_id;
    else raise exception 'Bad action'; end if;
  else raise exception 'Bad kind'; end if;
end $function$;

-- ---------- admin: blocked terms ----------
create or replace function public.admin_list_terms()
 returns table(id uuid, pattern text, mode text, collapsed boolean, note text)
 language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  return query select t.id, t.pattern, t.mode, t.collapsed, t.note from moderation_terms t order by t.mode, t.pattern;
end $function$;

create or replace function public.admin_add_term(p_pattern text, p_mode text, p_collapsed boolean default false)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_pat text := lower(btrim(coalesce(p_pattern, '')));
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  if char_length(v_pat) < 2 or char_length(v_pat) > 120 then raise exception 'Term must be 2 to 120 characters'; end if;
  if p_mode not in ('block', 'hold') then raise exception 'Bad mode'; end if;
  perform 'test' ~ v_pat; -- raises if it is not a valid pattern
  insert into moderation_terms (pattern, mode, collapsed, note) values (v_pat, p_mode, coalesce(p_collapsed, false), 'added by admin');
end $function$;

create or replace function public.admin_remove_term(p_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  delete from moderation_terms where id = p_id;
end $function$;

-- ---------- admin: updates and debate questions ----------
create or replace function public.admin_post_social(
  p_lane text, p_url text, p_headline text, p_author text default null,
  p_take_question text default null, p_pinned boolean default false)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_url text := btrim(coalesce(p_url, ''));
  v_head text := btrim(coalesce(p_headline, ''));
  v_host text;
  v_take text := nullif(btrim(coalesce(p_take_question, '')), '');
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  if p_lane not in ('sports', 'pop', 'music', 'tech', 'news') then raise exception 'Bad lane'; end if;
  if v_url !~* '^https://' then raise exception 'Paste the full post link (starts with https://)'; end if;
  v_host := lower(substring(v_url from '^https://(?:www\.|mobile\.|m\.)?([^/?#]+)'));
  if v_host not in ('x.com', 'twitter.com', 'instagram.com', 'tiktok.com', 'bsky.app', 'youtube.com', 'youtu.be', 'threads.net', 'threads.com') then
    raise exception 'Supported: X, Instagram, TikTok, Bluesky, YouTube, Threads';
  end if;
  if char_length(v_head) < 3 or char_length(v_head) > 200 then raise exception 'Headline must be 3 to 200 characters'; end if;
  if exists (select 1 from news_ticker where article_url = v_url) then raise exception 'That post is already on Trending'; end if;
  insert into news_ticker (headline, source_name, article_url, kind, lane, take_question, take_checked, pinned, published_at)
  values (v_head, nullif(btrim(coalesce(p_author, '')), ''), v_url, 'post', p_lane, v_take, true, coalesce(p_pinned, false), now())
  returning id into v_id;
  return v_id;
end $function$;

create or replace function public.admin_delete_post(p_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  delete from news_ticker where id = p_id and kind = 'post';
end $function$;

create or replace function public.admin_set_post_pinned(p_id uuid, p_pinned boolean)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  update news_ticker set pinned = coalesce(p_pinned, false) where id = p_id and kind = 'post';
end $function$;

-- Edit or clear the debate question on any story or update (blank clears it).
create or replace function public.admin_set_take_question(p_id uuid, p_question text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
declare v_q text := nullif(btrim(coalesce(p_question, '')), '');
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  if v_q is not null and char_length(v_q) > 120 then raise exception 'Keep the question under 120 characters'; end if;
  update news_ticker set take_question = v_q, take_checked = true where id = p_id;
end $function$;

revoke all on function public.admin_review_queue() from public, anon;
revoke all on function public.admin_review_comment(text, uuid, text) from public, anon;
revoke all on function public.admin_list_terms() from public, anon;
revoke all on function public.admin_add_term(text, text, boolean) from public, anon;
revoke all on function public.admin_remove_term(uuid) from public, anon;
revoke all on function public.admin_post_social(text, text, text, text, text, boolean) from public, anon;
revoke all on function public.admin_delete_post(uuid) from public, anon;
revoke all on function public.admin_set_post_pinned(uuid, boolean) from public, anon;
revoke all on function public.admin_set_take_question(uuid, text) from public, anon;
