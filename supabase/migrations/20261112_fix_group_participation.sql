-- Nov 12: get_group_participation_today never worked ("user_id" and "answered_count" were ambiguous between the
-- RETURNS TABLE columns and the query), so Groups always showed "Couldn't load today's participation."
-- Columns are now qualified, voided questions are not counted, and the sort uses the column position.
create or replace function public.get_group_participation_today(p_group_id uuid)
returns table(user_id uuid, username text, answered_count bigint, total_today bigint)
language plpgsql security definer set search_path to 'public' as $$
declare
  v_total bigint;
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  if not exists (select 1 from group_members m where m.group_id = p_group_id and m.user_id = auth.uid()) then
    raise exception 'not a member of this group';
  end if;

  select count(*) into v_total from daily_questions dq where dq.question_date = v_today and not dq.voided;

  return query
  select gm.user_id, p.username,
         count(distinct pr.question_id)::bigint,
         v_total
    from group_members gm
    join profiles p on p.id = gm.user_id
    left join predictions pr on pr.user_id = gm.user_id
       and pr.question_id in (select dq.id from daily_questions dq where dq.question_date = v_today and not dq.voided)
   where gm.group_id = p_group_id
   group by gm.user_id, p.username
   order by 3 asc, p.username asc;
end;
$$;
