// O ritmo dos desenhos (item 45, `golaco/PLANO-GRAFICOS.md` passos 7 e 8). PURO — sem three.js, sem DOM, sem relógio próprio: o
// main.js passa cada intervalo entre DESENHOS e o instante dele —, fora do fecho do hash (só desenho; a simulação não muda).
//
// A QUEDA AUTOMÁTICA da qualidade (passo 7, o C12; D15, N9; a escolha D5 do dono: a queda GRAVADA):
//  - na SESSÃO, a regra de antes do item 45 (era o main.js adaptarQualidade): depois de QUEDA.esperaMs do começo, janelas de
//    QUEDA.janelaS segundos de desenhos; o qps da janela (desenhos ÷ a soma dos intervalos) abaixo do mínimo do nível (Alta 48,
//    Média 30) cai um nível — no máximo uma queda a cada QUEDA.entreTrocasMs. O main.js cai SEM recriar o contexto (o MSAA fica
//    até a próxima carga: recompilar no meio da partida trava a tela sem o KHR_parallel_shader_compile, 0,23% dos Android);
//  - a GRAVAÇÃO (a próxima carga em "Automática" já abre no nível de baixo) só quando:
//      1. QUEDA.janelasGravar janelas lentas SEGUIDAS: a que caiu e a(s) seguinte(s), pelo mínimo do nível DE ONDE caiu (a
//         seguinte já roda no nível de baixo: se nem ele segura o ritmo do de cima, não foi um soluço de uma janela só);
//      2. nenhuma delas com o ritmo PRESO num divisor da tela com pouco tremor: a mediana dos intervalos a ± QUEDA.tolDivisorMs de
//         33,3 ou 50 ms e p90 − p10 ≤ QUEDA.tremorMaxMs. É o iPhone em pouca energia (o WebKit limita o rAF a ~30, o teste do
//         WebKit com intervalo de 30 ms; Motion; o fórum da GreenSock) e o economizador do Android: caem na sessão, como antes,
//         mas não ficam na Baixa para sempre;
//      3. fora dos testes automáticos (`podeGravar` false com navigator.webdriver, ?prints=1 e ?demo=1): o 3D do Total Match no
//         quadro do testar-3d e o teste-graficos-pagina Q (um rAF falso a 20 Hz) caem e não gravam.
//    Uma janela inativa no meio (a pausa, a aba escondida, outra escolha que não a Automática, a troca de qualidade) desfaz o
//    "seguidas".
//
// O TETO de quadros (passo 8, o C13) entra neste módulo depois.

export const QUEDA = Object.freeze({
  esperaMs: 3000,       // do começo (o pronto, o fim do pré-jogo, a saída da tela antes do jogo) até a 1ª janela que conta
  janelaS: 2.5,         // s de desenhos por janela
  entreTrocasMs: 4000,  // depois de uma troca (a queda, a escolha na pausa), nenhuma queda nova
  minimo: Object.freeze({ alta: 48, media: 30, baixa: 0 }),
  abaixo: Object.freeze({ alta: 'media', media: 'baixa' }),
  janelasGravar: 2,     // janelas lentas seguidas para gravar (a que caiu + a seguinte)
  divisoresMs: Object.freeze([1000 / 30, 1000 / 20]), // o ritmo preso: 30 e 20 qps (60 Hz ÷ 2 e ÷ 3)
  tolDivisorMs: 1,      // a mediana a até 1 ms do divisor
  tremorMaxMs: 2,       // e p90 − p10 até 2 ms
  maxIntervalos: 1024,  // intervalos guardados por janela (2,5 s a 400 qps; além disso, contam no qps e não na mediana)
});

/** Os níveis, do mais alto ao mais baixo. */
export const NIVEIS = Object.freeze(['alta', 'media', 'baixa']);

/** O percentil q (0–1) de uma lista JÁ ORDENADA (interpolado). */
export function percentilOrdenado(v, n, q) {
  if (n <= 0) return NaN;
  const p = (n - 1) * q, i = Math.floor(p), f = p - i;
  return i + 1 < n ? v[i] + (v[i + 1] - v[i]) * f : v[i];
}

/**
 * O resumo de uma janela: ivs (ms, os n primeiros valem) → {mediana, p10, p90, tremor (p90 − p10), presa}. Ordena uma CÓPIA
 * (a lista do chamador não muda).
 */
export function resumoJanela(ivs, n, cfg = QUEDA) {
  const k = Math.min(n, ivs.length);
  const v = Array.prototype.slice.call(ivs, 0, k).sort((a, b) => a - b);
  const mediana = percentilOrdenado(v, k, 0.5), p10 = percentilOrdenado(v, k, 0.1), p90 = percentilOrdenado(v, k, 0.9);
  const tremor = p90 - p10;
  const presa = k > 0 && tremor <= cfg.tremorMaxMs && cfg.divisoresMs.some(d => Math.abs(mediana - d) <= cfg.tolDivisorMs);
  return { mediana, p10, p90, tremor, presa };
}

/** Uma queda {de, para} válida (o que veio das preferências), ou null. */
export function quedaValida(q) {
  if (!q || typeof q !== 'object') return null;
  const { de, para } = q;
  if (!NIVEIS.includes(de) || !NIVEIS.includes(para) || NIVEIS.indexOf(para) <= NIVEIS.indexOf(de)) return null;
  return { de, para };
}

/** O nível de uma carga em "Automática": o do aparelho, ou o da queda gravada quando ela é mais baixa (nunca sobe). */
export function nivelInicial(doAparelho, gravada) {
  const g = quedaValida(gravada);
  if (!g) return doAparelho;
  return NIVEIS.indexOf(g.para) > NIVEIS.indexOf(doAparelho) ? g.para : doAparelho;
}

/**
 * A decisão da queda. opc = {podeGravar (false com webdriver, prints e demo), cfg (QUEDA)}. Por desenho, `quadro(dt, agora, nivel,
 * ativo)` com dt = o intervalo desde o desenho anterior (s), agora (ms), o nível atual e se a medida vale agora (a Automática, sem
 * pausa, aba à vista, sem relógio manual, sem troca em andamento). Devolve null ou, no fim de uma janela que decide algo,
 * {cai: {de, para} | null, grava: {de, para} | null, janela: {qps, mediana, tremor, presa}}.
 */
export function criarQueda(opc = {}) {
  const cfg = opc.cfg ?? QUEDA;
  const podeGravar = opc.podeGravar !== false;
  const ivs = new Float64Array(cfg.maxIntervalos);
  let n = 0, soma = 0, nGuardados = 0;
  let inicio = 0, ultimaTroca = -Infinity;
  // a queda desta sessão esperando a(s) janela(s) seguinte(s) para gravar: {de, para, minimo, seguidas, presa}
  let pendente = null;
  let ultimaJanela = null;
  const zerarJanela = () => { n = 0; soma = 0; nGuardados = 0; };
  return {
    /** O começo (o pronto, o fim do pré-jogo, a saída da tela): as janelas só contam QUEDA.esperaMs depois dele. */
    reiniciar(agora) { inicio = agora; zerarJanela(); pendente = null; },
    /** Uma troca de qualidade de fora (a escolha na pausa): nenhuma queda por QUEDA.entreTrocasMs; a janela recomeça. */
    marcarTroca(agora) { ultimaTroca = agora; zerarJanela(); pendente = null; },
    quadro(dt, agora, nivel, ativo) {
      if (!ativo) { zerarJanela(); pendente = null; return null; }
      if (agora - inicio < cfg.esperaMs) return null;
      n++; soma += dt;
      if (nGuardados < ivs.length) ivs[nGuardados++] = dt * 1000;
      if (soma < cfg.janelaS) return null;
      const qps = n / soma;
      const r = resumoJanela(ivs, nGuardados, cfg);
      ultimaJanela = { qps, mediana: r.mediana, tremor: r.tremor, presa: r.presa };
      zerarJanela();
      let grava = null, cai = null;
      // a gravação: a(s) janela(s) depois da queda, pelo mínimo do nível de onde ela caiu
      if (pendente) {
        if (qps < pendente.minimo) {
          pendente.seguidas++;
          pendente.presa ||= r.presa;
          if (pendente.seguidas >= cfg.janelasGravar) {
            if (podeGravar && !pendente.presa) grava = { de: pendente.de, para: pendente.para };
            pendente = null;
          }
        } else pendente = null;
      }
      // a queda na sessão (a regra de antes)
      if (agora - ultimaTroca >= cfg.entreTrocasMs) {
        const para = cfg.abaixo[nivel];
        if (para && qps < (cfg.minimo[nivel] ?? 0)) {
          cai = { de: nivel, para };
          ultimaTroca = agora;
          pendente = { de: nivel, para, minimo: cfg.minimo[nivel], seguidas: 1, presa: r.presa };
          if (pendente.seguidas >= cfg.janelasGravar) {
            if (podeGravar && !pendente.presa) grava = { de: nivel, para };
            pendente = null;
          }
        }
      }
      return cai || grava ? { cai, grava, janela: ultimaJanela } : null;
    },
    /** O estado (testes e o painel): a janela em andamento, a última fechada e a queda esperando para gravar. */
    estado() {
      return { n, soma, inicio, ultimaTroca, ultimaJanela, pendente: pendente ? { ...pendente } : null, podeGravar };
    },
  };
}
