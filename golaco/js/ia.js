// IA dos jogadores de linha que o humano não controla (Etapa 2: enxuta; a tática completa é a
// Etapa 3). A IA gera uma ENTRADA VIRTUAL {x, z, botoes} — anda e "aperta botões" pelas mesmas
// regras do humano (aplicarEntrada, condução, ações). Pura: sem three.js nem DOM.

import { BOTAO, CAMPO, PASSO, ACOES, IA } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { ataca } from './acoes.js';
import { preverBola } from './conducao.js';

const DT = PASSO;

/**
 * Entrada que leva o jogador ao ponto (x, z). Com `pressa` (bola livre, passe chegando, pressão,
 * corrida): vai direto, intensidade d/4. Sem pressa (apoio, marcação, cobertura): o ponto pedido
 * anda no máximo IA.vAlvo (um salto de alvo vira caminho contínuo), trota até ~10 m e só corre de
 * longe. Nos dois casos há histerese no parar e no correr (antes: anda-para-anda e CORRER
 * piscando com o ponto na borda dos limites).
 */
function para(j, x, z, mag, correr = false, botoes = 0, pressa = false) {
  const s = j.ia;
  if (pressa) s.filtro = false;
  else if (!s.filtro) { s.fx = x; s.fz = z; s.filtro = true; }
  else {
    const ex = x - s.fx, ez = z - s.fz, e = MD.hypot(ex, ez), lim = IA.vAlvo * DT;
    if (e > lim) { s.fx += (ex / e) * lim; s.fz += (ez / e) * lim; } else { s.fx = x; s.fz = z; }
    x = s.fx; z = s.fz;
  }
  const dx = x - j.x, dz = z - j.z;
  const d = MD.hypot(dx, dz);
  if (d < IA.chegou || (s.parado && d < IA.retoma[pressa ? 1 : 0])) {
    s.parado = true; s.corre = false;
    return { x: 0, z: 0, botoes };
  }
  s.parado = false;
  // chega devagar no ponto (sem passar e voltar)
  const m = Math.min(mag, Math.max(pressa ? 0.25 : 0.2, d / (pressa ? 4 : IA.distCalma)));
  const [liga, desliga] = pressa ? IA.correPressa : IA.corre;
  s.corre = correr && d > (s.corre ? desliga : liga);
  if (!pressa && freiaNaLinha(j, dx, dz)) { s.corre = false; return { x: 0, z: 0, botoes }; }
  return { x: (dx / d) * m, z: (dz / d) * m, botoes: botoes | (s.corre ? BOTAO.CORRER : 0) };
}

/**
 * Sem pressa, pedido que inverte o sentido de quem ainda corre: freia na linha (analógico solto)
 * antes de virar. Antes o pedido virava na hora e o tronco girava a ~7 rad/s ainda a 3–4 m/s.
 */
function freiaNaLinha(j, x, z) {
  const v = MD.hypot(j.vx, j.vz);
  if (v < IA.freiaLinha[0]) return false;
  const l = MD.hypot(x, z);
  if (l < 1e-6) return false;
  return (x * j.vx + z * j.vz) / (l * v) < IA.freiaLinha[1];
}

/**
 * Primeiro ponto do caminho da bola (física pura) a que o jogador chega antes ou junto com ela
 * (correndo no máximo). Recalculado a cada poucos ticks; guarda em j.intercepta.
 */
export function pontoInterceptacao(m, j, aPartirDe = null) {
  if (j.intercepta && m.tick - j.intercepta.tick < 4) return j.intercepta;
  const n = aPartirDe ? 240 : 150;
  const pb = preverBola(m.bola, n);
  // enfiada: só vale encontrar a bola do ponto marcado em diante (ele corre para o espaço, não
  // volta para buscar)
  let i0 = 4;
  if (aPartirDe) {
    const vb = MD.hypot(m.bola.v.x, m.bola.v.z) || 1;
    const ux = m.bola.v.x / vb, uz = m.bola.v.z / vb;
    const sP = (aPartirDe.x - m.bola.p.x) * ux + (aPartirDe.z - m.bola.p.z) * uz - 1.5;
    let k = 4;
    while (k <= n && (pb.xs[k] - m.bola.p.x) * ux + (pb.zs[k] - m.bola.p.z) * uz < sP) k++;
    i0 = Math.min(k, n); // a bola não passa do ponto no horizonte: vai para onde ela para
  }
  const vmax = j.par.vArrancada;
  const s0 = MD.hypot(j.vx, j.vz);
  let melhor = null;
  for (let i = i0; i <= n; i += 3) {
    if (pb.ys[i] > 2.3) continue; // alto demais para dominar ali
    const d = Math.max(0, MD.hypot(pb.xs[i] - j.x, pb.zs[i] - j.z) - 0.5);
    // tempo de corrida: aceleração até a velocidade máxima (perfil simples)
    const tAcel = Math.max(0, (vmax - s0) / 7);
    const dAcel = (s0 + vmax) / 2 * tAcel;
    const t = d <= dAcel ? d / Math.max((s0 + vmax) / 2, 1) : tAcel + (d - dAcel) / vmax;
    if (t <= i * DT + 0.05) { melhor = { x: pb.xs[i], z: pb.zs[i], i, tick: m.tick }; break; }
  }
  if (!melhor) melhor = { x: pb.xs[n], z: pb.zs[n], i: n, tick: m.tick };
  j.intercepta = melhor;
  return melhor;
}

/**
 * Bola livre: este jogador é o do time dele que chega primeiro nela? Não vale se a bola é um
 * passe do próprio time para outro companheiro (ele recebe); passe do adversário vale (corta se
 * chegar antes do recebedor).
 */
function vaiNaBolaLivre(m, j) {
  if (j.posicao === 'GOL') return false;
  const v = m.voo;
  if (v && v.para != null && v.time === j.time && v.para !== j.id) return false;
  const b = m.bola;
  const t = o => MD.hypot(o.x - b.p.x, o.z - b.p.z) / o.par.vArrancada;
  const tj = t(j);
  for (const o of m.jogadores) {
    if (o === j || o.time !== j.time || o.posicao === 'GOL' || o.papel === 'parado' || o.papel === 'marcador') continue;
    const to = t(o);
    if (to < tj || (to === tj && o.id < j.id)) return false;
  }
  // passe do adversário: só vai se chegar antes do recebedor
  if (v && v.para != null && v.time !== j.time) {
    const r = m.jogadores.find(o => o.id === v.para);
    if (r && t(r) < tj) return false;
  }
  return true;
}

function dono(m) {
  return m.posse != null ? m.jogadores.find(o => o.id === m.posse) : null;
}

/** Botões virtuais de uma ação da IA: segura pelo tempo da força e solta. */
function acaoIA(m, j, tipo, forca) {
  const bot = { passe: BOTAO.PASSE, enfiada: BOTAO.ENFIADA, lancamento: BOTAO.LANCAMENTO, chute: BOTAO.CHUTE }[tipo];
  j.iaAcao = { bot, ate: m.tick + Math.max(2, Math.round(forca * ACOES.cargaCheia / DT)) };
}

/** Entrada virtual do jogador j (não controlado) neste tick. */
export function entradaIA(m, j) {
  const b = m.bola;
  // o ponto suavizado só vale se a IA guiou este jogador até o tick anterior (depois de um tempo
  // controlado pelo humano, recomeça do ponto pedido)
  const s = j.ia ??= { fx: 0, fz: 0, filtro: false, parado: false, corre: false, ataca: false, ramo: '', cond: -1, cvx: 0, cvz: 0, tick: -2 };
  if (m.tick - s.tick > 1) { s.filtro = false; s.parado = false; s.corre = false; s.ataca = false; }
  s.tick = m.tick;
  const lado = ataca(m, j.time);
  let extra = 0;
  if (j.iaAcao) {
    if (m.tick < j.iaAcao.ate) extra = j.iaAcao.bot;
    else j.iaAcao = null;
  }
  // recebendo um passe: vem ao encontro (passe) ou arranca para o ponto (enfiada, lançamento)
  if (j.recebe && m.posse !== j.id) {
    s.ramo = 'recebe';
    const r = j.recebe;
    if (m.tick - r.tick > 240 || (m.posse != null && m.posse !== j.id)) j.recebe = null;
    else if (r.tipo !== 'passe' && m.posse == null) {
      // enfiada/lançamento/cruzamento: corre para onde ELE e a BOLA chegam juntos
      const p = pontoInterceptacao(m, j, r.tipo === 'enfiada' ? r : null);
      if (p) return { ...para(j, p.x, p.z, 1, true, 0, true), botoes: extra | BOTAO.CORRER };
      return { ...para(j, r.x, r.z, 1, true, 0, true), botoes: extra | BOTAO.CORRER };
    } else if (r.tipo === 'passe') {
      // vem ao encontro: entra na LINHA da bola (o ponto do caminho que ele alcança primeiro),
      // trotando; o passe vem no pé, então são poucos passos
      if (m.posse == null && MD.hypot(b.v.x, b.v.z) > 0.5) {
        const p = pontoInterceptacao(m, j);
        return { ...para(j, p.x, p.z, 0.7, false, 0, true), botoes: extra };
      }
      return { ...para(j, r.x, r.z, 0.6, false, 0, true), botoes: extra };
    } else {
      return { ...para(j, r.x, r.z, 1, true, 0, true), botoes: extra | BOTAO.CORRER };
    }
  }
  if (j.corrida) {
    if (m.tick > j.corrida.ate || MD.hypot(j.corrida.x - j.x, j.corrida.z - j.z) < 1) j.corrida = null;
    else { s.ramo = 'corrida'; return { ...para(j, j.corrida.x, j.corrida.z, 1, true, 0, true), botoes: extra | BOTAO.CORRER }; }
  }
  const d0 = dono(m);
  // com a bola (IA): conduz para o gol e chuta; passa se apertado e houver companheiro livre
  if (m.posse === j.id) { s.ramo = 'comBola'; return comBola(m, j, lado, extra); }
  // bola livre (ninguém com ela): quem do time chega primeiro vai buscar
  if (m.posse == null && m.naMao == null && vaiNaBolaLivre(m, j)) {
    s.ramo = 'livre';
    const p = pontoInterceptacao(m, j);
    return { ...para(j, p.x, p.z, 1, true, 0, true), botoes: extra | BOTAO.CORRER };
  }
  // meu time com a bola — ou com um passe dele no ar (antes, durante o passe todos viravam
  // marcadores por um instante e voltavam: o "vai e volta" do time inteiro)
  const vooMeu = m.posse == null && m.voo && m.voo.time === j.time;
  s.ramo = (d0 && d0.time === j.time) || vooMeu ? 'apoio' : 'defesa';
  if (s.ramo === 'apoio') return apoio(m, j, d0 ?? { x: b.p.x, z: b.p.z }, lado, extra);
  return defesa(m, j, d0, lado, extra);
}

function comBola(m, j, lado, extra) {
  // goleiro com a bola nas mãos jogado pela IA no lugar do humano (demo do treino de ataque):
  // repõe como o goleiro da IA (sim.js goleiroComBola: lançamento depois de 1,5 s). Antes ele
  // só soltava a bola quando um adversário chegava perto (até 6 s com a bola parada).
  if (m.naMao === j.id) {
    if (!j.iaAcao && !j.pedido && !j.carga && m.tick - (j.segura?.desde ?? m.tick) > 90) acaoIA(m, j, 'lancamento', 0.7);
    return { x: 0, z: 0, botoes: j.iaAcao && m.tick < j.iaAcao.ate ? j.iaAcao.bot : 0 };
  }
  const gx = lado * CAMPO.meioX;
  const dGol = MD.hypot(gx - j.x, j.z);
  let botoes = extra;
  if (!j.iaAcao && !j.pedido && !j.carga) {
    // pressionado: tenta passar para o companheiro mais livre
    let pressao = Infinity;
    for (const o of m.jogadores) if (o.time !== j.time) pressao = Math.min(pressao, MD.hypot(o.x - j.x, o.z - j.z));
    if (dGol < 22 && Math.abs(j.z) < 18) acaoIA(m, j, 'chute', lerp(0.55, 0.85, (22 - dGol) / 22));
    else if (pressao < 2.2 && temCompanheiro(m, j)) acaoIA(m, j, 'passe', 0.5);
  }
  if (j.iaAcao && m.tick < j.iaAcao.ate) botoes |= j.iaAcao.bot;
  // conduz para o gol (um pouco para o meio)
  const tx = gx - lado * 6, tz = j.z * 0.6;
  const dx = tx - j.x, dz = tz - j.z;
  const d = MD.hypot(dx, dz) || 1;
  return { x: (dx / d) * 0.95, z: (dz / d) * 0.95, botoes: botoes | (dGol > 25 ? BOTAO.CORRER : 0) };
}

function temCompanheiro(m, j) {
  for (const o of m.jogadores) if (o.time === j.time && o.id !== j.id && o.posicao !== 'GOL') return true;
  return false;
}

/** Apoio sem bola (meu time com a bola): ocupa a vaga da posição, com corridas nas costas. */
function apoio(m, j, d0, lado, extra) {
  const v = j.vaga ?? { x: 0, z: 0 };
  // a vaga é relativa à bola: acompanha o avanço. Com a bola no goleiro, a referência é a saída de
  // jogo (IA.saidaGoleiro m à frente do meu gol) — antes os zagueiros corriam para a linha do gol
  const meuGolX = -lado * CAMPO.meioX;
  const bx = d0.posicao === 'GOL' ? meuGolX + lado * IA.saidaGoleiro : d0.x;
  let tx = bx + lado * v.x, tz = v.z;
  // atacante: de tempos em tempos corre nas costas da defesa (vem e vai)
  if (j.posicao === 'ATA') {
    const ciclo = (m.tick + j.id * 97) % 420;
    if (ciclo < 150) { tx = bx + lado * (v.x + 14); }
  }
  const lim = CAMPO.meioX - 2;
  tx = clamp(tx, -lim, lim);
  // com a bola no meu time, ninguém de linha recua a menos de IA.recuoMin m da minha linha de gol
  if ((tx - meuGolX) * lado < IA.recuoMin) tx = meuGolX + lado * IA.recuoMin;
  tz = clamp(tz, -CAMPO.meioZ + 2, CAMPO.meioZ - 2);
  // sem pressa: a intensidade vem da distância (para: d/IA.distCalma), sem degrau
  return { ...para(j, tx, tz, 1, true), botoes: extra };
}

/** Defesa sem bola: o mais perto pressiona o condutor; os outros marcam entre o adversário e o gol. */
function defesa(m, j, d0, lado, extra) {
  const b = m.bola;
  const meuGol = -lado * CAMPO.meioX;
  // quem pressiona: o mais perto da bola no meu time (sem o goleiro), com histerese — quem já
  // pressiona continua até outro estar IA.trocaPressao mais perto (antes trocava a cada toque na
  // bola e os dois ficavam no meio do caminho)
  const ps = (m.iaPressao ??= {})[j.time];
  let maisPerto = ps && ps.tick === m.tick ? m.jogadores.find(o => o.id === ps.id) : null;
  if (!maisPerto) {
    let dm = Infinity, atual = null, dAtual = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== j.time || o.posicao === 'GOL' || o.papel === 'parado') continue;
      const d = MD.hypot(o.x - b.p.x, o.z - b.p.z);
      if (d < dm) { dm = d; maisPerto = o; }
      if (ps && o.id === ps.id) { atual = o; dAtual = d; }
    }
    if (atual && dAtual < dm + IA.trocaPressao) maisPerto = atual;
    m.iaPressao[j.time] = { id: maisPerto?.id ?? -1, tick: m.tick };
  }
  if (maisPerto === j) {
    const s = j.ia;
    // bola solta do pé de quem conduz (entre toques) e EU mais perto dela que ele: ataca a bola.
    // Antes bastava a bola a > 0,7 m do pé: a cada toque o marcador arrancava na bola e voltava
    // (o tronco tremia); agora só vai quando chega antes, e segue até o condutor ficar mais perto.
    if (d0) {
      const dc = MD.hypot(b.p.x - d0.x, b.p.z - d0.z), dj = MD.hypot(b.p.x - j.x, b.p.z - j.z);
      s.ataca = s.ataca ? dj < dc + 0.3 : dc > ACOES.boteIA.bolaSolta && dj < dc - 0.2;
    } else s.ataca = false;
    s.ramo = s.ataca ? 'ataca' : 'pressiona';
    if (s.ataca) return { ...para(j, b.p.x, b.p.z, 1, true, 0, true), botoes: extra | BOTAO.CORRER };
    // acompanha entre a bola e o meu gol, a ~1,5 m (sem virar parede colada na bola), mirando
    // IA.antecipaPressao s à frente pela velocidade do condutor: chegando pelo erro, quem corria
    // com a bola deixava o marcador 3–5 m para trás
    // (velocidade filtrada em ~0,3 s e avanço de no máximo 3 m: com a velocidade crua o ponto
    // chicoteava a cada drible e o marcador girava a 7 rad/s com um pé no ar)
    const gx = meuGol - b.p.x, gz = -b.p.z, g = MD.hypot(gx, gz) || 1;
    const k = ACOES.boteIA.distAcompanha;
    let ax = 0, az = 0;
    if (d0) {
      if (s.cond !== d0.id) { s.cond = d0.id; s.cvx = d0.vx; s.cvz = d0.vz; }
      const a = DT / IA.filtroCondutor;
      s.cvx += (d0.vx - s.cvx) * a; s.cvz += (d0.vz - s.cvz) * a;
      ax = s.cvx * IA.antecipaPressao; az = s.cvz * IA.antecipaPressao;
      const l = MD.hypot(ax, az);
      if (l > IA.antecipaMax) { ax *= IA.antecipaMax / l; az *= IA.antecipaMax / l; }
    }
    const tx = b.p.x + (gx / g) * k + ax, tz = b.p.z + (gz / g) * k + az;
    return { ...para(j, tx, tz, 1, MD.hypot(tx - j.x, tz - j.z) > 4, 0, true), botoes: extra };
  }
  // marcação sem repetir: do atacante mais perto do meu gol para o mais longe, cada um fica com o
  // defensor livre mais perto dele (antes cada um marcava o adversário mais perto DELE: dois ou três
  // no mesmo homem, grudados e girando juntos). Quem sobra cobre entre a bola e o gol.
  const livres = m.jogadores.filter(o => o.time === j.time && o.posicao !== 'GOL' && o !== maisPerto
    && o.papel !== 'parado' && o.papel !== 'marcador');
  const advs = m.jogadores.filter(o => o.time !== j.time && o.posicao !== 'GOL' && o.papel !== 'parado'
    && o.papel !== 'marcador' && o.id !== m.posse)
    .sort((a, c) => MD.hypot(a.x - meuGol, a.z) - MD.hypot(c.x - meuGol, c.z) || a.id - c.id);
  let alvo = null;
  for (const o of advs) {
    let mel = -1, dm2 = Infinity;
    for (let k = 0; k < livres.length; k++) {
      const q = livres[k], d = MD.hypot(o.x - q.x, o.z - q.z);
      if (d < dm2 || (d === dm2 && q.id < livres[mel].id)) { dm2 = d; mel = k; }
    }
    if (mel < 0) break;
    if (livres[mel] === j) { alvo = o; break; }
    livres.splice(mel, 1);
  }
  if (!alvo) {
    // sobrou (mais defensores que atacantes): cobre a zona entre a bola e o gol, um de cada lado
    const gx = meuGol - b.p.x, gz = -b.p.z, g = MD.hypot(gx, gz) || 1;
    const k = Math.min(12, g * 0.5);
    j.ia.ramo = 'cobre';
    return { ...para(j, b.p.x + (gx / g) * k + (j.id % 2 ? 4 : -4), b.p.z + (gz / g) * k, 1, false), botoes: extra };
  }
  const gx = meuGol - alvo.x, gz = -alvo.z;
  const g = MD.hypot(gx, gz) || 1;
  const tx = alvo.x + (gx / g) * 1.8, tz = alvo.z + (gz / g) * 1.8;
  j.ia.ramo = 'marca';
  return { ...para(j, tx, tz, 1, MD.hypot(tx - j.x, tz - j.z) > 5), botoes: extra };
}
