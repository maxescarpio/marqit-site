-- Nov 12: profile popup upgrades.
--   * player_card_extras(username): how the viewer is connected to this player (buddy / rival / follows / group-mate),
--     whether the player has made today's calls, and their latest calls. A call is only returned after its question has
--     locked, so this never reveals a pick someone can still copy. Players hidden from the leaderboard keep their calls private.
--   * send_nudge now also allows reminding someone you follow or share a group with (it was buddies and rivals only).
--     Limits are unchanged: one reminder per sender per player per day, five per player per day, never once they have played.

create or replace function public.player_card_extras(p_username text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid; hidden boolean; is_banned_user boolean;
  today date := (now() at time zone 'America/New_York')::date;
  is_buddy boolean := false; is_rival boolean := false; i_follow boolean := false; groupmate boolean := false;
  shared_group text := null;
  total_q int := 0; picked int := 0; any_open boolean := false;
  picks jsonb := '[]'::jsonb;
  can_see boolean;
begin
  select p.id, coalesce(p.hide_from_leaderboard, false), coalesce(p.banned, false)
    into target, hidden, is_banned_user
    from public.profiles p where lower(p.username) = lower(p_username);
  if target is null or is_banned_user then return null; end if;

  if me is not null and me <> target then
    is_buddy := exists (select 1 from public.buddies where (user_id = me and buddy_id = target) or (user_id = target and buddy_id = me));
    is_rival := exists (select 1 from public.rivals where (user_id = me and rival_id = target) or (user_id = target and rival_id = me));
    i_follow := exists (select 1 from public.follows where follower_id = me and followee_id = target and active);
    select g.name into shared_group
      from public.group_members a
      join public.group_members b on b.group_id = a.group_id and b.user_id = target
      join public.groups g on g.id = a.group_id
     where a.user_id = me order by g.created_at limit 1;
    groupmate := shared_group is not null;
  end if;

  can_see := (me = target) or is_buddy or is_rival or i_follow or groupmate;

  select count(*) into total_q from public.daily_questions where question_date = today and not voided;
  select count(*) into picked
    from public.predictions pr join public.daily_questions q on q.id = pr.question_id
   where pr.user_id = target and q.question_date = today and not q.voided;
  select exists (select 1 from public.daily_questions where question_date = today and not voided and lock_time > now()) into any_open;

  if not hidden or me = target then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.question_date desc, x.slot desc), '[]'::jsonb) into picks
      from (
        select q.question_text as text, pr.choice, q.question_date, q.slot, q.category,
               q.resolved, q.correct_answer
          from public.predictions pr
          join public.daily_questions q on q.id = pr.question_id
         where pr.user_id = target and not q.voided
           and (q.lock_time is null or q.lock_time <= now())
         order by q.question_date desc, q.slot desc
         limit 5
      ) x;
  end if;

  return jsonb_build_object(
    'user_id', target,
    'is_buddy', is_buddy,
    'is_rival', is_rival,
    'i_follow', i_follow,
    'shared_group', shared_group,
    'can_remind', (is_buddy or is_rival or i_follow or groupmate),
    'played_today', case when can_see then (total_q > 0 and picked >= total_q) else null end,
    'picked_today', case when can_see then picked else null end,
    'total_today', total_q,
    'calls_open', any_open,
    'picks_hidden', (hidden and me is distinct from target),
    'latest', picks
  );
end;
$$;

revoke all on function public.player_card_extras(text) from public;
grant execute on function public.player_card_extras(text) to anon, authenticated;

-- Reminders: buddies, rivals, people you follow, and group-mates.
create or replace function public.send_nudge(p_to_user_id uuid)
returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare
  me uuid := auth.uid();
  today date := (now() at time zone 'America/New_York')::date;
  total_q int; picked int; received int; new_id uuid; uname text;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if p_to_user_id is null or p_to_user_id = me then raise exception 'Invalid friend'; end if;
  if not (
    exists (select 1 from buddies where (user_id = me and buddy_id = p_to_user_id) or (user_id = p_to_user_id and buddy_id = me))
    or exists (select 1 from rivals where (user_id = me and rival_id = p_to_user_id) or (user_id = p_to_user_id and rival_id = me))
    or exists (select 1 from follows where follower_id = me and followee_id = p_to_user_id and active)
    or exists (select 1 from group_members a join group_members b on b.group_id = a.group_id where a.user_id = me and b.user_id = p_to_user_id)
  ) then raise exception 'You can only remind buddies, rivals, group-mates and people you follow.'; end if;

  select count(*) into total_q from daily_questions where question_date = today;
  if total_q = 0 or not exists (select 1 from daily_questions where question_date = today and lock_time > now()) then
    return jsonb_build_object('status', 'locked');
  end if;
  select count(*) into picked from predictions p join daily_questions q on q.id = p.question_id
    where p.user_id = p_to_user_id and q.question_date = today;
  if picked >= total_q then return jsonb_build_object('status', 'already_picked'); end if;

  select count(*) into received from nudges where to_user_id = p_to_user_id and nudge_date = today;
  if received >= 5 then return jsonb_build_object('status', 'limit'); end if;

  insert into nudges (from_user_id, to_user_id, nudge_date) values (me, p_to_user_id, today)
    on conflict (from_user_id, to_user_id, nudge_date) do nothing returning id into new_id;
  if new_id is null then return jsonb_build_object('status', 'already_sent'); end if;

  select username into uname from profiles where id = me;
  return jsonb_build_object('status', 'sent', 'nudge_id', new_id, 'from_username', uname);
end;
$$;
