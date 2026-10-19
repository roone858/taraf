import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, Quote } from "lucide-react";
import type { Testimonial } from "@/lib/data";
import { cn } from "@/lib/utils";
import { Stars } from "./StarRating";

const AUTOPLAY_MS = 6000;
/** Reviews longer than this get a "read more" toggle so cards keep an even height. */
const CLAMP_AT = 220;
const num = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 1 });

/** Home-page testimonials: RTL carousel with arrows, dots, swipe, keyboard and paused-on-interaction autoplay. */
export function TestimonialsSlider({ items }: { items: Testimonial[] }) {
  const [viewportRef, api] = useEmblaCarousel({
    direction: "rtl",
    align: "start",
    loop: items.length > 3,
    containScroll: "trimSnaps",
  });
  const [snaps, setSnaps] = useState<number[]>([]);
  const [selected, setSelected] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const avg = items.reduce((s, t) => s + t.rating, 0) / items.length;
  const paused = hovered || interacted;

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setSelected(api.selectedScrollSnap());
      setCanPrev(api.canScrollPrev());
      setCanNext(api.canScrollNext());
    };
    const onInit = () => {
      setSnaps(api.scrollSnapList());
      onSelect();
    };
    // Any manual drag stops autoplay for the rest of the visit
    const onPointerDown = () => setInteracted(true);
    onInit();
    api.on("select", onSelect).on("reInit", onInit).on("pointerDown", onPointerDown);
    return () => {
      api.off("select", onSelect).off("reInit", onInit).off("pointerDown", onPointerDown);
    };
  }, [api]);

  useEffect(() => {
    if (!api || paused || snaps.length <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [api, paused, snaps.length]);

  const go = useCallback(
    (dir: "prev" | "next") => {
      setInteracted(true);
      if (dir === "prev") api?.scrollPrev();
      else api?.scrollNext();
    },
    [api],
  );

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const showNav = canPrev || canNext;

  return (
    <section className="overflow-hidden bg-ivory py-24 md:py-28" aria-labelledby="testimonials-title">
      <div className="mx-auto max-w-7xl px-5 lg:px-10">
        {/* Header */}
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="eyebrow">آراء عملائنا</p>
            <h2 id="testimonials-title" className="mt-3 font-display text-4xl text-navy md:text-5xl">
              ثقة تُبنى بالتفاصيل
            </h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 border-s-2 border-gold ps-4">
              <span className="font-display text-4xl leading-none text-navy">{num.format(avg)}</span>
              <div>
                <Stars value={avg} />
                <p className="mt-1 text-xs text-muted-foreground">
                  متوسط {items.length} {items.length === 1 ? "تقييم" : "تقييمات"}
                </p>
              </div>
            </div>
            {showNav && (
              <div className="hidden gap-2 md:flex">
                <NavButton label="السابق" disabled={!canPrev} onClick={() => go("prev")}>
                  <ChevronRight className="h-5 w-5" />
                </NavButton>
                <NavButton label="التالي" disabled={!canNext} onClick={() => go("next")}>
                  <ChevronLeft className="h-5 w-5" />
                </NavButton>
              </div>
            )}
          </div>
        </div>

        {/* Slider */}
        <div
          role="region"
          aria-roledescription="carousel"
          aria-label="آراء العملاء"
          tabIndex={0}
          className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          onKeyDown={(e) => {
            // RTL: the left arrow moves forward
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              go("next");
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              go("prev");
            }
          }}
        >
          <div ref={viewportRef} className="cursor-grab overflow-hidden active:cursor-grabbing">
            <div className="-ms-5 flex touch-pan-y" aria-live={paused ? "polite" : "off"}>
              {items.map((t, i) => {
                const long = t.body.length > CLAMP_AT;
                const open = expanded.has(t.id);
                return (
                  <div
                    key={t.id}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${i + 1} من ${items.length}`}
                    className="min-w-0 shrink-0 grow-0 basis-[88%] ps-5 sm:basis-1/2 lg:basis-1/3"
                  >
                    <figure className="group relative flex h-full flex-col bg-cream p-7 transition-shadow duration-300 hover:shadow-[0_18px_40px_-24px_oklch(0.19_0.03_260/0.45)] md:p-8">
                      <Quote
                        className="absolute top-6 end-6 h-10 w-10 text-gold/20 transition-colors group-hover:text-gold/35"
                        aria-hidden
                      />
                      <Stars value={t.rating} />
                      <blockquote className="mt-5 flex-1 text-[0.95rem] leading-loose text-navy/85">
                        <p className={cn(long && !open && "line-clamp-5")}>{t.body}</p>
                        {long && (
                          <button
                            type="button"
                            onClick={() => toggle(t.id)}
                            className="mt-2 text-xs text-gold underline-offset-4 hover:underline"
                            aria-expanded={open}
                          >
                            {open ? "عرض أقل" : "اقرأ المزيد"}
                          </button>
                        )}
                      </blockquote>
                      <figcaption className="mt-6 flex items-center gap-3 border-t hairline pt-5">
                        <span
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold/50 bg-ivory font-display text-lg text-gold"
                          aria-hidden
                        >
                          {t.customer_name.trim().charAt(0)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-navy">{t.customer_name}</span>
                          {t.city && <span className="block truncate text-xs text-muted-foreground">{t.city}</span>}
                        </span>
                      </figcaption>
                    </figure>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dots + mobile arrows */}
        {snaps.length > 1 && (
          <div className="mt-10 flex items-center justify-center gap-5">
            <div className="md:hidden">
              <NavButton label="السابق" disabled={!canPrev} onClick={() => go("prev")}>
                <ChevronRight className="h-5 w-5" />
              </NavButton>
            </div>
            <div className="flex items-center gap-2">
              {snaps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInteracted(true);
                    api?.scrollTo(i);
                  }}
                  aria-label={`الانتقال إلى المجموعة ${i + 1}`}
                  aria-current={i === selected}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === selected ? "w-8 bg-gold" : "w-1.5 bg-navy/20 hover:bg-navy/40",
                  )}
                />
              ))}
            </div>
            <div className="md:hidden">
              <NavButton label="التالي" disabled={!canNext} onClick={() => go("next")}>
                <ChevronLeft className="h-5 w-5" />
              </NavButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-gold/50 text-navy transition-colors hover:border-gold hover:bg-gold hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}
