-- SEO managed from Admin → تحسين الظهور. Every field is optional: blank values fall back to text built
-- from the product / category / store data (see src/lib/seo.ts).
alter table public.store_settings add column if not exists seo jsonb not null default '{}'::jsonb;

alter table public.products
  add column if not exists seo_title text,
  add column if not exists seo_description text;

alter table public.categories
  add column if not exists seo_title text,
  add column if not exists seo_description text;
