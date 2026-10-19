import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart";
import { categoriesQuery } from "@/lib/data";
import { useSiteMenu } from "@/lib/site-menu";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const { data: cats } = useQuery(categoriesQuery);
  const loc = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const { open: menu, setOpen: setMenu } = useSiteMenu();
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const overHero = loc.pathname === "/" && !scrolled;

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
        <button className="text-cream lg:hidden" onClick={() => setMenu(true)} aria-label="القائمة">
          <Menu className="h-6 w-6" />
        </button>
        <Link to="/" aria-label="الرئيسية">
          <Logo />
        </Link>
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
          {cats?.slice(0, 4).map((c) => (
            <Link key={c.id} to="/shop" search={{ cat: c.slug }} className="hover:text-gold">
              {c.name}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-cream">
          <button onClick={() => setSearch((s) => !s)} aria-label="بحث" className="hover:text-gold">
            <Search className="h-5 w-5" />
          </button>
          <button
            onClick={() => setOpen(true)}
            aria-label="السلة"
            className="relative hover:text-gold"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -top-2 -left-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1 text-[0.65rem] text-ink">
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
              onClick={() => setMenu(false)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/40 text-cream transition-colors hover:border-gold hover:text-gold"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Close on any link tap — category links keep the same pathname, so the pathname effect won't fire */}
          <nav
            className="flex-1 overflow-y-auto px-5 py-8"
            onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(false)}
          >
            <ul className="space-y-1">
              {[
                { to: "/", label: "الرئيسية", exact: true },
                { to: "/shop", label: "المتجر", exact: false },
              ].map(({ to, label, exact }) => (
                <li key={to}>
                  <Link
                    to={to}
                    activeOptions={{ exact, includeSearch: false }}
                    className="flex items-center justify-between border-b border-cream/10 py-4 font-display text-2xl text-cream transition-colors hover:text-gold"
                    activeProps={{ className: "!text-gold" }}
                  >
                    {label}
                    <ChevronLeft className="h-5 w-5 text-gold/60" />
                  </Link>
                </li>
              ))}
            </ul>

            {!!cats?.length && (
              <>
                <p className="eyebrow mt-10 mb-4">المجموعات</p>
                <ul className="grid grid-cols-2 gap-2">
                  {cats.map((c) => (
                    <li key={c.id}>
                      <Link
                        to="/shop"
                        search={{ cat: c.slug }}
                        className="block border border-cream/10 px-3 py-3 text-sm text-cream/80 transition-colors hover:border-gold/60 hover:text-gold"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </nav>

          <div className="shrink-0 border-t hairline p-5">
            <button
              onClick={() => {
                setMenu(false);
                setOpen(true);
              }}
              className="flex h-12 w-full items-center justify-center gap-2 bg-gold text-sm text-ink transition-colors hover:bg-cream"
            >
              <ShoppingBag className="h-4 w-4" />
              سلة التسوق{count > 0 && ` (${count})`}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
