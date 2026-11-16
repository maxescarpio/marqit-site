-- Handshake bets: a private reminder between two players ("if Miami wins it all you owe me dinner").
-- Marqit never holds money, sets odds, verifies results or settles anything. This only stores the note and a settle-by date
-- so both people see the same countdown. Stakes are free text on purpose: there is no amount field.
-- Same pattern as follows/rivals: row level security on with no policies, every read and write goes through the functions below.

create table if not exists public.handshake_bets (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  opponent_id uuid not null references public.profiles(id) on delete cascade,
  terms text not null check (char_length(terms) between 5 and 280),
  stakes text not null check (char_length(stakes) between 2 and 120),
  settles_on date not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'declined', 'cancelled', 'settled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  settled_at timestamptz,
  check (creator_id <> opponent_id)
);
create index if not exists handshake_bets_creator_idx on public.handshake_bets (creator_id, created_at desc);
create index if not exists handshake_bets_opponent_idx on public.handshake_bets (opponent_id, status);
alter table public.handshake_bets enable row level security;
revoke all on public.handshake_bets from anon, authenticated;

-- Log a bet and send it to the other player. It starts as 'pending' until they accept.
create or replace function public.hs_create(p_opponent text, p_terms text, p_stakes text, p_settles_on date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid(); v_o uuid; v_id uuid;
  v_terms text := btrim(coalesce(p_terms, '')); v_stakes text := btrim(coalesce(p_stakes, ''));
  v_today date := (now() at time zone 'America/New_York')::date;
begin
  if v_me is null then raise exception 'Sign in to log a handshake bet.'; end if;
  select id into v_o from profiles
    where lower(username) = lower(regexp_replace(btrim(coalesce(p_opponent, '')), '^@', '')) and coalesce(banned, false) = false;
  if v_o is null then raise exception 'No Marqit player has that username. Ask them to sign up first.'; end if;
  if v_o = v_me then raise exception 'Pick someone other than yourself.'; end if;
  if char_length(v_terms) < 5 or char_length(v_terms) > 280 then raise exception 'Describe the bet in 5 to 280 characters.'; end if;
  if char_length(v_stakes) < 2 or char_length(v_stakes) > 120 then raise exception 'Say what is on the line in 2 to 120 characters.'; end if;
  if p_settles_on is null or p_settles_on < v_today or p_settles_on > v_today + 1095 then raise exception 'Pick a settle date within the next 3 years.'; end if;
  if not exists(select 1 from predictions where user_id = v_me) then raise exception 'Make a call first, then you can log a handshake bet.'; end if;
  if (select count(*) from handshake_bets where creator_id = v_me and created_at > now() - interval '1 day') >= 10 then raise exception 'Slow down a little. Try again tomorrow.'; end if;
  if (select count(*) from handshake_bets where creator_id = v_me and opponent_id = v_o and status = 'pending') >= 3 then raise exception 'Wait for them to answer your earlier requests first.'; end if;
  insert into handshake_bets(creator_id, opponent_id, terms, stakes, settles_on) values (v_me, v_o, v_terms, v_stakes, p_settles_on) returning id into v_id;
  return v_id;
end $$;

-- Every bet the signed-in player is part of, with the other person's name. Nothing else is exposed.
create or replace function public.hs_list()
returns table(id uuid, terms text, stakes text, settles_on date, status text, created_at timestamptz, i_created boolean,
              other_username text, other_avatar_emoji text, other_avatar_color text)
language sql stable security definer set search_path = public as $$
  select b.id, b.terms, b.stakes, b.settles_on, b.status, b.created_at, (b.creator_id = auth.uid()),
         o.username, o.avatar_emoji, o.avatar_color
  from handshake_bets b
  join profiles o on o.id = case when b.creator_id = auth.uid() then b.opponent_id else b.creator_id end
  where auth.uid() is not null
    and (b.creator_id = auth.uid() or b.opponent_id = auth.uid())
    and b.status <> 'cancelled'
    and not (b.status = 'declined' and b.created_at < now() - interval '14 days')
  order by b.settles_on asc, b.created_at desc
  limit 200;
$$;

-- The other player accepts or declines.
create or replace function public.hs_respond(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update handshake_bets set status = case when p_accept then 'active' else 'declined' end, responded_at = now()
    where id = p_id and opponent_id = auth.uid() and status = 'pending';
  if not found then raise exception 'That request is no longer waiting for you.'; end if;
end $$;

-- Either person marks an accepted bet as settled.
create or replace function public.hs_settle(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update handshake_bets set status = 'settled', settled_at = now()
    where id = p_id and status = 'active' and (creator_id = auth.uid() or opponent_id = auth.uid());
  if not found then raise exception 'That bet cannot be marked settled.'; end if;
end $$;

-- The person who sent it can take it back while it is still waiting.
create or replace function public.hs_cancel(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update handshake_bets set status = 'cancelled' where id = p_id and creator_id = auth.uid() and status = 'pending';
  if not found then raise exception 'That request can no longer be withdrawn.'; end if;
end $$;

revoke all on function public.hs_create(text, text, text, date) from public, anon;
revoke all on function public.hs_list() from public, anon;
revoke all on function public.hs_respond(uuid, boolean) from public, anon;
revoke all on function public.hs_settle(uuid) from public, anon;
revoke all on function public.hs_cancel(uuid) from public, anon;
grant execute on function public.hs_create(text, text, text, date) to authenticated;
grant execute on function public.hs_list() to authenticated;
grant execute on function public.hs_respond(uuid, boolean) to authenticated;
grant execute on function public.hs_settle(uuid) to authenticated;
grant execute on function public.hs_cancel(uuid) to authenticated;
