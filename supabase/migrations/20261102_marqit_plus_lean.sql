-- Marqit+ "historical lean": an optional percentage (chance YES) shown at the top of the
-- Marqit+ dropdown, always paired with a short basis line saying what history it comes from.
-- It must come from historical data or a published statistical model -- NOT a betting line or
-- prediction-market price. A percentage can never be saved without its basis.

alter table public.question_insights
  add column if not exists lean_yes_pct smallint check (lean_yes_pct between 1 and 99),
  add column if not exists lean_basis text check (lean_basis is null or char_length(lean_basis) <= 220);

alter table public.question_insights
  drop constraint if exists question_insights_lean_needs_basis;
alter table public.question_insights
  add constraint question_insights_lean_needs_basis
  check ((lean_yes_pct is null) = (lean_basis is null));

-- Admin list now returns the lean fields too (return type changed, so drop and recreate).
drop function if exists public.admin_list_question_insights(text);
create function public.admin_list_question_insights(p_status text default 'pending')
returns table (
  question_id uuid, question_date date, category text, question_text text, slot smallint,
  bullets jsonb, lean_yes_pct smallint, lean_basis text, status text, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then raise exception 'Not authorized'; end if;
  return query
    select i.question_id, q.question_date, q.category, q.question_text, q.slot, i.bullets,
           i.lean_yes_pct, i.lean_basis, i.status, i.created_at
    from public.question_insights i
    join public.daily_questions q on q.id = i.question_id
    where i.status = p_status
    order by q.question_date asc, q.slot asc nulls last, q.category asc;
end;
$$;
revoke all on function public.admin_list_question_insights(text) from public, anon;
grant execute on function public.admin_list_question_insights(text) to authenticated;

-- Approve (with edits): exactly 5 bullets, plus an optional lean percentage with its basis.
drop function if exists public.admin_approve_question_insights(uuid, jsonb);
create function public.admin_approve_question_insights(
  p_question_id uuid, p_bullets jsonb, p_lean_yes_pct integer default null, p_lean_basis text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
  v_clean jsonb;
  v_basis text := nullif(btrim(coalesce(p_lean_basis, '')), '');
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then raise exception 'Not authorized'; end if;
  if jsonb_typeof(p_bullets) is distinct from 'array' then raise exception 'Bullets must be a list'; end if;
  select coalesce(jsonb_agg(btrim(b) order by ord), '[]'::jsonb) into v_clean
    from jsonb_array_elements_text(p_bullets) with ordinality as t(b, ord)
    where btrim(b) <> '';
  if jsonb_array_length(v_clean) <> 5 then raise exception 'Exactly 5 bullet points are required'; end if;
  if p_lean_yes_pct is not null then
    if p_lean_yes_pct < 1 or p_lean_yes_pct > 99 then raise exception 'Lean must be between 1 and 99'; end if;
    if v_basis is null then raise exception 'A lean percentage needs a basis line'; end if;
  else
    v_basis := null;
  end if;
  update public.question_insights
     set bullets = v_clean, lean_yes_pct = p_lean_yes_pct, lean_basis = v_basis,
         status = 'approved', reviewed_at = now()
   where question_id = p_question_id;
  if not found then raise exception 'Insights not found'; end if;
end;
$$;
revoke all on function public.admin_approve_question_insights(uuid, jsonb, integer, text) from public, anon;
grant execute on function public.admin_approve_question_insights(uuid, jsonb, integer, text) to authenticated;
