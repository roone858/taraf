import { createFileRoute } from "@tanstack/react-router";
import { SiteTrafficPanel } from "@/components/SiteTrafficPanel";

export const Route = createFileRoute("/admin/visitors")({ component: Visitors });

function Visitors() {
  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-4xl text-navy">الزيارات</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        زيارات الموقع ومصادرها من Vercel Web Analytics. زيارات لوحة التحكم لا تُحتسب.
      </p>
      <SiteTrafficPanel className="mt-8" />
    </div>
  );
}
