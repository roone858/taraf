-- Orders: recorded at checkout via place_order(); managed by admins.
-- Stock is NOT touched at checkout — it is deducted when an admin confirms the order (set_order_status).

create type public.order_status as enum ('new', 'confirmed', 'in_production', 'delivered', 'cancelled');

create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('TRF-' || nextval('public.order_number_seq')),
  customer_name text not null check (char_length(customer_name) between 3 and 100),
  phone text not null check (char_length(phone) between 8 and 20),
  city text not null check (char_length(city) between 2 and 60),
  address text not null check (char_length(address) between 8 and 300),
  notes text check (notes is null or char_length(notes) <= 500),
  status public.order_status not null default 'new',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  delivery_fee numeric(12,2) not null default 0 check (delivery_fee >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  currency text not null default 'EGP',
  admin_notes text,
  stock_deducted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (status, created_at desc);
create index on public.orders (phone, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  -- Snapshot at order time, so later product edits/deletes don't change past orders
  product_name text not null,
  variant text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity int not null check (quantity between 1 and 99),
  line_total numeric(12,2) not null check (line_total >= 0),
  -- How many units were taken from product stock on confirmation (0 for made-to-order)
  deducted_qty int not null default 0 check (deducted_qty >= 0)
);
create index on public.order_items (order_id);

-- Clients never write these tables directly: inserts go through place_order(),
-- status changes through set_order_status(). Admins may only edit notes directly.
grant select, delete on public.orders to authenticated;
grant update (admin_notes, updated_at) on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant all on public.orders, public.order_items to service_role;
grant usage on sequence public.order_number_seq to service_role;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
create policy "admins read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin'));
-- Only orders that never touched stock can be deleted
create policy "admins delete open orders" on public.orders for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') and status in ('new', 'cancelled') and not stock_deducted);
create policy "admins read order items" on public.order_items for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Public checkout entry point. Prices, totals and availability are computed here from the
-- database; the client only supplies product ids, quantities and customer details.
-- Errors are raised as stable codes (optionally "code:detail") for the client to translate.
create or replace function public.place_order(_customer jsonb, _items jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text := btrim(coalesce(_customer->>'name', ''));
  _phone text := btrim(coalesce(_customer->>'phone', ''));
  _city text := btrim(coalesce(_customer->>'city', ''));
  _address text := btrim(coalesce(_customer->>'address', ''));
  _notes text := nullif(btrim(coalesce(_customer->>'notes', '')), '');
  _fee numeric(12,2);
  _currency text;
  _order_id uuid;
  _number text;
  _subtotal numeric(12,2) := 0;
  _item jsonb;
  _qty int;
  _unit numeric(12,2);
  _p record;
begin
  if _phone !~ '^\+?[0-9\s-]{8,20}$' then raise exception 'invalid_phone'; end if;
  if char_length(_name) < 3 or char_length(_city) < 2 or char_length(_address) < 8 then
    raise exception 'invalid_customer';
  end if;
  if jsonb_typeof(_items) is distinct from 'array' or jsonb_array_length(_items) not between 1 and 30 then
    raise exception 'invalid_items';
  end if;

  -- Basic abuse guard: at most 3 orders per phone number per 10 minutes
  if (select count(*) from orders where phone = _phone and created_at > now() - interval '10 minutes') >= 3 then
    raise exception 'rate_limited';
  end if;

  select coalesce(delivery_fee, 0), currency into _fee, _currency from store_settings where id = 1;

  insert into orders (customer_name, phone, city, address, notes, delivery_fee, currency)
  values (_name, _phone, _city, _address, _notes, coalesce(_fee, 0), coalesce(_currency, 'EGP'))
  returning id, order_number into _order_id, _number;

  for _item in select * from jsonb_array_elements(_items) loop
    begin
      _qty := (_item->>'quantity')::int;
    exception when others then
      raise exception 'invalid_items';
    end;
    if _qty is null or _qty not between 1 and 99 then raise exception 'invalid_items'; end if;

    select id, name, price, sale_price, stock, availability, is_published into _p
    from products where id = nullif(_item->>'product_id', '')::uuid;
    if not found or not _p.is_published or _p.availability = 'unavailable' then
      raise exception 'product_unavailable:%', coalesce(_p.name, '');
    end if;
    if _p.availability = 'in_stock' and _qty > _p.stock then
      raise exception 'insufficient_stock:%', _p.name;
    end if;

    _unit := case when _p.sale_price is not null and _p.sale_price < _p.price then _p.sale_price else _p.price end;
    insert into order_items (order_id, product_id, product_name, variant, unit_price, quantity, line_total)
    values (_order_id, _p.id, _p.name, left(nullif(btrim(coalesce(_item->>'variant', '')), ''), 100), _unit, _qty, _unit * _qty);
    _subtotal := _subtotal + _unit * _qty;
  end loop;

  update orders set subtotal = _subtotal, total = _subtotal + delivery_fee where id = _order_id;
  return _number;
end $$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;

-- Admin status change. Moving to confirmed/in_production/delivered deducts stock once
-- (in-stock products only); moving back to new or to cancelled returns what was deducted.
-- Runs in one transaction: if any item lacks stock, nothing changes.
create or replace function public.set_order_status(_order_id uuid, _status public.order_status)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _o record;
  _it record;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;

  select * into _o from orders where id = _order_id for update;
  if not found then raise exception 'not_found'; end if;

  if _status in ('confirmed', 'in_production', 'delivered') and not _o.stock_deducted then
    for _it in select id, product_id, product_name, quantity from order_items where order_id = _order_id and product_id is not null loop
      update products set stock = stock - _it.quantity, updated_at = now()
      where id = _it.product_id and availability = 'in_stock' and stock >= _it.quantity;
      if found then
        update order_items set deducted_qty = _it.quantity where id = _it.id;
      elsif exists (select 1 from products where id = _it.product_id and availability = 'in_stock') then
        raise exception 'insufficient_stock:%', _it.product_name;
      end if;
    end loop;
    update orders set stock_deducted = true where id = _order_id;
  elsif _status in ('new', 'cancelled') and _o.stock_deducted then
    update products p set stock = p.stock + x.qty, updated_at = now()
    from (
      select product_id, sum(deducted_qty) as qty from order_items
      where order_id = _order_id and product_id is not null and deducted_qty > 0
      group by product_id
    ) x
    where p.id = x.product_id;
    update order_items set deducted_qty = 0 where order_id = _order_id;
    update orders set stock_deducted = false where id = _order_id;
  end if;

  update orders set status = _status, updated_at = now() where id = _order_id;
end $$;

revoke all on function public.set_order_status(uuid, public.order_status) from public;
grant execute on function public.set_order_status(uuid, public.order_status) to authenticated;
