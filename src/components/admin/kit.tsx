/**
 * Shared admin UI vocabulary. Every admin page builds from these so headers, surfaces, filters,
 * badges, buttons, empty/loading states and save bars look and behave the same everywhere.
 *
 * Tokens (from src/styles.css): navy/ink text, gold accent for "on"/active state only,
 * ivory surfaces on a cream page, radius `rounded-xl` for surfaces / `rounded-lg` for controls.
 */
import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const adminNum = new Intl.NumberFormat("ar-EG");

/** Base class for admin text inputs, selects and textareas. */
export const inp =
  "mt-1.5 h-10 w-full rounded-lg border border-navy/15 bg-cream px-3 text-navy transition-colors placeholder:text-muted-foreground/70 hover:border-navy/25 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/25";

/** Labelled form field. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* ---------- Page structure ---------- */

export function PageHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-tight text-navy">{title}</h1>
        {meta && <p className="mt-2 text-sm text-muted-foreground">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Main content container on a page. */
export function Surface({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section";
}) {
  return (
    <Tag
      className={cn(
        "overflow-hidden rounded-xl border border-navy/10 bg-ivory shadow-[0_1px_2px_oklch(0.19_0.03_260/0.06)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

/** Titled surface with an optional action on the opposite side (dashboards, side panels). */
export function Panel({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Surface as="section" className={cn("p-5", className)}>
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-navy/10 pb-3">
        <h2 className="flex items-center gap-2.5 text-base font-medium text-navy">
          {Icon && <Icon className="h-4 w-4 text-gold" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Surface>
  );
}

/** Settings-style block: title + description, fields below. */
export function FormCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface as="section" className={cn("p-5 md:p-6", className)}>
      <h2 className="text-base font-medium text-navy">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5">{children}</div>
    </Surface>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-4 border-b border-navy/10 pb-2.5 text-sm font-medium text-navy">
      {children}
    </h3>
  );
}

/* ---------- Filtering ---------- */

export type TabItem<T extends string> = {
  value: T;
  label: string;
  count?: number;
  /** Draws attention to the count when it needs action (e.g. new orders). */
  attention?: boolean;
};

/** Horizontally scrolling filter tabs with counts; gold underline marks the active one. */
export function FilterTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      className="flex overflow-x-auto border-b border-navy/10 px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="group"
      aria-label={label}
    >
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            aria-pressed={active}
            className={cn(
              "relative flex h-12 shrink-0 items-center gap-2 px-4 text-sm whitespace-nowrap transition-colors duration-150",
              "focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold",
              active ? "text-navy" : "text-muted-foreground hover:text-navy",
            )}
          >
            {it.label}
            {it.count != null && (
              <span
                className={cn(
                  "min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums transition-colors",
                  active
                    ? "bg-navy text-cream"
                    : it.attention && it.count > 0
                      ? "bg-gold/25 text-navy"
                      : "bg-navy/[0.06] text-muted-foreground",
                )}
              >
                {adminNum.format(it.count)}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-gold transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <label className={cn("relative block", className)}>
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          inp,
          "mt-0 h-11 rounded-lg ps-9 pe-10 [&::-webkit-search-cancel-button]:hidden",
        )}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="مسح البحث"
          className="absolute top-1/2 end-1.5 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-navy/5 hover:text-navy"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </label>
  );
}

/** Thin strip under the toolbar: result count + clear-filters. */
export function ResultBar({
  children,
  onClear,
}: {
  children: ReactNode;
  onClear?: (() => void) | undefined;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 border-t border-navy/10 bg-cream/50 px-4 py-2.5 text-sm"
      aria-live="polite"
    >
      <p className="text-muted-foreground">{children}</p>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-navy transition-colors hover:bg-gold/15"
        >
          <X className="h-3.5 w-3.5" /> مسح الفلاتر
        </button>
      )}
    </div>
  );
}

/* ---------- Atoms ---------- */

export type Tone = "gold" | "navy" | "soft" | "muted" | "danger";
const TONE: Record<Tone, { badge: string; dot: string }> = {
  gold: { badge: "bg-gold/20 text-navy", dot: "bg-gold" },
  navy: { badge: "bg-navy/[0.07] text-navy", dot: "bg-navy" },
  soft: { badge: "bg-navy/[0.07] text-navy", dot: "bg-navy/50" },
  muted: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  danger: { badge: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
};

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs whitespace-nowrap",
        t.badge,
      )}
    >
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", t.dot)} />
      {children}
    </span>
  );
}

/** 40px icon button with an accessible name. */
export function IconButton({
  label,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-30",
        danger
          ? "enabled:hover:bg-destructive/10 enabled:hover:text-destructive"
          : "enabled:hover:bg-gold/15 enabled:hover:text-navy",
      )}
    >
      {children}
    </button>
  );
}

/** Stacked ▲▼ for manual ordering. */
export function ReorderButtons({
  name,
  first,
  last,
  disabled,
  onMove,
}: {
  name: string;
  first: boolean;
  last: boolean;
  disabled?: boolean;
  onMove: (dir: -1 | 1) => void;
}) {
  const cls =
    "flex h-6 w-9 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-navy/5 hover:text-navy disabled:opacity-25 disabled:hover:bg-transparent";
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={first || disabled}
        aria-label={`تحريك ${name} لأعلى`}
        className={cls}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={last || disabled}
        aria-label={`تحريك ${name} لأسفل`}
        className={cls}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ---------- States ---------- */

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-base text-navy">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Row-shaped loading placeholder. */
export function ListSkeleton({
  rows = 5,
  thumb,
}: {
  rows?: number;
  thumb?: "tall" | "round" | "square";
}) {
  return (
    <ul aria-busy="true" aria-label="جارٍ التحميل">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 border-b border-navy/[0.06] px-4 py-3.5 last:border-0"
        >
          {thumb && (
            <div
              className={cn(
                "shrink-0 animate-pulse bg-navy/[0.06]",
                thumb === "tall" && "h-14 w-11 rounded-md",
                thumb === "round" && "h-9 w-9 rounded-full",
                thumb === "square" && "h-12 w-12 rounded-md",
              )}
            />
          )}
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-navy/[0.06]" />
            <div className="h-3 w-1/5 animate-pulse rounded bg-navy/[0.06]" />
          </div>
          <div className="h-6 w-16 animate-pulse rounded-full bg-navy/[0.06]" />
        </li>
      ))}
    </ul>
  );
}

export function ErrorState({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={RotateCcw}
      title={`لم تُحمَّل ${what}`}
      text="تحقق من الاتصال ثم أعد المحاولة."
      action={
        <Button variant="outline" onClick={onRetry} className="h-10">
          إعادة المحاولة
        </Button>
      }
    />
  );
}

/* ---------- Forms ---------- */

/**
 * Sticky bar that slides up while a form has unsaved changes.
 * `offsetClass` matches the admin sidebar width on desktop.
 */
export function SaveBar({
  visible,
  saving,
  onSave,
  onReset,
  maxWidth = "max-w-5xl",
}: {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  maxWidth?: string;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-20 border-t hairline bg-navy/95 backdrop-blur transition-transform duration-300 md:start-64",
        visible || saving ? "translate-y-0" : "translate-y-full",
      )}
      aria-hidden={!visible && !saving}
    >
      <div
        className={cn(
          "mx-auto flex items-center justify-between gap-3 px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] md:px-10",
          maxWidth,
        )}
      >
        <span className="text-sm text-cream/80">لديك تغييرات غير محفوظة</span>
        <div className="flex gap-2">
          <Button variant="ghostGold" onClick={onReset} disabled={saving} className="h-10 gap-2">
            <RotateCcw className="h-4 w-4" /> تراجع
          </Button>
          <Button variant="gold" onClick={onSave} disabled={saving} className="h-10 min-w-28 gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} حفظ
          </Button>
        </div>
      </div>
    </div>
  );
}
