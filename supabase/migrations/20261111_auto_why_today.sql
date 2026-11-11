-- "Why it's on today" line, step 2: the question writer drafts it, the admin can edit it,
-- and approving a draft carries it onto the posted question.
-- (daily_questions.why_today was added in 20261111_daily_question_why_today.sql.)

alter table public.question_drafts add column if not exists why_today text;

-- Approving a draft copies the draft's line onto the new question. Same signature as before.
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
  v_why text;
  new_id uuid;
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;

  select question_date, slot, why_today into v_question_date, v_slot, v_why from public.question_drafts where id = p_draft_id;
  if v_question_date is null then
    raise exception 'Draft not found';
  end if;

  if v_slot is not null and exists (
    select 1 from public.daily_questions where question_date = v_question_date and slot = v_slot
  ) then
    v_slot := null;
  end if;

  insert into public.daily_questions (question_date, category, question_text, lock_time, resolution_criteria, slot, why_today)
  values (v_question_date, p_category, p_question_text, p_lock_time, p_resolution_criteria, v_slot, nullif(trim(v_why), ''))
  returning id into new_id;

  update public.question_drafts
  set status = 'approved', reviewed_at = now(), posted_question_id = new_id
  where id = p_draft_id;

  return new_id;
end;
$$;

-- Admin-only: set or clear the line on a posted question (used right after approving a draft).
create or replace function public.admin_set_question_why_today(p_question_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;
  update public.daily_questions set why_today = nullif(left(trim(coalesce(p_text, '')), 70), '') where id = p_question_id;
end;
$$;
revoke all on function public.admin_set_question_why_today(uuid, text) from public, anon;
grant execute on function public.admin_set_question_why_today(uuid, text) to authenticated;
