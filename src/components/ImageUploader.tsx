import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/upload";
import { cn } from "@/lib/utils";

/** Multi-image manager: drag & drop / click to upload, reorder, set main, remove. First image is the main one. */
export function ImageUploader({
  images,
  onChange,
  folder,
}: {
  images: string[];
  onChange: (update: (prev: string[]) => string[]) => void;
  folder: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);
  const [over, setOver] = useState(false);

  const upload = async (list: FileList | null) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setPending(files.length);
    for (const [n, f] of files.entries()) {
      toast.loading(`جارٍ رفع ${n + 1}/${files.length}`, { id: "up" });
      try {
        const url = await uploadImage(f, folder);
        onChange((prev) => [...prev, url]);
        setPending((p) => p - 1);
      } catch {
        toast.error("فشل رفع صورة", { id: "up" });
        setPending(0);
        return;
      }
    }
    toast.success("تم الرفع", { id: "up" });
  };

  const move = (i: number, j: number) =>
    onChange((prev) => {
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const [it] = next.splice(i, 1);
      next.splice(j, 0, it!);
      return next;
    });
  const remove = (src: string) => onChange((prev) => prev.filter((x) => x !== src));
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-full bg-ivory/90 text-navy hover:bg-gold disabled:opacity-30";

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground">الصور</span>
        <span className="text-xs text-muted-foreground">
          الصورة الأولى هي الرئيسية · {images.length} صورة
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {images.map((src, i) => (
          <div key={src} className="group relative aspect-[4/5] overflow-hidden border bg-cream">
            <img src={src} alt="" className="h-full w-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 start-1.5 bg-gold px-2 py-0.5 text-[0.65rem] text-ink">
                رئيسية
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-ink/80 to-transparent p-2 pt-6 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
              <button
                type="button"
                className={btn}
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                aria-label="تقديم"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              {i !== 0 && (
                <button
                  type="button"
                  className={btn}
                  onClick={() => move(i, 0)}
                  aria-label="تعيين كرئيسية"
                  title="تعيين كرئيسية"
                >
                  <Star className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                className={cn(btn, "hover:bg-destructive hover:text-cream")}
                onClick={() => remove(src)}
                aria-label="حذف"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={btn}
                disabled={i === images.length - 1}
                onClick={() => move(i, i + 1)}
                aria-label="تأخير"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <div
            key={`p${i}`}
            className="flex aspect-[4/5] items-center justify-center border bg-cream"
          >
            <Loader2 className="h-5 w-5 animate-spin text-gold" />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          upload(e.dataTransfer.files);
        }}
        disabled={pending > 0}
        className={cn(
          "mt-3 flex w-full flex-col items-center justify-center gap-2 border border-dashed border-gold/50 bg-cream/60 px-4 py-6 text-center transition-colors hover:border-gold hover:bg-cream disabled:cursor-wait disabled:opacity-60",
          over && "border-gold bg-gold/10",
        )}
      >
        <ImagePlus className="h-6 w-6 text-gold" />
        <span className="text-navy">اسحب الصور هنا أو اضغط للاختيار</span>
        <span className="text-xs text-muted-foreground">
          يمكن اختيار أكثر من صورة · JPG، PNG، WEBP
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
