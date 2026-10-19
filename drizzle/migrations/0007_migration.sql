-- Admin-curated "best sellers" flag, shown as a home-page section and a card badge.
alter table public.products add column if not exists is_bestseller boolean not null default false;
create index if not exists products_bestseller_idx on public.products (is_published, is_bestseller);
