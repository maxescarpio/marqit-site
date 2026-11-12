-- Admin-only, read-only check: rebuilds every player's streak from their play history
-- (a full day = all of that day's questions answered; one freeze per week covers one
-- missed day) and lists anyone whose stored streak is lower than that. Run after scoring.
-- Usage (signed in as admin): select * from public.check_streak_drift();
create or replace function public.check_streak_drift()
returns table(user_id uuid, username text, stored_current int, expected_current int,
              stored_longest int, expected_longest int)
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
  start_d date; end_d date; dd date; wk date; tot int;
  s record; st int; lp date; f boolean; fw date; lg int; pl boolean;
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then
    raise exception 'Not authorized';
  end if;
  select min(question_date) into start_d from daily_questions;
  select max(target_date) into end_d from day_resolutions;
  if start_d is null or end_d is null then return; end if;

  for s in select st2.user_id as uid, st2.current_streak as cs, st2.longest_streak as ls,
                  st2.last_played_date as lpd, pr.username as uname
           from streaks st2 left join profiles pr on pr.id = st2.user_id loop
    st := 0; lp := null; f := true; fw := start_d - 7; lg := 0;
    for dd in select g::date from generate_series(start_d, end_d, interval '1 day') g loop
      wk := date_trunc('week', dd)::date;
      select count(*) into tot from daily_questions q where q.question_date = dd;
      pl := tot > 0 and (select count(distinct q.id) from predictions p
                         join daily_questions q on q.id = p.question_id
                         where p.user_id = s.uid and q.question_date = dd) = tot;
      if fw < wk then f := true; fw := wk; end if;
      if pl then
        if lp = dd - 1 then st := st + 1; else st := 1; end if;
        lg := greatest(lg, st); lp := dd;
      elsif f and lp = dd - 1 then f := false; lp := dd;
      elsif lp is distinct from dd then st := 0;
      end if;
    end loop;
    if lp is not distinct from s.lpd and (st > s.cs or lg > s.ls) then
      user_id := s.uid; username := s.uname; stored_current := s.cs; expected_current := st;
      stored_longest := s.ls; expected_longest := lg; return next;
    end if;
  end loop;
end $$;
revoke all on function public.check_streak_drift() from public, anon;
grant execute on function public.check_streak_drift() to authenticated;
