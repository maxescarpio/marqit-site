-- Marqit is for the general public: group vs group, not Greek life.
-- Removes school / national org / letters / verified / founding-chapter data
-- structures and the national-org board. All of these columns were empty when
-- this migration was written (0 non-null values), and no group rows are touched.

begin;

-- Drop functions whose signatures change or that no longer have a purpose.
drop function if exists public.get_top_orgs(integer);
drop function if exists public.get_group_schools();
drop function if exists public.get_top_groups(integer, text);
drop function if exists public.get_group_matchups();
drop function if exists public.admin_list_groups();
drop function if exists public.admin_update_group(uuid, boolean, text, text, text, text);
drop function if exists public.admin_set_champion(uuid, boolean, text, boolean);
drop function if exists public.get_champion_info();

-- Group-only champion title.
alter table public.champion_titles drop column if exists champion_org_name;

-- Remove the Greek-specific columns from groups.
alter table public.groups
  drop column if exists school,
  drop column if exists org_name,
  drop column if exists symbol,
  drop column if exists verified,
  drop column if exists founding_chapter;

create or replace function public.get_top_groups(p_limit integer default 25)
returns table(group_id uuid, name text, member_count bigint, total_points bigint,
              new_members_7d bigint, is_champion boolean)
language sql security definer set search_path to 'public' as $$
  select g.id as group_id,
         g.name,
         count(gm.user_id) as member_count,
         coalesce(sum(s.total_points), 0) as total_points,
         count(gm.user_id) filter (where gm.joined_at >= now() - interval '7 days') as new_members_7d,
         (g.id = (select champion_group_id from champion_titles where id = true)) as is_champion
  from groups g
  join group_members gm on gm.group_id = g.id
  join profiles pf on pf.id = gm.user_id and pf.banned = false
  left join streaks s on s.user_id = gm.user_id
  group by g.id, g.name
  order by total_points desc, member_count desc
  limit p_limit;
$$;

create or replace function public.get_group_matchups()
returns table(pair_no integer, group_id uuid, name text, member_count bigint,
              correct_calls bigint, score numeric, opponent_id uuid, week_start date)
language sql stable security definer set search_path to 'public' as $$
  with wk as (select (date_trunc('week', (now() at time zone 'America/New_York')::date))::date as ws),
  ranked as (
    select g.id, g.name, count(gm.user_id) as mc,
           coalesce(sum(s.total_points),0) as tp,
           row_number() over (order by coalesce(sum(s.total_points),0) desc, count(gm.user_id) desc, g.id) as rn
    from groups g
    join group_members gm on gm.group_id = g.id
    join profiles pf on pf.id = gm.user_id and pf.banned = false
    left join streaks s on s.user_id = gm.user_id
    group by g.id, g.name
  ),
  wins as (
    select gm.group_id, count(*) as cc
    from group_members gm
    join predictions p on p.user_id = gm.user_id
    join daily_questions q on q.id = p.question_id
    cross join wk
    where q.question_date >= wk.ws and q.question_date < wk.ws + 7
      and q.correct_answer is not null and p.choice = q.correct_answer
    group by gm.group_id
  ),
  scored as (
    select r.*, coalesce(w.cc,0) as cc, round(coalesce(w.cc,0) * 100.0 / r.mc, 1) as sc,
           ((r.rn + 1) / 2)::int as pn
    from ranked r left join wins w on w.group_id = r.id
  )
  select a.pn, a.id, a.name, a.mc, a.cc, a.sc,
         (select b.id from scored b where b.pn = a.pn and b.id <> a.id limit 1),
         (select ws from wk)
  from scored a
  order by a.pn, a.rn;
$$;

create or replace function public.admin_list_groups()
returns table(group_id uuid, name text, member_count bigint, total_points bigint,
              invite_code text, created_at timestamptz)
language sql security definer set search_path to 'public' as $$
  select g.id, g.name,
         count(gm.user_id) as member_count,
         coalesce(sum(s.total_points), 0) as total_points,
         g.invite_code, g.created_at
  from groups g
  left join group_members gm on gm.group_id = g.id
  left join streaks s on s.user_id = gm.user_id
  where public.is_marqit_admin()
  group by g.id, g.name, g.invite_code, g.created_at
  order by g.created_at desc;
$$;

create or replace function public.admin_update_group(p_group_id uuid, p_name text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_marqit_admin() then
    raise exception 'not authorized';
  end if;
  update groups set name = coalesce(p_name, name) where id = p_group_id;
end;
$$;

create or replace function public.admin_set_champion(p_group_id uuid default null, p_clear_group boolean default false)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_marqit_admin() then
    raise exception 'not authorized';
  end if;
  update champion_titles set
    champion_group_id = case when p_clear_group then null when p_group_id is not null then p_group_id else champion_group_id end,
    updated_at = now()
  where id = true;
end;
$$;

create or replace function public.get_champion_info()
returns table(champion_group_id uuid, champion_group_name text)
language sql security definer set search_path to 'public' as $$
  select ct.champion_group_id, g.name
  from champion_titles ct
  left join groups g on g.id = ct.champion_group_id
  where ct.id = true;
$$;

create or replace function public.get_champion_member_ids()
returns table(user_id uuid)
language sql security definer set search_path to 'public' as $$
  select distinct gm.user_id
  from group_members gm
  where gm.group_id = (select champion_group_id from champion_titles where id = true)
$$;

commit;
