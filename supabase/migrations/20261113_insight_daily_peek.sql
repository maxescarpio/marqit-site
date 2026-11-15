-- Free daily peek: while the gate is ON, free players can open History & lean on ONE question per day;
-- Marqit+ members open all of them. While the gate is OFF (the default) nothing changes: History & lean
-- stays open to everyone, exactly as today.
--
-- Applying this migration does NOT turn the gate on. To turn it on later:
--     update public.app_flags set enabled = true, updated_at = now() where key = 'insight_peek_gate';
-- and to turn it off again, set enabled = false. No deploy needed either way.
--
-- How it's enforced: while the gate is on, the "everyone reads" policy on question_insights stops matching, so
-- the only ways to read an insight are (a) being a Marqit+ member, or (b) the peek_question_insight() function,
-- which counts one peek per player per day (New York time) and re-opens questions already peeked.
-- Event/game insights (the Schedule tab) are NOT gated by this change.
--
-- ROLLBACK: drop function public.peek_question_insight(uuid), public.insight_access(), public.insight_gate_on();
--           re-create the policy "Everyone reads approved insights for now" using (status = 'approved');
--           drop table public.insight_peeks; drop table public.app_flags;

begin;

create table if not exists public.app_flags (
  key text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;   -- no policies: only the service role / SQL editor can change it

insert into public.app_flags (key, enabled) values ('insight_peek_gate', false) on conflict (key) do nothing;

create table if not exists public.insight_peeks (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.daily_questions(id) on delete cascade,
  peek_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.insight_peeks enable row level security;   -- no policies: players only touch it through the functions below

-- Is the gate on? A single boolean, safe for anyone to read (the page uses it to decide what to show).
create or replace function public.insight_gate_on()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce((select enabled from public.app_flags where key = 'insight_peek_gate'), false)
$$;
grant execute on function public.insight_gate_on() to anon, authenticated;

-- The open policy now only applies while the gate is off. The Marqit+ members policy underneath is untouched.
drop policy if exists "Everyone reads approved insights for now" on public.question_insights;
create policy "Everyone reads approved insights for now"
  on public.question_insights for select to anon, authenticated
  using (status = 'approved' and not public.insight_gate_on());

-- What the signed-in player can do right now.
create or replace function public.insight_access()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
  free_limit constant int := 1;
  used int := 0;
  ids jsonb := '[]'::jsonb;
begin
  if uid is null then
    return jsonb_build_object('gate_on', public.insight_gate_on(), 'member', false, 'peeks_left', 0, 'peeked_ids', '[]'::jsonb);
  end if;
  select count(*) filter (where peek_date = today),
         coalesce(jsonb_agg(question_id) filter (where peek_date = today), '[]'::jsonb)
    into used, ids
    from public.insight_peeks where user_id = uid;
  return jsonb_build_object(
    'gate_on', public.insight_gate_on(),
    'member', public.is_marqit_plus(),
    'peeks_left', greatest(free_limit - used, 0),
    'peeked_ids', ids
  );
end;
$$;
revoke all on function public.insight_access() from public, anon;
grant execute on function public.insight_access() to authenticated;

-- Open one question's History & lean, spending today's free peek if the player isn't a member.
-- status: ok | limit (today's peek already used) | signin | none (no approved insight for that question)
create or replace function public.peek_question_insight(p_question_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
  free_limit constant int := 1;
  r record;
  used int;
begin
  if uid is null then return jsonb_build_object('status', 'signin'); end if;

  select i.question_id, i.bullets, i.lean_yes_pct, i.lean_basis, i.result_explanation
    into r
    from public.question_insights i
   where i.question_id = p_question_id and i.status = 'approved';
  if not found then return jsonb_build_object('status', 'none'); end if;

  -- Gate off, or a member: everything is open, nothing is counted.
  if not public.insight_gate_on() or public.is_marqit_plus() then
    return jsonb_build_object('status', 'ok', 'peeks_left', null, 'row', to_jsonb(r));
  end if;

  -- One at a time per player, so two quick taps can't both spend the same peek.
  perform pg_advisory_xact_lock(hashtext('insight_peek:' || uid::text));

  -- Already peeked this question: re-opening is free.
  if exists (select 1 from public.insight_peeks where user_id = uid and question_id = p_question_id) then
    select greatest(free_limit - count(*), 0) into used from public.insight_peeks where user_id = uid and peek_date = today;
    return jsonb_build_object('status', 'ok', 'peeks_left', used, 'row', to_jsonb(r));
  end if;

  select count(*) into used from public.insight_peeks where user_id = uid and peek_date = today;
  if used >= free_limit then
    return jsonb_build_object('status', 'limit', 'peeks_left', 0);
  end if;

  insert into public.insight_peeks (user_id, question_id, peek_date) values (uid, p_question_id, today);
  return jsonb_build_object('status', 'ok', 'peeks_left', greatest(free_limit - used - 1, 0), 'row', to_jsonb(r));
end;
$$;
revoke all on function public.peek_question_insight(uuid) from public, anon;
grant execute on function public.peek_question_insight(uuid) to authenticated;

commit;
