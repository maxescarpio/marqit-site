-- Nov 12: group invite codes were 8 random hex characters (e.g. 3d13ba73), painful to type.
-- New codes are 5 characters from an alphabet with no look-alikes (no 0/O, 1/I/L), shown in capitals.
-- Joining is now case-insensitive, and the invite LINK (playmarqit.com/?group=CODE) is what the app shares.
-- Existing groups with an old 8-character code are switched to a short one (an old link stops working for new joiners).

create or replace function public.short_invite_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  chars constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  c text; i int;
begin
  loop
    c := '';
    for i in 1..5 loop
      c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.groups g where upper(g.invite_code) = c);
  end loop;
  return c;
end;
$$;

alter table public.groups alter column invite_code set default public.short_invite_code();

update public.groups set invite_code = public.short_invite_code() where invite_code ~ '^[0-9a-f]{8}$';

create or replace function public.join_group_by_invite_code(p_invite_code text)
returns uuid
language plpgsql security definer set search_path to 'public' as $$
declare
  v_group_id uuid;
begin
  select id into v_group_id from public.groups where upper(invite_code) = upper(btrim(coalesce(p_invite_code, '')));
  if v_group_id is null then
    return null;
  end if;

  insert into public.group_members (group_id, user_id)
  values (v_group_id, auth.uid());

  return v_group_id;
end;
$$;
