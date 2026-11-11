-- One short line under each question on the Play card saying why it is on today
-- (e.g. "Debuts on Netflix today"). Nullable: cards without one just show nothing.
alter table public.daily_questions add column if not exists why_today text;
