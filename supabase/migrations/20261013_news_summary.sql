-- Short article summary from the news feed, used to write better debate questions.
alter table public.news_ticker add column if not exists summary text;
