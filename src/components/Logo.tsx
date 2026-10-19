import { cn } from "@/lib/utils";

/** Official TARAF brand assets (served from public/assets/brand). */
export const BRAND = {
  emblem: "/assets/brand/emblem.png",
  horizontal: {
    light: "/assets/brand/logo-horizontal-dark-bg.png", // cream wordmark, for navy backgrounds
    dark: "/assets/brand/logo-horizontal-light-bg.png", // navy wordmark, for cream backgrounds
  },
  stacked: "/assets/brand/logo-stacked-dark-bg.png",
} as const;

/** Gold calligraphic mark, without wordmark. */
export function Emblem({ className }: { className?: string }) {
  return (
    <img
      src={BRAND.emblem}
      alt=""
      aria-hidden
      width={476}
      height={476}
      className={cn("object-contain", className)}
    />
  );
}

/**
 * `tone="light"` renders the cream wordmark (for dark navy surfaces), `tone="dark"` the navy one (for cream surfaces).
 * The stacked variant is only supplied for dark surfaces.
 */
export function Logo({
  tone = "light",
  variant = "horizontal",
  className,
}: {
  tone?: "light" | "dark";
  variant?: "horizontal" | "stacked";
  className?: string;
}) {
  if (variant === "stacked") {
    return (
      <img
        src={BRAND.stacked}
        alt="TARAF FURNITURE"
        width={1742}
        height={1352}
        className={cn("h-32 w-auto object-contain", className)}
      />
    );
  }
  return (
    <img
      src={BRAND.horizontal[tone]}
      alt="TARAF FURNITURE"
      width={1742}
      height={549}
      className={cn("h-12 w-auto object-contain", className)}
    />
  );
}
