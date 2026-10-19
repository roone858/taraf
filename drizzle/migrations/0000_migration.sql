create type public.app_role as enum ('admin');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles readable" on public.user_roles for select to authenticated using (user_id = auth.uid());

-- First account ever created becomes admin (bootstrap). Later accounts get no role.
create or replace function public.bootstrap_first_admin()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_admin after insert on auth.users
for each row execute function public.bootstrap_first_admin();

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public reads active categories" on public.categories for select using (is_active or public.has_role(auth.uid(),'admin'));
create policy "admins insert categories" on public.categories for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admins update categories" on public.categories for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins delete categories" on public.categories for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  description text,
  sku text,
  price numeric(12,2) not null check (price >= 0),
  sale_price numeric(12,2) check (sale_price is null or sale_price >= 0),
  stock int not null default 0 check (stock >= 0),
  availability text not null default 'in_stock' check (availability in ('in_stock','made_to_order','unavailable')),
  images text[] not null default '{}',
  width_cm numeric, height_cm numeric, depth_cm numeric,
  materials text,
  finishes text[] not null default '{}',
  colors text[] not null default '{}',
  is_published boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.products (category_id);
create index on public.products (is_published, created_at desc);
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "public reads published products" on public.products for select using (is_published or public.has_role(auth.uid(),'admin'));
create policy "admins insert products" on public.products for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "admins update products" on public.products for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "admins delete products" on public.products for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'TARAF FURNITURE',
  whatsapp_number text,
  currency text not null default 'EGP',
  delivery_fee numeric(12,2) not null default 0,
  contact_phone text, contact_email text, address text,
  instagram_url text, facebook_url text, twitter_url text,
  hero_title text not null default 'أناقة خالدة تُصاغ بالحرفة',
  hero_subtitle text not null default 'قطع أثاث فاخرة منحوتة بعناية، تمنح منزلك حضوراً لا يُنسى.',
  hero_image_url text,
  promo_banner text,
  story_title text not null default 'حرفة تتجاوز الزمن',
  story_body text not null default 'في طرف نؤمن أن كل قطعة أثاث تحكي قصة. نختار الخامات بعناية، ونهتم بأدق تفاصيل النحت والتشطيب، لنقدّم تصاميم تعيش معك لسنوات.',
  policies text,
  updated_at timestamptz not null default now()
);
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
grant all on public.store_settings to service_role;
alter table public.store_settings enable row level security;
create policy "public reads settings" on public.store_settings for select using (true);
create policy "admins update settings" on public.store_settings for update to authenticated using (public.has_role(auth.uid(),'admin'));
insert into public.store_settings (id) values (1);

insert into public.categories (name, slug, description, image_url, sort_order) values
('غرف المعيشة','living','جلسات راقية تجمع العائلة','/images/cat-living.jpg',1),
('غرف النوم','bedroom','هدوء وفخامة في كل ليلة','/images/cat-bedroom.jpg',2),
('غرف السفرة','dining','موائد تليق بالمناسبات','/images/cat-dining.jpg',3),
('الكراسي والكنب','seating','مقاعد منحوتة بأناقة','/images/p-chair.jpg',4),
('الطاولات','tables','طاولات بتفاصيل حرفية','/images/p-table.jpg',5),
('قطع الديكور','decor','لمسات تكمل المساحة','/images/p-decor.jpg',6);

insert into public.products (category_id,name,slug,description,price,sale_price,stock,images,is_published,is_featured,finishes,colors)
select c.id, v.name, v.slug, v.descr, v.price, v.sale, v.stock, v.imgs, true, v.feat, v.fin, v.col
from (values
 ('seating','كرسي ملكي منحوت','royal-carved-chair','كرسي بإطار خشبي منحوت يدوياً وتنجيد مخملي.',18500::numeric,null::numeric,4,array['/images/p-chair.jpg'],true,array['ذهبي عتيق','جوزي'],array['كحلي','بيج']),
 ('living','كنبة صالون كلاسيك','classic-salon-sofa','كنبة ثلاثية بتفاصيل نحت دقيقة.',64000,58000,2,array['/images/cat-living.jpg'],true,array['ذهبي عتيق'],array['كريمي','كحلي']),
 ('tables','طاولة قهوة رخامية','marble-coffee-table','سطح رخامي وقاعدة خشبية منحوتة.',22000,null,5,array['/images/p-table.jpg'],true,'{}'::text[],'{}'::text[]),
 ('dining','سفرة إمبراطورية','imperial-dining-set','طاولة سفرة مع ثمانية كراسي.',145000,null,1,array['/images/cat-dining.jpg'],true,array['جوزي داكن'],'{}'::text[]),
 ('bedroom','سرير فيكتوري','victorian-bed','سرير بلوح رأس منجد ومنحوت.',89000,null,0,array['/images/cat-bedroom.jpg'],false,'{}'::text[],array['بيج','رمادي']),
 ('decor','مرآة بإطار ذهبي','gilded-mirror','مرآة حائط بإطار منحوت مطلي بالذهب.',12500,9900,6,array['/images/p-decor.jpg'],false,'{}'::text[],'{}'::text[])
) as v(cat,name,slug,descr,price,sale,stock,imgs,feat,fin,col)
join public.categories c on c.slug = v.cat;
update public.products set availability='made_to_order' where slug='victorian-bed';