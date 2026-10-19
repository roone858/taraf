-- Home page layout & copy managed from Admin → الصفحة الرئيسية (section order/visibility/titles,
-- hero labels, story images, gallery). Missing keys fall back to defaults in src/lib/home-config.ts.
alter table public.store_settings add column if not exists home_config jsonb not null default '{}'::jsonb;
