-- ALREADY APPLIED to the Marqit database on 2026-11-03 (run by the owner in the Supabase SQL editor).
-- Usernames are now unique regardless of capitalization: Max, MAX and max count as the same name.
-- Nobody's existing name changes; the rule only blocks new lookalikes (signup, Google signup, username change).
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
