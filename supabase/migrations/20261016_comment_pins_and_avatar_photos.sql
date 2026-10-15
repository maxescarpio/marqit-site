-- Admin-pinned comments on daily questions + a public storage bucket for profile photos.
-- Safe to run once. Nothing existing is dropped except the old signature of get_question_comments,
-- which is recreated below with one extra column (pinned).

-- 1) Pinned comments -------------------------------------------------------------------------
alter table public.question_comments add column if not exists pinned boolean not null default false;

drop function if exists public.get_question_comments(uuid[]);
create or replace function public.get_question_comments(p_question_ids uuid[])
 returns table(id uuid, question_id uuid, parent_id uuid, body text, created_at timestamptz,
               username text, avatar_emoji text, avatar_color text, likes bigint, mine boolean, is_me boolean,
               pinned boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select c.id, c.question_id, c.parent_id, c.body, c.created_at,
         coalesce(p.username, 'player'), p.avatar_emoji, p.avatar_color,
         (select count(*) from question_comment_likes l where l.comment_id = c.id),
         exists(select 1 from question_comment_likes l where l.comment_id = c.id and l.user_id = auth.uid()),
         (c.user_id = auth.uid()),
         c.pinned
  from question_comments c
  left join profiles p on p.id = c.user_id
  where c.question_id = any(p_question_ids)
    and c.hidden = false
    and coalesce(p.banned, false) = false
  order by c.created_at asc
  limit 1000;
$function$;
grant execute on function public.get_question_comments(uuid[]) to anon, authenticated;

-- Admin only: pin or unpin a top-level comment. Only one pinned comment per question.
create or replace function public.admin_pin_comment(p_comment_id uuid)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_q uuid;
  v_parent uuid;
  v_now boolean;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'maxescarpio3@gmail.com' then
    raise exception 'Admins only';
  end if;
  select question_id, parent_id, pinned into v_q, v_parent, v_now from question_comments where id = p_comment_id;
  if v_q is null then raise exception 'Comment not found'; end if;
  if v_parent is not null then raise exception 'Only top-level comments can be pinned'; end if;
  if v_now then
    update question_comments set pinned = false where id = p_comment_id;
    return false;
  end if;
  update question_comments set pinned = false where question_id = v_q and pinned;
  update question_comments set pinned = true where id = p_comment_id;
  return true;
end $function$;
revoke all on function public.admin_pin_comment(uuid) from public, anon;
grant execute on function public.admin_pin_comment(uuid) to authenticated;

-- 2) Profile photos --------------------------------------------------------------------------
-- Public-read bucket; each person can only write inside a folder named after their own user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars own insert" on storage.objects;
create policy "avatars own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
