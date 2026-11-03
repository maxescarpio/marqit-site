-- Marqit+ perks. Everything here is gated by is_marqit_plus(), which is true for every
-- signed-in user while Marqit+ is free. Nothing here touches entries, points, picks or prizes.

-- 1) Results explained: a short note on why a settled question went the way it did.
alter table public.question_insights
  add column if not exists result_explanation text
  check (result_explanation is null or char_length(result_explanation) between 10 and 420);

create or replace function public.admin_set_result_explanation(p_question_id uuid, p_text text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  update public.question_insights set result_explanation = nullif(trim(p_text), '')
   where question_id = p_question_id;
  if not found then raise exception 'no insight row for that question'; end if;
end; $$;
revoke all on function public.admin_set_result_explanation(uuid, text) from public, anon;
grant execute on function public.admin_set_result_explanation(uuid, text) to authenticated;

-- 2) Similar past questions: settled questions in the same category that share the most words.
create or replace function public.mq_similar_questions(p_question_id uuid)
returns table (question_date date, question_text text, correct_answer text, overlap int)
language plpgsql stable security definer set search_path = public as $$
declare q record; words text[];
begin
  if not public.is_marqit_plus() then return; end if;
  select dq.category, dq.question_text, dq.question_date as d into q
    from public.daily_questions dq where dq.id = p_question_id;
  if q is null then return; end if;
  select coalesce(array_agg(distinct w), '{}') into words
    from unnest(regexp_split_to_array(lower(regexp_replace(q.question_text, '[^a-zA-Z0-9 ]', ' ', 'g')), '\s+')) w
   where char_length(w) > 3
     and w not in ('will','their','there','before','after','this','that','than','from','with','have','been','more','over','under','today','tonight','tomorrow','which','where','when','what','does','during','least','most','game','week','season');
  return query
    select d.question_date, d.question_text, d.correct_answer,
           (select count(*)::int from unnest(words) w where lower(d.question_text) like '%' || w || '%') as overlap
      from public.daily_questions d
     where d.id <> p_question_id and d.resolved and not coalesce(d.voided, false)
       and d.correct_answer in ('yes','no') and d.category = q.category and d.question_date < q.d
     order by 4 desc, d.question_date desc
     limit 6;
end; $$;
revoke all on function public.mq_similar_questions(uuid) from public, anon;
grant execute on function public.mq_similar_questions(uuid) to authenticated;

-- 3) History & lean for every game / report / event on the schedule (not only the daily questions).
-- event_key = 'YYYY-MM-DD|league|slug' built by the app, so ESPN-fed games with no key_events row still match.
create table if not exists public.event_insights (
  event_key text primary key check (char_length(event_key) between 6 and 160),
  title text not null check (char_length(title) between 2 and 160),
  bullets jsonb not null,
  lean_yes_pct smallint check (lean_yes_pct between 1 and 99),
  lean_label text check (lean_label is null or char_length(lean_label) <= 80),
  lean_basis text check (lean_basis is null or char_length(lean_basis) <= 220),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  source text not null default 'claude',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint event_insights_five_bullets check (jsonb_typeof(bullets) = 'array' and jsonb_array_length(bullets) = 5),
  constraint event_insights_lean_pair check ((lean_yes_pct is null) = (lean_basis is null))
);
alter table public.event_insights enable row level security;
drop policy if exists "Marqit+ members read approved event insights" on public.event_insights;
create policy "Marqit+ members read approved event insights"
  on public.event_insights for select to authenticated
  using (status = 'approved' and public.is_marqit_plus());

create or replace function public.admin_list_event_insights(p_status text default 'pending')
returns table (event_key text, title text, bullets jsonb, lean_yes_pct smallint, lean_label text, lean_basis text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  return query select i.event_key, i.title, i.bullets, i.lean_yes_pct, i.lean_label, i.lean_basis, i.status, i.created_at
    from public.event_insights i where i.status = p_status order by i.event_key;
end; $$;
revoke all on function public.admin_list_event_insights(text) from public, anon;
grant execute on function public.admin_list_event_insights(text) to authenticated;

create or replace function public.admin_review_event_insight(p_event_key text, p_approve boolean, p_bullets jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  update public.event_insights
     set status = case when p_approve then 'approved' else 'rejected' end,
         bullets = coalesce(p_bullets, bullets), reviewed_at = now()
   where event_key = p_event_key;
end; $$;
revoke all on function public.admin_review_event_insight(text, boolean, jsonb) from public, anon;
grant execute on function public.admin_review_event_insight(text, boolean, jsonb) to authenticated;

-- 4) My Teams and topics: highlighting only, no alerts.
create table if not exists public.user_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('team','topic')),
  name text not null check (char_length(name) between 2 and 40),
  created_at timestamptz not null default now()
);
create unique index if not exists user_follows_unique on public.user_follows (user_id, kind, lower(name));
alter table public.user_follows enable row level security;
drop policy if exists "Own follows" on public.user_follows;
create policy "Own follows" on public.user_follows for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_marqit_plus());
create or replace function public.user_follows_cap() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.user_follows where user_id = new.user_id) >= 30 then
    raise exception 'You can follow up to 30 teams and topics';
  end if;
  return new;
end; $$;
drop trigger if exists user_follows_cap_trg on public.user_follows;
create trigger user_follows_cap_trg before insert on public.user_follows for each row execute function public.user_follows_cap();

-- 5) Full game / event report requests: 2 per member per calendar month, written by hand within 48 hours.
create table if not exists public.report_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 4 and 140),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'pending' check (status in ('pending','delivered','declined')),
  report_body text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);
alter table public.report_requests enable row level security;
drop policy if exists "Own report requests" on public.report_requests;
create policy "Own report requests" on public.report_requests for select to authenticated using (user_id = auth.uid());

create or replace function public.request_game_report(p_subject text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_month_start timestamptz := date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York';
begin
  if auth.uid() is null or not public.is_marqit_plus() then raise exception 'Sign in to request a report'; end if;
  if char_length(trim(coalesce(p_subject,''))) < 4 then raise exception 'Tell us which game or event'; end if;
  if (select count(*) from public.report_requests where user_id = auth.uid() and created_at >= v_month_start and status <> 'declined') >= 2 then
    raise exception 'You have used your 2 reports for this month';
  end if;
  insert into public.report_requests(user_id, subject, details)
    values (auth.uid(), left(trim(p_subject), 140), nullif(left(trim(coalesce(p_details,'')), 500), ''))
    returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.request_game_report(text, text) from public, anon;
grant execute on function public.request_game_report(text, text) to authenticated;

create or replace function public.admin_list_report_requests(p_status text default 'pending')
returns table (id uuid, username text, subject text, details text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  return query select r.id, p.username, r.subject, r.details, r.status, r.created_at
    from public.report_requests r left join public.profiles p on p.id = r.user_id
   where r.status = p_status order by r.created_at;
end; $$;
revoke all on function public.admin_list_report_requests(text) from public, anon;
grant execute on function public.admin_list_report_requests(text) to authenticated;

create or replace function public.admin_deliver_report(p_id uuid, p_body text, p_decline boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  update public.report_requests
     set status = case when p_decline then 'declined' else 'delivered' end,
         report_body = nullif(trim(coalesce(p_body,'')), ''), delivered_at = now()
   where id = p_id;
end; $$;
revoke all on function public.admin_deliver_report(uuid, text, boolean) from public, anon;
grant execute on function public.admin_deliver_report(uuid, text, boolean) to authenticated;

-- 6) Question archive. Free: the last 7 days. Marqit+: everything.
create or replace function public.mq_archive(p_search text default null, p_category text default null, p_limit int default 30, p_offset int default 0)
returns table (question_date date, category text, question_text text, correct_answer text, voided boolean)
language sql stable security definer set search_path = public as $$
  select d.question_date, d.category, d.question_text, d.correct_answer, coalesce(d.voided, false)
    from public.daily_questions d
   where d.resolved
     and (public.is_marqit_plus() or d.question_date >= (now() at time zone 'America/New_York')::date - 7)
     and (p_category is null or d.category = p_category)
     and (p_search is null or d.question_text ilike '%' || replace(replace(p_search, '%', ''), '_', '') || '%')
   order by d.question_date desc, d.slot nulls last
   limit least(coalesce(p_limit, 30), 60) offset greatest(coalesce(p_offset, 0), 0);
$$;
grant execute on function public.mq_archive(text, text, int, int) to anon, authenticated;
