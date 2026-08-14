import { sql } from "drizzle-orm";
import { db } from "@/db";

export interface VideoMetrica {
  publicacaoId: string;
  conteudoId: string;
  titulo: string;
  formato: string;
  plataforma: string;
  pilarNome: string | null;
  pilarCor: string | null;
  publicadoEm: string | null;
  coletadoEm: string;
  views: number;
  retencaoMedia: number | null;
  tempoMedioSeg: number | null;
  likes: number;
  comentarios: number;
  compartilhamentos: number;
  salvamentos: number;
  seguidoresGanhos: number;
}

/** Snapshot MAIS RECENTE por publicação (não soma snapshots). */
export async function ultimosSnapshots(): Promise<VideoMetrica[]> {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (m.publicacao_id)
      m.publicacao_id       AS "publicacaoId",
      p.conteudo_id         AS "conteudoId",
      c.titulo_final        AS "titulo",
      c.formato             AS "formato",
      p.plataforma          AS "plataforma",
      pil.nome              AS "pilarNome",
      pil.cor               AS "pilarCor",
      to_char(p.publicado_em, 'YYYY-MM-DD') AS "publicadoEm",
      to_char(m.coletado_em, 'YYYY-MM-DD')  AS "coletadoEm",
      m.views               AS "views",
      m.retencao_media      AS "retencaoMedia",
      m.tempo_medio_seg     AS "tempoMedioSeg",
      m.likes               AS "likes",
      m.comentarios         AS "comentarios",
      m.compartilhamentos   AS "compartilhamentos",
      m.salvamentos         AS "salvamentos",
      m.seguidores_ganhos   AS "seguidoresGanhos"
    FROM metricas m
    JOIN publicacoes p ON p.id = m.publicacao_id
    JOIN conteudos c   ON c.id = p.conteudo_id
    LEFT JOIN pilares pil ON pil.id = c.pilar_id
    ORDER BY m.publicacao_id, m.coletado_em DESC, m.created_at DESC
  `);
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    publicacaoId: String(r.publicacaoId),
    conteudoId: String(r.conteudoId),
    titulo: String(r.titulo),
    formato: String(r.formato),
    plataforma: String(r.plataforma),
    pilarNome: r.pilarNome ? String(r.pilarNome) : null,
    pilarCor: r.pilarCor ? String(r.pilarCor) : null,
    publicadoEm: r.publicadoEm ? String(r.publicadoEm) : null,
    coletadoEm: String(r.coletadoEm),
    views: Number(r.views ?? 0),
    retencaoMedia: r.retencaoMedia !== null ? Number(r.retencaoMedia) : null,
    tempoMedioSeg: r.tempoMedioSeg !== null ? Number(r.tempoMedioSeg) : null,
    likes: Number(r.likes ?? 0),
    comentarios: Number(r.comentarios ?? 0),
    compartilhamentos: Number(r.compartilhamentos ?? 0),
    salvamentos: Number(r.salvamentos ?? 0),
    seguidoresGanhos: Number(r.seguidoresGanhos ?? 0),
  }));
}

function dentroDeDias(publicadoEm: string | null, dias: number): boolean {
  if (!publicadoEm) return false;
  const d = new Date(publicadoEm + "T00:00:00");
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);
  return d >= limite;
}

export interface DashboardData {
  videos: VideoMetrica[];
  totalVideos: number;
  totais: { views: number; seguidores: number; compart: number };
  melhoresRetencao90: VideoMetrica[];
  melhoresCompart: VideoMetrica[];
  melhoresSeguidores: VideoMetrica[];
  porPilar: { pilar: string; cor: string; videos: number; views: number; retencaoMedia: number; seguidores: number }[];
  evolucao: { mes: string; views: number; retencaoMedia: number; videos: number }[];
}

export async function dashboard(): Promise<DashboardData> {
  const videos = await ultimosSnapshots();

  const totais = videos.reduce(
    (acc, v) => {
      acc.views += v.views;
      acc.seguidores += v.seguidoresGanhos;
      acc.compart += v.compartilhamentos;
      return acc;
    },
    { views: 0, seguidores: 0, compart: 0 },
  );

  const melhoresRetencao90 = [...videos]
    .filter((v) => dentroDeDias(v.publicadoEm, 90) && v.retencaoMedia !== null)
    .sort((a, b) => (b.retencaoMedia ?? 0) - (a.retencaoMedia ?? 0))
    .slice(0, 5);

  const melhoresCompart = [...videos].sort((a, b) => b.compartilhamentos - a.compartilhamentos).slice(0, 5);
  const melhoresSeguidores = [...videos].sort((a, b) => b.seguidoresGanhos - a.seguidoresGanhos).slice(0, 5);

  // por pilar
  const mapaPilar = new Map<string, { cor: string; videos: number; views: number; retSoma: number; retN: number; seguidores: number }>();
  for (const v of videos) {
    const nome = v.pilarNome ?? "Sem pilar";
    const cur = mapaPilar.get(nome) ?? { cor: v.pilarCor ?? "#94a3b8", videos: 0, views: 0, retSoma: 0, retN: 0, seguidores: 0 };
    cur.videos += 1;
    cur.views += v.views;
    cur.seguidores += v.seguidoresGanhos;
    if (v.retencaoMedia !== null) {
      cur.retSoma += v.retencaoMedia;
      cur.retN += 1;
    }
    mapaPilar.set(nome, cur);
  }
  const porPilar = [...mapaPilar.entries()]
    .map(([pilar, d]) => ({
      pilar,
      cor: d.cor,
      videos: d.videos,
      views: d.views,
      retencaoMedia: d.retN ? Math.round((d.retSoma / d.retN) * 10) / 10 : 0,
      seguidores: d.seguidores,
    }))
    .sort((a, b) => b.views - a.views);

  // evolução mês a mês (por mês de publicação)
  const mapaMes = new Map<string, { views: number; retSoma: number; retN: number; videos: number }>();
  for (const v of videos) {
    if (!v.publicadoEm) continue;
    const mes = v.publicadoEm.slice(0, 7); // YYYY-MM
    const cur = mapaMes.get(mes) ?? { views: 0, retSoma: 0, retN: 0, videos: 0 };
    cur.views += v.views;
    cur.videos += 1;
    if (v.retencaoMedia !== null) {
      cur.retSoma += v.retencaoMedia;
      cur.retN += 1;
    }
    mapaMes.set(mes, cur);
  }
  const evolucao = [...mapaMes.entries()]
    .map(([mes, d]) => ({
      mes,
      views: d.views,
      retencaoMedia: d.retN ? Math.round((d.retSoma / d.retN) * 10) / 10 : 0,
      videos: d.videos,
    }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    videos,
    totalVideos: videos.length,
    totais,
    melhoresRetencao90,
    melhoresCompart,
    melhoresSeguidores,
    porPilar,
    evolucao,
  };
}

/** Vídeos com métricas (para o gate da IA: precisa de >= 5). */
export async function contarVideosComMetricas(): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(DISTINCT m.publicacao_id) AS n FROM metricas m
  `);
  const arr = rows as unknown as { n: string | number }[];
  return Number(arr[0]?.n ?? 0);
}

/** Top vídeos para alimentar a IA (título, gancho, pilar, formato, métricas). */
export async function topVideosParaIa(limite = 10) {
  const videos = await ultimosSnapshots();
  const ordenados = [...videos]
    .sort((a, b) => (b.retencaoMedia ?? 0) - (a.retencaoMedia ?? 0) || b.views - a.views)
    .slice(0, limite);

  // busca o gancho da última versão de roteiro de cada conteúdo
  const resultado = [];
  for (const v of ordenados) {
    const roteiro = await db.execute(sql`
      SELECT blocos->>'gancho' AS gancho FROM roteiros
      WHERE conteudo_id = ${v.conteudoId}
      ORDER BY versao DESC LIMIT 1
    `);
    const g = (roteiro as unknown as { gancho: string | null }[])[0]?.gancho ?? null;
    resultado.push({
      titulo: v.titulo,
      gancho: g,
      pilar: v.pilarNome,
      formato: v.formato,
      plataforma: v.plataforma,
      metricas: {
        views: v.views,
        retencaoMedia: v.retencaoMedia,
        tempoMedioSeg: v.tempoMedioSeg,
        likes: v.likes,
        comentarios: v.comentarios,
        compartilhamentos: v.compartilhamentos,
        salvamentos: v.salvamentos,
        seguidoresGanhos: v.seguidoresGanhos,
      },
    });
  }
  return resultado;
}
