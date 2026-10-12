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
// Estádio (render, não mexe no mundo nem no hash): a cada passo a bola antes/depois do passo procura
// batidas na rede (rede-onda.js) — a rede estufa no shader e a bola DESENHADA vai junto no bojo; os
// eventos do passo e a posição da bola alimentam o ânimo da torcida (emocao.js), que move a torcida 3D
// (torcida.js) e o som (som.js, Web Audio, liga no primeiro gesto). Gol: só "GOL!" (sem autor nem
// minuto escritos — sem narração na tela, dono 10/10; o autor de verdade fica em autor-gol.js para a API e os
// prints), placar pulsando e, na partida, CORTE para a
// câmera do gol (camera.js CAMERA_GOL: a rede estufando e a torcida atrás do gol) até a saída de bola; no treino,
// zoom/tremor leve que acaba no recomeço. Intervalo e fim: plano geral do estádio. O 'saida' do começo da partida
// (criado antes do 1º passo) também passa pela torcida e pelo som (apito pendente até o 1º gesto). Relógio do
// estádio: passosTotais (não volta a zero ao trocar de mundo), parado na pausa.
//
// Replay (render; pedidos do dono de 11/10): a cada passo, logo depois da pose, o anel (render/replay-anel.js) copia o
// que vai ser desenhado — os últimos 10 s ficam guardados. Depois do gol (na saída de bola; a comemoração entra antes,
// pelo gancho diretor.depoisDoGol), no apito do impedimento (a linha só no quadro do passe) e no "Replay" da pausa, o
// diretor (render/replay.js) toca o trecho com as câmeras do replay e a SIMULAÇÃO FICA PARADA, como na pausa: o hash no
// mesmo tick é o mesmo com e sem replay. Qualquer tecla, botão, clique ou toque pula; "REPLAY" discreto no canto (marca
// da transmissão, não narração); "Pular" no toque. "Replays automáticos" na pausa (?replay=0 desliga).
//
// Comemoração do gol (render; pedido do dono de 11/10: "não tem cena de comemoração!!!"): no gol da partida a cena pura
// (js/comemoracao.js) copia os 22 e anda no relógio do DESENHO; a página desenha os atores dela no lugar dos da simulação,
// com a câmera de cinema (camera.js definirCinema) depois do plano da rede. A SIMULAÇÃO NÃO MUDA: ela segue até o passo
// antes da montagem da saída (gol + 149) e o laço espera ali enquanto a cena roda (a saída sai no mesmo tick, com o mesmo
// hash); a entrada do humano não vai para a simulação durante a cena (ele assiste). Ordem: gol → comemoração → replay →
// saída. Pular (um aperto NOVO, tecla, clique ou toque, depois de 0,5 s) acaba só a comemoração; o replay tem o pulo dele.
// Pulada antes da hora, os passos que faltam até a saída rodam em poucos quadros com a cena parada e a faixa passando.
//
// Parâmetros: ?semente=N ?q=baixa|media|alta ?hora=dia|noite ?camera=tv|aproximada ?demo=1
// ?modo=partida|ataque|conducao (padrão da página: partida) ?min=N (minutos reais por tempo)
// ?marcador=1 ?prints=1 (cena limpa) ?qps=1 ?toque=1 ?entalhe=1 ?replay=0|1 ?comemoracao=0|1
// ?prejogo=0|1|curto|escalacao.
// Pré-jogo (pedido de 11/10; render/prejogo.js): antes do 1º passo da partida — a simulação fica no tick 0 e o apito da
// saída só toca no fim dele. Desligado por padrão nos testes (navigator.webdriver), nos prints e na demonstração.
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
import { criarLinhaImpedimento } from './render/linha-impedimento.js';
import { criarMarcasLateral } from './render/marcas-lateral.js';
import { mascaraGolaco } from './render/texturas.js';
import { criarTorcida } from './render/torcida.js';
import { criarOndas, limparOndas, detectarImpactos, registrarImpacto, uniformsRede, empurraoBola, redeAtiva, deslocamento, fixo as fixoRede } from './render/rede-onda.js';
import { criarEmocao, zerarEmocao, emocaoEvento, emocaoPasso, consumirDisparos } from './render/emocao.js';
import { forcarFesta } from './render/festa.js';
import { criarAutorGol, zerarAutorGol, autorEventos } from './render/autor-gol.js';
import { criarSom } from './render/som.js';
import { criarPartida, passoPartida, entradaDemoPartida, minutoDeJogo, acrescimoDeJogo, regrasPartida, teleportar } from './partida.js';
import { montarFalta } from './faltas.js';
import { ELENCOS, elencoDoJogador, fichaDe } from './elenco.js';
import { criarEditorTime } from './editor-time.js';
import { criarPrejogo } from './render/prejogo.js';
import { PREJOGO } from './prejogo-roteiro.js';
import { criarAnel, lerQuadro, tempoEstadio as tempoEstadioAnel } from './render/replay-anel.js';
import { criarDiretor } from './render/replay.js';
import {
  planejarComemoracao, criarCena as criarCenaComemoracao, avancarCena, planoCamera, criarPlanoCamera, faseCena,
  tempoCena, duracaoCena, infoAtores,
} from './comemoracao.js';

const { PASSO, BOTAO, QUALIDADE, VERSAO, FALTAS } = CFG;
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
// Tela limpa (dono, 11/10): o minimapa e os nomes nos botões de toque são opções da pausa. Minimapa sem escolha
// salva: desligado no celular e ligado no PC (o CSS decide por html.com-toque); nomes: desligados (só o ícone).
function aplicarTelaLimpa() {
  const r = document.documentElement;
  r.classList.toggle('mapa-ligado', prefs.minimapa === 'ligado');
  r.classList.toggle('mapa-desligado', prefs.minimapa === 'desligado');
  r.classList.toggle('nomes-botoes', prefs.nomesBotoes === true);
}
const minimapaLigado = () => (prefs.minimapa ? prefs.minimapa === 'ligado' : !document.documentElement.classList.contains('com-toque'));
aplicarTelaLimpa();

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
// Replay: o anel (alocado uma vez) e o diretor (criado no iniciar(): câmeras three.js). replayAuto: o ajuste da pausa
// (?replay=0|1 força; senão o salvo; senão REPLAY.automatico).
const anel = criarAnel({ ticks: Math.round(CFG.REPLAY.segundos / PASSO), vagas: CFG.REPLAY.vagas, nj: NJ });
let diretor = null;
let replayAuto = params.get('replay') === '0' ? false : params.get('replay') === '1' ? true : typeof prefs.replay === 'boolean' ? prefs.replay : CFG.REPLAY.automatico;
const custoGravar = { n: 0, ms: 0 }, custoReplay = { n: 0, ms: 0 };
const listaR = [];
const _bpR = { x: 0, y: 0, z: 0 }, _bqR = { x: 0, y: 0, z: 0, w: 1 }, _qR = new THREE.Quaternion();
let replayBotoes = 0;     // botões já segurados quando o replay começou: só pulam depois de soltos e apertados de novo
const somAdiado = [];     // sons do passo que abriu o replay do gol (o apito da saída): tocam quando ele acaba
let depoisReplay = null;  // faixa do intervalo/fim que espera o replay do gol acabar
let linhaNoReplay = null; // tick do apito cujo impedimento já passou no replay (a linha parada não se repete ao vivo)
// Comemoração (js/comemoracao.js): ?comemoracao=0|1 força; senão COMEMORACAO.ligada. cenaGol = a cena em andamento;
// cenaEstado: 'rodando' (o laço segura a simulação no passo antes da saída), 'solta' (acabou ou pulou: a simulação
// segue até a saída, que descarta a cena; pulada antes da hora, `cenaRapida` roda os passos que faltam em poucos quadros)
const COMEM = CFG.COMEMORACAO;
let comemoracaoLigada = params.get('comemoracao') === '0' ? false : params.get('comemoracao') === '1' ? true : COMEM.ligada;
let cenaGol = null, cenaEstado = null, cenaRapida = false, cenaCortou = false;
let cenaBotoes = 0;          // botões segurados no começo (ou apertados antes de poder pular): só valem soltos e de novo
let ultimaFinal = null;      // a finalização do gol anterior (a próxima não repete)
let forcarFinal = null;      // testes e prints: a finalização do próximo gol
const planoCam = criarPlanoCamera();
const custoCena = { n: 0, ms: 0 };
const ENTRADA_NEUTRA = { x: 0, z: 0, botoes: 0 };
const PASSOS_GOL = Math.round(CFG.PARTIDA.golPausa / PASSO);
const bolaAnt = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
const bolaAtu = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
let contPassos = 0;
let alfa = 0;
// estádio: rede que balança e ânimo da torcida, no relógio do desenho (passosTotais nunca volta a zero)
let passosTotais = 0;
const ondas = criarOndas();
const emocao = criarEmocao();
const autorGol = criarAutorGol();
const _p0 = { x: 0, y: 0, z: 0 }, _v0 = { x: 0, y: 0, z: 0 };
const _impactos = [];
const _ctxEmocao = { t: 0, timeDe: id => timeDe(id), bola: null, ataca: null };
const _passoEmocao = { t: 0, bola: null, posseTime: null, ataca: null, estado: null };
/** Tempo do estádio (s) do estado desenhado: o passo atual menos 1 mais alfa. */
const tempoEstadio = () => Math.max(0, (passosTotais - 1 + alfa) * PASSO);
const filaAcoes = [];
// edição do time vinda do "Editar time": entra (uma por vez) no 1º passo depois da pausa
let edicaoNaFila = null;

// medidas por quadro (medirQuadro): simulação, pose, atualização dos jogadores, desenho e o quadro
// inteiro sem o desenho (CPU que não é da GPU). Anéis de tamanho fixo (nada alocado por quadro).
const MQ = 4096;
const mq = { n: 0, i: 0, sim: new Float64Array(MQ), pose: new Float64Array(MQ), jog: new Float64Array(MQ), des: new Float64Array(MQ), cpu: new Float64Array(MQ), passos: new Uint8Array(MQ), aSim: 0, aPose: 0, aPassos: 0, aCena: 0 };
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
  // a simulação andou com um replay tocando (só pela API dos testes: o laço da página para no replay): o replay acaba
  if (diretor && diretor.ativo) fimReplay(false);
  // anterior ← atual
  for (const j of mundo.jogadores) {
    const e = estadoDe(j);
    e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1;
  }
  bolaAnt.p.copy(bolaAtu.p); bolaAnt.q.copy(bolaAtu.q);
  const idAntes = idControlado();
  const bb = mundo.bola;
  _p0.x = bb.p.x; _p0.y = bb.p.y; _p0.z = bb.p.z; _v0.x = bb.v.x; _v0.y = bb.v.y; _v0.z = bb.v.z;
  const t0 = agoraMs();
  const eventos = passoDoMundo(mundo, entradaDoTime(entrada), acoes) ?? mundo.eventos ?? [];
  const t1 = agoraMs();
  contPassos++;
  passosTotais++;
  estadioPasso(eventos);
  // atual ← pose deste passo (calculada uma vez por passo); quem saiu do mundo (marcador
  // desligado, substituição) perde o estado — sem alocar nada por passo
  let cortou = false;
  for (const j of mundo.jogadores) {
    const e = estadoDe(j);
    pose(j, mundo, e.atu);
    e.x1 = j.x; e.z1 = j.z; e.r1 = j.rumo; e.visto = contPassos;
    if (Math.hypot(e.x1 - e.x0, e.z1 - e.z0) > 2) {
      e.ant.set(e.atu); e.x0 = e.x1; e.z0 = e.z1; e.r0 = e.r1;
      // o controlado foi levado longe (montagem do recomeço, cobrador levado): a câmera corta
      if (j.id === idAntes) corteCamera = true;
      cortou = true;
    }
  }
  mq.aSim += t1 - t0; mq.aPose += agoraMs() - t1; mq.aPassos++;
  if (estJ.size > mundo.jogadores.length) for (const [id, e] of estJ) if (e.visto !== contPassos) estJ.delete(id);
  copiarBolaDoMundo(bolaAtu);
  // bola teletransportada (recomeço, máquina): não desenha o rastro entre os dois pontos
  if (bolaAtu.p.distanceTo(bolaAnt.p) > 2.5) { bolaAnt.p.copy(bolaAtu.p); bolaAnt.q.copy(bolaAtu.q); cortou = true; }
  gravarNoAnel(cortou);
  for (const ev of eventos) tratarEvento(ev);
  atualizarFase();
}

/**
 * Grava o passo no anel do replay: só COPIA o que o desenho já calculou (a pose deste passo, x/z/rumo, a bola) e o
 * relógio do estádio. Nada é lido além disso e nada é escrito no mundo (o hash não muda); nada é alocado.
 */
function gravarNoAnel(cortou) {
  const tg = agoraMs();
  anel.inicio(mundo.tick, passosTotais * PASSO, cortou);
  let v = 0;
  for (const j of mundo.jogadores) {
    const e = estJ.get(j.id);
    if (e) anel.jogador(v++, j.id, j.time, j.posicao === 'GOL', e.x1, e.z1, e.r1, e.atu);
  }
  anel.fim(bolaAtu.p, bolaAtu.q);
  custoGravar.n++; custoGravar.ms += agoraMs() - tg;
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

const camisaDe = id => fichaDe(id)?.camisa ?? String(id);
/** Fim dos efeitos do gol (saída de bola, recomeço do treino): o "GOL!" sai e a câmera de jogo volta. */
function encerrarEfeitosGol() {
  if (cam && cam.efeitoAtivo) { cam.encerrarGol(); corteCamera = true; }
  hud.esconderGol();
}
const textoPlacar = () => {
  const t = hud.times;
  return `${t[0].sigla} ${mundo.placar?.[0] ?? 0} × ${mundo.placar?.[1] ?? 0} ${t[1].sigla}`;
};
function tratarEvento(ev) {
  const t = ev.tipo;
  // gol: "GOL!" (sem autor nem minuto escritos: nada de narração na tela), placar pulsando e o efeito da câmera
  if (t === 'gol') {
    hud.evento(ev);
    // partida: corte para a câmera do gol (até a saída); treino: zoom/tremor leve (até o recomeço)
    if (cam) cam.efeitoGol((mundo.bola.p.x > 0 ? 1 : -1) * CFG.CAMPO.meioX, mundo.bola.p.z, { fechado: !!mundo.partida });
    // replay: o gol fica pendente até o pós-gol chegar na vez dele (o chute que vale o gol: autor-gol.js)
    if (diretor && mundo.partida) diretor.aoGol({ golTick: mundo.tick, chuteTick: autorGol.chute.ativo ? autorGol.chute.tick : null, lado: mundo.bola.p.x > 0 ? 1 : -1 });
    // comemoração (só na partida): começa já, da cópia do mundo neste tick
    if (mundo.partida && comemoracaoLigada) iniciarComemoracao(ev);
    return;
  }
  // a saída (ou o intervalo, o fim, um recomeço) chegou: a cena da comemoração acaba (o replay entra a seguir)
  if (cenaGol && (t === 'saida' || t === 'intervalo' || t === 'fimDeJogo' || t === 'recomeco')) encerrarComemoracao();
  if ((t === 'troca' && ev.auto) || t === 'trocaAerea' || t === 'cobranca') return;
  // recomeço (gol, bola fora, R) e saída de bola (gol, início do tempo): todos voltam às posições
  // — a câmera CORTA para a jogada nova (sem atravessar o campo) e o km/h não fica descendo
  // (o "GOL!" e a câmera do gol acabam aqui: no treino a bola volta em 1 s — contraprova M8)
  if (t === 'recomeco' || t === 'saida' || t === 'cobrancaPenalti' || t === 'corteBolaParada') { corteCamera = true; kmhVisto = 0; encerrarEfeitosGol(); if (cam) cam.planoGeral(false); }
  // depois do gol, o replay entra na saída de bola (com todos já montados: o roteiro para antes do corte)
  if (t === 'saida' && diretor?.golPendente) posGol();
  // impedimento: o replay no apito, com a linha no quadro do passe (a foto da Regra 11: ev.tickFoto)
  if (t === 'impedimento' && replayAuto && diretor && mundo.partida) {
    const ro = diretor.impedimento({ fotoTick: ev.tickFoto, apitoTick: mundo.tick, linhaX: ev.linhaX, idImpedido: ev.id, time: ev.time, lado: mundo.ataca?.[ev.time] ?? 1 });
    if (iniciarReplay(ro)) linhaNoReplay = mundo.tick;
  }
  // partida: intervalo, fim, edição do time e substituição (intervalo e fim: plano geral do estádio). Gol no último
  // lance do tempo: o replay dele vem antes da faixa
  if (t === 'intervalo') {
    const faixa = () => hud.faixa({ titulo: 'Intervalo', placar: textoPlacar(), ms: Math.round((CFG.PARTIDA?.intervalo ?? 3) * 1000) });
    encerrarEfeitosGol();
    if (cam) cam.planoGeral(true);
    if (diretor?.golPendente && posGol()) depoisReplay = faixa; else faixa();
    return;
  }
  if (t === 'fimDeJogo') {
    const faixa = () => hud.faixa({ titulo: 'Fim de jogo', placar: textoPlacar(), botao: true });
    hud.definirEstado({ fim: true });
    encerrarEfeitosGol();
    if (cam) cam.planoGeral(true);
    if (diretor?.golPendente && posGol()) depoisReplay = faixa; else faixa();
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
    // só a do MEU time (a confirmação do que pedi na pausa); a do adversário seria narração
    if (ev.time !== TIME_HUMANO) return;
    hud.evento(ev, { texto: `Substituição: sai ${camisaDe(ev.sai)}, entra ${camisaDe(ev.entra)}` });
    return;
  }
  // lances (passe, chute, defesa, lateral...) não viram texto: o hud só mostra o gol e os comandos
  // (o goleiro com a bola na mão repõe sozinho em 3 s — GOLEIRO.esperaHumano)
  hud.evento(ev);
  if (t === 'marcadorLigado' || t === 'marcadorDesligado') hud.definirEstado({ marcador: marcadorLigado(mundo) });
}

/**
 * Estádio, uma vez por passo (depois do passo, só lendo o mundo): batidas da bola na rede → ondas da rede
 * e o "chuá"; eventos e bola → ânimo da torcida; disparos de som. Nada aqui escreve no mundo.
 */
function estadioPasso(eventos) {
  const b = mundo.bola;
  const tFim = passosTotais * PASSO;
  // autor de verdade do gol (último toque pelos eventos; tratarEvento usa no "GOL!")
  autorEventos(autorGol, eventos, mundo.tick, timeDe);
  const n = detectarImpactos(_p0, _v0, b.p, b.v, _impactos);
  _ctxEmocao.t = tFim; _ctxEmocao.bola = b.p; _ctxEmocao.ataca = mundo.ataca;
  for (let k = 0; k < n; k++) {
    // a batida foi dentro do passo: meio passo antes do fim
    if (registrarImpacto(ondas, _impactos[k], tFim - PASSO / 2)) emocaoEvento(emocao, { tipo: 'redeImpacto', vel: _impactos[k].vel }, _ctxEmocao);
  }
  for (const ev of eventos) emocaoEvento(emocao, ev, _ctxEmocao);
  const p = _passoEmocao;
  p.t = tFim; p.bola = b.p; p.ataca = mundo.ataca; p.estado = mundo.partida?.estado ?? null;
  p.posseTime = mundo.posse != null ? timeDe(mundo.posse) : (mundo.voo ? (mundo.voo.time ?? timeDe(mundo.voo.de)) : (mundo.partida?.ultimoTime ?? null));
  emocaoPasso(emocao, p, PASSO);
  const ds = consumirDisparos(emocao);
  // o passo que abre o replay do gol (saída de bola, intervalo, fim): o apito dele toca DEPOIS do replay
  const adiar = replayAuto && !!diretor?.golPendente && !!mundo.partida && eventos.some(e => e.tipo === 'saida' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo');
  if (som) for (const d of ds) { if (adiar) somAdiado.push(d); else som.tocar(d); }
}

/**
 * Eventos que o mundo já traz ANTES do 1º passo (criarPartida deixa o 'saida' do começo): o 1º passo os
 * limpa, então passam aqui pela torcida e pelo som — o apito do início (contraprova I5; sem gesto ainda, o
 * som.js guarda o apito pendente até o som ser liberado).
 */
function eventosIniciais() {
  const evs = mundo.eventos ?? [];
  if (!evs.length) return;
  const b = mundo.bola;
  _ctxEmocao.t = passosTotais * PASSO; _ctxEmocao.bola = b.p; _ctxEmocao.ataca = mundo.ataca;
  for (const ev of evs) emocaoEvento(emocao, ev, _ctxEmocao);
  const ds = consumirDisparos(emocao);
  if (som) for (const d of ds) som.tocar(d);
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
let cena3d, campo, bola3d, jog3d, cam, entrada, marcas, linhaImped, marcasLat, torcida, som = null;
let prejogo = null;
const laco = criarLaco();
// ?prints=1: relógio manual desde o início — a simulação só anda quando o script mandar
let relogioManual = PRINTS, tempoManual = 0;
let pausaTeste = false;
let ultimoQuadro = null;
let corteCamera = true;
let kmhVisto = 0;
const lista = [];
// posição DESENHADA (interpolada no quadro) do jogador `id` — os marcadores do gramado andam com o corpo desenhado
const _posDes = { x: 0, z: 0 };
function posDesenhada(id) {
  for (const it of lista) if (it.id === id) { _posDes.x = it.x; _posDes.z = it.z; return _posDes; }
  return null;
}
const render = { bola: { x: 0, y: 0, z: 0 }, jogador: { x: 0, z: 0 }, camera: { x: 0, y: 0, z: 0 }, quadros: 0, alfa: 0, queda: null };
const qpsMed = { t0: 0, n: 0, soma: 0 };
const adapt = { n: 0, soma: 0, ultimaTroca: 0, inicio: 0 };
const _qd = new THREE.Quaternion();
const _bp = { x: 0, y: 0, z: 0 };
const _bpDes = { x: 0, y: 0, z: 0 }, _emp = { x: 0, y: 0, z: 0 };
// testes: desliga a onda da rede só no desenho (o mesmo quadro com e sem a deformação)
let redeLigada = true;
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

// Celular em pé: o jogo só roda deitado (dono, 10/10: "é obrigatório virar o celular pra jogar").
// A tela "Gire o celular" (index.html #girar, mostrada pelo CSS com a mesma media query) cobre tudo
// e o jogo fica parado até deitar. Só com toque: janela estreita no PC continua jogando.
const mqRetrato = window.matchMedia('(orientation: portrait)');
function retratoBloqueado() { return mqRetrato.matches && document.documentElement.classList.contains('com-toque'); }

function pausado() { return hud.menuAberto || hud.ajudaAberta || editor.aberto || retratoBloqueado(); }

// uniforme de cada jogador pelo elenco (partida); null no treino (o desenho usa o do time)
const kitCache = new Map();
function kitDoId(id, goleiro) {
  if (!mundo.times) return null;
  let k = kitCache.get(id);
  if (k === undefined) {
    const el = ELENCOS[elencoDoJogador(id)];
    k = el ? { linha: el.uniforme.linha, goleiro: el.uniforme.goleiro } : null;
    kitCache.set(id, k);
  }
  return k ? (goleiro ? k.goleiro : k.linha) : null;
}
const kitDe = j => kitDoId(j.id, j.posicao === 'GOL');

function desenharQuadro(dt, agoraMs, renderizar = true) {
  const tq0 = performance.now();
  // bola interpolada
  _bp.x = lerp(bolaAnt.p.x, bolaAtu.p.x, alfa);
  _bp.y = lerp(bolaAnt.p.y, bolaAtu.p.y, alfa);
  _bp.z = lerp(bolaAnt.p.z, bolaAtu.p.z, alfa);
  _qd.slerpQuaternions(bolaAnt.q, bolaAtu.q, alfa);
  // a bola DESENHADA vai junto no bojo da rede (o ponto da física fica em render.bola)
  const tEst = tempoEstadio();
  if (redeLigada) empurraoBola(ondas, _bp, tEst, _emp); else { _emp.x = 0; _emp.y = 0; _emp.z = 0; }
  _bpDes.x = _bp.x + _emp.x; _bpDes.y = _bp.y + _emp.y; _bpDes.z = _bp.z + _emp.z;
  bola3d.atualizar(_bpDes, _qd);
  uniformsRede(ondas, redeLigada ? tEst : -1e9, campo.rede.a, campo.rede.b);
  // jogadores interpolados (quantos houver, dos dois times)
  const idC = idControlado();
  const idProx = fase.atual === 'defesa' ? (mundo.proximaTroca?.[TIME_HUMANO] ?? null) : null;
  let n = 0;
  let hx = 0, hz = 0, achou = false;
  if (cenaGol) {
    // comemoração: os atores da cena (cópias andando no relógio dela) no lugar dos da simulação; sem anel do controlado
    const al = cenaGol.alfa;
    for (const a of cenaGol.atores) {
      const des = a.des ?? (a.des = new Float32Array(NJ * 3));
      interpolarPose(a.ant, a.atu, al, des);
      const it = lista[n] ?? (lista[n] = {});
      it.id = a.id; it.time = a.time; it.pose = des; it.controlado = false; it.goleiro = a.goleiro; it.proximo = false;
      it.kit = kitDoId(a.id, a.goleiro);
      it.x = lerp(a.x0, a.x1, al); it.z = lerp(a.z0, a.z1, al); it.rumo = lerpAng(a.r0, a.r1, al);
      n++;
    }
  } else for (const j of mundo.jogadores) {
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
  if (cenaGol) cameraComemoracao();
  cam.atualizar(dt, alvoCam, corteCamera);
  corteCamera = false;
  const f = cam.foco();
  cena3d.acompanhar(f.x, f.z);
  const tj0 = performance.now();
  jog3d.atualizar(lista, cam.camera);
  const tj1 = performance.now();
  if (cenaGol) {
    // comemoração: nada do jogo ao vivo no gramado (queda da bola, opções do lateral, linha)
    marcas.grupo.visible = false;
    marcasLat.atualizar(mundo, semPosicao, agoraMs / 1000, dt);
    linhaImped.mostrar(null);
  } else {
    marcas.atualizar(mundo, _bp, agoraMs / 1000, dt);
    // a linha do lance já passou (congelada) no replay do impedimento: não fica parada de novo no jogo
    const ui = mundo.partida?.ultimoImped;
    if (linhaNoReplay != null && ui && ui.tick === linhaNoReplay && mundo.partida.estado !== 'jogo') linhaImped.mostrar(null);
    else linhaImped.atualizar(mundo, dt);
    marcasLat.atualizar(mundo, posDesenhada, agoraMs / 1000, dt);
  }
  campo.atualizar(agoraMs / 1000, cam.camera, renderizar);
  torcida.atualizar(agoraMs / 1000, emocao, cam.camera, som ? som.relogioBatida : null, renderizar);
  if (som) som.atualizar(emocao, pausado(), agoraMs / 1000);
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
  if (h && !cenaGol) {
    // intervalo e fim: o mundo fica parado (o corpo guarda a velocidade de antes, o painel mostra 0)
    const parado = mundo.partida && (mundo.partida.estado === 'intervalo' || mundo.partida.estado === 'fim');
    const kmh = parado ? 0 : Math.hypot(h.vx, h.vz) * 3.6;
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
  // cartão do árbitro em cima de quem levou (por FALTAS.icone s; o expulso no lugar em que estava)
  const uc = mundo.partida?.ultimoCartao;
  if (uc && !cenaGol && mundo.tick >= uc.tick && (mundo.tick - uc.tick) * PASSO < FALTAS.icone) {
    const jc = mundo.jogadores.find(q => q.id === uc.id);
    projetar(jc ? jc.x : uc.x, 2.25, jc ? jc.z : uc.z, _pt);
    if (_pt.atras) hud.cartao(null); else { _cartao.x = _pt.x; _cartao.y = _pt.y; _cartao.cor = uc.cor; hud.cartao(_cartao); }
  } else hud.cartao(null);
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  hud.relogio(mundo.partida ? lerRelogio() : null);
  hud.minimapa(agoraMs, mundo, idC, idProx);
  // medidas do quadro (medirQuadro): o desenho (GPU por software aqui) fica de fora da CPU
  const fim = performance.now();
  const i = mq.i;
  mq.sim[i] = mq.aSim; mq.pose[i] = mq.aPose; mq.passos[i] = Math.min(255, mq.aPassos);
  mq.jog[i] = (tl1 - tq0) + (tj1 - tj0); // interpolação das poses + matrizes de todas as cápsulas
  mq.des[i] = td1 - td0;
  mq.cpu[i] = mq.aSim + mq.aPose + mq.aCena + (fim - tq0) - (td1 - td0);
  mq.i = (i + 1) % MQ; mq.n = Math.min(MQ, mq.n + 1);
  mq.aSim = 0; mq.aPose = 0; mq.aPassos = 0; mq.aCena = 0;
}
// ------------------------------------------------------------------ comemoração
/** Começa a cena no tick do gol: o plano (autor de verdade: autor-gol.js) e a cópia dos 22 (o mundo não é tocado). */
function iniciarComemoracao(ev) {
  const g = autorGol.gol, deAgora = g.ativo && g.tick === mundo.tick;
  const gol = { tick: mundo.tick, time: deAgora ? g.time : ev.time, id: deAgora ? g.id : (ev.autor ?? null), contra: deAgora ? g.contra : false };
  const plano = planejarComemoracao(mundo, gol, { timeHumano: TIME_HUMANO, ultima: ultimaFinal, variante: forcarFinal });
  forcarFinal = null;
  ultimaFinal = plano.variante;
  cenaGol = criarCenaComemoracao(plano, mundo);
  cenaEstado = 'rodando'; cenaRapida = false; cenaCortou = false;
  // o que já está segurado (o chute do gol) não pula: só um aperto novo, depois de COMEM.pularDepois
  cenaBotoes = entrada ? entrada.ler(cam.yaw).botoes : 0;
  hud.comemoracao(true);
}

/** Um quadro da comemoração (fora da pausa): o pulo e o relógio da cena. */
function quadroComemoracao(dt, ent) {
  const c = cenaGol;
  if (cenaEstado !== 'rodando') return;
  if (tempoCena(c) < COMEM.pularDepois) cenaBotoes |= ent.botoes;
  else {
    const novos = ent.botoes & ~cenaBotoes;
    cenaBotoes &= ent.botoes;
    if (novos) { pularComemoracao(); return; }
  }
  const t0 = performance.now();
  custoCena.n += avancarCena(c, dt);
  const ms = performance.now() - t0;
  custoCena.ms += ms; mq.aCena += ms;
  if (c.acabou) fimComemoracao(false);
}

/** O plano de câmera do quadro: até o 1º corte, a câmera do gol do jogo; depois, a de cinema (sai o "GOL!"). */
function cameraComemoracao() {
  const c = cenaGol;
  planoCamera(c, { pequena: Math.min(window.innerWidth, window.innerHeight) < 520, aspecto: window.innerWidth / window.innerHeight }, planoCam);
  if (planoCam.nome === 'rede') return;
  if (!cenaCortou) {
    cenaCortou = true;
    if (cam.efeitoAtivo) cam.encerrarGol();
    hud.esconderGol();
  }
  if (planoCam.nome !== 'fim') cam.definirCinema(planoCam);
}

/** Pula a comemoração (só ela: o replay vem depois, com o pulo dele). Antes de COMEM.pularDepois, nada. */
function pularComemoracao() {
  if (!cenaGol || cenaEstado !== 'rodando' || tempoCena(cenaGol) < COMEM.pularDepois) return;
  fimComemoracao(true);
}

/**
 * Fim da comemoração (acabou ou pulou): o laço solta a simulação, que vai até a saída (a saída descarta a cena e o replay
 * entra). Pulada antes da hora, os passos que faltam rodam em poucos quadros (cortina) com a cena parada. pulou: o aperto
 * que pulou não vira jogada (a entrada é solta; o botão do controle segurado só vale de novo depois de solto).
 */
function fimComemoracao(pulou) {
  if (!cenaGol || cenaEstado !== 'rodando') return;
  cenaEstado = 'solta';
  cenaGol.acabou = true;
  const p = mundo.partida;
  const falta = p && p.estado === 'gol' ? PASSOS_GOL - (mundo.tick - p.desde) : 0;
  cenaRapida = falta > 1;
  if (cenaRapida) hud.cortina();
  if (entrada && pulou) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); entrada.limparPulsos(); }
}

/** A cena sai de vez (saída de bola, intervalo, fim, mundo novo): a câmera de jogo (ou a do replay) volta cortando. */
function encerrarComemoracao() {
  if (!cenaGol) return;
  cenaGol = null; cenaEstado = null; cenaRapida = false;
  if (cam) cam.definirCinema(null);
  hud.comemoracao(false);
  corteCamera = true;
}

/** Com a cena rodando, o passo que monta a saída (gol + 150) espera: a simulação fica no gol + 149. */
function seguraSimulacao() {
  if (!cenaGol || cenaEstado !== 'rodando') return false;
  const p = mundo.partida;
  return !!p && p.estado === 'gol' && mundo.tick + 1 - p.desde >= PASSOS_GOL;
}

// ------------------------------------------------------------------ replay
/**
 * Um quadro do replay, todo a partir do anel (do mundo só o placar e o relógio do HUD, que não mudam durante ele):
 * jogadores e bola interpolados no tick do replay, a rede re-balançando com o relógio do estádio gravado, a câmera do
 * plano, a linha de impedimento só no replay do impedimento. Sem anel do controlado, marcas nem barra de força.
 */
function desenharReplay(dt, agoraMs, renderizar = true) {
  const tq = performance.now();
  const n = lerQuadro(anel, diretor.tick, listaR, _bpR, _bqR, kitDoId);
  if (!n) { fimReplay(false); desenharQuadro(dt, agoraMs, renderizar); return; }
  const tEst = tempoEstadioAnel(anel, diretor.tick);
  if (redeLigada) empurraoBola(ondas, _bpR, tEst, _emp); else { _emp.x = 0; _emp.y = 0; _emp.z = 0; }
  _bpDes.x = _bpR.x + _emp.x; _bpDes.y = _bpR.y + _emp.y; _bpDes.z = _bpR.z + _emp.z;
  _qR.set(_bqR.x, _bqR.y, _bqR.z, _bqR.w);
  bola3d.atualizar(_bpDes, _qR);
  uniformsRede(ondas, redeLigada ? tEst : -1e9, campo.rede.a, campo.rede.b);
  const f = diretor.posicionar(_bpR, dt * diretor.velocidade, listaR);
  cena3d.acompanhar(f.x, f.z);
  jog3d.atualizar(listaR, diretor.camera);
  // nada do jogo ao vivo no gramado: queda da bola e opções do lateral somem; a linha só no replay do impedimento
  marcas.grupo.visible = false;
  marcasLat.atualizar(mundo, semPosicao, agoraMs / 1000, dt);
  linhaImped.mostrar(diretor.linha(dt));
  // a arquibancada do lado de cá (e a torcida dela) some/aparece pela câmera do replay, como no jogo pela da TV
  campo.atualizar(agoraMs / 1000, diretor.camera, renderizar);
  torcida.atualizar(agoraMs / 1000, emocao, diretor.camera, som ? som.relogioBatida : null, renderizar);
  if (som) som.atualizar(emocao, pausado(), agoraMs / 1000);
  hud.carga(null); hud.cartao(null);
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  hud.relogio(mundo.partida ? lerRelogio() : null);
  custoReplay.n++; custoReplay.ms += performance.now() - tq;
  if (renderizar) cena3d.desenhar(diretor.camera);
  render.bola.x = _bpR.x; render.bola.y = _bpR.y; render.bola.z = _bpR.z;
  const cp = diretor.camera.position;
  render.camera.x = cp.x; render.camera.y = cp.y; render.camera.z = cp.z;
  render.quadros++;
}
const semPosicao = () => null;

/** Começa um replay (roteiro do diretor). Devolve false se não deu (sem diretor, roteiro vazio, fora da partida). */
function iniciarReplay(ro) {
  if (!diretor || !ro || !mundo.partida) return false;
  if (!diretor.iniciar(ro)) return false;
  // o que já está segurado não pula (só um aperto novo); os apertos curtos já vistos não contam
  entrada?.limparPulsos();
  replayBotoes = entrada ? entrada.ler(cam.yaw).botoes : 0;
  encerrarEfeitosGol();
  hud.replay(true);
  return true;
}

/**
 * Pós-gol, na vez do replay (hoje: a saída de bola, o intervalo ou o fim). GANCHO para a cena de comemoração (outra
 * frente): ela entra ANTES — quando acabar, chama posGol() (diretor.depoisDoGol monta o replay do gol pendente).
 * Sem replay (desligado, gol fora do anel), os sons adiados tocam já. Devolve true se o replay começou.
 */
function posGol() {
  const ro = diretor ? diretor.depoisDoGol() : null;
  const ok = replayAuto && iniciarReplay(ro);
  if (!ok) tocarAdiados();
  return ok;
}
function tocarAdiados() {
  if (som) for (const d of somAdiado) som.tocar(d);
  somAdiado.length = 0;
}

/**
 * Fim do replay (acabou ou pulou): a câmera de jogo volta cortando, o laço não tenta recuperar o tempo parado, os sons
 * adiados (o apito da saída) tocam e a faixa do intervalo/fim aparece. pulou: o botão/tecla do pulo não vira jogada.
 */
function fimReplay(pulou) {
  if (!diretor) return;
  const estava = diretor.ativo;
  diretor.pular();
  hud.replay(false);
  if (linhaImped) linhaImped.mostrar(null);
  if (estava) { laco.ultimo = null; corteCamera = true; }
  if (entrada) {
    if (pulou) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); }
    entrada.limparPulsos();
  }
  tocarAdiados();
  if (depoisReplay) { const f = depoisReplay; depoisReplay = null; f(); }
}

/** Durante o replay: um botão APERTADO agora (não o que já estava segurado no começo) pula. */
function botaoPula(botoes) {
  const novos = botoes & ~replayBotoes;
  replayBotoes &= botoes;
  return novos !== 0;
}

const _rel = { minuto: 0, tempo: 1, estado: 'jogo', acrescimo: null };
const _cartao = { x: 0, y: 0, cor: 'amarelo' };
function lerRelogio() {
  _rel.minuto = minutoDeJogo(mundo); _rel.tempo = mundo.partida.tempo; _rel.estado = mundo.partida.estado;
  _rel.acrescimo = acrescimoDeJogo(mundo);
  return _rel;
}

function quadro(agoraMs, desenhar = true) {
  const dtReal = ultimoQuadro === null ? PASSO : Math.max(0, (agoraMs - ultimoQuadro) / 1000);
  ultimoQuadro = agoraMs;
  // pré-jogo: o laço da partida fica parado (tick 0) e o diretor desenha; em pé no celular ou escondida, para
  if (prejogo && prejogo.ativo) {
    entrada.ler(cam.yaw);
    laco.ultimo = agoraMs;
    const emPe = retratoBloqueado();
    if (prejogo.quadro(emPe || document.hidden ? 0 : dtReal, agoraMs, desenhar && !emPe, emPe)) return;
  }
  const dt = Math.min(0.1, dtReal);
  const ent = entrada.ler(cam.yaw, agoraMs);
  for (const a of entrada.consumirAcoes()) tratarAcao(a);
  if (diretor && diretor.ativo) {
    // replay: a simulação fica parada (como na pausa; o laço não recupera o tempo); um aperto novo pula
    laco.ultimo = agoraMs;
    if (!pausado()) {
      if (botaoPula(ent.botoes)) fimReplay(true);
      else if (!diretor.avancar(dt)) fimReplay(false);
    }
  } else if (pausado() || pausaTeste) {
    laco.ultimo = agoraMs;     // ao voltar, não tenta recuperar o tempo parado
  } else {
    // comemoração: anda no relógio do desenho (um aperto novo depois de 0,5 s pula)
    if (cenaGol) quadroComemoracao(dt, ent);
    const r = avancarLaco(laco, agoraMs);
    // cortina (a comemoração pulada antes da hora): os passos que faltam até a saída, COMEM.passosCortina por quadro
    const nPassos = cenaGol && cenaRapida ? Math.max(r.passos, COMEM.passosCortina) : r.passos;
    let segurou = false;
    for (let i = 0; i < nPassos; i++) {
      // a cena rodando segura a montagem da saída: a simulação espera no passo gol + 149
      if (seguraSimulacao()) { segurou = true; break; }
      // durante a cena o humano assiste: a entrada dele não vai para a simulação (a demo segue)
      const e = DEMO_ON ? (entradaDemoDoMundo(mundo) ?? ent) : cenaGol ? ENTRADA_NEUTRA : ent;
      let ac = filaAcoes.length ? filaAcoes.splice(0) : null;
      // a edição do time entra ANTES das outras ações, no 1º passo depois da pausa
      if (edicaoNaFila) { ac = ac ? [edicaoNaFila, ...ac] : [edicaoNaFila]; edicaoNaFila = null; }
      rodarPasso(e, ac);
      // o aperto curto (tocou e soltou entre dois passos) já foi visto por um passo
      if (i === 0) { entrada.limparPulsos(); ent.botoes = entrada.ler(cam.yaw, agoraMs).botoes; }
      // o replay começou neste passo (gol, impedimento): os passos que sobraram não rodam (a simulação espera)
      if (diretor && diretor.ativo) break;
      // a cortina acabou na saída (a cena saiu): o resto do quadro é do laço normal
      if (i >= r.passos - 1 && !cenaGol) break;
    }
    // segurando, o laço não acumula o tempo parado (e o desenho da simulação fica no passo mais novo)
    if (segurou) { laco.acum = Math.min(laco.acum, laco.passo / 2); alfa = 1; } else alfa = r.alfa;
  }
  // em pé no celular a tela "Gire o celular" cobre tudo: não gasta bateria desenhando por baixo
  if (diretor && diretor.ativo) desenharReplay(dt, agoraMs, desenhar && !retratoBloqueado());
  else desenharQuadro(dt, agoraMs, desenhar && !retratoBloqueado());
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
  torcida.definirQualidade(qAtual);
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
  if (diretor) diretor.redimensionar(w / h, Math.min(w, h) < 520);
}

// ------------------------------------------------------------------ ações e menu
function tratarAcao(a) {
  // pré-jogo: a pausa (Esc, P, Start) pula direto para o jogo
  if (prejogo && prejogo.ativo) { prejogo.acao(a); return; }
  // com o editor aberto nada chega ao jogo: só a pausa (Start do controle), que aplica e fecha
  if (editor.aberto) { if (a === 'pausa') editor.voltar(); return; }
  // replay: qualquer ação (Esc, Start, R, C, H...) só pula o replay — não abre a pausa nem chega ao jogo
  if (diretor && diretor.ativo && !pausado() && a !== 'qps') { fimReplay(true); return; }
  // comemoração: qualquer ação (Esc, Enter, R, C, H...) só pula a cena (depois de 0,5 s) — não abre a pausa nem chega ao jogo
  if (cenaGol && cenaEstado === 'rodando' && !pausado() && a !== 'qps') { pularComemoracao(); return; }
  if (a === 'pular') return;
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
  trocarMundo(novoMundo(), { prejogo: v === 'partida' ? 'preferencia' : null });
}

/**
 * Modo do pré-jogo: ?prejogo= força (0/desligado, 1/completo, curto, escalacao); senão desligado nos testes automatizados
 * (navigator.webdriver), nos prints e na demonstração; senão a preferência salva (padrão: completo — o dono pediu).
 */
function modoPrejogo() {
  const p = params.get('prejogo');
  if (p === '0' || p === 'desligado') return 'desligado';
  if (p === '1') return 'completo';
  if (PREJOGO.modos.includes(p)) return p;
  if (navigator.webdriver || PRINTS || DEMO_ON) return 'desligado';
  return PREJOGO.modos.includes(prefs.prejogo) ? prefs.prejogo : 'completo';
}
const NOME_PREJOGO = { completo: 'completo', curto: 'curto', escalacao: 'só escalação', desligado: 'desligado' };
function marcarPrejogo() {
  const v = PREJOGO.modos.includes(prefs.prejogo) ? prefs.prejogo : 'completo';
  const e = document.getElementById('estado-prejogo');
  if (e) e.textContent = NOME_PREJOGO[v];
}
/** Começa o pré-jogo (true) ou não (o apito toca já). */
function comecarPrejogo(modo, abertura) {
  if (!prejogo || modo === 'desligado' || mundo.modo !== 'partida' || !prejogo.iniciar(modo, { abertura })) return false;
  entrada?.soltarTudo();
  entrada?.bloquear?.(true);
  return true;
}
/** Fim do pré-jogo (acabou ou foi pulado): a entrada volta, a câmera de TV corta para a saída e o apito toca. */
function fimDoPrejogo() {
  entrada?.bloquear?.(false);
  corteCamera = true;
  laco.ultimo = null; ultimoQuadro = null;
  adapt.inicio = performance.now(); adapt.n = 0; adapt.soma = 0;
  hud.ajustarTopo();
  eventosIniciais();
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
    // "Replay" da pausa: os últimos 10 s (até o último corte), com a simulação parada; volta ao jogo no fim
    case 'replay': {
      if (mundo.modo !== 'partida' || !diretor) break;
      // nada para rever (menos de 0,5 s gravados desde o mundo novo): a pausa fica aberta
      const ro = diretor.menu();
      if (!ro) break;
      hud.fecharMenu();
      iniciarReplay(ro);
      break;
    }
    case 'replay-pular': if (diretor?.ativo) fimReplay(true); break;
    case 'comemoracao-pular': pularComemoracao(); break;
    case 'replayAuto':
      if (v !== 'ligado' && v !== 'desligado') break;
      replayAuto = v === 'ligado';
      prefs.replay = replayAuto; salvarPrefs(prefs);
      hud.definirEstado({ replayAuto });
      break;
    case 'reiniciar-partida':
      hud.fecharMenu();
      if (mundo.modo !== 'partida') break;
      // "Jogar de novo" (fim de jogo): o pré-jogo da preferência; "Reiniciar partida" no meio: só a escalação
      trocarMundo(novoMundo(), { prejogo: mundo.partida?.estado === 'fim' ? 'preferencia' : 'escalacao' });
      if (!prejogo?.ativo) hud.evento('reinicio');
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
      hora = v; cena3d.definirHora(v); campo.definirHora(v); torcida.definirHora(v);
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
    case 'som':
      if (v !== 'ligado' && v !== 'desligado') break;
      prefs.som = v === 'ligado'; salvarPrefs(prefs);
      som?.definir({ ligado: prefs.som });
      hud.definirEstado({ som: prefs.som });
      break;
    case 'volume': {
      const vol = Math.max(0, Math.min(1, +v));
      if (!Number.isFinite(vol)) break;
      prefs.volume = vol; salvarPrefs(prefs);
      som?.definir({ volume: vol });
      hud.definirEstado({ volume: vol });
      break;
    }
    case 'prejogo':
      if (!PREJOGO.modos.includes(v)) break;
      prefs.prejogo = v; salvarPrefs(prefs);
      marcarPrejogo();
      break;
    case 'prejogo-ciclo': {
      // "Modo de jogo" → "Pré-jogo da partida": completo → curto → só escalação → desligado → completo
      const atual = PREJOGO.modos.includes(prefs.prejogo) ? prefs.prejogo : 'completo';
      comando('prejogo', PREJOGO.modos[(PREJOGO.modos.indexOf(atual) + 1) % PREJOGO.modos.length]);
      break;
    }
    case 'toqueTamanho': entrada.definirAjustes({ tamanho: v }); hud.definirEstado({ toqueTamanho: entrada.ajustes.tamanho }); hud.ajustarTopo(); break;
    case 'toqueOpacidade': entrada.definirAjustes({ opacidade: v }); hud.definirEstado({ toqueOpacidade: entrada.ajustes.opacidade }); break;
    // tela limpa (botões de liga/desliga da pausa): sem valor, alterna o que vale agora
    case 'minimapa':
      prefs.minimapa = v === 'ligado' || v === 'desligado' ? v : (minimapaLigado() ? 'desligado' : 'ligado'); salvarPrefs(prefs);
      aplicarTelaLimpa();
      hud.definirEstado({ minimapa: minimapaLigado() });
      hud.ajustarTopo();
      break;
    case 'nomes':
      prefs.nomesBotoes = v === 'ligado' ? true : v === 'desligado' ? false : prefs.nomesBotoes !== true; salvarPrefs(prefs);
      aplicarTelaLimpa();
      hud.definirEstado({ nomes: prefs.nomesBotoes });
      break;
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
  diretor = criarDiretor({ anel, aspecto: window.innerWidth / window.innerHeight });
  campo = criarCampo({ qualidade: qAtual, aniso: cena3d.anisotropia() });
  cena3d.cena.add(campo.grupo);
  campo.definirHora(hora);
  hud.progresso('Enchendo as arquibancadas…');
  await proximoQuadro();
  torcida = criarTorcida(cena3d.cena, { qualidade: qAtual, mascara: mascaraGolaco(), hora });
  hud.progresso('Montando os jogadores…');
  await proximoQuadro();
  bola3d = criarBola3D(cena3d.cena, qAtual);
  jog3d = criarJogadores3D(cena3d.cena, qAtual);
  marcas = criarMarcas(cena3d.cena, { timeHumano: TIME_HUMANO }); // só a bola alta do meu time ganha marca
  linhaImped = criarLinhaImpedimento(cena3d.cena);
  marcasLat = criarMarcasLateral(cena3d.cena);
  const sombras = QUALIDADE[qAtual].sombras;
  bola3d.definirSombras(sombras);
  jog3d.definirSombras(sombras);
  // os controles de toque apareceram/sumiram: o topo se ajusta e o padrão do minimapa (celular × PC) muda junto
  entrada = criarEntrada({ forcarToque: params.get('toque') === '1', aoAcao: tratarAcao, aoMudarLayout: () => { hud.ajustarTopo(); hud.definirEstado({ minimapa: minimapaLigado() }); } });
  atualizarFase();
  redimensionar();
  window.addEventListener('resize', redimensionar);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', redimensionar);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) entrada.soltarTudo();
    else { laco.ultimo = null; ultimoQuadro = null; }
  });
  // girou para em pé: solta o que estava segurado (o dedo saiu do analógico ao girar); ao deitar,
  // o laço não tenta recuperar o tempo parado
  // o botão de tela cheia da tela "Gire o celular": só onde a tela trava deitada (Android)
  const btnGirar = document.getElementById('girar-tela-cheia');
  if (btnGirar) btnGirar.hidden = !(document.fullscreenEnabled && screen.orientation && typeof screen.orientation.lock === 'function');
  mqRetrato.addEventListener('change', () => {
    if (retratoBloqueado()) entrada.soltarTudo();
    else { laco.ultimo = null; ultimoQuadro = null; }
  });
  hud.definirEstado({
    qualidadeEscolha: escolhaQ, qualidadeAtual: qAtual, hora, camera: cam.modo, marcador: marcadorLigado(mundo), modoTreino: mundo.modo,
    toqueTamanho: entrada.ajustes.tamanho, toqueOpacidade: entrada.ajustes.opacidade, fim: false, replayAuto,
    minimapa: minimapaLigado(), nomes: prefs.nomesBotoes === true,
  });
  hud.definirTimes(timesDoMundo(mundo));
  // som: liga no primeiro gesto (política de reprodução automática); nada nos prints
  const somLigado = prefs.som !== false, volume = Number.isFinite(prefs.volume) ? prefs.volume : undefined;
  if (!PRINTS) {
    som = criarSom({ base: 'assets/sons/', ligado: somLigado, volume, aoMudar: e => hud.definirEstado({ somEstado: e }) });
    som.iniciar();
  }
  hud.definirEstado({ som: somLigado, volume: som ? som.volume : (volume ?? 0.8), somEstado: som ? som.estado : 'sem-contexto' });
  // pré-jogo (antes do 1º passo; com a abertura "Toque para começar", que libera o som); sem ele, o 'saida' do começo
  // da partida (o apito do início fica pendente até o primeiro gesto)
  hud.progresso('Montando o estádio…');
  await proximoQuadro();
  prejogo = criarPrejogo({
    cena3d, cam, jog3d, bola3d, campo, torcida, som: () => som, mundo: () => mundo, hora: () => hora, qualidade: () => qAtual,
    comToque: () => document.documentElement.classList.contains('com-toque'), aoFim: fimDoPrejogo,
  });
  marcarPrejogo();
  if (!comecarPrejogo(modoPrejogo(), true)) eventosIniciais();
  if (params.get('qps') === '1') hud.mostrarQps(true);
  hud.ajustarTopo();
  // primeiro quadro (compila os shaders) e some a tela de carregamento
  if (prejogo.ativo) prejogo.quadro(0, performance.now(), true);
  else desenharQuadro(PASSO, performance.now());
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

function trocarMundo(m, opc = {}) {
  // um pré-jogo tocando (mundo novo pela API, troca de modo): sai sem apitar
  if (prejogo && prejogo.ativo) { prejogo.cancelar(); entrada?.bloquear?.(false); }
  mundo = m;
  contPassos = 0; alfa = 0;
  laco.acum = 0; laco.ultimo = null;
  filaAcoes.length = 0;
  edicaoNaFila = null;
  kitCache.clear();
  limparOndas(ondas);
  zerarEmocao(emocao);
  zerarAutorGol(autorGol);
  // replay: o anel e o gol pendente são do mundo velho (os sons adiados e a faixa esperando vão junto)
  somAdiado.length = 0; depoisReplay = null; linhaNoReplay = null;
  if (diretor && diretor.ativo) fimReplay(false);
  encerrarComemoracao(); ultimaFinal = null;
  anel.limpar();
  if (diretor) diretor.limpar();
  if (cam) { cam.encerrarGol(); cam.planoGeral(false); }
  hud.esconderGol();
  if (editor.aberto) editor.fechar();
  iniciarEstados();
  corteCamera = true;
  if (entrada) entrada.definirFase(fase.atual);
  hud.definirEstado({ marcador: marcadorLigado(mundo), modoTreino: mundo.modo, fim: false });
  hud.definirTimes(timesDoMundo(mundo));
  hud.faixa(null);
  // pré-jogo (Jogar de novo, Reiniciar partida, troca para a partida) ou o apito do início já: o 'saida' que criarPartida deixou
  let mp = 'desligado';
  if (opc.prejogo && mundo.modo === 'partida') { mp = modoPrejogo(); if (mp !== 'desligado' && opc.prejogo === 'escalacao') mp = 'escalacao'; }
  if (!comecarPrejogo(mp, false)) eventosIniciais();
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
    if (opc.zerar) { mq.n = 0; mq.i = 0; mq.aSim = 0; mq.aPose = 0; mq.aPassos = 0; mq.aCena = 0; }
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
  /**
   * Prints e testes de navegador: o adversário mais perto faz falta no controlado (time 0), como se fosse no último
   * passo — opc = {area: true → quem sofre é levado para dentro da área (pênalti); cartao: 'amarelo' | 'vermelho' |
   * null; doMeu: a falta é do controlado}. Passa pelas regras e pelos eventos da página (apito, cartão, câmera).
   */
  faltaDeTeste(opc = {}) {
    const m = mundo;
    if (!m.partida) return null;
    // doMeu: quem faz a falta é o controlado (time 0) e quem sofre, o adversário mais perto
    const meu = jogadorPorId(m, m.controlado[TIME_HUMANO]);
    if (!meu) return null;
    let outro = null, dm = Infinity;
    for (const o of m.jogadores) { if (o.time === meu.time || o.posicao === 'GOL') continue; const q = Math.hypot(o.x - meu.x, o.z - meu.z); if (q < dm) { dm = q; outro = o; } }
    if (!outro) return null;
    const c = opc.doMeu ? outro : meu, d = opc.doMeu ? meu : outro;
    const lado = m.ataca[c.time];
    if (opc.area) teleportar(c, lado * (CFG.CAMPO.meioX - 9), 3, lado > 0 ? 0 : Math.PI);
    // u, w: a falta a u m da linha de fundo atacada, w m do meio (o tiro livre direto com barreira dos prints)
    if (opc.u != null) teleportar(c, lado * (CFG.CAMPO.meioX - opc.u), opc.w ?? 0, lado > 0 ? 0 : Math.PI);
    teleportar(d, c.x - lado * 1.1, c.z + 0.3, lado > 0 ? 0 : Math.PI);
    c.vx = 0; c.vz = 0;
    m.bola.p.x = c.x + lado * 0.4; m.bola.p.z = c.z; m.bola.p.y = CFG.BOLA.raio;
    m.posse = c.id; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    const f = montarFalta(m, d, c, 'bote', true);
    if ('cartao' in opc) f.cartao = opc.cartao;
    m.eventos = []; m.faltaPendente = f;
    regrasPartida(m);
    estadioPasso(m.eventos);
    for (const ev of m.eventos) tratarEvento(ev);
    return { parada: m.parada?.tipo ?? null, def: d.id, cond: c.id, cartao: f.cartao };
  },
  /**
   * Bola parada de teste (prints): a bola sai com o último toque certo e a partida monta o recomeço como no jogo.
   * tipo: 'lateral' | 'escanteio' (do time do humano, que cobra) | 'tiroDeMeta' (do time do humano: o goleiro dele).
   */
  bolaParadaDeTeste(tipo) {
    const m = mundo;
    if (!m.partida) return null;
    const t = TIME_HUMANO, lado = m.ataca[t], C = CFG.CAMPO;
    let x, z, ult;
    if (tipo === 'lateral') { x = lado * 14; z = C.meioZ + 0.5; ult = 1 - t; }
    else if (tipo === 'escanteio') { x = lado * (C.meioX + 0.6); z = 10; ult = 1 - t; }
    else { x = -lado * (C.meioX + 0.6); z = -9; ult = 1 - t; }
    const j = m.jogadores.find(o => o.time === ult && o.posicao !== 'GOL');
    m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    Object.assign(m.bola.p, { x, y: CFG.BOLA.raio, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
    m.partida.ultimoTime = ult; m.partida.ultimoId = j.id; m.partida.ultimoTick = m.tick;
    m.ultimoToque = { id: j.id, time: ult, tick: m.tick };
    return { tipo, x, z };
  },
  acao(a) { tratarAcao(a); },
  definirQualidade(nome) { comando('qualidade', nome); },
  definirHora(h) { comando('hora', h); },
  definirCamera(m) { comando('camera', m); },
  abrirMenu() { hud.abrirMenu(true); },
  fecharMenu() { hud.fecharMenu(); },
  /** Faixa do intervalo/fim por cima dos prints (conferência do HUD). */
  mostrarFaixa(f) { hud.faixa(f, true); },
  /** A entrada já tem os botões da defesa da Etapa 3 e o bloquear() do editor? */
  get entradaEtapa3() { return typeof entrada?.bloquear === 'function'; },
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
      relogio: mundo.partida ? { tempo: mundo.partida.tempo, minuto: minutoDeJogo(mundo), estado: mundo.partida.estado, acrescimo: acrescimoDeJogo(mundo) } : null,
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
  mostrarEvento(ev, opc = {}) { hud.evento(ev, ev?.tipo === 'gol' ? { fixo: !!opc.fixo } : {}, true); },
  /** Desenha um quadro sem avançar nada (prints). */
  desenhar() {
    const t = relogioManual ? tempoManual : performance.now();
    if (prejogo && prejogo.ativo) prejogo.quadro(0, t, true); else if (diretor && diretor.ativo) desenharReplay(0, t); else desenharQuadro(0, t);
  },
  /**
   * Pré-jogo (testes e prints): {ativo, fase, bloco, plano, indice, tempo, total, planos, pular(), pularTudo(), irPara(t),
   * comecar(), iniciar(modo, {abertura}), andantesNaTela(), escalacao: {visivel, time, cheia, cartas(t)}, ...}.
   */
  get prejogo() {
    if (!prejogo) return null;
    const a = prejogo.api;
    if (!a.iniciar) a.iniciar = (modo, opc = {}) => comecarPrejogo(modo, !!opc.abertura);
    return a;
  },
  /** Câmera livre para prints de conferência ({de:[x,y,z], para:[x,y,z], fov?}) ou null. */
  cameraLivre(l) { cam.definirLivre(l); },
  /**
   * Estádio (testes): a torcida (quantos, qualidade, animada, visível), a rede (batidas, se ainda mexe, o
   * deslocamento de um ponto agora), o ânimo e o som (estado do AudioContext, camadas, quantas vezes cada
   * som tocou, ganho que sai). A bola DESENHADA (com o bojo da rede) em bolaDesenhada.
   */
  /** Linha de impedimento desenhada (testes): {visivel, x, lance, opacidade}. */
  get linhaImpedimento() { return linhaImped?.estado ?? null; },
  /** Marcadores das 3 opções do lateral (testes): {visivel, ids, mirada}. */
  get marcasLateral() { return marcasLat?.estado ?? null; },
  /**
   * Replay (testes e prints): estado do diretor ({ativo, tipo, plano, planos, cam, tick, vel, congelado, duracao, ...}),
   * o anel ({primeiro, ultimo, bytes}), custos (gravar por passo, quadro do replay sem o desenho), o ajuste automático,
   * pular, o "Replay" da pausa e o replay do último gol (golaco = true força o plano lateral).
   */
  replay: {
    get estado() { return diretor ? diretor.estado : null; },
    get anel() { return { primeiro: anel.primeiro, ultimo: anel.ultimo, bytes: anel.bytes }; },
    get custo() { return { gravarMsPorPasso: custoGravar.ms / Math.max(1, custoGravar.n), passos: custoGravar.n, quadroReplayMs: custoReplay.ms / Math.max(1, custoReplay.n), quadros: custoReplay.n }; },
    zerarCusto() { custoGravar.n = 0; custoGravar.ms = 0; custoReplay.n = 0; custoReplay.ms = 0; },
    /**
     * Custo de gravar um passo (ms), medido em lotes: `lotes` × `n` gravações do estado atual num anel de rascunho, um
     * par de relógios por lote (o performance.now() do navegador é grosso para medir ~10 µs de uma vez); devolve a
     * mediana dos lotes (uma preempção da máquina carregada não estraga a medida).
     */
    medirGravacao(n = 120, lotes = 7) {
      const a = criarAnel({ ticks: anel.ticks, vagas: anel.vagas, nj: NJ });
      const ms = [];
      for (let l = 0; l < lotes; l++) {
        const t0 = performance.now();
        for (let k = 0; k < n; k++) {
          a.inicio(l * n + k + 1, 0, false);
          let v = 0;
          for (const j of mundo.jogadores) { const e = estJ.get(j.id); if (e) a.jogador(v++, j.id, j.time, j.posicao === 'GOL', e.x1, e.z1, e.r1, e.atu); }
          a.fim(bolaAtu.p, bolaAtu.q);
        }
        ms.push((performance.now() - t0) / n);
      }
      ms.sort((x, y) => x - y);
      return ms[ms.length >> 1];
    },
    // (testes: não salva a escolha, ao contrário do ajuste da pausa)
    automatico(v) { if (v !== undefined) { replayAuto = !!v; hud.definirEstado({ replayAuto }); } return replayAuto; },
    get golPendente() { return diretor?.golPendente ? { ...diretor.golPendente } : null; },
    pular() { if (diretor?.ativo) fimReplay(true); },
    menu() { return iniciarReplay(diretor?.menu()); },
    gol(golaco) { return iniciarReplay(diretor?.reverGol(golaco)); },
  },
  /**
   * Comemoração do gol (testes e prints): estado da cena ({fase, t, duracao, autor, alvo, variante, corrida, curta, plano,
   * golTick, estado, colegas, reacao}), os atores (comemoracao.js infoAtores), a caixa do ator na tela (px CSS: a pose
   * desenhada), pular, ligar/desligar (sem salvar), a finalização do próximo gol e o custo (ms por tick).
   */
  comemoracao: {
    get ativa() { return !!cenaGol; },
    get estado() {
      const c = cenaGol;
      if (!c) return null;
      return {
        fase: faseCena(c), t: tempoCena(c), duracao: duracaoCena(c), k: c.k, estado: cenaEstado, rapida: cenaRapida,
        autor: c.plano.autorId, alvo: { ...c.alvo }, variante: c.variante, corrida: c.corrida, curta: c.curta, time: c.time,
        golTick: c.plano.golTick, colegas: [...c.plano.colegas], reacao: c.plano.reacaoId, contra: c.plano.contra,
        plano: cam?.cinema ?? (cam?.planoGol === 'fechado' ? 'rede' : null),
        kFinal: c.kFinal, kFimFinal: c.kFimFinal, kFimAbraco: c.kFimAbraco, kFim: c.kFim, kPulo: c.kPulo,
      };
    },
    atores() { return cenaGol ? infoAtores(cenaGol) : null; },
    /** Caixa (px CSS) da pose DESENHADA de um ator (o autor, por padrão): {x0, y0, x1, y1, altura, dentro, atras}. */
    naTela(id) {
      if (!cenaGol || !cam) return null;
      const a = cenaGol.atores.find(q => q.id === (id ?? cenaGol.plano.autorId));
      if (!a || !a.des) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, atras = false;
      for (let i = 0; i < NJ; i++) {
        _proj.set(a.des[i * 3], a.des[i * 3 + 1], a.des[i * 3 + 2]).project(cam.camera);
        if (_proj.z > 1) atras = true;
        const x = (_proj.x + 1) / 2 * window.innerWidth, y = (1 - _proj.y) / 2 * window.innerHeight;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const W = window.innerWidth, H = window.innerHeight, fw = 0.15 * (x1 - x0), fh = 0.15 * (y1 - y0);
      const dentro = !atras && x0 >= -fw && x1 <= W + fw && y0 >= -fh && y1 <= H + fh;
      return { x0, y0, x1, y1, altura: y1 - y0, dentro, atras };
    },
    pular() { pularComemoracao(); },
    ligada(v) { if (v !== undefined) comemoracaoLigada = !!v; return comemoracaoLigada; },
    forcarFinal(v) { forcarFinal = v ?? null; },
    get custo() { return { msPorTick: custoCena.ms / Math.max(1, custoCena.n), ticks: custoCena.n }; },
    zerarCusto() { custoCena.n = 0; custoCena.ms = 0; },
  },
  estadio: {
    get torcida() {
      if (!torcida) return null;
      return {
        n: torcida.n, qualidade: torcida.qualidade, animada: torcida.animada, visivel: !!torcida.mesh?.visible && !!torcida.mesh?.parent,
        // cada malha (grupo) neste quadro e a arquibancada do lado de cá (fora do desenho com a câmera dentro dela)
        grupos: (torcida.mesh?.children ?? []).map(m => ({ nome: m.name, visivel: m.visible, n: m.userData.k ?? m.geometry.instanceCount })),
        ladoDeCa: campo?.ladoDeCa ? campo.ladoDeCa.visible : null,
      };
    },
    get rede() {
      const t = tempoEstadio();
      return { batidas: ondas.total, ativa: redeAtiva(ondas, t), tempo: t, impactos: ondas.imp.filter(i => i.ativo).map(i => ({ ...i })) };
    },
    /** Deslocamento (m, para fora do gol) do ponto do pano agora (com a fixação da armação). */
    deslocamentoRede(plano, x, y, z) { return deslocamento(ondas, plano, x, y, z, tempoEstadio()) * fixoRede(plano, x, y, z); },
    get emocao() { return { agito: emocao.agito, torcida: emocao.torcida.map(g => ({ ...g })), contagem: { ...emocao.contagem } }; },
    get som() { return som ? { ...som.info, tocados: som.tocados } : null; },
    /** Testes e prints: acende sinalizadores / abre o bandeirão / começa a ola agora ({sinalizadores, cor, bandeirao, ola}). */
    forcarFesta(o) { forcarFesta(emocao.festa, o); },
    /** Mostra/esconde a festa (faixas, bandeiras, bandeirões, sinalizadores) — conferência de pixels. */
    mostrarFesta(v) { torcida?.mostrarFesta(v); },
    /** Overdraw da fumaça dos sinalizadores nesta câmera (telas cheias; sinalizadores.js medirOverdraw). */
    overdrawFumaca() { return torcida ? torcida.sinalizadores.medirOverdraw(cena3d.renderer, cam.camera) : null; },
    /** Os bancos de reservas neste quadro (vão na malha do lado de cá: fora do desenho com a câmera de TV dentro dela). */
    get bancosVisiveis() { return campo?.ladoDeCa ? campo.ladoDeCa.visible : null; },
    /** Faixas, bandeiras e sinalizadores agora: visíveis, vértices desenhados, instâncias, abertura do bandeirão. */
    get festaVisual() { return torcida ? { bandeiras: torcida.bandeiras.mesh.visible, vertices: torcida.bandeiras.mesh.geometry.drawRange.count, sinalizadores: torcida.sinalizadores.mesh.visible && torcida.sinalizadores.quantas > 0, instancias: torcida.sinalizadores.quantas, abre: torcida.bandeiras.uniforms.uAbre.value.x } : null; },
    /** A agenda da festa (festa.js): canto, batucada, vaia, sinalizadores, bandeirão e ola. */
    get festa() { const f = emocao.festa; return { canto: { ...f.canto, cantados: [...f.canto.cantados] }, batucada: f.batucada, vaia: { ...f.vaia }, acesos: f.acesos, flares: f.flares.filter(s => s.ativo).map(s => ({ ...s })), bandeirao: { ...f.bandeirao }, ola: { ...f.ola }, t: f.t }; },
    /** Liga/desliga a onda da rede SÓ no desenho (testes: o mesmo instante com e sem a deformação). */
    redeOnda(v) { redeLigada = !!v; },
    /** Só a troca de qualidade da torcida (ms): quantos desenhar e a animação, sem remontar nada. */
    trocarTorcida(q) { const t0 = performance.now(); torcida.definirQualidade(q); const ms = performance.now() - t0; torcida.definirQualidade(qAtual); return ms; },
    /** Mostra/esconde a torcida (conferência de pixels nos testes). */
    mostrarTorcida(v) { if (torcida?.mesh) torcida.mesh.visible = !!v; },
    get bolaDesenhada() { return { ..._bpDes }; },
    get efeitoCamera() { return cam ? cam.efeitoAtivo : false; },
    /** 'fechado' (câmera do gol da partida), 'leve' (treino) ou null; e o plano geral (intervalo/fim). */
    get planoCamera() { return cam ? (cam.cinema ? 'comemoracao' : (cam.planoGol ?? (cam.geral ? 'geral' : 'jogo'))) : null; },
    /** O último autor de gol de verdade (autor-gol.js) e o que o "GOL!" mostrou. */
    get autorGol() { return autorGol.gol.ativo ? { ...autorGol.gol } : null; },
    /** O último toque de verdade (pelos eventos; o autor de um gol que saísse agora). */
    get ultimoToque() { return autorGol.ultimo.ativo ? { ...autorGol.ultimo } : null; },
    baixarSons() { return som ? som.baixar() : null; },
    /** Envelope de uma gravação decodificada (som.js analisar): o grito do gol sai na hora? */
    analisarSom(nome) { return som ? som.analisar(nome) : null; },
  },
  definirSom(v) { comando('som', v ? 'ligado' : 'desligado'); },
  definirVolume(v) { comando('volume', v); },
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
