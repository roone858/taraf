import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** Single image field: preview with change/remove, or an empty drop target. */
export function SingleImageUpload({
  url,
  onChange,
  folder,
  label,
  emptyTitle = "اختر صورة",
  emptyHint,
  className = "aspect-[21/9]",
}: {
  url: string | null;
  onChange: (url: string | null) => void;
  folder: string;
  label: string;
  emptyTitle?: string;
  emptyHint?: string;
  /** Sizing of the preview box (aspect ratio). */
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const pick = async (f: File | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    setBusy(true);
    try {
      onChange(await uploadImage(f, folder));
      toast.success("تم رفع الصورة");
    } catch {
      toast.error("فشل رفع الصورة");
    }
    setBusy(false);
  };

  return (
    <div>
      <span className="text-muted-foreground">{label}</span>
      <div
        className={cn("relative mt-1 overflow-hidden border bg-cream", className)}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        {url ? (
          <>
            <img src={url} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-ink/80 to-transparent p-3 pt-10">
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                className="flex items-center gap-2 bg-ivory/95 px-3 py-1.5 text-xs text-navy hover:bg-gold"
              >
                <ImagePlus className="h-3.5 w-3.5" /> تغيير
              </button>
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={busy}
                className="flex items-center gap-2 bg-ivory/95 px-3 py-1.5 text-xs text-destructive hover:bg-destructive hover:text-cream"
              >
                <Trash2 className="h-3.5 w-3.5" /> إزالة
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className={cn(
              "flex h-full w-full flex-col items-center justify-center gap-2 border border-dashed border-gold/50 p-4 text-center transition-colors hover:border-gold hover:bg-gold/5",
              over && "border-gold bg-gold/10",
            )}
          >
            <ImagePlus className="h-6 w-6 text-gold" />
            <span className="text-navy">{emptyTitle}</span>
            {emptyHint && <span className="text-xs text-muted-foreground">{emptyHint}</span>}
          </button>
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/70">
            <Loader2 className="h-6 w-6 animate-spin text-gold" />
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
