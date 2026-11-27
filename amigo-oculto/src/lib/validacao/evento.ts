/**
 * Esquema ÚNICO do amigo oculto (criar e editar), usado no navegador (validação por campo no assistente) e no servidor
 * (Server Actions). Puro: sem banco, sem DOM.
 *
 * Regras:
 *  - nome de 3 a 80 caracteres;
 *  - datas no futuro (na edição, uma data que não mudou pode ficar no passado);
 *  - prazo de entrada ≤ data do sorteio ≤ revelação, quando existirem;
 *  - valor mínimo ≤ máximo;
 *  - sorteio agendado exige a data do sorteio;
 *  - limite de participantes entre 3 e 1000 (e, na edição, nunca abaixo de quantos já estão no grupo).
 */
import { z } from "zod";
import { deInputLocal, paraInputLocal } from "@/lib/formatos";

export const TEMAS_EVENTO = ["natal", "aniversario", "classico", "corporativo"] as const;
export type TemaEvento = (typeof TEMAS_EVENTO)[number];

export const LIMITES = {
  nomeMin: 3,
  nomeMax: 80,
  descricao: 2000,
  local: 200,
  regras: 4000,
  participantesMin: 3,
  participantesMax: 1000,
  valorMax: 100_000,
} as const;

/** Campos que o banco trava depois do sorteio (trigger events_before_update). */
export const CAMPOS_TRAVADOS_APOS_SORTEIO = ["limite", "prazoEntrada", "sorteioEm", "modoSorteio", "aprovacao"] as const;

/** Quais campos aparecem em cada etapa do assistente (para validar e para levar a pessoa ao campo com erro). */
export const CAMPOS_POR_ETAPA = {
  basico: ["nome", "descricao", "capa", "tema"],
  quando: ["revelacaoEm", "local"],
  presentes: ["valorMinimo", "valorMaximo"],
  participacao: ["limite", "prazoEntrada", "sorteioEm", "modoSorteio", "visibilidade", "aprovacao"],
  regras: ["regras"],
} as const satisfies Record<string, readonly (keyof DadosEvento)[]>;

export type EtapaComCampos = keyof typeof CAMPOS_POR_ETAPA;

/** "R$ 1.234,56", "50", "50.5", 50 → número; vazio → null; texto que não é número → NaN (vira erro de campo). */
export function lerValor(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : Number.NaN;
  if (typeof v !== "string") return Number.NaN;
  let t = v.replace(/R\$/gi, "").replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, ""); // 1.000 = mil
  if (!/^\d+(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

const texto = (max: number, mensagem: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null ? null : typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : v),
    z.string(mensagem).max(max, mensagem).nullable(),
  );

const data = (mensagem: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? null : v),
    z
      .string(mensagem)
      .nullable()
      .refine((v) => v === null || !Number.isNaN(Date.parse(v)), mensagem)
      .transform((v) => (v === null ? null : new Date(v).toISOString())),
  );

const dinheiro = z.preprocess(
  (v) => lerValor(v),
  z
    .number("Digite um valor em reais, por exemplo 50 ou 49,90.")
    .refine((n) => Number.isFinite(n), "Digite um valor em reais, por exemplo 50 ou 49,90.")
    .refine((n) => n >= 0, "O valor não pode ser negativo.")
    .refine((n) => n <= LIMITES.valorMax, "Use um valor de até R$ 100.000.")
    .transform((n) => Math.round(n * 100) / 100)
    .nullable(),
);

const limite = z.preprocess(
  (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === "string") {
      const t = v.trim();
      if (t === "") return null;
      return /^\d+$/.test(t) ? Number(t) : Number.NaN;
    }
    return v;
  },
  z
    .number("Digite um número inteiro de pessoas.")
    .refine((n) => Number.isInteger(n), "Digite um número inteiro de pessoas.")
    .refine((n) => n >= LIMITES.participantesMin, `O limite mínimo é de ${LIMITES.participantesMin} pessoas.`)
    .refine((n) => n <= LIMITES.participantesMax, `O limite máximo é de ${LIMITES.participantesMax} pessoas.`)
    .nullable(),
);

const booleano = z.preprocess((v) => v === true || v === "true" || v === "1" || v === "on", z.boolean());

const base = z.object({
  nome: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : v),
    z
      .string("Dê um nome ao amigo oculto.")
      .min(LIMITES.nomeMin, `O nome precisa de pelo menos ${LIMITES.nomeMin} letras.`)
      .max(LIMITES.nomeMax, `Use até ${LIMITES.nomeMax} caracteres no nome.`),
  ),
  descricao: texto(LIMITES.descricao, `Use até ${LIMITES.descricao} caracteres na descrição.`),
  capa: texto(500, "Foto de capa inválida."),
  tema: z.enum(TEMAS_EVENTO, "Escolha um tema."),
  revelacaoEm: data("Data e horário da revelação inválidos."),
  local: texto(LIMITES.local, `Use até ${LIMITES.local} caracteres no local.`),
  valorMinimo: dinheiro,
  valorMaximo: dinheiro,
  limite,
  regras: texto(LIMITES.regras, `Use até ${LIMITES.regras} caracteres nas regras.`),
  prazoEntrada: data("Prazo de entrada inválido."),
  sorteioEm: data("Data do sorteio inválida."),
  modoSorteio: z.enum(["manual", "scheduled"], "Escolha como será o sorteio."),
  visibilidade: z.enum(["private", "public"], "Escolha se o grupo é público ou privado."),
  aprovacao: booleano,
});

export type DadosEvento = z.output<typeof base>;
export type EntradaEvento = z.input<typeof base>;

export interface OpcoesValidacao {
  /** "agora" das comparações (testes) */
  agora?: Date;
  /** Na edição: as datas já gravadas. Uma data igual à original não precisa estar no futuro. */
  original?: { revelacaoEm?: string | null; prazoEntrada?: string | null; sorteioEm?: string | null };
  /** Na edição: quantas pessoas já estão no grupo (aprovadas + pendentes); o limite não pode ficar abaixo. */
  ocupados?: number;
}

const FOLGA_MS = 60_000; // um minuto de folga (relógios e o tempo de preencher)

function mesmoInstante(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  return Math.abs(Date.parse(a) - Date.parse(b)) < 1000;
}

/** Regras que cruzam campos (datas e valores). Devolve [campo, mensagem]. */
export function conferirRegrasCruzadas(d: DadosEvento, opcoes: OpcoesValidacao = {}): [keyof DadosEvento, string][] {
  const erros: [keyof DadosEvento, string][] = [];
  const agora = (opcoes.agora ?? new Date()).getTime();
  const original = opcoes.original ?? {};
  const futura = (campo: "revelacaoEm" | "prazoEntrada" | "sorteioEm", mensagem: string) => {
    const v = d[campo];
    if (!v || mesmoInstante(v, original[campo])) return;
    if (Date.parse(v) < agora - FOLGA_MS) erros.push([campo, mensagem]);
  };
  futura("revelacaoEm", "A revelação precisa ser numa data futura.");
  futura("prazoEntrada", "O prazo de entrada precisa ser numa data futura.");
  futura("sorteioEm", "Escolha uma data de sorteio no futuro.");

  if (d.modoSorteio === "scheduled" && !d.sorteioEm) erros.push(["sorteioEm", "Escolha a data e o horário do sorteio agendado."]);

  const t = (v: string | null) => (v ? Date.parse(v) : null);
  const prazo = t(d.prazoEntrada);
  const sorteio = t(d.sorteioEm);
  const revelacao = t(d.revelacaoEm);
  if (prazo !== null && sorteio !== null && prazo > sorteio) {
    erros.push(["prazoEntrada", "O prazo de entrada precisa terminar até a data do sorteio."]);
  } else if (prazo !== null && revelacao !== null && prazo > revelacao) {
    erros.push(["prazoEntrada", "O prazo de entrada precisa terminar antes da revelação."]);
  }
  if (sorteio !== null && revelacao !== null && sorteio > revelacao) {
    erros.push(["sorteioEm", "O sorteio precisa acontecer antes da revelação."]);
  }

  if (d.valorMinimo !== null && d.valorMaximo !== null && d.valorMinimo > d.valorMaximo) {
    erros.push(["valorMaximo", "O valor máximo precisa ser maior ou igual ao mínimo."]);
  }
  if (d.limite !== null && opcoes.ocupados !== undefined && d.limite < opcoes.ocupados) {
    erros.push(["limite", `O grupo já tem ${opcoes.ocupados} pessoas: o limite não pode ser menor.`]);
  }
  return erros;
}

/** O esquema completo (criar e editar). */
export function esquemaEvento(opcoes: OpcoesValidacao = {}) {
  return base.superRefine((d, ctx) => {
    for (const [campo, mensagem] of conferirRegrasCruzadas(d, opcoes)) ctx.addIssue({ code: "custom", path: [campo], message: mensagem });
  });
}

/** Todos os erros por campo (primeira mensagem de cada); objeto vazio = tudo certo. */
export function errosDoEvento(entrada: unknown, opcoes: OpcoesValidacao = {}): Partial<Record<keyof DadosEvento | "_", string>> {
  const r = esquemaEvento(opcoes).safeParse(entrada);
  if (r.success) return {};
  const erros: Partial<Record<keyof DadosEvento | "_", string>> = {};
  for (const i of r.error.issues) {
    const campo = (i.path[0] as keyof DadosEvento | undefined) ?? "_";
    if (!erros[campo]) erros[campo] = i.message;
  }
  return erros;
}

/** Em que etapa do assistente fica um campo (para levar a pessoa até o erro). */
export function etapaDoCampo(campo: string): EtapaComCampos | null {
  for (const [etapa, campos] of Object.entries(CAMPOS_POR_ETAPA) as [EtapaComCampos, readonly string[]][]) {
    if (campos.includes(campo)) return etapa;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Rascunho do formulário (o que a tela guarda: datas como "AAAA-MM-DDTHH:MM" no horário de São Paulo, valores como texto)
// ---------------------------------------------------------------------------------------------------------------------
export interface RascunhoEvento {
  nome: string;
  descricao: string;
  capa: string | null;
  tema: TemaEvento;
  revelacaoEm: string;
  local: string;
  valorMinimo: string;
  valorMaximo: string;
  limite: string;
  regras: string;
  prazoEntrada: string;
  sorteioEm: string;
  modoSorteio: "manual" | "scheduled";
  visibilidade: "private" | "public";
  aprovacao: boolean;
}

export const RASCUNHO_VAZIO: RascunhoEvento = {
  nome: "",
  descricao: "",
  capa: null,
  tema: "natal",
  revelacaoEm: "",
  local: "",
  valorMinimo: "",
  valorMaximo: "",
  limite: "",
  regras: "",
  prazoEntrada: "",
  sorteioEm: "",
  modoSorteio: "manual",
  visibilidade: "private",
  aprovacao: false,
};

/** Rascunho da tela → entrada do esquema (datas locais → ISO UTC). */
export function rascunhoParaEntrada(r: RascunhoEvento): EntradaEvento {
  const dataOuTexto = (v: string) => (v ? (deInputLocal(v) ?? v) : null);
  return {
    nome: r.nome,
    descricao: r.descricao,
    capa: r.capa,
    tema: r.tema,
    revelacaoEm: dataOuTexto(r.revelacaoEm),
    local: r.local,
    valorMinimo: r.valorMinimo,
    valorMaximo: r.valorMaximo,
    limite: r.limite,
    regras: r.regras,
    prazoEntrada: dataOuTexto(r.prazoEntrada),
    sorteioEm: dataOuTexto(r.sorteioEm),
    modoSorteio: r.modoSorteio,
    visibilidade: r.visibilidade,
    aprovacao: r.aprovacao,
  };
}

type LinhaEvento = {
  name: string;
  description: string | null;
  cover_path: string | null;
  theme: string;
  reveal_at: string | null;
  location: string | null;
  gift_min: number | null;
  gift_max: number | null;
  max_participants: number | null;
  rules: string | null;
  join_deadline: string | null;
  draw_at: string | null;
  draw_mode: "manual" | "scheduled";
  visibility: "private" | "public";
  requires_approval: boolean;
};

const valorParaTexto = (v: number | null) => (v === null || v === undefined ? "" : String(Number(v)).replace(".", ","));

/** Linha do banco → rascunho (para a edição). */
export function eventoParaRascunho(e: LinhaEvento): RascunhoEvento {
  return {
    nome: e.name,
    descricao: e.description ?? "",
    capa: e.cover_path,
    tema: (TEMAS_EVENTO as readonly string[]).includes(e.theme) ? (e.theme as TemaEvento) : "natal",
    revelacaoEm: paraInputLocal(e.reveal_at),
    local: e.location ?? "",
    valorMinimo: valorParaTexto(e.gift_min),
    valorMaximo: valorParaTexto(e.gift_max),
    limite: e.max_participants ? String(e.max_participants) : "",
    regras: e.rules ?? "",
    prazoEntrada: paraInputLocal(e.join_deadline),
    sorteioEm: paraInputLocal(e.draw_at),
    modoSorteio: e.draw_mode,
    visibilidade: e.visibility,
    aprovacao: e.requires_approval,
  };
}

/** Argumentos da RPC create_event (o banco usa os padrões quando o campo vem vazio). */
export function argumentosCriarEvento(d: DadosEvento) {
  const ou = <T,>(v: T | null) => (v === null ? undefined : v);
  return {
    p_name: d.nome,
    p_description: ou(d.descricao),
    p_cover_path: ou(d.capa),
    p_theme: d.tema,
    p_reveal_at: ou(d.revelacaoEm),
    p_location: ou(d.local),
    p_gift_min: ou(d.valorMinimo),
    p_gift_max: ou(d.valorMaximo),
    p_max_participants: ou(d.limite),
    p_rules: ou(d.regras),
    p_join_deadline: ou(d.prazoEntrada),
    p_draw_at: ou(d.sorteioEm),
    p_draw_mode: d.modoSorteio,
    p_visibility: d.visibilidade,
    p_requires_approval: d.aprovacao,
  };
}

/**
 * Colunas para o UPDATE em events (só as liberadas para o organizador). Depois do sorteio, os campos travados ficam
 * de fora (o banco recusaria qualquer mudança neles).
 */
export function colunasDoEvento(d: DadosEvento, opcoes: { sorteado: boolean }) {
  const livres = {
    name: d.nome,
    description: d.descricao,
    cover_path: d.capa,
    theme: d.tema,
    reveal_at: d.revelacaoEm,
    location: d.local,
    gift_min: d.valorMinimo,
    gift_max: d.valorMaximo,
    rules: d.regras,
    visibility: d.visibilidade,
  };
  if (opcoes.sorteado) return livres;
  return {
    ...livres,
    max_participants: d.limite,
    join_deadline: d.prazoEntrada,
    draw_at: d.sorteioEm,
    draw_mode: d.modoSorteio,
    requires_approval: d.aprovacao,
  };
}

/**
 * Depois do sorteio, os campos travados não são gravados (colunasDoEvento os deixa de fora): na validação eles viram
 * valores neutros, para que um valor antigo (ex.: a data do sorteio que já passou) não impeça salvar o resto.
 */
export function neutralizarTravados<T extends object>(entrada: T): T {
  return { ...entrada, limite: null, prazoEntrada: null, sorteioEm: null, modoSorteio: "manual", aprovacao: false };
}

/** Código de convite digitado → forma canônica (8 letras/números, maiúsculas) ou null. */
export function normalizarCodigo(v: string | null | undefined): string | null {
  const c = (v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z0-9]{8}$/.test(c) ? c : null;
}

export const esquemaNomeConvidado = z
  .string("Digite seu nome.")
  .trim()
  .min(2, "Digite seu nome (pelo menos 2 letras).")
  .max(60, "Use até 60 caracteres.");
