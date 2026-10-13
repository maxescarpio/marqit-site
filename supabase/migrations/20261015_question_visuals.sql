-- Subject photos and face-offs for Play questions.
create table if not exists public.question_visuals (
  question_id uuid primary key references public.daily_questions(id) on delete cascade,
  subject_name text,
  subject_image_url text,
  vs_name text,
  vs_image_url text,
  updated_at timestamptz not null default now()
);
alter table public.question_visuals enable row level security;

create or replace function public.get_question_visuals(p_ids uuid[])
returns table(question_id uuid, subject_name text, subject_image_url text, vs_name text, vs_image_url text)
language sql stable security definer set search_path = public as $$
  select v.question_id, v.subject_name, v.subject_image_url, v.vs_name, v.vs_image_url
  from public.question_visuals v where v.question_id = any(p_ids);
$$;
grant execute on function public.get_question_visuals(uuid[]) to anon, authenticated;

create or replace function public.admin_set_question_visual(
  p_question_id uuid, p_subject_name text, p_subject_image_url text, p_vs_name text, p_vs_image_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_marqit_admin() then raise exception 'not allowed'; end if;
  if coalesce(p_subject_image_url,'') <> '' and p_subject_image_url !~* '^https://' then raise exception 'photo links must start with https://'; end if;
  if coalesce(p_vs_image_url,'') <> '' and p_vs_image_url !~* '^https://' then raise exception 'photo links must start with https://'; end if;
  insert into public.question_visuals(question_id, subject_name, subject_image_url, vs_name, vs_image_url, updated_at)
  values (p_question_id, nullif(trim(p_subject_name),''), nullif(trim(p_subject_image_url),''), nullif(trim(p_vs_name),''), nullif(trim(p_vs_image_url),''), now())
  on conflict (question_id) do update set subject_name = excluded.subject_name, subject_image_url = excluded.subject_image_url,
    vs_name = excluded.vs_name, vs_image_url = excluded.vs_image_url, updated_at = now();
end $$;
grant execute on function public.admin_set_question_visual(uuid,text,text,text,text) to authenticated;
