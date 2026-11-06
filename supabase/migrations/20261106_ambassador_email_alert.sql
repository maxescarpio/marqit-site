-- Emails the owner the moment someone applies to be an ambassador (calls the notify-ambassador-application function).
-- Replace OWNER_EMAIL_HERE with the address that should get the alerts, then run once in the Supabase SQL editor.
-- The trigger never blocks or fails an application: any error is swallowed.
create or replace function public.notify_ambassador_application()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://ivapcztkasjfetntkzxy.supabase.co/functions/v1/notify-ambassador-application',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_key'),
      'Content-Type', 'application/json'),
    body := jsonb_build_object('id', new.id, 'to', 'OWNER_EMAIL_HERE'),
    timeout_milliseconds := 20000);
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists ambassador_applications_email on public.ambassador_applications;
create trigger ambassador_applications_email
  after insert on public.ambassador_applications
  for each row execute function public.notify_ambassador_application();
