import { createFileRoute } from "@tanstack/react-router";
import { SiteTrafficPanel } from "@/components/SiteTrafficPanel";

export const Route = createFileRoute("/admin/visitors")({ component: Visitors });

function Visitors() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-4xl text-navy">الزيارات</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        من يزور المتجر، ومن أين يأتي، وماذا يشاهد.
      </p>
      <SiteTrafficPanel className="mt-8" />
    </div>
  );
}
