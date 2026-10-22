-- Custom furniture requests («التفصيل حسب الطلب», /custom).
-- Visitors submit through submit_custom_request(); only admins can read or manage requests.
-- Reference photos go to the private «custom-requests» bucket: anyone may upload into refs/,
-- only admins may view them (through signed URLs).

create type public.custom_request_status as enum ('new', 'contacted', 'quoted', 'in_production', 'delivered', 'closed');

create sequence public.custom_request_number_seq start 1001;

create table public.custom_requests (
  id uuid primary key default gen_random_uuid(),
  request_number text not null unique default ('TFS-' || nextval('public.custom_request_number_seq')),
  status public.custom_request_status not null default 'new',
  customer_name text not null check (char_length(customer_name) between 3 and 100),
  phone text not null check (char_length(phone) between 8 and 20),
  email text check (email is null or char_length(email) <= 120),
  city text not null check (char_length(city) between 2 and 120),
  furniture_type text not null check (char_length(furniture_type) between 2 and 80),
  description text not null check (char_length(description) between 10 and 2000),
  dimensions text check (dimensions is null or char_length(dimensions) <= 200),
  budget text check (budget is null or char_length(budget) <= 80),
  materials text check (materials is null or char_length(materials) <= 300),
  -- Storage paths inside the custom-requests bucket, e.g. refs/<uuid>.jpg
  reference_images text[] not null default '{}' check (cardinality(reference_images) <= 5),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.custom_requests (status, created_at desc);
create index on public.custom_requests (phone, created_at desc);

-- Inserts only through submit_custom_request(); admins update status and notes directly.
grant select, delete on public.custom_requests to authenticated;
grant update (status, admin_notes, updated_at) on public.custom_requests to authenticated;
grant all on public.custom_requests to service_role;
grant usage on sequence public.custom_request_number_seq to service_role;

alter table public.custom_requests enable row level security;
create policy "admins read custom requests" on public.custom_requests for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins update custom requests" on public.custom_requests for update to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete custom requests" on public.custom_requests for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Public entry point. Errors are raised as stable codes for the client to translate.
create or replace function public.submit_custom_request(_request jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _name text := btrim(coalesce(_request->>'name', ''));
  _phone text := btrim(coalesce(_request->>'phone', ''));
  _email text := nullif(btrim(coalesce(_request->>'email', '')), '');
  _city text := btrim(coalesce(_request->>'city', ''));
  _type text := btrim(coalesce(_request->>'furniture_type', ''));
  _description text := btrim(coalesce(_request->>'description', ''));
  _dimensions text := nullif(btrim(coalesce(_request->>'dimensions', '')), '');
  _budget text := nullif(btrim(coalesce(_request->>'budget', '')), '');
  _materials text := nullif(btrim(coalesce(_request->>'materials', '')), '');
  _images text[];
  _number text;
begin
  if _phone !~ '^\+?[0-9\s-]{8,20}$' then raise exception 'invalid_phone'; end if;
  if _email is not null and _email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email'; end if;
  if char_length(_name) not between 3 and 100 or char_length(_city) not between 2 and 120
     or char_length(_type) not between 2 and 80 or char_length(_description) not between 10 and 2000
     or char_length(coalesce(_dimensions, '')) > 200 or char_length(coalesce(_budget, '')) > 80
     or char_length(coalesce(_materials, '')) > 300 then
    raise exception 'invalid_request';
  end if;

  if jsonb_typeof(coalesce(_request->'images', '[]'::jsonb)) <> 'array' then raise exception 'invalid_images'; end if;
  select coalesce(array_agg(v), '{}') into _images
  from jsonb_array_elements_text(coalesce(_request->'images', '[]'::jsonb)) as v;
  if cardinality(_images) > 5
     or exists (select 1 from unnest(_images) p where p !~ '^refs/[0-9a-f-]{36}\.[a-z0-9]{2,5}$') then
    raise exception 'invalid_images';
  end if;

  -- Basic abuse guard: at most 3 requests per phone number per hour
  if (select count(*) from custom_requests where phone = _phone and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'rate_limited';
  end if;

  insert into custom_requests (customer_name, phone, email, city, furniture_type, description, dimensions, budget, materials, reference_images)
  values (_name, _phone, _email, _city, _type, _description, _dimensions, _budget, _materials, _images)
  returning request_number into _number;
  return _number;
end $$;

revoke all on function public.submit_custom_request(jsonb) from public;
grant execute on function public.submit_custom_request(jsonb) to anon, authenticated;

-- Reference photos: private bucket, images only, 8 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('custom-requests', 'custom-requests', false, 8388608,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

create policy "anyone uploads custom request refs" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'custom-requests' and (storage.foldername(name))[1] = 'refs');
create policy "admins read custom request refs" on storage.objects for select to authenticated
  using (bucket_id = 'custom-requests' and public.has_role(auth.uid(), 'admin'));
create policy "admins delete custom request refs" on storage.objects for delete to authenticated
  using (bucket_id = 'custom-requests' and public.has_role(auth.uid(), 'admin'));

-- Completed custom projects shown on /custom, managed from Admin → طلبات التفصيل.
-- [{ "image": "<url>", "title": "…", "note": "…" }]
alter table public.store_settings add column if not exists custom_projects jsonb not null default '[]'::jsonb;
alter table public.store_settings drop constraint if exists store_settings_custom_projects_is_array;
alter table public.store_settings add constraint store_settings_custom_projects_is_array check (jsonb_typeof(custom_projects) = 'array');
