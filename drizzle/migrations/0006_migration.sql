-- Product sizes: [{ "label": "160×200 سم", "price": 52000 | null }]. A null price means the product's own price.
alter table public.products add column if not exists sizes jsonb not null default '[]'::jsonb;
alter table public.products drop constraint if exists products_sizes_is_array;
alter table public.products add constraint products_sizes_is_array check (jsonb_typeof(sizes) = 'array');

-- place_order: same as 0003, plus size handling. When a product has sizes, the item must name one
-- that exists; its price (if set) replaces the product price. The size label is prepended to the
-- stored variant, e.g. "160×200 سم / جوزي".
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
  _base numeric(12,2);
  _p record;
  _size_label text;
  _size jsonb;
  _variant text;
begin
  if _phone !~ '^\+?[0-9\s-]{8,20}$' then raise exception 'invalid_phone'; end if;
  if char_length(_name) < 3 or char_length(_city) < 2 or char_length(_address) < 8 then
    raise exception 'invalid_customer';
  end if;
  if jsonb_typeof(_items) is distinct from 'array' or jsonb_array_length(_items) not between 1 and 30 then
    raise exception 'invalid_items';
  end if;

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

    select id, name, price, sale_price, stock, availability, is_published, sizes into _p
    from products where id = nullif(_item->>'product_id', '')::uuid;
    if not found or not _p.is_published or _p.availability = 'unavailable' then
      raise exception 'product_unavailable:%', coalesce(_p.name, '');
    end if;
    if _p.availability = 'in_stock' and _qty > _p.stock then
      raise exception 'insufficient_stock:%', _p.name;
    end if;

    _base := case when _p.sale_price is not null and _p.sale_price < _p.price then _p.sale_price else _p.price end;
    _size_label := nullif(btrim(coalesce(_item->>'size', '')), '');
    if jsonb_array_length(_p.sizes) > 0 then
      if _size_label is null then raise exception 'size_required:%', _p.name; end if;
      select s into _size from jsonb_array_elements(_p.sizes) s where s->>'label' = _size_label limit 1;
      if _size is null then raise exception 'size_unavailable:%', _p.name; end if;
      _unit := coalesce(nullif(_size->>'price', '')::numeric, _base);
    else
      _size_label := null;
      _unit := _base;
    end if;

    _variant := nullif(concat_ws(' / ', _size_label, left(nullif(btrim(coalesce(_item->>'variant', '')), ''), 100)), '');
    insert into order_items (order_id, product_id, product_name, variant, unit_price, quantity, line_total)
    values (_order_id, _p.id, _p.name, _variant, _unit, _qty, _unit * _qty);
    _subtotal := _subtotal + _unit * _qty;
    _size := null;
  end loop;

  update orders set subtotal = _subtotal, total = _subtotal + delivery_fee where id = _order_id;
  return _number;
end $$;

revoke all on function public.place_order(jsonb, jsonb) from public;
grant execute on function public.place_order(jsonb, jsonb) to anon, authenticated;
