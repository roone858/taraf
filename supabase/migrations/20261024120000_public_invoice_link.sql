-- Shareable invoice link for customers: /invoice/<invoice_token>.
-- The token is a random uuid per order (existing orders get one too); knowing it is what grants
-- read access, so the page shows only what the customer already knows (no admin notes, no stock).

alter table public.orders add column if not exists invoice_token uuid not null default gen_random_uuid();
create unique index if not exists orders_invoice_token_key on public.orders (invoice_token);

-- The invoice behind a token, or null.
create or replace function public.get_invoice(_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'order_number', o.order_number,
    'created_at', o.created_at,
    'status', o.status,
    'customer_name', o.customer_name,
    'phone', o.phone,
    'city', o.city,
    'address', o.address,
    'notes', o.notes,
    'subtotal', o.subtotal,
    'delivery_fee', o.delivery_fee,
    'total', o.total,
    'currency', o.currency,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id,
        'product_name', i.product_name,
        'variant', i.variant,
        'quantity', i.quantity,
        'unit_price', i.unit_price,
        'line_total', i.line_total
      ) order by i.product_name)
      from order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o
  where o.invoice_token = _token;
$$;

revoke all on function public.get_invoice(uuid) from public;
grant execute on function public.get_invoice(uuid) to anon, authenticated;

-- Lets the customer who just placed an order get its invoice link: both the order number and the
-- phone number it was placed with must match.
create or replace function public.order_invoice_token(_order_number text, _phone text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select invoice_token from orders
  where order_number = btrim(_order_number) and phone = btrim(_phone);
$$;

revoke all on function public.order_invoice_token(text, text) from public;
grant execute on function public.order_invoice_token(text, text) to anon, authenticated;
