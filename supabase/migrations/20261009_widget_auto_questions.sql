-- Easy widget install: sites can have Claude draft the questions.
-- ADDITIVE ONLY: new columns with safe defaults, plus new functions. Nothing is dropped or changed.
--
-- question_mode on a site:
--   'manual'  (default) Max writes every question by hand, as before.
--   'review'  Claude drafts a question the first time a story page is seen; it stays hidden until Max approves it.
--   'auto'    Claude drafts and the question goes live right away (for trusted sites only).
-- widget_questions.source: 'manual' | 'drafting' | 'auto' | 'skipped' | 'rejected'
--   A draft waiting for approval is source = 'auto' with active = false. The widget only ever shows active questions.

-- ===== STEP 1: columns =====
alter table public.widget_sites     add column if not exists question_mode text not null default 'manual';
alter table public.widget_questions add column if not exists source text not null default 'manual';
alter table public.widget_questions add column if not exists page_url text;

-- ===== STEP 2: admin functions (admin only, same pattern as the existing admin_widget_* functions) =====
create or replace function public.admin_widget_set_site_mode(p_site_key text, p_mode text)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  if p_mode not in ('manual','review','auto') then raise exception 'Bad mode'; end if;
  if p_mode <> 'manual' and not exists (
      select 1 from widget_sites where site_key = p_site_key and coalesce(array_length(allowed_domains,1),0) > 0) then
    raise exception 'Add the site''s domain first (required so only their pages can use auto questions)';
  end if;
  update widget_sites set question_mode = p_mode where site_key = p_site_key;
end $function$;

create or replace function public.admin_widget_site_modes()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  return coalesce((select jsonb_object_agg(site_key, question_mode) from widget_sites), '{}'::jsonb);
end $function$;

create or replace function public.admin_widget_pending_questions()
 returns jsonb language plpgsql stable security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'site', s.name, 'site_key', s.site_key, 'text', q.question_text,
      'note', q.resolution_note, 'url', q.page_url, 'page_key', q.page_key, 'at', q.created_at) order by q.created_at)
    from widget_questions q join widget_sites s on s.id = q.site_id
    where q.source = 'auto' and not q.active), '[]'::jsonb);
end $function$;

create or replace function public.admin_widget_review_question(p_id uuid, p_action text, p_text text default null, p_note text default null)
 returns void language plpgsql security definer set search_path to 'public'
as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  if p_action = 'approve' then
    update widget_questions
       set active = true,
           question_text = coalesce(nullif(btrim(coalesce(p_text,'')),''), question_text),
           resolution_note = case when p_note is null then resolution_note else nullif(btrim(p_note),'') end
     where id = p_id and source = 'auto';
  elsif p_action = 'reject' then
    update widget_questions set source = 'rejected', active = false where id = p_id and source = 'auto' and not active;
  else
    raise exception 'Bad action';
  end if;
end $function$;
