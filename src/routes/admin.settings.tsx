import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery, type Settings } from "@/lib/data";
import { uploadImage } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Field, inp } from "./admin.categories";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

const fields: [keyof Settings, string, boolean?][] = [
  ["store_name", "اسم المتجر"],
  ["whatsapp_number", "رقم واتساب (دولي بدون + مثل 201001234567)"],
  ["currency", "العملة"],
  ["delivery_fee", "رسوم التوصيل"],
  ["contact_phone", "هاتف التواصل"],
  ["contact_email", "البريد الإلكتروني"],
  ["address", "العنوان"],
  ["instagram_url", "رابط Instagram"],
  ["facebook_url", "رابط Facebook"],
  ["twitter_url", "رابط X"],
  ["hero_title", "عنوان الواجهة"],
  ["hero_subtitle", "النص التعريفي للواجهة", true],
  ["promo_banner", "شريط العروض"],
  ["story_title", "عنوان قصتنا"],
  ["story_body", "نص قصتنا", true],
  ["policies", "سياسات المتجر", true],
];

function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery(settingsQuery);
  const [d, setD] = useState<Partial<Settings>>({});
  useEffect(() => { if (data) setD(data); }, [data]);

  const save = async () => {
    const { id: _id, updated_at: _u, ...rest } = d as Settings;
    const row = { ...rest, whatsapp_number: rest.whatsapp_number?.replace(/\D/g, "") || null, delivery_fee: Number(rest.delivery_fee ?? 0) };
    const { error } = await supabase.from("store_settings").update(row).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("تم حفظ الإعدادات");
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl text-navy">الإعدادات</h1>
      <div className="mt-8 space-y-4 bg-ivory p-6 text-sm">
        {fields.map(([k, label, long]) => (
          <Field key={k} label={label}>
            {long ? (
              <textarea className={`${inp} h-auto py-2`} rows={3} value={String(d[k] ?? "")} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
            ) : (
              <input className={inp} value={String(d[k] ?? "")} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
            )}
          </Field>
        ))}
        <Field label="صورة الواجهة">
          {d.hero_image_url && <img src={d.hero_image_url} alt="" className="mb-2 h-24 object-cover" />}
          <input type="file" accept="image/*" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { const url = await uploadImage(f, "hero"); setD((x) => ({ ...x, hero_image_url: url })); toast.success("تم الرفع"); } catch { toast.error("فشل الرفع"); }
          }} />
        </Field>
        <Button onClick={save} className="w-full">حفظ</Button>
      </div>
    </div>
  );
}
