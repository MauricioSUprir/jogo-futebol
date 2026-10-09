// GOLAÇO — página da Etapa 1 (treino de condução). DOM + three.js.
// Laço de passo fixo ("Fix Your Timestep!", Glenn Fiedler): a cada quadro avancarLaco diz
// quantos passos de 1/60 s rodar; para cada passo guardamos a pose ANTERIOR e calculamos a
// ATUAL de cada jogador (uma vez por passo) e a bola anterior/atual; o desenho INTERPOLA com
// alfa (bola por lerp + slerp do quaternion, juntas por interpolarPose). Igual a 60/120/144 Hz.
//
// Parâmetros: ?semente=N ?q=baixa|media|alta ?hora=dia|noite ?camera=tv|aproximada ?demo=1
// (conduz sozinho em curva) ?marcador=1 ?prints=1 (cena limpa) ?qps=1 ?toque=1 ?entalhe=1.
// Testes: window.__golaco (ver o fim do arquivo).

import * as THREE from 'three';
import { PASSO, BOTAO, QUALIDADE, VERSAO } from './config.js';
import { hashMundo, jogadorPorId } from './sim.js';
import { pose, interpolarPose, NJ } from './anim.js';
import { criarLaco, avancarLaco } from './laco.js';
import { emProtecao } from './conducao.js';
import { criarTreino, passoTreino, entradaDemo, DEMO, ID_HUMANO, marcadorLigado } from './sessao.js';
import { criarEntrada } from './entrada.js';
import { criarHud } from './hud.js';
import { criarCena } from './render/cena.js';
import { criarCampo } from './render/campo.js';
import { criarBola3D } from './render/bola3d.js';
import { criarJogadores3D } from './render/jogador3d.js';
import { criarCamera } from './render/camera.js';

const params = new URLSearchParams(location.search);
const PRINTS = params.get('prints') === '1';
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
if (PRINTS) hud.modoPrints();
document.documentElement.classList.toggle('noite', hora === 'noite');

// ------------------------------------------------------------------ estado da simulação
function novoMundo(opc) {
  const ini = DEMO_ON ? DEMO.inicio : { x: 0, z: 0, rumo: 0 };
  return criarTreino({ semente: SEMENTE, ...ini, marcador: params.get('marcador') === '1', ...opc });
}
let mundo = novoMundo();
const estJ = new Map();   // id → {ant, atu, des, x0, z0, x1, z1, r0, r1}
const bolaAnt = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
const bolaAtu = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
let contPassos = 0;
let alfa = 0;
const filaAcoes = [];

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
}
iniciarEstados();

function rodarPasso(entrada, acoes) {
  // anterior ← atual
  for (const j of mundo.jogadores) {
    const e = estadoDe(j);
    e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1;
  }
  bolaAnt.p.copy(bolaAtu.p); bolaAnt.q.copy(bolaAtu.q);
  const eventos = passoTreino(mundo, entrada, acoes);
  contPassos++;
  // atual ← pose deste passo (calculada uma vez por passo)
  const vivos = new Set();
  for (const j of mundo.jogadores) {
    vivos.add(j.id);
    const e = estadoDe(j);
    pose(j, mundo, e.atu);
    e.x1 = j.x; e.z1 = j.z; e.r1 = j.rumo;
    if (Math.hypot(e.x1 - e.x0, e.z1 - e.z0) > 2) { e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1; }
  }
  for (const id of [...estJ.keys()]) if (!vivos.has(id)) estJ.delete(id);
  copiarBolaDoMundo(bolaAtu);
  // bola teletransportada (recomeço, máquina): não desenha o rastro entre os dois pontos
  if (bolaAtu.p.distanceTo(bolaAnt.p) > 2.5) { bolaAnt.p.copy(bolaAtu.p); bolaAnt.q.copy(bolaAtu.q); }
  for (const ev of eventos) tratarEvento(ev);
}

function tratarEvento(ev) {
  hud.evento(ev.tipo);
  if (ev.tipo === 'marcadorLigado' || ev.tipo === 'marcadorDesligado') hud.definirEstado({ marcador: marcadorLigado(mundo) });
}

function modoDoJogador(j) {
  if (!j || mundo.posse !== j.id) return ['Sem bola', false];
  if (j.cond && j.cond.pedalada) return ['Pedalada', true];
  const mod = (j.botoes & BOTAO.MOD) !== 0;
  if (mod && emProtecao(mundo, j)) return ['Protegendo', true];
  if (mod) return ['Condução curta', false];
  const s = Math.hypot(j.vx, j.vz);
  if ((j.botoes & BOTAO.CORRER) && s > 5.5) return ['Arrancada', true];
  return ['Conduzindo', false];
}

// ------------------------------------------------------------------ 3D
let cena3d, campo, bola3d, jog3d, cam, entrada;
const laco = criarLaco();
// ?prints=1: relógio manual desde o início — a simulação só anda quando o script mandar
let relogioManual = PRINTS, tempoManual = 0;
let pausaTeste = false;
let ultimoQuadro = null;
let corteCamera = true;
let kmhVisto = 0;
const lista = [];
const render = { bola: { x: 0, y: 0, z: 0 }, jogador: { x: 0, z: 0 }, camera: { x: 0, y: 0, z: 0 }, quadros: 0, alfa: 0 };
const qpsMed = { t0: 0, n: 0, soma: 0 };
const adapt = { n: 0, soma: 0, ultimaTroca: 0, inicio: 0 };
const _qd = new THREE.Quaternion();
const _bp = { x: 0, y: 0, z: 0 };

function pausado() { return hud.menuAberto || hud.ajudaAberta; }

function desenharQuadro(dt, agoraMs, renderizar = true) {
  // bola interpolada
  _bp.x = lerp(bolaAnt.p.x, bolaAtu.p.x, alfa);
  _bp.y = lerp(bolaAnt.p.y, bolaAtu.p.y, alfa);
  _bp.z = lerp(bolaAnt.p.z, bolaAtu.p.z, alfa);
  _qd.slerpQuaternions(bolaAnt.q, bolaAtu.q, alfa);
  bola3d.atualizar(_bp, _qd);
  // jogadores interpolados
  let n = 0;
  let hx = 0, hz = 0;
  for (const j of mundo.jogadores) {
    const e = estJ.get(j.id);
    if (!e) continue;
    interpolarPose(e.ant, e.atu, alfa, e.des);
    const it = lista[n] ?? (lista[n] = {});
    it.id = j.id; it.time = j.time; it.pose = e.des; it.controlado = j.id === ID_HUMANO;
    it.x = lerp(e.x0, e.x1, alfa); it.z = lerp(e.z0, e.z1, alfa); it.rumo = lerpAng(e.r0, e.r1, alfa);
    if (it.controlado) { hx = it.x; hz = it.z; }
    n++;
  }
  lista.length = n;
  const h = jogadorPorId(mundo, ID_HUMANO);
  cam.atualizar(dt, { jx: hx, jz: hz, jvx: h ? h.vx : 0, jvz: h ? h.vz : 0, bx: _bp.x, bz: _bp.z }, corteCamera);
  corteCamera = false;
  const f = cam.foco();
  cena3d.acompanhar(f.x, f.z);
  jog3d.atualizar(lista, cam.camera);
  campo.atualizar(agoraMs / 1000);
  if (renderizar) cena3d.desenhar(cam.camera);
  render.bola.x = _bp.x; render.bola.y = _bp.y; render.bola.z = _bp.z;
  render.jogador.x = hx; render.jogador.z = hz;
  const cp = cam.camera.position;
  render.camera.x = cp.x; render.camera.y = cp.y; render.camera.z = cp.z;
  render.alfa = alfa;
  render.quadros++;
  // HUD
  if (h) {
    const kmh = Math.hypot(h.vx, h.vz) * 3.6;
    kmhVisto += (kmh - kmhVisto) * Math.min(1, dt * 8);
    const [modo, forte] = modoDoJogador(h);
    hud.atualizar(agoraMs, kmhVisto < 0.5 ? 0 : kmhVisto, modo, forte);
  }
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
      const e = DEMO_ON ? entradaDemo(mundo) : ent;
      rodarPasso(e, filaAcoes.length ? filaAcoes.splice(0) : null);
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
  cam.redimensionar(w / h);
}

// ------------------------------------------------------------------ ações e menu
function tratarAcao(a) {
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
  if (a === 'recomecar' || a === 'maquina' || a === 'marcador') {
    filaAcoes.push(a);
    if (a === 'recomecar') hud.evento('recomecar');
  }
}

function comando(c, v) {
  switch (c) {
    case 'continuar': hud.fecharMenu(); break;
    case 'recomecar': case 'maquina': case 'marcador':
      hud.fecharMenu(); filaAcoes.push(c); if (c === 'recomecar') hud.evento('recomecar'); break;
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
  const sombras = QUALIDADE[qAtual].sombras;
  bola3d.definirSombras(sombras);
  jog3d.definirSombras(sombras);
  entrada = criarEntrada({ forcarToque: params.get('toque') === '1', aoAcao: tratarAcao });
  redimensionar();
  window.addEventListener('resize', redimensionar);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', redimensionar);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) entrada.soltarTudo();
    else { laco.ultimo = null; ultimoQuadro = null; }
  });
  hud.definirEstado({
    qualidadeEscolha: escolhaQ, qualidadeAtual: qAtual, hora, camera: cam.modo, marcador: marcadorLigado(mundo),
    toqueTamanho: entrada.ajustes.tamanho, toqueOpacidade: entrada.ajustes.opacidade,
  });
  if (params.get('qps') === '1') hud.mostrarQps(true);
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
      else if (roteiro === 'demo') e = entradaDemo(mundo);
      else e = roteiro ?? { x: 0, z: 0, botoes: 0 };
      rodarPasso({ x: e.x ?? 0, z: e.z ?? 0, botoes: e.botoes ?? 0 }, ac);
    }
    return hashMundo(mundo);
  },
  /** Mundo novo com as opções de criarTreino (ex.: {semente: 7}). */
  reiniciar(opc = {}) {
    mundo = criarTreino({ semente: SEMENTE, ...opc });
    contPassos = 0; alfa = 0;
    laco.acum = 0; laco.ultimo = null;
    filaAcoes.length = 0;
    iniciarEstados();
    corteCamera = true;
    hud.definirEstado({ marcador: marcadorLigado(mundo) });
    return hashMundo(mundo);
  },
  relogio: {
    /** Relógio manual: o laço usa um tempo controlado (testes a 60/120/144 Hz). */
    usarManual(v = true) {
      relogioManual = !!v;
      tempoManual = performance.now();
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
  abrirAjuda() { hud.abrirAjuda(true); },
  fecharAjuda() { hud.fecharAjuda(); },
  estado() {
    const h = jogadorPorId(mundo, ID_HUMANO);
    const [modo] = modoDoJogador(h);
    return {
      tick: mundo.tick, posse: mundo.posse, modo, kmh: h ? Math.hypot(h.vx, h.vz) * 3.6 : 0,
      jogador: h ? { x: h.x, z: h.z, rumo: h.rumo } : null, bola: { ...mundo.bola.p },
      marcador: marcadorLigado(mundo), qualidade: qAtual, escolhaQualidade: escolhaQ, hora, camera: cam ? cam.modo : camInicial,
      desenhoChamadas: cena3d ? cena3d.info().render.calls : 0,
    };
  },
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
window.__golaco = api;

iniciar().catch(err => {
  console.error(err);
  hud.erro('Não foi possível iniciar o 3D: ' + (err && err.message ? err.message : String(err)));
});
