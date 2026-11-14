-- Verified record: a public, read-only record any player can link to ("Receipts, not claims").
-- One function, callable by anyone (including signed-out visitors), returning ONLY aggregate and
-- already-settled facts about one player:
--   * settled, non-voided calls, how many were right, accuracy
--   * only calls made before the question locked (this is what makes it "verified")
--   * per-category record, last 10 settled calls, streaks, rank, member-since
-- It never returns calls on open questions, email, or anything not already visible on the leaderboard.
-- Players who hide themselves from the leaderboard (hide_from_leaderboard) or are banned return null,
-- so the privacy toggle controls this page too.
-- ROLLBACK: drop function public.public_player_record(text);

begin;

create or replace function public.public_player_record(p_username text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  target uuid;
  uname text; emoji text; color text; joined timestamptz;
  total_n int; correct_n int;
  cats jsonb; recent jsonb;
  cur int; best int; pts int; rnk int; visible_n int;
begin
  select p.id, p.username, p.avatar_emoji, p.avatar_color, p.created_at
    into target, uname, emoji, color, joined
    from public.profiles p
   where lower(p.username) = lower(btrim(coalesce(p_username, '')))
     and coalesce(p.banned, false) = false
     and coalesce(p.hide_from_leaderboard, false) = false;
  if target is null then return null; end if;

  -- One pass over the player's settled calls (a CTE, not a temp table: this function is STABLE and runs read-only).
  with rec as (
    select q.category, q.question_text, q.question_date, q.slot, pr.choice,
           (pr.choice = q.correct_answer) as is_right
      from public.predictions pr
      join public.daily_questions q on q.id = pr.question_id
     where pr.user_id = target
       and q.resolved
       and coalesce(q.voided, false) = false
       and q.correct_answer is not null
       and (q.lock_time is null or pr.created_at <= q.lock_time)
  )
  select
    (select count(*) from rec),
    (select count(*) filter (where is_right) from rec),
    (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'calls', calls, 'correct', right_n) order by calls desc), '[]'::jsonb)
       from (select category, count(*) calls, count(*) filter (where is_right) right_n from rec group by category) c),
    (select coalesce(jsonb_agg(jsonb_build_object('text', question_text, 'choice', choice, 'right', is_right, 'date', question_date, 'category', category) order by question_date desc, slot desc nulls last), '[]'::jsonb)
       from (select * from rec order by question_date desc, slot desc nulls last limit 10) r)
  into total_n, correct_n, cats, recent;

  select coalesce(s.current_streak, 0), coalesce(s.longest_streak, 0), coalesce(s.total_points, 0)
    into cur, best, pts
    from public.streaks s where s.user_id = target;
  cur := coalesce(cur, 0); best := coalesce(best, 0); pts := coalesce(pts, 0);

  select count(*) filter (where coalesce(s.total_points, 0) > pts) + 1, count(*)
    into rnk, visible_n
    from public.streaks s
    join public.profiles p on p.id = s.user_id
   where coalesce(p.banned, false) = false and coalesce(p.hide_from_leaderboard, false) = false;

  return jsonb_build_object(
    'username', uname, 'avatar_emoji', emoji, 'avatar_color', color, 'member_since', joined,
    'calls', total_n, 'correct', correct_n,
    'accuracy_pct', case when total_n > 0 then round(100.0 * correct_n / total_n, 1) else null end,
    'current_streak', cur, 'longest_streak', best, 'total_points', pts,
    'rank', rnk, 'ranked_players', visible_n,
    'by_category', cats, 'recent', recent
  );
end;
$$;

revoke all on function public.public_player_record(text) from public;
grant execute on function public.public_player_record(text) to anon, authenticated;

commit;
