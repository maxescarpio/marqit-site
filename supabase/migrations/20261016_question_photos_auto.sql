-- Automatic photos for the daily questions.
-- The fill-question-photos edge function looks up who or what each question is about and saves a
-- freely licensed photo to question_visuals. This wires it up two ways:
--   1. a trigger that calls it the moment new daily questions are inserted (so the circles are there
--      when the questions go live), and
--   2. a 5-minute cron that retries anything still missing (a slow lookup, a busy AI, a manual insert).
-- The trigger never blocks or fails an insert: any error is swallowed.

create or replace function public.notify_question_photos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ivapcztkasjfetntkzxy.supabase.co/functions/v1/fill-question-photos',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_key'),
      'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists daily_questions_photos on public.daily_questions;
create trigger daily_questions_photos
  after insert on public.daily_questions
  for each statement execute function public.notify_question_photos();

select cron.unschedule('fill-question-photos') where exists (select 1 from cron.job where jobname = 'fill-question-photos');
select cron.schedule('fill-question-photos', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://ivapcztkasjfetntkzxy.supabase.co/functions/v1/fill-question-photos',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_key'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$$);
