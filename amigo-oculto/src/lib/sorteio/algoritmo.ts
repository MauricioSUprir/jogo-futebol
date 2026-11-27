/**
 * Algoritmo do sorteio do amigo oculto (puro, sem banco nem rede — roda no servidor e nos testes).
 *
 * Regras garantidas:
 *  - ninguém tira a si mesmo;
 *  - cada participante tira exatamente uma pessoa e é tirado exatamente uma vez (o resultado é uma permutação);
 *  - nenhuma restrição é violada ("A não tira B"; mutual = nem B tira A);
 *  - aleatoriedade criptográfica (crypto.getRandomValues, com rejeição para não enviesar);
 *  - antes de sortear confere se existe ALGUMA combinação possível (emparelhamento perfeito num grafo bipartido,
 *    caminhos aumentantes de Kuhn). Sem combinação, erro "impossivel" — nada é gravado.
 *
 * Estratégia: primeiro, amostragem por rejeição (embaralhamento de Fisher–Yates até sair uma permutação válida),
 * que dá distribuição UNIFORME entre todas as combinações válidas. Se as restrições forem tantas que a rejeição não
 * acha em `tentativasRejeicao`, cai para a construção guiada: cada pessoa (em ordem aleatória) recebe um destino
 * aleatório entre os que ainda deixam o resto completável (conferido pelo emparelhamento) — sempre termina e é
 * aleatória, ainda que não exatamente uniforme.
 */

export type Restricao = { giver: string; receiver: string; mutual: boolean };
export type Par = { giver: string; receiver: string };

export interface FonteAleatoria {
  /** inteiro uniforme em [0, n) */
  inteiro(n: number): number;
}

export type CodigoErroSorteio = "poucos_participantes" | "duplicado" | "restricao_invalida" | "impossivel";

export class ErroSorteio extends Error {
  constructor(public readonly codigo: CodigoErroSorteio, mensagem: string) {
    super(mensagem);
    this.name = "ErroSorteio";
  }
}

export const MIN_PARTICIPANTES = 3;

/** Fonte criptográfica (Web Crypto, presente no Node 20+ e nos navegadores). */
export function fonteCripto(): FonteAleatoria {
  const cripto = globalThis.crypto;
  if (!cripto?.getRandomValues) throw new Error("Web Crypto indisponível");
  const buf = new Uint32Array(1);
  return {
    inteiro(n: number) {
      if (!Number.isInteger(n) || n <= 0 || n > 2 ** 32) throw new RangeError(`n inválido: ${n}`);
      const limite = Math.floor(2 ** 32 / n) * n; // rejeição: descarta o resto que enviesaria
      for (;;) {
        cripto.getRandomValues(buf);
        if (buf[0] < limite) return buf[0] % n;
      }
    },
  };
}

/** Embaralhamento de Fisher–Yates (in place). */
export function embaralhar<T>(lista: T[], fonte: FonteAleatoria): T[] {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = fonte.inteiro(i + 1);
    const t = lista[i];
    lista[i] = lista[j];
    lista[j] = t;
  }
  return lista;
}

/** Para cada pessoa, o conjunto de quem ela NÃO pode tirar (sempre inclui ela mesma). */
export function montarProibidos(participantes: string[], restricoes: Restricao[]): Map<string, Set<string>> {
  const conjunto = new Set(participantes);
  const proibidos = new Map<string, Set<string>>();
  for (const p of participantes) proibidos.set(p, new Set([p]));
  for (const r of restricoes) {
    if (!conjunto.has(r.giver) || !conjunto.has(r.receiver)) {
      throw new ErroSorteio("restricao_invalida", "Há uma restrição com alguém que não está no sorteio.");
    }
    if (r.giver === r.receiver) continue;
    proibidos.get(r.giver)!.add(r.receiver);
    if (r.mutual) proibidos.get(r.receiver)!.add(r.giver);
  }
  return proibidos;
}

/**
 * Emparelhamento máximo (Kuhn) entre `dadores` e `recebedores` com as arestas permitidas.
 * Devolve o mapa dador → recebedor; é perfeito quando tem o tamanho de `dadores`.
 */
export function emparelhar(
  dadores: string[],
  recebedores: string[],
  pode: (dador: string, recebedor: string) => boolean,
): Map<string, string> {
  const vizinhos = new Map<string, string[]>();
  for (const d of dadores) vizinhos.set(d, recebedores.filter((r) => pode(d, r)));
  const donoDe = new Map<string, string>(); // recebedor → dador
  // mais restritos primeiro: acha o perfeito mais rápido
  const ordem = [...dadores].sort((a, b) => vizinhos.get(a)!.length - vizinhos.get(b)!.length);

  // passo guloso: em grafos densos (o caso comum) quase todos já casam aqui, e os caminhos aumentantes ficam curtos
  const casados = new Set<string>();
  for (const d of ordem) {
    const livre = vizinhos.get(d)!.find((r) => !donoDe.has(r));
    if (livre !== undefined) {
      donoDe.set(livre, d);
      casados.add(d);
    }
  }

  for (const d of ordem) {
    if (casados.has(d)) continue;
    const visitados = new Set<string>();
    // caminho aumentante em DFS iterativa (sem estourar a pilha com 1000 pessoas)
    const pilha: { dador: string; i: number }[] = [{ dador: d, i: 0 }];
    const escolhido: string[] = [];
    let achou = false;
    while (pilha.length > 0) {
      const topo = pilha[pilha.length - 1];
      const lista = vizinhos.get(topo.dador)!;
      if (topo.i >= lista.length) {
        pilha.pop();
        escolhido.pop();
        continue;
      }
      const r = lista[topo.i++];
      if (visitados.has(r)) continue;
      visitados.add(r);
      const dono = donoDe.get(r);
      if (dono === undefined) {
        escolhido.push(r);
        achou = true;
        break;
      }
      escolhido.push(r);
      pilha.push({ dador: dono, i: 0 });
    }
    if (achou) {
      // aplica o caminho: pilha[k].dador fica com escolhido[k]
      for (let k = 0; k < pilha.length; k++) donoDe.set(escolhido[k], pilha[k].dador);
    }
  }
  const resultado = new Map<string, string>();
  for (const [r, d] of donoDe) resultado.set(d, r);
  return resultado;
}

/** Existe pelo menos uma combinação válida? */
export function sorteioViavel(participantes: string[], restricoes: Restricao[]): boolean {
  if (participantes.length < 2) return false;
  const proibidos = montarProibidos(participantes, restricoes);
  const m = emparelhar(participantes, participantes, (d, r) => !proibidos.get(d)!.has(r));
  return m.size === participantes.length;
}

/** Confere uma lista de pares contra todas as regras (usado também antes de gravar). */
export function validarPares(participantes: string[], restricoes: Restricao[], pares: Par[]): string | null {
  if (pares.length !== participantes.length) return "quantidade de pares diferente da de participantes";
  const conjunto = new Set(participantes);
  const deram = new Set<string>();
  const receberam = new Set<string>();
  const proibidos = montarProibidos(participantes, restricoes);
  for (const { giver, receiver } of pares) {
    if (!conjunto.has(giver) || !conjunto.has(receiver)) return "par com alguém de fora do sorteio";
    if (giver === receiver) return "alguém tirou a si mesmo";
    if (deram.has(giver)) return "alguém tirou duas pessoas";
    if (receberam.has(receiver)) return "alguém foi tirado duas vezes";
    if (proibidos.get(giver)!.has(receiver)) return "restrição violada";
    deram.add(giver);
    receberam.add(receiver);
  }
  return null;
}

export interface OpcoesSorteio {
  fonte?: FonteAleatoria;
  /** tentativas da amostragem uniforme antes da construção guiada */
  tentativasRejeicao?: number;
}

export interface ResultadoSorteio {
  pares: Par[];
  metodo: "rejeicao" | "guiado";
  tentativas: number;
}

export function sortear(participantes: string[], restricoes: Restricao[], opcoes: OpcoesSorteio = {}): ResultadoSorteio {
  const fonte = opcoes.fonte ?? fonteCripto();
  const tentativasRejeicao = opcoes.tentativasRejeicao ?? 5000;

  if (participantes.length < MIN_PARTICIPANTES) {
    throw new ErroSorteio("poucos_participantes", `O sorteio precisa de pelo menos ${MIN_PARTICIPANTES} participantes.`);
  }
  if (new Set(participantes).size !== participantes.length) {
    throw new ErroSorteio("duplicado", "Há participantes repetidos.");
  }
  const proibidos = montarProibidos(participantes, restricoes);
  if (emparelhar(participantes, participantes, (d, r) => !proibidos.get(d)!.has(r)).size !== participantes.length) {
    throw new ErroSorteio("impossivel", "Com essas restrições não existe nenhuma combinação possível.");
  }

  // 1) amostragem uniforme por rejeição
  const destinos = [...participantes];
  for (let t = 1; t <= tentativasRejeicao; t++) {
    embaralhar(destinos, fonte);
    let ok = true;
    for (let i = 0; i < participantes.length; i++) {
      if (proibidos.get(participantes[i])!.has(destinos[i])) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return {
        pares: participantes.map((giver, i) => ({ giver, receiver: destinos[i] })),
        metodo: "rejeicao",
        tentativas: t,
      };
    }
  }

  // 2) construção guiada: escolhe destinos aleatórios que ainda deixam o resto completável
  const ordem = embaralhar([...participantes], fonte);
  const livres = new Set(participantes);
  const pares: Par[] = [];
  for (let k = 0; k < ordem.length; k++) {
    const dador = ordem[k];
    const restoDadores = ordem.slice(k + 1);
    const candidatos = embaralhar(
      [...livres].filter((r) => !proibidos.get(dador)!.has(r)),
      fonte,
    );
    let escolhido: string | undefined;
    for (const c of candidatos) {
      const restoRecebedores = [...livres].filter((r) => r !== c);
      const m = emparelhar(restoDadores, restoRecebedores, (d, r) => !proibidos.get(d)!.has(r));
      if (m.size === restoDadores.length) {
        escolhido = c;
        break;
      }
    }
    if (escolhido === undefined) {
      // não acontece: a viabilidade foi conferida e cada passo preserva um emparelhamento perfeito
      throw new ErroSorteio("impossivel", "Não foi possível completar o sorteio.");
    }
    livres.delete(escolhido);
    pares.push({ giver: dador, receiver: escolhido });
  }
  const ordemOriginal = new Map(participantes.map((p, i) => [p, i]));
  pares.sort((a, b) => ordemOriginal.get(a.giver)! - ordemOriginal.get(b.giver)!);
  return { pares, metodo: "guiado", tentativas: tentativasRejeicao };
}
