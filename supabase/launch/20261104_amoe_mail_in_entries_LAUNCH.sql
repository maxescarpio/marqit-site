-- FREE MAIL-IN ENTRY (AMOE) LOG. Run this when the giveaway rules are approved. Nothing in the live site reads these tables yet.
-- Admin-only: the tables have RLS on and no policies, and everything goes through admin_* functions that check is_marqit_admin().
-- Mail-in entries are typed in by hand by the admin from the cards that arrive. One entry per person per drawing.
-- ROLLBACK is at the bottom.

create table if not exists public.giveaway_drawings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mail_by date not null,          -- last day an entry may be postmarked
  receive_by date not null,       -- last day an entry may arrive
  draw_on date not null,
  prize_cents integer not null default 5000 check (prize_cents > 0),
  status text not null default 'open' check (status in ('open', 'closed', 'drawn')),
  created_at timestamptz not null default now(),
  check (receive_by >= mail_by and draw_on >= receive_by)
);

create table if not exists public.amoe_entries (
  id uuid primary key default gen_random_uuid(),
  drawing_id uuid not null references public.giveaway_drawings(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  address text not null,
  dob date not null,
  received_on date not null,
  postmarked_on date,
  notes text,
  status text not null default 'valid' check (status in ('valid', 'void')),
  void_reason text,
  logged_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
-- one entry per person per drawing, by email and by name + birth date
create unique index if not exists amoe_entries_one_per_email on public.amoe_entries (drawing_id, lower(trim(email))) where status = 'valid';
create unique index if not exists amoe_entries_one_per_person on public.amoe_entries (drawing_id, lower(trim(full_name)), dob) where status = 'valid';

alter table public.giveaway_drawings enable row level security;
alter table public.amoe_entries enable row level security;
revoke all on public.giveaway_drawings from public, anon, authenticated;
revoke all on public.amoe_entries from public, anon, authenticated;

create or replace function public.admin_create_drawing(p_name text, p_mail_by date, p_receive_by date, p_draw_on date, p_prize_cents integer default 5000)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare v_id uuid;
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  insert into giveaway_drawings (name, mail_by, receive_by, draw_on, prize_cents)
  values (trim(p_name), p_mail_by, p_receive_by, p_draw_on, p_prize_cents) returning id into v_id;
  return v_id;
end $function$;

create or replace function public.admin_list_drawings()
 returns table (id uuid, name text, mail_by date, receive_by date, draw_on date, prize_cents integer, status text, valid_entries bigint, void_entries bigint)
 language plpgsql security definer set search_path to 'public' as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  return query
    select d.id, d.name, d.mail_by, d.receive_by, d.draw_on, d.prize_cents, d.status,
           count(e.id) filter (where e.status = 'valid'), count(e.id) filter (where e.status = 'void')
    from giveaway_drawings d left join amoe_entries e on e.drawing_id = d.id
    group by d.id order by d.draw_on desc;
end $function$;

create or replace function public.admin_log_amoe_entry(
  p_drawing uuid, p_full_name text, p_email text, p_phone text, p_address text,
  p_dob date, p_received_on date, p_postmarked_on date, p_notes text)
 returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare d record; v_id uuid;
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  select * into d from giveaway_drawings where id = p_drawing;
  if not found then raise exception 'Drawing not found'; end if;
  if d.status <> 'open' then raise exception 'This drawing is not open for entries'; end if;
  if nullif(trim(p_full_name), '') is null or nullif(trim(p_email), '') is null or nullif(trim(p_address), '') is null then
    raise exception 'Name, email and address are required';
  end if;
  if age(p_received_on, p_dob) < interval '18 years' then raise exception 'Entrant is under 18'; end if;
  if p_received_on > d.receive_by then raise exception 'Received after the receive-by date (%)', d.receive_by; end if;
  if p_postmarked_on is not null and p_postmarked_on > d.mail_by then raise exception 'Postmarked after the mail-by date (%)', d.mail_by; end if;
  begin
    insert into amoe_entries (drawing_id, full_name, email, phone, address, dob, received_on, postmarked_on, notes)
    values (p_drawing, trim(p_full_name), trim(p_email), nullif(trim(p_phone), ''), trim(p_address), p_dob, p_received_on, p_postmarked_on, nullif(trim(p_notes), ''))
    returning id into v_id;
  exception when unique_violation then
    raise exception 'This person already has an entry in this drawing';
  end;
  return v_id;
end $function$;

create or replace function public.admin_list_amoe_entries(p_drawing uuid)
 returns table (id uuid, full_name text, email text, phone text, address text, dob date, received_on date, postmarked_on date, notes text, status text, void_reason text, created_at timestamptz)
 language plpgsql security definer set search_path to 'public' as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  return query
    select e.id, e.full_name, e.email, e.phone, e.address, e.dob, e.received_on, e.postmarked_on, e.notes, e.status, e.void_reason, e.created_at
    from amoe_entries e where e.drawing_id = p_drawing order by e.created_at desc;
end $function$;

create or replace function public.admin_void_amoe_entry(p_entry uuid, p_reason text)
 returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  if nullif(trim(p_reason), '') is null then raise exception 'A reason is required'; end if;
  update amoe_entries set status = 'void', void_reason = trim(p_reason) where id = p_entry and status = 'valid';
end $function$;

revoke all on function public.admin_create_drawing(text, date, date, date, integer) from public, anon;
revoke all on function public.admin_list_drawings() from public, anon;
revoke all on function public.admin_log_amoe_entry(uuid, text, text, text, text, date, date, date, text) from public, anon;
revoke all on function public.admin_list_amoe_entries(uuid) from public, anon;
revoke all on function public.admin_void_amoe_entry(uuid, text) from public, anon;
grant execute on function public.admin_create_drawing(text, date, date, date, integer) to authenticated;
grant execute on function public.admin_list_drawings() to authenticated;
grant execute on function public.admin_log_amoe_entry(uuid, text, text, text, text, date, date, date, text) to authenticated;
grant execute on function public.admin_list_amoe_entries(uuid) to authenticated;
grant execute on function public.admin_void_amoe_entry(uuid, text) to authenticated;

-- Size of the pool for a drawing: valid mail-in cards + members who are subscribed right now (one entry each).
create or replace function public.admin_drawing_pool(p_drawing uuid)
 returns table (mail_in_entries bigint, member_entries bigint, total_entries bigint)
 language plpgsql security definer set search_path to 'public' as $function$
declare v_mail bigint; v_mem bigint;
begin
  if not is_marqit_admin() then raise exception 'Not authorized'; end if;
  select count(*) into v_mail from amoe_entries where drawing_id = p_drawing and status = 'valid';
  select count(*) into v_mem from marqit_plus_subscriptions where status in ('active', 'trialing');
  return query select v_mail, v_mem, v_mail + v_mem;
end $function$;
revoke all on function public.admin_drawing_pool(uuid) from public, anon;
grant execute on function public.admin_drawing_pool(uuid) to authenticated;

-- ROLLBACK:
-- drop function if exists public.admin_drawing_pool(uuid);
-- drop function if exists public.admin_void_amoe_entry(uuid, text), public.admin_list_amoe_entries(uuid),
--   public.admin_log_amoe_entry(uuid, text, text, text, text, date, date, date, text), public.admin_list_drawings(),
--   public.admin_create_drawing(text, date, date, date, integer);
-- drop table if exists public.amoe_entries; drop table if exists public.giveaway_drawings;
