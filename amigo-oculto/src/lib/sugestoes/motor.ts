import { CATALOGO, type IdeiaPresente } from "@/lib/sugestoes/catalogo";
import { detectarEtiquetas, IMPLICA, motivoDaEtiqueta, type Etiqueta } from "@/lib/sugestoes/etiquetas";
import { normalizar, palavrasChave } from "@/lib/sugestoes/texto";
import { dinheiro } from "@/lib/formatos";

/**
 * Sugestões de presente: pontuação pura e determinística (mesma entrada → mesma saída, sem sorteio nem rede).
 * Olha os interesses e hobbies, a lista de desejos, as observações, as cores e os tamanhos da pessoa, respeita o que
 * ela disse que não quer e o orçamento do grupo (com uma pequena tolerância), e devolve as melhores ideias com os motivos.
 */

export type PerfilParaSugestao = {
  hobbies?: readonly string[] | null;
  interesses?: readonly string[] | null;
  cores?: readonly string[] | null;
  tamanhos?: { camiseta?: string | null; calca?: string | null; calcado?: string | null } | null;
  naoQuer?: readonly string[] | null;
  desejos?: readonly { titulo: string; notas?: string | null }[] | null;
  observacoes?: string | null;
};

export type Orcamento = { min?: number | string | null; max?: number | string | null } | null | undefined;

export type Sugestao = {
  id: string;
  titulo: string;
  descricao: string;
  /** faixa de preço sugerida (já recortada pelo orçamento quando ele existe) */
  faixa: { min: number; max: number };
  motivos: string[];
  pontos: number;
  versatil: boolean;
  etiquetas: Etiqueta[];
  /** "dentro": cabe no orçamento; "perto": um pouco acima/abaixo (tolerância); "livre": o grupo não definiu valor */
  orcamento: "dentro" | "perto" | "livre";
};

export type OpcoesSugestao = {
  quantidade?: number;
  /** quanto a faixa pode passar do orçamento (0,15 = 15%) */
  tolerancia?: number;
  catalogo?: readonly IdeiaPresente[];
};

export const PESOS = {
  interessePrincipal: 30,
  interesseSecundario: 22,
  interesseExtra: 8,
  observacao: 0.6, // multiplicador para o que veio das observações (texto livre)
  desejoPalavras: 22,
  desejoPalavras2: 30,
  desejoEtiqueta: 14,
  desejoPalavraSolta: 8,
  cor: 5,
  tamanho: 6,
  versatilSemPerfil: 24,
  versatilComPerfil: 3,
  orcamentoBase: 8,
  orcamentoEncaixe: 12,
  orcamentoPerto: 2,
  semOrcamento: 8,
  diversidade: 10,
} as const;

const NEGACAO = /\b(nao|nunca|odeia|odeio|detesta|detesto|evita|evito|alergia|alergica|alergico|intolerante|intolerancia|dispensa)\b/;

/** Separa as observações em trechos positivos ("adora café") e negativos ("não bebe álcool"). */
export function lerObservacoes(texto: string | null | undefined): { positivas: string[]; negativas: string[] } {
  const positivas: string[] = [];
  const negativas: string[] = [];
  if (!texto) return { positivas, negativas };
  for (const trecho of texto.split(/[.;!?\n,]+|\s+mas\s+|\s+por[eé]m\s+|\s+exceto\s+/i)) {
    const n = normalizar(trecho);
    if (!n) continue;
    (NEGACAO.test(n) ? negativas : positivas).push(trecho.trim());
  }
  return { positivas, negativas };
}

function numero(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function lerOrcamento(o: Orcamento): { min: number | null; max: number | null } {
  let min = numero(o?.min);
  let max = numero(o?.max);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  if (max === 0) max = null;
  return { min, max };
}

/** "de R$ 50 a R$ 100", "de até R$ 100", "a partir de R$ 50" */
export function descreverOrcamento(o: Orcamento): string | null {
  const { min, max } = lerOrcamento(o);
  const a = dinheiro(min);
  const b = dinheiro(max);
  if (a && b) return a === b ? `de ${a}` : `de ${a} a ${b}`;
  if (b) return `de até ${b}`;
  if (a) return `a partir de ${a}`;
  return null;
}

type AvaliacaoOrcamento =
  | { tipo: "livre"; pontos: number; faixa: [number, number] }
  | { tipo: "dentro" | "acima" | "abaixo"; pontos: number; faixa: [number, number] }
  | { tipo: "fora" };

export function avaliarOrcamento(preco: readonly [number, number], o: Orcamento, tolerancia = 0.15): AvaliacaoOrcamento {
  const [a, b] = preco;
  const { min, max } = lerOrcamento(o);
  if (min === null && max === null) return { tipo: "livre", pontos: PESOS.semOrcamento, faixa: [a, b] };
  const lo = min ?? 0;
  const hi = max ?? Number.POSITIVE_INFINITY;
  const ini = Math.max(a, lo);
  const fim = Math.min(b, hi);
  if (fim > ini || (fim === ini && a === b)) {
    const fracao = b > a ? (fim - ini) / (b - a) : 1;
    return { tipo: "dentro", pontos: PESOS.orcamentoBase + PESOS.orcamentoEncaixe * fracao, faixa: [ini, fim] };
  }
  const loT = lo * (1 - tolerancia);
  const hiT = hi * (1 + tolerancia);
  const iniT = Math.max(a, loT);
  const fimT = Math.min(b, hiT);
  if (fimT >= iniT) return { tipo: a >= hi ? "acima" : "abaixo", pontos: PESOS.orcamentoPerto, faixa: [iniT, fimT] };
  return { tipo: "fora" };
}

function etiquetasDa(ideia: IdeiaPresente): Etiqueta[] {
  const todas = [...ideia.etiquetas];
  for (const e of ideia.etiquetas) for (const extra of IMPLICA[e] ?? []) if (!todas.includes(extra)) todas.push(extra);
  if (ideia.tamanho === "roupa" && !todas.includes("vestuario")) todas.push("vestuario");
  if (ideia.tamanho === "calcado" && !todas.includes("calcados")) todas.push("calcados");
  return todas;
}

const limpar = (lista: readonly (string | null | undefined)[] | null | undefined) =>
  (lista ?? []).map((s) => (s ?? "").trim()).filter((s) => s.length > 0);

/** Arredonda para valores redondos de vitrine (múltiplos de 5). */
function redondo(v: number, para: "baixo" | "cima") {
  return para === "baixo" ? Math.floor(v / 5) * 5 : Math.ceil(v / 5) * 5;
}

export function sugerirPresentes(perfil: PerfilParaSugestao, orcamento: Orcamento, opcoes: OpcoesSugestao = {}): Sugestao[] {
  const quantidade = Math.max(0, Math.floor(opcoes.quantidade ?? 6));
  const tolerancia = opcoes.tolerancia ?? 0.15;
  const catalogo = opcoes.catalogo ?? CATALOGO;
  const descOrc = descreverOrcamento(orcamento);

  // 1) interesses: etiqueta → peso (o que a pessoa escreveu nos interesses e hobbies vale mais que as observações)
  const interesse = new Map<Etiqueta, number>();
  for (const t of [...limpar(perfil.interesses), ...limpar(perfil.hobbies)]) {
    for (const e of detectarEtiquetas(t)) interesse.set(e, 1);
  }
  const obs = lerObservacoes(perfil.observacoes);
  for (const t of obs.positivas) {
    for (const e of detectarEtiquetas(t)) if (!interesse.has(e)) interesse.set(e, PESOS.observacao);
  }

  // 2) o que a pessoa NÃO quer: etiquetas e palavras proibidas
  const naoQuer = [...limpar(perfil.naoQuer), ...obs.negativas];
  const etiquetasProibidas = new Set<Etiqueta>();
  const palavrasProibidas = new Set<string>();
  for (const t of naoQuer) {
    for (const e of detectarEtiquetas(t)) etiquetasProibidas.add(e);
    for (const p of palavrasChave(t)) palavrasProibidas.add(p);
  }
  for (const e of etiquetasProibidas) interesse.delete(e);

  // 3) lista de desejos
  const desejos = (perfil.desejos ?? [])
    .filter((d) => d && d.titulo && d.titulo.trim())
    .map((d) => ({
      titulo: d.titulo.trim(),
      etiquetas: detectarEtiquetas(`${d.titulo} ${d.notas ?? ""}`),
      palavras: new Set(palavrasChave(d.titulo)),
    }));

  const cores = limpar(perfil.cores);
  const tam = perfil.tamanhos ?? {};
  const tamRoupa = (tam.camiseta ?? "").trim() || (tam.calca ?? "").trim();
  const tamCalcado = (tam.calcado ?? "").trim();
  const temPerfil = interesse.size > 0 || desejos.some((d) => d.etiquetas.size > 0 || d.palavras.size > 0);

  /** grupo: o interesse que a ideia atende (ou a etiqueta principal) — usado para variar as sugestões */
  type Candidato = Sugestao & { grupo: Etiqueta };
  const candidatos: Candidato[] = [];

  for (const ideia of catalogo) {
    const etiquetas = etiquetasDa(ideia);
    if (etiquetas.some((e) => etiquetasProibidas.has(e))) continue;
    const palavrasIdeia = new Set(palavrasChave(`${ideia.titulo} ${(ideia.palavras ?? []).join(" ")}`));
    if ([...palavrasIdeia].some((p) => palavrasProibidas.has(p))) continue;
    if (ideia.tamanho === "roupa" && !tamRoupa) continue;
    if (ideia.tamanho === "calcado" && !tamCalcado) continue;
    const orc = avaliarOrcamento(ideia.preco, orcamento, tolerancia);
    if (orc.tipo === "fora") continue;

    let pontos = 0;
    const motivos: string[] = [];

    // interesses (a etiqueta principal da ideia vale mais)
    const casadas = etiquetas.filter((e) => interesse.has(e));
    casadas.forEach((e, k) => {
      const base = k === 0 ? (e === ideia.etiquetas[0] ? PESOS.interessePrincipal : PESOS.interesseSecundario) : PESOS.interesseExtra;
      pontos += base * (interesse.get(e) ?? 1);
      if (k < 2) motivos.push(motivoDaEtiqueta(e));
    });

    // lista de desejos (o melhor item só)
    let melhorDesejo: { pontos: number; motivo: string } | null = null;
    for (const d of desejos) {
      const comuns = [...palavrasIdeia].filter((p) => d.palavras.has(p)).length;
      let p = 0;
      let motivo = "";
      // "Parecido" só quando é mesmo o mesmo tipo de coisa: duas palavras em comum, ou uma palavra e o mesmo assunto
      // principal ("Livro de ficção" × "Livro do momento"). Uma palavra solta ("térmica" numa garrafa esportiva) ou só
      // o assunto em comum vale menos: "combina com".
      const mesmoAssunto = d.etiquetas.has(ideia.etiquetas[0]);
      if (comuns >= 2 && (mesmoAssunto || d.etiquetas.size === 0)) {
        p = PESOS.desejoPalavras2;
        motivo = `Parecido com “${d.titulo}”, da lista de desejos`;
      } else if (comuns >= 1 && mesmoAssunto) {
        p = PESOS.desejoPalavras;
        motivo = `Parecido com “${d.titulo}”, da lista de desejos`;
      } else if (etiquetas.some((e) => d.etiquetas.has(e))) {
        p = PESOS.desejoEtiqueta;
        motivo = `Combina com “${d.titulo}”, da lista de desejos`;
      } else if (comuns >= 1) {
        p = PESOS.desejoPalavraSolta;
        motivo = `Lembra “${d.titulo}”, da lista de desejos`;
      }
      if (p > 0 && (!melhorDesejo || p > melhorDesejo.pontos)) melhorDesejo = { pontos: p, motivo };
    }
    if (melhorDesejo) {
      pontos += melhorDesejo.pontos;
      motivos.push(melhorDesejo.motivo);
    }

    // cor e tamanho: só desempatam ideias que já têm a ver com a pessoa (ou quando não sabemos nada dela)
    const relevante = casadas.length > 0 || melhorDesejo !== null || !temPerfil;
    if (ideia.temCor && cores.length > 0 && relevante) {
      pontos += PESOS.cor;
      motivos.push(`Dá para escolher em ${cores[0].toLocaleLowerCase("pt-BR")}, a cor favorita`);
    }
    if (ideia.tamanho === "roupa") {
      if (relevante) pontos += PESOS.tamanho;
      motivos.push(`Tamanho já informado: ${tamRoupa}`);
    } else if (ideia.tamanho === "calcado") {
      if (relevante) pontos += PESOS.tamanho;
      motivos.push(`Número do calçado já informado: ${tamCalcado}`);
    }

    // versátil
    if (ideia.versatil) {
      pontos += temPerfil ? PESOS.versatilComPerfil : PESOS.versatilSemPerfil;
      if (casadas.length === 0 && !melhorDesejo) motivos.push("Ideia versátil, agrada quase todo mundo");
    }

    // orçamento
    pontos += orc.pontos;
    if (orc.tipo === "dentro" && descOrc) motivos.push(`Dentro do orçamento ${descOrc}`);
    if (orc.tipo === "acima" && descOrc) motivos.push(`Um pouco acima do orçamento ${descOrc}`);
    if (orc.tipo === "abaixo" && descOrc) motivos.push(`Um pouco abaixo do orçamento ${descOrc}`);

    const [fmin, fmax] = orc.faixa;
    const faixa = { min: Math.max(0, redondo(fmin, "baixo")), max: redondo(fmax, "cima") };
    if (faixa.max < faixa.min) faixa.max = faixa.min;

    candidatos.push({
      id: ideia.id,
      titulo: ideia.titulo,
      descricao: ideia.descricao,
      faixa,
      motivos,
      pontos: Math.round(pontos * 100) / 100,
      versatil: !!ideia.versatil,
      etiquetas: [...ideia.etiquetas],
      orcamento: orc.tipo === "livre" ? "livre" : orc.tipo === "dentro" ? "dentro" : "perto",
      grupo: casadas[0] ?? ideia.etiquetas[0],
    });
  }

  candidatos.sort((x, y) => y.pontos - x.pontos || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));

  // 4) escolha gulosa com variedade: repetir o mesmo assunto custa pontos
  const escolhidos: Candidato[] = [];
  const usadas = new Map<Etiqueta, number>();
  const restantes = [...candidatos];
  while (escolhidos.length < quantidade && restantes.length > 0) {
    let melhor = 0;
    let melhorValor = Number.NEGATIVE_INFINITY;
    for (let k = 0; k < restantes.length; k++) {
      const c = restantes[k];
      const valor = c.pontos - PESOS.diversidade * (usadas.get(c.grupo) ?? 0);
      if (valor > melhorValor) {
        melhorValor = valor;
        melhor = k;
      }
    }
    const [c] = restantes.splice(melhor, 1);
    escolhidos.push(c);
    usadas.set(c.grupo, (usadas.get(c.grupo) ?? 0) + 1);
  }

  return escolhidos.map(({ grupo: _grupo, ...s }) => s);
}
