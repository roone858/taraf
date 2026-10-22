import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  ExternalLink,
  FolderTree,
  HelpCircle,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Menu,
  MessageSquareQuote,
  Package,
  Ruler,
  Settings,
  X,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  SearchCheck,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "لوحة التحكم — TARAF FURNITURE" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "لوحة إدارة متجر طرف." },
      { property: "og:title", content: "لوحة التحكم" },
      { property: "og:description", content: "إدارة المتجر" },
    ],
  }),
  component: AdminLayout,
});

type State = "loading" | "signed_out" | "forbidden" | "ok";

function AdminLayout() {
  const [state, setState] = useState<State>("loading");
  const [email, setEmail] = useState<string>();

  const check = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return setState("signed_out");
    setEmail(user.email);
    const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setState(data ? "ok" : "forbidden");
  };

  useEffect(() => {
    check();
    const { data } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN" || e === "SIGNED_OUT") check();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (state === "loading")
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-6 bg-silk"
        aria-busy="true"
        aria-label="جارٍ التحقق من الدخول"
      >
        <Logo className="h-12 opacity-90" />
        <Loader2 className="h-5 w-5 animate-spin text-gold" />
      </div>
    );
  if (state === "signed_out") return <AdminLogin />;
  if (state === "forbidden")
    return (
      <div className="flex min-h-screen items-center justify-center bg-silk px-5">
        <div className="w-full max-w-sm rounded-xl border hairline bg-ink/40 p-8 text-center text-cream">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-gold">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <h1 className="mt-5 font-display text-2xl">لا تملك صلاحية الإدارة</h1>
          <p className="mt-3 text-sm leading-relaxed text-cream/75">
            الحساب <bdi className="text-cream">{email}</bdi> مسجّل، لكنه ليس حساب مدير. سجّل الدخول
            بحساب المدير أو اطلب من صاحب المتجر منحك الصلاحية.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button variant="gold" className="h-11" onClick={() => supabase.auth.signOut()}>
              تسجيل الخروج والدخول بحساب آخر
            </Button>
            <Link to="/" className="py-2 text-sm text-cream/70 hover:text-cream">
              العودة إلى المتجر
            </Link>
          </div>
        </div>
      </div>
    );

  return <AdminShell email={email} />;
}

const NAV_GROUPS = [
  {
    title: "الرئيسية",
    items: [
      { to: "/admin", label: "نظرة عامة", Icon: LayoutDashboard, exact: true },
      { to: "/admin/visitors", label: "الزيارات", Icon: BarChart3 },
    ],
  },
  {
    title: "المبيعات",
    items: [
      { to: "/admin/orders", label: "الطلبات", Icon: ClipboardList, badge: "newOrders" },
      { to: "/admin/custom", label: "طلبات التفصيل", Icon: Ruler, badge: "newCustom" },
    ],
  },
  {
    title: "الكتالوج",
    items: [
      { to: "/admin/products", label: "المنتجات", Icon: Package },
      { to: "/admin/categories", label: "الفئات", Icon: FolderTree },
    ],
  },
  {
    title: "المحتوى",
    items: [
      { to: "/admin/home", label: "الصفحة الرئيسية", Icon: LayoutTemplate },
      { to: "/admin/testimonials", label: "آراء العملاء", Icon: MessageSquareQuote },
      { to: "/admin/faqs", label: "الأسئلة الشائعة", Icon: HelpCircle },
      { to: "/admin/seo", label: "تحسين الظهور", Icon: SearchCheck },
    ],
  },
  { title: "النظام", items: [{ to: "/admin/settings", label: "الإعدادات", Icon: Settings }] },
] as const;

function AdminShell({ email }: { email: string | undefined }) {
  const [menu, setMenu] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenu(false), [pathname]);

  // New-order count for the sidebar badge
  const { data: newOrders = 0 } = useQuery({
    queryKey: ["admin", "new-orders-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
  const { data: newCustom = 0 } = useQuery({
    queryKey: ["admin", "new-custom-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("custom_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
  const badges = { newOrders, newCustom };

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden bg-silk text-cream md:sticky md:top-0 md:flex md:h-screen md:w-64 md:shrink-0 md:border-e md:hairline">
        <SidebarBody email={email} badges={badges} />
      </aside>

      {/* Mobile top bar + drawer */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b hairline bg-navy px-4 md:hidden">
        <Link to="/admin" aria-label="لوحة التحكم">
          <Logo className="h-9" />
        </Link>
        <button
          onClick={() => setMenu(true)}
          className="relative flex h-10 w-10 items-center justify-center text-cream hover:text-gold"
          aria-label="القائمة"
        >
          <Menu className="h-6 w-6" />
          {newOrders + newCustom > 0 && (
            <span className="absolute top-1.5 end-1.5 h-2.5 w-2.5 rounded-full bg-gold" />
          )}
        </button>
      </header>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent
          side="right"
          dir="rtl"
          className="flex w-72 border-s-0 bg-silk p-0 text-cream [&>button]:hidden"
        >
          <SheetTitle className="sr-only">القائمة</SheetTitle>
          <SidebarBody email={email} badges={badges} onClose={() => setMenu(false)} />
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 p-5 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}

function SidebarBody({
  email,
  badges,
  onClose,
}: {
  email: string | undefined;
  badges: { newOrders: number; newCustom: number };
  onClose?: () => void;
}) {
  const item =
    "group flex items-center gap-3 border-s-2 border-transparent px-3 py-2 text-sm text-cream/70 transition-colors hover:bg-cream/5 hover:text-cream";
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex h-20 shrink-0 items-center justify-between border-b hairline px-5">
        <Link to="/admin" onClick={onClose} aria-label="لوحة التحكم">
          <Logo className="h-10" />
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 text-cream hover:border-gold hover:text-gold"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6" aria-label="أقسام لوحة التحكم">
        {NAV_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-2 px-3 text-[0.65rem] tracking-[0.2em] text-gold/80">{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const count = "badge" in it ? badges[it.badge] : 0;
                return (
                  <li key={it.to}>
                    <Link
                      to={it.to}
                      onClick={onClose}
                      activeOptions={{ exact: "exact" in it && it.exact }}
                      className={item}
                      activeProps={{ className: "!border-gold bg-gold/10 !text-gold" }}
                    >
                      <it.Icon className="h-4 w-4 shrink-0 opacity-80 group-hover:opacity-100" />
                      <span className="flex-1">{it.label}</span>
                      {count > 0 && (
                        <span
                          className="min-w-5 rounded-full bg-gold px-1.5 text-center text-[0.65rem] leading-5 text-ink"
                          aria-label={`${count} طلب جديد`}
                        >
                          {count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div>
          <p className="mb-2 px-3 text-[0.65rem] tracking-[0.2em] text-gold/80">المتجر</p>
          <a href="/" target="_blank" rel="noopener noreferrer" className={item}>
            <ExternalLink className="h-4 w-4 shrink-0 opacity-80" />
            <span className="flex-1">عرض المتجر</span>
          </a>
        </div>
      </nav>

      <div className="shrink-0 border-t hairline p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold/50 font-display text-gold">
            {email?.charAt(0).toUpperCase() ?? "A"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.7rem] text-cream/50">مسجّل الدخول</p>
            <p className="truncate text-sm text-cream/90" dir="ltr" title={email}>
              {email}
            </p>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-cream/60 transition-colors hover:text-gold"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLogin() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string }>();
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(undefined);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg({ tone: "error", text: "البريد أو كلمة المرور غير صحيحة." });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/admin` },
      });
      setMsg(
        error
          ? { tone: "error", text: error.message }
          : { tone: "info", text: "تم إنشاء الحساب. افتح الرابط في بريدك لتأكيده ثم سجّل الدخول." },
      );
    }
    setBusy(false);
  };

  const input =
    "mt-1.5 h-11 w-full rounded-lg border border-cream/15 bg-ink/60 px-3 text-cream transition-colors placeholder:text-cream/30 hover:border-cream/30 focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/30";
  return (
    <div className="flex min-h-screen items-center justify-center bg-silk px-5 py-10">
      <div className="w-full max-w-sm">
        <form
          onSubmit={submit}
          className="rounded-xl border hairline bg-ink/40 p-7 shadow-[0_24px_48px_-24px_oklch(0.19_0.03_260/0.6)] sm:p-8"
          noValidate={false}
        >
          <Logo className="h-11" />
          <h1 className="mt-8 font-display text-3xl text-cream">
            {mode === "in" ? "دخول الإدارة" : "إنشاء حساب"}
          </h1>
          <p className="mt-1.5 text-sm text-cream/60">
            {mode === "in" ? "سجّل الدخول لإدارة المتجر." : "أول حساب يُنشأ يصبح حساب المدير."}
          </p>

          <label className="mt-7 block text-sm text-cream/80">
            البريد الإلكتروني
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={input}
              dir="ltr"
            />
          </label>
          <label className="mt-4 block text-sm text-cream/80">
            كلمة المرور
            <span className="relative mt-1.5 block" dir="ltr">
              <input
                type={show ? "text" : "password"}
                required
                minLength={8}
                autoComplete={mode === "in" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={cn(input, "mt-0 pe-11")}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={show}
                className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-cream/60 transition-colors hover:text-cream"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
            {mode === "up" && (
              <span className="mt-1.5 block text-xs text-cream/50">٨ أحرف على الأقل.</span>
            )}
          </label>

          <div aria-live="polite">
            {msg && (
              <p
                className={cn(
                  "mt-4 rounded-lg px-3 py-2.5 text-sm",
                  msg.tone === "error" ? "bg-destructive/20 text-cream" : "bg-gold/15 text-cream",
                )}
              >
                {msg.text}
              </p>
            )}
          </div>

          <Button type="submit" variant="gold" disabled={busy} className="mt-6 h-11 w-full gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "in" ? "دخول" : "إنشاء الحساب"}
          </Button>
          <button
            type="button"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setMsg(undefined);
            }}
            className="mt-3 w-full rounded-md py-2 text-sm text-cream/70 transition-colors hover:text-cream"
          >
            {mode === "in" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب؟ تسجيل الدخول"}
          </button>
        </form>
        <Link
          to="/"
          className="mt-5 flex items-center justify-center gap-1.5 text-sm text-cream/60 transition-colors hover:text-cream"
        >
          <ArrowRight className="h-4 w-4" /> العودة إلى المتجر
        </Link>
      </div>
    </div>
  );
}
