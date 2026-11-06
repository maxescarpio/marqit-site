-- NOT YET APPLIED. Run in the Supabase SQL editor.
-- History & lean (question insights and game/event insights) is open to EVERYONE for now:
-- signed in or not, subscribed or not. Only rows the admin has approved are ever readable.
-- TO UNDO when the owner says so: drop these two policies; the original "Marqit+ members read
-- approved ..." policies (gated by is_marqit_plus()) stay in place underneath.
drop policy if exists "Everyone reads approved insights for now" on public.question_insights;
create policy "Everyone reads approved insights for now"
  on public.question_insights for select to anon, authenticated
  using (status = 'approved');

drop policy if exists "Everyone reads approved event insights for now" on public.event_insights;
create policy "Everyone reads approved event insights for now"
  on public.event_insights for select to anon, authenticated
  using (status = 'approved');
