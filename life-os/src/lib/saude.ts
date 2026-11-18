// HEALTH CENTER — catálogo e regras PURAS (tests/unit/saude.test.ts). Sem banco nem DOM.
// Organiza registros; não interpreta sintomas nem faz diagnóstico.
import type { ChaveDia } from "./datas";
import { comparaGrupos, DISPOSICAO, type Checkin } from "./checkin";

export const TIPOS_SAUDE = ["consulta", "vacina", "exame", "medicamento", "orientacao", "alergia", "lesao", "dor", "sintoma"] as const;
export type TipoSaude = (typeof TIPOS_SAUDE)[number];

export function tipoValido(t: string): t is TipoSaude {
  return (TIPOS_SAUDE as readonly string[]).includes(t);
}

export type CampoSaude = "titulo" | "dia" | "hora" | "diaFim" | "profissional" | "detalhes" | "dose" | "proximo" | "intensidade" | "parteCorpo" | "status";

export interface DefTipo {
  nome: string; // singular
  plural: string;
  /** Rótulo de cada campo usado por este tipo (os outros não aparecem). */
  campos: Partial<Record<CampoSaude, string>>;
  /** Aceita data no futuro (agendado). */
  futuro?: boolean;
  /** Tem status ativo/encerrado. */
  status?: [string, string];
}

export const DEF_TIPOS: Record<TipoSaude, DefTipo> = {
  consulta: {
    nome: "Consulta",
    plural: "Consultas",
    futuro: true,
    campos: {
      titulo: "Especialidade ou motivo",
      dia: "Data",
      hora: "Horário",
      profissional: "Profissional ou local",
      detalhes: "Orientações recebidas",
      proximo: "Retorno",
    },
  },
  vacina: {
    nome: "Vacina",
    plural: "Vacinas",
    campos: { titulo: "Vacina", dose: "Dose (1ª, 2ª, reforço…)", dia: "Data da dose", profissional: "Local", proximo: "Próxima dose", detalhes: "Observações" },
  },
  exame: {
    nome: "Exame",
    plural: "Exames",
    futuro: true,
    campos: { titulo: "Exame", dia: "Data", profissional: "Laboratório ou local", detalhes: "Resultado" },
  },
  medicamento: {
    nome: "Medicamento",
    plural: "Medicamentos prescritos",
    status: ["Em uso", "Encerrado"],
    campos: {
      titulo: "Medicamento",
      dose: "Dose e frequência (como prescrito)",
      profissional: "Quem prescreveu",
      dia: "Início",
      diaFim: "Fim",
      detalhes: "Observações",
      status: "Situação",
    },
  },
  orientacao: {
    nome: "Orientação médica",
    plural: "Orientações médicas",
    status: ["Em acompanhamento", "Concluída"],
    campos: { titulo: "Orientação", profissional: "De quem", dia: "Desde", diaFim: "Até", detalhes: "Detalhes", status: "Situação" },
  },
  alergia: {
    nome: "Alergia",
    plural: "Alergias conhecidas",
    status: ["Ativa", "Superada"],
    campos: { titulo: "Alergia a", detalhes: "Reação e cuidados", dia: "Desde", status: "Situação" },
  },
  lesao: {
    nome: "Lesão",
    plural: "Lesões",
    status: ["Em recuperação", "Recuperada"],
    campos: {
      titulo: "Lesão",
      parteCorpo: "Parte do corpo",
      dia: "Início",
      diaFim: "Recuperada em",
      profissional: "Quem acompanhou",
      detalhes: "Histórico e tratamento",
      status: "Situação",
    },
  },
  dor: {
    nome: "Dor ou desconforto",
    plural: "Dores e desconfortos",
    campos: { titulo: "O que sentiu", parteCorpo: "Parte do corpo", intensidade: "Intensidade (0 a 10)", dia: "Data", detalhes: "Observações" },
  },
  sintoma: {
    nome: "Sintoma",
    plural: "Sintomas",
    campos: { titulo: "Sintoma", intensidade: "Intensidade (0 a 10)", dia: "Início", diaFim: "Fim", detalhes: "Observações" },
  },
};

export const ABAS_SAUDE = [
  { aba: "resumo", nome: "Resumo", tipos: [] as TipoSaude[] },
  { aba: "consultas", nome: "Consultas", tipos: ["consulta"] as TipoSaude[] },
  { aba: "vacinas", nome: "Vacinas", tipos: ["vacina"] as TipoSaude[] },
  { aba: "exames", nome: "Exames", tipos: ["exame"] as TipoSaude[] },
  { aba: "medicamentos", nome: "Medicamentos e orientações", tipos: ["medicamento", "orientacao"] as TipoSaude[] },
  { aba: "alergias", nome: "Alergias", tipos: ["alergia"] as TipoSaude[] },
  { aba: "lesoes", nome: "Lesões e dores", tipos: ["lesao", "dor"] as TipoSaude[] },
  { aba: "sintomas", nome: "Sintomas", tipos: ["sintoma"] as TipoSaude[] },
  { aba: "diario", nome: "Diário de saúde", tipos: [] as TipoSaude[] },
  { aba: "emergencia", nome: "Emergência", tipos: [] as TipoSaude[] },
] as const;

export type AbaSaude = (typeof ABAS_SAUDE)[number]["aba"];

export const TIPOS_SANGUINEOS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"] as const;

export const AVISO_SAUDE =
  "O LIFE OS mostra padrões dos seus registros; não faz diagnóstico. Em caso de dúvida, procure um profissional de saúde.";

// ───── Documentos ─────

export const ARQUIVO_MAX_BYTES = 5 * 1024 * 1024;

export const TIPOS_ARQUIVO: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WEBP",
};

/** Tipo real do arquivo pela assinatura dos primeiros bytes (não confia no nome nem no navegador). */
export function tipoPeloConteudo(b: Uint8Array): string | null {
  const ini = (...xs: number[]) => xs.every((x, i) => b[i] === x);
  if (b.length >= 5 && ini(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf"; // %PDF-
  if (b.length >= 8 && ini(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (b.length >= 3 && ini(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (
    b.length >= 12 &&
    ini(0x52, 0x49, 0x46, 0x46) && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  )
    return "image/webp";
  return null;
}

const EXTENSAO: Record<string, string> = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Nome seguro para guardar e baixar: sem pastas, controles nem aspas; extensão do tipo real. */
export function nomeSeguro(nome: string, mime: string): string {
  const base = (nome.split(/[\\/]/).pop() ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|*?:]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.[A-Za-z0-9]{1,5}$/, "")
    .slice(0, 100);
  return `${base || "documento"}.${EXTENSAO[mime] ?? "bin"}`;
}

/** Cabeçalho Content-Disposition com nome ASCII de reserva e o nome real em UTF-8 (RFC 6266/5987). */
export function contentDisposition(nome: string, inline = false): string {
  const ascii = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

// ───── Emergência ─────

export interface Contato {
  nome: string;
  relacao: string;
  telefone: string;
}

/** Lê os contatos guardados (JSON) sem confiar no formato. */
export function lerContatos(v: unknown): Contato[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
    .map((c) => ({ nome: String(c.nome ?? "").slice(0, 80), relacao: String(c.relacao ?? "").slice(0, 60), telefone: String(c.telefone ?? "").slice(0, 30) }))
    .filter((c) => c.nome || c.telefone);
}

/** Telefone para link tel: (só dígitos e um + no começo). */
export function linkTelefone(tel: string): string | null {
  const limpo = tel.trim().replace(/(?!^\+)[^\d]/g, "");
  return /\d{3,}/.test(limpo) ? `tel:${limpo}` : null;
}

// ───── Diário de saúde ─────

export interface DiaDiario {
  dia: ChaveDia;
  checkin: Checkin | null;
  sonoMin: number | null;
  atividades: string[];
}

/** O dia no formato do plano: "Energia: 8/10 · Disposição: Boa · Sono: 8 h · Atividade física: Futebol · Observações: …". */
export function linhaDiario(d: DiaDiario, formatarSono: (min: number | null) => string): string[] {
  const c = d.checkin;
  return [
    `Energia: ${c?.energia != null ? `${c.energia}/10` : "—"}`,
    `Disposição: ${c?.disposicao != null ? DISPOSICAO[c.disposicao] : "—"}`,
    `Sono: ${d.sonoMin != null ? formatarSono(d.sonoMin) : "—"}`,
    `Atividade física: ${d.atividades.length ? d.atividades.join(", ") : "—"}`,
    ...(c?.notas ? [`Observações: ${c.notas}`] : []),
  ];
}

/** Energia média em dias com atividade física (a) × sem (b). Só com ≥ 3 dias de cada lado. */
export function energiaEAtividade(dias: DiaDiario[]) {
  return comparaGrupos(dias.map((d) => ({ grupo: d.atividades.length ? ("a" as const) : ("b" as const), valor: d.checkin?.energia ?? null })));
}

// ───── Atividades (só leitura da tabela do Fitness Center) ─────

const NOMES_ATIVIDADE: Record<string, string> = {
  musculacao: "Musculação",
  futebol: "Futebol",
  cardio: "Cardio",
  caminhada: "Caminhada",
  corrida: "Corrida",
  bicicleta: "Bicicleta",
  esteira: "Esteira",
  natacao: "Natação",
};

export function nomeAtividade(kind: string, subtype: string | null): string {
  if (kind === "cardio" && subtype && NOMES_ATIVIDADE[subtype]) return NOMES_ATIVIDADE[subtype];
  return NOMES_ATIVIDADE[kind] ?? "Atividade";
}

// ───── Resumo ─────

export interface RegistroResumo {
  id: string;
  tipo: string;
  titulo: string;
  dia: ChaveDia;
  proximo: ChaveDia | null;
  status: string;
}

/** Próximas doses de vacina (a partir de hoje), mais cedo primeiro. */
export function proximasDoses(regs: RegistroResumo[], hojeK: ChaveDia): RegistroResumo[] {
  return regs
    .filter((r) => r.tipo === "vacina" && r.proximo !== null && r.proximo >= hojeK)
    .sort((a, b) => (a.proximo! < b.proximo! ? -1 : a.proximo! > b.proximo! ? 1 : 0));
}

/** Retornos de consulta marcados a partir de hoje. */
export function proximosRetornos(regs: RegistroResumo[], hojeK: ChaveDia): RegistroResumo[] {
  return regs
    .filter((r) => r.tipo === "consulta" && r.proximo !== null && r.proximo >= hojeK)
    .sort((a, b) => (a.proximo! < b.proximo! ? -1 : 1));
}
