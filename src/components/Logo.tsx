import { cn } from "@/lib/utils";

/** Temporary original swan/flame emblem. Replace with official logo assets when supplied. */
export function Emblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("text-gold", className)} fill="none" aria-hidden>
      <path
        d="M40 10c-6 2-9 8-7 14 2 5 7 7 7 13 0 8-8 14-17 14 5 3 13 4 20 0 7-4 10-12 7-19-2-5-7-7-7-12 0-4 2-7 5-9-3-1-6-1-8-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14 52c8 2 22 2 36-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="41.5" cy="15" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)} dir="ltr">
      <Emblem className="h-9 w-9" />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-xl tracking-[0.28em]", tone === "light" ? "text-cream" : "text-navy")}>
          TARAF
        </span>
        <span className="mt-1 text-[0.55rem] tracking-[0.5em] text-gold">FURNITURE</span>
      </span>
    </span>
  );
}
