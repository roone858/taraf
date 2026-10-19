-- Customer testimonials shown on the home page; curated by admins.
create table public.testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 2 and 80),
  city text check (city is null or char_length(city) <= 60),
  rating smallint not null default 5 check (rating between 1 and 5),
  body text not null check (char_length(body) between 5 and 600),
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.testimonials (is_published, sort_order);

grant select on public.testimonials to anon, authenticated;
grant insert, update, delete on public.testimonials to authenticated;
grant all on public.testimonials to service_role;
alter table public.testimonials enable row level security;
create policy "public reads published testimonials" on public.testimonials for select
  using (is_published or public.has_role(auth.uid(), 'admin'));
create policy "admins insert testimonials" on public.testimonials for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update testimonials" on public.testimonials for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete testimonials" on public.testimonials for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
