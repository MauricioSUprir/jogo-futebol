// GOLAÇO — página do jogo: a partida 11×11 (Etapa 3, abre nela) e os treinos (ataque da Etapa 2 e
// condução da Etapa 1, no menu "Modo de jogo" e por ?modo=ataque|conducao). DOM + three.js.
// Laço de passo fixo ("Fix Your Timestep!", Glenn Fiedler): a cada quadro avancarLaco diz
// quantos passos de 1/60 s rodar; para cada passo guardamos a pose ANTERIOR e calculamos a
// ATUAL de cada jogador (uma vez por passo) e a bola anterior/atual; o desenho INTERPOLA com
// alfa (bola por lerp + slerp do quaternion, juntas por interpolarPose). Igual a 60/120/144 Hz.
//
// Entradas POR TIME: o humano é o time 0 e quem recebe a entrada é o jogador m.controlado[0]
// (cai para o id 0 se o mundo ainda não tiver esse campo). A lógica chega aos poucos: tudo o que
// é da Etapa 2 (m.controlado, m.voo, m.placar, j.carga, m.proximaTroca, j.posicao) é lido com
// tolerância (?. e valor padrão).
//
// Partida (Etapa 3): criarPartida/passoPartida (partida.js) — o mesmo que sessao.js usa para o modo
// 'partida', chamado direto aqui. A pausa ganha "Editar time" (js/editor-time.js): a tela entrega
// uma EDIÇÃO que fica na fila (edicaoNaFila, uma por vez) e entra como ação-objeto no 1º passo
// depois da pausa — nunca uma escrita direta no mundo (determinismo e replay).
//
// Parâmetros: ?semente=N ?q=baixa|media|alta ?hora=dia|noite ?camera=tv|aproximada ?demo=1
// ?modo=partida|ataque|conducao (padrão da página: partida) ?min=N (minutos reais por tempo)
// ?marcador=1 ?prints=1 (cena limpa) ?qps=1 ?toque=1 ?entalhe=1.
// Testes: window.__golaco (ver o fim do arquivo).

import * as THREE from 'three';
import * as CFG from './config.js';
import { hashMundo, jogadorPorId } from './sim.js';
import { pose, interpolarPose, NJ } from './anim.js';
import { criarLaco, avancarLaco } from './laco.js';
import * as COND from './conducao.js';
import * as S from './sessao.js';
import { criarEntrada } from './entrada.js';
import { criarHud } from './hud.js';
import { criarCena } from './render/cena.js';
import { criarCampo } from './render/campo.js';
import { criarBola3D } from './render/bola3d.js';
import { criarJogadores3D } from './render/jogador3d.js';
import { criarCamera } from './render/camera.js';
import { criarMarcas } from './render/marcas.js';
import { criarPartida, passoPartida, entradaDemoPartida, minutoDeJogo } from './partida.js';
import { ELENCOS, elencoDoJogador, fichaDe } from './elenco.js';
import { criarEditorTime } from './editor-time.js';

const { PASSO, BOTAO, QUALIDADE, VERSAO } = CFG;
const ID_HUMANO = S.ID_HUMANO ?? 0;
const TIME_HUMANO = 0;

const params = new URLSearchParams(location.search);
const PRINTS = params.get('prints') === '1';
// modo da página: a partida (padrão) ou um dos treinos; o menu "Modo de jogo" troca sem recarregar
const MODOS = ['partida', 'ataque', 'conducao'];
let modoPagina = MODOS.includes(params.get('modo')) ? params.get('modo') : 'partida';
const MIN_PARAM = +params.get('min') > 0 ? +params.get('min') : undefined;
const DEMO_ON = params.get('demo') === '1';
const SEMENTE = Math.max(1, Math.floor(+params.get('semente') || 1));
const CHAVE_PREFS = 'golaco.prefs.v1';

if (params.get('entalhe') === '1') document.documentElement.classList.add('entalhe-simulado');

function lerPrefs() {
  try { return JSON.parse(localStorage.getItem(CHAVE_PREFS) || '{}') || {}; } catch (_) { return {}; }
}
function salvarPrefs(p) {
  try { localStorage.setItem(CHAVE_PREFS, JSON.stringify(p)); } catch (_) { /* sem armazenamento */ }
}
const prefs = lerPrefs();

// qualidade: ?q força; senão a escolha salva; senão automática (celular = média, PC = alta)
const ehCelular = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || Math.min(screen.width, screen.height) < 600;
const qAutoInicial = ehCelular ? 'media' : 'alta';
const qParam = params.get('q');
let escolhaQ = QUALIDADE[qParam] ? qParam : (QUALIDADE[prefs.qualidade] || prefs.qualidade === 'auto' ? prefs.qualidade : 'auto');
let qAtual = escolhaQ === 'auto' ? qAutoInicial : escolhaQ;
let hora = ['dia', 'noite'].includes(params.get('hora')) ? params.get('hora') : (prefs.hora === 'noite' ? 'noite' : 'dia');
const camInicial = ['tv', 'aproximada'].includes(params.get('camera')) ? params.get('camera') : (prefs.camera === 'aproximada' ? 'aproximada' : 'tv');

const lerp = (a, b, t) => a + (b - a) * t;
function lerpAng(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
const proximoQuadro = () => new Promise(r => requestAnimationFrame(() => r()));

function temWebGL2() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (_) { return false; }
}

const hud = criarHud({ aoComando: comando });
// "Editar time" (partida): a tela entrega a edição no PRONTO (aoPronto) e solta a entrada ao fechar
const editor = criarEditorTime({ raiz: document.getElementById('editar-time'), aoPronto: ed => aoPronto(ed), aoFechar: () => aoFecharEditor() });
if (PRINTS) hud.modoPrints();
document.documentElement.classList.toggle('noite', hora === 'noite');

// ------------------------------------------------------------------ estado da simulação
const marcadorLigado = m => (S.marcadorLigado ? S.marcadorLigado(m) : false);
/** Mundo novo: a partida (criarPartida) ou um treino (sessao.js), pelo modo pedido ou o da página. */
function criarMundoTreino(opc = {}) {
  const o = { semente: SEMENTE, ...opc };
  if (o.modo === undefined) o.modo = modoPagina;
  if (o.modo === 'partida') return criarPartida({ semente: o.semente, minutosPorTempo: o.minutosPorTempo ?? MIN_PARAM, saida: o.saida, times: o.times, elencos: o.elencos });
  return S.criarTreino(o);
}
/** Um passo: partida (passoPartida) ou treino (passoTreino) — as mesmas funções dos testes em Node. */
function passoDoMundo(m, e, acoes) { return m.modo === 'partida' ? passoPartida(m, e, acoes) : S.passoTreino(m, e, acoes); }
function entradaDemoDoMundo(m) { return m.modo === 'partida' ? entradaDemoPartida(m) : (S.entradaDemo ? S.entradaDemo(m) : null); }
function novoMundo(opc) {
  const ini = DEMO_ON && S.DEMO && modoPagina === 'conducao' ? S.DEMO.inicio : { x: 0, z: 0, rumo: 0 };
  return criarMundoTreino({ ...ini, marcador: params.get('marcador') === '1', ...opc });
}
let mundo = novoMundo();
const estJ = new Map();   // id → {ant, atu, des, x0, z0, x1, z1, r0, r1}
const bolaAnt = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
const bolaAtu = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
let contPassos = 0;
let alfa = 0;
const filaAcoes = [];
// edição do time vinda do "Editar time": entra (uma por vez) no 1º passo depois da pausa
let edicaoNaFila = null;

// medidas por quadro (medirQuadro): simulação, pose, atualização dos jogadores, desenho e o quadro
// inteiro sem o desenho (CPU que não é da GPU). Anéis de tamanho fixo (nada alocado por quadro).
const MQ = 4096;
const mq = { n: 0, i: 0, sim: new Float64Array(MQ), pose: new Float64Array(MQ), jog: new Float64Array(MQ), des: new Float64Array(MQ), cpu: new Float64Array(MQ), passos: new Uint8Array(MQ), aSim: 0, aPose: 0, aPassos: 0 };
const agoraMs = () => performance.now();

/** Id do jogador que o humano controla agora (Etapa 2: m.controlado[0]; Etapa 1: id 0). */
function idControlado() { return mundo.controlado?.[TIME_HUMANO] ?? ID_HUMANO; }
function controlado() { return jogadorPorId(mundo, idControlado()) ?? jogadorPorId(mundo, ID_HUMANO); }

/**
 * Entrada do humano no formato POR TIME ({0: {x, z, botoes}}). x/z/botoes também ficam no
 * próprio objeto (não enumeráveis) para o passoTreino que recebe a entrada do jogador direto:
 * os dois formatos leem os mesmos números (o hash não muda). Um objeto só, reaproveitado a cada
 * passo (a lógica lê os números no passo e não guarda a referência).
 */
const _entTime = { [TIME_HUMANO]: { x: 0, z: 0, botoes: 0 } };
Object.defineProperties(_entTime, {
  x: { value: 0, writable: true }, z: { value: 0, writable: true }, botoes: { value: 0, writable: true },
});
function entradaDoTime(e) {
  const x = e?.x ?? 0, z = e?.z ?? 0, botoes = (e?.botoes ?? 0) | 0;
  const d = _entTime[TIME_HUMANO];
  d.x = x; d.z = z; d.botoes = botoes;
  _entTime.x = x; _entTime.z = z; _entTime.botoes = botoes;
  return _entTime;
}

function estadoDe(j) {
  let e = estJ.get(j.id);
  if (!e) {
    e = { ant: new Float32Array(NJ * 3), atu: new Float32Array(NJ * 3), des: new Float32Array(NJ * 3), x0: j.x, z0: j.z, x1: j.x, z1: j.z, r0: j.rumo, r1: j.rumo };
    pose(j, mundo, e.atu);
    e.ant.set(e.atu);
    estJ.set(j.id, e);
  }
  return e;
}
function copiarBolaDoMundo(d) {
  const b = mundo.bola;
  d.p.set(b.p.x, b.p.y, b.p.z);
  d.q.set(b.q.x, b.q.y, b.q.z, b.q.w);
}
function iniciarEstados() {
  estJ.clear();
  for (const j of mundo.jogadores) estadoDe(j);
  copiarBolaDoMundo(bolaAtu);
  copiarBolaDoMundo(bolaAnt);
  fase.atual = faseDoMundo(); fase.defesaDesde = null;
}

function rodarPasso(entrada, acoes) {
  // anterior ← atual
  for (const j of mundo.jogadores) {
    const e = estadoDe(j);
    e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1;
  }
  bolaAnt.p.copy(bolaAtu.p); bolaAnt.q.copy(bolaAtu.q);
  const idAntes = idControlado();
  const t0 = agoraMs();
  const eventos = passoDoMundo(mundo, entradaDoTime(entrada), acoes) ?? mundo.eventos ?? [];
  const t1 = agoraMs();
  contPassos++;
  // atual ← pose deste passo (calculada uma vez por passo); quem saiu do mundo (marcador
  // desligado, substituição) perde o estado — sem alocar nada por passo
  for (const j of mundo.jogadores) {
    const e = estadoDe(j);
    pose(j, mundo, e.atu);
    e.x1 = j.x; e.z1 = j.z; e.r1 = j.rumo; e.visto = contPassos;
    if (Math.hypot(e.x1 - e.x0, e.z1 - e.z0) > 2) {
      e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1;
      // o controlado foi levado longe (montagem do recomeço, cobrador levado): a câmera corta
      if (j.id === idAntes) corteCamera = true;
    }
  }
  mq.aSim += t1 - t0; mq.aPose += agoraMs() - t1; mq.aPassos++;
  if (estJ.size > mundo.jogadores.length) for (const [id, e] of estJ) if (e.visto !== contPassos) estJ.delete(id);
  copiarBolaDoMundo(bolaAtu);
  // bola teletransportada (recomeço, máquina): não desenha o rastro entre os dois pontos
  if (bolaAtu.p.distanceTo(bolaAnt.p) > 2.5) { bolaAnt.p.copy(bolaAtu.p); bolaAnt.q.copy(bolaAtu.q); }
  for (const ev of eventos) tratarEvento(ev);
  atualizarFase();
}

// Ataque × defesa (botões de toque e Y do controle): ataque quando a bola é de um jogador do
// meu time (m.posse) ou viaja de um passe do meu time (m.voo.de) ou vem para o controlado
// (j.recebe); defesa caso contrário. Vira ataque na hora; defesa só depois de 0,25 s (uma bola
// solta por um instante entre o passe e o domínio não pisca os botões).
const fase = { atual: 'ataque', defesaDesde: null };
function timeDe(id) { return id == null ? null : (jogadorPorId(mundo, id)?.time ?? null); }
function faseDoMundo() {
  const m = mundo;
  if (m.posse != null) return timeDe(m.posse) === TIME_HUMANO ? 'ataque' : 'defesa';
  if (m.voo && timeDe(m.voo.de) === TIME_HUMANO) return 'ataque';
  const c = jogadorPorId(m, idControlado());
  if (c && c.recebe) return 'ataque';
  return 'defesa';
}
function atualizarFase() {
  const f = faseDoMundo();
  if (f === 'ataque') { fase.atual = 'ataque'; fase.defesaDesde = null; }
  else if (fase.atual !== 'defesa') {
    if (fase.defesaDesde == null) fase.defesaDesde = mundo.tick;
    if (mundo.tick - fase.defesaDesde >= 15) { fase.atual = 'defesa'; fase.defesaDesde = null; }
  }
  if (entrada) entrada.definirFase(fase.atual);
}

// eventos que só fazem sentido para o MEU time (os da IA encheriam a tela de avisos sem dono:
// "Bola perdida" de um zagueiro adversário, "Goleiro saiu do gol" do goleiro deles)
const SO_MEU_TIME = new Set(['passe', 'troca', 'perda', 'saidaGoleiro']);
const camisaDe = id => fichaDe(id)?.camisa ?? String(id);
const textoPlacar = () => {
  const t = hud.times;
  return `${t[0].sigla} ${mundo.placar?.[0] ?? 0} × ${mundo.placar?.[1] ?? 0} ${t[1].sigla}`;
};
function tratarEvento(ev) {
  const t = ev.tipo;
  // a troca automática no passe já aparece como o passe; a troca no jogo aéreo aparece no anel
  if (SO_MEU_TIME.has(t) && ev.id != null && timeDe(ev.id) !== TIME_HUMANO) return;
  if ((t === 'troca' && ev.auto) || t === 'trocaAerea' || t === 'cobranca') return;
  // recomeço (gol, bola fora, R) e saída de bola (gol, início do tempo): todos voltam às posições
  // — a câmera CORTA para a jogada nova (sem atravessar o campo) e o km/h não fica descendo
  if (t === 'recomeco' || t === 'saida') { corteCamera = true; kmhVisto = 0; }
  // partida: intervalo, fim, edição do time e substituição
  if (t === 'intervalo') {
    hud.faixa({ titulo: 'Intervalo', placar: textoPlacar(), ms: Math.round((CFG.PARTIDA?.intervalo ?? 3) * 1000) });
    return;
  }
  if (t === 'fimDeJogo') {
    hud.faixa({ titulo: 'Fim de jogo', placar: textoPlacar(), botao: true });
    hud.definirEstado({ fim: true });
    return;
  }
  if (t === 'timeEditado') {
    if (ev.time !== TIME_HUMANO) return;
    hud.evento(ev, { texto: ev.pendente ? 'Substituição na próxima parada' : 'Time atualizado' });
    return;
  }
  if (t === 'edicaoRecusada') {
    if (ev.time != null && ev.time !== TIME_HUMANO) return;
    hud.evento(ev, { texto: `Mudança recusada${ev.motivo ? ': ' + ev.motivo : ''}` });
    return;
  }
  if (t === 'substituicao') {
    if (ev.time !== TIME_HUMANO) { hud.evento(ev, { texto: `${hud.times[ev.time]?.sigla ?? ''}: sai ${camisaDe(ev.sai)}, entra ${camisaDe(ev.entra)}` }); return; }
    hud.evento(ev, { texto: `Substituição: sai ${camisaDe(ev.sai)}, entra ${camisaDe(ev.entra)}` });
    return;
  }
  // o MEU goleiro ficou com a bola na mão (o controle vai para ele): diz como repor — antes só
  // aparecia "O goleiro pegou" e quem não sabia ficava parado (a IA repõe sozinha em 3 s)
  if (t === 'defesa' && (ev.modo === 'encaixe' || ev.modo === 'pegou') && timeDe(ev.id) === TIME_HUMANO) {
    hud.evento({ tipo: 'repor' });
    return;
  }
  hud.evento(ev, { tipoVoo: mundo.voo?.tipo });
  if (t === 'marcadorLigado' || t === 'marcadorDesligado') hud.definirEstado({ marcador: marcadorLigado(mundo) });
}

// [texto, forte] — pares fixos (nada é alocado por quadro)
const MODO_J = {
  naMao: ['Bola na mão', true], semBola: ['Sem bola', false], pedalada: ['Pedalada', true],
  protegendo: ['Protegendo', true], curta: ['Condução curta', false], arrancada: ['Arrancada', true],
  conduzindo: ['Conduzindo', false],
};
function modoDoJogador(j) {
  if (j && mundo.naMao != null && mundo.naMao === j.id) return MODO_J.naMao;
  if (!j || mundo.posse !== j.id) return MODO_J.semBola;
  if (j.cond && j.cond.pedalada) return MODO_J.pedalada;
  const mod = (j.botoes & BOTAO.MOD) !== 0;
  if (mod && COND.emProtecao && COND.emProtecao(mundo, j)) return MODO_J.protegendo;
  if (mod) return MODO_J.curta;
  const s = Math.hypot(j.vx, j.vz);
  if ((j.botoes & BOTAO.CORRER) && s > 5.5) return MODO_J.arrancada;
  return MODO_J.conduzindo;
}

/** Força da carga (0–1, cheia em ACOES.cargaCheia s): usa j.carga.forca se a lógica der. */
function forcaDaCarga(cg) {
  if (typeof cg.forca === 'number') return Math.max(0, Math.min(1, cg.forca));
  const cheia = CFG.ACOES?.cargaCheia ?? 0.8;
  if (typeof cg.t0 === 'number') return Math.max(0, Math.min(1, ((mundo.tick - cg.t0) + alfa) * PASSO / cheia));
  return 0;
}

iniciarEstados();

// ------------------------------------------------------------------ 3D
let cena3d, campo, bola3d, jog3d, cam, entrada, marcas;
const laco = criarLaco();
// ?prints=1: relógio manual desde o início — a simulação só anda quando o script mandar
let relogioManual = PRINTS, tempoManual = 0;
let pausaTeste = false;
let ultimoQuadro = null;
let corteCamera = true;
let kmhVisto = 0;
const lista = [];
const render = { bola: { x: 0, y: 0, z: 0 }, jogador: { x: 0, z: 0 }, camera: { x: 0, y: 0, z: 0 }, quadros: 0, alfa: 0, queda: null };
const qpsMed = { t0: 0, n: 0, soma: 0 };
const adapt = { n: 0, soma: 0, ultimaTroca: 0, inicio: 0 };
const _qd = new THREE.Quaternion();
const _bp = { x: 0, y: 0, z: 0 };
const _proj = new THREE.Vector3();
const alvoCam = { jx: 0, jz: 0, jvx: 0, jvz: 0, bx: 0, bz: 0, ax: NaN, az: NaN };
/** Ponto do mundo → px CSS (sem alocar). */
function projetar(x, y, z, out) {
  _proj.set(x, y, z).project(cam.camera);
  out.x = (_proj.x + 1) / 2 * window.innerWidth; out.y = (1 - _proj.y) / 2 * window.innerHeight; out.atras = _proj.z > 1;
  return out;
}
const _pt = { x: 0, y: 0, atras: false };
const _carga = { x: 0, y: 0, forca: 0, tipo: '' };
const _queda = { x: 0, z: 0 };

function pausado() { return hud.menuAberto || hud.ajudaAberta || editor.aberto; }

// uniforme de cada jogador pelo elenco (partida); null no treino (o desenho usa o do time)
const kitCache = new Map();
function kitDe(j) {
  if (!mundo.times) return null;
  let k = kitCache.get(j.id);
  if (k === undefined) {
    const el = ELENCOS[elencoDoJogador(j.id)];
    k = el ? { linha: el.uniforme.linha, goleiro: el.uniforme.goleiro } : null;
    kitCache.set(j.id, k);
  }
  return k ? (j.posicao === 'GOL' ? k.goleiro : k.linha) : null;
}

function desenharQuadro(dt, agoraMs, renderizar = true) {
  const tq0 = performance.now();
  // bola interpolada
  _bp.x = lerp(bolaAnt.p.x, bolaAtu.p.x, alfa);
  _bp.y = lerp(bolaAnt.p.y, bolaAtu.p.y, alfa);
  _bp.z = lerp(bolaAnt.p.z, bolaAtu.p.z, alfa);
  _qd.slerpQuaternions(bolaAnt.q, bolaAtu.q, alfa);
  bola3d.atualizar(_bp, _qd);
  // jogadores interpolados (quantos houver, dos dois times)
  const idC = idControlado();
  const idProx = fase.atual === 'defesa' ? (mundo.proximaTroca?.[TIME_HUMANO] ?? null) : null;
  let n = 0;
  let hx = 0, hz = 0, achou = false;
  for (const j of mundo.jogadores) {
    const e = estJ.get(j.id);
    if (!e) continue;
    interpolarPose(e.ant, e.atu, alfa, e.des);
    const it = lista[n] ?? (lista[n] = {});
    it.id = j.id; it.time = j.time; it.pose = e.des; it.controlado = j.id === idC;
    it.goleiro = j.posicao === 'GOL'; it.proximo = idProx != null && j.id === idProx && !it.controlado;
    it.kit = kitDe(j);
    it.x = lerp(e.x0, e.x1, alfa); it.z = lerp(e.z0, e.z1, alfa); it.rumo = lerpAng(e.r0, e.r1, alfa);
    if (it.controlado) { hx = it.x; hz = it.z; achou = true; }
    n++;
  }
  lista.length = n;
  const tl1 = performance.now();
  const h = controlado();
  if (!achou && h) { hx = h.x; hz = h.z; }
  // câmera: controlado + bola; com a bola no ar, antecipa a queda (m.voo.alvo)
  const voo = mundo.voo;
  alvoCam.jx = hx; alvoCam.jz = hz; alvoCam.jvx = h ? h.vx : 0; alvoCam.jvz = h ? h.vz : 0;
  alvoCam.bx = _bp.x; alvoCam.bz = _bp.z;
  const vooAtivo = voo && voo.alvo && Number.isFinite(voo.alvo.x) && (voo.tickChegada == null || mundo.tick <= voo.tickChegada);
  alvoCam.ax = vooAtivo ? voo.alvo.x : NaN; alvoCam.az = vooAtivo ? voo.alvo.z : NaN;
  cam.atualizar(dt, alvoCam, corteCamera);
  corteCamera = false;
  const f = cam.foco();
  cena3d.acompanhar(f.x, f.z);
  const tj0 = performance.now();
  jog3d.atualizar(lista, cam.camera);
  const tj1 = performance.now();
  marcas.atualizar(mundo, _bp, agoraMs / 1000, dt);
  campo.atualizar(agoraMs / 1000);
  const td0 = performance.now();
  if (renderizar) cena3d.desenhar(cam.camera);
  const td1 = performance.now();
  render.bola.x = _bp.x; render.bola.y = _bp.y; render.bola.z = _bp.z;
  render.jogador.x = hx; render.jogador.z = hz;
  const cp = cam.camera.position;
  render.camera.x = cp.x; render.camera.y = cp.y; render.camera.z = cp.z;
  render.alfa = alfa;
  if (marcas.grupo.visible) { _queda.x = marcas.grupo.position.x; _queda.z = marcas.grupo.position.z; render.queda = _queda; }
  else render.queda = null;
  render.quadros++;
  // HUD
  if (h) {
    const kmh = Math.hypot(h.vx, h.vz) * 3.6;
    kmhVisto += (kmh - kmhVisto) * Math.min(1, dt * 8);
    const [modo, forte] = modoDoJogador(h);
    hud.atualizar(agoraMs, kmhVisto < 0.5 ? 0 : kmhVisto, modo, forte, h.posicao ?? null);
    // barra de força logo abaixo do anel do controlado
    if (h.carga) {
      projetar(hx, 0, hz + 0.8, _pt);
      if (_pt.atras) hud.carga(null);
      else { _carga.x = _pt.x; _carga.y = _pt.y + 6; _carga.forca = forcaDaCarga(h.carga); _carga.tipo = h.carga.tipo; hud.carga(_carga); }
    } else hud.carga(null);
  } else hud.carga(null);
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  hud.relogio(mundo.partida ? lerRelogio() : null);
  hud.minimapa(agoraMs, mundo, idC, idProx);
  // medidas do quadro (medirQuadro): o desenho (GPU por software aqui) fica de fora da CPU
  const fim = performance.now();
  const i = mq.i;
  mq.sim[i] = mq.aSim; mq.pose[i] = mq.aPose; mq.passos[i] = Math.min(255, mq.aPassos);
  mq.jog[i] = (tl1 - tq0) + (tj1 - tj0); // interpolação das poses + matrizes de todas as cápsulas
  mq.des[i] = td1 - td0;
  mq.cpu[i] = mq.aSim + mq.aPose + (fim - tq0) - (td1 - td0);
  mq.i = (i + 1) % MQ; mq.n = Math.min(MQ, mq.n + 1);
  mq.aSim = 0; mq.aPose = 0; mq.aPassos = 0;
}
const _rel = { minuto: 0, tempo: 1, estado: 'jogo' };
function lerRelogio() {
  _rel.minuto = minutoDeJogo(mundo); _rel.tempo = mundo.partida.tempo; _rel.estado = mundo.partida.estado;
  return _rel;
}

function quadro(agoraMs, desenhar = true) {
  const dtReal = ultimoQuadro === null ? PASSO : Math.max(0, (agoraMs - ultimoQuadro) / 1000);
  ultimoQuadro = agoraMs;
  const dt = Math.min(0.1, dtReal);
  const ent = entrada.ler(cam.yaw);
  for (const a of entrada.consumirAcoes()) tratarAcao(a);
  if (pausado() || pausaTeste) {
    laco.ultimo = agoraMs;     // ao voltar, não tenta recuperar o tempo parado
  } else {
    const r = avancarLaco(laco, agoraMs);
    for (let i = 0; i < r.passos; i++) {
      const e = DEMO_ON ? (entradaDemoDoMundo(mundo) ?? ent) : ent;
      let ac = filaAcoes.length ? filaAcoes.splice(0) : null;
      // a edição do time entra ANTES das outras ações, no 1º passo depois da pausa
      if (edicaoNaFila) { ac = ac ? [edicaoNaFila, ...ac] : [edicaoNaFila]; edicaoNaFila = null; }
      rodarPasso(e, ac);
      // o aperto curto (tocou e soltou entre dois passos) já foi visto por um passo
      if (i === 0) { entrada.limparPulsos(); ent.botoes = entrada.ler(cam.yaw).botoes; }
    }
    alfa = r.alfa;
  }
  desenharQuadro(dt, agoraMs, desenhar);
  medirQps(dtReal, agoraMs);
  adaptarQualidade(dtReal, agoraMs);
}

function medirQps(dt, agora) {
  if (!hud.qpsVisivel) return;
  qpsMed.n++; qpsMed.soma += dt;
  if (agora - qpsMed.t0 > 500) {
    const qps = qpsMed.soma > 0 ? qpsMed.n / qpsMed.soma : 0;
    const info = cena3d.info();
    hud.qps(`${qps.toFixed(0)} qps · ${(1000 * qpsMed.soma / Math.max(1, qpsMed.n)).toFixed(1)} ms\n${info.render.calls} chamadas · ${(info.render.triangles / 1000).toFixed(0)} mil tri\nqualidade ${qAtual}`);
    qpsMed.t0 = agora; qpsMed.n = 0; qpsMed.soma = 0;
  }
}

/** Qualidade automática: cai um nível se ficar abaixo de ~48 qps (alta) ou ~30 qps (média). */
function adaptarQualidade(dt, agora) {
  if (escolhaQ !== 'auto' || PRINTS || relogioManual || pausado() || document.hidden) { adapt.n = 0; adapt.soma = 0; return; }
  if (agora - adapt.inicio < 3000) return;
  adapt.n++; adapt.soma += dt;
  if (adapt.soma < 2.5) return;
  const qps = adapt.n / adapt.soma;
  adapt.n = 0; adapt.soma = 0;
  if (agora - adapt.ultimaTroca < 4000) return;
  const minimo = qAtual === 'alta' ? 48 : qAtual === 'media' ? 30 : 0;
  if (qps < minimo) {
    qAtual = qAtual === 'alta' ? 'media' : 'baixa';
    aplicarQualidade(false);
    adapt.ultimaTroca = agora;
  }
}

function aplicarQualidade(recriar) {
  cena3d.definirQualidade(qAtual, recriar);
  const sombras = QUALIDADE[qAtual].sombras;
  bola3d.definirSombras(sombras);
  jog3d.definirSombras(sombras);
  redimensionar();
  hud.definirEstado({ qualidadeEscolha: escolhaQ, qualidadeAtual: qAtual });
}

function redimensionar() {
  const w = window.innerWidth, h = window.innerHeight;
  cena3d.redimensionar(w, h);
  // celular (menor lado < 520 px CSS): a câmera fecha mais o plano (jogadores maiores)
  cam.redimensionar(w / h, Math.min(w, h) < 520);
}

// ------------------------------------------------------------------ ações e menu
function tratarAcao(a) {
  // com o editor aberto nada chega ao jogo: só a pausa (Start do controle), que aplica e fecha
  if (editor.aberto) { if (a === 'pausa') editor.voltar(); return; }
  if (a === 'pausa') {
    if (hud.ajudaAberta) { hud.fecharAjuda(); return; }
    if (hud.menuAberto) hud.fecharMenu(); else { entrada.soltarTudo(); hud.abrirMenu(); }
    return;
  }
  if (a === 'ajuda') {
    if (hud.ajudaAberta) hud.fecharAjuda(); else { entrada.soltarTudo(); hud.abrirAjuda(); }
    return;
  }
  if (a === 'qps') { hud.mostrarQps(!hud.qpsVisivel); return; }
  if (pausado()) return;
  if (a === 'camera') { comando('camera', cam.modo === 'tv' ? 'aproximada' : 'tv'); return; }
  // R/M/N: só nos treinos (R não recomeça a partida sem confirmação: isso é "Reiniciar partida")
  if (mundo.modo === 'partida' && (a === 'recomecar' || a === 'maquina' || a === 'marcador')) { hud.evento('soTreino'); return; }
  if (a === 'marcador' && mundo.modo === 'ataque') { hud.evento('semMarcador'); return; }
  if (a === 'recomecar' || a === 'maquina' || a === 'marcador') {
    filaAcoes.push(a);
    if (a === 'recomecar') hud.evento('recomecar');
  }
}

/** Abre o "Editar time" (partida): a pausa some e a tela mostra o time (ou a edição na fila). */
function abrirEditor() {
  if (mundo.modo !== 'partida' || !mundo.times) return false;
  hud.fecharMenu(); hud.fecharAjuda();
  entrada?.soltarTudo();
  entrada?.bloquear?.(true);
  editor.abrir({ time: structuredClone(mundo.times[TIME_HUMANO]), fila: edicaoNaFila, timeId: TIME_HUMANO });
  return true;
}
/** PRONTO no editor: a edição (ou nada) vai para a fila e a pausa volta, com o foco no Editar time. */
function aoPronto(ed) {
  edicaoNaFila = ed ?? null;
  hud.abrirMenu(true, '[data-cmd="editar-time"]');
}
function aoFecharEditor() {
  entrada?.soltarTudo();
  entrada?.bloquear?.(false);
}
/** Troca o modo da página (partida ou treino) sem recarregar; o endereço guarda a escolha. */
function trocarModo(v) {
  if (!MODOS.includes(v)) return;
  modoPagina = v;
  try {
    const u = new URL(location.href);
    if (v === 'partida') u.searchParams.delete('modo'); else u.searchParams.set('modo', v);
    history.replaceState(null, '', u);
  } catch (_) { /* sem history (arquivo local): segue */ }
  trocarMundo(novoMundo());
}

function comando(c, v) {
  switch (c) {
    case 'continuar': hud.fecharMenu(); break;
    case 'recomecar': case 'maquina': case 'marcador':
      hud.fecharMenu();
      if (mundo.modo === 'partida') { hud.evento('soTreino'); break; }
      if (c === 'marcador' && mundo.modo === 'ataque') { hud.evento('semMarcador'); break; }
      filaAcoes.push(c); if (c === 'recomecar') hud.evento('recomecar'); break;
    case 'editar-time': abrirEditor(); break;
    case 'reiniciar-partida':
      hud.fecharMenu();
      if (mundo.modo !== 'partida') break;
      trocarMundo(novoMundo());
      hud.evento('reinicio');
      break;
    case 'modos': hud.submenuModos(true); break;
    case 'modos-voltar': hud.submenuModos(false); break;
    case 'modo': hud.fecharMenu(); trocarModo(v); break;
    case 'ajuda': hud.abrirAjuda(); break;
    case 'tela-cheia':
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else {
        document.documentElement.requestFullscreen({ navigationUI: 'hide' })
          .then(() => (screen.orientation && screen.orientation.lock ? screen.orientation.lock('landscape') : null))
          .catch(() => { /* o navegador recusou: segue sem tela cheia */ });
      }
      break;
    case 'fechar-ajuda': hud.fecharAjuda(); break;
    case 'qualidade':
      if (v !== 'auto' && !QUALIDADE[v]) break;
      escolhaQ = v;
      qAtual = v === 'auto' ? qAutoInicial : v;
      adapt.ultimaTroca = performance.now();
      aplicarQualidade(true);
      prefs.qualidade = v; salvarPrefs(prefs);
      break;
    case 'hora':
      if (v !== 'dia' && v !== 'noite') break;
      hora = v; cena3d.definirHora(v); campo.definirHora(v);
      document.documentElement.classList.toggle('noite', v === 'noite');
      hud.definirEstado({ hora: v });
      prefs.hora = v; salvarPrefs(prefs);
      break;
    case 'camera':
      if (v !== 'tv' && v !== 'aproximada') break;
      cam.definirModo(v);
      hud.definirEstado({ camera: v });
      prefs.camera = v; salvarPrefs(prefs);
      break;
    case 'toqueTamanho': entrada.definirAjustes({ tamanho: v }); hud.definirEstado({ toqueTamanho: entrada.ajustes.tamanho }); break;
    case 'toqueOpacidade': entrada.definirAjustes({ opacidade: v }); hud.definirEstado({ toqueOpacidade: entrada.ajustes.opacidade }); break;
    default: break;
  }
}

// ------------------------------------------------------------------ início
async function iniciar() {
  if (!temWebGL2()) {
    hud.erro('Este navegador não tem WebGL 2, que o GOLAÇO precisa para o 3D. Atualize o navegador ou ative a aceleração de hardware.');
    return;
  }
  hud.progresso('Preparando o gramado…');
  await proximoQuadro();
  const canvas = document.getElementById('tela');
  cena3d = criarCena({ canvas, qualidade: qAtual, hora });
  cam = criarCamera(window.innerWidth / window.innerHeight);
  cam.definirModo(camInicial);
  campo = criarCampo({ qualidade: qAtual, aniso: cena3d.anisotropia() });
  cena3d.cena.add(campo.grupo);
  campo.definirHora(hora);
  hud.progresso('Montando os jogadores…');
  await proximoQuadro();
  bola3d = criarBola3D(cena3d.cena, qAtual);
  jog3d = criarJogadores3D(cena3d.cena, qAtual);
  marcas = criarMarcas(cena3d.cena);
  const sombras = QUALIDADE[qAtual].sombras;
  bola3d.definirSombras(sombras);
  jog3d.definirSombras(sombras);
  entrada = criarEntrada({ forcarToque: params.get('toque') === '1', aoAcao: tratarAcao, aoMudarLayout: () => hud.ajustarTopo() });
  atualizarFase();
  redimensionar();
  window.addEventListener('resize', redimensionar);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', redimensionar);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) entrada.soltarTudo();
    else { laco.ultimo = null; ultimoQuadro = null; }
  });
  hud.definirEstado({
    qualidadeEscolha: escolhaQ, qualidadeAtual: qAtual, hora, camera: cam.modo, marcador: marcadorLigado(mundo), modoTreino: mundo.modo,
    toqueTamanho: entrada.ajustes.tamanho, toqueOpacidade: entrada.ajustes.opacidade, fim: false,
  });
  hud.definirTimes(timesDoMundo(mundo));
  if (params.get('qps') === '1') hud.mostrarQps(true);
  hud.ajustarTopo();
  // primeiro quadro (compila os shaders) e some a tela de carregamento
  desenharQuadro(PASSO, performance.now());
  adapt.inicio = performance.now();
  hud.pronto();
  api.pronto = true;
  const aoQuadro = t => {
    requestAnimationFrame(aoQuadro);
    if (!relogioManual) quadro(t);
  };
  requestAnimationFrame(aoQuadro);
}

/** Siglas e nomes do placar: os do elenco na partida; null nos treinos (o HUD usa os dele). */
function timesDoMundo(m) {
  if (!m.times) return null;
  return [0, 1].map(t => { const e = ELENCOS[m.times[t].elenco]; return { sigla: e.sigla, nome: e.nome }; });
}

function trocarMundo(m) {
  mundo = m;
  contPassos = 0; alfa = 0;
  laco.acum = 0; laco.ultimo = null;
  filaAcoes.length = 0;
  edicaoNaFila = null;
  kitCache.clear();
  if (editor.aberto) editor.fechar();
  iniciarEstados();
  corteCamera = true;
  if (entrada) entrada.definirFase(fase.atual);
  hud.definirEstado({ marcador: marcadorLigado(mundo), modoTreino: mundo.modo, fim: false });
  hud.definirTimes(timesDoMundo(mundo));
  hud.faixa(null);
  return hashMundo(mundo);
}

/** Resumo de uma série de medidas (ms): média, p95 e máximo. */
function resumo(arr, n, ini) {
  if (!n) return { media: 0, p95: 0, max: 0 };
  const v = new Float64Array(n);
  for (let k = 0; k < n; k++) v[k] = arr[(ini + k) % MQ];
  let soma = 0, max = 0;
  for (let k = 0; k < n; k++) { soma += v[k]; if (v[k] > max) max = v[k]; }
  v.sort();
  return { media: soma / n, p95: v[Math.min(n - 1, Math.floor(0.95 * n))], max };
}

// ------------------------------------------------------------------ interface para os testes
const api = {
  versao: VERSAO,
  pronto: false,
  get mundo() { return mundo; },
  hash() { return hashMundo(mundo); },
  get passos() { return contPassos; },
  get alfa() { return alfa; },
  render,
  get qualidade() { return qAtual; },
  get hora() { return hora; },
  get camera() { return cam ? cam.modo : camInicial; },
  /** Para o laço automático da simulação (o desenho continua). */
  pausar(v = true) { pausaTeste = !!v; if (!v) laco.ultimo = null; },
  /**
   * Roda n passos já (síncrono). roteiro: [{x, z, botoes, acoes?}] (um por passo),
   * {x, z, botoes} fixo, 'demo' ou nada (parado). Devolve o hash do mundo.
   */
  rodarPassos(n, roteiro) {
    for (let i = 0; i < n; i++) {
      let e, ac = null;
      if (Array.isArray(roteiro)) { e = roteiro[Math.min(i, roteiro.length - 1)]; ac = e.acoes ?? null; }
      else if (roteiro === 'demo') e = entradaDemoDoMundo(mundo);
      else e = roteiro;
      e = e ?? { x: 0, z: 0, botoes: 0 };
      // a edição na fila (Editar time / editarTime) entra no 1º passo, como no laço da página
      if (edicaoNaFila) { ac = ac ? [edicaoNaFila, ...ac] : [edicaoNaFila]; edicaoNaFila = null; }
      rodarPasso({ x: e.x ?? 0, z: e.z ?? 0, botoes: e.botoes ?? 0 }, ac);
    }
    return hashMundo(mundo);
  },
  /**
   * Mundo novo: {modo: 'partida' | 'ataque' | 'conducao', semente, minutosPorTempo (partida), ...as
   * opções de criarTreino}. Sem modo, o da página (partida, ou o do ?modo=). Devolve o hash.
   */
  reiniciar(opc = {}) {
    return trocarMundo(criarMundoTreino(opc));
  },
  /** Põe uma edição do time na fila (entra no próximo passo, como a do "Editar time"). */
  editarTime(ed) { edicaoNaFila = ed ?? null; },
  get edicaoNaFila() { return edicaoNaFila; },
  /** Cópia de m.times[t] (partida) ou null. */
  estadoTime(t = TIME_HUMANO) { return mundo.times?.[t] ? structuredClone(mundo.times[t]) : null; },
  /** A tela "Editar time" (aberto, abrir, voltar = PRONTO, esc, aba, rascunho). */
  editor: {
    get aberto() { return editor.aberto; },
    abrir() { return abrirEditor(); },
    voltar() { return editor.voltar(); },
    esc() { return editor.esc(); },
    get aba() { return editor.aba; },
    get modo() { return editor.modo; },
    get rascunho() { return editor.rascunho; },
  },
  /**
   * Tempos por quadro (ms) desde a última vez que foi zerado: sim (simulação), pose, jogadores
   * (atualização das matrizes de todos), desenho (render; GPU por software no headless) e cpu (o
   * quadro inteiro SEM o desenho: sim + pose + jogadores + câmera/HUD). opc.zerar recomeça.
   */
  medirQuadro(opc = {}) {
    const n = mq.n, ini = (mq.i - n + MQ) % MQ;
    let passos = 0;
    for (let k = 0; k < n; k++) passos += mq.passos[(ini + k) % MQ];
    const r = {
      quadros: n, passos,
      sim: resumo(mq.sim, n, ini), pose: resumo(mq.pose, n, ini), jogadores: resumo(mq.jog, n, ini),
      desenho: resumo(mq.des, n, ini), cpu: resumo(mq.cpu, n, ini),
    };
    if (opc.zerar) { mq.n = 0; mq.i = 0; mq.aSim = 0; mq.aPose = 0; mq.aPassos = 0; }
    return r;
  },
  /** Troca o mundo inteiro (testes e prints de conferência montam um mundo à parte). */
  trocarMundo(m) { return trocarMundo(m); },
  /** Ataque × defesa (estado do mundo, com a espera de 0,25 s para a defesa). */
  get fase() { return fase.atual; },
  /** Botões de toque: reaplica a fase visível e muda o tamanho (testes de layout). */
  sincronizarFase() { entrada.definirFase(fase.atual); entrada.sincronizarFase(); },
  toqueTamanho(v) { comando('toqueTamanho', v); },
  relogio: {
    /** Relógio manual: o laço usa um tempo controlado (testes a 60/120/144 Hz). */
    usarManual(v = true) {
      relogioManual = !!v;
      // nunca volta no tempo (o HUD e os avisos comparam com o último instante visto)
      tempoManual = Math.max(tempoManual, performance.now());
      laco.ultimo = null; ultimoQuadro = null;
    },
    /** Avança o relógio manual em ms e roda um quadro já (simulação, câmera e desenho).
     *  opc.desenhar = false atualiza tudo mas pula só o render (prints mais rápidos). */
    avancar(ms, opc = {}) {
      tempoManual += ms;
      quadro(tempoManual, opc.desenhar !== false);
      return { passos: contPassos, alfa, bola: { ...render.bola } };
    },
    get agora() { return tempoManual; },
  },
  forcarEntrada(e) { entrada.forcar(e); },
  acao(a) { tratarAcao(a); },
  definirQualidade(nome) { comando('qualidade', nome); },
  definirHora(h) { comando('hora', h); },
  definirCamera(m) { comando('camera', m); },
  abrirMenu() { hud.abrirMenu(true); },
  fecharMenu() { hud.fecharMenu(); },
  /** Faixa do intervalo/fim por cima dos prints (conferência do HUD). */
  mostrarFaixa(f) { hud.faixa(f, true); },
  /** Modo da página (partida, ataque, conducao), como o menu "Modo de jogo". */
  trocarModo(v) { comando('modo', v); },
  get modoPagina() { return modoPagina; },
  abrirAjuda() { hud.abrirAjuda(true); },
  fecharAjuda() { hud.fecharAjuda(); },
  estado() {
    const h = controlado();
    const [modo] = modoDoJogador(h);
    return {
      tick: mundo.tick, posse: mundo.posse, modo, kmh: h ? Math.hypot(h.vx, h.vz) * 3.6 : 0,
      jogador: h ? { id: h.id, x: h.x, z: h.z, rumo: h.rumo, botoes: h.botoes | 0, posicao: h.posicao ?? null, carga: h.carga ? { ...h.carga } : null } : null,
      bola: { ...mundo.bola.p },
      controlado: idControlado(), proximaTroca: mundo.proximaTroca?.[TIME_HUMANO] ?? null, fase: fase.atual,
      placar: [mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0], voo: mundo.voo ? { ...mundo.voo } : null,
      jogadores: mundo.jogadores.length, modoTreino: mundo.modo ?? null, logicaEtapa2: 'controlado' in mundo,
      // partida (Etapa 3)
      times: mundo.times ? { 0: resumoTime(mundo.times[0]), 1: resumoTime(mundo.times[1]) } : null,
      relogio: mundo.partida ? { tempo: mundo.partida.tempo, minuto: minutoDeJogo(mundo), estado: mundo.partida.estado } : null,
      parada: mundo.parada ? { ...mundo.parada } : null,
      edicaoNaFila: !!edicaoNaFila, editorAberto: editor.aberto, menuAberto: hud.menuAberto,
      marcador: marcadorLigado(mundo), qualidade: qAtual, escolhaQualidade: escolhaQ, hora, camera: cam ? cam.modo : camInicial,
      desenhoChamadas: cena3d ? cena3d.info().render.calls : 0,
      // memória na GPU (vazamento = número que cresce com o tempo)
      geometrias: cena3d ? cena3d.info().memory.geometries : 0,
      texturas: cena3d ? cena3d.info().memory.textures : 0,
    };
  },
  /** Escreve um modo/posição no painel do HUD já (testes de layout com o texto mais longo). */
  hudModo(texto, posicao = null) { hud.atualizar(performance.now(), 0, texto, false, posicao); },
  /** Mostra o aviso de um evento ({tipo, ...}) mesmo no modo de prints (conferência do HUD). */
  mostrarEvento(ev) { hud.evento(ev, { tipoVoo: mundo.voo?.tipo }, true); },
  /** Desenha um quadro sem avançar nada (prints). */
  desenhar() { desenharQuadro(0, relogioManual ? tempoManual : performance.now()); },
  /** Câmera livre para prints de conferência ({de:[x,y,z], para:[x,y,z], fov?}) ou null. */
  cameraLivre(l) { cam.definirLivre(l); },
  /** Ponto do mundo → pixel CSS na tela (testes: "direita no analógico = direita na tela"). */
  naTela(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(cam.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
  },
};
function resumoTime(t) {
  return { elenco: t.elenco, formacao: t.formacao, vagas: { ...t.vagas }, tatica: { ...t.tatica }, pendente: t.pendente ? structuredClone(t.pendente) : null, saiu: [...t.saiu], subs: { ...t.subs }, versao: t.versao };
}
window.__golaco = api;

iniciar().catch(err => {
  console.error(err);
  hud.erro('Não foi possível iniciar o 3D: ' + (err && err.message ? err.message : String(err)));
});
