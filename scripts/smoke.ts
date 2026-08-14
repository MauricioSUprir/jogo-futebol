/**
 * Smoke test dos critérios de aceite que não dependem de UI:
 *  - Dashboard: "5 vídeos com melhor retenção nos últimos 90 dias"
 *  - Importar CSV do YouTube popula métricas SEM duplicar (reimportar não duplica)
 */
import { db } from "@/db";
import { conteudos, publicacoes, metricas } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { dashboard } from "@/lib/analytics";
import { adapters } from "@/lib/csv-adapters";

async function main() {
  // 1) Dashboard: melhores por retenção (90 dias)
  const d = await dashboard();
  console.log("\n== 5 melhores por retenção (últimos 90 dias) ==");
  d.melhoresRetencao90.forEach((v, i) =>
    console.log(`  ${i + 1}. ${v.titulo} — ${v.retencaoMedia}%`),
  );
  console.log(`  (total de vídeos com métricas: ${d.totalVideos})`);

  // 2) Import CSV do YouTube — idempotência
  const csv = [
    "Content,Video title,Views,Average percentage viewed (%),Average view duration,Likes,Comments added,Shares,Videos added to playlists,Subscribers",
    "abc123,Teste de importação CSV,10000,55.5,0:45,800,60,120,90,45",
    "def456,Segundo vídeo de teste,25000,71.2,0:52,1900,140,410,220,110",
    "Total,,35000,,,,,,,",
  ].join("\n");

  const { rows, erros } = adapters.youtube.parseCsv(csv);
  console.log(`\n== Import CSV YouTube ==`);
  console.log(`  linhas reconhecidas: ${rows.length} (esperado 2, linha "Total" ignorada)`);
  if (erros.length) console.log(`  avisos: ${erros.join("; ")}`);

  const coletadoEm = new Date().toISOString().slice(0, 10);

  async function importar() {
    for (const row of rows) {
      // find-or-create publicacao por (plataforma, idExterno)
      let [pub] = await db
        .select()
        .from(publicacoes)
        .where(and(eq(publicacoes.plataforma, "youtube"), eq(publicacoes.idExterno, row.idExterno!)))
        .limit(1);
      if (!pub) {
        const [c] = await db
          .insert(conteudos)
          .values({ tituloFinal: row.titulo, statusPipeline: "publicado", plataformas: ["youtube"], checklist: {} })
          .returning();
        [pub] = await db
          .insert(publicacoes)
          .values({ conteudoId: c.id, plataforma: "youtube", idExterno: row.idExterno })
          .returning();
      }
      await db
        .insert(metricas)
        .values({
          publicacaoId: pub.id,
          coletadoEm,
          views: row.views,
          retencaoMedia: row.retencaoMedia !== null ? String(row.retencaoMedia) : null,
          tempoMedioSeg: row.tempoMedioSeg ?? null,
          likes: row.likes,
          comentarios: row.comentarios,
          compartilhamentos: row.compartilhamentos,
          salvamentos: row.salvamentos,
          seguidoresGanhos: row.seguidoresGanhos,
          fonte: "csv",
        })
        .onConflictDoUpdate({
          target: [metricas.publicacaoId, metricas.coletadoEm, metricas.fonte],
          set: { views: row.views },
        });
    }
  }

  await importar();
  const apos1 = await db.execute(
    sql`SELECT count(*)::int AS n FROM metricas m JOIN publicacoes p ON p.id=m.publicacao_id WHERE p.id_externo IN ('abc123','def456')`,
  );
  await importar(); // reimporta o MESMO CSV/dia
  const apos2 = await db.execute(
    sql`SELECT count(*)::int AS n FROM metricas m JOIN publicacoes p ON p.id=m.publicacao_id WHERE p.id_externo IN ('abc123','def456')`,
  );
  const n1 = (apos1 as unknown as { n: number }[])[0].n;
  const n2 = (apos2 as unknown as { n: number }[])[0].n;
  console.log(`  snapshots após 1ª importação: ${n1}`);
  console.log(`  snapshots após reimportar (mesmo dia): ${n2}`);
  console.log(`  ${n1 === 2 && n2 === 2 ? "OK — não duplicou ✓" : "FALHOU — duplicou ✗"}`);

  // limpeza dos dados de teste
  await db.delete(publicacoes).where(sql`id_externo IN ('abc123','def456')`);

  process.exit(n1 === 2 && n2 === 2 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
