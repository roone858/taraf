import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { WhatsappIcon } from "./BrandIcons";
import { AccountMenu, AccountMenuSection } from "./AccountMenu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { categoriesQuery, settingsQuery } from "@/lib/data";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";
import { useSiteMenu } from "@/lib/site-menu";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const { data: cats } = useQuery(categoriesQuery);
  const { data: s } = useQuery(settingsQuery);
  const wa = normalizeWhatsappNumber(s?.whatsapp_number);
  const loc = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { open: menu, setOpen: setMenu } = useSiteMenu();
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  // Pages that open on a dark full-bleed hero keep the header transparent until scrolled
  const overHero = (loc.pathname === "/" || loc.pathname === "/custom") && !scrolled;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setMenu(false), [loc.pathname, setMenu]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(false);
    navigate({ to: "/shop", search: { q: q || undefined } });
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-500",
        overHero ? "bg-transparent" : "bg-navy/95 backdrop-blur border-b hairline",
      )}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-10">
        {/* Start side (right in RTL): menu, search, then the logo */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="-ms-2 flex h-11 w-11 items-center justify-center text-cream transition-colors hover:text-gold lg:hidden"
            onClick={() => setMenu(true)}
            aria-label="القائمة"
            aria-expanded={menu}
          >
            <Menu className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => setSearch((s) => !s)}
            aria-label="بحث"
            aria-expanded={search}
            className="flex h-10 w-10 items-center justify-center text-cream transition-colors hover:text-gold lg:-ms-2"
          >
            <Search className="h-5 w-5" />
          </button>
          <Link to="/" aria-label="الرئيسية" className="ms-1 lg:ms-2">
            <Logo />
          </Link>
        </div>
        <nav className="hidden items-center gap-9 text-sm text-cream/85 lg:flex">
          <Link
            to="/"
            className="hover:text-gold"
            activeProps={{ className: "text-gold" }}
            activeOptions={{ exact: true }}
          >
            الرئيسية
          </Link>
          <Link to="/shop" className="hover:text-gold" activeProps={{ className: "text-gold" }}>
            المتجر
          </Link>
          <Link to="/custom" className="hover:text-gold" activeProps={{ className: "text-gold" }}>
            التفصيل
          </Link>
          {cats?.slice(0, 3).map((c) => (
            <Link key={c.id} to="/shop" search={{ cat: c.slug }} className="hover:text-gold">
              {c.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2.5 text-cream sm:gap-3.5">
          <AccountMenu />
          <button
            onClick={() => setOpen(true)}
            aria-label="السلة"
            className="relative flex h-9 w-9 items-center justify-center hover:text-gold"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-0.5 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] text-ink">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>
      {search && (
        <form onSubmit={submit} className="border-t hairline bg-navy">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-4">
            <Search className="h-4 w-4 text-gold" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن قطعة..."
              className="w-full bg-transparent text-cream placeholder:text-cream/50 focus:outline-none"
            />
          </div>
        </form>
      )}
      {/* Portaled drawer: rendering it inside the header would clip it to the header box once backdrop-blur applies */}
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent
          side="right"
          dir="rtl"
          className="flex w-[85vw] max-w-sm flex-col gap-0 border-s hairline bg-silk p-0 text-cream lg:hidden [&>button]:hidden"
        >
          <SheetTitle className="sr-only">القائمة</SheetTitle>
          <div className="flex h-20 shrink-0 items-center justify-between border-b hairline px-5">
            <Link to="/" onClick={() => setMenu(false)} aria-label="الرئيسية">
              <Logo className="h-10" />
            </Link>
            <button
              type="button"
              onClick={() => setMenu(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 text-cream transition-colors hover:border-gold hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Close on any link tap — category links keep the same pathname, so the pathname effect won't fire */}
          <nav
            aria-label="القائمة الرئيسية"
            className="flex-1 overflow-y-auto px-5 pt-5 pb-8"
            onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(false)}
          >
            <form
              role="search"
              onSubmit={(e) => {
                submit(e);
                setMenu(false);
              }}
              className="relative"
            >
              <Search className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-gold" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ابحث عن قطعة..."
                aria-label="بحث في المتجر"
                enterKeyHint="search"
                className="h-12 w-full border border-cream/15 bg-cream/5 ps-10 pe-3 text-cream transition-colors placeholder:text-cream/50 focus:border-gold focus:bg-cream/10 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              />
            </form>

            <ul className="mt-4">
              {[
                { to: "/", label: "الرئيسية", exact: true },
                { to: "/shop", label: "المتجر", exact: false },
                { to: "/custom", label: "التفصيل حسب الطلب", exact: false },
              ].map(({ to, label, exact }) => (
                <li key={to}>
                  <Link
                    to={to}
                    activeOptions={{ exact, includeSearch: false }}
                    className="group flex items-center justify-between border-b border-cream/10 py-4 font-display text-2xl text-cream transition-colors hover:text-gold"
                    activeProps={{ className: "!text-gold", "aria-current": "page" }}
                  >
                    {label}
                    <ChevronLeft className="h-5 w-5 text-gold/60 transition-transform group-hover:-translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>

            {!!cats?.length && (
              <section aria-labelledby="menu-cats" className="mt-8">
                <h3 id="menu-cats" className="mb-3 font-sans text-sm text-cream/60">
                  المجموعات
                </h3>
                <ul className="space-y-1">
                  {cats.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/shop"
                        search={{ cat: c.slug }}
                        className="group flex items-center gap-3 p-2 text-cream/85 transition-colors hover:bg-cream/5 hover:text-gold"
                        activeProps={{ className: "bg-cream/5 !text-gold" }}
                      >
                        <span className="h-12 w-12 shrink-0 overflow-hidden bg-ink">
                          {c.image_url && (
                            <img
                              src={c.image_url}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover opacity-90"
                            />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{c.name}</span>
                        <ChevronLeft className="h-4 w-4 shrink-0 text-gold/50 transition-transform group-hover:-translate-x-1" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </nav>

          <div className="shrink-0 space-y-2.5 border-t hairline p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
            <AccountMenuSection onNavigate={() => setMenu(false)} />
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setOpen(true);
              }}
              className="flex h-12 w-full items-center justify-center gap-2 bg-gold text-sm text-ink transition-colors hover:bg-cream"
            >
              <ShoppingBag className="h-4 w-4" />
              سلة التسوق
              {count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[0.65rem] text-cream tabular-nums">
                  {count}
                </span>
              )}
            </button>
            {wa && (
              <a
                href={`https://wa.me/${wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 border border-gold/50 text-sm text-gold transition-colors hover:border-gold hover:bg-gold/10"
              >
                <WhatsappIcon className="h-4 w-4" /> تواصل معنا عبر واتساب
              </a>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
