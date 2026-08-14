import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import * as schema from "./schema";

/**
 * Seed idempotente: limpa e recria os dados de exemplo.
 * 3 pilares, 8 vídeos publicados com métricas, algumas ideias, 2 usuários.
 */
async function main() {
  const url = process.env.DATABASE_URL ?? "postgres://studio:studio@localhost:5432/studio";
  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });

  console.log("Limpando dados...");
  await sql`TRUNCATE TABLE metricas, publicacoes, roteiros, conteudos, ideias, sugestoes_ia, pilares, usuarios, config RESTART IDENTITY CASCADE`;

  // ---- Config ----
  await db.insert(schema.config).values({ palavrasPorMin: 150 });

  // ---- Usuários ----
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@studio.local").toLowerCase();
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "admin123";
  const adminNome = process.env.SEED_ADMIN_NOME ?? "Criadora";
  await db.insert(schema.usuarios).values({
    nome: adminNome,
    email: adminEmail,
    senhaHash: await bcrypt.hash(adminPass, 10),
    papel: "admin",
  });
  const editorEmail = (process.env.SEED_EDITOR_EMAIL ?? "editor@studio.local").toLowerCase();
  const editorPass = process.env.SEED_EDITOR_PASSWORD ?? "editor123";
  await db.insert(schema.usuarios).values({
    nome: "Editor Apoio",
    email: editorEmail,
    senhaHash: await bcrypt.hash(editorPass, 10),
    papel: "editor",
  });

  // ---- Pilares ----
  const pilaresData = [
    { nome: "Bastidores", descricao: "Rotina e processo de criação", cor: "#f59e0b" },
    { nome: "Tutorial", descricao: "Passo a passo prático", cor: "#6366f1" },
    { nome: "Opinião", descricao: "Hot takes e reações", cor: "#ef4444" },
  ];
  const pilares = await db.insert(schema.pilares).values(pilaresData).returning();
  const [bastidores, tutorial, opiniao] = pilares;

  // Datas dentro dos últimos 90 dias
  const hoje = new Date();
  const diaAtras = (n: number) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - n);
    return d;
  };
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);

  // ---- 8 vídeos publicados (conteúdo + publicação + métrica) ----
  const videos: Array<{
    titulo: string;
    gancho: string;
    pilar: typeof bastidores;
    formato: "short" | "reel" | "video_longo";
    plataforma: "youtube" | "instagram" | "tiktok";
    diasAtras: number;
    m: {
      views: number;
      retencao: number;
      tempoMedio: number;
      likes: number;
      comentarios: number;
      compart: number;
      salvos: number;
      seguidores: number;
    };
  }> = [
    {
      titulo: "3 erros que eu cometia editando reels",
      gancho: "Você provavelmente comete o erro #2",
      pilar: tutorial,
      formato: "reel",
      plataforma: "instagram",
      diasAtras: 7,
      m: { views: 148000, retencao: 68.4, tempoMedio: 21, likes: 12400, comentarios: 830, compart: 3100, salvos: 5400, seguidores: 1200 },
    },
    {
      titulo: "Meu setup de gravação em 2024",
      gancho: "Custou menos do que você imagina",
      pilar: bastidores,
      formato: "video_longo",
      plataforma: "youtube",
      diasAtras: 14,
      m: { views: 42000, retencao: 41.2, tempoMedio: 240, likes: 3800, comentarios: 410, compart: 290, salvos: 900, seguidores: 640 },
    },
    {
      titulo: "Por que shorts de 7s estão bombando",
      gancho: "A retenção quebra tudo que eu sabia",
      pilar: opiniao,
      formato: "short",
      plataforma: "youtube",
      diasAtras: 21,
      m: { views: 320000, retencao: 82.1, tempoMedio: 6, likes: 28000, comentarios: 1900, compart: 9200, salvos: 4100, seguidores: 3400 },
    },
    {
      titulo: "Roteirizando um vídeo em 10 minutos",
      gancho: "O gancho é 80% do trabalho",
      pilar: tutorial,
      formato: "reel",
      plataforma: "tiktok",
      diasAtras: 28,
      m: { views: 96000, retencao: 74.5, tempoMedio: 18, likes: 9100, comentarios: 620, compart: 2400, salvos: 3800, seguidores: 980 },
    },
    {
      titulo: "Um dia comigo gravando 5 vídeos",
      gancho: "Spoiler: deu tudo errado",
      pilar: bastidores,
      formato: "reel",
      plataforma: "instagram",
      diasAtras: 35,
      m: { views: 61000, retencao: 55.0, tempoMedio: 16, likes: 5200, comentarios: 340, compart: 810, salvos: 1200, seguidores: 420 },
    },
    {
      titulo: "Opinião impopular sobre trends",
      gancho: "Seguir trend está te atrasando",
      pilar: opiniao,
      formato: "short",
      plataforma: "tiktok",
      diasAtras: 45,
      m: { views: 210000, retencao: 79.3, tempoMedio: 8, likes: 19000, comentarios: 2600, compart: 7100, salvos: 2200, seguidores: 2100 },
    },
    {
      titulo: "Como eu escolho o que gravar",
      gancho: "Meu filtro de 3 perguntas",
      pilar: tutorial,
      formato: "video_longo",
      plataforma: "youtube",
      diasAtras: 60,
      m: { views: 38000, retencao: 38.7, tempoMedio: 260, likes: 3100, comentarios: 280, compart: 210, salvos: 1400, seguidores: 510 },
    },
    {
      titulo: "Reagindo aos meus primeiros vídeos",
      gancho: "Que vergonha do minuto 2",
      pilar: bastidores,
      formato: "reel",
      plataforma: "instagram",
      diasAtras: 80,
      m: { views: 74000, retencao: 62.0, tempoMedio: 19, likes: 6800, comentarios: 590, compart: 1500, salvos: 700, seguidores: 730 },
    },
  ];

  for (const v of videos) {
    const dataPub = diaAtras(v.diasAtras);
    const [conteudo] = await db
      .insert(schema.conteudos)
      .values({
        tituloFinal: v.titulo,
        formato: v.formato,
        statusPipeline: "publicado",
        plataformas: [v.plataforma],
        dataPrevista: isoDate(dataPub),
        dataPublicacao: isoDate(dataPub),
        responsavel: adminNome,
        checklist: { thumbnail: true, legenda: true, trilha: true, cta: true },
        pilarId: v.pilar.id,
      })
      .returning();

    // Roteiro v1 do conteúdo (gancho no bloco)
    await db.insert(schema.roteiros).values({
      conteudoId: conteudo.id,
      versao: 1,
      blocos: {
        gancho: v.gancho,
        contexto: "Contexto rápido do tema.",
        desenvolvimento: "Desenvolvimento do conteúdo principal.",
        climax: "Entrega do valor prometido.",
        cta: "Salva esse vídeo e me segue pra mais.",
      },
      legenda: v.titulo,
      hashtags: ["conteudo", "criador", v.pilar.nome.toLowerCase()],
    });

    const [pub] = await db
      .insert(schema.publicacoes)
      .values({
        conteudoId: conteudo.id,
        plataforma: v.plataforma,
        url: `https://exemplo.com/${v.plataforma}/${conteudo.id}`,
        idExterno: conteudo.id.slice(0, 8),
        publicadoEm: dataPub,
      })
      .returning();

    // Snapshot atual
    await db.insert(schema.metricas).values({
      publicacaoId: pub.id,
      coletadoEm: isoDate(hoje),
      views: v.m.views,
      retencaoMedia: v.m.retencao.toFixed(2),
      tempoMedioSeg: v.m.tempoMedio,
      likes: v.m.likes,
      comentarios: v.m.comentarios,
      compartilhamentos: v.m.compart,
      salvamentos: v.m.salvos,
      seguidoresGanhos: v.m.seguidores,
      fonte: "csv",
    });

    // Snapshot anterior (30 dias atrás, ~60% dos números) para mostrar curva de crescimento
    if (v.diasAtras >= 40) {
      await db.insert(schema.metricas).values({
        publicacaoId: pub.id,
        coletadoEm: isoDate(diaAtras(30)),
        views: Math.round(v.m.views * 0.6),
        retencaoMedia: v.m.retencao.toFixed(2),
        tempoMedioSeg: v.m.tempoMedio,
        likes: Math.round(v.m.likes * 0.6),
        comentarios: Math.round(v.m.comentarios * 0.6),
        compartilhamentos: Math.round(v.m.compart * 0.6),
        salvamentos: Math.round(v.m.salvos * 0.6),
        seguidoresGanhos: Math.round(v.m.seguidores * 0.6),
        fonte: "csv",
      });
    }
  }

  // ---- Algumas ideias no banco ----
  await db.insert(schema.ideias).values([
    {
      titulo: "Série: refazendo vídeos que floparam",
      gancho: "O que eu mudaria hoje",
      resumo: "Pegar 3 vídeos antigos e regravar com o que aprendi.",
      origem: "comentário de seguidor",
      pilarId: bastidores.id,
      plataformas: ["youtube", "instagram"],
      tags: ["serie", "flop"],
      status: "aprovada",
    },
    {
      titulo: "Tutorial de gancho em 30s",
      gancho: "A fórmula que eu uso",
      resumo: "Ensinar a estrutura de gancho que mais reteve.",
      origem: "insight do dashboard",
      pilarId: tutorial.id,
      plataformas: ["tiktok"],
      tags: ["gancho", "retencao"],
      status: "ideia",
    },
    {
      titulo: "Hot take: thumbnail não importa em shorts",
      gancho: "Prove que estou errada",
      resumo: "Discutir peso da thumbnail por formato.",
      origem: "brainstorm",
      pilarId: opiniao.id,
      plataformas: ["youtube"],
      tags: ["opiniao", "thumbnail"],
      status: "ideia",
    },
  ]);

  console.log("Seed concluído:");
  console.log(`  Admin:  ${adminEmail} / ${adminPass}`);
  console.log(`  Editor: ${editorEmail} / ${editorPass}`);
  console.log(`  3 pilares, ${videos.length} vídeos com métricas, 3 ideias.`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
