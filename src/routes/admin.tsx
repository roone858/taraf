import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LayoutDashboard, Package, FolderTree, Settings, LogOut, ClipboardList, MessageSquareQuote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

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
    const { data: { user } } = await supabase.auth.getUser();
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

  if (state === "loading") return <div className="min-h-screen bg-silk" />;
  if (state === "signed_out") return <AdminLogin />;
  if (state === "forbidden")
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-silk text-cream">
        <p>الحساب {email} لا يملك صلاحية الإدارة.</p>
        <Button variant="ghostGold" onClick={() => supabase.auth.signOut()}>تسجيل الخروج</Button>
      </div>
    );

  const nav = [
    { to: "/admin", label: "نظرة عامة", Icon: LayoutDashboard, exact: true },
    { to: "/admin/orders", label: "الطلبات", Icon: ClipboardList },
    { to: "/admin/products", label: "المنتجات", Icon: Package },
    { to: "/admin/categories", label: "الفئات", Icon: FolderTree },
    { to: "/admin/testimonials", label: "آراء العملاء", Icon: MessageSquareQuote },
    { to: "/admin/settings", label: "الإعدادات", Icon: Settings },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-cream md:flex-row">
      <aside className="bg-navy p-5 text-cream md:sticky md:top-0 md:h-screen md:w-60">
        <Logo />
        <nav className="mt-10 flex gap-1 overflow-x-auto md:flex-col">
          {nav.map(({ to, label, Icon, ...rest }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: "exact" in rest }}
              className="flex items-center gap-3 whitespace-nowrap px-3 py-2.5 text-sm text-cream/75 hover:text-gold"
              activeProps={{ className: "bg-ink text-gold border-r-2 border-gold" }}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-8 hidden border-t hairline pt-4 text-xs text-cream/60 md:block">
          <p className="truncate">{email}</p>
          <button onClick={() => supabase.auth.signOut()} className="mt-3 flex items-center gap-2 hover:text-gold">
            <LogOut className="h-3 w-3" /> تسجيل الخروج
          </button>
          <Link to="/" className="mt-3 block hover:text-gold">عرض المتجر</Link>
        </div>
      </aside>
      <main className="flex-1 p-5 md:p-10">
        <Outlet />
      </main>
    </div>
  );
}

function AdminLogin() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(undefined);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("بيانات الدخول غير صحيحة");
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
      setMsg(error ? error.message : "تم إنشاء الحساب. تحقق من بريدك لتأكيده ثم سجّل الدخول.");
    }
    setBusy(false);
  };

  const input = "mt-2 h-11 w-full border border-gold/30 bg-ink px-3 text-cream focus:outline-none focus:border-gold";
  return (
    <div className="flex min-h-screen items-center justify-center bg-silk px-5">
      <form onSubmit={submit} className="w-full max-w-sm border hairline p-8">
        <Logo />
        <h1 className="mt-8 font-display text-3xl text-cream">{mode === "in" ? "دخول الإدارة" : "إنشاء حساب"}</h1>
        <label className="mt-6 block text-sm text-cream/80">البريد الإلكتروني<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={input} dir="ltr" /></label>
        <label className="mt-4 block text-sm text-cream/80">كلمة المرور<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={input} dir="ltr" /></label>
        {msg && <p className="mt-4 text-sm text-gold">{msg}</p>}
        <Button type="submit" variant="gold" disabled={busy} className="mt-6 h-11 w-full">{mode === "in" ? "دخول" : "إنشاء"}</Button>
        <button type="button" onClick={() => setMode(mode === "in" ? "up" : "in")} className="mt-4 w-full text-xs text-cream/60 hover:text-gold">
          {mode === "in" ? "ليس لديك حساب؟ إنشاء حساب" : "لديك حساب؟ تسجيل الدخول"}
        </button>
      </form>
    </div>
  );
}
