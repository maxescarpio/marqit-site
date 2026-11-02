-- Marqit+ insights: 5 bullet points of historical data and odds per daily question.
-- Drafted by the draft-insights edge function (pending), approved by the admin, then shown
-- in a dropdown on the play card for Marqit+ members.
--
-- Marqit+ is FREE for now: is_marqit_plus() returns true for every signed-in user.
-- When payments exist, change ONLY that function (e.g. check a subscription row) and
-- the RLS policy, the app, and the admin page all follow.

create table if not exists public.question_insights (
  question_id uuid primary key references public.daily_questions(id) on delete cascade,
  bullets jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source text not null default 'claude',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint question_insights_five_bullets check (
    jsonb_typeof(bullets) = 'array' and jsonb_array_length(bullets) = 5
  )
);
alter table public.question_insights enable row level security;

create or replace function public.is_marqit_plus()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null;
$$;
revoke all on function public.is_marqit_plus() from public, anon;
grant execute on function public.is_marqit_plus() to authenticated;

drop policy if exists "Marqit+ members read approved insights" on public.question_insights;
create policy "Marqit+ members read approved insights"
  on public.question_insights for select to authenticated
  using (status = 'approved' and public.is_marqit_plus());

-- ---- admin-only helpers (same pattern as the question drafts) ----

create or replace function public.admin_list_question_insights(p_status text default 'pending')
returns table (
  question_id uuid, question_date date, category text, question_text text, slot smallint,
  bullets jsonb, status text, created_at timestamptz
)
language plpgsql security definer set search_path = public as $$
declare caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then raise exception 'Not authorized'; end if;
  return query
    select i.question_id, q.question_date, q.category, q.question_text, q.slot, i.bullets, i.status, i.created_at
    from public.question_insights i
    join public.daily_questions q on q.id = i.question_id
    where i.status = p_status
    order by q.question_date asc, q.slot asc nulls last, q.category asc;
end;
$$;
revoke all on function public.admin_list_question_insights(text) from public, anon;
grant execute on function public.admin_list_question_insights(text) to authenticated;

-- Approve (with any edits) or save an insight set. Exactly 5 non-empty bullets.
create or replace function public.admin_approve_question_insights(p_question_id uuid, p_bullets jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  caller_email text := (select email from auth.users where id = auth.uid());
  v_clean jsonb;
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then raise exception 'Not authorized'; end if;
  if jsonb_typeof(p_bullets) is distinct from 'array' then raise exception 'Bullets must be a list'; end if;
  select coalesce(jsonb_agg(btrim(b) order by ord), '[]'::jsonb) into v_clean
    from jsonb_array_elements_text(p_bullets) with ordinality as t(b, ord)
    where btrim(b) <> '';
  if jsonb_array_length(v_clean) <> 5 then raise exception 'Exactly 5 bullet points are required'; end if;
  update public.question_insights
     set bullets = v_clean, status = 'approved', reviewed_at = now()
   where question_id = p_question_id;
  if not found then raise exception 'Insights not found'; end if;
end;
$$;
revoke all on function public.admin_approve_question_insights(uuid, jsonb) from public, anon;
grant execute on function public.admin_approve_question_insights(uuid, jsonb) to authenticated;

create or replace function public.admin_reject_question_insights(p_question_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare caller_email text := (select email from auth.users where id = auth.uid());
begin
  if caller_email is distinct from 'maxescarpio3@gmail.com' then raise exception 'Not authorized'; end if;
  update public.question_insights set status = 'rejected', reviewed_at = now() where question_id = p_question_id;
end;
$$;
revoke all on function public.admin_reject_question_insights(uuid) from public, anon;
grant execute on function public.admin_reject_question_insights(uuid) to authenticated;
