-- Marqit+ morning brief: an opt-in daily email with the history for today's questions.
-- Off by default. One-click unsubscribe uses the same signed token as the other emails.
alter table public.profiles add column if not exists notify_morning_brief boolean not null default false;

create or replace function public.unsubscribe_from_morning_brief(p_user_id uuid, p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare v_secret text; v_expected text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'unsubscribe_hmac_secret';
  if v_secret is null then raise exception 'Unsubscribe signing secret not configured.'; end if;
  v_expected := encode(extensions.hmac(p_user_id::text, v_secret, 'sha256'), 'hex');
  if p_token is null or p_token <> v_expected then raise exception 'Invalid or expired unsubscribe link.'; end if;
  update public.profiles set notify_morning_brief = false where id = p_user_id;
end; $$;
grant execute on function public.unsubscribe_from_morning_brief(uuid, text) to anon, authenticated;
