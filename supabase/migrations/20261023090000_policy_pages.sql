-- Policies & Legal Pages: bilingual, editable legal content managed from the admin dashboard.
-- Public visitors can only read published rows (RLS); only admins can create, edit, publish,
-- unpublish, archive or restore them. Every meaningful edit snapshots the previous version into
-- policy_revisions so content can be restored.

create type public.policy_status as enum ('draft', 'published', 'archived');

create table public.policy_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 2 and 80
  ),
  language text not null check (language in ('ar', 'en')),
  -- Stable identity for known policies, used by checkout/footer links even if the slug changes
  kind text check (kind is null or kind in ('privacy', 'terms', 'returns', 'shipping', 'cookies')),
  title text not null check (char_length(btrim(title)) between 2 and 200),
  content text not null default '' check (char_length(content) <= 200000),
  seo_title text check (seo_title is null or char_length(seo_title) <= 200),
  seo_description text check (seo_description is null or char_length(seo_description) <= 400),
  status public.policy_status not null default 'draft',
  -- Order of the links shown in the website footer (same order per language)
  sort_order integer not null default 0,
  last_updated_on date not null default current_date,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  unique (slug, language)
);

-- One Arabic and one English row per known policy kind
create unique index policy_pages_kind_language_key
  on public.policy_pages (kind, language)
  where kind is not null;

create index policy_pages_public_idx
  on public.policy_pages (language, status, sort_order)
  where status = 'published';
create index policy_pages_updated_idx on public.policy_pages (updated_at desc);

create table public.policy_revisions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.policy_pages (id) on delete cascade,
  slug text not null,
  language text not null,
  title text not null,
  content text not null,
  seo_title text,
  seo_description text,
  status public.policy_status not null,
  last_updated_on date not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null
);
create index policy_revisions_page_idx on public.policy_revisions (page_id, created_at desc);

grant select on public.policy_pages to anon, authenticated;
grant insert, update, delete on public.policy_pages to authenticated;
grant select on public.policy_revisions to authenticated;
grant all on public.policy_pages to service_role;
grant all on public.policy_revisions to service_role;

alter table public.policy_pages enable row level security;
alter table public.policy_revisions enable row level security;

create policy "published policy pages are public" on public.policy_pages
  for select to anon, authenticated
  using (status = 'published');
create policy "admins read policy pages" on public.policy_pages
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "admins insert policy pages" on public.policy_pages
  for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));
create policy "admins update policy pages" on public.policy_pages
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
create policy "admins delete policy pages" on public.policy_pages
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admins read policy revisions" on public.policy_revisions
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Snapshot the previous version, stamp audit fields, and maintain published_at.
create or replace function public.log_policy_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.title, old.content, old.seo_title, old.seo_description, old.slug, old.language, old.status, old.last_updated_on, old.kind)
     is distinct from
     (new.title, new.content, new.seo_title, new.seo_description, new.slug, new.language, new.status, new.last_updated_on, new.kind) then
    insert into public.policy_revisions (
      page_id, slug, language, title, content, seo_title, seo_description, status, last_updated_on, created_by
    )
    values (
      old.id, old.slug, old.language, old.title, old.content, old.seo_title, old.seo_description,
      old.status, old.last_updated_on, auth.uid()
    );

    -- Keep the 20 most recent revisions per page
    delete from public.policy_revisions
    where page_id = old.id
      and id not in (
        select id from public.policy_revisions
        where page_id = old.id
        order by created_at desc
        limit 20
      );
  end if;

  new.updated_at := now();
  new.updated_by := auth.uid();

  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  elsif new.status <> 'published' then
    new.published_at := null;
  end if;

  return new;
end;
$$;

create trigger policy_pages_revision
  before update on public.policy_pages
  for each row execute function public.log_policy_revision();

-- Seed the five required policies with real bilingual content (published).
insert into public.policy_pages
  (slug, language, kind, title, content, seo_title, seo_description, status, sort_order, last_updated_on)
values
  (
    'privacy-policy',
    'ar',
    'privacy',
    'سياسة الخصوصية',
    $html$<p>تحترم <strong>ترف للأثاث (TARAF FURNITURE)</strong> خصوصيتك وتلتزم بحماية بياناتك الشخصية. توضّح هذه السياسة البيانات التي نجمعها عند تصفح الموقع أو إتمام طلب، وكيفية استخدامها وحفظها ومشاركتها.</p>
<h2>البيانات التي نجمعها</h2>
<ul>
<li>بيانات الطلب: الاسم، رقم الهاتف، المدينة، العنوان، والملاحظات التي تكتبها لنا.</li>
<li>بيانات التواصل: رسائل واتساب أو البريد الإلكتروني التي ترسلها إلينا.</li>
<li>بيانات الاستخدام: صفحات الموقع التي تزورها ومعلومات تقنية عامة مثل نوع المتصفح، وذلك لتحسين تجربتك.</li>
</ul>
<h2>كيف نستخدم بياناتك</h2>
<ul>
<li>تجهيز طلبك وتأكيده وتنفيذ التوصيل أو التركيب.</li>
<li>التواصل معك بخصوص الطلب أو الاستفسارات أو طلبات التصميم الخاص.</li>
<li>تحسين المنتجات والخدمات وقياس أداء الموقع.</li>
<li>الالتزام بالمتطلبات القانونية والمحاسبية.</li>
</ul>
<h2>مشاركة البيانات</h2>
<p>لا نبيع بياناتك الشخصية. قد نشارك الحد الأدنى اللازم منها مع شركات التوصيل وشركاء التركيب ومزودي الخدمات التقنية (مثل الاستضافة وقواعد البيانات) لتشغيل الطلب فقط، وبما يتوافق مع القانون.</p>
<h2>حفظ البيانات وأمنها</h2>
<p>نحتفظ ببيانات الطلبات للمدة اللازمة للأغراض المحاسبية والقانونية. نستخدم اتصالات مشفّرة وصلاحيات وصول محدودة، ولا يصل إلى بيانات الطلبات إلا فريق العمل المخوّل.</p>
<h2>ملفات الارتباط</h2>
<p>يستخدم الموقع ملفات ارتباط ضرورية لتشغيل السلة والجلسة وقياس الزيارات. لمزيد من التفاصيل راجع <a href="/cookie-policy">سياسة ملفات الارتباط</a>.</p>
<h2>حقوقك</h2>
<p>يمكنك طلب الاطلاع على بياناتك أو تصحيحها أو حذفها عندما يسمح القانون بذلك، عبر التواصل معنا من بيانات الاتصال المنشورة في الموقع.</p>
<h2>تحديثات السياسة</h2>
<p>قد نحدّث هذه السياسة عند تغيّر خدماتنا أو الأنظمة المعمول بها، ويُعد تاريخ آخر تحديث الظاهر أعلى الصفحة نافذًا.</p>
<h2>التواصل</h2>
<p>لأي استفسار يتعلق بالخصوصية، تواصل معنا عبر رقم واتساب أو البريد الإلكتروني المذكورين في تذييل الموقع.</p>$html$,
    'سياسة الخصوصية | ترف للأثاث',
    'كيف يجمع ترف للأثاث بياناتك ويستخدمها ويحميها عند تصفح الموقع أو إتمام طلب.',
    'published',
    10,
    '2026-10-22'
  ),
  (
    'terms-and-conditions',
    'ar',
    'terms',
    'الشروط والأحكام',
    $html$<p>تنظّم هذه الشروط والأحكام استخدامك لموقع <strong>ترف للأثاث (TARAF FURNITURE)</strong> وشراء المنتجات من خلاله. باستخدامك الموقع أو تأكيد طلب فإنك توافق على هذه الشروط.</p>
<h2>الطلبات والأسعار</h2>
<ul>
<li>الأسعار المعروضة بالجنيه المصري وتشمل قيمة المنتج فقط، ما لم يُذكر خلاف ذلك.</li>
<li>يصبح الطلب ملزمًا بعد تأكيده من فريق المتجر عبر واتساب أو الهاتف.</li>
<li>قد نعدّل الطلب أو نلغيه إذا تبيّن خطأ واضح في السعر أو عدم توافر المنتج، مع إبلاغك وإعادة أي مبلغ مدفوع.</li>
</ul>
<h2>المنتجات المصنوعة حسب الطلب</h2>
<p>القطع المصنوعة حسب الطلب أو المخصّصة تُنفّذ وفق المقاسات والمواد والمواصفات المتفق عليها كتابيًا. قد تختلف تفاصيل الخشب أو القماش أو اللون اختلافًا طفيفًا بسبب طبيعة المواد الطبيعية والتصنيع اليدوي.</p>
<h2>الدفع</h2>
<p>يتم الاتفاق على طريقة الدفع عند تأكيد الطلب. لا يُطلب منك تحويل أي مبلغ إلى حساب لا يظهر ضمن قنوات التواصل الرسمية للمتجر.</p>
<h2>التوصيل والتركيب</h2>
<p>تخضع مواعيد التوصيل والتركيب للسياسة المنشورة في <a href="/shipping-policy">سياسة الشحن والتوصيل</a>. يرجى تهيئة المكان وضمان وصول القطعة إلى المدخل قبل موعد التسليم.</p>
<h2>الاستبدال والاسترجاع</h2>
<p>تخضع عمليات الاستبدال والاسترجاع لـ<a href="/return-policy">سياسة الاستبدال والاسترجاع</a>.</p>
<h2>الملكية الفكرية</h2>
<p>جميع الصور والنصوص والتصميمات والشعارات على الموقع مملوكة لترف للأثاث أو مرخّصة له، ولا يجوز نسخها أو استخدامها تجاريًا دون إذن كتابي.</p>
<h2>حدود المسؤولية</h2>
<p>نبذل جهدًا معقولًا لضمان دقة المعلومات، لكننا لا نضمن خلو الموقع من الانقطاع المؤقت. لا نتحمل مسؤولية الاستخدام غير الصحيح للمنتجات أو تغييرها خارج تعليماتنا.</p>
<h2>القانون المطبّق</h2>
<p>تخضع هذه الشروط لأحكام القانون المصري، وتختص المحاكم المصرية بأي نزاع ينشأ عنها.</p>$html$,
    'الشروط والأحكام | ترف للأثاث',
    'شروط الطلب والدفع والتوصيل والملكية الفكرية والمسؤولية في متجر ترف للأثاث.',
    'published',
    20,
    '2026-10-22'
  ),
  (
    'return-policy',
    'ar',
    'returns',
    'سياسة الاستبدال والاسترجاع',
    $html$<p>نريد أن تكون راضيًا تمامًا عن قطعتك. توضّح هذه السياسة حالات الاستبدال والاسترجاع وشروطها ومددها.</p>
<h2>المنتجات الجاهزة</h2>
<ul>
<li>يمكن طلب الاستبدال أو الاسترجاع خلال <strong>14 يومًا</strong> من تاريخ الاستلام.</li>
<li>يجب أن تكون القطعة بحالتها الأصلية، غير مستخدمة، مع كامل ملحقاتها وتغليفها إن أمكن.</li>
<li>يلزم إرفاق رقم الطلب وصور توضّح الحالة عند التواصل.</li>
</ul>
<h2>المنتجات المصنوعة حسب الطلب</h2>
<p>القطع المخصّصة أو المصنوعة بمقاسات ومواد مختارة لا تخضع للاسترجاع أو الاستبدال بسبب تغيير الرأي، ويقتصر حقك على معالجة العيوب الصناعية أو الاختلاف الجوهري عن المواصفات المتفق عليها.</p>
<h2>العيوب أو التلف</h2>
<p>يرجى فحص القطعة عند الاستلام وإبلاغنا خلال <strong>48 ساعة</strong> بأي تلف أو نقص أو عيب ظاهر، مع صور واضحة. نتحمل نحن تكلفة الاستبدال أو الإصلاح في حال ثبوت العيب.</p>
<h2>خطوات الطلب</h2>
<ol>
<li>تواصل معنا عبر واتساب أو الهاتف مع رقم الطلب وسبب الطلب.</li>
<li>نراجع الحالة ونحدّد موعد الاستلام خلال 2–4 أيام عمل.</li>
<li>بعد فحص القطعة واستيفاء الشروط، نُكمل الاستبدال أو الاسترجاع.</li>
</ol>
<h2>الاسترداد</h2>
<p>يتم رد المبلغ بنفس طريقة الدفع بعد قبول الطلب، عادة خلال 7–14 يوم عمل. تُخصم تكاليف النقل عند الاسترجاع بسبب تغيير الرأي، ما لم يُتفق على خلاف ذلك.</p>
<h2>حالات لا تشملها السياسة</h2>
<ul>
<li>الأضرار الناتجة عن الاستخدام الخاطئ أو التركيب خارج تعليماتنا.</li>
<li>التغييرات التي تُجرى على القطعة بعد الاستلام.</li>
<li>المنتجات المخفّضة المبيعة بوصفها «كما هي» إذا ذُكر ذلك بوضوح قبل الشراء.</li>
</ul>
<h2>التواصل</h2>
<p>لبدء طلب استبدال أو استرجاع، استخدم بيانات التواصل الرسمية الظاهرة في الموقع.</p>$html$,
    'سياسة الاستبدال والاسترجاع | ترف للأثاث',
    'شروط ومدد استبدال واسترجاع منتجات ترف للأثاث، بما في ذلك القطع المصنوعة حسب الطلب.',
    'published',
    30,
    '2026-10-22'
  ),
  (
    'shipping-policy',
    'ar',
    'shipping',
    'سياسة الشحن والتوصيل',
    $html$<p>نوفّر توصيلًا داخل مصر للقطع الجاهزة والمصنوعة حسب الطلب، مع إمكانية التركيب في بعض المناطق. توضّح هذه السياسة المواعيد والرسوم والإجراءات.</p>
<h2>مناطق التوصيل</h2>
<p>نغطي القاهرة والجيزة وعددًا من المحافظات. تظهر إمكانية التوصيل إلى مدينتك ورسومها عند إتمام الطلب، أو يؤكدها فريقنا عبر واتساب.</p>
<h2>مدة التجهيز</h2>
<ul>
<li>القطع الجاهزة: تجهيز خلال 1–3 أيام عمل قبل الشحن.</li>
<li>القطع المصنوعة حسب الطلب: من 10 إلى 21 يوم عمل حسب التصميم والمواد، ويُبلّغك فريقنا بالمدة المتوقعة عند التأكيد.</li>
</ul>
<h2>مدة التوصيل</h2>
<p>يستغرق التوصيل عادة من 2 إلى 7 أيام عمل داخل القاهرة والجيزة، وقد تزيد المدة في المحافظات البعيدة أو خلال المواسم. نتواصل معك لتحديد موعد التسليم قبل الانطلاق.</p>
<h2>رسوم التوصيل</h2>
<p>تُحسب الرسوم حسب المدينة وحجم القطعة وخدمة التركيب، وتظهر بوضوح قبل تأكيد الطلب. لا توجد رسوم مخفية.</p>
<h2>الاستلام والتركيب</h2>
<ul>
<li>يرجى التأكد من تواجد شخص بالغ لاستلام الطلب في الموعد المتفق عليه.</li>
<li>يلزم توفير مساحة آمنة ومدخل مناسب يسمح بمرور القطعة.</li>
<li>خدمة التركيب متاحة مقابل رسوم تُحدّد مسبقًا، ويُرجى عدم تركيب القطع المعقّدة بنفسك.</li>
</ul>
<h2>التأخيرات</h2>
<p>قد تتأثر المواعيد بعوامل خارجة عن إرادتنا مثل الطقس أو الظروف المرورية أو إغلاق الطرق. نبلغك بأي تأخير جوهري في أقرب وقت ونعمل على تقليل أثره.</p>
<h2>استلام القطعة</h2>
<p>يرجى فحص القطعة عند التسليم والتوقيع على إيصال الاستلام. أي تلف ظاهر يجب تسجيله مع مندوب التوصيل وإبلاغنا خلال 48 ساعة.</p>$html$,
    'سياسة الشحن والتوصيل | ترف للأثاث',
    'مواعيد ورسوم توصيل وتركيب منتجات ترف للأثاث داخل مصر، ومدة تجهيز القطع الجاهزة والمخصصة.',
    'published',
    40,
    '2026-10-22'
  ),
  (
    'cookie-policy',
    'ar',
    'cookies',
    'سياسة ملفات الارتباط',
    $html$<p>يستخدم موقع ترف للأثاث ملفات ارتباط (Cookies) وتقنيات مشابهة لضمان عمل الموقع وتحسين تجربتك. توضّح هذه السياسة أنواعها وكيفية التحكم بها.</p>
<h2>ما هي ملفات الارتباط؟</h2>
<p>ملفات صغيرة تُحفظ على جهازك عند زيارة الموقع، وتساعد على تذكّر سلتك وتفضيلاتك وقياس أداء الصفحات.</p>
<h2>الملفات الضرورية</h2>
<p>لا يعمل الموقع دونها، فهي تحفظ محتويات السلة والجلسة وتحمي النماذج من الاستخدام الآلي. لا تحتاج إلى موافقة مسبقة لتشغيلها لأنها أساسية لتقديم الخدمة.</p>
<h2>ملفات القياس والتحليلات</h2>
<p>نستخدم أدوات قياس مجهولة الهوية لمعرفة الصفحات الأكثر زيارة ومعدل التحويل، بهدف تحسين المحتوى وتجربة التسوق. لا تُستخدم هذه البيانات لتحديد هويتك شخصيًا.</p>
<h2>ملفات الطرف الثالث</h2>
<p>قد تضع خدمات خارجية مثل أدوات التحليلات أو خرائط الموقع ملفاتها وفق سياساتها الخاصة. لا نتحكم في هذه الملفات ويمكنك مراجعة سياسات تلك الخدمات.</p>
<h2>إدارة الملفات</h2>
<p>يمكنك حذف أو حظر ملفات الارتباط من إعدادات متصفحك. قد يؤثر تعطيل الملفات الضرورية على عمل السلة أو إتمام الطلب.</p>
<h2>تحديثات السياسة</h2>
<p>قد نحدّث هذه السياسة عند إضافة أدوات جديدة، ويظهر تاريخ آخر تحديث أعلى الصفحة.</p>$html$,
    'سياسة ملفات الارتباط | ترف للأثاث',
    'أنواع ملفات الارتباط التي يستخدمها موقع ترف للأثاث وكيفية إدارتها.',
    'published',
    50,
    '2026-10-22'
  ),
  (
    'privacy-policy',
    'en',
    'privacy',
    'Privacy Policy',
    $html$<p><strong>TARAF FURNITURE</strong> respects your privacy and is committed to protecting your personal data. This policy explains what we collect when you browse our website or place an order, and how we use, store and share that information.</p>
<h2>Information we collect</h2>
<ul>
<li>Order details: name, phone number, city, address and any notes you add.</li>
<li>Communication details: WhatsApp messages or emails you send us.</li>
<li>Usage data: pages you visit and general technical information such as browser type, used to improve your experience.</li>
</ul>
<h2>How we use your information</h2>
<ul>
<li>Prepare, confirm and deliver your order, including installation where available.</li>
<li>Contact you about orders, enquiries or custom furniture requests.</li>
<li>Improve our products and services and measure website performance.</li>
<li>Meet legal and accounting obligations.</li>
</ul>
<h2>Sharing your information</h2>
<p>We do not sell your personal data. We may share the minimum necessary information with delivery and installation partners and technical service providers (such as hosting and database providers) solely to operate your order and as permitted by law.</p>
<h2>Retention and security</h2>
<p>We keep order data for as long as needed for accounting and legal purposes. We use encrypted connections and restricted access, and only authorised team members can access order information.</p>
<h2>Cookies</h2>
<p>Our website uses essential cookies for the cart and session, and measurement cookies to understand visits. See our <a href="/en/cookie-policy">Cookie Policy</a> for details.</p>
<h2>Your rights</h2>
<p>You may request access to, correction of, or deletion of your data where the law allows, using the contact details published on this website.</p>
<h2>Policy updates</h2>
<p>We may update this policy when our services or applicable regulations change. The last-updated date at the top of this page is authoritative.</p>
<h2>Contact us</h2>
<p>For any privacy question, contact us through the WhatsApp number or email listed in the website footer.</p>$html$,
    'Privacy Policy | TARAF FURNITURE',
    'How TARAF FURNITURE collects, uses and protects your personal data when you browse or order.',
    'published',
    10,
    '2026-10-22'
  ),
  (
    'terms-and-conditions',
    'en',
    'terms',
    'Terms & Conditions',
    $html$<p>These terms govern your use of the <strong>TARAF FURNITURE</strong> website and your purchases through it. By using the site or confirming an order you agree to these terms.</p>
<h2>Orders and pricing</h2>
<ul>
<li>Prices are shown in Egyptian Pounds and cover the product only unless stated otherwise.</li>
<li>An order becomes binding once confirmed by our team via WhatsApp or phone.</li>
<li>We may adjust or cancel an order if there is a clear pricing error or the item is unavailable, after informing you and refunding any payment made.</li>
</ul>
<h2>Made-to-order products</h2>
<p>Custom or made-to-order pieces are produced to the dimensions, materials and specifications agreed in writing. Natural wood, fabric and colour may vary slightly due to the nature of materials and handcrafting.</p>
<h2>Payment</h2>
<p>The payment method is agreed when the order is confirmed. Never transfer money to an account that is not part of our official contact channels.</p>
<h2>Delivery and installation</h2>
<p>Delivery and installation times follow our <a href="/en/shipping-policy">Shipping &amp; Delivery Policy</a>. Please prepare the space and ensure access to the delivery point before your scheduled time.</p>
<h2>Returns and refunds</h2>
<p>Returns and exchanges follow our <a href="/en/return-policy">Returns &amp; Refunds Policy</a>.</p>
<h2>Intellectual property</h2>
<p>All images, text, designs and logos on this website belong to TARAF FURNITURE or are licensed to it. They may not be copied or used commercially without written permission.</p>
<h2>Limitation of liability</h2>
<p>We take reasonable care to keep information accurate, but we do not guarantee uninterrupted availability of the website. We are not liable for misuse of products or for modifications made outside our instructions.</p>
<h2>Governing law</h2>
<p>These terms are governed by the laws of Egypt, and Egyptian courts have jurisdiction over any dispute arising from them.</p>$html$,
    'Terms & Conditions | TARAF FURNITURE',
    'Ordering, payment, delivery, intellectual property and liability terms for the TARAF FURNITURE store.',
    'published',
    20,
    '2026-10-22'
  ),
  (
    'return-policy',
    'en',
    'returns',
    'Returns & Refunds Policy',
    $html$<p>We want you to be fully satisfied with your piece. This policy explains when and how exchanges and returns are accepted.</p>
<h2>Ready-made products</h2>
<ul>
<li>You may request an exchange or return within <strong>14 days</strong> of delivery.</li>
<li>The item must be unused and in its original condition, with all accessories and packaging where possible.</li>
<li>Please include your order number and clear photos when you contact us.</li>
</ul>
<h2>Made-to-order products</h2>
<p>Custom pieces produced to your chosen dimensions and materials cannot be returned or exchanged for a change of mind. Your rights cover manufacturing defects or a material difference from the agreed specifications.</p>
<h2>Defects or damage</h2>
<p>Please inspect the item on delivery and report any visible damage, missing parts or defect within <strong>48 hours</strong> with clear photos. We cover the cost of replacement or repair when the defect is confirmed.</p>
<h2>How to request</h2>
<ol>
<li>Contact us via WhatsApp or phone with your order number and the reason for the request.</li>
<li>We review the case and arrange collection within 2–4 business days.</li>
<li>Once the item is inspected and the conditions are met, we complete the exchange or refund.</li>
</ol>
<h2>Refunds</h2>
<p>Refunds are issued through the original payment method after approval, usually within 7–14 business days. Return transport costs are deducted for change-of-mind returns unless agreed otherwise.</p>
<h2>Exclusions</h2>
<ul>
<li>Damage caused by misuse or installation outside our instructions.</li>
<li>Alterations made after delivery.</li>
<li>Clearance items sold “as is” when this was stated before purchase.</li>
</ul>
<h2>Contact</h2>
<p>To start a return or exchange, use the official contact details shown on this website.</p>$html$,
    'Returns & Refunds Policy | TARAF FURNITURE',
    'Exchange and return windows and conditions for TARAF FURNITURE products, including custom pieces.',
    'published',
    30,
    '2026-10-22'
  ),
  (
    'shipping-policy',
    'en',
    'shipping',
    'Shipping & Delivery Policy',
    $html$<p>We deliver across Egypt for ready-made and made-to-order pieces, with installation available in selected areas. This policy explains timings, fees and procedures.</p>
<h2>Delivery areas</h2>
<p>We cover Cairo, Giza and a number of governorates. Availability and fees for your city are shown at checkout or confirmed by our team on WhatsApp.</p>
<h2>Preparation time</h2>
<ul>
<li>Ready-made items: prepared within 1–3 business days before dispatch.</li>
<li>Made-to-order items: 10–21 business days depending on design and materials. Our team confirms the expected time when you order.</li>
</ul>
<h2>Delivery time</h2>
<p>Delivery usually takes 2–7 business days within Cairo and Giza, and may take longer in remote governorates or peak seasons. We contact you to agree a delivery slot before dispatch.</p>
<h2>Delivery fees</h2>
<p>Fees depend on the city, item size and installation service, and are shown clearly before you confirm the order. There are no hidden charges.</p>
<h2>Receiving and installation</h2>
<ul>
<li>Please ensure an adult is available to receive the order at the agreed time.</li>
<li>Provide safe access and a doorway that allows the item to pass through.</li>
<li>Installation is available for a fee agreed in advance. Please do not attempt complex assembly yourself.</li>
</ul>
<h2>Delays</h2>
<p>Timings may be affected by factors beyond our control such as weather, traffic or road closures. We will inform you of any material delay as soon as possible and work to minimise it.</p>
<h2>On delivery</h2>
<p>Please inspect the item on delivery and sign the delivery receipt. Any visible damage must be recorded with the courier and reported to us within 48 hours.</p>$html$,
    'Shipping & Delivery Policy | TARAF FURNITURE',
    'Delivery times, fees and installation for TARAF FURNITURE products across Egypt.',
    'published',
    40,
    '2026-10-22'
  ),
  (
    'cookie-policy',
    'en',
    'cookies',
    'Cookie Policy',
    $html$<p>The TARAF FURNITURE website uses cookies and similar technologies to keep the site working and improve your experience. This policy explains the types we use and how to control them.</p>
<h2>What are cookies?</h2>
<p>Small files stored on your device when you visit a website. They help remember your cart and preferences and measure page performance.</p>
<h2>Essential cookies</h2>
<p>These are required for the site to work. They keep your cart and session and protect forms from automated abuse. They do not require prior consent because they are essential to provide the service.</p>
<h2>Analytics cookies</h2>
<p>We use privacy-friendly measurement tools to understand which pages are visited and how visitors move through the store. This helps us improve content and the shopping experience. The data is not used to identify you personally.</p>
<h2>Third-party cookies</h2>
<p>External services such as analytics providers or map tools may set their own cookies under their policies. We do not control those cookies, and you can review the relevant service policies.</p>
<h2>Managing cookies</h2>
<p>You can delete or block cookies in your browser settings. Disabling essential cookies may affect the cart or checkout.</p>
<h2>Policy updates</h2>
<p>We may update this policy when we add new tools. The last-updated date at the top of this page shows the current version.</p>$html$,
    'Cookie Policy | TARAF FURNITURE',
    'The types of cookies used by the TARAF FURNITURE website and how to manage them.',
    'published',
    50,
    '2026-10-22'
  )
on conflict (slug, language) do nothing;
