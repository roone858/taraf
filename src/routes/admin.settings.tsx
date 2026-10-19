import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Facebook, Instagram, Loader2, RotateCcw, Twitter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Settings } from "@/lib/data";
import { CURRENCIES } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SnapchatIcon, WhatsappIcon } from "@/components/BrandIcons";
import { SingleImageUpload } from "@/components/SingleImageUpload";
import { Field, inp } from "./admin.categories";

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
  "twitter_url",
  "promo_banner",
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
    setSaving(true);
    const { id: _id, updated_at: _u, ...rest } = d as Settings;
    const row = {
      ...rest,
      store_name: rest.store_name.trim(),
      whatsapp_number: rest.whatsapp_number?.replace(/\D/g, "") || null,
      delivery_fee: fee,
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
      <div className="max-w-5xl space-y-6">
        <div className="h-10 w-48 animate-pulse bg-ivory" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-48 animate-pulse bg-ivory" />
        ))}
      </div>
    );
  }

  const currencyShort = CURRENCIES[d.currency ?? "EGP"]?.[0] ?? d.currency;

  return (
    <div className="max-w-5xl pb-28">
      <h1 className="font-display text-4xl text-navy">الإعدادات</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        بيانات المتجر ومحتوى الصفحة الرئيسية وروابط التواصل.
      </p>

      <div className="mt-10 space-y-10">
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
              {Object.entries(CURRENCIES).map(([code, [short, name]]) => (
                <option key={code} value={code}>
                  {name} ({short})
                </option>
              ))}
            </select>
          </Field>
          <Field label="رسوم التوصيل">
            <div className="relative" dir="ltr">
              <input
                type="number"
                min={0}
                inputMode="decimal"
                className={cn(inp, "pe-14 text-end")}
                value={d.delivery_fee ?? ""}
                onChange={(e) =>
                  set({ delivery_fee: e.target.value === "" ? 0 : Number(e.target.value) })
                }
              />
              <span className="pointer-events-none absolute top-1/2 end-3 mt-0.5 -translate-y-1/2 text-xs text-muted-foreground">
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
          <Field label="X">
            <IconInput
              icon={<Twitter className="h-4 w-4" />}
              dir="ltr"
              placeholder="https://x.com/…"
              {...text("twitter_url")}
            />
          </Field>
        </Section>

        <Section title="الصفحة الرئيسية" description="محتوى الواجهة الأولى التي يراها الزائر.">
          <div className="sm:col-span-2">
            <SingleImageUpload
              label="صورة الواجهة"
              folder="hero"
              url={d.hero_image_url ?? null}
              onChange={(hero_image_url) => set({ hero_image_url })}
              emptyTitle="اختر صورة للواجهة"
              emptyHint="يُفضّل صورة أفقية بعرض ١٩٢٠ بكسل على الأقل · بدونها تُستخدم الصورة الافتراضية"
            />
          </div>
          <div className="sm:col-span-2">
            <Field label="عنوان الواجهة">
              <input className={inp} {...text("hero_title")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="النص التعريفي">
              <textarea rows={2} className={cn(inp, "h-auto py-2")} {...text("hero_subtitle")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="شريط العروض">
              <input
                className={inp}
                placeholder="مثال: خصم ١٠٪ على غرف النوم هذا الشهر"
                {...text("promo_banner")}
              />
            </Field>
            <Hint>يظهر كشريط ذهبي أسفل الواجهة. اتركه فارغاً لإخفائه.</Hint>
          </div>
        </Section>

        <Section title="قصتنا" description="القسم التعريفي بالعلامة في الصفحة الرئيسية.">
          <div className="sm:col-span-2">
            <Field label="العنوان">
              <input className={inp} {...text("story_title")} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="النص">
              <textarea rows={4} className={cn(inp, "h-auto py-2")} {...text("story_body")} />
            </Field>
          </div>
        </Section>

        <Section title="سياسات المتجر" description="الاسترجاع والاستبدال والتوصيل والضمان.">
          <div className="sm:col-span-2">
            <Field label="النص">
              <textarea rows={6} className={cn(inp, "h-auto py-2")} {...text("policies")} />
            </Field>
          </div>
        </Section>
      </div>

      {/* Save bar — appears when there are unsaved changes */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-20 border-t hairline bg-navy/95 backdrop-blur transition-transform duration-300 md:start-60",
          dirty || saving ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:px-10">
          <span className="text-sm text-cream/80">لديك تغييرات غير محفوظة</span>
          <div className="flex gap-2">
            <Button
              variant="ghostGold"
              onClick={() => setD(data)}
              disabled={saving}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" /> تراجع
            </Button>
            <Button variant="gold" onClick={save} disabled={saving} className="min-w-28 gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
      <div>
        <h2 className="font-sans text-lg text-navy">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-4 bg-ivory p-5 text-sm sm:grid-cols-2 sm:p-6 lg:col-span-2">
        {children}
      </div>
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
    <div className="relative" dir={dir}>
      <span className="pointer-events-none absolute top-1/2 start-3 mt-0.5 -translate-y-1/2 text-gold">
        {icon}
      </span>
      <input className={cn(inp, "ps-10", className)} {...props} />
    </div>
  );
}
