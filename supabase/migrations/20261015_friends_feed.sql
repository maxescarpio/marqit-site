-- Friends' results: how the people you follow, and your buddies, did on scored calls over the last week.
-- One row per person per day. Only resolved questions are read, so nobody's open picks are exposed,
-- and people who hid themselves from leaderboards only show up for their buddies.

create or replace function public.get_friends_feed(p_limit int default 30)
returns table(
  username text, avatar_emoji text, avatar_color text,
  qdate date, calls int, correct int, streak int, is_buddy boolean, last_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with circle as (
    select f.followee_id as uid, false as is_buddy
    from follows f
    where f.follower_id = auth.uid() and f.active
    union all
    select b.buddy_id, true
    from buddies b
    where b.user_id = auth.uid()
  ),
  c as (
    select uid, bool_or(is_buddy) as is_buddy from circle group by uid
  )
  select p.username, p.avatar_emoji, p.avatar_color,
         q.question_date,
         count(*)::int,
         (count(*) filter (where pr.choice = q.correct_answer))::int,
         coalesce(st.current_streak, 0)::int,
         c.is_buddy,
         max(pr.created_at)
  from c
  join profiles p on p.id = c.uid
  join predictions pr on pr.user_id = c.uid
  join daily_questions q on q.id = pr.question_id
  left join streaks st on st.user_id = c.uid
  where auth.uid() is not null
    and coalesce(p.banned, false) = false
    and (c.is_buddy or coalesce(p.hide_from_leaderboard, false) = false)
    and q.resolved and q.correct_answer is not null
    and q.question_date >= (now() at time zone 'America/New_York')::date - 6
  group by p.username, p.avatar_emoji, p.avatar_color, q.question_date, st.current_streak, c.is_buddy
  order by q.question_date desc, 6 desc, max(pr.created_at) desc
  limit greatest(1, least(p_limit, 60));
$$;
revoke all on function public.get_friends_feed(int) from public, anon;
grant execute on function public.get_friends_feed(int) to authenticated;
