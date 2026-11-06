-- Marqit+ perk: unlimited pick edits until lock.
-- Free players keep the existing limit of 3 edits per day. Paying members (is_marqit_plus()) are not counted or capped.
-- Everything else in submit_daily_predictions is unchanged: lock-time check, ban check, drop bonus, all-or-nothing write.
-- Small, additive: one CREATE OR REPLACE of one function. No table or permission changes.

create or replace function public.submit_daily_predictions(p_answers jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  today_et date;
  rec jsonb;
  qid uuid;
  choice text;
  q record;
  is_edit boolean := false;
  new_edit_count int;
  is_banned boolean;
  v_drop record;
  v_in_window boolean;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  select banned into is_banned from public.profiles where id = uid;
  if is_banned then
    raise exception 'Your account has been suspended.';
  end if;

  if p_answers is null or jsonb_typeof(p_answers) <> 'array' or jsonb_array_length(p_answers) = 0 then
    raise exception 'No answers provided';
  end if;

  for rec in select * from jsonb_array_elements(p_answers)
  loop
    qid := (rec->>'question_id')::uuid;
    choice := rec->>'choice';
    if choice is null or choice not in ('yes','no') then
      raise exception 'Invalid choice';
    end if;

    select * into q from public.daily_questions where id = qid;
    if not found then
      raise exception 'Question not found';
    end if;
    if q.lock_time <= now() then
      raise exception 'This question has already locked — refresh and try again.';
    end if;

    if today_et is null then
      today_et := q.question_date;
    end if;

    if exists (select 1 from public.predictions where user_id = uid and question_id = qid) then
      is_edit := true;
    end if;
  end loop;

  if is_edit then
    if public.is_marqit_plus() then
      -- Marqit+ members edit as often as they like until the question locks; nothing is counted.
      new_edit_count := 0;
    else
      insert into public.prediction_edit_counts (user_id, question_date, edit_count, updated_at)
      values (uid, today_et, 1, now())
      on conflict (user_id, question_date) do update
        set edit_count = public.prediction_edit_counts.edit_count + 1,
            updated_at = now()
      where public.prediction_edit_counts.edit_count < 3
      returning edit_count into new_edit_count;

      if new_edit_count is null then
        raise exception 'You''ve used all 3 edits for today''s predictions.';
      end if;
    end if;
  else
    select edit_count into new_edit_count from public.prediction_edit_counts where user_id = uid and question_date = today_et;
    if new_edit_count is null then
      new_edit_count := 0;
    end if;
  end if;

  select * into v_drop from public.daily_drops where question_date = today_et;
  v_in_window := found and now() >= v_drop.drop_time and now() < v_drop.drop_time + make_interval(secs => v_drop.window_seconds);

  for rec in select * from jsonb_array_elements(p_answers)
  loop
    qid := (rec->>'question_id')::uuid;
    choice := rec->>'choice';

    insert into public.predictions (user_id, question_id, choice, drop_bonus)
    values (uid, qid, choice, v_in_window)
    on conflict (user_id, question_id) do update
      set choice = excluded.choice,
          drop_bonus = public.predictions.drop_bonus or v_in_window;
  end loop;

  return new_edit_count;
end;
$function$;
