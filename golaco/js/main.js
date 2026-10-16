// GOLAÇO — página do jogo: a partida 11×11 (Etapa 3, abre nela) e os treinos (ataque da Etapa 2 e
// condução da Etapa 1, no menu "Modo de jogo" e por ?modo=ataque|conducao). DOM + three.js.
// Laço de passo fixo ("Fix Your Timestep!", Glenn Fiedler): a cada quadro avancarLaco diz
// quantos passos de 1/60 s rodar; para cada passo guardamos a pose ANTERIOR e calculamos a
// ATUAL de cada jogador (uma vez por passo) e a bola anterior/atual; o desenho INTERPOLA com
// alfa (bola por lerp + slerp do quaternion, juntas por interpolarPose). Igual a 60/120/144 Hz.
//
// Entradas POR TIME: o humano é o time TIME_HUMANO (0; com ?tm, o lado do usuário no Total Match) e quem recebe a
// entrada é o jogador m.controlado[TIME_HUMANO] (cai para o id 0 se o mundo ainda não tiver esse campo). A lógica chega
// aos poucos: tudo o que é da Etapa 2 (m.controlado, m.voo, m.placar, j.carga, m.proximaTroca, j.posicao) é lido com
// tolerância (?. e valor padrão).
//
// Total Match (?tm=<id>; ponte-tm.js, tm-times.js, sumula.js; contrato "Ponte com o Total Match" no CONTRATOS.md): os
// times do pedido (o time 0 é o mandante do TM), o humano no lado do usuário, a trava "só o meu jogador" (TROCAR e GOLEIRO
// mascarados e escondidos), a súmula alimentada a cada passo, 'tm3d:pronto' no api.pronto, 'tm3d:sair' sem WebGL 2, a
// pausa sem Reiniciar/Modo de jogo e com "Simular o resto" (os passos em pedaços sem desenhar) e a faixa do fim com
// "Voltar ao Total Match" ('tm3d:fim'; o resultado é gravado já no apito). Sem ?tm nada disso existe (TM = null).
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
// Treinadores e área técnica (render; pedido do dono de 12/10: "quero a área técnica e o treinador"): na partida, os 2
// treinadores fictícios (js/tecnicos.js, PURO) dão um passo por passo da simulação, depois do estádio, LENDO o mundo
// (leituraDoMundo) — o hash não muda —; segurando a simulação na comemoração, andam os passos da cena com o mundo
// parado; na pausa, no editor e no replay ficam parados. Desenhados pelo mesmo manequim instanciado dos jogadores (sem
// chamada de desenho a mais), também na comemoração e no pré-jogo, e gravados no anel (o replay os mostra como foram).
// As câmeras de cinema (comemoração, pré-jogo, lateral do golaço) passam por afastarDeTecnicos. ?tecnicos=0 desliga.
// Replay do gol com 4 câmeras (12/10): TV, atrás do gol [lateral], a 1ª PESSOA do autor e a VISÃO DO TREINADOR do time
// que marcou (render/replay-olhos.js); na 1ª pessoa o autor fica sem cabeça e tronco e a bola some perto da lente; na
// parte 1 do treinador ele sai da lista.
//
// Substituição (render; pedido do dono de 12/10: "quando tiver substituição, quero que tenha a cena de substituição, só
// jogador saindo e entrando, e embaixo, no modelo, a informação de quem entra e quem sai"): no fim do passo que trouxe as
// trocas (os eventos 'substituicao'), todos os pares viram UMA cena (js/substituicao.js: quem sai pelo ponto mais perto
// da linha, quem entra pelo meio-campo com a placa do quarto árbitro) e o laço SEGURA a simulação, como no replay (o hash
// no mesmo tick é o mesmo com e sem a cena). Fila única de cenas (filaCenas): gol → comemoração → replay inteiro →
// substituição → recomeço; os sons do passo que abriu a cena (o apito da saída) tocam quando a fila esvazia. A faixa
// ENTRA/SAI (hud.faixaSubst) fica ≥ 4 s, também com a cena pulada ou desligada ("Cena de substituição: só a faixa"). Trocas
// do intervalo: só a faixa, na saída do 2º tempo. rodarPassos (testes) nunca abre a cena.
//
// Parâmetros: ?semente=N ?q=baixa|media|alta ?hora=dia|noite ?camera=tv|aproximada ?demo=1
// ?modo=partida|ataque|conducao (padrão da página: partida) ?min=N (minutos reais por tempo)
// ?marcador=1 ?prints=1 (cena limpa) ?qps=1 ?toque=1 ?entalhe=1 ?replay=0|1 ?comemoracao=0|1 ?substituicao=0|1
// ?prejogo=0|1|curto|escalacao ?tecnicos=0|1.
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
// identidade visual dos times (escudo, uniformes, torcida, estádio, cores do HUD): a de hoje sem ?tm; com ?tm, a do TM
import { identidadeDaPagina, mascaraDaIdentidade, extrasPlacar } from './render/identidade-pagina.js';
import { criarOndas, limparOndas, detectarImpactos, registrarImpacto, uniformsRede, empurraoBola, redeAtiva, deslocamento, fixo as fixoRede } from './render/rede-onda.js';
import { criarEmocao, zerarEmocao, emocaoEvento, emocaoPasso, consumirDisparos } from './render/emocao.js';
import { forcarFesta } from './render/festa.js';
import { criarAutorGol, zerarAutorGol, autorEventos } from './render/autor-gol.js';
import { criarSom } from './render/som.js';
import { criarPartida, passoPartida, entradaDemoPartida, minutoDeJogo, acrescimoDeJogo, regrasPartida, teleportar } from './partida.js';
import { montarFalta } from './faltas.js';
import { pressionadorVisivel } from './defesa.js';
import { relogioMao, maoPermitida } from './regras-goleiro.js';
import { assumirControle } from './acoes.js';
import { ELENCOS, elencoDoJogador, fichaDe } from './elenco.js';
import { criarPrejogo } from './render/prejogo.js';
import { PREJOGO } from './prejogo-roteiro.js';
import { criarAnel, lerQuadro, tempoEstadio as tempoEstadioAnel, jogadorNoTick, marcasDoPasso } from './render/replay-anel.js';
import { criarTecnicos, criarLeitura, leituraDoMundo, passoTecnicos, afastarDeTecnicos, infoTecnicos, IDS_TECNICOS, kitTecnico } from './tecnicos.js';
import { OCULTA } from './render/jogador3d.js';
import {
  planejarComemoracao, criarCena as criarCenaComemoracao, avancarCena, planoCamera, criarPlanoCamera, faseCena,
  tempoCena, duracaoCena, infoAtores,
} from './comemoracao.js';
import {
  planejarSubstituicao, criarCenaSubst, avancarCenaSubst, planoCameraSubst, criarPlanoCameraSubst, tempoCenaSubst,
  duracaoCenaSubst, infoAtoresSubst, consumirEventosSubst, paresDaPlaca, placaNasMaos, planoEm,
} from './substituicao.js';
import { criarPlacaSubst } from './render/placa-subst.js';
// Total Match (?tm=<id>; ponte-tm.js): os times do pedido, o lado do humano, a trava "só o meu jogador" e a súmula
import { ID_TM, PEDIDO_TM, avisarTM, fimTM, sairTM, gravarResultadoTM, sementeTM, MENSAGENS as MENSAGENS_TM } from './ponte-tm.js';
import { registrarElenco } from './elenco.js';

const { PASSO, BOTAO, QUALIDADE, VERSAO, FALTAS } = CFG;
const ID_HUMANO = S.ID_HUMANO ?? 0;
// Só com ?tm: a conversão do pedido (tm-times.js) e a súmula (sumula.js) por import dinâmico — fora do download do jogo
// sem ?tm (teste-carga)
const [MOD_TIMES, MOD_SUMULA] = PEDIDO_TM
  ? await Promise.all([import('./tm-times.js'), import('./sumula.js')]).catch(() => [null, null]) : [null, null];
const { criarSumula, sumulaPasso, resultadoTM, minutoTM } = MOD_SUMULA ?? {};
const ELENCOS_TM = MOD_TIMES?.ELENCOS_TM;
/**
 * O pedido do TM vira elencos registrados (elenco.js) e os times da partida; sem ?tm, null (o jogo de sempre). Um pedido
 * que não fecha (time com menos de 11, dado quebrado: a partida de ensaio dá erro) também vira null — o iniciar() manda
 * 'tm3d:sair' e o TM simula na hora, sem esperar os 30 s dele.
 */
function timesDoTM() {
  if (!PEDIDO_TM || !MOD_TIMES || !MOD_SUMULA) return null;
  try {
    const T = MOD_TIMES.timesDoPedido(PEDIDO_TM);
    for (const el of T.elencos) registrarElenco(el);
    criarPartida({ semente: 1, minutosPorTempo: 1, times: T.times, elencos: ELENCOS_TM, humano: T.humano, trava: T.trava });
    return T;
  } catch (_) { return null; }
}
const TM = timesDoTM();
// Total Match, modo Pênaltis 3D (o pedido com modo: 'penaltis'): a disputa com os times do pedido, sem a trava
const PENALTIS_TM = !!TM && PEDIDO_TM?.modo === 'penaltis';
// o time do humano: 0 (o mandante) sem ?tm; com ?tm, o lado do usuário no TM (o time 0 é sempre o mandante do TM)
const TIME_HUMANO = TM ? TM.humano : 0;
const TRAVA_TM = TM && !PENALTIS_TM ? TM.trava : null;

const params = new URLSearchParams(location.search);
const PRINTS = params.get('prints') === '1';
// modo da página: a partida (padrão) ou um dos treinos; o menu "Modo de jogo" troca sem recarregar (com ?tm, sempre a partida)
// (o modo Pênaltis 3D — a disputa de pênaltis, pedido do dono de 15/10 — também: ?modo=penaltis ou o pedido do TM)
const MODOS = ['partida', 'ataque', 'conducao', 'penaltis'];
let modoPagina = TM ? (PENALTIS_TM ? 'penaltis' : 'partida') : MODOS.includes(params.get('modo')) ? params.get('modo') : 'partida';
// modo Pênaltis: a lógica (disputa.js) e as bolinhas (disputa-tela.js) por import dinâmico — fora do download sem ele
let MOD_DISP = null, TELA_DISP = null;
async function carregarDisputa() {
  if (!MOD_DISP) [MOD_DISP, TELA_DISP] = await Promise.all([import('./disputa.js'), import('./disputa-tela.js')]);
  return MOD_DISP;
}
if (modoPagina === 'penaltis') await carregarDisputa();
const MIN_PARAM = +params.get('min') > 0 ? +params.get('min') : undefined;
const DEMO_ON = params.get('demo') === '1';
const SEMENTE = Math.max(1, Math.floor(+params.get('semente') || (ID_TM ? sementeTM(ID_TM) : 1)));
// disputa de pênaltis: "Jogar de novo" passa à semente seguinte (outra moeda, outras cobranças). Sem ?semente nem ?tm, cada
// disputa nova (a 1ª, Reiniciar, Jogar de novo, a volta pelo Modo de jogo) tem a semente SORTEADA aqui na página — antes
// toda disputa começava igual (a mesma moeda, o mesmo lado do goleiro da IA; revisão de 16/10). A semente fica no mundo
// (m.semente): o hash continua valendo, e os testes passam ?semente.
let rodadaDisputa = 0;
const SEMENTE_FIXA = !!params.get('semente') || !!ID_TM;
function sementeDisputa() {
  if (SEMENTE_FIXA) return SEMENTE + rodadaDisputa;
  try { const u = new Uint32Array(1); crypto.getRandomValues(u); return (u[0] % 999999) + 1; } catch (_) { return Math.floor(Math.random() * 999999) + 1; }
}
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
// salva: desligado no celular e ligado no PC (o CSS decide por html.com-toque). Nomes: LIGADOS sem escolha salva
// (dono, 12/10: "coloca o nome da função do botão de novo"); desligados na pausa = só o ícone.
const nomesLigados = () => prefs.nomesBotoes !== false;
function aplicarTelaLimpa() {
  const r = document.documentElement;
  r.classList.toggle('mapa-ligado', prefs.minimapa === 'ligado');
  r.classList.toggle('mapa-desligado', prefs.minimapa === 'desligado');
  r.classList.toggle('nomes-botoes', nomesLigados());
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

// (tm: a pausa do Total Match — sem Reiniciar nem Modo de jogo, com "Simular o resto"; sem Editar time com a trava)
const hud = criarHud({ aoComando: comando, tm: TM ? { trava: TRAVA_TM != null, timeHumano: TIME_HUMANO } : null });
// "Editar time" (partida; editor-time.js sob demanda: carregarSobDemanda): a tela entrega a edição no PRONTO (aoPronto)
// e solta a entrada ao fechar. null até chegar
let editor = null;
if (PRINTS) hud.modoPrints();
document.documentElement.classList.toggle('noite', hora === 'noite');

// ------------------------------------------------------------------ estado da simulação
const marcadorLigado = m => (S.marcadorLigado ? S.marcadorLigado(m) : false);
/** Mundo novo: a partida (criarPartida) ou um treino (sessao.js), pelo modo pedido ou o da página. */
function criarMundoTreino(opc = {}) {
  const o = { semente: SEMENTE, ...opc };
  if (o.modo === undefined) o.modo = modoPagina;
  // (com ?tm: os times do pedido, o humano no lado do usuário e a trava — em toda recriação do mundo; sem ?tm, humano 0 e
  // sem trava: a partida de sempre)
  if (o.modo === 'penaltis') {
    return MOD_DISP.criarDisputa({
      semente: opc.semente ?? sementeDisputa(), times: o.times ?? TM?.times, elencos: o.elencos ?? (TM ? ELENCOS_TM : undefined),
      humano: o.humano ?? TIME_HUMANO, comeca: o.comeca, gol: o.gol,
    });
  }
  if (o.modo === 'partida') {
    return criarPartida({
      semente: o.semente, minutosPorTempo: o.minutosPorTempo ?? MIN_PARAM, saida: o.saida, times: o.times ?? TM?.times,
      elencos: o.elencos ?? (TM ? ELENCOS_TM : undefined), humano: o.humano ?? TIME_HUMANO, trava: o.trava !== undefined ? o.trava : TRAVA_TM,
    });
  }
  return S.criarTreino(o);
}
/** Um passo: partida (passoPartida) ou treino (passoTreino) — as mesmas funções dos testes em Node. */
function passoDoMundo(m, e, acoes) {
  if (m.disputa) return MOD_DISP.passoDisputa(m, e);
  return m.modo === 'partida' ? passoPartida(m, e, acoes) : S.passoTreino(m, e, acoes);
}
function entradaDemoDoMundo(m) {
  if (m.disputa) return MOD_DISP.entradaDemoDisputa(m);
  return m.modo === 'partida' ? entradaDemoPartida(m) : (S.entradaDemo ? S.entradaDemo(m) : null);
}
/** Partida ou disputa de pênaltis (os dois têm m.partida e os times): o que vale para "o jogo" e não para os treinos. */
const ehJogo = m => m.modo === 'partida' || m.modo === 'penaltis';
/** Rumo da câmera no chão para o analógico: na disputa, o da câmera atrás do cobrador (esquerda/direita da tela). */
function yawEntrada() { return mundo.disputa && MOD_DISP ? MOD_DISP.yawDisputa(mundo) : cam.yaw; }
function novoMundo(opc) {
  const ini = DEMO_ON && S.DEMO && modoPagina === 'conducao' ? S.DEMO.inicio : { x: 0, z: 0, rumo: 0 };
  return criarMundoTreino({ ...ini, marcador: params.get('marcador') === '1', ...opc });
}
let mundo = novoMundo();
const estJ = new Map();   // id → {ant, atu, des, x0, z0, x1, z1, r0, r1}
// Replay: o anel (alocado uma vez; grava desde o 1º passo) e o diretor (render/replay.js sob demanda: carregarSobDemanda;
// câmeras three.js; null até chegar). replayAuto: o ajuste da pausa (?replay=0|1 força; senão o salvo; senão
// REPLAY.automatico).
const anel = criarAnel({ ticks: Math.round(CFG.REPLAY.segundos / PASSO), vagas: CFG.REPLAY.vagas, nj: NJ });
let diretor = null;
let golSemDiretor = null;      // o gol que espera o replay baixar (dados do aoGol), até a saída de bola
const REPLAY_ATRASO_MAX = 45;  // passos: o replay do impedimento que chegou depois do apito ainda entra até aqui
// ------------------------------------------------------------------ sob demanda (config.js SOB_DEMANDA)
// O que não desenha o 1º quadro fica fora do download inicial (tools/teste-carga.mjs cobra a folga): o diretor do replay
// (render/replay.js com o roteiro, as câmeras e a análise semiautomática) e o "Editar time" (editor-time.js + o CSS dele,
// na mesma posição da cascata de antes: antes do prejogo.css e do tm.css). Pré-carga no 1º gesto ou ociosa depois do 1º
// quadro (agendarSobDemanda); quem precisa antes pede aqui e usa quando chega. Só desenho e tela: o hash não muda.
const SOB = {
  replay: {
    carga: null, ok: false,
    baixar: () => import('./render/replay.js'),
    criar(md) {
      diretor = md.criarDiretor({ anel, aspecto: window.innerWidth / window.innerHeight });
      if (cam) diretor.redimensionar(window.innerWidth / window.innerHeight, Math.min(window.innerWidth, window.innerHeight) < 520);
    },
  },
  editor: {
    carga: null, ok: false,
    baixar: () => Promise.all([import('./editor-time.js'), cssSobDemanda('css/editor.css', 'css/prejogo.css')]).then(([md]) => md),
    criar(md) { editor = md.criarEditorTime({ raiz: document.getElementById('editar-time'), aoPronto: ed => aoPronto(ed), aoFechar: () => aoFecharEditor() }); },
  },
};
/** Folha de estilo sob demanda, ANTES de `antes` (a ordem da cascata de quando vinha no index.html); resolve no load. */
function cssSobDemanda(href, antes) {
  return new Promise(ok => {
    if (document.querySelector(`link[rel="stylesheet"][href="${href}"]`)) { ok(); return; }
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href;
    l.onload = l.onerror = () => ok();
    const ref = document.querySelector(`link[rel="stylesheet"][href="${antes}"]`);
    if (ref) ref.before(l); else document.head.append(l);
  });
}
/** Carrega (uma vez) o módulo sob demanda `nome`, ou todos sem nome. Promise; falha de rede: tenta de novo no próximo pedido. */
function carregarSobDemanda(nome) {
  if (!nome) return Promise.all(Object.keys(SOB).map(n => carregarSobDemanda(n)));
  const s = SOB[nome];
  return s.carga ??= s.baixar().then(md => { s.criar(md); s.ok = true; }, e => { s.carga = null; throw e; });
}
/** Pré-carga: no 1º gesto (toque, clique, tecla) ou SOB_DEMANDA.esperaMs depois do 1º quadro, num momento ocioso. */
function agendarSobDemanda() {
  const EV = ['pointerdown', 'keydown', 'touchstart'];
  let feito = false;
  const vai = () => {
    if (feito) return;
    feito = true;
    for (const e of EV) window.removeEventListener(e, vai, true);
    const r = () => { carregarSobDemanda().catch(() => {}); };
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(r, { timeout: CFG.SOB_DEMANDA.ociosoMs }); else setTimeout(r, 0);
  };
  for (const e of EV) window.addEventListener(e, vai, { capture: true, passive: true });
  setTimeout(vai, CFG.SOB_DEMANDA.esperaMs);
}
/** fn(diretor) já, ou quando o replay chegar (se `valer()` ainda disser que vale). */
function comDiretor(fn, valer = () => true) {
  if (diretor) { fn(diretor); return; }
  carregarSobDemanda('replay').then(() => { if (diretor && valer()) fn(diretor); }, () => {});
}
let replayAuto = params.get('replay') === '0' ? false : params.get('replay') === '1' ? true : typeof prefs.replay === 'boolean' ? prefs.replay : CFG.REPLAY.automatico;
const custoGravar = { n: 0, ms: 0 }, custoReplay = { n: 0, ms: 0, v: new Float64Array(4096) };
const listaR = [];
const _bpR = { x: 0, y: 0, z: 0 }, _bqR = { x: 0, y: 0, z: 0, w: 1 }, _qR = new THREE.Quaternion();
let replayBotoes = 0;     // botões já segurados quando o replay começou: só pulam depois de soltos e apertados de novo
const somAdiado = [];     // sons do passo que abriu o replay do gol ou a cena de substituição: tocam quando a fila esvazia
// fila única das cenas que esperam o replay acabar: as faixas do intervalo/fim (funções) e as cenas de substituição
// ({tipo: 'subst' | 'faixaSub', pares}); a de substituição nunca corta o replay (o defeito do EA FC 26)
const filaCenas = [];
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
// Treinadores (js/tecnicos.js): só na partida; ?tecnicos=0 desliga (comparação A/B do custo). tecAlfaCena: o último passo
// deles veio da cena (simulação segura): o desenho interpola com o alfa da cena
const TECNICOS_ON = params.get('tecnicos') !== '0';
let tecnicos = null, tecAlfaCena = false, tecVisiveis = true;
// x/z de cada treinador no último passo GRAVADO no anel (por time): os passos de uma cena com o mundo parado não são
// gravados — se ele andou neles, o passo seguinte vira corte (REPLAY.saltoTecnico)
const tecGravado = [NaN, NaN, NaN, NaN];
const leituraTec = criarLeitura();
const custoTec = { n: 0, ms: 0 };
const _leituraVazia = [];
// Substituição (js/substituicao.js): ?substituicao=0|1 força; senão a preferência salva ("Cena de substituição" no "Modo de
// jogo"); senão desligada nos testes automatizados (webdriver), nos prints e na demonstração; senão SUBST.ligada.
const SUBC = CFG.SUBST;
const substParam = params.get('substituicao');
let substLigada = substParam === '1' ? true : substParam === '0' ? false
  : typeof prefs.substituicao === 'boolean' ? prefs.substituicao : (navigator.webdriver || PRINTS || DEMO_ON) ? false : SUBC.ligada;
let cenaSub = null;          // a cena em andamento (o laço segura a simulação)
let subBotoes = 0;           // botões segurados no começo: só pulam depois de soltos e apertados de novo
const substNoPasso = [];     // as trocas do passo (com a posição de quem saiu no tick anterior: o anel do replay)
const faixaSub2T = [];       // trocas do intervalo: a faixa na saída do 2º tempo
let estadoAntesPasso = null; // estado da partida antes do passo (a troca do fim do intervalo não abre cena)
let emRodarPassos = false;   // a API dos testes (rodarPassos) nunca abre a cena
const planoCamSub = criarPlanoCameraSubst();
const custoSub = { n: 0, ms: 0 };
const _evSub = [], _placa = { x: 0, y: 0, z: 0, rumo: 0 }, _parPlaca = {};
let placaSub = null;
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
// Total Match: a súmula (sumula.js; a mesma ao vivo e no "Simular o resto"), o "Simular o resto" em andamento e o aviso do
// travado expulso (uma vez)
let sumulaTM = TM ? criarSumula() : null;
let simulandoTM = null;      // {promessa} enquanto o "Simular o resto" roda em pedaços (simularResto)
let expulsoAvisado = false;

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
const _entTime = { [TIME_HUMANO]: { x: 0, z: 0, botoes: 0, repete: false, iaCobra: false } };
Object.defineProperties(_entTime, {
  x: { value: 0, writable: true }, z: { value: 0, writable: true }, botoes: { value: 0, writable: true },
  repete: { value: false, writable: true }, iaCobra: { value: false, writable: true },
});
// trava "só o meu jogador" (Rumo ao Estrelato do TM): TROCAR e GOLEIRO não chegam ao mundo (a lógica também recusa a troca)
// "só o meu jogador": sem TROCAR; sem GOLEIRO (sair com o goleiro) a não ser que o travado seja o próprio goleiro
const TRAVA_GOLEIRO = TRAVA_TM != null && mundo.jogadores.some(j => j.id === TRAVA_TM && j.posicao === 'GOL');
const MASCARA_TRAVA = TRAVA_TM != null ? ~(BOTAO.TROCAR | (TRAVA_GOLEIRO ? 0 : BOTAO.GOLEIRO)) : ~0;
function entradaDoTime(e) {
  const x = e?.x ?? 0, z = e?.z ?? 0, botoes = ((e?.botoes ?? 0) | 0) & MASCARA_TRAVA, repete = !!e?.repete;
  // a IA jogando pelo humano (?demo=1: a entrada da demo traz `ia` ou `iaCobra`): os botões NÃO são da pessoa — sem
  // cavadinha por dois toques nem espera do toque rápido (sim.js/partida.js porHumano). Só a marca `iaCobra` passa: o
  // `ia` a página nunca entregou (a recepção e o goleiro da demo da página seguem como antes; contraprova 13/10: sem a
  // marca, a cobrança da demo virava cavadinha, 9 em 40 pênaltis)
  const ia = !!(e && (e.ia || e.iaCobra));
  const d = _entTime[TIME_HUMANO];
  d.x = x; d.z = z; d.botoes = botoes; d.repete = repete; d.iaCobra = ia;
  _entTime.x = x; _entTime.z = z; _entTime.botoes = botoes; _entTime.repete = repete; _entTime.iaCobra = ia;
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
  // os treinadores do mundo novo (na partida), em pé no centro da área técnica deles
  tecnicos = TECNICOS_ON && mundo.times ? criarTecnicos(mundo.times, mundo.semente ?? SEMENTE) : null;
  tecAlfaCena = false; tecGravado.fill(NaN);
  for (const j of mundo.jogadores) estadoDe(j);
  copiarBolaDoMundo(bolaAtu);
  copiarBolaDoMundo(bolaAnt);
  fase.atual = faseDoMundo(); fase.defesaDesde = null; fase.agora = fase.atual; fase.posseRival = false;
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
  estadoAntesPasso = mundo.partida?.estado ?? null;
  substNoPasso.length = 0;
  const t0 = agoraMs();
  const eventos = passoDoMundo(mundo, entradaDoTime(entrada), acoes) ?? mundo.eventos ?? [];
  // súmula do Total Match (só lê o mundo e os eventos do passo)
  if (sumulaTM && mundo.modo === 'partida') sumulaPasso(sumulaTM, mundo, eventos);
  const t1 = agoraMs();
  contPassos++;
  passosTotais++;
  estadioPasso(eventos);
  // treinadores: um passo deles por passo da simulação, lendo o mundo (nada é escrito nele)
  if (tecnicos) {
    const tt = agoraMs();
    leituraDoMundo(mundo, eventos, leituraTec);
    passoTecnicos(tecnicos, leituraTec);
    tecAlfaCena = false;
    custoTec.n++; custoTec.ms += agoraMs() - tt;
  }
  // atual ← pose deste passo (calculada uma vez por passo); quem saiu do mundo (marcador
  // desligado, substituição) perde o estado — sem alocar nada por passo
  let cortou = false;
  for (const j of mundo.jogadores) {
    const e = estadoDe(j);
    pose(j, mundo, e.atu);
    // disputa de pênaltis: os gestos da reação e do fim por cima da pose (só desenho)
    if (mundo.disputa) MOD_DISP.poseDisputa(mundo, j, e.atu);
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
  gravarNoAnel(cortou, eventos);
  for (const ev of eventos) tratarEvento(ev);
  // as trocas do passo viram UMA cena (ou só a faixa) — decidido no fim do passo: no gol, as trocas e a 'saida' saem no
  // mesmo tick (as trocas antes) e o replay do gol, que a saída abre, vem primeiro
  if (substNoPasso.length) decidirSubst(eventos);
  // as trocas feitas NO APITO do intervalo (a edição pendente vale ali, Regra 3): a faixa na saída do 2º tempo — o passo
  // em que o intervalo acaba, também sem troca nova nele (antes elas ficavam guardadas e a faixa nunca aparecia)
  else if (faixaSub2T.length && estadoAntesPasso === 'intervalo' && mundo.partida?.estado !== 'intervalo') faixaDoIntervalo();
  atualizarFase();
}

/**
 * Grava o passo no anel do replay: só COPIA o que o desenho já calculou (a pose deste passo, x/z/rumo, a bola), o
 * relógio do estádio, a foto da Regra 11 em vigor (m.partida.imped, só lida) e as marcas do passo (chute ou cabeceio para
 * o gol, gol: marcasDoPasso, com m.voo só lido) — a cena
 * semiautomática. Nada é escrito no mundo (o hash não muda); nada é alocado.
 */
function gravarNoAnel(cortou, eventos) {
  const tg = agoraMs();
  // o treinador que andou nos passos de uma cena com o mundo parado (a substituição: eles saem da frente dos atores) chega
  // longe do último passo gravado: corte (antes o replay seguinte o deslizava 3 m num passo)
  if (tecnicos) for (const tc of tecnicos.tecs) {
    const o = tc.time * 2;
    if (Math.hypot(tc.x1 - tecGravado[o], tc.z1 - tecGravado[o + 1]) > CFG.REPLAY.saltoTecnico) cortou = true;
    tecGravado[o] = tc.x1; tecGravado[o + 1] = tc.z1;
  }
  anel.inicio(mundo.tick, passosTotais * PASSO, cortou);
  let v = 0;
  for (const j of mundo.jogadores) {
    const e = estJ.get(j.id);
    if (e) anel.jogador(v++, j.id, j.time, j.posicao === 'GOL', e.x1, e.z1, e.r1, e.atu);
  }
  // os treinadores depois dos jogadores (bit2: técnico): a pose deles depende do caminho, então vai gravada
  if (tecnicos) for (const tc of tecnicos.tecs) anel.jogador(v++, tc.id, tc.time, false, tc.x1, tc.z1, tc.r1, tc.atu, true);
  const im = mundo.partida?.imped;
  if (im) anel.foto(im.tick, im.time, im.por, im.defensor, im.linhaX, mundo.ataca[im.time]);
  anel.marcar(marcasDoPasso(eventos, mundo.voo));
  anel.fim(bolaAtu.p, bolaAtu.q);
  custoGravar.n++; custoGravar.ms += agoraMs() - tg;
}

// Ataque × defesa (botões de toque e Y do controle): ataque quando a bola é de um jogador do
// meu time (m.posse) ou viaja de um passe do meu time (m.voo.de) ou vem para o controlado
// (j.recebe) ou, solta e sem dono (rebote, sobra, desvio), o controlado chega nela antes de qualquer adversário;
// defesa caso contrário. Vira ataque na hora; defesa só depois de 0,25 s (uma bola solta por um instante entre o
// passe e o domínio não pisca os botões). A histerese é só dos botões VISÍVEIS: o sentido das teclas e do controle
// (J/K/O, A/B/Y/RB) é fixado pela fase de AGORA (faseDoMundo) — apertar O logo depois de perder a bola é PRESSÃO,
// não PEGAR.
const fase = { atual: 'ataque', defesaDesde: null, agora: 'ataque', posseRival: false };
function timeDe(id) { return id == null ? null : (jogadorPorId(mundo, id)?.time ?? null); }
/**
 * Tempo (s) até j alcançar a bola solta pelo caminho dela (bola em linha reta, freando como a rolagem; corpo em
 * arrancada): o 1º instante de 0 a 2 s em que a distância cabe no que ele corre. Só para a fase dos botões.
 */
function tempoAteBola(j, b) {
  const v = j.par?.vArrancada ?? 8;
  for (let k = 0; k <= 20; k++) {
    const t = k * 0.1, s = (1 - Math.exp(-0.6 * t)) / 0.6; // distância percorrida pela bola ÷ velocidade
    const bx = b.p.x + b.v.x * s, bz = b.p.z + b.v.z * s;
    if (Math.hypot(bx - j.x, bz - j.z) - 0.6 <= v * t) return t;
  }
  return Infinity;
}
function faseDoMundo() {
  const m = mundo;
  if (m.posse != null) return timeDe(m.posse) === TIME_HUMANO ? 'ataque' : 'defesa';
  if (m.voo && timeDe(m.voo.de) === TIME_HUMANO) return 'ataque';
  const c = jogadorPorId(m, idControlado());
  if (c && c.recebe) return 'ataque';
  // bola solta sem dono (rebote do goleiro, sobra, desvio) vindo para o meu controlado: ataque se ele chega nela antes
  // de qualquer adversário — o botão grande é o CHUTE (de primeira), não o TROCAR (que tirava o controle dele)
  if (c && !m.voo && !(m.parada && !m.parada.rolou)) {
    const tc = tempoAteBola(c, m.bola);
    if (Number.isFinite(tc)) {
      let tr = Infinity;
      for (const o of m.jogadores) {
        if (o.time === TIME_HUMANO || o.papel === 'parado' || o.papel === 'marcador') continue;
        tr = Math.min(tr, tempoAteBola(o, m.bola));
        if (tr <= tc) break;
      }
      if (tc < tr) return 'ataque';
    }
  }
  return 'defesa';
}
function atualizarFase() {
  const f = faseDoMundo();
  if (f === 'ataque') { fase.atual = 'ataque'; fase.defesaDesde = null; }
  else if (fase.atual !== 'defesa') {
    if (fase.defesaDesde == null) fase.defesaDesde = mundo.tick;
    if (mundo.tick - fase.defesaDesde >= 15) { fase.atual = 'defesa'; fase.defesaDesde = null; }
  }
  fase.agora = f;
  // o adversário com a bola no pé: a perda é certa (o toque no botão de ataque ainda visível vale pelo da defesa)
  fase.posseRival = mundo.posse != null && timeDe(mundo.posse) !== TIME_HUMANO;
  if (entrada) entrada.definirFase(fase.atual, fase.agora, fase.posseRival);
  // o PEGAR aparece com o goleiro do humano com a bola no pé (partida), com a bola em jogo e a MÃO VALENDO ali
  // (regras-goleiro.js maoPermitida: na própria área, sem recuo e sem a bola que ele mesmo soltou) — onde o toque pega a
  // bola (sim.js pegarDoHumano). Depois do recuo ele não aparece: pegar seria tiro livre indireto (Regra 12.2; a tecla
  // O/RB ainda marca a infração, como no jogo de verdade)
  if (entrada && entrada.definirGoleiroPe) {
    const c = jogadorPorId(mundo, idControlado());
    const b = mundo.bola.p;
    entrada.definirGoleiroPe(!!(mundo.partida && c && c.posicao === 'GOL' && mundo.posse === c.id && mundo.naMao !== c.id
      && !(mundo.parada && !mundo.parada.rolou) && maoPermitida(mundo, c, b.x, b.z)));
  }
  // com a bola nas mãos do goleiro do humano (partida), o TROCAR aparece no ataque (vaga 'e'): o Q do teclado já trocava
  if (entrada && entrada.definirGoleiroMao) {
    const c = jogadorPorId(mundo, idControlado());
    entrada.definirGoleiroMao(!!(mundo.partida && c && c.posicao === 'GOL' && mundo.naMao === c.id));
  }
}

/** Fim dos efeitos do gol (saída de bola, recomeço do treino): o "GOL!" sai e a câmera de jogo volta. */
function encerrarEfeitosGol() {
  if (cam && cam.efeitoAtivo) { cam.encerrarGol(); corteCamera = true; }
  hud.esconderGol();
}
const textoPlacar = () => {
  const t = hud.times;
  return `${t[0].sigla} ${mundo.placar?.[0] ?? 0} × ${mundo.placar?.[1] ?? 0} ${t[1].sigla}`;
};
/**
 * Eventos da disputa de pênaltis (true = tratado aqui; o resto segue o caminho da partida): o gol só com o "GOL!" e o placar
 * pulsando (sem a câmera do gol, o replay automático nem a comemoração: a disputa tem a reação dela e a câmera dela), as
 * dicas de comando na 1ª vez que o humano bate e defende, e a faixa do fim.
 */
const dicaDisputa = { bate: false, defende: false };
function eventoDisputa(ev) {
  const t = ev.tipo;
  if (t === 'gol') { hud.evento(ev); return true; }
  if (t === 'fimDeJogo' || t === 'saida' || t === 'intervalo' || t === 'disputaCobranca') return true;
  if (t === 'disputaCobrador') {
    // (sem toque, a tecla do CHUTE no texto: no PC não há botão CHUTE na tela; revisão de 16/10)
    const toque = document.documentElement.classList.contains('com-toque');
    if (ev.time === TIME_HUMANO && !dicaDisputa.bate) { dicaDisputa.bate = true; hud.evento('penaltisBate', toque ? {} : { texto: 'Sua vez: mire e segure K (no controle, B)' }); }
    else if (ev.time !== TIME_HUMANO && !dicaDisputa.defende) { dicaDisputa.defende = true; hud.evento('penaltisDefende'); }
    return true;
  }
  if (t === 'disputaFim') { fimDaDisputa(); return true; }
  return false;
}
/** A faixa do fim da disputa ("X venceu nos pênaltis", o placar) com "Jogar de novo" ou, com ?tm, "Voltar ao Total Match". */
function faixaFimDisputa() {
  const D = mundo.disputa;
  const venc = D && D.vencedor != null ? hud.times[D.vencedor]?.nome ?? '' : '';
  hud.faixa({ titulo: `${venc} venceu nos pênaltis`, placar: textoPlacar(), botao: true,
    botaoTexto: TM ? 'Voltar ao Total Match' : 'Jogar de novo', botaoCmd: TM ? 'voltar-tm' : 'reiniciar-partida' });
}
function fimDaDisputa() {
  // Total Match: o resultado fica gravado já no apito (o TM lê de lá se a mensagem se perder)
  if (TM) gravarResultadoTM(resultadoAtualTM());
  hud.definirEstado({ fim: true });
  faixaFimDisputa();
}
function tratarEvento(ev) {
  const t = ev.tipo;
  if (mundo.disputa && eventoDisputa(ev)) return;
  // gol: "GOL!" (sem autor nem minuto escritos: nada de narração na tela), placar pulsando e o efeito da câmera
  if (t === 'gol') {
    hud.evento(ev);
    // partida: corte para a câmera do gol (até a saída); treino: zoom/tremor leve (até o recomeço)
    if (cam) cam.efeitoGol((mundo.bola.p.x > 0 ? 1 : -1) * CFG.CAMPO.meioX, mundo.bola.p.z, { fechado: !!mundo.partida });
    // replay: o gol fica pendente até o pós-gol chegar na vez dele (o chute que vale o gol: autor-gol.js)
    // (o autor de verdade, gol contra, desvio e o tipo do toque: a 1ª pessoa do replay). Replay ainda não baixado (gol
    // antes da pré-carga): pede já e o gol entra quando ele chegar — se a saída de bola ainda não passou (golSemDiretor)
    if (mundo.partida) {
      const g = autorGol.gol, deAgora = g.ativo && g.tick === mundo.tick;
      const dg = {
        golTick: mundo.tick, chuteTick: autorGol.chute.ativo ? autorGol.chute.tick : null, lado: mundo.bola.p.x > 0 ? 1 : -1, time: ev.time,
        autor: deAgora ? g.id : (ev.autor ?? null), contra: deAgora ? !!g.contra : false, desvio: deAgora ? !!g.desvio : false,
        tipoChute: autorGol.chute.ativo ? autorGol.chute.tipo : null,
      };
      const m0 = mundo;
      golSemDiretor = diretor ? null : dg;
      comDiretor(d => { golSemDiretor = null; d.aoGol(dg); }, () => golSemDiretor === dg && mundo === m0);
    }
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
  // depois do gol, o replay entra na saída de bola (com todos já montados: o roteiro para antes do corte); o gol que
  // esperava o replay baixar e não chegou a tempo fica sem replay
  if (t === 'saida' || t === 'intervalo' || t === 'fimDeJogo' || t === 'recomeco') golSemDiretor = null;
  if (t === 'saida' && diretor?.golPendente) posGol();
  // impedimento: o replay no apito, com a linha no quadro do passe (a foto da Regra 11: ev.tickFoto) e a análise
  // semiautomática (o defensor da linha vem do evento)
  // (replay ainda não baixado: pede já e entra quando chegar, se ainda for o mesmo apito, até REPLAY_ATRASO_MAX passos)
  if (t === 'impedimento' && replayAuto && mundo.partida) {
    const di = { fotoTick: ev.tickFoto, apitoTick: mundo.tick, linhaX: ev.linhaX, idImpedido: ev.id, time: ev.time, lado: mundo.ataca?.[ev.time] ?? 1, defensor: ev.defensor ?? null, por: ev.por ?? null };
    const m0 = mundo;
    comDiretor(d => { if (iniciarReplay(d.impedimento(di))) linhaNoReplay = di.apitoTick; },
      () => mundo === m0 && mundo.tick - di.apitoTick <= REPLAY_ATRASO_MAX && !cenaGol && !cenaSub && !diretor.ativo);
  }
  // partida: intervalo, fim, edição do time e substituição (intervalo e fim: plano geral do estádio). Gol no último
  // lance do tempo: o replay dele vem antes da faixa
  if (t === 'intervalo') {
    const faixa = () => hud.faixa({ titulo: 'Intervalo', placar: textoPlacar(), ms: Math.round((CFG.PARTIDA?.intervalo ?? 3) * 1000) });
    encerrarEfeitosGol();
    if (cam) cam.planoGeral(true);
    if (diretor?.golPendente && posGol()) filaCenas.push(faixa); else faixa();
    return;
  }
  if (t === 'fimDeJogo') {
    // Total Match: o resultado fica gravado já no apito (o TM lê de lá se a mensagem se perder); o botão da faixa volta ao TM
    if (TM) gravarResultadoTM(resultadoAtualTM());
    const faixa = () => hud.faixa(TM ? { titulo: 'Fim de jogo', placar: textoPlacar(), botao: true, botaoTexto: 'Voltar ao Total Match', botaoCmd: 'voltar-tm' }
      : { titulo: 'Fim de jogo', placar: textoPlacar(), botao: true });
    hud.definirEstado({ fim: true });
    encerrarEfeitosGol();
    if (cam) cam.planoGeral(true);
    if (diretor?.golPendente && posGol()) filaCenas.push(faixa); else faixa();
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
    // a troca feita (dos dois times): a cena e a faixa ENTRA/SAI de TV no fim do passo (decidirSubst). A posição de quem
    // saiu no tick anterior vem do anel do replay (o mundo já não tem mais ele)
    const a = jogadorNoTick(anel, mundo.tick - 1, ev.sai);
    substNoPasso.push({ time: ev.time, sai: ev.sai, entra: ev.entra, antes: a ? { x: a.x, z: a.z } : null });
    return;
  }
  // Total Match, "só o meu jogador": o travado foi expulso — o time segue com a IA e a faixa oferece o "Simular o resto"
  if (t === 'cartao' && TRAVA_TM != null && ev.id === TRAVA_TM && ev.cor === 'vermelho' && !expulsoAvisado) {
    expulsoAvisado = true;
    hud.faixa({ titulo: 'Você foi expulso', placar: textoPlacar(), botao: true, botaoTexto: 'Simular o resto', botaoCmd: 'simular-resto', ms: 6000 });
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
    // a bolsa começa no FIM do passo, quando a bola DESENHADA (interpolada de p0 a p1) encosta na rede (com meio passo
    // antes, a bola desenhada dava um pulo para a frente no quadro da batida: a bolsa somava ~9 cm ao passo dela)
    if (registrarImpacto(ondas, _impactos[k], tFim)) emocaoEvento(emocao, { tipo: 'redeImpacto', vel: _impactos[k].vel }, _ctxEmocao);
  }
  for (const ev of eventos) emocaoEvento(emocao, ev, _ctxEmocao);
  const p = _passoEmocao;
  p.t = tFim; p.bola = b.p; p.ataca = mundo.ataca; p.estado = mundo.partida?.estado ?? null;
  p.posseTime = mundo.posse != null ? timeDe(mundo.posse) : (mundo.voo ? (mundo.voo.time ?? timeDe(mundo.voo.de)) : (mundo.partida?.ultimoTime ?? null));
  emocaoPasso(emocao, p, PASSO);
  const ds = consumirDisparos(emocao);
  // o passo que abre o replay do gol (saída de bola, intervalo, fim) ou a cena de substituição: o apito dele (o da saída,
  // o do recomeço) toca DEPOIS, quando a fila de cenas esvazia
  const adiar = (replayAuto && !!diretor?.golPendente && !!mundo.partida && eventos.some(e => e.tipo === 'saida' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo'))
    || abreCenaSubst(eventos);
  for (const d of ds) { if (adiar) somAdiado.push(d); else tocarSom(d); }
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
  for (const d of ds) tocarSom(d);
  // disputa de pênaltis: o 1º cobrador já vem na criação (a dica de comando da 1ª cobrança)
  if (mundo.disputa) for (const ev of evs) eventoDisputa(ev);
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
let ultimoAgora = 0;      // o relógio do laço no último quadro (ms; o manual nos testes): a faixa ENTRA/SAI conta por ele
const laco = criarLaco();
// ?prints=1: relógio manual desde o início — a simulação só anda quando o script mandar
let relogioManual = PRINTS, tempoManual = 0;
let pausaTeste = false;
let ultimoQuadro = null;
let corteCamera = true;
let kmhVisto = 0;
const lista = [];
const planoDisputa = { nome: null, de: [0, 0, 0], para: [0, 0, 0], fov: 30 }; // o plano da câmera da disputa (reaproveitado)
let telaDisp = null;      // as bolinhas da disputa (disputa-tela.js), criadas no 1º quadro da disputa
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

function pausado() { return hud.menuAberto || hud.ajudaAberta || !!editor?.aberto || retratoBloqueado(); }

// uniforme de cada jogador pelo elenco (partida); null no treino (o desenho usa o do time)
const kitCache = new Map();
function kitDoId(id, goleiro) {
  if (!mundo.times) return null;
  // os treinadores antes do elenco (não são jogadores)
  if (id === IDS_TECNICOS[0]) return 'tecnico0';
  if (id === IDS_TECNICOS[1]) return 'tecnico1';
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
  // bola interpolada (na cena de substituição, parada onde ela está: no chão se o cobrador de agora é quem entra)
  if (cenaSub) { _bp.x = cenaSub.bola.x; _bp.y = cenaSub.bola.y; _bp.z = cenaSub.bola.z; _qd.copy(bolaAtu.q); }
  else {
    _bp.x = lerp(bolaAnt.p.x, bolaAtu.p.x, alfa);
    _bp.y = lerp(bolaAnt.p.y, bolaAtu.p.y, alfa);
    _bp.z = lerp(bolaAnt.p.z, bolaAtu.p.z, alfa);
    _qd.slerpQuaternions(bolaAnt.q, bolaAtu.q, alfa);
  }
  // a bola DESENHADA vai junto no bojo da rede (o ponto da física fica em render.bola)
  const tEst = tempoEstadio();
  if (redeLigada) empurraoBola(ondas, _bp, tEst, _emp); else { _emp.x = 0; _emp.y = 0; _emp.z = 0; }
  _bpDes.x = _bp.x + _emp.x; _bpDes.y = _bp.y + _emp.y; _bpDes.z = _bp.z + _emp.z;
  bola3d.atualizar(_bpDes, _qd);
  uniformsRede(ondas, redeLigada ? tEst : -1e9, campo.rede.a, campo.rede.b);
  // jogadores interpolados (quantos houver, dos dois times)
  const idC = idControlado();
  const idProx = fase.atual === 'defesa' && TRAVA_TM == null ? (mundo.proximaTroca?.[TIME_HUMANO] ?? null) : null;
  // companheiro chamado pelo PRESSÃO no último passo (só lê o mundo: o desenho nunca muda a simulação)
  const idPress = mundo.partida ? pressionadorVisivel(mundo, TIME_HUMANO) : -1;
  // Regra 12.3: o anel dos últimos 5 s sob o goleiro do humano com a bola nas mãos (só lê o mundo)
  const rel = mundo.partida ? relogioMao(mundo, TIME_HUMANO) : null;
  let n = 0;
  let hx = 0, hz = 0, achou = false;
  if (cenaSub) {
    // substituição: os atores da cena (os 22 parados, quem sai, quem entra e o quarto árbitro), sem anel do controlado
    const al = cenaSub.alfa;
    for (const a of cenaSub.atores) {
      const des = a.des ?? (a.des = new Float32Array(NJ * 3));
      interpolarPose(a.ant, a.atu, al, des);
      const it = lista[n] ?? (lista[n] = {});
      it.id = a.id; it.time = a.time; it.pose = des; it.controlado = false; it.goleiro = a.goleiro; it.proximo = false;
      it.pressiona = false; it.relogio = -1; it.tecnico = false; it.ocultar = 0; // (a vaga da lista pode ter sido de um treinador)
      it.kit = a.kit ?? kitDoId(a.id, a.goleiro);
      it.x = lerp(a.x0, a.x1, al); it.z = lerp(a.z0, a.z1, al); it.rumo = lerpAng(a.r0, a.r1, al);
      n++;
    }
  } else if (cenaGol) {
    // comemoração: os atores da cena (cópias andando no relógio dela) no lugar dos da simulação; sem anel do controlado
    const al = cenaGol.alfa;
    for (const a of cenaGol.atores) {
      const des = a.des ?? (a.des = new Float32Array(NJ * 3));
      interpolarPose(a.ant, a.atu, al, des);
      const it = lista[n] ?? (lista[n] = {});
      it.id = a.id; it.time = a.time; it.pose = des; it.controlado = false; it.goleiro = a.goleiro; it.proximo = false;
      it.tecnico = false; it.ocultar = 0;
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
    it.pressiona = j.id === idPress && !it.controlado;
    it.relogio = rel && rel.id === j.id ? rel.frac : -1;
    it.tecnico = false; it.ocultar = 0;
    it.kit = kitDe(j);
    it.x = lerp(e.x0, e.x1, alfa); it.z = lerp(e.z0, e.z1, alfa); it.rumo = lerpAng(e.r0, e.r1, alfa);
    if (it.controlado) { hx = it.x; hz = it.z; achou = true; }
    n++;
  }
  // os treinadores (na partida; também com as cenas da comemoração e da substituição no lugar dos jogadores: os últimos
  // passos deles vieram da cena, que interpola com o alfa dela)
  n = anexarTecnicos(lista, n, tecAlfaCena && cenaGol ? cenaGol.alfa : tecAlfaCena && cenaSub ? cenaSub.alfa : alfa);
  lista.length = n;
  const tl1 = performance.now();
  const h = controlado();
  if (!achou && h) { hx = h.x; hz = h.z; }
  else if (!achou && TRAVA_TM != null) { hx = _bp.x; hz = _bp.z; }
  // câmera: controlado + bola; com a bola no ar, antecipa a queda (m.voo.alvo)
  const voo = mundo.voo;
  alvoCam.jx = hx; alvoCam.jz = hz; alvoCam.jvx = h ? h.vx : 0; alvoCam.jvz = h ? h.vz : 0;
  alvoCam.bx = _bp.x; alvoCam.bz = _bp.z;
  const vooAtivo = voo && voo.alvo && Number.isFinite(voo.alvo.x) && (voo.tickChegada == null || mundo.tick <= voo.tickChegada);
  alvoCam.ax = vooAtivo ? voo.alvo.x : NaN; alvoCam.az = vooAtivo ? voo.alvo.z : NaN;
  if (cenaSub) cameraSubst();
  else if (cenaGol) cameraComemoracao();
  // disputa de pênaltis: os planos dela (atrás do cobrador, a reação, o círculo) pela câmera de cinema (corte na troca)
  else if (mundo.disputa) cam.definirCinema(MOD_DISP.planoCameraDisputa(mundo, planoDisputa, posDesenhada));
  cam.atualizar(dt, alvoCam, corteCamera);
  corteCamera = false;
  const f = cam.foco();
  cena3d.acompanhar(f.x, f.z);
  const tj0 = performance.now();
  jog3d.atualizar(lista, cam.camera);
  const tj1 = performance.now();
  // a placa do quarto árbitro nas mãos dele (o par da vez; o do humano primeiro); fora da cena, some
  if (placaSub) {
    if (cenaSub) {
      const q = cenaSub.quarto, pp = paresDaPlaca(cenaSub, tempoCenaSubst(cenaSub), _parPlaca);
      placaSub.mostrar(pp.entra, pp.sai);
      placaSub.atualizar(placaNasMaos(cenaSub, q.des ?? q.atu, _placa), renderizar);
    } else placaSub.atualizar(null, renderizar);
  }
  if (cenaGol || cenaSub) {
    // comemoração: nada do jogo ao vivo no gramado (queda da bola, opções do lateral, linha)
    marcas.grupo.visible = false;
    marcasLat.atualizar(mundo, semPosicao, agoraMs / 1000, dt);
    linhaImped.mostrar(null);
  } else {
    marcas.atualizar(mundo, _bp, agoraMs / 1000, dt);
    // a linha do lance já passou (congelada) no replay do impedimento: não fica parada de novo no jogo
    const ui = mundo.partida?.ultimoImped;
    if (linhaNoReplay != null && ui && ui.tick === linhaNoReplay && mundo.partida.estado !== 'jogo') linhaImped.mostrar(null);
    else linhaImped.atualizar(mundo, dt, renderizar);
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
  if (h && !cenaGol && !cenaSub) {
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
  if (uc && !cenaGol && !cenaSub && mundo.tick >= uc.tick && (mundo.tick - uc.tick) * PASSO < FALTAS.icone) {
    const jc = mundo.jogadores.find(q => q.id === uc.id);
    projetar(jc ? jc.x : uc.x, 2.25, jc ? jc.z : uc.z, _pt);
    if (_pt.atras) hud.cartao(null); else { _cartao.x = _pt.x; _cartao.y = _pt.y; _cartao.cor = uc.cor; hud.cartao(_cartao); }
  } else hud.cartao(null);
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  hud.relogio(mundo.partida && !mundo.disputa ? lerRelogio() : null);
  // disputa: as bolinhas e quem bate (escreve no DOM só quando muda)
  if (mundo.disputa && TELA_DISP) {
    telaDisp ??= TELA_DISP.criarTelaDisputa({ times: () => hud.times, nome: id => { const f = fichaDe(id); return f ? { num: f.num, nome: f.camisa ?? f.nome } : null; } });
    telaDisp.atualizar(mundo, TIME_HUMANO);
  }
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
/**
 * Acrescenta os 2 treinadores à lista do desenho a partir de n (interpolados por al; o kit deles e o estilo de treinador):
 * os ramos do jogo, da comemoração e do pré-jogo usam esta mesma função. Devolve o novo n.
 */
function anexarTecnicos(L, n, al, T = tecnicos) {
  if (!T || !tecVisiveis) return n;
  for (const tc of T.tecs) {
    const it = L[n] ?? (L[n] = {});
    const des = tc.des ?? (tc.des = new Float32Array(NJ * 3));
    interpolarPose(tc.ant, tc.atu, al, des);
    it.id = tc.id; it.time = tc.time; it.pose = des; it.controlado = false; it.proximo = false; it.goleiro = false;
    it.pressiona = false; it.relogio = -1; // a vaga da lista pode ter sido de um jogador (marcas do PRESSÃO e dos 8 s)
    it.tecnico = true; it.ocultar = 0; it.kit = kitTecnico(tc.time);
    it.x = lerp(tc.x0, tc.x1, al); it.z = lerp(tc.z0, tc.z1, al); it.rumo = lerpAng(tc.r0, tc.r1, al);
    n++;
  }
  return n;
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
  cenaBotoes = entrada ? entrada.ler(yawEntrada()).botoes : 0;
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
  // a simulação já está segura no gol + 149: os treinadores andam os passos da cena, com o mundo parado
  const segura = seguraSimulacao();
  const nCena = avancarCena(c, dt);
  custoCena.n += nCena;
  if (segura && tecnicos && nCena > 0) {
    leituraDoMundo(mundo, _leituraVazia, leituraTec);
    for (let k = 0; k < nCena; k++) passoTecnicos(tecnicos, leituraTec);
    tecAlfaCena = true;
  }
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
  // a câmera de cinema nunca dentro de um treinador (a steadicam do alvo na lateral vai até a área técnica)
  if (tecnicos) afastarDeTecnicos(planoCam.de, tecnicos, 0.6);
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
  // os botões de toque voltam: o analógico de descanso calculado com eles escondidos (o pulo solta tudo; a janela pode ter
  // mudado de tamanho) volta ao canto de baixo
  entrada?.reposicionar?.();
  corteCamera = true;
}

/** Com a cena rodando, o passo que monta a saída (gol + 150) espera: a simulação fica no gol + 149. */
function seguraSimulacao() {
  if (!cenaGol || cenaEstado !== 'rodando') return false;
  const p = mundo.partida;
  return !!p && p.estado === 'gol' && mundo.tick + 1 - p.desde >= PASSOS_GOL;
}

// ------------------------------------------------------------------ substituição
/** O passo vai abrir a cena de substituição? (os sons dele esperam a fila esvaziar) */
function abreCenaSubst(eventos) {
  if (!substLigada || emRodarPassos || !mundo.partida) return false;
  let tem = false;
  for (const e of eventos) { if (e.tipo === 'intervalo') return false; if (e.tipo === 'substituicao') tem = true; }
  return tem && estadoAntesPasso !== 'intervalo';
}

/** Cores do time na faixa (as do placar: o verde do mandante e o branco do visitante) e o texto por cima (contraste). */
const COR_TIME = [{ cor: '#19e07a', texto: '#07090a' }, { cor: '#e7eaec', texto: '#07090a' }];
// identidade visual da partida (identidade.js): null = a de hoje; com ?tm, a dos times do Total Match (iniciar)
let IDENT = null;
/** Os pares da faixa ENTRA/SAI (sigla, cor, número e nomes pelo elenco; o do humano primeiro). */
function paresFaixa(pares) {
  const ord = [...pares].sort((a, b) => (a.time === TIME_HUMANO ? 0 : 1) - (b.time === TIME_HUMANO ? 0 : 1));
  return ord.map(p => {
    const el = ELENCOS[elencoDoJogador(p.entra)] ?? ELENCOS[elencoDoJogador(p.sai)];
    const fe = fichaDe(p.entra), fsai = fichaDe(p.sai), ct = COR_TIME[p.time === 1 ? 1 : 0];
    return {
      time: p.time, sigla: el?.sigla ?? (hud.times[p.time]?.sigla ?? ''), nomeTime: el?.nome ?? '', cor: ct.cor, corTexto: ct.texto,
      entra: { num: fe?.num ?? '', nome: fe?.nome ?? String(p.entra), camisa: fe?.camisa ?? String(p.entra) },
      sai: { num: fsai?.num ?? '', nome: fsai?.nome ?? String(p.sai), camisa: fsai?.camisa ?? String(p.sai) },
    };
  });
}
function mostrarFaixaSub(pares, cena = null) { hud.faixaSubst(paresFaixa(pares), ultimoAgora, cena); }

/**
 * Fim do passo com trocas: trocas do intervalo (o tick do 'intervalo' ou o fim dele) → só a faixa, na saída do 2º tempo;
 * senão a cena (ligada; depois do replay que estiver tocando) ou só a faixa (desligada ou pela API dos testes).
 */
function decidirSubst(eventos) {
  const pares = substNoPasso.map(p => ({ ...p }));
  substNoPasso.length = 0;
  if (!mundo.partida) return;
  const intervalo = eventos.some(e => e.tipo === 'intervalo') || estadoAntesPasso === 'intervalo';
  if (intervalo) {
    faixaSub2T.push(...pares);
    if (estadoAntesPasso === 'intervalo') faixaDoIntervalo();
    return;
  }
  const item = { tipo: substLigada && !emRodarPassos ? 'subst' : 'faixaSub', pares };
  if ((diretor && diretor.ativo) || filaCenas.length || cenaSub) filaCenas.push(item);
  else if (item.tipo === 'subst') iniciarSubst(item);
  else mostrarFaixaSub(pares);
}

/** As trocas do intervalo na faixa (sem cena), na saída do 2º tempo; depois do replay/cena que estiver na frente. */
function faixaDoIntervalo() {
  const pares = faixaSub2T.splice(0);
  if ((diretor && diretor.ativo) || filaCenas.length || cenaSub) filaCenas.push({ tipo: 'faixaSub', pares });
  else mostrarFaixaSub(pares);
}

/** Começa a cena (o mundo segurado no tick das trocas: só cópias). */
function iniciarSubst(item) {
  const plano = planejarSubstituicao(mundo, item.pares, { timeHumano: TIME_HUMANO, posAntes: id => item.pares.find(p => p.sai === id)?.antes ?? null });
  cenaSub = criarCenaSubst(plano, mundo);
  entrada?.limparPulsos();
  // o que já está segurado não pula (só um aperto novo, depois de SUBST.pularDepois)
  subBotoes = entrada ? entrada.ler(yawEntrada()).botoes : 0;
  encerrarEfeitosGol();
  hud.substituicao(true);
  mostrarFaixaSub(item.pares, infoFaixaCena());
  corteCamera = true;
}

const _faixaCena = { pagina: 0, destaque: 'sai' };
/** A página da faixa na cena: o par do plano (SAI, SAI2); no ENTRA passa de par em par; o destaque é quem está no quadro. */
function infoFaixaCena() {
  const c = cenaSub;
  const t = tempoCenaSubst(c), ip = planoEm(c, t), pl = c.plano.planos[ip];
  if (!pl || pl.nome === 'entra') {
    // no ENTRA, do 3º par em diante (o 1º e o 2º já passaram no SAI e no SAI2; os outros, no jogo depois do corte —
    // hud.js fila), sem trocar de página a menos de 0,5 s do corte (antes uma página piscava 0,1 s no fim)
    const t0 = pl ? pl.t0 : c.plano.duracao, n = c.plano.pares.length, pp = n >= 4 ? SUBC.faixa.porParMuitos : SUBC.faixa.porPar;
    const ini = n >= 3 ? 2 : 0, kMax = pl ? Math.max(0, Math.floor((pl.t1 - pl.t0 - 0.5) / pp)) : 0;
    _faixaCena.pagina = (ini + Math.min(kMax, Math.floor(Math.max(0, t - t0) / pp))) % n; _faixaCena.destaque = 'entra';
  } else { _faixaCena.pagina = pl.par; _faixaCena.destaque = 'sai'; }
  return _faixaCena;
}

/** Um quadro da cena (fora da pausa): o pulo, o relógio dela, as palmas de quem cruzou a linha e a faixa. */
function quadroSubst(dt, ent) {
  const c = cenaSub;
  if (tempoCenaSubst(c) < SUBC.pularDepois) subBotoes |= ent.botoes;
  else {
    const novos = ent.botoes & ~subBotoes;
    subBotoes &= ent.botoes;
    if (novos) { fimSubst(true); return; }
  }
  const t0 = performance.now();
  avancarCenaSubst(c, dt);
  // os treinadores andam os passos da cena com o mundo parado (como na comemoração), vendo os atores dela perto das áreas
  // técnicas (quem sai para a ~1,2 m da linha; quem entra cruza no meio): saem da frente deles
  if (tecnicos && c.ticksUltimo > 0) {
    leituraDoMundo(mundo, _leituraVazia, leituraTec);
    atoresNaLeitura(c.atores, leituraTec);
    for (let k = 0; k < c.ticksUltimo; k++) passoTecnicos(tecnicos, leituraTec);
    tecAlfaCena = true;
  }
  const ms = performance.now() - t0;
  custoSub.n += c.ticksUltimo; custoSub.ms += ms; mq.aCena += ms;
  // quem saiu cruzou a linha: palmas da torcida do time dele (relógio do desenho)
  if (c.eventos.length) {
    _ctxEmocao.t = tempoEstadio(); _ctxEmocao.bola = mundo.bola.p; _ctxEmocao.ataca = mundo.ataca;
    for (const ev of consumirEventosSubst(c, _evSub)) emocaoEvento(emocao, ev, _ctxEmocao);
    const ds = consumirDisparos(emocao);
    for (const d of ds) tocarSom(d);
  }
  if (c.acabou) fimSubst(false);
}

/** O plano de câmera da cena no quadro (cortes pelo nome do plano). */
function cameraSubst() {
  planoCameraSubst(cenaSub, { pequena: Math.min(window.innerWidth, window.innerHeight) < 520, aspecto: window.innerWidth / window.innerHeight }, planoCamSub);
  // a câmera de ala (na beira do campo do lado de cá: z de meioZ + 1,5 a + 2,5) nunca dentro de um treinador
  if (tecnicos) afastarDeTecnicos(planoCamSub.de, tecnicos, 0.6);
  if (planoCamSub.nome !== 'fim') cam.definirCinema(planoCamSub);
}

/**
 * Os atores de uma cena (a substituição: o mundo parado) perto das áreas técnicas no lugar dos jogadores da leitura dos
 * treinadores (tecnicos.js leituraDoMundo L.perto: x, z, vx, vz), com o filtro e o teto da leitura.
 */
function atoresNaLeitura(atores, L) {
  L.nPerto = 0;
  const cap = L.perto.length / 4;
  for (const a of atores) {
    if (a.x1 == null || a.z1 < CFG.CAMPO.meioZ - 3 || Math.abs(a.x1) > CFG.TECNICOS.xLim[1] + 4 || L.nPerto >= cap) continue;
    const o = L.nPerto * 4;
    L.perto[o] = a.x1; L.perto[o + 1] = a.z1; L.perto[o + 2] = (a.x1 - a.x0) / PASSO; L.perto[o + 3] = (a.z1 - a.z0) / PASSO;
    L.nPerto++;
  }
}

/** Pula a cena (só ela: a faixa fica os 4 s). Antes de SUBST.pularDepois, nada. */
function pularSubst() {
  if (!cenaSub || tempoCenaSubst(cenaSub) < SUBC.pularDepois) return;
  fimSubst(true);
}

/**
 * Fim da cena (acabou ou pulou): corte SECO para a câmera de TV (Eiserloh, GDC 2016), a faixa passa para o jogo (a
 * contagem segue), o laço solta a simulação já no quadro seguinte, sem recuperar o tempo parado (laco.ultimo andou com o
 * relógio durante a cena), e a próxima cena da fila entra (ou os sons
 * adiados tocam). pulou: o aperto que pulou não vira jogada (a entrada é solta; o botão do controle segurado só vale de
 * novo depois de solto).
 */
function fimSubst(pulou) {
  if (!cenaSub) return;
  cenaSub = null;
  if (cam) cam.definirCinema(null);
  corteCamera = true;
  hud.substituicao(false);
  hud.faixaSubstQuadro(ultimoAgora, null);
  // (o laço não recupera o tempo da cena: durante ela laco.ultimo andou com o relógio; o 1º quadro depois já roda o passo)
  if (entrada) {
    if (pulou) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); }
    entrada.limparPulsos();
    entrada.reposicionar?.();
  }
  proximaCena();
}

/**
 * A próxima da fila de cenas (o replay acabou, ou a cena de substituição): cena de substituição, faixa ENTRA/SAI ou
 * faixa do intervalo/fim. Com a fila vazia, os sons adiados (o apito da saída) tocam.
 */
function proximaCena() {
  while (filaCenas.length) {
    const it = filaCenas.shift();
    if (typeof it === 'function') { it(); continue; }
    // o "Replay" pedido na pausa durante a cena de substituição
    if (it.tipo === 'replay') { if (iniciarReplay(it.ro)) return; continue; }
    if (it.tipo === 'subst' && substLigada && mundo.partida) { iniciarSubst(it); return; }
    mostrarFaixaSub(it.pares);
  }
  tocarAdiados();
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
  // 1ª pessoa: o autor sem cabeça e tronco (o olho está dentro dela); parte 1 do treinador: ele fora da lista
  const dx = diretor.desenho();
  if (dx.ocultar != null) for (const it of listaR) if (it.id === dx.ocultar) it.ocultar = OCULTA.cabeca | OCULTA.tronco;
  const tEst = tempoEstadioAnel(anel, diretor.tick);
  if (redeLigada) empurraoBola(ondas, _bpR, tEst, _emp); else { _emp.x = 0; _emp.y = 0; _emp.z = 0; }
  _bpDes.x = _bpR.x + _emp.x; _bpDes.y = _bpR.y + _emp.y; _bpDes.z = _bpR.z + _emp.z;
  _qR.set(_bqR.x, _bqR.y, _bqR.z, _bqR.w);
  bola3d.atualizar(_bpDes, _qR);
  uniformsRede(ondas, redeLigada ? tEst : -1e9, campo.rede.a, campo.rede.b);
  const f = diretor.posicionar(_bpR, dt * diretor.velocidade, listaR);
  cena3d.acompanhar(f.x, f.z);
  // análise semiautomática: só os jogadores do lance (o impedido, o defensor da linha, quem passou) e a bola
  const sc = diretor.cena();
  const lista = sc.ativa ? soDaCena(listaR, sc.ids) : dx.sem != null ? semId(listaR, dx.sem) : listaR;
  bola3d.mesh.visible = !dx.semBola;
  jog3d.atualizar(lista, diretor.camera);
  desenhadosReplay = lista.length; ultimaListaReplay = lista; ultimoDesenhoReplay = dx;
  // nada do jogo ao vivo no gramado: queda da bola e opções do lateral somem; a linha só no replay do impedimento e na
  // análise; o selo da decisão no terço de baixo (só no quadro final)
  marcas.grupo.visible = false;
  marcasLat.atualizar(mundo, semPosicao, agoraMs / 1000, dt);
  linhaImped.mostrar(diretor.linha(dt));
  linhaImped.mostrarSaot(sc.ativa ? sc : null);
  hud.terco(sc.ativa && sc.decidido ? sc : null);
  // a arquibancada do lado de cá (e a torcida dela) some/aparece pela câmera do replay, como no jogo pela da TV
  campo.atualizar(agoraMs / 1000, diretor.camera, renderizar);
  torcida.atualizar(agoraMs / 1000, emocao, diretor.camera, som ? som.relogioBatida : null, renderizar);
  if (som) som.atualizar(emocao, pausado(), agoraMs / 1000);
  hud.carga(null); hud.cartao(null);
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  hud.relogio(mundo.partida && !mundo.disputa ? lerRelogio() : null);
  { const ms = performance.now() - tq; custoReplay.v[custoReplay.n & 4095] = ms; custoReplay.n++; custoReplay.ms += ms; }
  if (renderizar) cena3d.desenhar(diretor.camera);
  render.bola.x = _bpR.x; render.bola.y = _bpR.y; render.bola.z = _bpR.z;
  const cp = diretor.camera.position;
  render.camera.x = cp.x; render.camera.y = cp.y; render.camera.z = cp.z;
  render.quadros++;
}
const semPosicao = () => null;
// a lista da análise (referências aos itens do anel; nada alocado por quadro) e quantos jogadores o replay desenhou
const listaCena = [];
let desenhadosReplay = 0, ultimaListaReplay = null, ultimoDesenhoReplay = null;
function soDaCena(lista, ids) {
  let k = 0;
  for (const it of lista) if (ids.includes(it.id)) listaCena[k++] = it;
  listaCena.length = k;
  return listaCena;
}
/** A lista sem o `id` (a parte 1 da visão do treinador: ele não se vê). */
function semId(lista, id) {
  let k = 0;
  for (const it of lista) if (it.id !== id) listaCena[k++] = it;
  listaCena.length = k;
  return listaCena;
}

/** Começa um replay (roteiro do diretor). Devolve false se não deu (sem diretor, roteiro vazio, fora da partida). */
function iniciarReplay(ro) {
  if (!diretor || !ro || !mundo.partida) return false;
  if (!diretor.iniciar(ro)) return false;
  // o que já está segurado não pula (só um aperto novo); os apertos curtos já vistos não contam
  entrada?.limparPulsos();
  replayBotoes = entrada ? entrada.ler(yawEntrada()).botoes : 0;
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
  // sem replay: os sons tocam já — menos se o passo traz trocas que abrem a cena (eles esperam ela acabar)
  if (!ok && !(substLigada && !emRodarPassos && substNoPasso.length)) tocarAdiados();
  return ok;
}
/** Toca um disparo da torcida/apito (e conta o pedido: os testes conferem a ORDEM dos sons sem depender do áudio). */
const sonsPedidos = {};
function tocarSom(d) {
  sonsPedidos[d.tipo] = (sonsPedidos[d.tipo] ?? 0) + 1;
  if (som) som.tocar(d);
}
function tocarAdiados() {
  for (const d of somAdiado) tocarSom(d);
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
  hud.terco(null);
  if (bola3d) bola3d.mesh.visible = true;
  if (linhaImped) { linhaImped.mostrar(null); linhaImped.mostrarSaot(null); }
  if (estava) { laco.ultimo = null; corteCamera = true; }
  if (entrada) {
    if (pulou) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); }
    entrada.limparPulsos();
  }
  // a fila: a cena de substituição (gol + troca na mesma parada: depois do replay INTEIRO), as faixas; vazia, os sons
  proximaCena();
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

let pausaAntes = false; // pausado() no quadro anterior (a volta da pausa solta a entrada)
function quadro(agoraMs, desenhar = true) {
  const dtReal = ultimoQuadro === null ? PASSO : Math.max(0, (agoraMs - ultimoQuadro) / 1000);
  ultimoQuadro = agoraMs;
  // pré-jogo: o laço da partida fica parado (tick 0) e o diretor desenha; em pé no celular ou escondida, para
  if (prejogo && prejogo.ativo) {
    entrada.ler(yawEntrada());
    laco.ultimo = agoraMs;
    const emPe = retratoBloqueado();
    if (prejogo.quadro(emPe || document.hidden ? 0 : dtReal, agoraMs, desenhar && !emPe, emPe)) return;
  }
  // "Simular o resto" (Total Match): os passos rodam em pedaços fora daqui (simularResto), sem desenhar; o laço só espera
  if (simulandoTM) { laco.ultimo = agoraMs; entrada.ler(yawEntrada(), agoraMs); entrada.consumirAcoes(); return; }
  const dt = Math.min(0.1, dtReal);
  ultimoAgora = agoraMs;
  const ent = entrada.ler(yawEntrada(), agoraMs);
  for (const a of entrada.consumirAcoes()) tratarAcao(a);
  // a pausa (menu, Ajuda, editor, celular em pé) acabou de fechar: nada apertado nela vira jogada ao voltar — a tecla ou o
  // botão do controle ainda segurado só vale depois de solto e apertado de novo (antes Esc → K → Esc chutava ao voltar)
  const pz = pausado();
  if (pausaAntes && !pz) { entrada.soltarTudo(true); entrada.ler(yawEntrada(), agoraMs); }
  pausaAntes = pz;
  entrada.definirMenu?.(hud.menuAberto || hud.ajudaAberta);
  if (cenaSub) {
    // cena de substituição: a simulação fica parada (como no replay; o laço não recupera o tempo); pausa, aba escondida e
    // celular em pé congelam a cena (ela volta de onde parou); um aperto novo depois de 0,5 s pula
    laco.ultimo = agoraMs;
    if (!pausado() && !pausaTeste && !document.hidden) quadroSubst(dt, ent);
  } else if (diretor && diretor.ativo) {
    // replay: a simulação fica parada (como na pausa; o laço não recupera o tempo); um aperto novo pula
    laco.ultimo = agoraMs;
    if (!pausado()) {
      if (botaoPula(ent.botoes)) fimReplay(true);
      else if (!diretor.avancar(dt)) fimReplay(false);
    }
  } else if (pausado() || pausaTeste) {
    laco.ultimo = agoraMs;     // ao voltar, não tenta recuperar o tempo parado
    // o aperto feito com o jogo parado não fica guardado para o 1º passo depois da pausa
    if (pz) entrada.limparPulsos();
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
      // do 2º passo do quadro em diante o analógico é a MESMA leitura (sim.js aplicarEntrada: `repete` — um gesto que
      // pulou no passo anterior ainda não acabou de ser lido)
      ent.repete = i > 0;
      // (o travado do TM expulso: ninguém do time é dele — a entrada não vai para o mundo)
      const e = DEMO_ON ? (entradaDemoDoMundo(mundo) ?? ent) : cenaGol || expulsoAvisado ? ENTRADA_NEUTRA : ent;
      let ac = filaAcoes.length ? filaAcoes.splice(0) : null;
      // a edição do time entra ANTES das outras ações, no 1º passo depois da pausa
      if (edicaoNaFila) { ac = ac ? [edicaoNaFila, ...ac] : [edicaoNaFila]; edicaoNaFila = null; }
      // o que este passo vê dos botões (o reaperto entre dois passos vira solto + apertado: entrada.js). ANTES do passo:
      // o replay que começa dentro dele (impedimento, gol na saída) limpa isso (limparPulsos) — depois, a tecla
      // segurada no apito ficava como "vista" o replay inteiro e não pulava mais
      entrada.passoUsou(e.botoes);
      rodarPasso(e, ac);
      // o aperto curto (tocou e soltou entre dois passos) já foi visto por um passo
      if (i === 0) { entrada.limparPulsos(true); ent.botoes = entrada.ler(yawEntrada(), agoraMs).botoes; }
      // o replay (gol, impedimento) ou a cena de substituição começou neste passo: os passos que sobraram não rodam (a
      // simulação espera)
      if ((diretor && diretor.ativo) || cenaSub) break;
      // a cortina acabou na saída (a cena saiu): o resto do quadro é do laço normal
      if (i >= r.passos - 1 && !cenaGol) break;
    }
    // segurando, o laço não acumula o tempo parado (e o desenho da simulação fica no passo mais novo)
    if (segurou) { laco.acum = Math.min(laco.acum, laco.passo / 2); alfa = 1; } else alfa = r.alfa;
  }
  // a faixa ENTRA/SAI no relógio do laço (na cena, a página do plano; no jogo, pelo tempo)
  hud.faixaSubstQuadro(agoraMs, cenaSub ? infoFaixaCena() : null);
  // em pé no celular a tela "Gire o celular" cobre tudo: não gasta bateria desenhando por baixo
  if (diretor && diretor.ativo && !cenaSub) desenharReplay(dt, agoraMs, desenhar && !retratoBloqueado());
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
  // "Simular o resto" (Total Match) rodando: nada chega ao jogo nem abre a pausa
  if (simulandoTM) return;
  // o controle na pausa e na Ajuda (entrada.js lerMenuPad): navega nos botões dela; fora delas não faz nada
  if (a.startsWith('menu-')) { if (hud.menuAberto || hud.ajudaAberta) hud.navegarPad(a.slice(5)); return; }
  // pré-jogo: a pausa (Esc, P, Start) pula direto para o jogo
  if (prejogo && prejogo.ativo) { prejogo.acao(a); return; }
  // com o editor aberto nada chega ao jogo: só a pausa (Start do controle), que aplica e fecha
  if (editor?.aberto) { if (a === 'pausa') editor.voltar(); return; }
  // replay: qualquer ação (Esc, Start, R, C, H...) só pula o replay — não abre a pausa nem chega ao jogo
  if (diretor && diretor.ativo && !pausado() && a !== 'qps') { fimReplay(true); return; }
  // comemoração: qualquer ação (Esc, Enter, R, C, H...) só pula a cena (depois de 0,5 s) — não abre a pausa nem chega ao jogo
  if (cenaGol && cenaEstado === 'rodando' && !pausado() && a !== 'qps') { pularComemoracao(); return; }
  // substituição: qualquer ação MENOS a pausa (Esc, P, Start: a pausa congela a cena) só pula a cena (depois de 0,5 s)
  if (cenaSub && !pausado() && a !== 'qps' && a !== 'pausa') { pularSubst(); return; }
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
  if (ehJogo(mundo) && (a === 'recomecar' || a === 'maquina' || a === 'marcador')) { hud.evento('soTreino'); return; }
  if (a === 'marcador' && mundo.modo === 'ataque') { hud.evento('semMarcador'); return; }
  if (a === 'recomecar' || a === 'maquina' || a === 'marcador') {
    filaAcoes.push(a);
    if (a === 'recomecar') hud.evento('recomecar');
  }
}

/** Abre o "Editar time" (partida): a pausa some e a tela mostra o time (ou a edição na fila). */
function abrirEditor() {
  if (mundo.modo !== 'partida' || !mundo.times) return false;
  // a tela ainda não baixou (antes da pré-carga): pede e abre quando chegar (pela pausa: se ela ainda estiver aberta)
  if (!editor) {
    const m0 = mundo, peloMenu = hud.menuAberto;
    carregarSobDemanda('editor').then(() => { if (mundo === m0 && (!peloMenu || hud.menuAberto)) abrirEditor(); }, () => {});
    return true;
  }
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
  // os Pênaltis carregam a disputa na 1ª vez (import dinâmico) e trocam depois
  if (v === 'penaltis' && !MOD_DISP) { carregarDisputa().then(() => trocarModo(v)).catch(() => {}); return; }
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
/** O rótulo da opção "Cena de substituição" (ligada | só a faixa). */
function marcarSubst() {
  const e = document.getElementById('estado-subst');
  if (e) e.textContent = substLigada ? 'ligada' : 'só a faixa';
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

// ------------------------------------------------------------------ Total Match (?tm)
/** O resultado do contrato (§2) pela súmula da partida de agora (sumula.js). */
function resultadoAtualTM() {
  if (TM && mundo.disputa) return MOD_DISP.resultadoPenaltisTM(mundo, TM.mapa);
  return TM && sumulaTM ? resultadoTM(sumulaTM, mundo, TM.mapa) : null;
}
/** Quantos ms de simulação por quadro no "Simular o resto" (o resto do quadro fica para a página respirar). */
const FATIA_SIMULACAO = 30;
let textoSimulando = '';
function mostrarSimulando() {
  const t = mundo.disputa ? textoPlacar() : `${minutoTM(mundo)}' · ${textoPlacar()}`;
  if (t === textoSimulando) return;
  textoSimulando = t;
  hud.faixa({ titulo: mundo.disputa ? 'Simulando o resto da disputa…' : 'Simulando o resto da partida…', placar: t });
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  // (a disputa não tem relógio: o placar dela fica sem ele também enquanto simula)
  hud.relogio(mundo.disputa ? null : lerRelogio());
}
/**
 * "Simular o resto" (Total Match; contrato §5): fecha as cenas (pré-jogo, replay, comemoração, substituição, editor), a
 * IA joga pelo humano (entradaDemoPartida) e passoPartida roda em pedaços de FATIA_SIMULACAO ms por quadro, SEM desenhar
 * (nada de pose, anel, torcida nem cenas: só o mundo e a súmula). No fim: a faixa do fim com "Voltar ao Total Match" e o
 * resultado gravado. Devolve uma Promise com o resultado (os testes esperam por ela).
 */
function simularResto() {
  if (!TM || !ehJogo(mundo) || !mundo.partida) return Promise.resolve(null);
  if (simulandoTM) return simulandoTM.promessa;
  if (prejogo && prejogo.ativo) { prejogo.cancelar(); entrada?.bloquear?.(false); }
  if (diretor && diretor.ativo) fimReplay(false);
  encerrarComemoracao();
  if (cenaSub) { cenaSub = null; if (cam) cam.definirCinema(null); }
  hud.substituicao(false); hud.esconderFaixaSubst();
  filaCenas.length = 0; somAdiado.length = 0; substNoPasso.length = 0; faixaSub2T.length = 0;
  if (editor?.aberto) editor.fechar();
  hud.fecharMenu(); hud.fecharAjuda();
  entrada?.soltarTudo();
  encerrarEfeitosGol();
  textoSimulando = '';
  let ok;
  const promessa = new Promise(r => { ok = r; });
  simulandoTM = { promessa };
  const fatia = () => {
    if (!simulandoTM) return;
    const t0 = performance.now();
    while (mundo.partida.estado !== 'fim' && performance.now() - t0 < FATIA_SIMULACAO) {
      // disputa de pênaltis: a IA bate e defende pelo humano até o fim (sem súmula: o resultado é o da disputa)
      if (mundo.disputa) { MOD_DISP.passoDisputa(mundo, MOD_DISP.entradaDemoDisputa(mundo)); contPassos++; passosTotais++; continue; }
      // a edição na fila (Editar time) entra no 1º passo, como no laço da página
      const ac = edicaoNaFila ? [edicaoNaFila] : null;
      edicaoNaFila = null;
      const ev = passoPartida(mundo, entradaDemoPartida(mundo), ac);
      contPassos++; passosTotais++;
      sumulaPasso(sumulaTM, mundo, ev);
      autorEventos(autorGol, ev, mundo.tick, timeDe);
    }
    mostrarSimulando();
    if (mundo.partida.estado !== 'fim') { requestAnimationFrame(fatia); return; }
    // fim: o desenho volta do estado do mundo (o replay e as cenas do que passou não existem)
    simulandoTM = null;
    anel.limpar(); if (diretor) diretor.limpar();
    iniciarEstados();
    corteCamera = true; laco.ultimo = null; ultimoQuadro = null;
    if (cam) { cam.encerrarGol(); cam.planoGeral(true); }
    entrada?.consumirAcoes?.(); entrada?.limparPulsos?.();
    hud.definirEstado({ fim: true });
    const r = resultadoAtualTM();
    gravarResultadoTM(r);
    if (mundo.disputa) faixaFimDisputa();
    else hud.faixa({ titulo: 'Fim de jogo', placar: textoPlacar(), botao: true, botaoTexto: 'Voltar ao Total Match', botaoCmd: 'voltar-tm' });
    ok(r);
  };
  requestAnimationFrame(fatia);
  return promessa;
}
/** "Voltar ao Total Match": manda o resultado (tm3d:fim); antes do apito final, simula o resto primeiro. */
function voltarAoTM() {
  if (!TM) return;
  if (mundo.partida?.estado === 'fim') { fimTM(resultadoAtualTM()); return; }
  simularResto().then(r => { if (r) fimTM(r); });
}

function comando(c, v) {
  switch (c) {
    case 'continuar': hud.fecharMenu(); break;
    case 'simular-resto': hud.fecharMenu(); simularResto(); break;
    case 'voltar-tm': hud.fecharMenu(); voltarAoTM(); break;
    case 'recomecar': case 'maquina': case 'marcador':
      hud.fecharMenu();
      if (ehJogo(mundo)) { hud.evento('soTreino'); break; }
      if (c === 'marcador' && mundo.modo === 'ataque') { hud.evento('semMarcador'); break; }
      filaAcoes.push(c); if (c === 'recomecar') hud.evento('recomecar'); break;
    case 'editar-time': abrirEditor(); break;
    // "Replay" da pausa: os últimos 10 s (até o último corte), com a simulação parada; volta ao jogo no fim
    case 'replay': {
      if (!ehJogo(mundo)) break;
      // o replay ainda não baixou (antes da pré-carga): pede e volta aqui quando chegar (a pausa fica aberta até lá)
      if (!diretor) { carregarSobDemanda('replay').then(() => { if (hud.menuAberto) comando('replay'); }, () => {}); break; }
      // nada para rever (menos de 0,5 s gravados desde o mundo novo): a pausa fica aberta
      const ro = diretor.menu();
      if (!ro) break;
      hud.fecharMenu();
      // com a cena de substituição rodando, o replay espera ela acabar (ou ser pulada): antes ele começava por baixo dela,
      // invisível, e a classe em-replay escondia a faixa ENTRA/SAI a cena inteira (contraprova de 14/10)
      if (cenaSub) { filaCenas.unshift({ tipo: 'replay', ro }); break; }
      iniciarReplay(ro);
      break;
    }
    case 'replay-pular': if (diretor?.ativo) fimReplay(true); break;
    case 'comemoracao-pular': pularComemoracao(); break;
    case 'substituicao-pular': pularSubst(); break;
    case 'subst-ciclo':
      // "Modo de jogo" → "Cena de substituição": ligada ↔ só a faixa (a faixa ENTRA/SAI fica sempre); salvo
      substLigada = !substLigada;
      prefs.substituicao = substLigada; salvarPrefs(prefs);
      marcarSubst();
      break;
    case 'replayAuto':
      if (v !== 'ligado' && v !== 'desligado') break;
      replayAuto = v === 'ligado';
      prefs.replay = replayAuto; salvarPrefs(prefs);
      hud.definirEstado({ replayAuto });
      break;
    case 'reiniciar-partida':
      hud.fecharMenu();
      if (!ehJogo(mundo)) break;
      // disputa de pênaltis: outra moeda a cada "Jogar de novo" (com ?semente, a seguinte; no meio, a mesma disputa do
      // começo); sem ?semente, outra semente sorteada (sementeDisputa)
      if (mundo.disputa) {
        if (mundo.disputa.estado === 'fim') rodadaDisputa++;
        trocarMundo(novoMundo());
        hud.evento('reinicioDisputa');
        break;
      }
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
      prefs.nomesBotoes = v === 'ligado' ? true : v === 'desligado' ? false : !nomesLigados(); salvarPrefs(prefs);
      aplicarTelaLimpa();
      hud.definirEstado({ nomes: nomesLigados() });
      break;
    default: break;
  }
}

// ------------------------------------------------------------------ início
async function iniciar() {
  // Total Match: ?tm sem o pedido (sumiu do armazenamento) — o TM simula a partida
  if (ID_TM && !TM) {
    hud.erro('A partida do Total Match não foi encontrada. Ela será simulada.');
    sairTM();
    return;
  }
  if (!temWebGL2()) {
    hud.erro(ID_TM ? 'Este navegador não tem WebGL 2, que a partida em 3D precisa. A partida será simulada.'
      : 'Este navegador não tem WebGL 2, que o GOLAÇO precisa para o 3D. Atualize o navegador ou ative a aceleração de hardware.');
    // Total Match: o 3D não roda aqui — o TM simula a partida (sem esperar os 30 s do aviso dele)
    if (ID_TM) sairTM();
    return;
  }
  hud.progresso('Preparando o gramado…');
  await proximoQuadro();
  const canvas = document.getElementById('tela');
  cena3d = criarCena({ canvas, qualidade: qAtual, hora });
  cam = criarCamera(window.innerWidth / window.innerHeight);
  cam.definirModo(camInicial);
  // identidade visual: com ?tm, os escudos decodificados ANTES dos canvas do estádio e da torcida (desenhados uma vez só)
  IDENT = await identidadeDaPagina();
  if (IDENT) { COR_TIME[0] = IDENT.hud.faixa[0]; COR_TIME[1] = IDENT.hud.faixa[1]; }
  campo = criarCampo({ qualidade: qAtual, aniso: cena3d.anisotropia(), identidade: IDENT });
  cena3d.cena.add(campo.grupo);
  campo.definirHora(hora);
  hud.progresso('Enchendo as arquibancadas…');
  await proximoQuadro();
  torcida = criarTorcida(cena3d.cena, { qualidade: qAtual, mascara: mascaraDaIdentidade(IDENT), hora, identidade: IDENT });
  hud.progresso('Montando os jogadores…');
  await proximoQuadro();
  bola3d = criarBola3D(cena3d.cena, qAtual);
  jog3d = criarJogadores3D(cena3d.cena, qAtual);
  // uniformes do Total Match (resolvidos sem confusão: identidade.js) nas chaves que o elenco dele usa
  if (IDENT) jog3d.definirKits(IDENT.kits);
  // a cena de substituição com o máximo de trocas numa parada (5 + 5) desenha 22 + 10 reservas + o quarto árbitro (+ os
  // 2 treinadores)
  jog3d.reservar(22 + 2 * CFG.PARTIDA.subsMax + 1 + (TECNICOS_ON ? IDS_TECNICOS.length : 0));
  marcas = criarMarcas(cena3d.cena, { timeHumano: TIME_HUMANO }); // só a bola alta do meu time ganha marca
  linhaImped = criarLinhaImpedimento(cena3d.cena);
  marcasLat = criarMarcasLateral(cena3d.cena);
  const sombras = QUALIDADE[qAtual].sombras;
  bola3d.definirSombras(sombras);
  jog3d.definirSombras(sombras);
  // os controles de toque apareceram/sumiram: o topo se ajusta e o padrão do minimapa (celular × PC) muda junto
  entrada = criarEntrada({ forcarToque: params.get('toque') === '1', aoAcao: tratarAcao, aoMudarLayout: () => { hud.ajustarTopo(); hud.definirEstado({ minimapa: minimapaLigado() }); } });
  // Total Match, "só o meu jogador": sem TROCAR nem GOLEIRO na tela (a entrada mascara as teclas e o mundo recusa a troca)
  // Total Match (html.tm; js/tm-cara.js): a Inter do TM chega depois do 1º layout — os nomes dos botões de toque (medidos
  // pelo canvas) e o topo do HUD medem de novo com ela. Sem ?tm o aviso 'tm:fontes' nunca vem
  window.addEventListener('tm:fontes', () => { entrada.reposicionar?.(); hud.ajustarTopo(); });
  if (TRAVA_TM != null) for (const id of TRAVA_GOLEIRO ? ['btn-trocar', 'btn-trocar-mao'] : ['btn-trocar', 'btn-goleiro', 'btn-trocar-mao']) { const b = document.getElementById(id); if (b) { b.hidden = true; b.style.display = 'none'; } }
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
    minimapa: minimapaLigado(), nomes: nomesLigados(),
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
    comToque: () => document.documentElement.classList.contains('com-toque'), aoFim: fimDoPrejogo, identidade: IDENT,
  });
  marcarPrejogo();
  marcarSubst();
  // a placa do quarto árbitro (cena de substituição): criada uma vez; pré-carga no 1º quadro desenhado
  placaSub = criarPlacaSubst(cena3d.cena);
  if (!comecarPrejogo(modoPrejogo(), true)) eventosIniciais();
  if (params.get('qps') === '1') hud.mostrarQps(true);
  hud.ajustarTopo();
  // primeiro quadro (compila os shaders) e some a tela de carregamento
  if (prejogo.ativo) prejogo.quadro(0, performance.now(), true);
  else desenharQuadro(PASSO, performance.now());
  adapt.inicio = performance.now();
  hud.pronto();
  api.pronto = true;
  // o replay e o "Editar time" (fora do download inicial): pré-carga no 1º gesto ou ociosa depois deste 1º quadro
  agendarSobDemanda();
  // Total Match: o 3D está no ar (o TM esconde o aviso e o X dele)
  if (TM) avisarTM('tm3d:pronto');
  const aoQuadro = t => {
    requestAnimationFrame(aoQuadro);
    if (!relogioManual) quadro(t);
  };
  requestAnimationFrame(aoQuadro);
}

/** Siglas e nomes do placar: os do elenco na partida; null nos treinos (o HUD usa os dele). */
function timesDoMundo(m) {
  if (!m.times) return null;
  // escudo: o id do elenco (o <symbol id="escudo-<id>"> do index.html; fictícios)
  // (com ?tm: o escudo-imagem, a cor do time e as do minimapa pela identidade — extrasPlacar; sem ?tm, nada a mais)
  return [0, 1].map(t => { const e = ELENCOS[m.times[t].elenco]; return { sigla: e.sigla, nome: e.nome, escudo: e.id, ...extrasPlacar(IDENT, t) }; });
}

function trocarMundo(m, opc = {}) {
  // um pré-jogo tocando (mundo novo pela API, troca de modo): sai sem apitar
  if (prejogo && prejogo.ativo) { prejogo.cancelar(); entrada?.bloquear?.(false); }
  mundo = m;
  contPassos = 0; alfa = 0;
  laco.acum = 0; laco.ultimo = null;
  filaAcoes.length = 0;
  edicaoNaFila = null;
  // Total Match: a súmula é do mundo novo
  if (TM) { sumulaTM = criarSumula(); expulsoAvisado = false; simulandoTM = null; }
  kitCache.clear();
  limparOndas(ondas);
  zerarEmocao(emocao);
  zerarAutorGol(autorGol);
  // replay: o anel e o gol pendente são do mundo velho (os sons adiados e a fila de cenas vão junto)
  somAdiado.length = 0; filaCenas.length = 0; linhaNoReplay = null;
  // substituição: a cena em andamento e a faixa saem (sem tocar nada da fila: ela já foi esvaziada)
  if (cenaSub) { cenaSub = null; if (cam) cam.definirCinema(null); entrada?.reposicionar?.(); }
  substNoPasso.length = 0; faixaSub2T.length = 0;
  hud.substituicao(false); hud.esconderFaixaSubst();
  if (diretor && diretor.ativo) fimReplay(false);
  encerrarComemoracao(); ultimaFinal = null;
  anel.limpar();
  if (diretor) diretor.limpar();
  if (cam) { cam.encerrarGol(); cam.planoGeral(false); cam.definirCinema(null); }
  // disputa de pênaltis: as bolinhas saem (outro modo) e as dicas voltam a aparecer na próxima disputa
  if (telaDisp && !mundo.disputa) telaDisp.limpar();
  dicaDisputa.bate = false; dicaDisputa.defende = false;
  hud.esconderGol();
  if (editor?.aberto) editor.fechar();
  iniciarEstados();
  corteCamera = true;
  if (entrada) entrada.definirFase(fase.atual, fase.agora, fase.posseRival);
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
    // (a cena de substituição nunca abre por aqui: só a faixa)
    emRodarPassos = true;
    try {
      for (let i = 0; i < n; i++) {
        let e, ac = null;
        if (Array.isArray(roteiro)) { e = roteiro[Math.min(i, roteiro.length - 1)]; ac = e.acoes ?? null; }
        else if (roteiro === 'demo') e = entradaDemoDoMundo(mundo);
        else e = roteiro;
        e = e ?? { x: 0, z: 0, botoes: 0 };
        // a edição na fila (Editar time / editarTime) entra no 1º passo, como no laço da página
        if (edicaoNaFila) { ac = ac ? [edicaoNaFila, ...ac] : [edicaoNaFila]; edicaoNaFila = null; }
        rodarPasso({ x: e.x ?? 0, z: e.z ?? 0, botoes: e.botoes ?? 0, iaCobra: !!(e.ia || e.iaCobra) }, ac);
      }
    } finally { emRodarPassos = false; }
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
  /**
   * Total Match (?tm; null sem ele): o pedido, o time do humano, o travado ("só o meu jogador"; id no mundo ou null), o
   * mapa id → {tmId, nome, lado}, a súmula (cópia), o resultado do contrato agora, o "Simular o resto" (Promise com o
   * resultado), as mensagens mandadas ao TM e o que está gravado em localStorage["tm3d:resultado:<id>"].
   */
  tm: TM ? {
    get id() { return ID_TM; },
    get pedido() { return PEDIDO_TM; },
    get humano() { return TIME_HUMANO; },
    get trava() { return TRAVA_TM; },
    get mapa() { return TM.mapa; },
    get controlado() { return mundo.controlado?.[TIME_HUMANO] ?? null; },
    get simulando() { return !!simulandoTM; },
    get mensagens() { return MENSAGENS_TM.map(m => ({ ...m })); },
    sumula() { return sumulaTM ? structuredClone({ ...sumulaTM, autor: undefined }) : null; },
    resultado() { return resultadoAtualTM(); },
    simularResto() { return simularResto(); },
    resultadoGravado() { try { return JSON.parse(localStorage.getItem('tm3d:resultado:' + ID_TM) || 'null'); } catch (_) { return null; } },
  } : null,
  /**
   * Disputa de pênaltis (null fora dela): o resumo (disputa.js resumoDisputa), as bolinhas da tela (disputa-tela.js) e o
   * plano da câmera agora.
   */
  get disputa() { return mundo.disputa && MOD_DISP ? MOD_DISP.resumoDisputa(mundo) : null; },
  telaDisputa() { return telaDisp ? telaDisp.estado() : null; },
  get planoCamera() { return cam ? cam.cinema : null; },
  /** Cópia de m.times[t] (partida) ou null. */
  estadoTime(t = TIME_HUMANO) { return mundo.times?.[t] ? structuredClone(mundo.times[t]) : null; },
  /**
   * Módulos sob demanda (config.js SOB_DEMANDA): ja() pede todos já (sem esperar a pré-carga) e devolve true quando
   * chegaram — os testes de navegador esperam por ele depois do pronto (waitForFunction); estado = {replay, editor}.
   */
  sobDemanda: {
    ja() { if (!SOB.replay.ok || !SOB.editor.ok) carregarSobDemanda().catch(() => {}); return SOB.replay.ok && SOB.editor.ok; },
    get carregado() { return SOB.replay.ok && SOB.editor.ok; },
    get estado() { return { replay: SOB.replay.ok, editor: SOB.editor.ok }; },
  },
  /** A tela "Editar time" (aberto, abrir, voltar = PRONTO, esc, aba, rascunho). */
  editor: {
    get aberto() { return !!editor?.aberto; },
    abrir() { return abrirEditor(); },
    voltar() { return editor?.voltar(); },
    esc() { return editor?.esc(); },
    get aba() { return editor?.aba ?? null; },
    get modo() { return editor?.modo ?? null; },
    get rascunho() { return editor?.rascunho ?? null; },
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
  sincronizarFase() { entrada.definirFase(fase.atual, fase.agora, fase.posseRival); entrada.sincronizarFase(); },
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
   * Cenas de teste e de prints da partida (pedidos do dono de 11/10): monta o lance e devolve os ids. Mexe no mundo —
   * só para testes de navegador e prints (o jogo nunca chama).
   *  'pressao': um adversário de linha com a bola no meu campo, parado, o meu time em volta (para segurar o PRESSÃO);
   *  'goleiroMao': o meu goleiro com a bola nas mãos, controlado, perto da marca do pênalti;
   *  'goleiroPe': o meu goleiro com a bola no pé, controlado, na área, com a mão valendo (o PEGAR aparece e pega);
   *  'goleiroPeRecuo': o mesmo, com o recuo valendo (Regra 12.2: o PEGAR não aparece; a tecla O marca a infração).
   */
  cenaDeTeste(nome) {
    const m = mundo;
    if (!m.partida) return null;
    const lado = m.ataca[TIME_HUMANO], gx = -lado * CFG.CAMPO.meioX;
    // a parada em andamento acaba (o cobrador, parado nela, volta a se mexer — como partida.js encerrarParada)
    const pr = m.parada;
    if (pr && pr.cobrador != null && pr.papel != null) { const c0 = jogadorPorId(m, pr.cobrador); if (c0 && c0.papel === 'parado') c0.papel = pr.papel; }
    m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null; m.posse = null;
    if (m.regraMao) { m.regraMao.semMao = -1; m.regraMao.soltou = -1; }
    for (const j of m.jogadores) { j.pedido = null; j.carga = null; j.recebe = null; j.segura = null; j.defesa = null; j.mergulho = null; }
    const g = m.jogadores.find(o => o.time === TIME_HUMANO && o.posicao === 'GOL');
    if (nome === 'pressao') {
      let c = null;
      for (const o of m.jogadores) if (o.time !== TIME_HUMANO && o.posicao !== 'GOL' && (!c || o.vagaIdx > c.vagaIdx)) c = o;
      const cx = gx + lado * 32, cz = 4;
      teleportar(c, cx, cz, lado > 0 ? Math.PI : 0);
      m.bola.p.x = cx - lado * 0.34; m.bola.p.y = CFG.BOLA.raio; m.bola.p.z = cz; m.bola.v.x = 0; m.bola.v.y = 0; m.bola.v.z = 0; m.bola.rolando = true;
      m.posse = c.id;
      corteCamera = true;
      return { condutor: c.id };
    }
    if (!g) return null;
    teleportar(g, gx + lado * 9, 3, lado > 0 ? 0 : Math.PI);
    for (const o of m.jogadores) if (o.time !== TIME_HUMANO && o.posicao !== 'GOL' && Math.abs(o.x - gx) < 30) teleportar(o, gx + lado * (32 + (o.vagaIdx % 4) * 3), o.z, o.rumo);
    if (nome === 'goleiroMao') {
      // a bola já nas mãos (sem a junção de goleiro.js bolaNaMao, que a traria voando do meio-campo)
      m.naMao = g.id; m.posse = g.id; g.segura = { desde: m.tick, off: { x: 0, y: 0, z: 0 } };
    } else {
      m.bola.p.x = g.x + lado * 0.34; m.bola.p.y = CFG.BOLA.raio; m.bola.p.z = g.z; m.bola.v.x = 0; m.bola.v.y = 0; m.bola.v.z = 0; m.bola.rolando = true;
      m.posse = g.id;
      if (nome === 'goleiroPeRecuo') (m.regraMao ??= { semMao: -1, soltou: -1 }).semMao = g.time;
    }
    if (m.controlado[TIME_HUMANO] !== g.id) assumirControle(m, TIME_HUMANO, g);
    corteCamera = true;
    return { goleiro: g.id };
  },
  /**
   * Testes: a bola no pé do adversário de linha mais perto do controlado (a defesa de verdade). Devolve o id dele ou null.
   * (A máquina de passes manda a bola PARA o meu jogador — desde a auditoria dos botões isso é ataque: ele chega antes.)
   */
  bolaComAdversario() {
    const m = mundo, c = controlado();
    if (!c) return null;
    let o = null, dm = Infinity;
    for (const j of m.jogadores) {
      if (j.time === TIME_HUMANO || j.posicao === 'GOL' || j.papel === 'marcador' || j.papel === 'parado') continue;
      const d = Math.hypot(j.x - c.x, j.z - c.z);
      if (d < dm) { dm = d; o = j; }
    }
    if (!o) return null;
    const dono = m.posse != null ? jogadorPorId(m, m.posse) : null;
    if (dono && dono.cond) { dono.cond.toque = null; dono.cond.busca = false; }
    const b = m.bola;
    b.p.x = o.x + Math.cos(o.rumo) * 0.4; b.p.y = CFG.BOLA.raio; b.p.z = o.z + Math.sin(o.rumo) * 0.4;
    b.v.x = 0; b.v.y = 0; b.v.z = 0; b.rolando = true;
    m.posse = o.id; m.voo = null; m.naMao = null;
    return o.id;
  },
  /** Marcas da partida desenhadas (PRESSÃO e o anel dos 8 s): render/jogador3d.js indicadores. */
  get indicadores() { return jog3d ? jog3d.indicadores : null; },
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
      edicaoNaFila: !!edicaoNaFila, editorAberto: !!editor?.aberto, menuAberto: hud.menuAberto,
      marcador: marcadorLigado(mundo), qualidade: qAtual, escolhaQualidade: escolhaQ, hora, camera: cam ? cam.modo : camInicial,
      desenhoChamadas: cena3d ? cena3d.info().render.calls : 0,
      desenhoTriangulos: cena3d ? cena3d.info().render.triangles : 0,
      // memória na GPU (vazamento = número que cresce com o tempo)
      geometrias: cena3d ? cena3d.info().memory.geometries : 0,
      texturas: cena3d ? cena3d.info().memory.textures : 0,
      // programas de shader compilados (uma cena nova não pode compilar nada no meio: a pré-carga compila antes)
      programas: cena3d ? (cena3d.info().programs?.length ?? 0) : 0,
    };
  },
  /**
   * Placar de teste (layout do placar no teste-hud-minimo H10, com o relógio manual parado): gols [a, b] e o relógio
   * como o laço passa ao HUD ({minuto, tempo, estado, acrescimo: {anunciado, decorrido} | null}). O próximo quadro do
   * laço escreve o de verdade de novo.
   */
  placarDeTeste(gols, rel) { if (gols) hud.placar(gols[0], gols[1]); if (rel !== undefined) hud.relogio(rel); },
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
  /** Identidade visual da partida (identidade.js): null sem ?tm; com ?tm, a dos times do Total Match (testes). */
  get identidade() { return IDENT; },
  /**
   * Replay (testes e prints): estado do diretor ({ativo, tipo, plano, planos, cam, tick, vel, congelado, duracao, ...}),
   * o anel ({primeiro, ultimo, bytes}), custos (gravar por passo, quadro do replay sem o desenho), o ajuste automático,
   * pular, o "Replay" da pausa e o replay do último gol (golaco = true força o plano lateral).
   */
  replay: {
    get estado() { return diretor ? diretor.estado : null; },
    get anel() { return { primeiro: anel.primeiro, ultimo: anel.ultimo, bytes: anel.bytes }; },
    get custo() {
      // p95 do quadro do replay (CPU, sem o desenho) nos últimos ≤ 4096 quadros
      const k = Math.min(custoReplay.n, 4096), v = Array.from(custoReplay.v.subarray(0, k)).sort((a, b) => a - b);
      return { gravarMsPorPasso: custoGravar.ms / Math.max(1, custoGravar.n), passos: custoGravar.n, quadroReplayMs: custoReplay.ms / Math.max(1, custoReplay.n), quadroReplayP95: k ? v[Math.min(k - 1, Math.floor(0.95 * k))] : 0, quadros: custoReplay.n };
    },
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
    /**
     * Análise semiautomática (testes e prints): 'impedimento' = o último impedimento de novo (P1 + análise); 'legal' = a
     * checagem de posição legal mais apertada do anel, sem exigir chute nem gol (opc.limite: outro teto, m). false se não há.
     */
    saotDeTeste(tipo, opc) { return iniciarReplay(diretor?.saotDeTeste(tipo, opc)); },
    /** A margem (m) da posição legal mais apertada no anel agora (até `limite` m; testes e prints), ou null. */
    legalMaisApertada(limite) { return diretor ? diretor.legalMaisApertada(limite) : null; },
    /** Jogadores desenhados no último quadro do replay (a análise mostra só os do lance). */
    get desenhados() { return desenhadosReplay; },
    /**
     * O último quadro do replay desenhado (12/10, 1ª pessoa e treinador): os ids da lista do desenho, quem foi oculto (id,
     * bits de jogador3d OCULTA) e a bola (some perto da lente da 1ª pessoa).
     */
    get desenho() {
      const L = ultimaListaReplay, d = ultimoDesenhoReplay;
      return L ? { ids: L.map(it => it.id), ocultos: L.filter(it => it.ocultar).map(it => ({ id: it.id, ocultar: it.ocultar })), semBola: !!d?.semBola, bola: bola3d.mesh.visible } : null;
    },
    /** A câmera da 1ª pessoa / do treinador agora (o diretor: posição, alvo, campo de visão, parte), ou null. */
    get cameraExtra() { return diretor?.ativo ? diretor.cameraExtra() : null; },
    /** Os planos da análise desenhados agora (linha-impedimento.js estadoSaot) e o selo do terço de baixo. */
    get planos() { return linhaImped ? { ...linhaImped.estadoSaot, selo: hud.tercoTipo } : null; },
    /** "Reduzir movimento" na análise (true/false força; null segue o sistema). */
    reduzirMovimento(v) { if (diretor) diretor.reduzirMovimento = v; },
    /** O jogador `id` gravado no anel no passo `tick` ({x, z, time, goleiro} ou null): conferir a parede e o plano. */
    noAnel(tick, id) { const j = jogadorNoTick(anel, tick, id); return j ? { ...j } : null; },
    /** O passo `tick` do anel é um corte (o replay não interpola até ele nem um plano o atravessa)? null fora do anel. */
    corteNoAnel(tick) { const s = anel.slot(tick); return s < 0 ? null : !!anel.corte[s]; },
    /** Testes de layout: o selo no terço de baixo sem a análise (tipo ou null; o próximo quadro de replay o refaz). */
    selo(tipo) { hud.terco(tipo ? { tipo } : null); },
    /**
     * Testes (tools/lib/gol-roteirizado.mjs {marcarChute}): o chute que a física do teste deu conta para o autor do gol como
     * um chute de verdade (render/autor-gol.js: o autor, o tick do chute e o tipo), só no desenho — a simulação não muda.
     */
    chuteDeTeste(id, tipo = 'chute') { autorEventos(autorGol, [{ tipo, id }], mundo.tick, timeDe); },
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
  /**
   * Cena de substituição (testes e prints): {ativo, estado ({plano, tempo, total, k, pares, planos, camera}), atores(),
   * camera (o plano de cinema do quadro), naTela(id) (caixa px da pose desenhada; padrão: o ator principal do plano),
   * placa ({estado, naTela()}), pular(), ligada(v) (sem salvar), custo, zerarCusto(), fila, faixa()}.
   */
  cenaSubst: {
    get ativo() { return !!cenaSub; },
    get estado() {
      const c = cenaSub;
      if (!c) return null;
      const t = tempoCenaSubst(c), ip = planoEm(c, t);
      return {
        plano: c.plano.planos[ip]?.nome ?? 'fim', tempo: t, total: duracaoCenaSubst(c), k: c.k, tick: c.plano.tick,
        pares: c.plano.pares.map(p => ({ time: p.time, sai: p.sai, entra: p.entra, goleiro: p.goleiro, saida: { ...p.saida }, vaga: { ...p.vaga }, numSai: p.numSai, numEntra: p.numEntra })),
        planos: c.plano.planos.map(p => ({ ...p })), camera: cam?.cinema ?? null,
      };
    },
    atores() { return cenaSub ? infoAtoresSubst(cenaSub) : null; },
    get camera() { return { nome: planoCamSub.nome, de: [...planoCamSub.de], para: [...planoCamSub.para], fov: planoCamSub.fov, posicao: cam ? { x: cam.camera.position.x, y: cam.camera.position.y, z: cam.camera.position.z } : null, fovReal: cam ? cam.camera.fov : null }; },
    /** Caixa (px CSS) da pose DESENHADA de um ator (padrão: o principal do plano): {x0, y0, x1, y1, altura, dentro, atras}. */
    naTela(id) {
      const c = cenaSub;
      if (!c || !cam) return null;
      let a = null;
      if (id != null) a = c.atores.find(q => q.id === id);
      else { const pl = c.plano.planos[planoEm(c, tempoCenaSubst(c))]; a = !pl || pl.nome === 'entra' ? c.entra[0] : c.sai.find(q => q.par === pl.par); }
      if (!a || !a.des) return null;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, atras = false;
      for (let i = 0; i < NJ; i++) {
        _proj.set(a.des[i * 3], a.des[i * 3 + 1], a.des[i * 3 + 2]).project(cam.camera);
        if (_proj.z > 1) atras = true;
        const x = (_proj.x + 1) / 2 * window.innerWidth, y = (1 - _proj.y) / 2 * window.innerHeight;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      }
      const W = window.innerWidth, H = window.innerHeight;
      return { id: a.id, x0, y0, x1, y1, altura: y1 - y0, dentro: !atras && x0 >= 0 && x1 <= W && y0 >= 0 && y1 <= H, atras };
    },
    placa: {
      get estado() { return placaSub ? { ...placaSub.estado } : null; },
      /** Caixa (px CSS) da placa na tela: {x0, y0, x1, y1, largura, altura, atras}. */
      naTela() {
        if (!placaSub || !placaSub.estado.visivel || !cam) return null;
        const m = placaSub.mesh;
        m.updateMatrixWorld();
        const P = 0.29, Q = 0.19;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, atras = false;
        for (const [u, v] of [[-P, -Q], [P, -Q], [P, Q], [-P, Q]]) {
          _proj.set(u, v, 0).applyMatrix4(m.matrixWorld).project(cam.camera);
          if (_proj.z > 1) atras = true;
          const x = (_proj.x + 1) / 2 * window.innerWidth, y = (1 - _proj.y) / 2 * window.innerHeight;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        return { x0, y0, x1, y1, largura: x1 - x0, altura: y1 - y0, atras };
      },
    },
    pular() { pularSubst(); },
    // (testes: não salva a escolha, ao contrário da opção da pausa)
    ligada(v) { if (v !== undefined) { substLigada = !!v; marcarSubst(); } return substLigada; },
    get custo() { return { msPorTick: custoSub.ms / Math.max(1, custoSub.n), ticks: custoSub.n }; },
    zerarCusto() { custoSub.n = 0; custoSub.ms = 0; },
    get fila() { return filaCenas.map(it => (typeof it === 'function' ? 'faixa' : it.tipo)); },
    faixa() { return hud.faixaSubstEstado(ultimoAgora); },
  },
  /**
   * Substituição de teste: põe a edição na fila (pares = [{sai, entra, time?}]; padrão 9 → 22 do time 0) e, com `parada`
   * ('lateral' | 'escanteio' | 'tiroDeMeta'; null = nenhuma: a próxima parada de verdade), força a parada como
   * bolaParadaDeTeste. As trocas passam pelo aplicarPendentes de verdade (≈ 1 s depois da bola fora).
   */
  substituicaoDeTeste(opc = {}) {
    const m = mundo;
    if (!m.partida || !m.times) return null;
    const pares = opc.pares ?? [{ sai: 9, entra: 22 }];
    const eds = [];
    for (const t of [0, 1]) {
      const ps = pares.filter(p => (p.time ?? opc.time ?? TIME_HUMANO) === t);
      if (!ps.length) continue;
      const s = m.times[t], vagas = { ...s.vagas };
      for (const p of ps) { const v = Object.keys(vagas).find(k => vagas[k] === p.sai); if (v) vagas[v] = p.entra; }
      eds.push({ tipo: 'editarTime', time: t, base: s.versao, formacao: s.formacao, vagas, substituicoes: ps.map(p => ({ sai: p.sai, entra: p.entra })), tatica: { ...s.tatica } });
    }
    if (!eds.length) return null;
    edicaoNaFila = eds[0];
    for (const e of eds.slice(1)) filaAcoes.push(e);
    const parada = opc.parada === undefined ? 'lateral' : opc.parada;
    const bp = parada ? api.bolaParadaDeTeste(parada) : null;
    return { edicoes: eds.length, parada: bp };
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
    /** Quantas vezes cada som foi pedido (tocado ou não: sem o 1º gesto o áudio não toca), na ordem do jogo. */
    get sonsPedidos() { return { ...sonsPedidos }; },
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
    /** Os 2 treinadores agora (tecnicos.js infoTecnicos: posição, estado, gesto) e o custo do passo deles; null sem eles. */
    get tecnicos() { return tecnicos ? { lista: infoTecnicos(tecnicos), msPorPasso: custoTec.ms / Math.max(1, custoTec.n), passos: custoTec.n, k: tecnicos.k } : null; },
    /** Mostra/esconde os treinadores SÓ no desenho (conferência de pixels nos testes; o passo deles continua). */
    mostrarTecnicos(v) { tecVisiveis = !!v; },
    /** Triângulos de um boneco do manequim (cápsulas, cabeça, cabelo e mancha): o teto do custo dos treinadores. */
    get triangulosBoneco() { return jog3d ? jog3d.triangulosPorBoneco : null; },
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
  /**
   * Ponto do mundo → pixel CSS na tela (testes: "direita no analógico = direita na tela"). `atras`: o ponto está atrás da
   * câmera (ou além do plano de fundo) — a projeção dele cai espelhada DENTRO da tela, mas ele não está no quadro (a câmera
   * do gol de costas para a área técnica; tools/teste-tecnicos-tela.mjs V1/V8).
   */
  naTela(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(cam.camera);
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight, atras: v.z > 1 };
  },
};
function resumoTime(t) {
  return { elenco: t.elenco, formacao: t.formacao, vagas: { ...t.vagas }, tatica: { ...t.tatica }, pendente: t.pendente ? structuredClone(t.pendente) : null, saiu: [...t.saiu], subs: { ...t.subs }, versao: t.versao };
}
window.__golaco = api;

iniciar().catch(err => {
  console.error(err);
  hud.erro('Não foi possível iniciar o 3D: ' + (err && err.message ? err.message : String(err)));
  // Total Match: o 3D não subiu — o TM simula a partida
  if (ID_TM && !api.pronto) sairTM();
});
