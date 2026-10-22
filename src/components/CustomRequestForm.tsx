import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, ImagePlus, Loader2, Ruler, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  MAX_REFS,
  buildCustomRequestMessage,
  cm,
  customRequestErrorMessage,
  customRequestSchema,
  formatDimensions,
  uploadReference,
  validateReference,
  type CustomRequestForm as Values,
} from "@/lib/custom-requests";
import { loadCustomer } from "@/lib/customer";
import { buildWhatsappUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { WhatsappIcon } from "./BrandIcons";

const field =
  "mt-1.5 h-12 w-full border border-navy/15 bg-ivory px-3.5 text-navy transition-colors placeholder:text-muted-foreground/60 hover:border-navy/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/30 aria-[invalid=true]:border-destructive";

type Ref = {
  id: string;
  name: string;
  preview: string;
  status: "uploading" | "done" | "error";
  path?: string;
  error?: string;
};

/**
 * The custom-order request («طلب تفصيل»): recorded through submit_custom_request() with a TFS-
 * number, then handed to WhatsApp so the conversation can start right away.
 */
export function CustomRequestForm({
  types,
  initialType,
  whatsapp,
}: {
  /** Furniture types to choose from (category names); «قطعة أخرى» is always offered. */
  types: string[];
  initialType?: string | undefined;
  /** Store WhatsApp number (digits), or null when not set. */
  whatsapp: string | null;
}) {
  const [refs, setRefs] = useState<Ref[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ number: string; url: string | null } | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const failureRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(customRequestSchema),
    defaultValues: { furniture_type: initialType ?? "" },
    shouldFocusError: true,
  });

  // Prefill contact details saved on this device by an earlier order
  useEffect(() => {
    const c = loadCustomer();
    if (c.name) setValue("name", c.name);
    if (c.phone) setValue("phone", c.phone);
    if (c.city) setValue("city", c.city);
  }, [setValue]);

  // A category tile on the page picks the type here
  useEffect(() => {
    if (initialType) setValue("furniture_type", initialType, { shouldValidate: false });
  }, [initialType, setValue]);

  // Object URLs for previews are released when the form goes away
  const refsRef = useRef(refs);
  refsRef.current = refs;
  useEffect(() => () => refsRef.current.forEach((r) => URL.revokeObjectURL(r.preview)), []);

  const [width, depth, height] = useWatch({ control, name: ["width", "depth", "height"] });

  const addFiles = async (list: FileList | null) => {
    const files = Array.from(list ?? []).slice(0, MAX_REFS - refs.length);
    if (fileInput.current) fileInput.current.value = "";
    for (const file of files) {
      const id = crypto.randomUUID();
      const problem = validateReference(file);
      const item: Ref = {
        id,
        name: file.name,
        preview: URL.createObjectURL(file),
        status: problem ? "error" : "uploading",
        ...(problem ? { error: problem } : {}),
      };
      setRefs((r) => [...r, item]);
      if (problem) continue;
      try {
        const path = await uploadReference(file);
        setRefs((r) => r.map((x) => (x.id === id ? { ...x, status: "done", path } : x)));
      } catch {
        setRefs((r) =>
          r.map((x) => (x.id === id ? { ...x, status: "error", error: "تعذر رفع الصورة" } : x)),
        );
      }
    }
  };

  const removeRef = (id: string) =>
    setRefs((r) => {
      const gone = r.find((x) => x.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return r.filter((x) => x.id !== id);
    });

  const uploading = refs.some((r) => r.status === "uploading");

  const submit = async (f: Values) => {
    if (busy || uploading || honeypot.current?.value) return;
    setFailure(null);
    setBusy(true);
    const images = refs.flatMap((r) => (r.status === "done" && r.path ? [r.path] : []));
    const { data: number, error } = await supabase.rpc("submit_custom_request", {
      _request: {
        name: f.name,
        phone: f.phone,
        email: f.email ?? "",
        city: f.city,
        furniture_type: f.furniture_type,
        description: f.description,
        dimensions: formatDimensions(f),
        budget: f.budget ?? "",
        materials: f.materials ?? "",
        images,
      },
    });
    setBusy(false);
    if (error || !number) {
      setFailure(customRequestErrorMessage(error?.message));
      requestAnimationFrame(() => failureRef.current?.focus());
      return;
    }
    const url = whatsapp
      ? buildWhatsappUrl(whatsapp, buildCustomRequestMessage(number, f, images.length))
      : null;
    setPlaced({ number, url });
    requestAnimationFrame(() => {
      successRef.current?.focus();
      successRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const startOver = () => {
    refs.forEach((r) => URL.revokeObjectURL(r.preview));
    setRefs([]);
    setPlaced(null);
    reset({ furniture_type: "", ...pick(loadCustomer()) });
    requestAnimationFrame(() => setFocus("furniture_type"));
  };

  if (placed)
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="border hairline bg-ivory px-6 py-12 text-center focus:outline-none sm:px-10"
      >
        <CheckCircle2 className="mx-auto h-12 w-12 text-gold" aria-hidden />
        <h3 className="mt-5 font-display text-3xl text-navy md:text-4xl">وصلنا طلبك</h3>
        <p className="mt-3 text-muted-foreground">رقم طلب التفصيل</p>
        <p className="mt-1 font-display text-4xl tracking-wider text-navy" dir="ltr">
          {placed.number}
        </p>
        <p className="mx-auto mt-5 max-w-md leading-relaxed text-navy">
          سيراجع فريقنا التفاصيل ويتواصل معك على رقم هاتفك. احتفظ برقم الطلب لتسهيل المتابعة.
        </p>
        {placed.url && (
          <>
            <p className="mx-auto mt-6 max-w-md text-sm text-muted-foreground">
              لتسريع المراجعة، أرسل ملخص الطلب عبر واتساب، ويمكنك إرفاق صور إضافية في المحادثة.
            </p>
            <Button asChild className="mt-4 h-12 w-full gap-2 text-base sm:w-auto sm:px-8">
              <a href={placed.url} target="_blank" rel="noopener noreferrer">
                <WhatsappIcon className="h-5 w-5" /> أرسل الملخص عبر واتساب
              </a>
            </Button>
          </>
        )}
        <button
          type="button"
          onClick={startOver}
          className="mt-5 block w-full text-sm text-navy underline decoration-gold underline-offset-[6px] hover:decoration-navy"
        >
          إرسال طلب آخر
        </button>
      </div>
    );

  return (
    <form onSubmit={handleSubmit(submit)} noValidate aria-describedby="request-required-note">
      <p id="request-required-note" className="mb-8 text-sm text-muted-foreground">
        الحقول المعلّمة بـ <span className="text-destructive">*</span> مطلوبة، والباقي يساعدنا على
        فهم فكرتك بدقة.
      </p>

      <Group legend="القطعة">
        <Input label="نوع القطعة" required error={errors.furniture_type?.message}>
          {(a) => (
            <select {...register("furniture_type")} {...a} className={cn(field, "pe-9")}>
              {/* Not disabled, or the browser would preselect the first category */}
              <option value="">اختر نوع القطعة</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="قطعة أخرى">قطعة أخرى</option>
            </select>
          )}
        </Input>
        <Input
          label="صف فكرتك"
          required
          error={errors.description?.message}
          hint="الاستخدام، الطراز، عدد المقاعد أو الأدراج، وأي تفاصيل تهمك."
        >
          {(a) => (
            <textarea
              {...register("description")}
              {...a}
              rows={5}
              className={cn(field, "h-auto py-3 leading-relaxed")}
            />
          )}
        </Input>
      </Group>

      <Group legend="المقاسات والخامات">
        <div>
          <p className="text-sm text-navy">المقاسات</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            بالسنتيمتر، اختيارية. إن لم تكن متأكداً اتركها، وسنتفق عليها معك.
          </p>
          {/* The three fields share one row at every width; the sketch follows as a strip */}
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["width", "العرض"],
                  ["depth", "العمق"],
                  ["height", "الارتفاع"],
                ] as const
              ).map(([k, label]) => (
                <Input key={k} label={label} error={errors[k]?.message} compact>
                  {(a) => (
                    <div className="relative mt-1.5">
                      <input
                        {...register(k)}
                        {...a}
                        inputMode="decimal"
                        dir="ltr"
                        autoComplete="off"
                        className={cn(field, "mt-0 ps-9 pe-3 text-right tabular-nums")}
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-muted-foreground"
                      >
                        سم
                      </span>
                    </div>
                  )}
                </Input>
              ))}
            </div>
            <Elevation width={cm(width)} depth={cm(depth)} height={cm(height)} />
          </div>
        </div>
        <Input
          label="الخامات والأقمشة والألوان المفضلة"
          error={errors.materials?.message}
          hint="مثال: خشب بلوطي، قماش مخمل كحلي، تشطيب مطفي."
        >
          {(a) => <input {...register("materials")} {...a} className={field} />}
        </Input>
        <Input
          label="الميزانية التقريبية"
          error={errors.budget?.message}
          hint="اختيارية، تساعدنا على اقتراح الخامات المناسبة."
        >
          {(a) => <input {...register("budget")} {...a} className={field} />}
        </Input>
        <References
          refs={refs}
          inputRef={fileInput}
          onAdd={addFiles}
          onRemove={removeRef}
          full={refs.length >= MAX_REFS}
        />
      </Group>

      <Group legend="بيانات التواصل والتوصيل">
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="الاسم بالكامل" required error={errors.name?.message}>
            {(a) => <input {...register("name")} {...a} autoComplete="name" className={field} />}
          </Input>
          <Input label="رقم الجوال" required error={errors.phone?.message}>
            {(a) => (
              <input
                {...register("phone")}
                {...a}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className={cn(field, "text-right")}
              />
            )}
          </Input>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="البريد الإلكتروني" error={errors.email?.message}>
            {(a) => (
              <input
                {...register("email")}
                {...a}
                type="email"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                className={cn(field, "text-right")}
              />
            )}
          </Input>
          <Input label="مدينة / حي التوصيل" required error={errors.city?.message}>
            {(a) => (
              <input {...register("city")} {...a} autoComplete="address-level2" className={field} />
            )}
          </Input>
        </div>
        {/* Honeypot: hidden from people and assistive tech */}
        <input
          ref={honeypot}
          type="text"
          name="company"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="hidden"
        />
      </Group>

      {failure && (
        <div
          ref={failureRef}
          tabIndex={-1}
          role="alert"
          className="mb-5 flex items-start gap-3 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive focus:outline-none"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{failure}</p>
        </div>
      )}

      <Button
        type="submit"
        variant="gold"
        disabled={busy || uploading}
        className="h-14 w-full gap-2 text-base hover:bg-navy hover:text-cream sm:w-auto sm:px-12"
      >
        {(busy || uploading) && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />}
        {busy ? "جارٍ إرسال الطلب..." : uploading ? "جارٍ رفع الصور..." : "أرسل طلب التفصيل"}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">
        إرسال الطلب لا يُلزمك بشيء؛ يتواصل معك فريقنا أولاً لمراجعة التفاصيل والسعر.
      </p>
    </form>
  );
}

const pick = ({ name, phone, city }: { name?: string; phone?: string; city?: string }) => ({
  ...(name ? { name } : {}),
  ...(phone ? { phone } : {}),
  ...(city ? { city } : {}),
});

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    // The rule sits on the legend, not the fieldset, so the legend never cuts a notch into it
    <fieldset className="mb-10 min-w-0">
      <legend className="w-full border-t border-navy/15 pt-6 font-display text-2xl text-navy">
        {legend}
      </legend>
      <div className="mt-5 space-y-6">{children}</div>
    </fieldset>
  );
}

type A11y = {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby"?: string;
  "aria-required"?: boolean;
};

/** Label + control + hint/error, with the ids wired for screen readers. */
function Input({
  label,
  required,
  error,
  hint,
  compact,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string;
  compact?: boolean;
  children: (a: A11y) => ReactNode;
}) {
  const id = useId();
  const described = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ");
  return (
    <div>
      <label htmlFor={id} className={cn("text-sm text-navy", compact && "text-muted-foreground")}>
        {label}
        {required && (
          <span className="text-destructive" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children({
        id,
        "aria-invalid": !!error,
        ...(described ? { "aria-describedby": described } : {}),
        ...(required ? { "aria-required": true } : {}),
      })}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="mt-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function References({
  refs,
  inputRef,
  onAdd,
  onRemove,
  full,
}: {
  refs: Ref[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  onAdd: (files: FileList | null) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  const [over, setOver] = useState(false);
  const id = useId();
  return (
    <div>
      <p id={`${id}-label`} className="text-sm text-navy">
        صور مرجعية
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        صورة لقطعة أعجبتك، أو لمساحتك، أو رسم يدوي. حتى {MAX_REFS} صور، 8 ميجابايت للصورة.
      </p>
      <ul className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5" aria-labelledby={`${id}-label`}>
        {refs.map((r) => (
          <li key={r.id} className="relative aspect-square overflow-hidden bg-muted">
            <img
              src={r.preview}
              alt={`صورة مرجعية: ${r.name}`}
              className={cn("h-full w-full object-cover", r.status !== "done" && "opacity-50")}
            />
            {r.status === "uploading" && (
              <span className="absolute inset-0 flex items-center justify-center bg-ink/30">
                <Loader2 className="h-5 w-5 animate-spin text-cream" aria-hidden />
                <span className="sr-only">جارٍ رفع {r.name}</span>
              </span>
            )}
            {r.status === "error" && (
              <span className="absolute inset-x-0 bottom-0 bg-destructive px-1.5 py-1 text-[0.65rem] leading-tight text-cream">
                {r.error}
              </span>
            )}
            <button
              type="button"
              onClick={() => onRemove(r.id)}
              aria-label={`حذف ${r.name}`}
              className="absolute top-1 end-1 flex h-8 w-8 items-center justify-center bg-ink/70 text-cream transition-colors hover:bg-gold hover:text-ink focus-visible:outline-2 focus-visible:outline-gold"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
        {!full && (
          <li className={cn(refs.length === 0 && "col-span-3 sm:col-span-5")}>
            <label
              htmlFor={id}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                onAdd(e.dataTransfer.files);
              }}
              className={cn(
                "flex h-full cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-navy/25 bg-ivory px-3 text-center text-sm text-navy transition-colors hover:border-gold has-[:focus-visible]:border-gold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold/30",
                refs.length === 0 ? "py-8" : "aspect-square",
                over && "border-gold bg-gold/10",
              )}
            >
              <ImagePlus className="h-5 w-5 text-gold" aria-hidden />
              {refs.length === 0 ? "اضغط لاختيار الصور أو اسحبها هنا" : "إضافة"}
              <input
                ref={inputRef}
                id={id}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                className="sr-only"
                onChange={(e) => onAdd(e.target.files)}
              />
            </label>
          </li>
        )}
      </ul>
    </div>
  );
}

const fmt = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 });

/**
 * Live elevation sketch: the front face at true proportion, depth drawn as an oblique receding
 * face, with dimension lines. Only width and height are needed to draw.
 */
export function Elevation({
  width,
  depth,
  height,
}: {
  width: number | null;
  depth: number | null;
  height: number | null;
}) {
  const ready = width != null && height != null;
  const W = 200,
    H = 170,
    pad = 30;
  let shape: ReactNode = null;
  if (ready) {
    const d = depth ?? 0;
    // Oblique projection: depth recedes up and to the right at half scale
    const dx = d * 0.5 * Math.cos(Math.PI / 6);
    const dy = d * 0.5 * Math.sin(Math.PI / 6);
    const s = Math.min((W - pad * 2) / (width + dx), (H - pad * 2) / (height + dy));
    const w = width * s,
      h = height * s,
      ox = dx * s,
      oy = dy * s;
    const x0 = pad + (W - pad * 2 - (w + ox)) / 2;
    const y1 = H - pad - (H - pad * 2 - (h + oy)) / 2; // bottom of the front face
    const y0 = y1 - h;
    shape = (
      <g>
        {d > 0 && (
          <path
            d={`M${x0},${y0} l${ox},${-oy} h${w} v${h} l${-ox},${oy} M${x0 + w},${y0} l${ox},${-oy}`}
            className="fill-gold/10 stroke-navy/50"
            strokeWidth={1}
            strokeLinejoin="round"
          />
        )}
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h}
          className="fill-gold/20 stroke-navy"
          strokeWidth={1.25}
        />
        {/* width, below */}
        <Dim
          x1={x0}
          y1={y1 + 12}
          x2={x0 + w}
          y2={y1 + 12}
          label={`${fmt.format(width)} سم`}
          below
        />
        {/* height, on the left */}
        <Dim
          x1={x0 - 12}
          y1={y0}
          x2={x0 - 12}
          y2={y1}
          label={`${fmt.format(height)} سم`}
          vertical
        />
        {d > 0 && (
          <text
            x={x0 + w + ox / 2 + 4}
            y={y0 - oy / 2 - 4}
            className="fill-navy text-[9px]"
            textAnchor="start"
          >
            {fmt.format(d)} سم
          </text>
        )}
      </g>
    );
  }
  // Until there is something to draw, the sketch is a one-line hint rather than an empty box
  if (!ready)
    return (
      <p className="flex items-center gap-3 border border-dashed border-navy/20 px-4 py-3 text-xs text-muted-foreground">
        <Ruler className="h-4 w-4 shrink-0 text-gold" aria-hidden />
        أدخل العرض والارتفاع لترى رسماً تقريبياً للقطعة بنسبها الحقيقية.
      </p>
    );
  return (
    <figure className="border border-navy/10 bg-ivory px-4 py-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mx-auto h-44 w-auto max-w-full"
        role="img"
        aria-label={`رسم تقريبي للقطعة: عرض ${fmt.format(width)} وارتفاع ${fmt.format(height)}${depth ? ` وعمق ${fmt.format(depth)}` : ""} سم`}
      >
        {shape}
      </svg>
      <figcaption className="text-center text-xs text-muted-foreground">
        رسم تقريبي بالنسب الحقيقية
      </figcaption>
    </figure>
  );
}

function Dim({
  x1,
  y1,
  x2,
  y2,
  label,
  vertical,
  below,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
  vertical?: boolean;
  below?: boolean;
}) {
  const t = 3; // tick half-length
  return (
    <g className="stroke-gold" strokeWidth={1}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (
        <>
          <line x1={x1 - t} y1={y1} x2={x1 + t} y2={y1} />
          <line x1={x2 - t} y1={y2} x2={x2 + t} y2={y2} />
          <text
            x={x1 - 5}
            y={(y1 + y2) / 2}
            transform={`rotate(-90 ${x1 - 5} ${(y1 + y2) / 2})`}
            textAnchor="middle"
            className="fill-navy stroke-none text-[9px]"
          >
            {label}
          </text>
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - t} x2={x1} y2={y1 + t} />
          <line x1={x2} y1={y2 - t} x2={x2} y2={y2 + t} />
          <text
            x={(x1 + x2) / 2}
            y={below ? y1 + 12 : y1 - 5}
            textAnchor="middle"
            className="fill-navy stroke-none text-[9px]"
          >
            {label}
          </text>
        </>
      )}
    </g>
  );
}
