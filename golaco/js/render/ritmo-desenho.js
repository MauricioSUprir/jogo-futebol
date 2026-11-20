// O ritmo dos desenhos (item 45, `golaco/PLANO-GRAFICOS.md` passos 7 e 8). PURO — sem three.js, sem DOM, sem relógio próprio: o
// main.js passa cada intervalo entre DESENHOS e o instante dele (a queda) e o instante de cada quadro do navegador (o teto) —, fora
// do fecho do hash (só desenho; a simulação não muda).
//
// A QUEDA AUTOMÁTICA da qualidade (passo 7, o C12; D15, N9; a escolha D5 do dono: a queda GRAVADA):
//  - na SESSÃO, a regra de antes do item 45 (era o main.js adaptarQualidade): depois de QUEDA.esperaMs do começo, janelas de
//    QUEDA.janelaS segundos de desenhos; o qps da janela (desenhos ÷ a soma dos intervalos) abaixo do mínimo do nível (Alta 48,
//    Média 30) cai um nível — no máximo uma queda a cada QUEDA.entreTrocasMs. O main.js cai SEM recriar o contexto (o MSAA fica
//    até a próxima carga: recompilar no meio da partida trava a tela sem o KHR_parallel_shader_compile, 0,23% dos Android);
//  - a GRAVAÇÃO (a próxima carga em "Automática" já abre no nível de baixo; a revisão do bloco 4 — a regra do C12, "duas janelas
//    lentas seguidas pelo mínimo do nível de cima", quase nunca gravava: a 2ª janela já roda no nível de baixo, e quando ele
//    resolve, que é o caso que a queda gravada existe para lembrar, nada ficava; 0 de 20 com a Média a ~25 qps e a Baixa a ~50):
//      1. a janela que caiu LENTA DE VERDADE: a mediana dos intervalos a até QUEDA.folgaMedianaMs abaixo do intervalo do mínimo
//         do nível (Média 33,3 ms; Alta 20,8): a maioria dos desenhos não segurou o nível. Alguns soluços longos (o lixo, uma
//         compilação, uma foto chegando) baixam o qps da janela — e a queda na sessão vem, como antes — mas não a mediana: não
//         grava;
//      2. o ritmo PRESO num divisor da tela com pouco tremor (a mediana a ± QUEDA.tolDivisorMs de 33,3 ms e p90 − p10 ≤
//         QUEDA.tremorMaxMs: o iPhone em pouca energia — o WebKit limita o rAF a ~30, o teste do WebKit com intervalo de 30 ms;
//         Motion; o fórum da GreenSock — e o economizador do Android) só grava se a janela SEGUINTE, já no nível de baixo,
//         desenhar mais rápido (a mediana ≥ QUEDA.ajudaMs abaixo): a mesma cadência presa no nível de baixo é o limite do
//         sistema, que não responde à carga (cai na sessão, como antes, mas não fica na Baixa para sempre). O aparelho lento de
//         verdade também desenha preso no vsync (o rAF sai no carimbo dele: a Média que leva 36–48 ms desenha a cada 50,0 ms
//         exatos, a Alta do PC de 20–30 ms a cada 33,3): a cadência do nível de baixo é o que separa os dois. Só o 30 conta: o 20
//         (50 ms) saiu — nenhuma fonte de sistema que limite a 20;
//      3. fora dos testes automáticos (`podeGravar` false com navigator.webdriver, ?prints=1 e ?demo=1): o 3D do Total Match no
//         quadro do testar-3d e o teste-graficos-pagina Q (um rAF falso a 20 Hz) caem e não gravam.
//    Uma janela inativa entre a presa e a seguinte (a pausa, a aba escondida, outra escolha que não a Automática, a troca de
//    qualidade) desfaz a espera.
//
// O TETO de quadros (passo 8, o C13; D16; a escolha D6 do dono: teto de 60 desenhos, nunca abaixo de 60), só no celular (o main.js
// passa `ligado` = ehCelular; o PC não muda: Alta em monitor de 144 Hz é jogo de PC):
//  - o refresh da tela pela mediana dos últimos TETO.amostras intervalos do rAF — TODOS os quadros do navegador, desenhados ou
//    não —, refeita a cada TETO.refazMs (o período é a média dos intervalos a ± TETO.faixa da mediana: o tremor do carimbo some
//    na média e os quadros perdidos ficam fora; com tremor de ±0,5 ms, só a mediana de 30 dava 231–248 Hz numa tela de 240 — o
//    n em 3 em 4% das contas — e a média na faixa dá 237–243);
//  - n = max(1, floor(Hz/60 + 0,1)): 60 e 90 Hz → 1 (sem teto; 45 regulares ou 60 aos trancos seriam piores), 120 → 2 (60),
//    144 → 2 (72), 165 → 2 (82,5: o round dava 3, 55, abaixo de 60), 240 → 4 (60);
//  - o quadro do ritmo: desenha quando já passaram (n − 0,5) períodos desde o último desenho — com o rAF regular, 1 a cada n
//    quadros; um quadro que a página perdeu (o desenho que passou do vsync) não faz esperar um quadro a mais; a tela que caiu de
//    120 para 60 Hz desenha todo quadro na hora;
//  - a descida rápida: com n > 1, a mediana dos últimos TETO.rapidas intervalos acima de TETO.rapidaRazao × o período baixa o n na
//    hora (a tela que foi de 120 para 90 Hz desenharia 45 até a próxima conta, 2 s depois); subir o n só na conta de 2 s;
//  - n = 1 é o laço de antes, bit a bit: todo quadro desenha.
// O main.js chama `quadro(t)` em TODO quadro do navegador (o aoQuadro, antes do quadro() dele) e só roda o quadro() quando ele dá
// true; nunca dentro do quadro(): o relógio manual dos testes (api.relogio.avancar) e o laço (teste-laco) não passam por aqui.

export const QUEDA = Object.freeze({
  esperaMs: 3000,       // do começo (o pronto, o fim do pré-jogo, a saída da tela antes do jogo) até a 1ª janela que conta
  janelaS: 2.5,         // s de desenhos por janela
  entreTrocasMs: 4000,  // depois de uma troca (a queda, a escolha na pausa), nenhuma queda nova
  minimo: Object.freeze({ alta: 48, media: 30, baixa: 0 }),
  abaixo: Object.freeze({ alta: 'media', media: 'baixa' }),
  folgaMedianaMs: 1,    // a janela que caiu é lenta de verdade com a mediana ≥ o intervalo do mínimo − 1 ms (Média 32,3 ms)
  divisoresMs: Object.freeze([1000 / 30]), // o ritmo preso: 30 qps (60 Hz ÷ 2; o 20, 60 Hz ÷ 3, saiu na revisão do bloco 4)
  tolDivisorMs: 1,      // a mediana a até 1 ms do divisor
  tremorMaxMs: 2,       // e p90 − p10 até 2 ms
  ajudaMs: 1,           // a presa grava se a janela seguinte (o nível de baixo) tem a mediana ≥ 1 ms abaixo da dela
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
  // a queda presa desta sessão esperando a janela seguinte (o nível de baixo) para decidir a gravação: {de, para, mediana}
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
      // a presa da queda anterior: grava se o nível de baixo desenhou mais rápido (a carga, não o limite do sistema)
      if (pendente) {
        if (podeGravar && r.mediana <= pendente.mediana - cfg.ajudaMs) grava = { de: pendente.de, para: pendente.para };
        pendente = null;
      }
      // a queda na sessão (a regra de antes)
      if (agora - ultimaTroca >= cfg.entreTrocasMs) {
        const para = cfg.abaixo[nivel];
        const minimo = cfg.minimo[nivel] ?? 0;
        if (para && qps < minimo) {
          cai = { de: nivel, para };
          ultimaTroca = agora;
          // lenta de verdade: a maioria dos desenhos abaixo do mínimo (alguns soluços longos não gravam)
          const lenta = r.mediana >= 1000 / minimo - cfg.folgaMedianaMs;
          if (lenta && r.presa) pendente = { de: nivel, para, mediana: r.mediana };
          else if (lenta && podeGravar) grava = { de: nivel, para };
        }
      }
      return cai || grava ? { cai, grava, janela: ultimaJanela } : null;
    },
    /** O estado (testes e o painel): a janela em andamento, a última fechada e a queda presa esperando a janela seguinte. */
    estado() {
      return { n, soma, inicio, ultimaTroca, ultimaJanela, pendente: pendente ? { ...pendente } : null, podeGravar };
    },
  };
}

export const TETO = Object.freeze({
  alvoHz: 60,          // o teto: 60 desenhos por segundo (D6)
  folga: 0.1,          // n = max(1, floor(Hz/alvoHz + folga)): 165 Hz → 2 (82,5), não 3 (55)
  amostras: 30,        // intervalos do rAF na conta do refresh (todos os quadros, desenhados ou não)
  refazMs: 2000,       // a conta do refresh refeita a cada 2 s
  faixa: 0.25,         // o período = a média dos intervalos a ± 25% da mediana (os perdidos, 2 períodos, ficam fora)
  quebraMs: 1000,      // intervalo maior não entra (a aba escondida, o celular em pé, a carga)
  meioQuadro: 0.5,     // desenha quando já passaram (n − 0,5) períodos desde o último desenho
  rapidas: 8,          // a descida rápida: a mediana dos últimos 8 intervalos...
  rapidaRazao: 1.2,    // ... acima de 1,2 × o período baixa o n na hora (nunca abaixo de 60 numa troca de refresh)
});

/** O n do teto para um refresh (Hz): desenha 1 a cada n quadros da tela; 1 sem refresh medido. */
export function nDoTeto(hz, cfg = TETO) {
  return Number.isFinite(hz) && hz > 0 ? Math.max(1, Math.floor(hz / cfg.alvoHz + cfg.folga)) : 1;
}

/**
 * O período da tela (ms) a partir de intervalos do rAF (os n primeiros de `ivs`, numa ordem qualquer; `tmp` do mesmo tamanho ou
 * maior, para não alocar): a mediana e, dela, a média dos que ficam a ± faixa. NaN sem intervalos.
 */
export function periodoDaTela(ivs, n, tmp, cfg = TETO) {
  if (n <= 0) return NaN;
  for (let i = 0; i < n; i++) tmp[i] = ivs[i];
  // (ordenação por inserção: n ≤ 30 e sem alocar por quadro — o sort pediria uma lista ou um subarray novo)
  for (let i = 1; i < n; i++) { const v = tmp[i]; let k = i - 1; while (k >= 0 && tmp[k] > v) { tmp[k + 1] = tmp[k]; k--; } tmp[k + 1] = v; }
  const med = percentilOrdenado(tmp, n, 0.5);
  let soma = 0, c = 0;
  for (let i = 0; i < n; i++) if (Math.abs(tmp[i] - med) <= cfg.faixa * med) { soma += tmp[i]; c++; }
  return c > 0 ? soma / c : med;
}

/**
 * O teto. opc = {ligado (só no celular), cfg (TETO)}. `quadro(t, forcar)` a cada quadro do navegador, com o instante do rAF (ms):
 * true = este quadro desenha (o main.js roda o quadro()); `forcar` true desenha sempre (a tela antes do jogo, que tem o próprio
 * ritmo de 30). Desligado, mede o refresh (o painel) e devolve sempre true. `estado()` = {ligado, hz, n, periodo}: o n é o que a
 * conta dá (aplicado só ligado).
 */
export function criarTeto(opc = {}) {
  const cfg = opc.cfg ?? TETO;
  const ligado = opc.ligado === true;
  const N = cfg.amostras, R = cfg.rapidas;
  const ivs = new Float64Array(N), tmp = new Float64Array(N), ult = new Float64Array(R), tmpR = new Float64Array(R);
  let ni = 0, ii = 0, ant = null, ultimaConta = -Infinity;
  let hz = NaN, periodo = NaN, n = 1, ultimoDesenho = -Infinity;
  /** Os últimos R intervalos guardados (do mais novo para trás) em `ult`; devolve quantos. */
  const ultimos = () => {
    const k = Math.min(R, ni);
    for (let j = 0; j < k; j++) ult[j] = ivs[(ii - 1 - j + N) % N];
    return k;
  };
  return {
    quadro(t, forcar = false) {
      if (ant !== null) {
        const d = t - ant;
        if (d > 0 && d <= cfg.quebraMs) { ivs[ii] = d; ii = (ii + 1) % N; ni = Math.min(N, ni + 1); }
      }
      ant = t;
      if (ni >= N && t - ultimaConta >= cfg.refazMs) {
        // a conta do refresh (a cada 2 s, com a fila cheia)
        ultimaConta = t;
        periodo = periodoDaTela(ivs, ni, tmp, cfg);
        hz = 1000 / periodo;
        n = nDoTeto(hz, cfg);
      } else if (n > 1 && ni >= R) {
        // a descida rápida: a tela ficou mais lenta (120 → 90 ou 60 Hz) — o n baixa já, subir só na conta de 2 s
        const k = ultimos();
        const p = periodoDaTela(ult, k, tmpR, cfg);
        if (p > cfg.rapidaRazao * periodo) {
          const nr = nDoTeto(1000 / p, cfg);
          if (nr < n) { n = nr; periodo = p; hz = 1000 / p; }
        }
      }
      if (!ligado || n <= 1 || forcar) { ultimoDesenho = t; return true; }
      if (t - ultimoDesenho >= (n - cfg.meioQuadro) * periodo) { ultimoDesenho = t; return true; }
      return false;
    },
    estado() { return { ligado, hz, n, periodo }; },
  };
}
