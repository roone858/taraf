-- Manual product order, managed from Admin → المنتجات (up/down buttons). Lower comes first.
-- Backfilled from the previous default (newest first) so the storefront looks the same until reordered.
alter table public.products add column if not exists sort_order integer not null default 0;

update public.products p
set sort_order = r.rn * 10
from (
  select id, row_number() over (order by created_at desc, id) as rn
  from public.products
) r
where p.id = r.id;

create index if not exists products_sort_order_idx on public.products (sort_order, created_at desc);
