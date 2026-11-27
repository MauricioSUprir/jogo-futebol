/**
 * Regras puras da lista de desejos e das preferências de presente (sem DOM e sem banco — testadas em Node).
 * As Server Actions (src/lib/acoes/desejos.ts) e os formulários usam as mesmas funções.
 */

export const LIMITE_DESEJOS = 50;
export const LIMITE_ETIQUETAS = 20;
export const LIMITE_CORES = 10;

/** Só links https (o banco aceita http, mas um link sem cadeado é mau sinal numa loja). Devolve null se inválido. */
export function normalizarLink(bruto: string | null | undefined): string | null {
  const texto = (bruto ?? "").trim();
  if (!texto) return null;
  const comProtocolo = /^[a-z][a-z0-9+.-]*:/i.test(texto) ? texto : `https://${texto}`;
  let url: URL;
  try {
    url = new URL(comProtocolo);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  const final = url.toString();
  return final.length <= 1000 ? final : null;
}

/** Domínio legível para mostrar ao lado do link (sem "www."). */
export function dominioDoLink(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * Preço digitado em reais → número (2 casas). Aceita "1.234,56", "1234,5", "R$ 80", "80.90", "99". Vazio = null.
 * Devolve NaN se o texto não for um preço.
 */
export function precoDeTexto(bruto: string | null | undefined): number | null {
  let t = (bruto ?? "").replace(/R\$|\s/gi, "").trim();
  if (!t) return null;
  if (!/^\d[\d.,]*$/.test(t)) return Number.NaN;
  const ultimaVirgula = t.lastIndexOf(",");
  const ultimoPonto = t.lastIndexOf(".");
  if (ultimaVirgula > -1 && ultimaVirgula > ultimoPonto) {
    // vírgula decimal (padrão brasileiro): pontos são milhares
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (ultimoPonto > -1 && ultimaVirgula > -1) {
    // ponto decimal com vírgula de milhar ("1,234.56")
    t = t.replace(/,/g, "");
  } else if (ultimoPonto > -1) {
    // só pontos: "80.90" é decimal; "1.234" (3 dígitos depois do último ponto) é milhar
    const depois = t.length - ultimoPonto - 1;
    const pontos = (t.match(/\./g) ?? []).length;
    if (depois === 3 || pontos > 1) t = t.replace(/\./g, "");
  }
  const v = Number(t);
  if (!Number.isFinite(v) || v < 0) return Number.NaN;
  return Math.round(v * 100) / 100;
}

/** Número → texto para o campo de preço ("1234.5" → "1.234,50"). */
export function precoParaCampo(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

/** Etiqueta (hobby, interesse, "não quero"): espaços aparados, sem repetir (ignorando maiúsculas/acentos). */
export function normalizarEtiquetas(lista: readonly string[], limite = LIMITE_ETIQUETAS, tamanho = 40): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of lista) {
    const e = bruto.replace(/\s+/g, " ").trim().slice(0, tamanho);
    if (!e) continue;
    const chave = chaveDeTexto(e);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(e);
    if (saida.length >= limite) break;
  }
  return saida;
}

export function chaveDeTexto(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Cores sugeridas (nome em português + amostra). Qualquer outra cor pode ser escrita livremente. */
export const CORES_SUGERIDAS: { nome: string; hex: string }[] = [
  { nome: "Vermelho", hex: "#d1263b" },
  { nome: "Rosa", hex: "#ec6fa4" },
  { nome: "Laranja", hex: "#f08a24" },
  { nome: "Amarelo", hex: "#f4c430" },
  { nome: "Verde", hex: "#1f9d55" },
  { nome: "Azul", hex: "#2563eb" },
  { nome: "Azul-marinho", hex: "#1e2f5c" },
  { nome: "Roxo", hex: "#7c3aed" },
  { nome: "Lilás", hex: "#b79ce8" },
  { nome: "Marrom", hex: "#8a5a35" },
  { nome: "Bege", hex: "#d9c3a0" },
  { nome: "Cinza", hex: "#8b9096" },
  { nome: "Preto", hex: "#1c1c1c" },
  { nome: "Branco", hex: "#f7f7f5" },
  { nome: "Dourado", hex: "#c9962b" },
  { nome: "Prateado", hex: "#b8bec6" },
];

/** Amostra de uma cor pelo nome (sugeridas ou #hex escrito); null quando não dá para saber. */
export function amostraDaCor(nome: string): string | null {
  const t = nome.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(t)) return t.toLowerCase();
  const chave = chaveDeTexto(t);
  const achada = CORES_SUGERIDAS.find((c) => chaveDeTexto(c.nome) === chave);
  if (achada) return achada.hex;
  // nomes compostos: "verde-água" → verde; "azul claro" → azul
  const base = CORES_SUGERIDAS.find((c) => chave.startsWith(chaveDeTexto(c.nome)));
  return base?.hex ?? null;
}

export const TAMANHOS_CAMISETA = ["PP", "P", "M", "G", "GG", "XG", "XGG"];

/** Novo vetor com o item `de` levado para a posição `para` (para reordenar a lista). */
export function mover<T>(lista: readonly T[], de: number, para: number): T[] {
  const copia = [...lista];
  if (de < 0 || de >= copia.length) return copia;
  const destino = Math.max(0, Math.min(copia.length - 1, para));
  const [item] = copia.splice(de, 1);
  copia.splice(destino, 0, item);
  return copia;
}
