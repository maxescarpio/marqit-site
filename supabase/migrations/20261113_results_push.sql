-- Results push: when a day is scored, push each player their score right away instead of
-- making them wait for the morning. Runs next to the existing results email; it does not
-- change the email, scoring, or any other trigger.
--
-- Deploy order: 1) deploy the push-results edge function, 2) apply this migration.
-- If the function isn't deployed yet the trigger just fails quietly (same as the email trigger).

begin;

-- One push per player per day, no matter how many times the day trigger fires.
create table if not exists public.results_push_sent (
  user_id uuid not null references auth.users(id) on delete cascade,
  target_date date not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, target_date)
);
-- Service role only: RLS on with no policies means players cannot read or write it.
alter table public.results_push_sent enable row level security;

create or replace function public.send_results_push_on_resolve()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  begin
    perform net.http_post(
      url := 'https://ivapcztkasjfetntkzxy.supabase.co/functions/v1/push-results',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_key'),
        'Content-Type', 'application/json'),
      body := jsonb_build_object('target_date', new.target_date),
      timeout_milliseconds := 120000);
  exception when others then
    null; -- never block scoring a day because a notification failed
  end;
  return new;
end;
$$;

-- Trigger-only function: nobody needs to call it through the API (same lockdown as the email trigger).
revoke execute on function public.send_results_push_on_resolve() from public, anon, authenticated;
grant execute on function public.send_results_push_on_resolve() to service_role;

drop trigger if exists send_results_push_on_resolve on public.day_resolutions;
create trigger send_results_push_on_resolve
  after insert on public.day_resolutions
  for each row execute function public.send_results_push_on_resolve();

commit;

-- ROLLBACK:
--   drop trigger if exists send_results_push_on_resolve on public.day_resolutions;
--   drop function if exists public.send_results_push_on_resolve();
--   drop table if exists public.results_push_sent;
