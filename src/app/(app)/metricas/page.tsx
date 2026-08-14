import Link from "next/link";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { dashboard } from "@/lib/analytics";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function MetricasPage() {
  const data = await dashboard();

  return (
    <>
      <PageHeader
        title="Dashboard de performance"
        description={`${data.totalVideos} vídeos com métricas`}
        action={
          <Button asChild size="sm">
            <Link href="/metricas/importar">
              <Upload className="h-4 w-4" /> Importar / registrar
            </Link>
          </Button>
        }
      />
      <DashboardClient data={data} />
    </>
  );
}
