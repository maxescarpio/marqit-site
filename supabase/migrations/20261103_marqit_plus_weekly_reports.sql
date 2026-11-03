-- Marqit+ full game/event reports: 2 per member per week (Monday to Sunday, Eastern time), instead of 2 per month.
create or replace function public.request_game_report(p_subject text, p_details text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_week_start timestamptz := date_trunc('week', now() at time zone 'America/New_York') at time zone 'America/New_York';
begin
  if auth.uid() is null or not public.is_marqit_plus() then raise exception 'Sign in to request a report'; end if;
  if char_length(trim(coalesce(p_subject,''))) < 4 then raise exception 'Tell us which game or event'; end if;
  if (select count(*) from public.report_requests where user_id = auth.uid() and created_at >= v_week_start and status <> 'declined') >= 2 then
    raise exception 'You have used your 2 reports for this week. They reset Monday.';
  end if;
  insert into public.report_requests(user_id, subject, details)
    values (auth.uid(), left(trim(p_subject), 140), nullif(left(trim(coalesce(p_details,'')), 500), ''))
    returning id into v_id;
  return v_id;
end; $$;
revoke all on function public.request_game_report(text, text) from public, anon;
grant execute on function public.request_game_report(text, text) to authenticated;

-- Public count of players who asked to hear when paid plans open (a number only, no names).
create or replace function public.marqit_plus_waitlist_public_count()
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.marqit_plus_waitlist;
$$;
revoke all on function public.marqit_plus_waitlist_public_count() from public;
grant execute on function public.marqit_plus_waitlist_public_count() to anon, authenticated;
