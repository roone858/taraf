-- Frequently asked questions shown on the shop page; managed by admins.
create table public.faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(question) between 3 and 200),
  answer text not null check (char_length(answer) between 2 and 2000),
  is_published boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.faqs (is_published, sort_order);

grant select on public.faqs to anon, authenticated;
grant insert, update, delete on public.faqs to authenticated;
grant all on public.faqs to service_role;
alter table public.faqs enable row level security;
create policy "public reads published faqs" on public.faqs for select
  using (is_published or public.has_role(auth.uid(), 'admin'));
create policy "admins insert faqs" on public.faqs for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update faqs" on public.faqs for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "admins delete faqs" on public.faqs for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
