import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Facebook, Instagram, LayoutTemplate, Twitter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Settings } from "@/lib/data";
import { CURRENCIES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SnapchatIcon, TiktokIcon, WhatsappIcon } from "@/components/BrandIcons";
import { Field, PageHeader, SaveBar, Surface, inp } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

type Draft = Partial<Settings>;
/** Optional text columns: blank input is stored as NULL. */
const NULLABLE = [
  "contact_phone",
  "contact_email",
  "address",
  "instagram_url",
  "facebook_url",
  "snapchat_url",
  "tiktok_url",
  "twitter_url",
  "policies",
] as const;

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [d, setD] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data) setD(data);
  }, [data]);

  const dirty =
    !!data && (Object.keys(d) as (keyof Settings)[]).some((k) => (d[k] ?? "") !== (data[k] ?? ""));
  const set = (patch: Draft) => setD((x) => ({ ...x, ...patch }));
  const text = (k: keyof Settings) => ({
    value: String(d[k] ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      set({ [k]: e.target.value }),
  });

  const save = async () => {
    if (saving) return;
    if (!d.store_name?.trim()) return void toast.error("اسم المتجر مطلوب");
    const fee = Number(d.delivery_fee ?? 0);
    if (Number.isNaN(fee) || fee < 0) return void toast.error("رسوم التوصيل غير صحيحة");
    const vat = digits(d.vat_number);
    const cr = digits(d.cr_number);
    if (vat && vat.length !== 15) return void toast.error("الرقم الضريبي يتكون من 15 رقماً");
    if (cr && cr.length !== 10) return void toast.error("رقم السجل التجاري يتكون من 10 أرقام");
    setSaving(true);
    // Home-page fields are owned by Admin → الصفحة الرئيسية; never write them from here
    const {
      id: _id,
      updated_at: _u,
      hero_title: _ht,
      hero_subtitle: _hs,
      hero_image_url: _hi,
      promo_banner: _pb,
      story_title: _st,
      story_body: _sb,
      home_config: _hc,
      seo: _seo,
      ...rest
    } = d as Settings;
    const row = {
      ...rest,
      store_name: rest.store_name.trim(),
      whatsapp_number: rest.whatsapp_number?.replace(/\D/g, "") || null,
      delivery_fee: fee,
      vat_number: vat || null,
      cr_number: cr || null,
    };
    for (const k of NULLABLE) row[k] = row[k]?.trim() || null;
    const { error } = await supabase.from("store_settings").update(row).eq("id", 1);
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success("تم حفظ الإعدادات");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  if (!data) {
    return (
      <div className="max-w-5xl space-y-6" aria-busy="true" aria-label="جارٍ تحميل الإعدادات">
        <div className="h-10 w-48 animate-pulse rounded-lg bg-ivory" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse rounded-xl bg-ivory" />
        ))}
      </div>
    );
  }

  const currencyShort = CURRENCIES[d.currency ?? "EGP"]?.[0] ?? d.currency;

  return (
    <div className="max-w-5xl pb-28">
      <PageHeader title="الإعدادات" meta="بيانات المتجر، التواصل، روابط الحسابات، والسياسات." />

      <div className="mt-8 space-y-8">
        <Section
          title="المتجر"
          description="الاسم والعملة ورسوم التوصيل المستخدمة في الأسعار وصفحة الطلب."
        >
          <div className="sm:col-span-2">
            <Field label="اسم المتجر *">
              <input className={inp} {...text("store_name")} />
            </Field>
          </div>
          <Field label="العملة">
            <select
              className={inp}
              value={d.currency ?? "EGP"}
              onChange={(e) => set({ currency: e.target.value })}
            >
              {/* Native <option>s may not use the web font, so show the text label here */}
              {Object.entries(CURRENCIES).map(([code, [, short, name]]) => (
                <option key={code} value={code}>
                  {name} ({short})
                </option>
              ))}
            </select>
          </Field>
          <Field label="رسوم التوصيل">
            <div className="relative mt-1.5" dir="ltr">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                className={cn(inp, "mt-0 pe-14 text-end tabular-nums")}
                value={d.delivery_fee ?? ""}
                onChange={(e) =>
                  set({ delivery_fee: e.target.value === "" ? 0 : Number(e.target.value) })
                }
              />
              <span className="pointer-events-none absolute top-1/2 end-3 -translate-y-1/2 text-xs text-muted-foreground">
                {currencyShort}
              </span>
            </div>
          </Field>
        </Section>

        <Section title="التواصل" description="تظهر في تذييل الموقع، وتُرسل الطلبات إلى رقم واتساب.">
          <div className="sm:col-span-2">
            <Field label="رقم واتساب لاستقبال الطلبات">
              <IconInput
                icon={<WhatsappIcon className="h-4 w-4" />}
                dir="ltr"
                placeholder="966501234567"
                {...text("whatsapp_number")}
              />
              <Hint>بالصيغة الدولية بدون + أو أصفار في البداية.</Hint>
            </Field>
          </div>
          <Field label="هاتف التواصل">
            <input className={inp} dir="ltr" {...text("contact_phone")} />
          </Field>
          <Field label="البريد الإلكتروني">
            <input type="email" className={inp} dir="ltr" {...text("contact_email")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="العنوان">
              <input className={inp} {...text("address")} />
            </Field>
          </div>
        </Section>

        <Section
          title="البيانات التجارية"
          description="تظهر في الفواتير وأسفل الموقع. اتركها فارغة لإخفائها."
        >
          <Field label="الرقم الضريبي (VAT)">
            <input
              className={cn(inp, "tabular-nums")}
              dir="ltr"
              inputMode="numeric"
              maxLength={20}
              placeholder="3XXXXXXXXXXXXX3"
              {...text("vat_number")}
            />
            <Hint>15 رقماً كما في شهادة التسجيل في ضريبة القيمة المضافة.</Hint>
          </Field>
          <Field label="رقم السجل التجاري (CR)">
            <input
              className={cn(inp, "tabular-nums")}
              dir="ltr"
              inputMode="numeric"
              maxLength={20}
              placeholder="10XXXXXXXX"
              {...text("cr_number")}
            />
            <Hint>10 أرقام.</Hint>
          </Field>
        </Section>

        <Section
          title="التواصل الاجتماعي"
          description="روابط الحسابات الرسمية. الحقول الفارغة تفتح الموقع العام للمنصة."
        >
          <Field label="Instagram">
            <IconInput
              icon={<Instagram className="h-4 w-4" />}
              dir="ltr"
              placeholder="https://instagram.com/…"
              {...text("instagram_url")}
            />
          </Field>
          <Field label="Facebook">
            <IconInput
              icon={<Facebook className="h-4 w-4" />}
              dir="ltr"
              placeholder="https://facebook.com/…"
              {...text("facebook_url")}
            />
          </Field>
          <Field label="Snapchat">
            <IconInput
              icon={<SnapchatIcon className="h-4 w-4" />}
              dir="ltr"
              placeholder="https://snapchat.com/add/…"
              {...text("snapchat_url")}
            />
          </Field>
          <Field label="TikTok">
            <IconInput
              icon={<TiktokIcon className="h-4 w-4" />}
              dir="ltr"
              placeholder="https://tiktok.com/@…"
              {...text("tiktok_url")}
            />
          </Field>
          <Field label="X">
            <IconInput
              icon={<Twitter className="h-4 w-4" />}
              dir="ltr"
              placeholder="https://x.com/…"
              {...text("twitter_url")}
            />
          </Field>
        </Section>

        <Section title="الصفحة الرئيسية" description="الواجهة، شريط العروض، قصتنا، وترتيب الأقسام.">
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">تُدار الصفحة الرئيسية من صفحة مستقلة.</p>
            <Button asChild variant="outline" className="mt-3 h-10 gap-2">
              <Link to="/admin/home">
                <LayoutTemplate className="h-4 w-4" /> تعديل الصفحة الرئيسية
              </Link>
            </Button>
          </div>
        </Section>

        <Section title="سياسات المتجر" description="الاسترجاع والاستبدال والتوصيل والضمان.">
          <div className="sm:col-span-2">
            <Field label="النص">
              <textarea rows={6} className={cn(inp, "h-auto py-2.5")} {...text("policies")} />
            </Field>
          </div>
        </Section>
      </div>

      <SaveBar visible={dirty} saving={saving} onSave={save} onReset={() => setD(data)} />
    </div>
  );
}

/** Title + description beside (lg) or above the fields, fields on the shared admin surface. */
function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 lg:grid-cols-3 lg:gap-8">
      <div className="lg:pt-5">
        <h2 className="text-base font-medium text-navy">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Surface className="grid gap-4 p-5 text-sm sm:grid-cols-2 sm:p-6 lg:col-span-2">
        {children}
      </Surface>
    </section>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-xs text-muted-foreground">{children}</span>;
}

function IconInput({
  icon,
  className,
  dir,
  ...props
}: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  // dir on the wrapper so the icon's `start` side matches the input's padding side
  return (
    <div className="relative mt-1.5" dir={dir}>
      <span className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-gold">
        {icon}
      </span>
      <input className={cn(inp, "mt-0 ps-10", className)} {...props} />
    </div>
  );
}

/** Keeps only digits (Eastern Arabic digits converted), for VAT / CR numbers. */
function digits(v: string | null | undefined) {
  return (v ?? "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, "");
}
