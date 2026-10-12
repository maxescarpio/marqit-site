-- Comments on daily questions (replaces the emoji reaction row on the Play tab).
-- ADDITIVE ONLY: new tables and functions. Nothing existing is changed or dropped.
-- Signed-in players can post, reply (one level), like, and report. Everyone can read.
-- All access goes through the functions below; the tables themselves have RLS on and no direct policies.

create table if not exists public.question_comments (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.daily_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.question_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists question_comments_q_idx on public.question_comments (question_id, created_at);
create index if not exists question_comments_parent_idx on public.question_comments (parent_id);

create table if not exists public.question_comment_likes (
  comment_id uuid not null references public.question_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

create table if not exists public.question_comment_reports (
  comment_id uuid not null references public.question_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.question_comments enable row level security;
alter table public.question_comment_likes enable row level security;
alter table public.question_comment_reports enable row level security;

-- Read: visible comments for a set of questions, with author name, like count, and whether I liked it.
create or replace function public.get_question_comments(p_question_ids uuid[])
 returns table(id uuid, question_id uuid, parent_id uuid, body text, created_at timestamptz,
               username text, avatar_emoji text, avatar_color text, likes bigint, mine boolean, is_me boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.question_id, c.parent_id, c.body, c.created_at,
         coalesce(p.username, 'player'), p.avatar_emoji, p.avatar_color,
         (select count(*) from question_comment_likes l where l.comment_id = c.id),
         exists(select 1 from question_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()),
         (c.user_id = auth.uid())
  from question_comments c
  left join profiles p on p.id = c.user_id
  where c.question_id = any(p_question_ids)
    and c.hidden = false
    and coalesce(p.banned, false) = false
  order by c.created_at asc
  limit 1000;
$function$;

-- Post a comment or a reply. Signed in only, 280 chars, max 1 post every 5 seconds and 30 per hour.
create or replace function public.post_question_comment(p_question_id uuid, p_body text, p_parent_id uuid default null)
 returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
  v_parent_q uuid;
begin
  if auth.uid() is null then raise exception 'Sign in to comment'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then raise exception 'Comments are 1 to 280 characters'; end if;
  if exists (select 1 from profiles where id = auth.uid() and banned) then raise exception 'Not allowed'; end if;
  if exists (select 1 from question_comments where user_id = auth.uid() and created_at > now() - interval '5 seconds') then
    raise exception 'Slow down a little';
  end if;
  if (select count(*) from question_comments where user_id = auth.uid() and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Too many comments, try again later';
  end if;
  if p_parent_id is not null then
    -- replies stay one level deep: reply to the top-level comment
    select coalesce(parent_id, id), question_id into p_parent_id, v_parent_q from question_comments where id = p_parent_id;
    if v_parent_q is null or v_parent_q <> p_question_id then raise exception 'Bad reply'; end if;
  end if;
  insert into question_comments (question_id, user_id, parent_id, body)
  values (p_question_id, auth.uid(), p_parent_id, v_body) returning id into v_id;
  return v_id;
end $function$;

create or replace function public.toggle_comment_like(p_comment_id uuid)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in to like'; end if;
  if exists (select 1 from question_comment_likes where comment_id = p_comment_id and user_id = auth.uid()) then
    delete from question_comment_likes where comment_id = p_comment_id and user_id = auth.uid();
    return false;
  end if;
  insert into question_comment_likes (comment_id, user_id) values (p_comment_id, auth.uid());
  return true;
end $function$;

-- Delete my own comment.
create or replace function public.delete_my_comment(p_comment_id uuid)
 returns void language sql security definer set search_path to 'public'
as $function$
  delete from question_comments where id = p_comment_id and user_id = auth.uid();
$function$;

-- Report a comment. Three different reporters hide it automatically until an admin looks.
create or replace function public.report_question_comment(p_comment_id uuid)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in to report'; end if;
  insert into question_comment_reports (comment_id, user_id) values (p_comment_id, auth.uid()) on conflict do nothing;
  if (select count(*) from question_comment_reports where comment_id = p_comment_id) >= 3 then
    update question_comments set hidden = true where id = p_comment_id;
  end if;
end $function$;

revoke all on function public.post_question_comment(uuid, text, uuid) from public, anon;
revoke all on function public.toggle_comment_like(uuid) from public, anon;
revoke all on function public.delete_my_comment(uuid) from public, anon;
revoke all on function public.report_question_comment(uuid) from public, anon;
grant execute on function public.get_question_comments(uuid[]) to anon, authenticated;
grant execute on function public.post_question_comment(uuid, text, uuid) to authenticated;
grant execute on function public.toggle_comment_like(uuid) to authenticated;
grant execute on function public.delete_my_comment(uuid) to authenticated;
grant execute on function public.report_question_comment(uuid) to authenticated;
