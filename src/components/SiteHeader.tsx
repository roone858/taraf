import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { useCart } from "@/lib/cart";
import { categoriesQuery } from "@/lib/data";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { count, setOpen } = useCart();
  const { data: cats } = useQuery(categoriesQuery);
  const loc = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [q, setQ] = useState("");
  const overHero = loc.pathname === "/" && !scrolled;

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => setMenu(false), [loc.pathname]);

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
          <Link to="/" className="hover:text-gold" activeProps={{ className: "text-gold" }} activeOptions={{ exact: true }}>
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
          <button onClick={() => setOpen(true)} aria-label="السلة" className="relative hover:text-gold">
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
      {menu && (
        <div className="fixed inset-0 z-50 bg-silk p-6 lg:hidden">
          <div className="flex items-center justify-between">
            <Logo />
            <button onClick={() => setMenu(false)} className="text-cream" aria-label="إغلاق">
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="mt-14 flex flex-col gap-6 font-display text-3xl text-cream">
            <Link to="/">الرئيسية</Link>
            <Link to="/shop">المتجر</Link>
            {cats?.map((c) => (
              <Link key={c.id} to="/shop" search={{ cat: c.slug }} className="text-2xl text-cream/80">
                {c.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
