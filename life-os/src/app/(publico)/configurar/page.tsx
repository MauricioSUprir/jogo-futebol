import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { listaDeFusos } from "@/lib/datas";
import { FormConfigurar } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurar" };

export default async function PaginaConfigurar() {
  if ((await db.user.count()) > 0) redirect("/entrar");
  return <FormConfigurar fusos={listaDeFusos()} semToken={!process.env.LIFEOS_SETUP_TOKEN} />;
}
