-- Followers, record badges, invite bonus, and "who called it" (with an anonymous option).

alter table public.profiles add column if not exists hide_name_on_calls boolean not null default false;

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows(followee_id) where active;
alter table public.follows enable row level security;

create table if not exists public.referral_bonus (
  referred_id uuid primary key references public.profiles(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  awarded_at timestamptz not null default now()
);
alter table public.referral_bonus enable row level security;

-- Internal: one row per person with record, streak, follower counts.
create or replace function public.mq_user_cards(p_ids uuid[])
returns table(username text, avatar_emoji text, avatar_color text, followers bigint, following bigint,
              calls bigint, correct bigint, accuracy int, streak int, is_following boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.username, p.avatar_emoji, p.avatar_color,
    (select count(*) from follows f where f.followee_id = p.id and f.active),
    (select count(*) from follows f where f.follower_id = p.id and f.active),
    s.calls, s.correct,
    case when s.calls >= 5 then round(100.0 * s.correct / s.calls)::int end,
    coalesce(st.current_streak, 0),
    exists(select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.active),
    (p.id = auth.uid())
  from profiles p
  left join lateral (
    select count(*) as calls, count(*) filter (where pr.choice = q.correct_answer) as correct
    from predictions pr join daily_questions q on q.id = pr.question_id
    where pr.user_id = p.id and q.resolved and q.correct_answer is not null
  ) s on true
  left join streaks st on st.user_id = p.id
  where p.id = any(p_ids) and coalesce(p.banned, false) = false;
$$;
revoke all on function public.mq_user_cards(uuid[]) from public, anon, authenticated;

create or replace function public.get_user_cards(p_usernames text[])
returns table(username text, avatar_emoji text, avatar_color text, followers bigint, following bigint,
              calls bigint, correct bigint, accuracy int, streak int, is_following boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select * from public.mq_user_cards(array(
    select p.id from profiles p where lower(p.username) = any(select lower(x) from unnest(p_usernames) x) limit 200));
$$;
grant execute on function public.get_user_cards(text[]) to anon, authenticated;

create or replace function public.follow_user(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_t uuid;
begin
  if v_me is null then raise exception 'Sign in to follow people.'; end if;
  select id into v_t from profiles where lower(username) = lower(p_username) and coalesce(banned, false) = false;
  if v_t is null then raise exception 'No such player.'; end if;
  if v_t = v_me then raise exception 'You cannot follow yourself.'; end if;
  if not exists(select 1 from predictions where user_id = v_me) then raise exception 'Make a call first, then you can follow people.'; end if;
  if (select count(*) from follows where follower_id = v_me and created_at > now() - interval '1 hour') >= 40 then raise exception 'Slow down a little.'; end if;
  insert into follows(follower_id, followee_id, active) values (v_me, v_t, true)
  on conflict (follower_id, followee_id) do update set active = true;
end $$;
grant execute on function public.follow_user(text) to authenticated;

create or replace function public.unfollow_user(p_username text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update follows set active = false
  where follower_id = auth.uid() and followee_id = (select id from profiles where lower(username) = lower(p_username));
end $$;
grant execute on function public.unfollow_user(text) to authenticated;

create or replace function public.get_suggested_callers(p_limit int default 8)
returns table(username text, avatar_emoji text, avatar_color text, followers bigint, following bigint,
              calls bigint, correct bigint, accuracy int, streak int, is_following boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select c.* from public.mq_user_cards(array(
    select p.id from profiles p
    where p.id is distinct from auth.uid() and coalesce(p.banned, false) = false and coalesce(p.hide_from_leaderboard, false) = false
      and not exists(select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id and f.active)
    limit 500)) c
  where c.calls >= 10
  order by c.accuracy desc nulls last, c.calls desc
  limit greatest(1, least(p_limit, 20));
$$;
grant execute on function public.get_suggested_callers(int) to anon, authenticated;

create or replace function public.get_my_followers(p_limit int default 30)
returns table(username text, avatar_emoji text, avatar_color text, followers bigint, following bigint,
              calls bigint, correct bigint, accuracy int, streak int, is_following boolean, is_me boolean)
language sql stable security definer set search_path = public as $$
  select * from public.mq_user_cards(array(
    select f.follower_id from follows f where f.followee_id = auth.uid() and f.active order by f.created_at desc
    limit greatest(1, least(p_limit, 100))));
$$;
grant execute on function public.get_my_followers(int) to authenticated;

create or replace function public.set_hide_name_on_calls(p_hide boolean)
returns void language sql security definer set search_path = public as $$
  update profiles set hide_name_on_calls = coalesce(p_hide, false) where id = auth.uid();
$$;
grant execute on function public.set_hide_name_on_calls(boolean) to authenticated;

-- Earliest correct callers on a resolved question. Anyone who chose to stay anonymous shows without a name.
create or replace function public.get_who_called_it(p_question_id uuid)
returns table(username text, avatar_emoji text, avatar_color text, called_at timestamptz, anonymous boolean, is_me boolean,
              total_correct bigint, total_calls bigint)
language sql stable security definer set search_path = public as $$
  with q as (select id, correct_answer from daily_questions where id = p_question_id and resolved and correct_answer is not null),
  t as (select count(*) as calls, count(*) filter (where pr.choice = q.correct_answer) as correct
        from predictions pr join q on q.id = pr.question_id)
  select case when p.hide_name_on_calls and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then null else p.username end,
         case when p.hide_name_on_calls and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then null else p.avatar_emoji end,
         case when p.hide_name_on_calls and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid) then null else p.avatar_color end,
         pr.created_at, p.hide_name_on_calls, (p.id = auth.uid()), t.correct, t.calls
  from predictions pr
  join q on q.id = pr.question_id
  join profiles p on p.id = pr.user_id
  cross join t
  where pr.choice = q.correct_answer and coalesce(p.banned, false) = false
  order by pr.created_at asc
  limit 10;
$$;
grant execute on function public.get_who_called_it(uuid) to anon, authenticated;

-- Invite bonus: 200 points each, once per invited person, after they make their first call. Max 25 invites per person.
create or replace function public.claim_referral_bonus()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_ref uuid; v_pts int := 200;
begin
  if v_me is null then return jsonb_build_object('awarded', false); end if;
  select referred_by_user_id into v_ref from profiles where id = v_me;
  if v_ref is null or v_ref = v_me then return jsonb_build_object('awarded', false); end if;
  if exists(select 1 from referral_bonus where referred_id = v_me) then return jsonb_build_object('awarded', false); end if;
  if not exists(select 1 from predictions where user_id = v_me) then return jsonb_build_object('awarded', false); end if;
  if coalesce((select banned from profiles where id = v_ref), false) then return jsonb_build_object('awarded', false); end if;
  if (select count(*) from referral_bonus where referrer_id = v_ref) >= 25 then return jsonb_build_object('awarded', false); end if;
  insert into referral_bonus(referred_id, referrer_id) values (v_me, v_ref) on conflict do nothing;
  if not found then return jsonb_build_object('awarded', false); end if;
  update streaks set total_points = total_points + v_pts where user_id in (v_me, v_ref);
  return jsonb_build_object('awarded', true, 'points', v_pts);
end $$;
grant execute on function public.claim_referral_bonus() to authenticated;

create or replace function public.get_my_referrals()
returns table(friends bigint, points bigint)
language sql stable security definer set search_path = public as $$
  select count(*), count(*) * 200 from referral_bonus where referrer_id = auth.uid();
$$;
grant execute on function public.get_my_referrals() to authenticated;
