import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ImportarClient } from "./importar-client";

export const dynamic = "force-dynamic";

export default function ImportarPage() {
  return (
    <>
      <PageHeader
        title="Importar / registrar métricas"
        description="CSV nativo de cada plataforma ou entrada manual"
        action={
          <Button asChild variant="ghost" size="icon">
            <Link href="/metricas"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
        }
      />
      <div className="p-4">
        <ImportarClient />
      </div>
    </>
  );
}
