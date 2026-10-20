import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { settingsQuery } from "@/lib/data";
import { clip, DESCRIPTION_MAX, fullTitle, parseSeo, storeName, TITLE_MAX } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { inp } from "./kit";

/**
 * Optional SEO title/description with live counters and a Google result preview. Blank fields
 * fall back to `fallbackTitle` / `fallbackDescription` (shown as placeholders), which is what the
 * storefront uses too.
 */
export function SeoFields({
  title,
  description,
  onTitle,
  onDescription,
  fallbackTitle,
  fallbackDescription,
  path,
  rawTitle = false,
}: {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  fallbackTitle: string;
  fallbackDescription: string;
  /** Page path for the preview, e.g. /product/slug. */
  path: string;
  /** The home page title is used as typed, without the store-name template. */
  rawTitle?: boolean;
}) {
  const { data: s } = useQuery(settingsQuery);
  const seo = parseSeo(s?.seo);
  const store = storeName(s);
  const id = useId();
  const shownTitle = title.trim() || fallbackTitle;
  const previewTitle = rawTitle ? shownTitle : fullTitle(seo, store, shownTitle);
  const previewDesc = clip(description.trim() || fallbackDescription);
  const host = (
    seo.siteUrl || (typeof window !== "undefined" ? window.location.origin : "")
  ).replace(/^https?:\/\//, "");

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-t`} className="text-sm text-muted-foreground">
            عنوان الظهور في جوجل
          </label>
          <Counter value={title.trim() ? previewTitle.length : 0} max={TITLE_MAX} />
        </div>
        <input
          id={`${id}-t`}
          className={inp}
          value={title}
          placeholder={fallbackTitle || "يُستخدم الاسم تلقائياً"}
          onChange={(e) => onTitle(e.target.value)}
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={`${id}-d`} className="text-sm text-muted-foreground">
            وصف الظهور في جوجل
          </label>
          <Counter value={description.trim().length} max={DESCRIPTION_MAX} />
        </div>
        <textarea
          id={`${id}-d`}
          rows={3}
          className={cn(inp, "h-auto py-2.5 leading-relaxed")}
          value={description}
          placeholder={clip(fallbackDescription) || "يُستخدم الوصف تلقائياً"}
          onChange={(e) => onDescription(e.target.value)}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          اتركهما فارغين لاستخدام الاسم والوصف تلقائياً.
        </p>
      </div>

      {/* Approximation of a Google result, so length and wording can be judged at a glance */}
      <div
        className="rounded-lg border border-navy/10 bg-white p-4"
        aria-label="معاينة نتيجة البحث"
      >
        <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] text-muted-foreground">
          <Search className="h-3 w-3" /> معاينة في نتائج جوجل
        </p>
        <p className="truncate text-xs text-[#4d5156]" dir="ltr">
          {host || "your-site.com"}
          {decodeURI(path) === "/"
            ? ""
            : ` › ${decodeURI(path).replace(/^\//, "").replace(/\//g, " › ")}`}
        </p>
        <p className="mt-1 line-clamp-1 text-lg leading-snug text-[#1a0dab]">{previewTitle}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[#4d5156]">
          {previewDesc || "أضف وصفاً للمنتج ليظهر هنا."}
        </p>
      </div>
    </div>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  if (!value) return null;
  const over = value > max;
  return (
    <span className={cn("text-xs tabular-nums", over ? "text-[#b45309]" : "text-muted-foreground")}>
      {value} / {max}
      {over && " — أطول من المناسب"}
    </span>
  );
}
