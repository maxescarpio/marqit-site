-- Nov 12: Marqit+ "Sharp Feed": the latest calls from the players you follow, plus your buddies and rivals.
-- Information only, no points or entries. A call only appears after its question has locked, and players who are
-- hidden from the leaderboard or banned never appear. Gated by is_marqit_plus() (the same switch as every other perk).
create or replace function public.sharp_feed(p_limit int default 40)
returns table(username text, choice text, question_text text, category text, question_date date,
              resolved boolean, correct_answer text, relation text)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
begin
  if me is null or not public.is_marqit_plus() then return; end if;
  return query
  with people as (
    select f.followee_id as uid, 'follow'::text as rel from public.follows f where f.follower_id = me and f.active
    union all select b.buddy_id, 'buddy' from public.buddies b where b.user_id = me
    union all select b.user_id, 'buddy' from public.buddies b where b.buddy_id = me
    union all select r.rival_id, 'rival' from public.rivals r where r.user_id = me
    union all select r.user_id, 'rival' from public.rivals r where r.rival_id = me
  ), dedup as (
    select pe.uid, (array_agg(pe.rel order by case pe.rel when 'rival' then 1 when 'buddy' then 2 else 3 end))[1] as rel
      from people pe where pe.uid <> me group by pe.uid
  )
  select p.username, pr.choice, q.question_text, q.category, q.question_date, q.resolved, q.correct_answer, d.rel
    from dedup d
    join public.profiles p on p.id = d.uid and not coalesce(p.banned, false) and not coalesce(p.hide_from_leaderboard, false)
    join public.predictions pr on pr.user_id = d.uid
    join public.daily_questions q on q.id = pr.question_id and not q.voided
         and (q.lock_time is null or q.lock_time <= now()) and q.question_date >= today - 7
   order by q.question_date desc, q.slot desc, p.username
   limit least(greatest(coalesce(p_limit, 40), 1), 60);
end;
$$;

revoke all on function public.sharp_feed(int) from public, anon;
grant execute on function public.sharp_feed(int) to authenticated;
