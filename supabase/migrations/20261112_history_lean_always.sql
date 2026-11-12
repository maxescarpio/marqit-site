-- Nov 12: every question, every day, gets History & lean (5 bullets + a lean %). No exceptions.
--
-- Why this exists: some approved rows had bullets but a blank lean, and any question the AI drafter missed
-- (out of credit, skipped, over the 6-per-run cap, not yet inside the 3-day window) had no panel at all.
--
-- How it is guaranteed now:
--   1. baseline_insight(question_id) builds 5 bullets + a lean from Marqit's own resolved-question history.
--   2. A trigger on daily_questions creates that baseline row the moment a question is added.
--   3. A trigger on question_insights refuses to store a row without a lean or without 5 bullets (it fills the gap).
--   4. The draft-insights edge function upgrades baseline rows with a researched AI draft (runs hourly).
--   5. One-time backfill below fixes every existing question.

-- ---------------------------------------------------------------------------------------------------------
-- Question type, so base rates compare like with like (team wins vs. stat lines vs. "No. 1" charts).
create or replace function public.question_class(p_text text)
returns text language sql immutable set search_path = public as $$
  select case
    when p_text ~* '\m(defeat|beat)\M' then 'win'
    when p_text ~* 'no\. ?1' then 'number1'
    when p_text ~* '(over [0-9]|under [0-9]|more than|at least|or more|[0-9]\+|top [0-9]|\$[0-9])' then 'threshold'
    else 'other'
  end
$$;

-- ---------------------------------------------------------------------------------------------------------
-- Baseline: honest numbers from Marqit's own results. Always returns exactly 5 bullets and a lean of 30-70.
create or replace function public.baseline_insight(p_question_id uuid)
returns table(bullets jsonb, lean smallint, basis text)
language plpgsql stable security definer set search_path = public as $$
declare
  q record;
  cls text;
  cat_label text;
  type_label text;
  y_cls int := 0; n_cls int := 0;
  y_cat int := 0; n_cat int := 0;
  y_30 int := 0;  n_30 int := 0;
  c_pl int := 0;  n_pl int := 0;
  y_crowd int := 0; n_crowd int := 0;
  rate numeric; n_used int; lean_calc numeric; lean_final int;
  b1 text; b2 text; b3 text; b4 text; b5 text; basis_txt text;
begin
  select d.id, d.question_text, d.category, d.question_date into q
    from public.daily_questions d where d.id = p_question_id;
  if not found then return; end if;

  cls := public.question_class(q.question_text);
  cat_label := case q.category when 'pop_culture' then 'pop culture' when 'news' then 'news' else 'sports' end;
  type_label := case cls
    when 'win' then cat_label || ' win-or-lose'
    when 'number1' then 'No. 1 chart'
    when 'threshold' then cat_label || ' over/under-style'
    else cat_label end;

  select count(*) filter (where d.correct_answer = 'yes'), count(*) into y_cls, n_cls
    from public.daily_questions d
   where d.resolved and not d.voided and d.correct_answer in ('yes','no') and d.id <> q.id
     and d.category = q.category and public.question_class(d.question_text) = cls;

  select count(*) filter (where d.correct_answer = 'yes'), count(*) into y_cat, n_cat
    from public.daily_questions d
   where d.resolved and not d.voided and d.correct_answer in ('yes','no') and d.id <> q.id
     and d.category = q.category;

  select count(*) filter (where d.correct_answer = 'yes'), count(*) into y_30, n_30
    from public.daily_questions d
   where d.resolved and not d.voided and d.correct_answer in ('yes','no') and d.id <> q.id
     and d.category = q.category and d.question_date >= q.question_date - 30;

  select count(*) filter (where p.choice = d.correct_answer), count(*) into c_pl, n_pl
    from public.predictions p join public.daily_questions d on d.id = p.question_id
   where d.resolved and not d.voided and d.correct_answer in ('yes','no') and d.id <> q.id
     and d.category = q.category and public.question_class(d.question_text) = cls;

  select count(*) filter (where p.choice = 'yes'), count(*) into y_crowd, n_crowd
    from public.predictions p where p.question_id = q.id;

  -- Which sample drives the lean: same type if big enough, else the whole category, else a coin flip.
  if n_cls >= 8 then rate := y_cls::numeric / n_cls; n_used := n_cls;
  elsif n_cat >= 8 then rate := y_cat::numeric / n_cat; n_used := n_cat;
  else rate := 0.5; n_used := 0; end if;
  -- Shrink toward 50% when the sample is small, and never let a base rate alone go past 30/70.
  lean_calc := 50 + (rate - 0.5) * 100 * (n_used::numeric / (n_used + 10));
  lean_final := greatest(30, least(70, round(lean_calc)::int));

  if n_cls >= 8 then
    b1 := format('Across %s past Marqit %s calls, %s resolved YES (%s%%).', n_cls, type_label, y_cls, round(100.0 * y_cls / n_cls));
    basis_txt := format('Marqit baseline: %s of %s past %s calls resolved YES (%s%%).', y_cls, n_cls, type_label, round(100.0 * y_cls / n_cls));
  elsif n_cat >= 8 then
    b1 := format('Across %s past Marqit %s calls of every type, %s resolved YES (%s%%).', n_cat, cat_label, y_cat, round(100.0 * y_cat / n_cat));
    basis_txt := format('Marqit baseline: %s of %s past %s calls resolved YES (%s%%).', y_cat, n_cat, cat_label, round(100.0 * y_cat / n_cat));
  else
    b1 := 'Marqit has too few settled calls of this type to lean either way yet, so this starts at a toss-up.';
    basis_txt := 'Marqit baseline: not enough settled calls of this type yet, so this starts near 50%.';
  end if;

  if n_30 >= 5 then
    b2 := format('In the last 30 days, %s of %s settled Marqit %s calls resolved YES.', y_30, n_30, cat_label);
  elsif n_cat > 0 then
    b2 := format('Marqit has settled %s %s calls so far, %s of them YES.', n_cat, cat_label, y_cat);
  else
    b2 := 'Marqit has not settled any calls in this category yet.';
  end if;

  if n_pl >= 30 then
    b3 := format('Players have called this type correctly %s%% of the time (%s of %s picks).', round(100.0 * c_pl / n_pl), c_pl, n_pl);
  else
    b3 := 'Not enough player picks on this type yet to say how well the crowd does on it.';
  end if;

  if n_crowd >= 1 then
    b4 := format('%s player%s called this so far, %s%% on YES. That is the crowd''s read, not a result.', n_crowd, case when n_crowd = 1 then ' has' else 's have' end, round(100.0 * y_crowd / n_crowd));
  else
    b4 := 'No players have called this yet. The crowd split shows up after the first calls.';
  end if;

  b5 := 'This lean comes from Marqit''s own past results. A researched breakdown replaces it once it is ready.';

  return query select to_jsonb(array[b1, b2, b3, b4, b5]), lean_final::smallint, left(basis_txt, 200);
end;
$$;

revoke all on function public.baseline_insight(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------------------
-- No stored row can be missing its lean or its 5 bullets. Fills the gap instead of erroring, so admin.html
-- approvals and the edge function keep working.
create or replace function public.question_insights_require_lean()
returns trigger language plpgsql security definer set search_path = public as $$
declare base record;
begin
  -- Rejecting a draft sends the question back to the Marqit baseline; a question never goes without History & lean.
  if new.status = 'rejected' then
    select * into base from public.baseline_insight(new.question_id);
    if base.lean is not null then
      new.bullets := base.bullets;
      new.lean_yes_pct := base.lean;
      new.lean_basis := base.basis;
      new.source := 'baseline';
      new.status := 'approved';
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if new.lean_yes_pct is null or new.lean_basis is null or btrim(new.lean_basis) = ''
     or jsonb_typeof(new.bullets) is distinct from 'array' or jsonb_array_length(new.bullets) < 5 then
    select * into base from public.baseline_insight(new.question_id);
    if base.lean is null then return new; end if;
    if new.lean_yes_pct is null or new.lean_basis is null or btrim(new.lean_basis) = '' then
      new.lean_yes_pct := base.lean;
      new.lean_basis := base.basis;
    end if;
    if jsonb_typeof(new.bullets) is distinct from 'array' or jsonb_array_length(new.bullets) < 5 then
      new.bullets := base.bullets;
      new.source := 'baseline';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists question_insights_require_lean on public.question_insights;
create trigger question_insights_require_lean
  before insert or update on public.question_insights
  for each row execute function public.question_insights_require_lean();

-- ---------------------------------------------------------------------------------------------------------
-- The moment a question exists, it has a History & lean row (live, approved, source = 'baseline').
create or replace function public.daily_questions_seed_insight()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.question_insights (question_id, bullets, status, source)
  values (new.id, '[]'::jsonb, 'approved', 'baseline')
  on conflict (question_id) do nothing;
  return new;
end;
$$;

drop trigger if exists daily_questions_seed_insight on public.daily_questions;
create trigger daily_questions_seed_insight
  after insert on public.daily_questions
  for each row execute function public.daily_questions_seed_insight();

-- ---------------------------------------------------------------------------------------------------------
-- One-time backfill.
-- (a) Every question that has no row at all gets a baseline row.
insert into public.question_insights (question_id, bullets, status, source)
select d.id, '[]'::jsonb, 'approved', 'baseline'
  from public.daily_questions d
  left join public.question_insights i on i.question_id = d.id
 where i.question_id is null and not d.voided
on conflict (question_id) do nothing;

-- (b) Every existing row with a blank lean gets one (the trigger fills it on update).
update public.question_insights set lean_yes_pct = null
 where lean_yes_pct is null or lean_basis is null or btrim(lean_basis) = '';

-- Watch list for admin: open questions whose lean is only the baseline (waiting on the AI draft).
create or replace view public.insights_baseline_watch as
select d.question_date, d.slot, d.question_text, i.source, i.status, i.lean_yes_pct, i.lean_basis
  from public.daily_questions d join public.question_insights i on i.question_id = d.id
 where not d.resolved and not d.voided and (i.source = 'baseline' or i.lean_basis like 'Marqit baseline:%')
 order by d.question_date, d.slot;
revoke all on public.insights_baseline_watch from public, anon, authenticated;

-- Drafting now runs hourly (it only works on questions that still need a researched draft).
select cron.alter_job((select jobid from cron.job where jobname = 'draft-insights-daily'), schedule := '5 * * * *');
