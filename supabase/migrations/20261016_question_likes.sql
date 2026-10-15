-- Hearts on the question cards themselves (separate from hearts on comments).
create table if not exists public.question_likes (
  question_id uuid not null references public.daily_questions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (question_id, user_id)
);
alter table public.question_likes enable row level security;

create or replace function public.get_question_likes(p_question_ids uuid[])
 returns table(question_id uuid, likes bigint, mine boolean)
 language sql stable security definer set search_path to 'public'
as $function$
  select q.id,
         (select count(*) from question_likes l where l.question_id = q.id),
         exists(select 1 from question_likes l where l.question_id = q.id and l.user_id = auth.uid())
  from unnest(p_question_ids) as q(id);
$function$;

create or replace function public.toggle_question_like(p_question_id uuid)
 returns boolean language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Sign in to like'; end if;
  if exists (select 1 from question_likes where question_id = p_question_id and user_id = auth.uid()) then
    delete from question_likes where question_id = p_question_id and user_id = auth.uid();
    return false;
  end if;
  insert into question_likes (question_id, user_id) values (p_question_id, auth.uid());
  return true;
end $function$;

revoke all on function public.toggle_question_like(uuid) from public, anon;
grant execute on function public.get_question_likes(uuid[]) to anon, authenticated;
grant execute on function public.toggle_question_like(uuid) to authenticated;
