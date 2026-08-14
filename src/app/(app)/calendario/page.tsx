import { db } from "@/db";
import { conteudos, pilares } from "@/db/schema";
import { CalendarioClient } from "./calendario-client";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const [listaConteudos, listaPilares] = await Promise.all([
    db.select().from(conteudos),
    db.select().from(pilares).orderBy(pilares.nome),
  ]);

  // Só o necessário para o calendário (data efetiva = publicação ou prevista).
  const eventos = listaConteudos
    .map((c) => ({
      id: c.id,
      titulo: c.tituloFinal,
      data: c.dataPublicacao ?? c.dataPrevista,
      publicado: !!c.dataPublicacao,
      plataformas: c.plataformas ?? [],
      pilarId: c.pilarId,
      status: c.statusPipeline,
    }))
    .filter((e) => e.data);

  return <CalendarioClient eventos={eventos} pilares={listaPilares} />;
}
