import { createFileRoute } from "@tanstack/react-router";
import { SiteTrafficPanel } from "@/components/SiteTrafficPanel";
import { PageHeader } from "@/components/admin/kit";

export const Route = createFileRoute("/admin/visitors")({ component: Visitors });

function Visitors() {
  return (
    <div className="max-w-5xl">
      <PageHeader title="الزيارات" meta="من يزور المتجر، ومن أين يأتي، وماذا يشاهد." />
      <SiteTrafficPanel className="mt-8" />
    </div>
  );
}
