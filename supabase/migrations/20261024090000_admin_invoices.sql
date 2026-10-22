-- Admin invoices: create, edit and delete orders from the dashboard.
-- An invoice is an order (its printable page is /admin/orders/<id>/invoice). Admins may set any
-- price and add free-text lines that aren't catalogue products. Stock stays consistent: an order
-- that has already deducted stock gives it back before its items change, then deducts again.
-- Errors are raised as stable codes, like place_order() / set_order_status().

create or replace function public.admin_save_order(_order_id uuid, _order jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text := btrim(coalesce(_order->>'name', ''));
  _phone text := btrim(coalesce(_order->>'phone', ''));
  _city text := btrim(coalesce(_order->>'city', ''));
  _address text := btrim(coalesce(_order->>'address', ''));
  _notes text := nullif(btrim(coalesce(_order->>'notes', '')), '');
  _items jsonb := _order->'items';
  _fee numeric(12,2);
  _status public.order_status;
  _o record;
  _id uuid;
  _was_deducted boolean := false;
  _item jsonb;
  _qty int;
  _price numeric(12,2);
  _pid uuid;
  _pname text;
  _line_name text;
  _subtotal numeric(12,2) := 0;
  _it record;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;

  if _phone !~ '^\+?[0-9\s-]{8,20}$' then raise exception 'invalid_phone'; end if;
  if char_length(_name) not between 3 and 100 or char_length(_city) not between 2 and 60
     or char_length(_address) not between 8 and 300 or char_length(coalesce(_notes, '')) > 500 then
    raise exception 'invalid_customer';
  end if;
  if jsonb_typeof(_items) is distinct from 'array' or jsonb_array_length(_items) not between 1 and 50 then
    raise exception 'invalid_items';
  end if;
  begin
    _fee := coalesce(nullif(_order->>'delivery_fee', '')::numeric, 0);
  exception when others then
    raise exception 'invalid_fee';
  end;
  if _fee < 0 then raise exception 'invalid_fee'; end if;

  if _order_id is null then
    insert into orders (customer_name, phone, city, address, notes, delivery_fee, currency)
    values (_name, _phone, _city, _address, _notes, _fee,
            coalesce((select currency from store_settings where id = 1), 'SAR'))
    returning id into _id;
  else
    select * into _o from orders where id = _order_id for update;
    if not found then raise exception 'not_found'; end if;
    _id := _order_id;
    _was_deducted := _o.stock_deducted;

    -- Give back what this order took from stock; it is taken again below for the new items
    if _was_deducted then
      update products p set stock = p.stock + x.qty, updated_at = now()
      from (
        select product_id, sum(deducted_qty) as qty from order_items
        where order_id = _id and product_id is not null and deducted_qty > 0
        group by product_id
      ) x
      where p.id = x.product_id;
    end if;

    delete from order_items where order_id = _id;
    update orders
    set customer_name = _name, phone = _phone, city = _city, address = _address, notes = _notes,
        delivery_fee = _fee, updated_at = now()
    where id = _id;
  end if;

  for _item in select * from jsonb_array_elements(_items) loop
    begin
      _qty := (_item->>'quantity')::int;
      _price := (_item->>'unit_price')::numeric;
      _pid := nullif(_item->>'product_id', '')::uuid;
    exception when others then
      raise exception 'invalid_items';
    end;
    if _qty is null or _qty not between 1 and 99 or _price is null or _price < 0 then
      raise exception 'invalid_items';
    end if;

    _pname := null;
    if _pid is not null then
      select name into _pname from products where id = _pid;
      if not found then _pid := null; end if; -- product deleted since: keep the line as free text
    end if;
    _line_name := coalesce(nullif(btrim(coalesce(_item->>'name', '')), ''), _pname);
    if _line_name is null or char_length(_line_name) > 200 then raise exception 'invalid_items'; end if;

    insert into order_items (order_id, product_id, product_name, variant, unit_price, quantity, line_total)
    values (_id, _pid, _line_name, left(nullif(btrim(coalesce(_item->>'variant', '')), ''), 100),
            _price, _qty, _price * _qty);
    _subtotal := _subtotal + _price * _qty;
  end loop;

  update orders set subtotal = _subtotal, total = _subtotal + _fee where id = _id;

  if _was_deducted then
    for _it in select id, product_id, product_name, quantity from order_items where order_id = _id and product_id is not null loop
      update products set stock = stock - _it.quantity, updated_at = now()
      where id = _it.product_id and availability = 'in_stock' and stock >= _it.quantity;
      if found then
        update order_items set deducted_qty = _it.quantity where id = _it.id;
      elsif exists (select 1 from products where id = _it.product_id and availability = 'in_stock') then
        raise exception 'insufficient_stock:%', _it.product_name;
      end if;
    end loop;
  end if;

  -- A new invoice may start at any status (e.g. a confirmed showroom sale)
  if _order_id is null and nullif(_order->>'status', '') is not null then
    begin
      _status := (_order->>'status')::public.order_status;
    exception when others then
      raise exception 'invalid_status';
    end;
    if _status <> 'new' then perform public.set_order_status(_id, _status); end if;
  end if;

  return _id;
end $$;

revoke all on function public.admin_save_order(uuid, jsonb) from public;
grant execute on function public.admin_save_order(uuid, jsonb) to authenticated;

-- Delete any order; stock it had deducted is returned first.
create or replace function public.admin_delete_order(_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _o record;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;

  select * into _o from orders where id = _order_id for update;
  if not found then raise exception 'not_found'; end if;

  if _o.stock_deducted then
    update products p set stock = p.stock + x.qty, updated_at = now()
    from (
      select product_id, sum(deducted_qty) as qty from order_items
      where order_id = _order_id and product_id is not null and deducted_qty > 0
      group by product_id
    ) x
    where p.id = x.product_id;
  end if;

  delete from orders where id = _order_id;
end $$;

revoke all on function public.admin_delete_order(uuid) from public;
grant execute on function public.admin_delete_order(uuid) to authenticated;
