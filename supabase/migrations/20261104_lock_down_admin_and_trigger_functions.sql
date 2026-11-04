-- NOT YET APPLIED. Run in the Supabase SQL editor (or approve applying it).
-- Admin functions already refuse anyone but the owner; this also stops logged-out visitors from calling them at all.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'admin\_%' loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

-- Trigger and server-only functions: nobody needs to call these through the API.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('handle_new_user','send_results_email_on_resolve','notify_question_photos','mq_record_trend_rank') loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Pin the search path on the one function that did not have it.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'user_follows_cap' loop
    execute format('alter function %s set search_path = public', r.sig);
  end loop;
end $$;

-- ROLLBACK (re-open a function): grant execute on function public.<name>(<args>) to anon, authenticated;
