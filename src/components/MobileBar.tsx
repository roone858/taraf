import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Menu, ShoppingBag } from "lucide-react";
import { useCart } from "@/lib/cart";
import { settingsQuery } from "@/lib/data";
import { useSiteMenu } from "@/lib/site-menu";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { WhatsappIcon } from "./BrandIcons";

/**
 * Bottom navigation for phones and tablets (hidden from lg up, where the header nav is visible):
 * Home · WhatsApp · Cart · Menu. Respects the iPhone home-indicator safe area.
 */
export function MobileBar() {
  const { pathname } = useLocation();
  const cart = useCart();
  const menu = useSiteMenu();
  const { data: s } = useQuery(settingsQuery);
  const wa = normalizeWhatsappNumber(s?.whatsapp_number);
  const waHref = wa ? `https://wa.me/${wa}` : "https://www.whatsapp.com";

  const item =
    "relative flex flex-1 flex-col items-center justify-center gap-1 pt-2.5 pb-2 text-[0.7rem] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-gold";
  const tone = (active: boolean) => (active ? "text-gold" : "text-cream/70 hover:text-cream");
  const homeActive = pathname === "/" && !menu.open && !cart.open;

  return (
    <>
      {/* Spacer so the footer's last lines aren't hidden behind the bar */}
      <div className="h-[calc(4rem+env(safe-area-inset-bottom,0px))] lg:hidden" aria-hidden />

      <nav
        aria-label="التنقل السريع"
        className="fixed inset-x-0 bottom-0 z-40 border-t hairline bg-navy/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto flex h-16 max-w-lg items-stretch">
          <li className="flex flex-1">
            <Link
              to="/"
              className={cn(item, tone(homeActive))}
              aria-current={pathname === "/" ? "page" : undefined}
            >
              <ActiveMark show={homeActive} />
              <Home className="h-5 w-5" />
              الرئيسية
            </Link>
          </li>
          <li className="flex flex-1">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(item, tone(false))}
            >
              <WhatsappIcon className="h-5 w-5" />
              واتساب
            </a>
          </li>
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => {
                menu.setOpen(false);
                cart.setOpen(true);
              }}
              className={cn(item, tone(cart.open))}
              aria-label={`السلة${cart.count ? `، ${cart.count} قطع` : ""}`}
            >
              <ActiveMark show={cart.open} />
              <span className="relative">
                <ShoppingBag className="h-5 w-5" />
                {cart.count > 0 && (
                  <span className="absolute -top-2 -end-2.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] leading-none text-ink">
                    {cart.count > 99 ? "99+" : cart.count}
                  </span>
                )}
              </span>
              السلة
            </button>
          </li>
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => {
                cart.setOpen(false);
                menu.setOpen(true);
              }}
              className={cn(item, tone(menu.open))}
              aria-expanded={menu.open}
            >
              <ActiveMark show={menu.open} />
              <Menu className="h-5 w-5" />
              القائمة
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}

function ActiveMark({ show }: { show: boolean }) {
  return (
    <span
      className={cn(
        "absolute top-0 h-0.5 w-8 rounded-full bg-gold transition-opacity",
        show ? "opacity-100" : "opacity-0",
      )}
      aria-hidden
    />
  );
}
