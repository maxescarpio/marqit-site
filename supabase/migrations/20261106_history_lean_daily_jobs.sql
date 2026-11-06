-- NOT YET APPLIED. Run in the Supabase SQL editor to keep History & lean going every day on every question.
--
-- Job 1 drafts history and lean (5 bullets + a lean %) for today's and tomorrow's questions, every 3 hours.
--       It calls the draft-insights edge function. IT NEEDS ANTHROPIC API CREDIT: as of Nov 6 the key stored in
--       Supabase returned "credit balance is too low", which is why nothing was being drafted.
-- Job 2 publishes whatever Job 1 drafted 20 minutes later, so players see it without anyone clicking Approve.
--       DRAFTS ARE WRITTEN BY AI FROM WEB SEARCH AND GO LIVE UNREVIEWED. Skip Job 2 if you want to keep approving by hand
--       in admin.html (Daily tab > Marqit+ insights).
--
-- TO STOP EITHER ONE LATER:  select cron.unschedule('draft-insights-daily');  select cron.unschedule('publish-insights-daily');

select cron.schedule('draft-insights-daily', '5 */3 * * *', $c$select net.http_post(url := 'https://ivapcztkasjfetntkzxy.supabase.co/functions/v1/draft-insights', headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'edge_function_key'), 'Content-Type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 150000);$c$);

select cron.schedule('publish-insights-daily', '25 */3 * * *', $c$update public.question_insights set status = 'approved', reviewed_at = now() where status = 'pending';$c$);
