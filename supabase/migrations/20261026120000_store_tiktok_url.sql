-- TikTok profile link (Admin → الإعدادات → التواصل الاجتماعي). Was in drizzle/0011, which was
-- removed with the drizzle folder before it ran.
alter table public.store_settings add column if not exists tiktok_url text;

notify pgrst, 'reload schema';
