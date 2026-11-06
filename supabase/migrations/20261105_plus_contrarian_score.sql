-- Marqit+ "Contrarian score": how often a member picks against the crowd, and how those picks fare.
-- Read-only. One function, members only (is_marqit_plus), returns the caller's own numbers and nothing about anyone else.
-- "Crowd side" = the side most players picked on a settled question. Ties, voided questions and questions with
-- fewer than 5 pickers are left out so a tiny crowd cannot make anyone look contrarian.

create or replace function public.mq_my_contrarian()
returns table (
  settled_picks integer,
  against_crowd integer,
  against_crowd_right integer,
  with_crowd integer,
  with_crowd_right integer
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select p.question_id, p.choice, q.correct_answer
    from public.predictions p
    join public.daily_questions q on q.id = p.question_id
    where p.user_id = auth.uid()
      and public.is_marqit_plus()
      and q.resolved
      and coalesce(q.voided, false) = false
      and q.correct_answer in ('yes', 'no')
  ),
  crowd as (
    select p.question_id,
           count(*) filter (where p.choice = 'yes') as yes_n,
           count(*) filter (where p.choice = 'no')  as no_n
    from public.predictions p
    where p.question_id in (select question_id from mine)
    group by p.question_id
  ),
  joined as (
    select m.choice, m.correct_answer,
           case when c.yes_n > c.no_n then 'yes' when c.no_n > c.yes_n then 'no' else null end as crowd_side
    from mine m
    join crowd c on c.question_id = m.question_id
    where c.yes_n + c.no_n >= 5
  )
  select
    count(*) filter (where crowd_side is not null)::int,
    count(*) filter (where crowd_side is not null and choice <> crowd_side)::int,
    count(*) filter (where crowd_side is not null and choice <> crowd_side and choice = correct_answer)::int,
    count(*) filter (where crowd_side is not null and choice = crowd_side)::int,
    count(*) filter (where crowd_side is not null and choice = crowd_side and choice = correct_answer)::int
  from joined;
$$;

revoke all on function public.mq_my_contrarian() from public, anon;
grant execute on function public.mq_my_contrarian() to authenticated;
