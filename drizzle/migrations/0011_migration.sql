-- TikTok profile link, managed from Admin → الإعدادات → التواصل الاجتماعي.
alter table public.store_settings add column if not exists tiktok_url text;
