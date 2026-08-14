import Papa from "papaparse";
import type { PlataformaValue } from "./constants";

/**
 * Camada de integração por plataforma com contrato comum.
 * No MVP, a fonte é o CSV exportado nativamente por cada plataforma.
 * Na Fase 2, os mesmos adapters ganham fetchVideos/fetchMetrics (sync automático)
 * mantendo o MESMO formato normalizado — o resto do app não muda.
 */

export interface NormalizedRow {
  idExterno?: string | null;
  titulo: string;
  url?: string | null;
  publicadoEm?: string | null; // ISO date
  views: number;
  retencaoMedia?: number | null; // %
  tempoMedioSeg?: number | null;
  likes: number;
  comentarios: number;
  compartilhamentos: number;
  salvamentos: number;
  seguidoresGanhos: number;
}

export interface NormalizedVideo {
  idExterno: string;
  titulo: string;
  url?: string;
  publicadoEm?: string;
}

export interface PlatformAdapter {
  plataforma: PlataformaValue;
  label: string;
  /** MVP: importação manual via CSV nativo. */
  parseCsv(csv: string): { rows: NormalizedRow[]; erros: string[] };
  /** Fase 2 (sync automático) — mesmo contrato, ainda não implementado. */
  fetchVideos?(): Promise<NormalizedVideo[]>;
  fetchMetrics?(idExterno: string): Promise<NormalizedRow>;
}

// ---- helpers ----
function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/[.\s]/g, "").replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : 0;
}
function pct(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
/** "mm:ss" ou segundos → segundos. */
function toSeg(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  if (s.includes(":")) {
    const parts = s.split(":").map((x) => parseInt(x, 10) || 0);
    return parts.reduce((acc, p) => acc * 60 + p, 0);
  }
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : null;
}

type Registro = Record<string, string>;

/** Busca um valor por qualquer um dos nomes de coluna (case-insensitive). */
function pick(row: Registro, aliases: string[]): string | undefined {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) lower[k.trim().toLowerCase()] = v;
  for (const a of aliases) {
    const v = lower[a.toLowerCase()];
    if (v !== undefined && v !== "") return v;
  }
  return undefined;
}

/** Mapeamento canônico → possíveis cabeçalhos por plataforma. */
type ColMap = {
  idExterno: string[];
  titulo: string[];
  publicadoEm: string[];
  views: string[];
  retencao: string[];
  tempoMedio: string[];
  likes: string[];
  comentarios: string[];
  compartilhamentos: string[];
  salvamentos: string[];
  seguidores: string[];
};

function buildParser(plataforma: PlataformaValue, label: string, map: ColMap): PlatformAdapter {
  return {
    plataforma,
    label,
    parseCsv(csv: string) {
      const erros: string[] = [];
      const parsed = Papa.parse<Registro>(csv, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      });
      if (parsed.errors.length) {
        for (const e of parsed.errors.slice(0, 3)) erros.push(`Linha ${e.row}: ${e.message}`);
      }
      // Linhas-resumo que alguns exports incluem (ignorar).
      const RESUMO = new Set(["total", "totais", "total geral", "grand total", "overall"]);
      const rows: NormalizedRow[] = [];
      for (const r of parsed.data) {
        const idBruto = pick(r, map.idExterno);
        const titulo = pick(r, map.titulo) ?? idBruto;
        if (!titulo) continue; // linha sem identificação, ignora
        // ignora linha de totais (ex.: YouTube exporta uma linha "Total")
        if (RESUMO.has(titulo.trim().toLowerCase()) || (idBruto && RESUMO.has(idBruto.trim().toLowerCase())))
          continue;
        rows.push({
          idExterno: pick(r, map.idExterno) ?? null,
          titulo,
          publicadoEm: pick(r, map.publicadoEm) ?? null,
          views: num(pick(r, map.views)),
          retencaoMedia: pct(pick(r, map.retencao)),
          tempoMedioSeg: toSeg(pick(r, map.tempoMedio)),
          likes: num(pick(r, map.likes)),
          comentarios: num(pick(r, map.comentarios)),
          compartilhamentos: num(pick(r, map.compartilhamentos)),
          salvamentos: num(pick(r, map.salvamentos)),
          seguidoresGanhos: num(pick(r, map.seguidores)),
        });
      }
      return { rows, erros };
    },
  };
}

export const adapters: Record<PlataformaValue, PlatformAdapter> = {
  youtube: buildParser("youtube", "YouTube", {
    idExterno: ["Content", "Video", "Video ID", "ID do vídeo", "Conteúdo"],
    titulo: ["Video title", "Título do vídeo", "Título"],
    publicadoEm: ["Video publish time", "Horário de publicação do vídeo", "Data de publicação"],
    views: ["Views", "Visualizações"],
    retencao: ["Average percentage viewed (%)", "Porcentagem média assistida (%)", "Average view percentage"],
    tempoMedio: ["Average view duration", "Duração média da visualização"],
    likes: ["Likes", "Curtidas"],
    comentarios: ["Comments added", "Comentários", "Comentários adicionados"],
    compartilhamentos: ["Shares", "Compartilhamentos"],
    salvamentos: ["Saves", "Salvamentos", "Adicionados a playlists", "Videos added to playlists"],
    seguidores: ["Subscribers", "Inscritos", "Subscribers gained", "Inscritos ganhos"],
  }),
  instagram: buildParser("instagram", "Instagram", {
    idExterno: ["Post ID", "ID", "ID da publicação", "Permalink"],
    titulo: ["Description", "Legenda", "Caption", "Título"],
    publicadoEm: ["Publish time", "Data de publicação", "Time"],
    views: ["Views", "Plays", "Reproduções", "Visualizações", "Reach", "Alcance"],
    retencao: ["Average watch percentage", "Retenção média", "Retention"],
    tempoMedio: ["Average watch time", "Tempo médio assistido", "Avg watch time"],
    likes: ["Likes", "Curtidas"],
    comentarios: ["Comments", "Comentários"],
    compartilhamentos: ["Shares", "Compartilhamentos"],
    salvamentos: ["Saves", "Salvamentos", "Salvos"],
    seguidores: ["Follows", "Seguidores", "Seguidores ganhos", "Follows from post"],
  }),
  tiktok: buildParser("tiktok", "TikTok", {
    idExterno: ["Video ID", "ID do vídeo", "ID"],
    titulo: ["Video title", "Título", "Caption", "Descrição"],
    publicadoEm: ["Post time", "Data de publicação", "Publish time"],
    views: ["Video views", "Visualizações do vídeo", "Views", "Visualizações"],
    retencao: ["Average watch time %", "Retenção média", "Retention"],
    tempoMedio: ["Average watch time", "Tempo médio assistido"],
    likes: ["Likes", "Curtidas"],
    comentarios: ["Comments", "Comentários"],
    compartilhamentos: ["Shares", "Compartilhamentos"],
    salvamentos: ["Saves", "Salvamentos", "Favoritos", "Favorites"],
    seguidores: ["New followers", "Novos seguidores", "Seguidores ganhos"],
  }),
};
