-- Top-three daily questions
--
-- Before: every day had exactly one sports, one pop_culture and one news question
-- (enforced by UNIQUE (question_date, category)).
-- After:  every day has the THREE questions that matter most that day, whatever
-- their categories are -- two sports + one pop culture, three news, etc.
--
-- Days that are already scheduled keep their questions untouched; they are just
-- numbered into slots 1-3 (sports, pop_culture, news order) so they behave exactly
-- as before. The new drafting logic only fills days that don't have three yet.
--
-- This migration is backward compatible with the site code that is live today.

-- 1. slot = the question's position on the day (1 = biggest story). -------------
alter table public.daily_questions add column if not exists slot smallint;

update public.daily_questions dq
set slot = r.rn
from (
  select id,
         row_number() over (
           partition by question_date
           order by case category when 'sports' then 1 when 'pop_culture' then 2 else 3 end,
                    created_at, id
         ) as rn
  from public.daily_questions
) r
where dq.id = r.id and dq.slot is null;

-- 2. Any insert (admin form, bulk add, draft approval) gets the next free slot ----
--    automatically, and a day can never hold more than three questions.
create or replace function public.assign_question_slot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.slot is not null then
    return new; -- explicit slot: the unique index below enforces it
  end if;
  if tg_op = 'INSERT' or new.question_date is distinct from old.question_date then
    select min(s) into new.slot
    from generate_series(1, 3) s
    where not exists (
      select 1 from public.daily_questions q
      where q.question_date = new.question_date and q.slot = s and q.id is distinct from new.id
    );
    if new.slot is null then
      raise exception 'Already 3 questions on % -- a day holds at most three. Delete or move one first.', new.question_date;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.assign_question_slot() from public, anon, authenticated;

drop trigger if exists daily_questions_assign_slot on public.daily_questions;
create trigger daily_questions_assign_slot
  before insert or update of question_date on public.daily_questions
  for each row execute function public.assign_question_slot();

alter table public.daily_questions alter column slot set not null;
alter table public.daily_questions drop constraint if exists daily_questions_slot_check;
alter table public.daily_questions add constraint daily_questions_slot_check check (slot between 1 and 3);

-- 3. One-per-category is gone; one-per-slot replaces it. ------------------------
alter table public.daily_questions drop constraint if exists daily_questions_question_date_category_key;
create unique index if not exists daily_questions_date_slot_key on public.daily_questions (question_date, slot);

comment on column public.daily_questions.slot is
  'Position of the question within its day, 1-3 (1 = biggest story). Categories are no longer fixed per day.';

-- 4. Drafts remember their rank and why the story was picked. -------------------
alter table public.question_drafts add column if not exists slot smallint;
alter table public.question_drafts add column if not exists trend_note text;

-- 5. Admin: bulk add. Items without "slot" are appended; items with "slot" replace
--    that slot's question (only while it is unresolved), like the old category upsert.
create or replace function public.admin_bulk_add_questions(p_date date, p_questions jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
  q jsonb;
  v_slot smallint;
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;

  for q in select * from jsonb_array_elements(p_questions)
  loop
    v_slot := nullif(q->>'slot', '')::smallint;
    if v_slot is null then
      insert into public.daily_questions (question_date, category, question_text, lock_time)
      values (p_date, q->>'category', q->>'question_text', (q->>'lock_time')::timestamptz);
    else
      insert into public.daily_questions (question_date, slot, category, question_text, lock_time)
      values (p_date, v_slot, q->>'category', q->>'question_text', (q->>'lock_time')::timestamptz)
      on conflict (question_date, slot) do update
        set category = excluded.category,
            question_text = excluded.question_text,
            lock_time = excluded.lock_time
        where public.daily_questions.resolved = false;
    end if;
  end loop;
end;
$$;

-- 6. Admin: approving a draft keeps the rank the drafter gave it (if still free). -
create or replace function public.admin_approve_question_draft(
  p_draft_id uuid, p_question_text text, p_category text,
  p_lock_time timestamp with time zone, p_resolution_criteria text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
  v_question_date date;
  v_slot smallint;
  new_id uuid;
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;

  select question_date, slot into v_question_date, v_slot from public.question_drafts where id = p_draft_id;
  if v_question_date is null then
    raise exception 'Draft not found';
  end if;

  if v_slot is not null and exists (
    select 1 from public.daily_questions where question_date = v_question_date and slot = v_slot
  ) then
    v_slot := null; -- rank already taken: fall back to the next free slot
  end if;

  insert into public.daily_questions (question_date, category, question_text, lock_time, resolution_criteria, slot)
  values (v_question_date, p_category, p_question_text, p_lock_time, p_resolution_criteria, v_slot)
  returning id into new_id;

  update public.question_drafts
  set status = 'approved', reviewed_at = now(), posted_question_id = new_id
  where id = p_draft_id;

  return new_id;
end;
$$;

-- 7. Admin: drafts list in rank order (small edit to the existing definition). ---
do $mig$
declare
  d text;
begin
  d := pg_get_functiondef('public.admin_list_question_drafts(text)'::regprocedure);
  if position('order by question_date asc, category asc' in d) > 0 then
    d := replace(d, 'order by question_date asc, category asc',
                    'order by question_date asc, slot asc nulls last, category asc');
    execute d;
  elsif position('slot asc nulls last' in d) = 0 then
    raise exception 'admin_list_question_drafts: expected ORDER BY not found';
  end if;
end
$mig$;

-- 8. Scoring: "played the whole day" / "perfect day" used to mean "answered one question
--    in each of the 3 categories". Now it means "answered every question that day".
--    For every day scheduled today (3 questions, 3 distinct categories) the result is identical.
do $mig$
declare
  d text;
  old_txt constant text := 'having count(distinct dq.category) = 3';
  new_txt constant text := 'having count(distinct dq.id) = (select count(*) from public.daily_questions dq2 where dq2.question_date = target_date)';
  n int;
begin
  d := pg_get_functiondef('public.resolve_day(date)'::regprocedure);
  n := (length(d) - length(replace(d, old_txt, ''))) / length(old_txt);
  if n = 2 then
    execute replace(d, old_txt, new_txt);
  elsif position('dq2.question_date' in d) = 0 then
    raise exception 'resolve_day: expected % occurrences of the category count, found %', 2, n;
  end if;
end
$mig$;
