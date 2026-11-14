-- Beat the crowd: a correct call on the side FEWER players picked earns +50 on top of the usual points.
--
-- Rules
--   * Crowd = the picks on that question when the day is scored. The minority side is the side with
--     strictly fewer picks (ties get no bonus).
--   * Needs at least 10 picks on the question, so a tiny crowd can't hand out or farm the bonus.
--     (The Marqit+ contrarian score uses 5; this one is stricter because it awards points.)
--   * +50 flat, whether or not the call is boosted. Marqit+ plays no part in it: everyone is scored the same.
--   * Only days scored AFTER this is applied are affected. resolve_day refuses to score a day twice,
--     so past days keep the points they already have.
--   * predictions.beat_crowd records which calls earned it, so the app can show it later and so
--     the bonus can be audited.
--
-- This replaces resolve_day. Everything else in the function (boosts, drop bonus, buddy +25, perfect
-- day +100, streaks, freezes, rival duels, rank snapshots) is unchanged from the version in production.
-- ROLLBACK: re-run the previous resolve_day definition; the column can stay.

begin;

alter table public.predictions add column if not exists beat_crowd boolean not null default false;

create or replace function public.resolve_day(target_date date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
#variable_conflict use_variable
declare
  week_start date := date_trunc('week', target_date)::date;
  caller_email text := (select email from auth.users where id = auth.uid());
  already_resolved boolean;
  q record;
  p record;
  buddy_pred record;
  correct_a integer;
  correct_b integer;
  crowd_bonus constant integer := 50;   -- points for a correct call against the crowd
  crowd_min   constant integer := 10;   -- picks needed on a question before the bonus can apply
  yes_n integer;
  no_n integer;
  earned_crowd boolean;
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;

  if not exists (select 1 from public.daily_questions where question_date = target_date) then
    raise exception 'No questions exist for %, so there is nothing to score.', target_date;
  end if;

  select exists(select 1 from public.day_resolutions dr where dr.target_date = target_date) into already_resolved;
  if already_resolved then
    raise exception 'This day (%) has already been resolved. Points were not awarded a second time.', target_date;
  end if;
  insert into public.day_resolutions (target_date) values (target_date);

  for q in
    select id, correct_answer, is_boosted
    from public.daily_questions
    where question_date = target_date and resolved = true and correct_answer is not null
  loop
    select count(*) filter (where pr.choice = 'yes'), count(*) filter (where pr.choice = 'no')
      into yes_n, no_n
      from public.predictions pr where pr.question_id = q.id;

    for p in select id, user_id, choice, drop_bonus from public.predictions where question_id = q.id loop
      if p.choice = q.correct_answer then
        earned_crowd := (yes_n + no_n) >= crowd_min
          and ((q.correct_answer = 'yes' and yes_n < no_n) or (q.correct_answer = 'no' and no_n < yes_n));

        update public.streaks
        set total_points = total_points
              + (case when q.is_boosted then 200 else 100 end)
              + (case when p.drop_bonus then 50 else 0 end)
              + (case when earned_crowd then crowd_bonus else 0 end),
            updated_at = now()
        where user_id = p.user_id;

        if earned_crowd then
          update public.predictions set beat_crowd = true where id = p.id;
        end if;
      end if;

      select pr.choice into buddy_pred
      from public.predictions pr
      join public.profiles me on me.id = p.user_id
      where pr.question_id = q.id and pr.user_id = me.buddy_user_id;

      if found and buddy_pred.choice = p.choice then
        update public.streaks set total_points = total_points + 25, updated_at = now()
        where user_id = p.user_id;
      end if;
    end loop;
  end loop;

  create temporary table _played_today on commit drop as
  select pr.user_id
  from public.predictions pr
  join public.daily_questions dq on dq.id = pr.question_id
  where dq.question_date = target_date
  group by pr.user_id
  having count(distinct dq.id) = (select count(*) from public.daily_questions dq2 where dq2.question_date = target_date);

  create temporary table _perfect_today on commit drop as
  select pr.user_id
  from public.predictions pr
  join public.daily_questions dq on dq.id = pr.question_id
  where dq.question_date = target_date
    and dq.resolved = true
    and (dq.voided or pr.choice = dq.correct_answer)
  group by pr.user_id
  having count(distinct dq.id) = (select count(*) from public.daily_questions dq2 where dq2.question_date = target_date);

  update public.streaks
  set total_points = total_points + 100, updated_at = now()
  where user_id in (select user_id from _perfect_today);

  insert into public.weekly_frame_earned (user_id, week_start)
  select pt.user_id, week_start
  from _perfect_today pt
  where not exists (
    select 1 from public.weekly_frame_earned wfe
    where wfe.user_id = pt.user_id and wfe.week_start = week_start
  );

  update public.streaks
  set freeze_available = true, freeze_week_start = week_start
  where freeze_week_start is null or freeze_week_start < week_start;

  update public.streaks s
  set
    current_streak = case when s.last_played_date = target_date - 1 then s.current_streak + 1 else 1 end,
    longest_streak = greatest(
      s.longest_streak,
      case when s.last_played_date = target_date - 1 then s.current_streak + 1 else 1 end
    ),
    golden_stars = case
      when (case when s.last_played_date = target_date - 1 then s.current_streak + 1 else 1 end) % 5 = 0
      then s.golden_stars + 1
      else s.golden_stars
    end,
    last_played_date = target_date,
    updated_at = now()
  where s.user_id in (select user_id from _played_today);

  update public.streaks s
  set freeze_available = false, last_played_date = target_date, updated_at = now()
  where s.user_id not in (select user_id from _played_today)
    and s.freeze_available = true
    and s.last_played_date = target_date - 1;

  update public.streaks s
  set current_streak = 0, updated_at = now()
  where s.user_id not in (select user_id from _played_today)
    and s.last_played_date is distinct from target_date;

  for p in
    select a.user_id as user_a, a.rival_user_id as user_b
    from public.rival_duel_activations a
    join public.rival_duel_activations b
      on b.duel_date = a.duel_date
      and b.user_id = a.rival_user_id
      and b.rival_user_id = a.user_id
    where a.duel_date = target_date
      and a.user_id < a.rival_user_id
  loop
    select count(*) into correct_a
    from public.predictions pr
    join public.daily_questions dq on dq.id = pr.question_id
    where pr.user_id = p.user_a and dq.question_date = target_date
      and dq.resolved = true and pr.choice = dq.correct_answer;

    select count(*) into correct_b
    from public.predictions pr
    join public.daily_questions dq on dq.id = pr.question_id
    where pr.user_id = p.user_b and dq.question_date = target_date
      and dq.resolved = true and pr.choice = dq.correct_answer;

    if correct_a > correct_b then
      update public.streaks set golden_stars = golden_stars + 1, updated_at = now() where user_id = p.user_a;
      update public.streaks set golden_stars = greatest(golden_stars - 1, 0), updated_at = now() where user_id = p.user_b;
    elsif correct_b > correct_a then
      update public.streaks set golden_stars = golden_stars + 1, updated_at = now() where user_id = p.user_b;
      update public.streaks set golden_stars = greatest(golden_stars - 1, 0), updated_at = now() where user_id = p.user_a;
    end if;
  end loop;

  insert into public.rank_snapshots (snapshot_date, user_id, rank, total_points)
  select target_date, s.user_id, row_number() over (order by s.total_points desc, s.user_id), s.total_points
  from public.streaks s
  where s.total_points > 0
  on conflict (snapshot_date, user_id) do update
    set rank = excluded.rank, total_points = excluded.total_points;
end;
$function$;

commit;
