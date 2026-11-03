-- Similar past questions v2: match on the names in the question (teams, people, companies), not on generic words.
drop function if exists public.mq_similar_questions(uuid);
create or replace function public.mq_similar_questions(p_question_id uuid)
returns table (question_date date, question_text text, correct_answer text, overlap int, shared text[])
language plpgsql stable security definer set search_path = public as $$
declare q record; terms text[];
begin
  if not public.is_marqit_plus() then return; end if;
  select dq.category, dq.question_text, dq.question_date as d into q
    from public.daily_questions dq where dq.id = p_question_id;
  if q is null then return; end if;
  select coalesce(array_agg(distinct m[1]), '{}') into terms
    from regexp_matches(q.question_text, '\m([A-Z][A-Za-z0-9&-]{2,})', 'g') as m
   where m[1] not in ('Will','Would','Does','Did','Are','The','Night','Football','Basketball','Hockey','Baseball','Soccer',
     'Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Today','Tonight','Tomorrow',
     'January','February','March','April','May','June','July','August','September','October','November','December',
     'Top','Daily','Chart','Number','Net','Day','Game','Week','Season','Final','Score','Series','Rotten','Tomatoes');
  if cardinality(terms) = 0 then return; end if;
  return query
    select d.question_date, d.question_text, d.correct_answer, s.n, s.t
      from public.daily_questions d
     cross join lateral (
       select count(*)::int as n, array_agg(w order by w) as t
         from unnest(terms) w where strpos(d.question_text, w) > 0
     ) s
     where d.id <> p_question_id and d.resolved and not coalesce(d.voided, false)
       and d.correct_answer in ('yes','no') and d.category = q.category
       and d.question_date < q.d and s.n >= 1
     order by s.n desc, d.question_date desc
     limit 6;
end; $$;
revoke all on function public.mq_similar_questions(uuid) from public, anon;
grant execute on function public.mq_similar_questions(uuid) to authenticated;
