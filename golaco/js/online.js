// Online 1×1 (contrato "Online 1×1" no CONTRATOS.md): a sessão de TROCA DE ENTRADAS (lockstep com atraso de entrada).
// PURO: sem DOM, sem three.js, sem relógio próprio (quem chama passa o tempo em ms); só aritmética exata.
//
// Por que funciona: a simulação é determinística (passo fixo, rng com semente, matemática exata — matdet.js), então os
// dois aparelhos rodam a MESMA partida se receberem as MESMAS entradas nos MESMOS passos. Só as entradas viajam: 6 bytes
// por passo de cada jogador. O passo n só roda quando as duas entradas de n existem; a minha entrada lida AGORA vale para
// o passo n + D (o atraso D cobre a ida pela rede, ~50–170 ms). Sem a entrada do outro o aparelho PARA — e é isso que
// sincroniza todo o resto sem mensagem nenhuma: a pausa, o replay e a comemoração são locais (quem está nelas não roda
// passo nem produz entrada) e o outro simplesmente espera ("Aguardando o adversário"). Nada que é local entra no passo
// (câmera, preferências, quadros por segundo, qual lado é o meu).
//
// Formato da entrada (6 bytes, a mesma conta nos dois sentidos — a entrada LOCAL também passa por ela antes de ir para
// a simulação, senão um lado usaria o número cru e o outro o arredondado):
//   0–2  x e z: inteiro clamp(round(v · 1024), −1024, 1024) + 1024 em 12 bits cada (a quantização ENTRADA.quant)
//   3–4  botões (bits 0–14, config.js BOTAO) + bit 15 `repete` (2º passo do mesmo quadro a 30 qps: a mesma leitura)
//   5    bit0 IA (a IA joga pelo meu controlado neste passo: menu aberto, editor, ausência — calculada DENTRO do passo,
//        nos dois aparelhos); bit1 AÇÃO (há uma ação — a edição do time — para este passo no canal de controle)
// Pacote do canal 'jogo' (ArrayBuffer, little-endian; não confiável e sem ordem: leva TODAS as entradas ainda não
// confirmadas, até 16):
//   0 tipo = 1 · 1 n0 (u32: o passo da 1ª entrada) · 5 ack (u32: + 1 do maior passo do outro recebido sem buraco) ·
//   9 nAgora (u32: o passo que o remetente executa) · 13 t (u16: relógio do remetente em ms, mod 65536) · 15 eco (u16:
//   o último t recebido do outro) · 17 segurou (u16: ms entre receber esse t e mandar este pacote) · 19 estado (u8:
//   bit0 30 qps, bit1 menu aberto, bit2 aba escondida) · 20 k (u8: entradas) · 21 6·k bytes.

export const BYTES = 6;
export const MAX_ENTRADAS = 16;        // por pacote (≈ 267 ms de entradas sem confirmação)
export const CABECALHO = 21;
export const TIPO_JOGO = 1;
export const D_MIN = 3, D_MAX = 10;
export const F_IA = 1, F_ACAO = 2;
export const E_30QPS = 1, E_MENU = 2, E_ESCONDIDA = 4;
const Q = 1024;

const NEUTRA = Object.freeze({ x: 0, z: 0, botoes: 0, repete: false, ia: false, acao: false });

function inteiro(v) {
  const r = Math.round((+v || 0) * Q);
  return (r < -Q ? -Q : r > Q ? Q : r) + Q;
}

/** Codifica a entrada e = {x, z, botoes, repete?, ia?, acao?} em buf[o..o+5]. */
export function codificar(e, buf, o = 0) {
  const xi = inteiro(e?.x), zi = inteiro(e?.z);
  const b = (((e?.botoes ?? 0) | 0) & 0x7fff) | (e?.repete ? 0x8000 : 0);
  buf[o] = xi & 0xff;
  buf[o + 1] = ((xi >> 8) & 0x0f) | ((zi & 0x0f) << 4);
  buf[o + 2] = (zi >> 4) & 0xff;
  buf[o + 3] = b & 0xff;
  buf[o + 4] = (b >> 8) & 0xff;
  buf[o + 5] = (e?.ia ? F_IA : 0) | (e?.acao ? F_ACAO : 0);
}

/** Decodifica buf[o..o+5] (o mesmo valor nos dois aparelhos: x e z em múltiplos exatos de 1/1024). */
export function decodificar(buf, o = 0) {
  const xi = buf[o] | ((buf[o + 1] & 0x0f) << 8), zi = (buf[o + 1] >> 4) | (buf[o + 2] << 4);
  const b = buf[o + 3] | (buf[o + 4] << 8), f = buf[o + 5];
  return { x: (xi - Q) / Q + 0, z: (zi - Q) / Q + 0, botoes: b & 0x7fff, repete: !!(b & 0x8000), ia: !!(f & F_IA), acao: !!(f & F_ACAO) };
}

/** A entrada como a simulação a recebe (codificada e decodificada): use SEMPRE esta, também na entrada local. */
export function quantizada(e) {
  const b = new Uint8Array(BYTES);
  codificar(e, b, 0);
  return decodificar(b, 0);
}

/** Uma entrada válida? (bits reservados zerados; x/z dentro de −1024…1024). */
export function entradaValida(buf, o = 0) {
  const xi = buf[o] | ((buf[o + 1] & 0x0f) << 8), zi = (buf[o + 1] >> 4) | (buf[o + 2] << 4);
  return xi <= 2 * Q && zi <= 2 * Q && (buf[o + 5] & ~(F_IA | F_ACAO)) === 0;
}

/** Atraso D (passos) pelo RTT (ms) e se algum aparelho está a 30 qps (contrato 2.3). */
export function atrasoPorRtt(rtt, trinta = false) {
  const q = trinta ? 2 : 1;
  const d = Math.ceil(((+rtt || 100) / 2 + 16.7 * q) / 16.7);
  return d < D_MIN ? D_MIN : d > D_MAX ? D_MAX : d;
}

// ------------------------------------------------------------------ armazenamento por passo (cresce sob demanda)
function criarFita() {
  return { buf: new Uint8Array(BYTES * 4096), tem: new Uint8Array(4096) };
}
function garantir(f, n) {
  if (n < f.tem.length) return;
  let cap = f.tem.length;
  while (cap <= n) cap *= 2;
  const b = new Uint8Array(BYTES * cap); b.set(f.buf); f.buf = b;
  const t = new Uint8Array(cap); t.set(f.tem); f.tem = t;
}
function gravar(f, n, origem, o) {
  garantir(f, n);
  f.buf.set(origem.subarray(o, o + BYTES), n * BYTES);
  f.tem[n] = 1;
}
const tem = (f, n) => n >= 0 && n < f.tem.length && f.tem[n] === 1;

/**
 * Cria a sessão de um aparelho. opc: {lado: 0 | 1 (o meu time), D: atraso em passos (3–10)}.
 * O dono da sessão (a página) faz, a cada passo que quer rodar:
 *   s.podePassar() → s.entradas() (as duas, decodificadas) → passoOnline(...) → s.passou() → s.produzir(minha entrada)
 * e troca pacotes: s.pacote(agoraMs) → rede → s.receber(ab, agoraMs). Ações (edição do time) por s.acao/s.receberAcao;
 * dessincronia por s.registrarHash/s.receberHash.
 */
export function criarSessao(opc = {}) {
  const lado = opc.lado === 1 ? 1 : 0;
  const D = Math.max(D_MIN, Math.min(D_MAX, (opc.D | 0) || 4));
  const s = {
    lado, D,
    n: 0,                    // o próximo passo a rodar
    prod: 0,                 // o próximo passo sem a minha entrada
    loc: criarFita(), rem: criarFita(),
    remSeq: 0,               // o 1º passo do outro que ainda não chegou (tudo antes dele chegou)
    ackDoOutro: 0,           // o outro já recebeu todas as minhas entradas antes deste passo
    acoesLoc: new Map(), acoesRem: new Map(),
    hashesLoc: new Map(), hashesRem: new Map(), dessinc: null,
    // relógio e rede
    tEco: null, tEcoChegou: 0, rtt: null, rtts: [], ultimoPacote: null, nRemoto: 0, estadoRemoto: 0,
    descartados: 0, recebidos: 0, enviados: 0,
    paradoDesde: null, paradas: 0,
  };
  // os D primeiros passos: entrada neutra (os dois sabem, mas ela vai e volta como qualquer outra)
  const nb = new Uint8Array(BYTES);
  codificar(NEUTRA, nb, 0);
  for (let i = 0; i < D; i++) gravar(s.loc, i, nb, 0);
  s.prod = D;
  return s;
}

/** A minha entrada do próximo passo sem ela (s.prod = o passo que rodou + D). e = {x, z, botoes, repete, ia}. */
export function produzir(s, e, acao = null) {
  const b = new Uint8Array(BYTES);
  codificar({ ...e, acao: !!acao }, b, 0);
  const n = s.prod;
  gravar(s.loc, n, b, 0);
  if (acao) s.acoesLoc.set(n, acao);
  s.prod++;
  return n;
}

/** Ação remota (do canal de controle): {n, acao}. Só vale a edição do time DO OUTRO (a de time trocado é recusada). */
export function receberAcao(s, n, acao) {
  if (!Number.isInteger(n) || n < 0 || !acao || typeof acao !== 'object') return false;
  if (acao.time !== 1 - s.lado) return false;
  s.acoesRem.set(n, acao);
  return true;
}

function decodLoc(s, n) { return decodificar(s.loc.buf, n * BYTES); }
function decodRem(s, n) { return decodificar(s.rem.buf, n * BYTES); }

/** O passo s.n pode rodar? (as duas entradas e, se marcadas, as ações delas). */
export function podePassar(s) {
  const n = s.n;
  if (!tem(s.loc, n) || !tem(s.rem, n)) return false;
  if ((s.rem.buf[n * BYTES + 5] & F_ACAO) && !s.acoesRem.has(n)) return false;
  return true;
}

/** As entradas do passo s.n: {0: e0, 1: e1} (decodificadas) e as ações dele, na ordem dos times. */
export function entradas(s) {
  const n = s.n, minha = decodLoc(s, n), dele = decodRem(s, n);
  const e = s.lado === 0 ? { 0: minha, 1: dele } : { 0: dele, 1: minha };
  const acoes = [];
  const a0 = s.lado === 0 ? s.acoesLoc.get(n) : s.acoesRem.get(n);
  const a1 = s.lado === 1 ? s.acoesLoc.get(n) : s.acoesRem.get(n);
  if (e[0].acao && a0) acoes.push(a0);
  if (e[1].acao && a1) acoes.push(a1);
  return { e, acoes: acoes.length ? acoes : null };
}

/** O passo s.n rodou. */
export function passou(s) {
  const n = s.n;
  s.acoesLoc.delete(n); s.acoesRem.delete(n);
  s.n = n + 1;
}

/**
 * Um passo do online (a mesma função nos dois aparelhos): o bit IA vira a entrada da IA pelo controlado daquele time
 * (time 0 antes do 1, dentro do passo — ela escreve na memória da IA); do gol até a saída as entradas são neutras (a
 * cena é local, a regra não). fns: {passoPartida, entradaDemoPartida}.
 */
export function passoOnline(m, e, acoes, fns) {
  const ent = { 0: e[0], 1: e[1] };
  for (const t of [0, 1]) if (ent[t]?.ia) ent[t] = fns.entradaDemoPartida(m, t);
  if (m.partida && m.partida.estado === 'gol') for (const t of [0, 1]) if (!e[t]?.ia) ent[t] = NEUTRA;
  return fns.passoPartida(m, ent, acoes);
}

// ------------------------------------------------------------------ rede
/** O pacote a mandar agora (ArrayBuffer): as minhas entradas ainda não confirmadas (até 16) + o relógio. */
export function pacote(s, agoraMs, estado = 0) {
  let n0 = s.ackDoOutro;
  if (n0 < 0) n0 = 0;
  let k = s.prod - n0;
  if (k < 0) k = 0;
  if (k > MAX_ENTRADAS) k = MAX_ENTRADAS;
  const ab = new ArrayBuffer(CABECALHO + BYTES * k), dv = new DataView(ab), u8 = new Uint8Array(ab);
  dv.setUint8(0, TIPO_JOGO);
  dv.setUint32(1, n0, true);
  dv.setUint32(5, s.remSeq, true);
  dv.setUint32(9, s.n, true);
  const t = Math.floor(agoraMs) & 0xffff;
  dv.setUint16(13, t, true);
  dv.setUint16(15, s.tEco == null ? 0xffff : s.tEco, true);
  const seg = s.tEco == null ? 0 : Math.min(0xfffe, Math.max(0, Math.floor(agoraMs - s.tEcoChegou)));
  dv.setUint16(17, seg, true);
  dv.setUint8(19, estado & 0xff);
  dv.setUint8(20, k);
  for (let i = 0; i < k; i++) u8.set(s.loc.buf.subarray((n0 + i) * BYTES, (n0 + i + 1) * BYTES), CABECALHO + i * BYTES);
  s.enviados++;
  return ab;
}

/** Lê um pacote (null se inválido: tamanho, tipo, k, bits reservados, n0 longe demais). */
export function lerPacote(ab) {
  if (!(ab instanceof ArrayBuffer) || ab.byteLength < CABECALHO) return null;
  const dv = new DataView(ab), u8 = new Uint8Array(ab);
  if (dv.getUint8(0) !== TIPO_JOGO) return null;
  const k = dv.getUint8(20);
  if (k > MAX_ENTRADAS || ab.byteLength !== CABECALHO + BYTES * k) return null;
  for (let i = 0; i < k; i++) if (!entradaValida(u8, CABECALHO + i * BYTES)) return null;
  return {
    n0: dv.getUint32(1, true), ack: dv.getUint32(5, true), nAgora: dv.getUint32(9, true), t: dv.getUint16(13, true),
    eco: dv.getUint16(15, true), segurou: dv.getUint16(17, true), estado: dv.getUint8(19), k, u8,
  };
}

/** Recebe um pacote do outro aparelho (agoraMs = o meu relógio). Devolve false se foi descartado. */
export function receber(s, ab, agoraMs) {
  const p = lerPacote(ab);
  // o n0 tem de estar perto do que já sei (nem atrás de tudo que confirmei, nem muito à frente)
  if (!p || p.n0 > s.remSeq + 64 || p.ack > s.prod) { s.descartados++; return false; }
  for (let i = 0; i < p.k; i++) {
    const n = p.n0 + i;
    if (n < s.remSeq || tem(s.rem, n)) continue;
    gravar(s.rem, n, p.u8, CABECALHO + i * BYTES);
  }
  while (tem(s.rem, s.remSeq)) s.remSeq++;
  if (p.ack > s.ackDoOutro) s.ackDoOutro = p.ack;
  // relógio: o eco do meu t dá o RTT (agora − eco − o tempo que o outro segurou)
  if (p.eco !== 0xffff) {
    let rtt = ((Math.floor(agoraMs) & 0xffff) - p.eco - p.segurou) & 0xffff;
    if (rtt < 30000) {
      s.rtt = s.rtt == null ? rtt : s.rtt + (rtt - s.rtt) * 0.1;
      s.rtts.push(rtt); if (s.rtts.length > 300) s.rtts.shift();
    }
  }
  s.tEco = p.t; s.tEcoChegou = agoraMs;
  s.ultimoPacote = agoraMs; s.nRemoto = p.nAgora; s.estadoRemoto = p.estado;
  s.recebidos++;
  return true;
}

/** RTT p95 da janela (ms; null sem amostra). */
export function rttP95(s) {
  if (!s.rtts.length) return null;
  const o = s.rtts.slice().sort((a, b) => a - b);
  return o[Math.max(0, Math.ceil(0.95 * o.length) - 1)];
}

// ------------------------------------------------------------------ relógio (vantagem de quadro, como o GGPO)
/**
 * Quantos passos rodar neste quadro: `quer` (o que o laço pede) menos 1 quando EU estou à frente do outro. Quem esperou
 * o outro (replay dele, pausa, rede) fica na beira — sem nenhuma entrada dele de folga — e cada variação da rede vira
 * uma parada; segurando 1 passo por quadro enquanto estiver à frente, os dois voltam ao mesmo passo e cada um fica com
 * a folga do atraso D. A vantagem é a média (janela ~0,5 s) de: o meu passo − o passo estimado do outro agora (o último
 * que ele contou + o tempo desde então + metade do RTT). Só freia acima de 1,5 passo (os dois nunca freiam juntos).
 */
export function passosDoQuadro(s, quer, agoraMs) {
  if (s.ultimoPacote == null || s.rtt == null) return quer;
  const remoto = s.nRemoto + (agoraMs - s.ultimoPacote + s.rtt / 2) * 60 / 1000;
  const adv = s.n - remoto;
  s.vantagem = s.vantagem == null ? adv : s.vantagem + (adv - s.vantagem) * 0.06;
  if (quer > 0 && s.vantagem > LIMIAR_FREIO) { s.freios = (s.freios ?? 0) + 1; return quer - 1; }
  return quer;
}
export const LIMIAR_FREIO = 1;

/**
 * O atraso D só SOBE na partida (v1): a cada HASH_CADA passos, pelo RTT p95 da janela e pelos 30 qps de qualquer um dos
 * dois (o meu `trinta` ou o bit do outro). Subir k = produzir já as k entradas que faltam (repetindo a última: são botões
 * segurados, não um aperto novo). Cada lado decide o próprio D — cada entrada leva o passo dela, então não precisa
 * combinar. Devolve quantas entradas produziu (0 se nada mudou).
 */
export function ajustarAtraso(s, trinta = false) {
  if (s.n % HASH_CADA !== 0 || s.rtts.length < 30) return 0;
  const alvo = atrasoPorRtt(rttP95(s), trinta || !!(s.estadoRemoto & E_30QPS));
  if (alvo <= s.D) return 0;
  const k = alvo - s.D;
  const ult = s.prod - 1, b = s.loc.buf.subarray(ult * BYTES, (ult + 1) * BYTES).slice();
  b[5] &= ~F_ACAO; // a repetição nunca leva a ação de novo
  for (let i = 0; i < k; i++) gravar(s.loc, s.prod++, b, 0);
  s.D = alvo;
  return k;
}

// ------------------------------------------------------------------ dessincronia
export const HASH_CADA = 60;
/** Guarda o hash do mundo depois do passo n (só os múltiplos de HASH_CADA) e confere com o do outro. */
export function registrarHash(s, n, h) {
  if (n % HASH_CADA) return null;
  s.hashesLoc.set(n, h >>> 0);
  conferir(s, n);
  if (s.hashesLoc.size > 64) s.hashesLoc.delete(s.hashesLoc.keys().next().value);
  return { n, h: h >>> 0 };
}
export function receberHash(s, n, h) {
  if (!Number.isInteger(n) || n % HASH_CADA) return;
  s.hashesRem.set(n, h >>> 0);
  conferir(s, n);
  if (s.hashesRem.size > 64) s.hashesRem.delete(s.hashesRem.keys().next().value);
}
function conferir(s, n) {
  if (s.dessinc) return;
  const a = s.hashesLoc.get(n), b = s.hashesRem.get(n);
  if (a != null && b != null && a !== b) s.dessinc = { n, meu: a, dele: b };
}

// ------------------------------------------------------------------ estado da conexão (para a tela)
export const INSTAVEL_MS = 750, AGUARDANDO_MS = 5000, WO_MS = 60000;
/**
 * O que a tela mostra agora: 'ok' | 'instavel' (sem pacote há 0,75 s) | 'aguardando' (parado sem a entrada do outro há
 * 5 s, ou sem pacote há 5 s) | 'dessinc'. paradoMs = há quanto tempo o passo espera a entrada do outro.
 */
export function estadoConexao(s, agoraMs) {
  if (s.dessinc) return { estado: 'dessinc', paradoMs: 0, semPacoteMs: 0 };
  const semPacote = s.ultimoPacote == null ? 0 : agoraMs - s.ultimoPacote;
  const parado = s.paradoDesde == null ? 0 : agoraMs - s.paradoDesde;
  const estado = parado >= AGUARDANDO_MS || semPacote >= AGUARDANDO_MS ? 'aguardando' : semPacote >= INSTAVEL_MS ? 'instavel' : 'ok';
  return { estado, paradoMs: parado, semPacoteMs: semPacote };
}
/** A página chama a cada quadro: parado = quis rodar um passo e faltou a entrada do outro. */
export function marcarParado(s, parado, agoraMs) {
  if (parado) { if (s.paradoDesde == null) { s.paradoDesde = agoraMs; s.paradas++; } }
  else s.paradoDesde = null;
}
