import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CartProvider } from "@/lib/cart";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CartDrawer } from "@/components/CartDrawer";
import { WhatsappFab } from "@/components/WhatsappFab";
import { Analytics } from "@vercel/analytics/react";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-silk px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-gold">404</h1>
        <h2 className="mt-4 text-xl text-cream">الصفحة غير موجودة</h2>
        <div className="mt-6">
          <Link to="/" className="inline-flex bg-gold px-6 py-3 text-sm text-ink">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl text-foreground">تعذر تحميل الصفحة</h1>
        <p className="mt-2 text-sm text-muted-foreground">حدث خطأ ما. حاول مرة أخرى.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            إعادة المحاولة
          </button>
          <a href="/" className="border px-4 py-2 text-sm">
            الرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TARAF FURNITURE — أثاث فاخر" },
      { name: "description", content: "أثاث فاخر وقطع خشبية منحوتة بعناية من طرف للأثاث." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/assets/brand/emblem.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/assets/brand/emblem.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=El+Messiri:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith("/admin");
  return (
    <QueryClientProvider client={queryClient}>
      <CartProvider>
        {!isAdmin && <SiteHeader />}
        <Outlet />
        {!isAdmin && <SiteFooter />}
        {!isAdmin && <CartDrawer />}
        {!isAdmin && <WhatsappFab />}
        <Toaster position="top-center" />
        {/* Vercel Web Analytics; admin pages are not counted as site visits */}
        <Analytics beforeSend={(e) => (new URL(e.url).pathname.startsWith("/admin") ? null : e)} />
      </CartProvider>
    </QueryClientProvider>
  );
}
