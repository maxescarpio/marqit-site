-- News tab: store the photo each outlet supplies with a story.
-- Additive and nullable: existing rows simply have no photo, and the site
-- falls back to a text-only card until a story with a photo is fetched.
alter table public.news_ticker
  add column if not exists image_url text;
