-- Void a question (e.g. a postponed game): nobody gets it right or wrong.
-- A voided question is stored as resolved = true, correct_answer = null,
-- voided = true, with a reason players see on their results.
--   * resolve_day already skips questions with no correct_answer, so a void
--     awards no points and no buddy bonus. Streaks never depend on being
--     right, so they are untouched.
--   * Perfect Day (resolve_day + award_achievement): a voided question
--     counts as "not missed", so it can't take a perfect day away.
--   * weekly_top_predictor: voided calls are left out of the accuracy math.
-- Every other reader (friends feed, user cards, who-called-it, group
-- matchups, category scorers) already ignores rows with no correct_answer.

alter table public.daily_questions
  add column if not exists voided boolean not null default false,
  add column if not exists void_reason text;

create or replace function public.admin_void_question(p_question_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;

  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'A reason is required so players can see why it was voided.';
  end if;

  -- Points for a scored day are already paid out; voiding afterwards would not take them back.
  if exists (
    select 1
    from public.day_resolutions dr
    join public.daily_questions q on q.question_date = dr.target_date
    where q.id = p_question_id
  ) then
    raise exception 'That day has already been scored, so this question can''t be voided.';
  end if;

  update public.daily_questions
  set resolved = true,
      correct_answer = null,
      voided = true,
      void_reason = btrim(p_reason)
  where id = p_question_id;
end;
$function$;

-- Undo works for voided questions too: back to open, void flags cleared.
create or replace function public.admin_unresolve_question(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;

  update public.daily_questions
  set resolved = false, correct_answer = null, voided = false, void_reason = null
  where id = p_question_id;
end;
$function$;

-- Weekly top predictor: leave voided calls out of both sides of the accuracy.
create or replace function public.weekly_top_predictor(p_week_start text, p_today text)
returns jsonb
language sql
stable
set search_path to 'public'
as $function$
  with wk as (
    select pr.user_id, (pr.choice = dq.correct_answer) as ok
    from predictions pr
    join daily_questions dq on dq.id = pr.question_id
    where dq.resolved is true
      and dq.voided is not true
      and dq.question_date::text >= p_week_start
      and dq.question_date::text <= p_today
  ),
  best as (
    select w.user_id, p.username,
           count(*) filter (where w.ok) as correct,
           count(*) as total
    from wk w
    join profiles p on p.id = w.user_id
      and p.hide_from_leaderboard = false
      and p.banned = false
    group by w.user_id, p.username
    having count(*) >= 3
    order by (count(*) filter (where w.ok))::numeric / count(*) desc,
             count(*) filter (where w.ok) desc,
             w.user_id
    limit 1
  )
  select jsonb_build_object(
    'has_resolved', exists (select 1 from wk),
    'best', (select to_jsonb(b) from best b)
  )
$function$;

-- Perfect Day in resolve_day and award_achievement: patch the one condition in
-- each, and fail loudly (rolling the migration back) if the text isn't found.
do $mig$
declare
  d text;
  old_txt text;
  new_txt text;
begin
  d := pg_get_functiondef('public.resolve_day(date)'::regprocedure);
  old_txt := E'    and pr.choice = dq.correct_answer\n  group by pr.user_id\n  having count(distinct dq.category) = 3;';
  new_txt := E'    and (dq.voided or pr.choice = dq.correct_answer)\n  group by pr.user_id\n  having count(distinct dq.category) = 3;';
  if position(old_txt in d) = 0 then
    raise exception 'resolve_day: perfect-day condition not found, nothing changed';
  end if;
  execute replace(d, old_txt, new_txt);

  d := pg_get_functiondef('public.award_achievement(text)'::regprocedure);
  old_txt := 'filter (where dq.resolved is true and pr.choice = dq.correct_answer)';
  new_txt := 'filter (where dq.resolved is true and (dq.voided or pr.choice = dq.correct_answer))';
  if position(old_txt in d) = 0 then
    raise exception 'award_achievement: perfect_day condition not found, nothing changed';
  end if;
  execute replace(d, old_txt, new_txt);
end
$mig$;
