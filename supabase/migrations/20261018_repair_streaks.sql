-- One-off repair: some players' stored current_streak fell below the real run of
-- full days (all 3 calls) in their prediction history. This raises current_streak
-- (and longest_streak if needed) to the real run ending on their last played day.
-- It never lowers anything, so streak freezes are not undone.
with full_days as (
  select pr.user_id, dq.question_date d
  from public.predictions pr
  join public.daily_questions dq on dq.id = pr.question_id
  group by 1, 2
  having count(distinct dq.category) = 3
), runs as (
  select user_id, d, d - (row_number() over (partition by user_id order by d))::int as g
  from full_days
), cur as (
  select user_id, count(*)::int as run_len, max(d) as last_d
  from runs group by user_id, g
)
update public.streaks s
set current_streak = c.run_len,
    longest_streak = greatest(s.longest_streak, c.run_len),
    updated_at = now()
from cur c
where c.user_id = s.user_id
  and c.last_d = s.last_played_date
  and s.current_streak < c.run_len;
