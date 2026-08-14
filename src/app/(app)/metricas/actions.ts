"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conteudos, publicacoes, metricas } from "@/db/schema";
import { adapters, type NormalizedRow } from "@/lib/csv-adapters";

type Plataforma = "youtube" | "instagram" | "tiktok";

/** Acha uma publicação existente (por id externo, ou por título do conteúdo) ou cria uma nova. */
async function acharOuCriarPublicacao(
  plataforma: Plataforma,
  row: { idExterno?: string | null; titulo: string; url?: string | null; publicadoEm?: string | null },
): Promise<{ publicacaoId: string; criada: boolean }> {
  // 1. por id externo
  if (row.idExterno) {
    const [p] = await db
      .select()
      .from(publicacoes)
      .where(and(eq(publicacoes.plataforma, plataforma), eq(publicacoes.idExterno, row.idExterno)))
      .limit(1);
    if (p) return { publicacaoId: p.id, criada: false };
  }
  // 2. por título do conteúdo + plataforma
  const [existente] = await db
    .select({ pubId: publicacoes.id })
    .from(publicacoes)
    .innerJoin(conteudos, eq(conteudos.id, publicacoes.conteudoId))
    .where(and(eq(publicacoes.plataforma, plataforma), eq(conteudos.tituloFinal, row.titulo)))
    .limit(1);
  if (existente) return { publicacaoId: existente.pubId, criada: false };

  // 3. cria conteúdo (publicado) + publicação
  const dataPub = row.publicadoEm ? row.publicadoEm.slice(0, 10) : null;
  const [conteudo] = await db
    .insert(conteudos)
    .values({
      tituloFinal: row.titulo,
      statusPipeline: "publicado",
      plataformas: [plataforma],
      dataPublicacao: dataPub,
      checklist: {},
    })
    .returning();
  const [pub] = await db
    .insert(publicacoes)
    .values({
      conteudoId: conteudo.id,
      plataforma,
      url: row.url ?? null,
      idExterno: row.idExterno ?? null,
      publicadoEm: dataPub ? new Date(dataPub + "T00:00:00") : null,
    })
    .returning();
  return { publicacaoId: pub.id, criada: true };
}

async function inserirSnapshot(
  publicacaoId: string,
  row: NormalizedRow,
  coletadoEm: string,
  fonte: "csv" | "manual",
) {
  // Já existe snapshot para (publicação, data, fonte)? → será update, não insert.
  const existente = await db
    .select({ id: metricas.id })
    .from(metricas)
    .where(
      and(
        eq(metricas.publicacaoId, publicacaoId),
        eq(metricas.coletadoEm, coletadoEm),
        eq(metricas.fonte, fonte),
      ),
    )
    .limit(1);
  const jaExistia = existente.length > 0;

  // Upsert no snapshot (publicacao_id, coletado_em, fonte) → nunca duplica.
  await db
    .insert(metricas)
    .values({
      publicacaoId,
      coletadoEm,
      views: row.views,
      retencaoMedia: row.retencaoMedia !== null && row.retencaoMedia !== undefined ? String(row.retencaoMedia) : null,
      tempoMedioSeg: row.tempoMedioSeg ?? null,
      likes: row.likes,
      comentarios: row.comentarios,
      compartilhamentos: row.compartilhamentos,
      salvamentos: row.salvamentos,
      seguidoresGanhos: row.seguidoresGanhos,
      fonte,
    })
    .onConflictDoUpdate({
      target: [metricas.publicacaoId, metricas.coletadoEm, metricas.fonte],
      set: {
        views: row.views,
        retencaoMedia: row.retencaoMedia !== null && row.retencaoMedia !== undefined ? String(row.retencaoMedia) : null,
        tempoMedioSeg: row.tempoMedioSeg ?? null,
        likes: row.likes,
        comentarios: row.comentarios,
        compartilhamentos: row.compartilhamentos,
        salvamentos: row.salvamentos,
        seguidoresGanhos: row.seguidoresGanhos,
      },
    });
  return !jaExistia; // true = inserido; false = atualizado
}

const importarSchema = z.object({
  plataforma: z.enum(["youtube", "instagram", "tiktok"]),
  csv: z.string().min(1),
  coletadoEm: z.string(), // YYYY-MM-DD
});

export async function importarCsv(input: z.infer<typeof importarSchema>) {
  const parsed = importarSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: "Dados inválidos" };
  const { plataforma, csv, coletadoEm } = parsed.data;

  const adapter = adapters[plataforma];
  const { rows, erros } = adapter.parseCsv(csv);
  if (rows.length === 0) {
    return { ok: false as const, erro: "Nenhuma linha reconhecida no CSV. Verifique o formato exportado.", detalhes: erros };
  }

  let inseridos = 0;
  let atualizados = 0;
  let publicacoesCriadas = 0;
  for (const row of rows) {
    const { publicacaoId, criada } = await acharOuCriarPublicacao(plataforma, row);
    if (criada) publicacoesCriadas++;
    const foiInsert = await inserirSnapshot(publicacaoId, row, coletadoEm, "csv");
    if (foiInsert) inseridos++;
    else atualizados++;
  }

  revalidatePath("/metricas");
  return {
    ok: true as const,
    resumo: { linhas: rows.length, inseridos, atualizados, publicacoesCriadas, erros },
  };
}

const manualSchema = z.object({
  plataforma: z.enum(["youtube", "instagram", "tiktok"]),
  titulo: z.string().min(1),
  url: z.string().optional().nullable(),
  publicadoEm: z.string().optional().nullable(),
  coletadoEm: z.string(),
  views: z.coerce.number().int().min(0),
  retencaoMedia: z.union([z.coerce.number(), z.literal("")]).optional(),
  tempoMedioSeg: z.union([z.coerce.number(), z.literal("")]).optional(),
  likes: z.coerce.number().int().min(0),
  comentarios: z.coerce.number().int().min(0),
  compartilhamentos: z.coerce.number().int().min(0),
  salvamentos: z.coerce.number().int().min(0),
  seguidoresGanhos: z.coerce.number().int().min(0),
});

export async function registrarMetricaManual(input: z.infer<typeof manualSchema>) {
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Inválido" };
  const d = parsed.data;

  const { publicacaoId, criada } = await acharOuCriarPublicacao(d.plataforma, {
    titulo: d.titulo,
    url: d.url ?? null,
    publicadoEm: d.publicadoEm ?? null,
  });

  const foiInsert = await inserirSnapshot(
    publicacaoId,
    {
      titulo: d.titulo,
      views: d.views,
      retencaoMedia: d.retencaoMedia === "" || d.retencaoMedia === undefined ? null : Number(d.retencaoMedia),
      tempoMedioSeg: d.tempoMedioSeg === "" || d.tempoMedioSeg === undefined ? null : Number(d.tempoMedioSeg),
      likes: d.likes,
      comentarios: d.comentarios,
      compartilhamentos: d.compartilhamentos,
      salvamentos: d.salvamentos,
      seguidoresGanhos: d.seguidoresGanhos,
    },
    d.coletadoEm,
    "manual",
  );

  revalidatePath("/metricas");
  return { ok: true as const, criada, foiInsert };
}
