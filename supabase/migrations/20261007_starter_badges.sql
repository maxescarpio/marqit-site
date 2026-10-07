-- Adds three starter badges to award_achievement: first_pick, first_correct, streak_3.
-- Everything else in the function is unchanged.
create or replace function public.award_achievement(p_key text)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count int;
  v_prev int;
begin
  if auth.uid() is null then
    return null;
  end if;

  v_count := case p_key

    -- Perfect Day: how many separate days had 3+ picks, all resolved and correct.
    when 'perfect_day' then (
      select count(*) from (
        select dq.question_date
        from predictions pr
        join daily_questions dq on dq.id = pr.question_id
        where pr.user_id = auth.uid()
        group by dq.question_date
        having count(*) >= 3
           and count(*) = count(*) filter (where dq.resolved is true and pr.choice = dq.correct_answer)
      ) t
    )

    -- Buddy Bonus: how many distinct questions where a buddy matched your pick.
    when 'buddy_bonus' then (
      select count(distinct mine.question_id)
      from predictions mine
      join buddies b on b.user_id = auth.uid()
      join predictions theirs
        on theirs.user_id = b.buddy_id
       and theirs.question_id = mine.question_id
       and theirs.choice = mine.choice
      where mine.user_id = auth.uid()
    )

    -- Rival Showdown wins: how many duels you won outright.
    when 'rival_win' then (
      select count(*) from (
        select a.duel_date
        from rival_duel_activations a
        join rival_duel_activations b
          on b.duel_date::text = a.duel_date::text
         and b.user_id = a.rival_user_id
         and b.rival_user_id = a.user_id
        where a.user_id = auth.uid()
          and exists (
            select 1 from predictions p join daily_questions q on q.id = p.question_id
            where p.user_id = a.user_id and q.question_date::text = a.duel_date::text
          )
          and not exists (
            select 1 from predictions p join daily_questions q on q.id = p.question_id
            where p.user_id = a.user_id and q.question_date::text = a.duel_date::text
              and q.resolved is not true
          )
          and (
            select count(*) from predictions p join daily_questions q on q.id = p.question_id
            where p.user_id = a.user_id and q.question_date::text = a.duel_date::text
              and q.resolved is true and p.choice = q.correct_answer
          ) > (
            select count(*) from predictions p join daily_questions q on q.id = p.question_id
            where p.user_id = b.user_id and q.question_date::text = a.duel_date::text
              and q.resolved is true and p.choice = q.correct_answer
          )
      ) t
    )

    -- NEW First Call: at least one pick ever made.
    when 'first_pick' then (
      select least(count(*), 1)::int from predictions pr where pr.user_id = auth.uid()
    )

    -- NEW On the Board: at least one resolved pick that was correct.
    when 'first_correct' then (
      select least(count(*), 1)::int
      from predictions pr
      join daily_questions dq on dq.id = pr.question_id
      where pr.user_id = auth.uid() and dq.resolved is true and pr.choice = dq.correct_answer
    )

    -- NEW Three in a Row: best-ever streak of 3 days or more.
    when 'streak_3' then (
      select case when coalesce(longest_streak, 0) >= 3 then 1 else 0 end
      from streaks where user_id = auth.uid()
    )

    -- Sharp Shooter: every 10 lifetime correct calls earns another tier.
    when 'sharp_shooter' then (
      select floor(count(*) / 10.0)::int
      from predictions pr
      join daily_questions dq on dq.id = pr.question_id
      where pr.user_id = auth.uid() and dq.resolved is true and pr.choice = dq.correct_answer
    )

    -- Century Club: every 100 lifetime predictions submitted earns another tier.
    when 'century_club' then (
      select floor(count(*) / 100.0)::int
      from predictions pr
      where pr.user_id = auth.uid()
    )

    -- Iron Streak: every 14-day streak milestone your best-ever streak has
    -- passed earns another tier (14, 28, 42...).
    when 'iron_streak' then (
      select floor(coalesce(longest_streak, 0) / 14.0)::int
      from streaks where user_id = auth.uid()
    )

    -- Golden Touch: every golden star you've earned is its own tier.
    when 'golden_touch' then (
      select coalesce(golden_stars, 0)
      from streaks where user_id = auth.uid()
    )

    -- Speed Demon: every 5 correct calls made during a daily drop bonus window.
    when 'speed_demon' then (
      select floor(count(*) / 5.0)::int
      from predictions pr
      join daily_questions dq on dq.id = pr.question_id
      where pr.user_id = auth.uid() and pr.drop_bonus is true
        and dq.resolved is true and pr.choice = dq.correct_answer
    )

    -- Point Baron: every 1000 lifetime points earns another tier.
    when 'point_baron' then (
      select floor(coalesce(total_points, 0) / 1000.0)::int
      from streaks where user_id = auth.uid()
    )

    -- Regular: every 30 distinct days you've made at least one pick.
    when 'regular' then (
      select floor(count(distinct dq.question_date) / 30.0)::int
      from predictions pr
      join daily_questions dq on dq.id = pr.question_id
      where pr.user_id = auth.uid()
    )

    else 0
  end;

  if v_count is null or v_count <= 0 then
    return null;
  end if;

  select times_earned into v_prev from user_achievements
    where user_id = auth.uid() and achievement_key = p_key;

  if v_prev is null then
    insert into user_achievements (user_id, achievement_key, times_earned)
    values (auth.uid(), p_key, v_count);
    return v_count;
  elsif v_count > v_prev then
    update user_achievements set times_earned = v_count, earned_at = now()
      where user_id = auth.uid() and achievement_key = p_key;
    return v_count;
  else
    return null;
  end if;
end;
$function$;
