-- Weekly group-vs-group matchups. ADDITIVE ONLY: one new read-only function, no new tables.
-- Each week (Mon-Sun) groups are paired by overall rank (1v2, 3v4, ...). Nothing is stored; it is computed live.
-- Score = average points per member this week (100 per correct call), so a small group can beat a big one.
create or replace function public.get_group_matchups()
 returns table(pair_no int, group_id uuid, name text, symbol text, member_count bigint,
               correct_calls bigint, score numeric, opponent_id uuid, week_start date)
 language sql stable security definer set search_path to 'public'
as $function$
  with wk as (select (date_trunc('week', (now() at time zone 'America/New_York')::date))::date as ws),
  ranked as (
    select g.id, g.name, g.symbol, count(gm.user_id) as mc,
           coalesce(sum(s.total_points),0) as tp,
           row_number() over (order by coalesce(sum(s.total_points),0) desc, count(gm.user_id) desc, g.id) as rn
    from groups g
    join group_members gm on gm.group_id = g.id
    join profiles pf on pf.id = gm.user_id and pf.banned = false
    left join streaks s on s.user_id = gm.user_id
    group by g.id, g.name, g.symbol
  ),
  wins as (
    select gm.group_id, count(*) as cc
    from group_members gm
    join predictions p on p.user_id = gm.user_id
    join daily_questions q on q.id = p.question_id
    cross join wk
    where q.question_date >= wk.ws and q.question_date < wk.ws + 7
      and q.correct_answer is not null and p.choice = q.correct_answer
    group by gm.group_id
  ),
  scored as (
    select r.*, coalesce(w.cc,0) as cc, round(coalesce(w.cc,0) * 100.0 / r.mc, 1) as sc,
           ((r.rn + 1) / 2)::int as pn
    from ranked r left join wins w on w.group_id = r.id
  )
  select a.pn, a.id, a.name, a.symbol, a.mc, a.cc, a.sc,
         (select b.id from scored b where b.pn = a.pn and b.id <> a.id limit 1),
         (select ws from wk)
  from scored a
  order by a.pn, a.rn;
$function$;
grant execute on function public.get_group_matchups() to anon, authenticated;
