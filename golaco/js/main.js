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
// Replays nas paradas (render; pedido do dono de 22/10: "os replays de faltas e jogadas passando na tela enquanto o jogo tá
// parado"; PLANO-CENAS.md §2, contrato "Cenas das paradas"): a cada passo o classificador (js/lances.js, puro, só lê)
// olha os eventos; na bola morta o lance que vale (pênalti, vermelho, trave, amarelo, falta onde o jogo monta a barreira,
// espalmada, chute bloqueado que vira escanteio, chute que passou perto, chute de dentro da área que vira tiro de meta;
// lances.js TIPOS_LANCE) ARMA o replay (replayParada), que toca no passo ANTES da montagem (lances.js montaNoProximoPasso):
// 1 s ao vivo → vinheta → TV 1× + o lance fechado/atrás do gol 0,5× (≤ 8 s) → a montagem. A simulação fica PARADA (o laço
// não roda o passo; a checagem fica no TOPO da volta do laço, antes da entrada da demo e, no online, antes de
// MOD_ON.podePassar/entradas) e volta no mesmo tick: o hash é o mesmo com e sem o replay. Até 3 por tempo e 30 s de bola
// rolando desde o último replay automático (a classe A fura os dois). ?replayParada=0|1 força; desligado com webdriver,
// ?prints=1 e ?demo=1; vale só com "Replays: Ligado".
//
// Cena do cartão (render; pedido do dono de 22/10: "as cenas de cartões"; PLANO-CENAS.md §3, contrato "Cenas das paradas"):
// no fim do passo que trouxe o cartão (decidirCartao), o mais grave vira UMA cena (js/cena-cartao.js, pura, sob demanda:
// SOB.cenas): o árbitro vem, ergue o cartão (render/cartao3d.js na mão desenhada dele), o punido reage (3 variações de
// amarelo e 3 de vermelho), o expulso sai pelo túnel (render/vao-placas.js abre o vão das placas) e a tarja de
// identificação (js/cenas-tela.js: cartão, sigla, escudo, número e nome — só durante a cena) entra. A SIMULAÇÃO FICA PARADA
// no tick do cartão (o laço não roda passo) e volta no mesmo tick: o hash é o mesmo com e sem a cena. Os treinadores vivos
// não andam nem são desenhados (a cena desenha cópias: sem corte no anel depois dela) e o estádio anda no relógio do desenho
// (relEst.tSegurado). Ordem: falta → cartão → 1 s ao vivo → replay de parada → montagem; vantagem que virou gol: comemoração
// → cartão (gol + 149; a cortina para ali) → saída → replay do gol; replay do impedimento → cartão (da fila). Pular: um
// aperto novo depois de 0,5 s. ?cenas=0|1 força; senão a preferência ("Cenas" no "Modo de jogo"); desligada com webdriver,
// ?prints=1 e ?demo=1; no online, só o ícone de hoje; sem o módulo baixado ainda, o ícone de hoje (sem segurar).
//
// Cena do INTERVALO (render; pedido do dono de 22/10: "a cena de intervalo"; PLANO-CENAS.md §4, contrato "Cenas das
// paradas" §7.3): no apito do 1º tempo (o evento 'intervalo'; depois do replay do gol do último lance e do cartão do último
// apito, na fila) os 22 viram UMA cena (js/cena-fim.js, pura, sob demanda: SOB.cenas) — o apito, o campo, o túnel, a torcida,
// 0–2 lances do 1º tempo (os do guardador, pelo diretor do replay com a fonte = o mini-anel), as estatísticas e o plano
// geral —, com a tarja do placar com os autores e o painel de estatísticas (js/cenas-tela.js: só dentro da cena). A
// SIMULAÇÃO FICA PARADA no tick do 'intervalo' até o plano 'geral' (seguraIntervalo); ali o laço solta, os 3 s de
// PARTIDA.intervalo correm por baixo com o desenho ainda da cena (o campo vazio) e a 'saida' acaba a cena — no mesmo tick e
// com o mesmo hash de sem ela. A cena chama tocarAdiados() ao começar (o apito não espera a fila: R6). Toque/Enter/um botão
// novo = o próximo bloco; "Pular" = o geral e os passos do intervalo correndo atrás da cortina até a saída; a pausa (Esc;
// no toque, o botão da camada) congela a cena e o "Editar time" entra no 1º passo depois que o laço solta (troca do
// intervalo, Regra 3). Desligada com webdriver, ?prints=1 e ?demo=1 e com "Cenas: desligadas"; sem o SOB.cenas baixado ou no
// online, a faixa de 3 s de hoje (no online com a tarja do placar só nesses 3 s: R10). A súmula (sumula.js) é criada
// SEMPRE na partida (import estático: os números das estatísticas).
//
// Cena do PÓS-JOGO (render; pedido do dono de 22/10: "a cena de pós jogo"; PLANO-CENAS.md §5, contrato "Cenas das paradas"
// §7.4): no apito final (o evento 'fimDeJogo'; depois do replay do gol do último lance e do cartão do último apito, na fila)
// os 22 viram UMA cena (js/cena-fim.js 'fimDeJogo', pura, sob demanda: SOB.cenas) — o apito, quem ganhou e quem perdeu (no
// empate, o neutro), os cumprimentos, a TROCA DE CAMISA (o par pelo hash do jogo; o kit misto no render/jogador3d.js, sem
// chamada a mais), os treinadores se cumprimentando, o aplauso à torcida, a torcida, o MELHOR EM CAMPO (sumula.js
// melhorEmCampo: a nota é a do resultado do TM) com a tarja dele, o placar final com os autores, as estatísticas da partida
// (não no TM) e o plano geral com a faixa final ("Jogar de novo" / "Voltar ao Total Match" + "Melhores momentos": os lances
// do guardador, até 6, os gols primeiro, ≤ 30 s; o Pular volta à faixa). FORA do online a SIMULAÇÃO FICA PARADA no tick do
// 'fimDeJogo' (em 'fim' só o m.tick andaria; o resultado do TM já foi gravado no apito, antes da cena); NO ONLINE não segura
// (o lockstep segue com o tick) e a cena só usa cópias. Os treinadores vivos ficam fora do desenho (o mesmo id das cópias).
// A cena chama tocarAdiados() ao começar (R6). Toque/Enter/um botão novo = o próximo bloco; "Pular" = a faixa final. O
// empate que continua no TM (partida.empateContinua, sem o campo também) = a versão curta. Desligada com webdriver, ?prints=1
// e ?demo=1 e com "Cenas: desligadas"; sem o SOB.cenas baixado, a faixa do fim de hoje. Pênaltis 3D: a disputa intercepta o
// 'fimDeJogo' (sem cena). "Simular o resto": sem cena, a faixa direto.
//
// Guardador de lances (render; PLANO-CENAS.md §4.2, contrato "Cenas das paradas"): o gol (no posGol(), na saída, no
// intervalo ou no fim) e a parada A/B (no passo antes da montagem) são copiados do anel, com ou sem replay, para o intervalo
// e o fim tocarem depois (render/lances-guarda.js, sob demanda: SOB.cenas; a memória só na partida). Um lance guardado toca
// pelo diretor de sempre com a FONTE = o mini-anel (tocarLanceGuardado → iniciarReplay(ro, {fonte, aoFim})): a simulação fica
// parada como em todo replay e o fim volta à cena (aoFim), sem andar a fila. Só lê o anel: o hash não muda.
//
// Parâmetros: ?semente=N ?q=baixa|media|alta ?hora=dia|noite ?camera=tv|aproximada ?demo=1
// ?modo=partida|ataque|conducao (padrão da página: partida) ?min=N (minutos reais por tempo)
// ?marcador=1 ?prints=1 (cena limpa) ?qps=1 ?toque=1 ?entalhe=1 ?replay=0|1 ?comemoracao=0|1 ?substituicao=0|1
// ?prejogo=0|1|curto|escalacao ?tecnicos=0|1 ?replayParada=0|1 ?cenas=0|1 ?troca=0 (sem a troca de camisa do pós-jogo).
// Pré-jogo (pedido de 11/10; render/prejogo.js): antes do 1º passo da partida — a simulação fica no tick 0 e o apito da
// saída só toca no fim dele. Desligado por padrão nos testes (navigator.webdriver), nos prints e na demonstração.
// Testes: window.__golaco (ver o fim do arquivo).

import * as THREE from 'three';
import * as CFG from './config.js';
import { hashMundo, jogadorPorId } from './sim.js';
import { pose, interpolarPose, NJ, J as JUNTA } from './anim.js';
import { criarLaco, avancarLaco } from './laco.js';
import * as COND from './conducao.js';
import * as S from './sessao.js';
import { criarEntrada } from './entrada.js';
import { cameraDaMatriz } from './controle.js';
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
import { criarEmocao, zerarEmocao, emocaoEvento, emocaoPasso, consumirDisparos, criarRelogioEstadio, relogioEstadio } from './render/emocao.js';
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
import { criarVaoPlacas } from './render/vao-placas.js';
import { PREJOGO } from './prejogo-roteiro.js';
import { criarAnel, lerQuadro, tempoEstadio as tempoEstadioAnel, jogadorNoTick, marcasDoPasso } from './render/replay-anel.js';
import { criarTecnicos, criarLeitura, leituraDoMundo, passoTecnicos, afastarDeTecnicos, infoTecnicos, IDS_TECNICOS, kitTecnico, treinadorDoTime } from './tecnicos.js';
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
// replays nas paradas: o classificador de lances (puro; fora do fecho do hash: só lê o mundo e os eventos)
import { criarLances, lancesPasso, decidirReplay, registrarReplay, montaNoProximoPasso, REPLAY_PARADA } from './lances.js';
// a súmula da partida (o resultado do TM e as estatísticas das cenas; puro, só lê: fora do fecho do hash)
import { criarSumula, sumulaPasso, resultadoTM, minutoTM, estatisticas as estatisticasDaSumula, autoresPorTime, melhorEmCampo } from './sumula.js';

const { PASSO, BOTAO, QUALIDADE, VERSAO, FALTAS } = CFG;
const ID_HUMANO = S.ID_HUMANO ?? 0;
// Só com ?tm: a conversão do pedido (tm-times.js) por import dinâmico — fora do download do jogo sem ?tm (teste-carga). A
// súmula (sumula.js) é estática desde a cena do intervalo (PLANO-CENAS.md R4): ela lê cada passo da partida desde o 1º
const MOD_TIMES = PEDIDO_TM ? await import('./tm-times.js').catch(() => null) : null;
const ELENCOS_TM = MOD_TIMES?.ELENCOS_TM;
/**
 * O pedido do TM vira elencos registrados (elenco.js) e os times da partida; sem ?tm, null (o jogo de sempre). Um pedido
 * que não fecha (time com menos de 11, dado quebrado: a partida de ensaio dá erro) também vira null — o iniciar() manda
 * 'tm3d:sair' e o TM simula na hora, sem esperar os 30 s dele.
 */
function timesDoTM() {
  if (!PEDIDO_TM || !MOD_TIMES) return null;
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
// Total Match, Modo Livre 3D (pedido com modo: 'livre'; livre.js): sem trava e sem resultado ({livre: {placar}})
const LIVRE_TM = !!TM && PEDIDO_TM?.modo === 'livre';
// Total Match, Online 3D (pedido com modo 'online'; online.js + online-pagina.js): dois humanos, cada um no seu aparelho,
// por troca de entradas (contrato "Online 1×1"). Nos testes, sem o TM: ?online=<sala>&transporte=bc&lado=0|1 (duas abas)
const ONLINE_TM = !!TM && PEDIDO_TM?.modo === 'online' && !!PEDIDO_TM?.online;
const PARAMS0 = new URLSearchParams(location.search);
const ONLINE_BC = !ID_TM && !!PARAMS0.get('online') && PARAMS0.get('transporte') === 'bc';
const ONLINE = ONLINE_TM || ONLINE_BC;
const LADO_ONLINE = ONLINE_TM ? (PEDIDO_TM.online.lado === 1 ? 1 : 0) : ONLINE_BC && PARAMS0.get('lado') === '1' ? 1 : 0;
// o time do humano: 0 (o mandante) sem ?tm; com ?tm, o lado do usuário no TM (o time 0 é sempre o mandante do TM); no online, o
// MEU lado (o anfitrião é o 0)
const TIME_HUMANO = ONLINE ? LADO_ONLINE : TM ? TM.humano : 0;
const TRAVA_TM = TM && !PENALTIS_TM && !LIVRE_TM && !ONLINE_TM ? TM.trava : null;
// online: a sessão (online.js, pura) e a página (online-pagina.js: transporte, avisos, pausa combinada) só por import dinâmico
const [MOD_ON, MOD_PAG_ON] = ONLINE ? await Promise.all([import('./online.js'), import('./online-pagina.js')]) : [null, null];
let PAG_ONLINE = null;

const params = new URLSearchParams(location.search);
const PRINTS = params.get('prints') === '1';
// modo da página: a partida (padrão) ou um dos treinos; o menu "Modo de jogo" troca sem recarregar (com ?tm, sempre a partida)
// (o modo Pênaltis 3D — a disputa de pênaltis, pedido do dono de 15/10 — também: ?modo=penaltis ou o pedido do TM)
// (o Modo Livre, dono 16/10, também: ?modo=livre ou o pedido do TM com modo 'livre')
const MODOS = ['partida', 'ataque', 'conducao', 'penaltis', 'livre'];
let modoPagina = TM ? (PENALTIS_TM ? 'penaltis' : LIVRE_TM ? 'livre' : 'partida') : MODOS.includes(params.get('modo')) ? params.get('modo') : 'partida';
// modo Pênaltis: a lógica (disputa.js) e as bolinhas (disputa-tela.js) por import dinâmico — fora do download sem ele
let MOD_DISP = null, TELA_DISP = null;
async function carregarDisputa() {
  if (!MOD_DISP) [MOD_DISP, TELA_DISP] = await Promise.all([import('./disputa.js'), import('./disputa-tela.js')]);
  return MOD_DISP;
}
if (modoPagina === 'penaltis') await carregarDisputa();
// Modo Livre: livre.js (a lógica) e livre-pagina.js (a escolha, a pausa, a fila, a API) por import dinâmico — fora do
// download sem ele; PAG_LIVRE nasce no 1º uso, com o HUD já criado (paginaLivre)
let MOD_LIVRE = null, MOD_PAG_LIVRE = null, PAG_LIVRE = null;
async function carregarLivre() {
  if (!MOD_LIVRE) [MOD_LIVRE, MOD_PAG_LIVRE] = await Promise.all([import('./livre.js'), import('./livre-pagina.js')]);
  return MOD_LIVRE;
}
if (modoPagina === 'livre') await carregarLivre();
const MIN_PARAM = +params.get('min') > 0 ? +params.get('min') : undefined;
const DEMO_ON = params.get('demo') === '1';
// (online: a semente é a do anfitrião — o id do pedido é diferente em cada aparelho)
const SEMENTE = ONLINE_TM ? ((PEDIDO_TM.online.semente >>> 0) % 999999) + 1
  : Math.max(1, Math.floor(+params.get('semente') || (ID_TM ? sementeTM(ID_TM) : 1)));
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
// (aoFaixaFinal: a faixa do fim de jogo saiu — os controles de toque voltam: o arco é refeito com eles na tela)
const hud = criarHud({ aoComando: comando, tm: TM ? { trava: TRAVA_TM != null, timeHumano: TIME_HUMANO } : null, online: ONLINE,
  aoFaixaFinal: final => { if (!final) try { entrada?.reposicionar?.(); } catch (_) { /* antes de a entrada existir */ } } });
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
  if (o.modo === 'livre') {
    const e = paginaLivre().escolhaTimes();
    return MOD_LIVRE.criarLivre({
      semente: o.semente, times: o.times ?? TM?.times, elencos: o.elencos ?? (TM ? ELENCOS_TM : undefined), humano: o.humano ?? TIME_HUMANO,
      linha: o.linha ?? e.linha, goleiro: o.goleiro ?? e.goleiro,
    });
  }
  if (o.modo === 'partida') {
    const m = criarPartida({
      semente: o.semente, minutosPorTempo: o.minutosPorTempo ?? MIN_PARAM, saida: o.saida, times: o.times ?? TM?.times,
      elencos: o.elencos ?? (TM ? ELENCOS_TM : undefined), humano: o.humano ?? TIME_HUMANO, trava: o.trava !== undefined ? o.trava : TRAVA_TM,
      humanos: ONLINE ? [0, 1] : undefined,
    });
    if (ONLINE) m.online = true; // (fora do hash: o passo é o passoOnline com as duas entradas)
    return m;
  }
  return S.criarTreino(o);
}
/** Um passo: partida (passoPartida) ou treino (passoTreino) — as mesmas funções dos testes em Node. */
const FNS_ONLINE = { passoPartida, entradaDemoPartida };
function passoDoMundo(m, e, acoes) {
  if (m.online) return MOD_ON.passoOnline(m, e, acoes, FNS_ONLINE);
  if (m.disputa) return MOD_DISP.passoDisputa(m, e);
  if (m.livre) return MOD_LIVRE.passoLivre(m, e, acoes);
  return m.modo === 'partida' ? passoPartida(m, e, acoes) : S.passoTreino(m, e, acoes);
}
function entradaDemoDoMundo(m) {
  if (m.disputa) return MOD_DISP.entradaDemoDisputa(m);
  if (m.livre) return MOD_LIVRE.entradaDemoLivre(m);
  return m.modo === 'partida' ? entradaDemoPartida(m) : (S.entradaDemo ? S.entradaDemo(m) : null);
}
/** Partida, disputa de pênaltis ou Modo Livre (todos têm m.partida e os times): o "jogo", não os treinos. */
const ehJogo = m => m.modo === 'partida' || m.modo === 'penaltis' || m.modo === 'livre';
/** Rumo da câmera no chão para o analógico: na disputa, o da câmera atrás do cobrador (esquerda/direita da tela). */
function yawEntrada() { return mundo.disputa && MOD_DISP ? MOD_DISP.yawDisputa(mundo) : (bp.yaw ?? cam.yaw); }
// bola parada no estilo FIFA (render/bola-parada.js, sob demanda): câmera atrás do cobrador (bp.yaw), linha e painel
const bp = { tela: null, carga: null, yaw: null, plano: null, linha: true };
const carregarBP = () => (bp.carga ??= import('./render/bola-parada.js').then(md => { bp.tela = md.criarTelaBolaParada(cena3d.cena, document.getElementById('hud')); }));
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
let MOD_CAD = null;   // render/cadeiras3d.js (sob demanda: SOB.cadeiras)
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
  // as cenas das paradas (o cartão e o intervalo): as cenas puras, as constantes delas (js/cenas-config.js chega junto, pelo
  // import delas), o cartão 3D, a tela das tarjas e o CSS dela (antes do prejogo.css, como o do editor); o guardador de lances
  // (lg: a memória só na partida — garantirGuarda)
  // as cadeiras 3D de perto (item 69: render/cadeiras3d.js; a câmera de TV nunca chega perto da arquibancada)
  cadeiras: {
    carga: null, ok: false,
    baixar: () => import('./render/cadeiras3d.js'),
    criar(md) { MOD_CAD = md; if (campo) campo.ligarCadeiras(md); },
  },
  cenas: {
    carga: null, ok: false,
    baixar: () => Promise.all([import('./cena-cartao.js'), import('./cenas-config.js'), import('./render/cartao3d.js'), import('./cenas-tela.js'),
      import('./render/lances-guarda.js'), import('./cena-fim.js'), cssSobDemanda('css/cenas.css', 'css/prejogo.css')]).then(([cc, cfg, c3, tela, lg, cf]) => ({ cc, cfg, c3, tela, lg, cf })),
    criar(md) {
      MOD_CEN = md;
      planoCamCartao = md.cc.criarPlanoCameraCartao();
      planoCamFim = md.cf.criarPlanoCameraFim();
      telaCenas = md.tela.criarTelaCenas({ raiz: document.getElementById('hud') });
      if (cena3d) cartao3d = md.c3.criarCartao3D(cena3d.cena);
      marcarCenas();
      // o guardador de lances: a memória só na partida (nos treinos a pré-carga não aloca nada)
      garantirGuarda();
    },
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
// Replays nas paradas (lances.js): ?replayParada=0|1 força; senão desligado nos testes automatizados (webdriver), nos prints
// e na demonstração (os testes de outros assuntos ficam iguais); senão REPLAY_PARADA.ligado. Sempre só com "Replays: Ligado".
// lances: o classificador da partida (null fora dela: treinos, Livre, disputa); replayParada: o lance ARMADO (toca no passo
// antes da montagem); histParadas: os que tocaram (API dos testes)
const RP_PARAM = params.get('replayParada');
const replayParadaPadrao = RP_PARAM === '1' ? true : RP_PARAM === '0' ? false : (navigator.webdriver || PRINTS || DEMO_ON) ? false : REPLAY_PARADA.ligado;
const replayParadaLigado = () => replayParadaPadrao && replayAuto;
let lances = null, replayParada = null;
const histParadas = [];
// Guardador de lances (render/lances-guarda.js, sob demanda: SOB.cenas; PLANO-CENAS.md §4.2, R9, R20): os gols (no posGol(),
// com ou sem replay) e as paradas A/B (no passo antes da montagem, com ou sem replay) copiados do anel para o intervalo e
// o fim. guarda/miniLance: alocados só na partida (garantirGuarda; nunca nos treinos, onde a pré-carga também roda); golGuardar: o
// gol que espera a saída (ou o intervalo, o fim); lanceGuardar: a parada classificada que espera o passo antes da montagem;
// batidasRede: as últimas batidas da bola na rede (o `ondas` só guarda as que ainda balançam); histGuarda: o que foi
// guardado (API dos testes); replayAoFim: o replay de DENTRO de uma cena (os lances do intervalo, os "Melhores momentos")
// volta a ela no fim ou no pulo, sem andar a fila (iniciarReplay(ro, {fonte, aoFim}); R8)
let guarda = null, miniLance = null, golGuardar = null, lanceGuardar = null, replayAoFim = null;
const batidasRede = Array.from({ length: 8 }, () => ({ ativo: false, t0: 0, x: 0, y: 0, z: 0, plano: 0, amp: 0, dx: 0, dy: 0, dz: 0 }));
let batidaK = 0;
const histGuarda = [];
let fimLanceTeste = null;    // o último aoFim do tocarLance da API dos testes
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
let substLigada = ONLINE ? false : substParam === '1' ? true : substParam === '0' ? false
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
// Cena do cartão (js/cena-cartao.js, sob demanda: SOB.cenas): ?cenas=0|1 força; senão a preferência salva ("Cenas" no "Modo de
// jogo"); senão desligada nos testes automatizados (webdriver), nos prints e na demonstração; senão CENAS.ligadas (do
// módulo; o main.js não importa o cenas-config.js). No online, nunca (só o ícone de hoje: PLANO-CENAS.md R10).
// MOD_CEN = {cc (cena-cartao.js), cfg (cenas-config.js), c3 (render/cartao3d.js), tela (cenas-tela.js)} quando chega.
const CENAS_PARAM = params.get('cenas');
let cenasPref = CENAS_PARAM === '1' ? true : CENAS_PARAM === '0' ? false
  : typeof prefs.cenas === 'boolean' ? prefs.cenas : (navigator.webdriver || PRINTS || DEMO_ON) ? false : null;
const cenasLigadas = () => !ONLINE && (cenasPref ?? MOD_CEN?.cfg.CENAS.ligadas ?? true);
let MOD_CEN = null;
let cenaCartao = null;        // a cena em andamento: {c (o estado da cena pura), botoes, cartao, tick}
let cartaoGolPendente = null; // o cartão que saiu no gol (vantagem que acabou em gol): a cena espera o gol + 149
let cartaoComCena = null;     // {id, tick}: o cartão que ganhou cena — o ícone em cima dele não aparece
// o gol (p.desde) cuja comemoração a cena do cartão encerrou no gol + 149: o passo da saída (gol + 150) segue com a entrada
// NEUTRA, como com a comemoração ainda no desenho (sem a cena) — a mesma entrada por tick com e sem ela
let golNeutro = null;
let ultimaAmarelo = null, ultimaVermelho = null;       // a variação anterior de cada cor (a próxima não repete)
const forcarVariante = { amarelo: null, vermelho: null }; // testes: a variação do próximo cartão
let planoCamCartao = null, telaCenas = null, cartao3d = null, vaoCenas = null;
const custoCartao = { n: 0, ms: 0 };
const _evCartao = [], _maoCartao = {}, _poseArb = new Float32Array(NJ * 3);
// a faixa "Você foi expulso" (TM, travado) espera a cena do cartão E o replay de parada daquela bola morta (R11)
let expulsoPendente = false;
// Cena do intervalo (js/cena-fim.js, sob demanda: SOB.cenas; PLANO-CENAS.md §4): cenaFim = a cena em andamento ({c (o estado
// da cena pura), tipo 'intervalo', tick, botoes, geral (o laço solto), rapido (pulada: os passos do intervalo correndo atrás
// da cortina até a saída), lances (os k do guardador), iLance, tocando, placar, est}); intervaloAgora: o passo trouxe o
// 'intervalo' (a decisão fica para o fim do passo, depois do cartão do mesmo passo); tarjaOnline: a tarja do placar nos 3 s da
// faixa do intervalo do online
let cenaFim = null, intervaloAgora = false, tarjaOnline = null, planoCamFim = null;
// Cena do pós-jogo (a mesma js/cena-fim.js, tipo 'fim'; PLANO-CENAS.md §5): fimJogoAgora = o passo trouxe o 'fimDeJogo' (a
// decisão fica para o fim do passo, depois do cartão do mesmo passo); a cena guarda também segura (fora do online: o laço
// fica parado no tick do apito), melhor (a tarja), kitTroca (id → o kit misto da troca de camisa) e mm (os "Melhores
// momentos" tocando: {lances, i, tocando, vistos})
let fimJogoAgora = false;
const TROCA_ON = params.get('troca') !== '0';
const histPos = [];          // as cenas do pós-jogo (API dos testes): {tick, inicio, geral, pulou, planos, melhor, troca, curto, mm}
const custoFim = { n: 0, ms: 0 };
const _evFim = [];
const histFim = [];          // as cenas do intervalo (API dos testes): {tick, lances, inicio, geral, fim, pulou}
const ENTRADA_NEUTRA = { x: 0, z: 0, botoes: 0 };
const PASSOS_GOL = Math.round(CFG.PARTIDA.golPausa / PASSO);
const bolaAnt = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
const bolaAtu = { p: new THREE.Vector3(), q: new THREE.Quaternion() };
let contPassos = 0;
let alfa = 0;
// estádio: rede que balança e ânimo da torcida, no relógio do desenho (passosTotais nunca volta a zero)
let passosTotais = 0;
// relógio do estádio (render/emocao.js relogioEstadio): o da simulação + o dt do desenho somado enquanto a cena do cartão
// segura o laço (a festa da torcida e a rede andam durante ela). Sem cena, tSegurado = 0: o relógio de antes
const relEst = criarRelogioEstadio();
/** O tempo do estádio no FIM do passo de agora (s): o que a rede, o ânimo e o anel do replay usam. */
const tempoSim = () => passosTotais * PASSO + relEst.tSegurado;
const ondas = criarOndas();
const emocao = criarEmocao();
const autorGol = criarAutorGol();
const _p0 = { x: 0, y: 0, z: 0 }, _v0 = { x: 0, y: 0, z: 0 };
const _impactos = [];
const _ctxEmocao = { t: 0, timeDe: id => timeDe(id), bola: null, ataca: null };
const _passoEmocao = { t: 0, bola: null, posseTime: null, ataca: null, estado: null };
/** Tempo do estádio (s) do estado desenhado: o passo atual menos 1 mais alfa. */
const tempoEstadio = () => Math.max(0, (passosTotais - 1 + alfa) * PASSO) + relEst.tSegurado;
const filaAcoes = [];
// edição do time vinda do "Editar time": entra (uma por vez) no 1º passo depois da pausa
let edicaoNaFila = null;
// a súmula (sumula.js; a mesma ao vivo e no "Simular o resto"): SEMPRE na partida (as estatísticas das cenas; com ?tm, a do
// resultado); o "Simular o resto" em andamento e o aviso do travado expulso (uma vez)
let sumula = criarSumula();
let simulandoTM = null;      // {promessa} enquanto o "Simular o resto" roda em pedaços (simularResto)
let expulsoAvisado = false;
// o tick da expulsão do travado: o replay de parada daquela bola morta esconde a faixa (em-replay) e ela volta depois dele,
// com os 6 s contando dali (PLANO-CENAS.md R11)
let expulsoTick = -1;
const TITULO_EXPULSO = 'Você foi expulso';
// quando a faixa do expulso apareceu (ultimoAgora, ms): os 6 s dela (guardarFaixaExpulso)
let expulsoMostrado = -Infinity;
const faixaExpulso = () => {
  expulsoMostrado = ultimoAgora;
  hud.faixa({ titulo: TITULO_EXPULSO, placar: textoPlacar(), botao: true, botaoTexto: 'Simular o resto', botaoCmd: 'simular-resto', ms: 6000 });
};
/**
 * A faixa do expulso ainda na tela (os 6 s dela correndo) vai ser trocada pela faixa "Intervalo" ou tirada pela cena do
 * intervalo — o vermelho do travado nos últimos segundos do 1º tempo: ela volta a ficar pendente e o talvezFaixaExpulso a
 * mostra de novo no 2º tempo, com os 6 s contando dali (antes ela sumia de vez: PLANO-CENAS.md R11).
 */
function guardarFaixaExpulso() {
  if (expulsoAvisado && !expulsoPendente && hud.faixaTitulo === TITULO_EXPULSO && ultimoAgora - expulsoMostrado < 6000) expulsoPendente = true;
}

// medidas por quadro (medirQuadro): simulação, pose, atualização dos jogadores, desenho e o quadro
// inteiro sem o desenho (CPU que não é da GPU). Anéis de tamanho fixo (nada alocado por quadro).
const MQ = 4096;
const mq = { n: 0, i: 0, sim: new Float64Array(MQ), pose: new Float64Array(MQ), jog: new Float64Array(MQ), des: new Float64Array(MQ), cpu: new Float64Array(MQ), passos: new Uint8Array(MQ), aSim: 0, aPose: 0, aPassos: 0, aCena: 0 };
const agoraMs = () => performance.now();

/** Id do jogador que o humano controla agora (Etapa 2: m.controlado[0]; Etapa 1: id 0). */
function idControlado() { return mundo.controlado?.[TIME_HUMANO] ?? ID_HUMANO; }
function controlado() { return jogadorPorId(mundo, idControlado()) ?? jogadorPorId(mundo, ID_HUMANO); }

/**
 * Entrada do humano no formato POR TIME ({0: {x, z, botoes, mx, mz}}). x/z/botoes (e a mira mx/mz, C6) também ficam no
 * próprio objeto (não enumeráveis) para o passoTreino que recebe a entrada do jogador direto:
 * os dois formatos leem os mesmos números (o hash não muda). Um objeto só, reaproveitado a cada
 * passo (a lógica lê os números no passo e não guarda a referência).
 */
const _entTime = { [TIME_HUMANO]: { x: 0, z: 0, botoes: 0, repete: false, iaCobra: false, mx: null, mz: null } };
Object.defineProperties(_entTime, {
  x: { value: 0, writable: true }, z: { value: 0, writable: true }, botoes: { value: 0, writable: true },
  repete: { value: false, writable: true }, iaCobra: { value: false, writable: true },
  mx: { value: null, writable: true }, mz: { value: null, writable: true },
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
  // a mira pela tela (C6): só a da pessoa (a entrada da página); sem ela, a do analógico (sim.js aplicarEntrada)
  const mx = e?.mx ?? null, mz = e?.mz ?? null;
  const d = _entTime[TIME_HUMANO];
  d.x = x; d.z = z; d.botoes = botoes; d.repete = repete; d.iaCobra = ia; d.mx = mx; d.mz = mz;
  _entTime.x = x; _entTime.z = z; _entTime.botoes = botoes; _entTime.repete = repete; _entTime.iaCobra = ia; _entTime.mx = mx; _entTime.mz = mz;
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
  // replays nas paradas: o classificador é do mundo novo (só na partida; nada armado)
  lances = mundo.modo === 'partida' && mundo.partida && !mundo.livre && !mundo.disputa ? criarLances() : null;
  replayParada = null; histParadas.length = 0;
  // o guardador de lances é da partida (a memória fica: só esquece os lances)
  golGuardar = null; lanceGuardar = null; histGuarda.length = 0;
  if (guarda) MOD_CEN.lg.limparGuarda(guarda);
  garantirGuarda();
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
  // (online: a entrada já vem com os dois times, {0, 1}, decodificada pela sessão)
  const eventos = passoDoMundo(mundo, mundo.online ? entrada : entradaDoTime(entrada), acoes) ?? mundo.eventos ?? [];
  // a súmula (só lê o mundo e os eventos do passo; na partida, fora do Livre e da disputa)
  if (sumula && mundo.modo === 'partida') sumulaPasso(sumula, mundo, eventos);
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
  // replays nas paradas: o classificador lê o passo; o lance da bola morta aceito ARMA o replay (nunca pela API dos testes)
  if (lances) passoLances(eventos);
  // o cartão do passo vira UMA cena (o mais grave; nunca pela API dos testes): ANTES das trocas, que esperam por ela na fila
  decidirCartao(eventos);
  // as trocas do passo viram UMA cena (ou só a faixa) — decidido no fim do passo: no gol, as trocas e a 'saida' saem no
  // mesmo tick (as trocas antes) e o replay do gol, que a saída abre, vem primeiro
  if (substNoPasso.length) decidirSubst(eventos);
  // as trocas feitas NO APITO do intervalo (a edição pendente vale ali, Regra 3): a faixa na saída do 2º tempo — o passo
  // em que o intervalo acaba, também sem troca nova nele (antes elas ficavam guardadas e a faixa nunca aparecia)
  else if (faixaSub2T.length && estadoAntesPasso === 'intervalo' && mundo.partida?.estado !== 'intervalo') faixaDoIntervalo();
  // o apito do 1º tempo vira a cena do intervalo (ou a faixa de hoje) — no fim do passo, DEPOIS do cartão do mesmo passo
  // (que vai antes na fila) e do replay do gol do último lance (já começado no tratarEvento)
  if (intervaloAgora) decidirIntervalo();
  // o apito final vira a cena do pós-jogo (ou a faixa de hoje) — no fim do passo, depois do cartão do mesmo passo e do
  // replay do gol do último lance (já começado no tratarEvento)
  if (fimJogoAgora) decidirFimJogo();
  // a faixa "Você foi expulso" do passo: já, ou depois da cena do cartão e do replay de parada que vêm a seguir
  talvezFaixaExpulso();
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
  anel.inicio(mundo.tick, tempoSim(), cortou);
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
      // o guardador de lances: o gol entra no posGol() (na saída, no intervalo ou no fim), com ou sem replay
      if (lances) {
        const a = dg.autor != null && dg.chuteTick != null ? jogadorNoTick(anel, dg.chuteTick, dg.autor) : null;
        golGuardar = {
          tipo: 'gol', classe: 'gol', chave: dg.chuteTick ?? Math.max(0, dg.golTick - 45), fim: dg.golTick, morta: dg.golTick, lado: dg.lado,
          time: dg.time, ids: dg.autor != null ? [dg.autor] : [], x: a ? a.x : mundo.bola.p.x, z: a ? a.z : mundo.bola.p.z,
          tempo: mundo.partida.tempo, contra: dg.contra,
        };
      }
    }
    // comemoração (só na partida): começa já, da cópia do mundo neste tick
    if (mundo.partida && comemoracaoLigada) iniciarComemoracao(ev);
    return;
  }
  // a saída (ou o intervalo, o fim, um recomeço) chegou: a cena da comemoração acaba (o replay entra a seguir)
  if (cenaGol && (t === 'saida' || t === 'intervalo' || t === 'fimDeJogo' || t === 'recomeco')) encerrarComemoracao();
  // a saída do 2º tempo acaba a cena do intervalo (no plano geral, com o laço solto): o corte volta ao vivo
  if (cenaFim && cenaFim.tipo === 'intervalo' && t === 'saida') fimCenaFim(false);
  if ((t === 'troca' && ev.auto) || t === 'trocaAerea' || t === 'cobranca') return;
  // recomeço (gol, bola fora, R) e saída de bola (gol, início do tempo): todos voltam às posições
  // — a câmera CORTA para a jogada nova (sem atravessar o campo) e o km/h não fica descendo
  // (o "GOL!" e a câmera do gol acabam aqui: no treino a bola volta em 1 s — contraprova M8)
  if (t === 'recomeco' || t === 'saida' || t === 'cobrancaPenalti' || t === 'corteBolaParada') { corteCamera = true; kmhVisto = 0; encerrarEfeitosGol(); if (cam) cam.planoGeral(false); }
  // depois do gol, o replay entra na saída de bola (com todos já montados: o roteiro para antes do corte); o gol que
  // esperava o replay baixar e não chegou a tempo fica sem replay
  if (t === 'saida' || t === 'intervalo' || t === 'fimDeJogo' || t === 'recomeco') golSemDiretor = null;
  // (o gol entra no guardador de lances na vez do posGol, também sem replay — sem diretor, desligado, gol fora do anel)
  if (golGuardar && (t === 'saida' || t === 'intervalo' || t === 'fimDeJogo')) guardarGolPendente();
  if (t === 'saida' && diretor?.golPendente) posGol();
  // Modo Livre: R / "Bola no meu pé" no meio do gol (recomeço sem saída de bola) = "quero jogar já": o replay daquele gol
  // não toca — nem fica guardado para a próxima saída sem gol ("Recomeçar bola no meio")
  if (t === 'recomeco' && ev.livre && diretor?.golPendente) diretor.descartarGol();
  // impedimento: o replay no apito, com a linha no quadro do passe (a foto da Regra 11: ev.tickFoto) e a análise
  // semiautomática (o defensor da linha vem do evento)
  // (replay ainda não baixado: pede já e entra quando chegar, se ainda for o mesmo apito, até REPLAY_ATRASO_MAX passos)
  if (t === 'impedimento' && replayAuto && mundo.partida) {
    const di = { fotoTick: ev.tickFoto, apitoTick: mundo.tick, linhaX: ev.linhaX, idImpedido: ev.id, time: ev.time, lado: mundo.ataca?.[ev.time] ?? 1, defensor: ev.defensor ?? null, por: ev.por ?? null };
    const m0 = mundo;
    comDiretor(d => { if (iniciarReplay(d.impedimento(di))) { linhaNoReplay = di.apitoTick; if (lances) registrarReplay(lances, mundo.tick, 'impedimento'); } },
      () => mundo === m0 && mundo.tick - di.apitoTick <= REPLAY_ATRASO_MAX && !cenaGol && !cenaSub && !cenaCartao && !diretor.ativo);
  }
  // partida: intervalo, fim, edição do time e substituição (intervalo e fim: plano geral do estádio). Gol no último
  // lance do tempo: o replay dele vem antes da faixa
  if (t === 'intervalo') {
    encerrarEfeitosGol();
    if (cam) cam.planoGeral(true);
    // a cena do intervalo (js/cena-fim.js): decidida no fim do passo (decidirIntervalo), depois do cartão do mesmo passo; o
    // replay do gol do último lance começa já (a cena espera ele na fila). Sem ela (desligada, online, sem o módulo, pela API
    // dos testes): a faixa de 3 s de hoje (no online com a tarja do placar nesses 3 s)
    if (podeCenaIntervalo()) {
      if (diretor?.golPendente) posGol();
      intervaloAgora = true;
      return;
    }
    if (diretor?.golPendente && posGol()) filaCenas.push(faixaIntervalo); else faixaIntervalo();
    return;
  }
  if (t === 'fimDeJogo') {
    // Total Match: o resultado fica gravado já no apito (o TM lê de lá se a mensagem se perder); o botão da faixa volta ao TM
    if (TM) gravarResultadoTM(resultadoAtualTM());
    hud.definirEstado({ fim: true });
    encerrarEfeitosGol();
    if (cam) cam.planoGeral(true);
    // a cena do pós-jogo (js/cena-fim.js 'fimDeJogo'): decidida no fim do passo (decidirFimJogo), depois do cartão do mesmo
    // passo; o replay do gol do último lance começa já (a cena espera ele na fila). Sem ela (desligada, sem o módulo, pela API
    // dos testes): a faixa do fim de hoje
    if (podeCenaFimJogo()) {
      if (diretor?.golPendente) posGol();
      fimJogoAgora = true;
      return;
    }
    if (diretor?.golPendente && posGol()) filaCenas.push(faixaFimJogo); else faixaFimJogo();
    return;
  }
  if (t === 'livreAjuste') { PAG_LIVRE?.evento(ev); return; }
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
  // (a faixa espera: no fim do passo — talvezFaixaExpulso — ela sai já ou depois da cena do cartão e do replay de parada
  // desta bola morta, com os 6 s contando de quando aparece: PLANO-CENAS.md R11)
  if (t === 'cartao' && TRAVA_TM != null && ev.id === TRAVA_TM && ev.cor === 'vermelho' && !expulsoAvisado) {
    expulsoAvisado = true; expulsoTick = mundo.tick;
    expulsoPendente = true;
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
  relEst.tSim = passosTotais * PASSO;
  const tFim = relogioEstadio(relEst, 0, false);
  // autor de verdade do gol (último toque pelos eventos; tratarEvento usa no "GOL!")
  autorEventos(autorGol, eventos, mundo.tick, timeDe);
  const n = detectarImpactos(_p0, _v0, b.p, b.v, _impactos);
  _ctxEmocao.t = tFim; _ctxEmocao.bola = b.p; _ctxEmocao.ataca = mundo.ataca;
  for (let k = 0; k < n; k++) {
    // a bolsa começa no FIM do passo, quando a bola DESENHADA (interpolada de p0 a p1) encosta na rede (com meio passo
    // antes, a bola desenhada dava um pulo para a frente no quadro da batida: a bolsa somava ~9 cm ao passo dela)
    const imp = registrarImpacto(ondas, _impactos[k], tFim);
    if (!imp) continue;
    emocaoEvento(emocao, { tipo: 'redeImpacto', vel: _impactos[k].vel }, _ctxEmocao);
    // (as últimas batidas, para o guardador de lances: a rede de um gol do 1º tempo balança de novo no intervalo)
    const bt = batidasRede[batidaK++ % batidasRede.length];
    bt.ativo = true; bt.t0 = imp.t0; bt.x = imp.x; bt.y = imp.y; bt.z = imp.z; bt.plano = imp.plano; bt.amp = imp.amp; bt.dx = imp.dx; bt.dy = imp.dy; bt.dz = imp.dz;
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
  _ctxEmocao.t = tempoSim(); _ctxEmocao.bola = b.p; _ctxEmocao.ataca = mundo.ataca;
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
// a mira pela tela (C6, contrato "Mira pela tela"): a câmera que desenhou o último quadro (o que a pessoa viu) e o ponto do
// gramado de onde a ação sai — a entrada do próximo quadro leva a direção do analógico na tela ao gramado por ela
// (controle.js miraPelaTela). ok = false antes do 1º quadro desenhado (a entrada usa o rumo, paraMundo)
const telaMira = { cam: {}, ox: 0, oz: 0, ok: false };
const alvoCam = { jx: 0, jz: 0, jvx: 0, jvz: 0, bx: 0, bz: 0, ax: NaN, az: NaN };
/** Ponto do mundo → px CSS (sem alocar). */
function projetar(x, y, z, out) {
  _proj.set(x, y, z).project(cam.camera);
  out.x = (_proj.x + 1) / 2 * window.innerWidth; out.y = (1 - _proj.y) / 2 * window.innerHeight; out.atras = _proj.z > 1;
  return out;
}
const _pt = { x: 0, y: 0, atras: false };
// o NOME em cima do jogador com a bola (dono, 17/10): o nome de camisa acima da cabeça, só com a bola no pé, no jogo
// (fora do pré-jogo, das cenas e do replay); um elemento só, fora do #hud (só desenho: o hash não muda)
let elNome = null, nomeId = null;
const _ptNome = { x: 0, y: 0, atras: false };
function marcarCondutor() {
  if (!elNome) {
    elNome = document.createElement('div');
    elNome.id = 'nome-condutor';
    elNome.setAttribute('aria-hidden', 'true');
    document.body.append(elNome);
  }
  const id = mundo.posse;
  const e = id != null ? estJ.get(id) : null;
  const livre = !!e && !cenaGol && !cenaSub && !cenaCartao && !cenaFim && !(diretor && diretor.ativo) && !(prejogo && prejogo.ativo) && !PRINTS;
  if (livre) projetar(lerp(e.x0, e.x1, alfa), 2.2, lerp(e.z0, e.z1, alfa), _ptNome);
  if (!livre || _ptNome.atras) { if (!elNome.hidden) elNome.hidden = true; return; }
  if (nomeId !== id) {
    // a caixa: número + nome da camisa (texto puro, nunca HTML)
    const f = fichaDe(id), num = document.createElement('b'), nome = document.createElement('span');
    num.className = 'nc-num'; num.textContent = f && f.num != null ? String(f.num) : '';
    nome.className = 'nc-nome'; nome.textContent = f ? (f.camisa ?? f.nome ?? '') : '';
    elNome.replaceChildren(...(num.textContent ? [num] : []), nome); nomeId = id;
  }
  elNome.style.transform = `translate(${_ptNome.x.toFixed(1)}px, ${_ptNome.y.toFixed(1)}px) translate(-50%, -100%)`;
  if (elNome.hidden) elNome.hidden = false;
}
const _carga = { x: 0, y: 0, forca: 0, tipo: '' };
const _queda = { x: 0, z: 0 };

// Celular em pé: o jogo só roda deitado (dono, 10/10: "é obrigatório virar o celular pra jogar").
// A tela "Gire o celular" (index.html #girar, mostrada pelo CSS com a mesma media query) cobre tudo
// e o jogo fica parado até deitar. Só com toque: janela estreita no PC continua jogando.
const mqRetrato = window.matchMedia('(orientation: portrait)');
function retratoBloqueado() { return mqRetrato.matches && document.documentElement.classList.contains('com-toque'); }

function pausado() {
  if (mundo.online) return retratoBloqueado() || !!PAG_ONLINE?.pausado;
  return hud.menuAberto || hud.ajudaAberta || !!editor?.aberto || retratoBloqueado();
}

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
  // bola interpolada (na cena de substituição, parada onde ela está: no chão se o cobrador de agora é quem entra; na do
  // intervalo, a bola da cena — a cópia andando pela física —, fora do desenho depois do túnel)
  if (cenaSub) { _bp.x = cenaSub.bola.x; _bp.y = cenaSub.bola.y; _bp.z = cenaSub.bola.z; _qd.copy(bolaAtu.q); }
  else if (cenaFim) {
    const c = cenaFim.c, al = c.alfa;
    _bp.x = lerp(c.bola0.x, c.bola1.x, al); _bp.y = lerp(c.bola0.y, c.bola1.y, al); _bp.z = lerp(c.bola0.z, c.bola1.z, al);
    const q = c.mF.bola.q;
    _qd.set(q.x, q.y, q.z, q.w);
  } else {
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
  if (cenaFim) bola3d.mesh.visible = cenaFim.c.bolaVisivel;
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
  if (cenaCartao || cenaFim) {
    // cartão e intervalo: os atores da cena (as cópias dos 22, o expulso, o árbitro, os assistentes e os treinadores parados
    // na área técnica), sem anel do controlado; o árbitro com o uniforme dele e os treinadores com o deles. No intervalo,
    // depois do túnel ninguém (o campo vazio até a saída)
    const c = cenaCartao ? cenaCartao.c : cenaFim.c, al = c.alfa;
    for (const a of c.atores) {
      if (a.ativo === false) continue;
      const des = a.des ?? (a.des = new Float32Array(NJ * 3));
      interpolarPose(a.ant, a.atu, al, des);
      const it = lista[n] ?? (lista[n] = {});
      it.id = a.id; it.time = a.time; it.pose = des; it.controlado = false; it.goleiro = a.goleiro; it.proximo = false;
      it.pressiona = false; it.relogio = -1; it.tecnico = a.tipo === 'tecnico'; it.ocultar = 0;
      // (a troca de camisa do pós-jogo: a camisa do outro com o calção e o meião dele — o kit misto do jogador3d.js)
      it.kit = (a.camisaDe != null && cenaFim ? kitTrocaDe(cenaFim, a) : null) ?? a.kit ?? kitDoId(a.id, a.goleiro);
      it.x = lerp(a.x0, a.x1, al); it.z = lerp(a.z0, a.z1, al); it.rumo = lerpAng(a.r0, a.r1, al);
      it.v = Math.hypot(a.x1 - a.x0, a.z1 - a.z0) / PASSO;
      n++;
    }
  } else if (cenaSub) {
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
      it.v = Math.hypot(a.x1 - a.x0, a.z1 - a.z0) / PASSO;
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
      it.v = Math.hypot(a.x1 - a.x0, a.z1 - a.z0) / PASSO;
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
    it.v = Math.hypot(e.x1 - e.x0, e.z1 - e.z0) / PASSO; // a postura do desenho (esqueleto.js)
    if (it.controlado) { hx = it.x; hz = it.z; achou = true; }
    n++;
  }
  // os treinadores (na partida; também com as cenas da comemoração e da substituição no lugar dos jogadores: os últimos
  // passos deles vieram da cena, que interpola com o alfa dela)
  // (nas cenas do cartão e do intervalo os vivos ficam fora: quem aparece é a cópia da cena — no intervalo, até a saída)
  if (!cenaCartao && !cenaFim) n = anexarTecnicos(lista, n, tecAlfaCena && cenaGol ? cenaGol.alfa : tecAlfaCena && cenaSub ? cenaSub.alfa : alfa);
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
  if (cenaCartao) cameraCartao();
  else if (cenaFim) cameraFim();
  else if (cenaSub) cameraSubst();
  else if (cenaGol) cameraComemoracao();
  // disputa de pênaltis: os planos dela (atrás do cobrador, a reação, o círculo) pela câmera de cinema (corte na troca)
  else if (mundo.disputa) cam.definirCinema(MOD_DISP.planoCameraDisputa(mundo, planoDisputa, posDesenhada));
  if (!bp.carga && mundo.partida && /^(esc|tiro|pen)/.test(mundo.parada?.tipo)) carregarBP();
  bp.plano = bp.tela && !cenaSub && !cenaGol && !cenaCartao && !cenaFim ? bp.tela.camera(mundo, TIME_HUMANO) : null;
  bp.yaw = bp.plano?.yaw ?? null;
  cam.bolaParada(bp.plano?.plano);
  cam.atualizar(dt, alvoCam, corteCamera);
  corteCamera = false;
  // a câmera deste quadro para a mira (a TV, a da bola parada, as do Livre, a da disputa: a que desenha) e o ponto de onde
  // a ação sai: a bola perto do controlado (no pé, na cobrança, nas mãos), senão ele (a bola chegando: o 1º toque é dele).
  // As câmeras das cenas (comemoração, substituição, cartão, intervalo/fim, o plano geral) não valem: o 1º quadro depois
  // delas usa o rumo (paraMundo) até a câmera de jogo desenhar
  cam.camera.updateMatrixWorld();
  cameraDaMatriz(cam.camera.matrixWorld.elements, telaMira.cam);
  // (na cobrança dele a mira sai sempre da bola: com a corrida da cobrança, item 70, ele espera a 2,5–5 m dela)
  const prMira = mundo.parada, cobraMira = !!h && !!prMira && !prMira.rolou && prMira.cobrador === h.id;
  const bolaPerto = cobraMira || Math.hypot(_bp.x - hx, _bp.z - hz) <= CFG.ENTRADA.miraBolaPerto;
  telaMira.ox = bolaPerto ? _bp.x : hx; telaMira.oz = bolaPerto ? _bp.z : hz;
  telaMira.ok = (achou || !!h) && !cenaGol && !cenaSub && !cenaCartao && !cenaFim && !cam.geral;
  const f = cam.foco();
  cena3d.acompanhar(f.x, f.z);
  const tj0 = performance.now();
  jog3d.atualizar(lista, cam.camera);
  // o cartão 3D na mão DESENHADA do árbitro (com o corpo novo, a postura do desenho por cima: jog3d.poseDesenhada)
  if (cartao3d) {
    if (cenaCartao) {
      const c = cenaCartao.c, des = jog3d.poseDesenhada(c.arbitro.id, _poseArb) ?? c.arbitro.des;
      cartao3d.atualizar(des ? MOD_CEN.cc.cartaoNaMao(c, des, _maoCartao) : null);
    } else cartao3d.atualizar(null);
  }
  const tj1 = performance.now();
  // a placa do quarto árbitro nas mãos dele (o par da vez; o do humano primeiro); fora da cena, some
  if (placaSub) {
    if (cenaSub) {
      const q = cenaSub.quarto, pp = paresDaPlaca(cenaSub, tempoCenaSubst(cenaSub), _parPlaca);
      placaSub.mostrar(pp.entra, pp.sai);
      placaSub.atualizar(placaNasMaos(cenaSub, q.des ?? q.atu, _placa), renderizar);
    } else placaSub.atualizar(null, renderizar);
  }
  if (cenaGol || cenaSub || cenaCartao || cenaFim) {
    // comemoração e cenas: nada do jogo ao vivo no gramado (queda da bola, opções do lateral, linha)
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
  if (bp.tela) bp.tela.desenhar(cenaGol || cenaSub || cenaCartao || cenaFim ? null : mundo, cam.camera, dt, bp.linha);
  // (a câmera de jogo — a TV — sem cadeira 3D de perto: item 69)
  campo.atualizar(agoraMs / 1000, cam.camera, renderizar, cam.deJogo);
  marcarCondutor();
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
  if (h && !cenaGol && !cenaSub && !cenaCartao && !cenaFim) {
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
  // cartão do árbitro em cima de quem levou (por FALTAS.icone s; o expulso no lugar em que estava). Quem teve a cena do
  // cartão não ganha o ícone (o cartão esteve na mão do árbitro), nem antes nem depois dela
  const uc = mundo.partida?.ultimoCartao;
  const semIcone = !!cenaCartao || !!cenaFim || (uc && (cartaoGolPendente || (cartaoComCena && cartaoComCena.id === uc.id && cartaoComCena.tick === uc.tick)));
  if (uc && !semIcone && !cenaGol && !cenaSub && mundo.tick >= uc.tick && (mundo.tick - uc.tick) * PASSO < FALTAS.icone) {
    const jc = mundo.jogadores.find(q => q.id === uc.id);
    projetar(jc ? jc.x : uc.x, 2.25, jc ? jc.z : uc.z, _pt);
    if (_pt.atras) hud.cartao(null); else { _cartao.x = _pt.x; _cartao.y = _pt.y; _cartao.cor = uc.cor; hud.cartao(_cartao); }
  } else hud.cartao(null);
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  hud.relogio(mundo.partida && !mundo.disputa && !mundo.livre ? lerRelogio() : null);
  // online: a tarja do placar com os autores só nos 3 s da faixa do intervalo (com o mundo parado: R10)
  if (tarjaOnline && telaCenas) {
    if (mundo.partida?.estado === 'intervalo') telaCenas.placar(tarjaOnline);
    else { telaCenas.placar(null); tarjaOnline = null; }
  }
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
  // (a cena do cartão do mesmo passo vem antes: a de substituição espera na fila)
  if ((diretor && diretor.ativo) || filaCenas.length || cenaSub || cenaCartao) filaCenas.push(item);
  else if (item.tipo === 'subst') iniciarSubst(item);
  else mostrarFaixaSub(pares);
}

/**
 * As trocas do intervalo na faixa (sem cena), na saída do 2º tempo; depois do replay/cena que estiver na frente (a cena do
 * intervalo: a troca feita no "Editar time" da pausa dela entra no plano geral, com o laço solto — a faixa espera a saída,
 * que acaba a cena).
 */
function faixaDoIntervalo() {
  const pares = faixaSub2T.splice(0);
  if ((diretor && diretor.ativo) || filaCenas.length || cenaSub || cenaCartao || cenaFim) filaCenas.push({ tipo: 'faixaSub', pares });
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
    // a cena do cartão que esperou o replay (impedimento com o cartão da vantagem) ou outra cena: o mundo segue no tick dela
    if (it.tipo === 'cartao') { if (iniciarCartao(it)) return; continue; }
    // a cena do intervalo que esperou o replay do gol do último lance (ou o cartão do último apito): o mundo segue no tick
    // do 'intervalo'; sem ela agora (as cenas desligadas na pausa), a faixa de hoje
    if (it.tipo === 'intervalo') {
      if (podeCenaIntervalo() && iniciarCenaFim(it)) return;
      if (mundo.partida?.estado === 'intervalo') faixaIntervalo();
      continue;
    }
    // a cena do pós-jogo que esperou o replay do gol do último lance (ou o cartão do último apito); sem ela agora, a faixa
    if (it.tipo === 'fim') {
      if (podeCenaFimJogo() && iniciarCenaFim(it)) return;
      if (mundo.partida?.estado === 'fim') faixaFimJogo();
      continue;
    }
    if (it.pares) mostrarFaixaSub(it.pares);
  }
  tocarAdiados();
}

// ------------------------------------------------------------------ cena do cartão (js/cena-cartao.js, sob demanda)
/** Ocupado: um replay, a cena de substituição, a do cartão ou a fila andando — a cena nova espera na fila. */
const cenaOcupada = () => (diretor && diretor.ativo) || !!cenaSub || !!cenaCartao || !!cenaFim || filaCenas.length > 0;
/**
 * Fim do passo da partida (rodarPasso): o cartão do passo ganha a cena — o mais grave (escolherCartao: o 2º amarelo vira UM
 * vermelho com `segundo`). Só com as cenas ligadas, o módulo baixado (sem ele: o ícone de hoje, sem segurar; R23), fora
 * do online e da API dos testes. No gol (a vantagem que acabou em gol) a cena espera o gol + 149, depois da comemoração
 * (cartaoGolNoPonto); com um replay ou outra cena em andamento, entra na fila.
 */
function decidirCartao(eventos) {
  if (!MOD_CEN || emRodarPassos || !mundo.partida || mundo.livre || mundo.disputa || mundo.online || !cenasLigadas()) return;
  let tem = false;
  for (const e of eventos) if (e.tipo === 'cartao') { tem = true; break; }
  if (!tem) return;
  const cartao = MOD_CEN.cc.escolherCartao(eventos);
  if (!cartao) return;
  cartaoComCena = { id: cartao.id, tick: mundo.tick };
  if (mundo.partida.estado === 'gol') { cartaoGolPendente = { cartao, desde: mundo.partida.desde, tickEvento: mundo.tick }; return; }
  const item = { tipo: 'cartao', cartao, tickEvento: mundo.tick };
  if (cenaOcupada()) filaCenas.push(item);
  else iniciarCartao(item);
}

/**
 * O TOPO de cada volta do laço (também na cortina da comemoração pulada): o cartão que saiu no gol começa no gol + 149 — o
 * último passo antes da montagem da saída —, depois da comemoração (a que está rodando segura ali; a solta sai do desenho
 * agora). Devolve true se a cena começou (a volta para sem rodar o passo).
 */
function cartaoGolNoPonto() {
  const pc = cartaoGolPendente;
  if (!pc) return false;
  const p = mundo.partida;
  // (o gol acabou sem a cena: mundo novo, a API dos testes — o ícone de sempre)
  if (!p || p.estado !== 'gol' || p.desde !== pc.desde) { cartaoGolPendente = null; cartaoComCena = null; return false; }
  if (mundo.tick + 1 - p.desde < PASSOS_GOL) return false;
  if ((cenaGol && cenaEstado === 'rodando') || (diretor && diretor.ativo) || cenaSub || cenaCartao) return false;
  cartaoGolPendente = null;
  // a comemoração solta (a cortina dos passos que faltavam) sai do desenho: a cena do cartão entra no lugar dela — e o
  // passo da saída continua NEUTRO, como seria com ela (golNeutro)
  if (cenaGol) { golNeutro = p.desde; encerrarComemoracao(); }
  return iniciarCartao({ tipo: 'cartao', cartao: pc.cartao, tickEvento: pc.tickEvento });
}

/** O gol cuja comemoração a cena do cartão encerrou ainda está no estado 'gol' (o passo da saída vai neutro). */
function golNeutroAgora() {
  if (golNeutro == null) return false;
  const p = mundo.partida;
  if (p && p.estado === 'gol' && p.desde === golNeutro) return true;
  golNeutro = null;
  return false;
}

/** Começa a cena (o mundo segurado no tick do cartão: só cópias). Devolve false se não deu (o ícone de sempre). */
function iniciarCartao(item) {
  const M = MOD_CEN;
  if (!M || !mundo.partida) return false;
  const tick = mundo.tick;
  // o expulso saiu do mundo no passo do cartão: a posição desenhada no tick anterior (anel do replay)
  const posAntes = id => { const a = jogadorNoTick(anel, tick - 1, id); return a ? { x: a.x, z: a.z } : null; };
  const plano = M.cc.planejarCartao(mundo, item.cartao, {
    ultimaAmarelo, ultimaVermelho, variante: forcarVariante[item.cartao.cor] ?? undefined, timeHumano: TIME_HUMANO, posAntes,
    // o estádio de forma própria (TM, edição pro): o plano da torcida nos trilhos do pré-jogo dele
    ajustePlano: IDENT?.forma3d?.planta?.ajustarPlano ?? null,
    treinadores: tecnicos && tecVisiveis ? [treinadorDoTime(tecnicos, 0), treinadorDoTime(tecnicos, 1)] : null,
  });
  if (!plano) { if (cartaoComCena && cartaoComCena.id === item.cartao.id) cartaoComCena = null; return false; }
  forcarVariante[item.cartao.cor] = null;
  if (plano.cor === 'vermelho') ultimaVermelho = plano.variante; else ultimaAmarelo = plano.variante;
  cenaCartao = { c: M.cc.criarCenaCartao(plano, mundo), cartao: item.cartao, tick, botoes: entrada ? entrada.ler(yawEntrada()).botoes : 0, tarja: null };
  cartaoComCena = { id: plano.id, tick: item.tickEvento ?? tick };
  entrada?.limparPulsos();
  encerrarEfeitosGol();
  hud.cena(true); hud.cartao(null);
  cenaCartao.tarja = dadosTarja(plano);
  alfa = 1;
  corteCamera = true;
  return true;
}

/** A tarja de identificação (cenas-tela.js): o cartão, a sigla, a cor e o escudo do time, o número e o nome. */
function dadosTarja(plano) {
  const id = plano.id, t = plano.time === 1 ? 1 : 0;
  const f = fichaDe(id), el = ELENCOS[elencoDoJogador(id)], ct = COR_TIME[t];
  return {
    cor: plano.cor, segundo: !!plano.segundo, sigla: el?.sigla ?? hud.times[t]?.sigla ?? '', nomeTime: el?.nome ?? hud.times[t]?.nome ?? '',
    cor1: ct.cor, cor2: ct.texto, escudo: document.getElementById(`escudo-${t}`)?.getAttribute('href') ?? null,
    num: f?.num ?? '', nome: f?.nome ?? String(id), curto: f?.camisa ?? f?.nome ?? String(id),
  };
}

/** Um quadro da cena (fora da pausa): o pulo, o relógio dela, a tarja, o estádio no relógio do desenho e a torcida. */
function quadroCartao(dt, ent) {
  const C = cenaCartao, c = C.c, M = MOD_CEN;
  if (M.cc.tempoCenaCartao(c) < M.cfg.CENAS.pularDepois) C.botoes |= ent.botoes;
  else {
    const novos = ent.botoes & ~C.botoes;
    C.botoes &= ent.botoes;
    if (novos) { pularCartao(); return; }
  }
  const t0 = performance.now(), k0 = c.k;
  M.cc.avancarCenaCartao(c, dt);
  // a torcida reage ao que a cena mostra (render/emocao.js: cartaoCena, aplausoExpulso) e anda no relógio do desenho
  M.cc.consumirEventosCartao(c, _evCartao);
  if (_evCartao.length) {
    _ctxEmocao.t = tempoEstadio(); _ctxEmocao.bola = mundo.bola.p; _ctxEmocao.ataca = mundo.ataca;
    for (const ev of _evCartao) emocaoEvento(emocao, ev, _ctxEmocao);
  }
  estadioSegurado(dt);
  // a tarja entra com o cartão no alto e sai com a cena (≤ CENAS.tarja s)
  const tc = M.cc.tempoCenaCartao(c), T = c.plano.tempos;
  if (telaCenas) telaCenas.tarja(tc >= T.alto - 1e-6 && tc < T.alto + M.cfg.CENAS.tarja ? C.tarja : null);
  const ms = performance.now() - t0;
  custoCartao.n += c.k - k0; custoCartao.ms += ms; mq.aCena += ms;
  if (c.acabou) fimCartao(false);
}

/**
 * Um quadro com o laço SEGURADO pela cena do cartão: o relógio do estádio anda pelo dt do desenho e o ânimo e a festa da
 * torcida andam com ele (bandeiras, bandeirão, sinalizadores, ola, cantos) — do mundo só lê (parado). Os disparos de agora
 * (a vaia ao punido, um canto) tocam já.
 */
function estadioSegurado(dt) {
  if (!(dt > 0)) return;
  const t = relogioEstadio(relEst, dt, true);
  const b = mundo.bola, p = _passoEmocao;
  p.t = t; p.bola = b.p; p.ataca = mundo.ataca; p.estado = mundo.partida?.estado ?? null;
  p.posseTime = mundo.posse != null ? timeDe(mundo.posse) : (mundo.voo ? (mundo.voo.time ?? timeDe(mundo.voo.de)) : (mundo.partida?.ultimoTime ?? null));
  emocaoPasso(emocao, p, dt);
  const ds = consumirDisparos(emocao);
  for (const d of ds) tocarSom(d);
}

/** O plano de câmera da cena no quadro (cortes secos pelo nome); o vão das placas no plano do túnel. */
function cameraCartao() {
  const opc = { pequena: Math.min(window.innerWidth, window.innerHeight) < 520, aspecto: window.innerWidth / window.innerHeight };
  MOD_CEN.cc.planoCameraCartao(cenaCartao.c, opc, planoCamCartao);
  if (planoCamCartao.nome === 'fim') return;
  if (vaoCenas) { if (planoCamCartao.tunel) vaoCenas.abrir(); else vaoCenas.fechar(); }
  // a câmera de cinema nunca dentro de um treinador (as cópias da cena ficam onde os vivos estão)
  if (tecnicos) afastarDeTecnicos(planoCamCartao.de, tecnicos, 0.6);
  cam.definirCinema(planoCamCartao);
}

/**
 * Pula a cena (um aperto novo depois de CENAS.pularDepois): a cortina e o corte de volta ao vivo. Antes disso, nada. Antes
 * de o cartão subir, o ícone de sempre volta (senão nada na tela diria quem levou).
 */
function pularCartao() {
  if (!cenaCartao) return;
  const tc = MOD_CEN.cc.tempoCenaCartao(cenaCartao.c);
  if (tc < MOD_CEN.cfg.CENAS.pularDepois) return;
  // pulada antes de o cartão subir (nem a tarja nem o cartão 3D apareceram): o ícone de sempre em cima de quem levou — o
  // mundo ainda está no tick do cartão, a janela de FALTAS.icone fica inteira, como com ?cenas=0
  if (tc < cenaCartao.c.plano.tempos.alto - 1e-6) cartaoComCena = null;
  hud.cortina();
  fimCartao(true);
}

/**
 * Fim da cena (acabou ou pulou): corte seco para a câmera de TV, a tarja e o cartão 3D saem, o vão fecha, a simulação
 * continua do MESMO tick (o desenho dos jogadores volta ao estado do mundo, sem interpolar das cópias) e a fila anda. pulou:
 * o aperto que pulou não vira jogada.
 */
function fimCartao(pulou) {
  if (!cenaCartao) return;
  cenaCartao = null;
  hud.cena(false);
  telaCenas?.tarja(null);
  if (vaoCenas) vaoCenas.fechar();
  if (cartao3d) cartao3d.atualizar(null);
  if (cam) cam.definirCinema(null);
  corteCamera = true;
  if (entrada) {
    if (pulou) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); }
    entrada.limparPulsos();
    entrada.reposicionar?.();
  }
  proximaCena();
  talvezFaixaExpulso();
}

/** A cena sai de vez sem andar a fila (mundo novo, "Simular o resto"). */
function descartarCartao() {
  if (cenaCartao) {
    cenaCartao = null;
    if (cam) cam.definirCinema(null);
    entrada?.reposicionar?.();
  }
  cartaoGolPendente = null; cartaoComCena = null; golNeutro = null;
  hud.cena(false);
  telaCenas?.tarja(null);
  if (vaoCenas) vaoCenas.fechar();
  if (cartao3d) cartao3d.atualizar(null);
}

/**
 * A faixa "Você foi expulso" (TM, "só o meu jogador") que espera: sai quando não há mais nada daquela bola morta na frente
 * — nem a cena do cartão (rodando, na fila ou esperando o gol + 149), nem o replay de parada armado dela (ele a põe na fila
 * ao começar), nem a comemoração, nem um replay tocando (o do gol, na saída). Os 6 s contam de quando ela aparece
 * (PLANO-CENAS.md R11). No intervalo espera o 2º tempo; no fim de jogo não sai (fica a faixa do fim).
 */
function talvezFaixaExpulso() {
  if (!expulsoPendente) return;
  const p = mundo.partida;
  // o gol que acabou o jogo: a faixa do fim fica (sem "Simular o resto"; ela não cobre o "Voltar ao Total Match")
  if (p?.estado === 'fim') { expulsoPendente = false; return; }
  // a vantagem que acabou em gol: espera a comemoração, a cena do cartão (gol + 149) e o replay do gol (na saída: o
  // diretor ativo); o gol que acabou o 1º tempo: a faixa do intervalo fica e esta sai no 2º tempo; a cena de substituição
  // também esconde as faixas
  if (cartaoGolPendente || cenaGol || cenaSub || cenaFim || p?.estado === 'gol' || p?.estado === 'intervalo') return;
  if (cenaCartao || filaCenas.some(it => it && it.tipo === 'cartao') || (diretor && diretor.ativo)) return;
  if (replayParada && replayParada.morta === expulsoTick) return;
  expulsoPendente = false;
  faixaExpulso();
}

// ------------------------------------------------------------------ cena do intervalo (js/cena-fim.js, sob demanda)
/** A faixa "Intervalo" de hoje (3 s; sem a cena). No online, a tarja do placar com os autores nesses 3 s (R10). */
function faixaIntervalo() {
  guardarFaixaExpulso();
  hud.faixa({ titulo: 'Intervalo', placar: textoPlacar(), ms: Math.round((CFG.PARTIDA?.intervalo ?? 3) * 1000) });
  if (ONLINE && telaCenas && mundo.partida?.estado === 'intervalo') tarjaOnline = dadosPlacar(true);
}
/**
 * A cena do intervalo vale agora? Só com as cenas ligadas, o módulo baixado (sem ele: a faixa de hoje, sem segurar nem
 * esperar o download: R23), na partida (fora do Livre, da disputa e do online) e fora da API dos testes (rodarPassos).
 */
const podeCenaIntervalo = () => !!MOD_CEN?.cf && !emRodarPassos && !!mundo.partida && !mundo.livre && !mundo.disputa && !mundo.online && cenasLigadas();
/** Fim do passo que trouxe o 'intervalo': a cena já, ou na fila (depois do replay do gol do último lance e do cartão). */
function decidirIntervalo() {
  intervaloAgora = false;
  if (!podeCenaIntervalo()) { faixaIntervalo(); return; }
  const item = { tipo: 'intervalo', tick: mundo.tick };
  if (cenaOcupada()) filaCenas.push(item);
  else iniciarCenaFim(item);
}
/**
 * A simulação espera: no tick do 'intervalo' (a cena antes do plano geral) e no tick do 'fimDeJogo' (a cena do pós-jogo,
 * fora do online, até ela sair: em 'fim' só o m.tick andaria — R5).
 */
const seguraIntervalo = () => !!cenaFim && (cenaFim.tipo === 'fim' ? cenaFim.segura : !cenaFim.geral);

// ------------------------------------------------------------------ cena do pós-jogo (js/cena-fim.js 'fimDeJogo', sob demanda)
/** A faixa do fim de hoje ("Fim de jogo", o placar e "Jogar de novo" / "Voltar ao Total Match"; sem a cena). */
function faixaFimJogo() {
  hud.faixa(TM ? { titulo: 'Fim de jogo', placar: textoPlacar(), botao: true, botaoTexto: 'Voltar ao Total Match', botaoCmd: 'voltar-tm', final: true }
    : { titulo: 'Fim de jogo', placar: textoPlacar(), botao: true, final: true });
}
/**
 * A cena do pós-jogo vale agora? Só com as cenas ligadas ("Cenas" do Modo de jogo; no ONLINE também — R22: o pós-jogo não
 * segura nada lá), o módulo baixado (sem ele: a faixa de hoje, sem esperar o download: R23), na partida (fora do Livre e
 * da disputa) e fora da API dos testes (rodarPassos).
 */
const cenaFimLigada = () => cenasPref ?? MOD_CEN?.cfg.CENAS.ligadas ?? true;
const podeCenaFimJogo = () => !!MOD_CEN?.cf && !emRodarPassos && !!mundo.partida && !mundo.livre && !mundo.disputa && cenaFimLigada();
/** Fim do passo que trouxe o 'fimDeJogo': a cena já, ou na fila (depois do replay do gol do último lance e do cartão). */
function decidirFimJogo() {
  fimJogoAgora = false;
  if (!podeCenaFimJogo()) { faixaFimJogo(); return; }
  const item = { tipo: 'fim', tick: mundo.tick };
  if (cenaOcupada()) filaCenas.push(item);
  else if (!iniciarCenaFim(item)) faixaFimJogo();
}
/** A tarja do melhor em campo (cenas-tela.js): o time, o número, o nome e a nota (a do resultado do TM). */
function dadosMelhor(mc) {
  if (!mc) return null;
  const t = mc.time === 1 ? 1 : 0, f = fichaDe(mc.id), el = ELENCOS[elencoDoJogador(mc.id)], ct = COR_TIME[t];
  return {
    sigla: el?.sigla ?? hud.times[t]?.sigla ?? '', nomeTime: el?.nome ?? hud.times[t]?.nome ?? '', cor1: ct.cor, cor2: ct.texto,
    escudo: document.getElementById(`escudo-${t}`)?.getAttribute('href') ?? null,
    num: f?.num ?? '', nome: f?.nome ?? String(mc.id), curto: f?.camisa ?? f?.nome ?? String(mc.id), nota: mc.nota,
  };
}
/** O kit misto do ator da troca de camisa (render/jogador3d.js: `troca:<camisa do outro>:<o resto dele>:<número do outro>`). */
function kitTrocaDe(F, a) {
  let k = F.kitTroca.get(a.id);
  if (k === undefined) {
    const camisa = kitDoId(a.camisaDe, false), resto = kitDoId(a.id, false), f = fichaDe(a.camisaDe);
    k = camisa && resto ? `troca:${camisa}:${resto}:${f?.num ?? 0}` : null;
    F.kitTroca.set(a.id, k);
  }
  return k;
}
/**
 * A faixa final da cena do pós-jogo (no plano geral): "Fim de jogo", o placar, "Jogar de novo" (com ?tm, "Voltar ao Total
 * Match") e "Melhores momentos" (só com lances guardados).
 */
function faixaFimCena() {
  const tem = !!guarda && MOD_CEN.lg.escolherLances(guarda, { max: 1 }, []).length > 0;
  hud.faixa({ titulo: 'Fim de jogo', placar: textoPlacar(), botao: true, botaoTexto: TM ? 'Voltar ao Total Match' : 'Jogar de novo',
    botaoCmd: TM ? 'voltar-tm' : 'reiniciar-partida', botao2: tem, botao2Texto: 'Melhores momentos', botao2Cmd: 'melhores-momentos', final: true });
}
/**
 * "Melhores momentos" (a faixa final da cena do pós-jogo): até CENA_FIM.lances.fim lances do guardador, os gols primeiro, ≤
 * fimMax s, na ordem do jogo (lances-guarda.js escolherLances cronologica), um ângulo cada (tocarLanceGuardado: a fonte = o
 * mini-anel; o aoFim volta aqui, sem andar a fila). O Pular (qualquer aperto novo) volta à faixa. Devolve true se começou.
 */
function iniciarMelhores() {
  const F = cenaFim;
  if (!F || F.tipo !== 'fim' || !F.geral || F.mm || !guarda || (diretor && diretor.ativo)) return false;
  const L = MOD_CEN.cfg.CENA_FIM.lances;
  const ks = MOD_CEN.lg.escolherLances(guarda, { max: L.fim, maxSegundos: L.fimMax, cronologica: true }, []);
  if (!ks.length) return false;
  F.mm = { lances: ks, i: 0, tocando: false, vistos: 0, pulou: false };
  hud.faixa(null);
  entrada?.limparPulsos();
  if (histPos.length) histPos[histPos.length - 1].mm = { lances: [...ks], vistos: 0, pulou: false, fim: false };
  return proximoMelhor();
}
/** O próximo lance dos melhores momentos; sem mais, a faixa volta. */
function proximoMelhor() {
  const F = cenaFim, mm = F?.mm;
  if (!mm) return false;
  while (mm.i < mm.lances.length) {
    const k = mm.lances[mm.i++];
    if (tocarLanceGuardado(k, aoFimMelhor)) { mm.tocando = true; mm.vistos++; if (histPos.length && histPos.at(-1).mm) histPos.at(-1).mm.vistos = mm.vistos; return true; }
  }
  fimMelhores(false);
  return false;
}
/** O fim (ou o pulo) de um lance dos melhores momentos: o pulo volta à faixa; senão o próximo no quadro seguinte. */
function aoFimMelhor(pulou) {
  const F = cenaFim;
  if (!F?.mm) return;
  F.mm.tocando = false;
  corteCamera = true;
  if (pulou) fimMelhores(true);
}
function fimMelhores(pulou) {
  const F = cenaFim;
  if (!F) return;
  if (histPos.length && histPos.at(-1).mm) { histPos.at(-1).mm.pulou = !!pulou; histPos.at(-1).mm.fim = true; }
  F.mm = null;
  if (F.tipo === 'fim' && F.geral) faixaFimCena();
}

/** Sigla, nome, escudo e as cores dos dois times (as tarjas e o painel das cenas). */
function timesDaCena() {
  return [0, 1].map(t => ({
    sigla: hud.times[t]?.sigla ?? '', nome: hud.times[t]?.nome ?? '', cor1: COR_TIME[t].cor, cor2: COR_TIME[t].texto,
    escudo: document.getElementById(`escudo-${t}`)?.getAttribute('href') ?? null,
  }));
}
/** A tarja do placar (cenas-tela.js): os times, o placar e os autores (sumula.js autoresPorTime; CENA_FIM.autores). */
function dadosPlacar(online = false) {
  const comAutores = MOD_CEN?.cfg.CENA_FIM.autores !== false;
  const aut = comAutores && sumula ? autoresPorTime(sumula) : null;
  const nome = id => { const f = id != null ? fichaDe(id) : null; return f ? (f.camisa ?? f.nome ?? String(id)) : ''; };
  return {
    times: timesDaCena(), gols: [mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0], online,
    autores: aut ? { 0: aut[0].map(a => ({ nome: nome(a.id), gols: a.gols })), 1: aut[1].map(a => ({ nome: nome(a.id), gols: a.gols })) } : null,
  };
}
/** O painel de estatísticas (sumula.js estatisticas; os itens de CENA_FIM.estatisticas): do 1º tempo ou da partida (null). */
function dadosEstatisticas(tempo = 1) {
  return { titulo: tempo === 1 ? '1º tempo' : 'Partida', times: timesDaCena(), itens: MOD_CEN.cfg.CENA_FIM.estatisticas.itens, valores: estatisticasDaSumula(sumula, tempo) };
}

/**
 * Começa a cena do intervalo (o mundo segurado no tick do 'intervalo': só cópias). Os lances do 1º tempo vêm do guardador
 * (lances-guarda.js escolherLances: os gols primeiro, depois a parada mais forte). Devolve false se não deu.
 */
function iniciarCenaFim(item) {
  if (item.tipo === 'fim') return iniciarPosJogo(item);
  const M = MOD_CEN;
  if (!M?.cf || !mundo.partida || mundo.partida.estado !== 'intervalo') return false;
  const ks = guarda ? M.lg.escolherLances(guarda, { tempo: 1, max: M.cfg.CENA_FIM.lances.intervalo }, []) : [];
  const planta = IDENT?.forma3d?.planta ?? null;
  const plano = M.cf.planejarFim(mundo, 'intervalo', {
    placar: mundo.placar, timeHumano: TIME_HUMANO, lances: ks.length,
    treinadores: tecnicos && tecVisiveis ? [treinadorDoTime(tecnicos, 0), treinadorDoTime(tecnicos, 1)] : null,
    ajustePlano: planta?.ajustarPlano ?? null, cameraGeral: planta?.cameraGeral ?? null,
  });
  cenaFim = {
    c: M.cf.criarCenaFim(plano, mundo), tipo: 'intervalo', tick: mundo.tick, botoes: entrada ? entrada.ler(yawEntrada()).botoes : 0,
    geral: false, rapido: false, lances: ks, iLance: 0, tocando: false, placar: dadosPlacar(), est: dadosEstatisticas(),
  };
  if (histFim.length < 16) histFim.push({ tick: mundo.tick, lances: [...ks], inicio: ultimoAgora, geral: null, fim: null, pulou: false });
  // (R6) o apito do intervalo não espera a cena acabar: o que o replay do gol do último lance adiou toca agora
  tocarAdiados();
  entrada?.limparPulsos();
  encerrarEfeitosGol();
  if (cam) cam.planoGeral(false);
  // (a faixa do expulso que a cena tira volta no 2º tempo)
  guardarFaixaExpulso();
  hud.cena(true, 'fim'); hud.cartao(null); hud.faixa(null);
  alfa = 1;
  corteCamera = true;
  return true;
}

/**
 * Começa a cena do pós-jogo (o mundo no tick do 'fimDeJogo': só cópias). O melhor em campo (sumula.js melhorEmCampo: a nota
 * do resultado do TM), a troca de camisa (?troca=0 tira), as estatísticas da partida (não no TM) e a versão curta no empate
 * que continua no TM (partida.empateContinua; sem o campo, todo empate no TM). Fora do online SEGURA o laço até a cena sair
 * (R5); no online não. Devolve false se não deu.
 */
function iniciarPosJogo(item) {
  const M = MOD_CEN;
  if (!M?.cf || !mundo.partida || mundo.partida.estado !== 'fim') return false;
  const g0 = mundo.placar?.[0] ?? 0, g1 = mundo.placar?.[1] ?? 0;
  const curto = !!TM && g0 === g1 && PEDIDO_TM?.partida?.empateContinua !== false;
  const melhor = sumula && !curto ? melhorEmCampo(sumula, mundo) : null;
  const planta = IDENT?.forma3d?.planta ?? null;
  const plano = M.cf.planejarFim(mundo, 'fimDeJogo', {
    placar: mundo.placar, timeHumano: TIME_HUMANO, curto, melhor, troca: TROCA_ON, estatisticas: !TM,
    treinadores: tecnicos && tecVisiveis ? [treinadorDoTime(tecnicos, 0), treinadorDoTime(tecnicos, 1)] : null,
    ajustePlano: planta?.ajustarPlano ?? null, cameraGeral: planta?.cameraGeral ?? null,
  });
  cenaFim = {
    c: M.cf.criarCenaFim(plano, mundo), tipo: 'fim', tick: mundo.tick, botoes: entrada ? entrada.ler(yawEntrada()).botoes : 0,
    geral: false, rapido: false, lances: [], iLance: 0, tocando: false, placar: dadosPlacar(), est: dadosEstatisticas(null),
    melhor: dadosMelhor(melhor), segura: !mundo.online, kitTroca: new Map(), mm: null,
  };
  if (histPos.length < 16) {
    histPos.push({ tick: mundo.tick, inicio: ultimoAgora, geral: null, pulou: false, planos: plano.planos.map(p => ({ ...p })), curto,
      melhor: melhor ? { ...melhor } : null, troca: plano.troca ? { ...plano.troca } : null, segura: !mundo.online, mm: null });
  }
  // (R6) o apito final não espera a cena: o que o replay do gol do último lance adiou toca agora
  tocarAdiados();
  entrada?.limparPulsos();
  encerrarEfeitosGol();
  if (cam) cam.planoGeral(false);
  hud.cena(true, 'posjogo'); hud.cartao(null); hud.faixa(null);
  alfa = 1;
  corteCamera = true;
  return true;
}

/** Um quadro da cena (fora da pausa): o pulo, o relógio dela, os lances, as tarjas, o estádio e a torcida. */
function quadroFim(dt, ent) {
  const F = cenaFim, c = F.c, M = MOD_CEN;
  // (o pós-jogo no plano geral: a faixa final com os botões — os apertos não são da cena; os melhores momentos: o próximo
  // lance quando o anterior acabou)
  const posGeral = F.tipo === 'fim' && F.geral;
  if (posGeral && F.mm && !F.mm.tocando && !(diretor && diretor.ativo)) proximoMelhor();
  if (!F.rapido && !posGeral) {
    if (M.cf.tempoCenaFim(c) < M.cfg.CENAS.pularDepois) F.botoes |= ent.botoes;
    else {
      // (o aperto que disparou fica marcado como visto: só vale de novo solto e apertado — antes o `&=` nunca o guardava e um
      // botão segurado, ou o pulso de um toque preso no online sem passo, avançava um bloco por QUADRO: do apito à faixa)
      const novos = ent.botoes & ~F.botoes;
      F.botoes = ent.botoes;
      if (novos) { proximoBlocoFim(); if (!cenaFim) return; }
    }
  }
  const t0 = performance.now(), k0 = c.k;
  if (!F.rapido) M.cf.avancarCenaFim(c, dt);
  // a torcida reage ao que a cena mostra (render/emocao.js cenaFim: palmas ou vaia pelo placar)
  M.cf.consumirEventosFim(c, _evFim);
  if (_evFim.length) {
    _ctxEmocao.t = tempoEstadio(); _ctxEmocao.bola = mundo.bola.p; _ctxEmocao.ataca = mundo.ataca;
    for (const ev of _evFim) emocaoEvento(emocao, ev, _ctxEmocao);
  }
  // segurando, o estádio anda no relógio do desenho; no geral do intervalo (e no pós-jogo do online) o laço solto anda o
  // relógio pelos passos
  if (seguraIntervalo()) estadioSegurado(dt);
  // o bloco dos lances: o próximo lance do guardador pelo diretor (o fim dele volta aqui: aoFimLanceFim)
  if (c.emLances && !F.tocando) tocarProximoLanceFim();
  if (!F.geral && M.cf.faseFim(c) === 'geral') entrarGeralFim();
  atualizarTarjasFim();
  const ms = performance.now() - t0;
  custoFim.n += c.k - k0; custoFim.ms += ms; mq.aCena += ms;
}
/** As tarjas da cena no relógio dela: o placar (CENA_FIM.placar) e as estatísticas (o plano delas). Fora dos lances. */
function atualizarTarjasFim() {
  const F = cenaFim;
  if (!telaCenas || !F) return;
  const c = F.c, cf = MOD_CEN.cf;
  telaCenas.placar(!F.rapido && cf.tarjaPlacarVisivel(c) ? F.placar : null);
  telaCenas.estatisticas(!F.rapido && cf.faseFim(c) === 'estatisticas' ? F.est : null);
  telaCenas.melhor(!F.rapido && F.melhor && cf.tarjaMelhorVisivel(c) ? F.melhor : null);
}
/** O plano de câmera da cena no quadro (cortes secos pelo nome); o vão das placas no plano do túnel. */
function cameraFim() {
  const opc = { pequena: Math.min(window.innerWidth, window.innerHeight) < 520, aspecto: window.innerWidth / window.innerHeight };
  MOD_CEN.cf.planoCameraFim(cenaFim.c, opc, planoCamFim);
  if (planoCamFim.nome === 'fim') return;
  if (vaoCenas) { if (planoCamFim.tunel) vaoCenas.abrir(); else vaoCenas.fechar(); }
  // a câmera de cinema nunca dentro de um treinador (os vivos ficam onde as cópias da cena estão)
  if (tecnicos) afastarDeTecnicos(planoCamFim.de, tecnicos, 0.6);
  cam.definirCinema(planoCamFim);
}
/** O próximo lance do guardador (tocarLanceGuardado: a fonte = o mini-anel; o aoFim volta à cena); sem mais, a cena segue. */
function tocarProximoLanceFim() {
  const F = cenaFim;
  while (F.iLance < F.lances.length) {
    const k = F.lances[F.iLance++];
    if (tocarLanceGuardado(k, aoFimLanceFim)) { F.tocando = true; return true; }
  }
  MOD_CEN.cf.seguirCenaFim(F.c);
  return false;
}
/** O fim (ou o pulo) de um lance da cena: volta a ela (R8) — o próximo lance no quadro seguinte, ou o bloco seguinte. */
function aoFimLanceFim(pulou) {
  const F = cenaFim;
  if (!F) return;
  F.tocando = false;
  // (o aperto que pulou o lance não pula também o bloco: ele só vale de novo solto e apertado)
  F.botoes = entrada ? entrada.ler(yawEntrada()).botoes : 0;
  if (F.iLance >= F.lances.length) MOD_CEN.cf.seguirCenaFim(F.c);
  corteCamera = true;
  void pulou;
}
/**
 * O próximo bloco (toque, Enter, um botão novo depois de CENAS.pularDepois): os planos de campo → os lances → as estatísticas
 * → o geral; no geral, a saída (pularFim). Um lance tocando é pulado pelo diretor (o ramo do replay no laço).
 */
function proximoBlocoFim() {
  const F = cenaFim;
  if (!F || F.rapido) return;
  const M = MOD_CEN.cf;
  if (M.tempoCenaFim(F.c) < MOD_CEN.cfg.CENAS.pularDepois) return;
  if (diretor && diretor.ativo && replayAoFim) { fimReplay(true); return; }
  // (o pós-jogo no plano geral: a faixa final — o toque é dos botões dela)
  if (F.tipo === 'fim' && F.geral) return;
  if (F.geral) { pularFim(); return; }
  if (F.c.emLances) F.iLance = F.lances.length;
  M.proximoBloco(F.c);
  if (M.faseFim(F.c) === 'geral') entrarGeralFim();
  atualizarTarjasFim();
  corteCamera = true;
}
/**
 * Pula para a saída do 2º tempo ("Pular" da cena): o plano geral, a cortina, e os passos do intervalo que faltam correm em
 * poucos quadros (COMEM.passosCortina por quadro) até a saída, que acaba a cena — o mesmo tick e o mesmo hash de sem ela.
 */
function pularFim() {
  const F = cenaFim;
  if (!F || F.rapido) return;
  if (MOD_CEN.cf.tempoCenaFim(F.c) < MOD_CEN.cfg.CENAS.pularDepois) return;
  // o pós-jogo: direto ao plano geral com a faixa final (o mundo continua parado no apito; nada corre por baixo)
  if (F.tipo === 'fim') {
    if (F.geral) return;
    if (diretor && diretor.ativo && replayAoFim) fimReplay(true);
    MOD_CEN.cf.pularParaGeral(F.c);
    if (histPos.length) histPos[histPos.length - 1].pulou = true;
    entrarGeralFim();
    corteCamera = true;
    if (entrada) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); entrada.limparPulsos(); }
    return;
  }
  // (um lance tocando sai sem o próximo)
  F.iLance = F.lances.length;
  if (diretor && diretor.ativo && replayAoFim) fimReplay(true);
  if (!cenaFim) return;
  MOD_CEN.cf.pularParaGeral(F.c);
  entrarGeralFim();
  F.rapido = true;
  if (histFim.length) histFim[histFim.length - 1].pulou = true;
  telaCenas?.placar(null); telaCenas?.estatisticas(null);
  hud.cortina();
  if (entrada) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); entrada.limparPulsos(); }
}
/** O plano geral: o laço solta (os 3 s do intervalo correm por baixo); o desenho continua o da cena (o campo vazio). */
function entrarGeralFim() {
  const F = cenaFim;
  if (!F || F.geral) return;
  F.geral = true;
  if (vaoCenas) vaoCenas.fechar();
  // o pós-jogo: a faixa final no plano geral (o HUD de sempre do fim volta: os botões dela recebem o toque); fora do online
  // o laço continua parado no apito (R5)
  if (F.tipo === 'fim') {
    hud.cena(false);
    telaCenas?.placar(null); telaCenas?.estatisticas(null); telaCenas?.melhor(null);
    faixaFimCena();
    if (histPos.length) histPos[histPos.length - 1].geral = { tick: mundo.tick, quando: ultimoAgora };
    return;
  }
  laco.ultimo = null;
  if (histFim.length) histFim[histFim.length - 1].geral = { tick: mundo.tick, quando: ultimoAgora };
}
/**
 * Fim da cena (a saída do 2º tempo chegou): corte seco para a câmera de TV, as tarjas saem, a bola e os treinadores vivos
 * voltam ao desenho e a fila anda. pulou: o aperto que pulou não vira jogada.
 */
function fimCenaFim(pulou) {
  if (!cenaFim) return;
  const F = cenaFim;
  cenaFim = null;
  if (histFim.length) histFim[histFim.length - 1].fim = { tick: mundo.tick, quando: ultimoAgora, rapido: F.rapido };
  hud.cena(false);
  telaCenas?.placar(null); telaCenas?.estatisticas(null);
  if (vaoCenas) vaoCenas.fechar();
  if (bola3d) bola3d.mesh.visible = true;
  if (cam) cam.definirCinema(null);
  corteCamera = true;
  if (entrada) {
    if (pulou) { entrada.soltarTudo(); entrada.bloquear?.(true); entrada.bloquear?.(false); }
    entrada.limparPulsos();
    entrada.reposicionar?.();
  }
  proximaCena();
}
/** A cena sai de vez sem andar a fila (mundo novo, "Simular o resto", "Jogar de novo"). */
function descartarFim() {
  if (cenaFim) {
    cenaFim = null;
    if (cam) cam.definirCinema(null);
    if (bola3d) bola3d.mesh.visible = true;
    entrada?.reposicionar?.();
    if (!cenaCartao) hud.cena(false);
  }
  intervaloAgora = false; fimJogoAgora = false; tarjaOnline = null;
  telaCenas?.placar(null); telaCenas?.estatisticas(null); telaCenas?.melhor(null);
  if (vaoCenas && !cenaCartao) vaoCenas.fechar();
}

// ------------------------------------------------------------------ replay
/**
 * Um quadro do replay, todo a partir do anel (do mundo só o placar e o relógio do HUD, que não mudam durante ele):
 * jogadores e bola interpolados no tick do replay, a rede re-balançando com o relógio do estádio gravado, a câmera do
 * plano, a linha de impedimento só no replay do impedimento. Sem anel do controlado, marcas nem barra de força.
 */
function desenharReplay(dt, agoraMs, renderizar = true) {
  const tq = performance.now();
  // a fonte do roteiro: o anel, ou o mini-anel de um lance guardado (com a rede dele: fonte.ondas)
  const fonte = diretor.fonte ?? anel, ondasR = fonte.ondas ?? ondas;
  const n = lerQuadro(fonte, diretor.tick, listaR, _bpR, _bqR, kitDoId);
  if (!n) { fimReplay(false); desenharQuadro(dt, agoraMs, renderizar); return; }
  // 1ª pessoa: o autor sem cabeça e tronco (o olho está dentro dela); parte 1 do treinador: ele fora da lista
  const dx = diretor.desenho();
  if (dx.ocultar != null) for (const it of listaR) if (it.id === dx.ocultar) it.ocultar = OCULTA.cabeca | OCULTA.tronco;
  const tEst = tempoEstadioAnel(fonte, diretor.tick);
  if (redeLigada) empurraoBola(ondasR, _bpR, tEst, _emp); else { _emp.x = 0; _emp.y = 0; _emp.z = 0; }
  _bpDes.x = _bpR.x + _emp.x; _bpDes.y = _bpR.y + _emp.y; _bpDes.z = _bpR.z + _emp.z;
  _qR.set(_bqR.x, _bqR.y, _bqR.z, _bqR.w);
  bola3d.atualizar(_bpDes, _qR);
  uniformsRede(ondasR, redeLigada ? tEst : -1e9, campo.rede.a, campo.rede.b);
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
  if (bp.tela) bp.tela.esconder();
  linhaImped.mostrar(diretor.linha(dt));
  linhaImped.mostrarSaot(sc.ativa ? sc : null);
  hud.terco(sc.ativa && sc.decidido ? sc : null);
  // a arquibancada do lado de cá (e a torcida dela) some/aparece pela câmera do replay, como no jogo pela da TV
  campo.atualizar(agoraMs / 1000, diretor.camera, renderizar);
  torcida.atualizar(agoraMs / 1000, emocao, diretor.camera, som ? som.relogioBatida : null, renderizar);
  if (som) som.atualizar(emocao, pausado(), agoraMs / 1000);
  hud.carga(null); hud.cartao(null);
  hud.placar(mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0);
  hud.relogio(mundo.partida && !mundo.disputa && !mundo.livre ? lerRelogio() : null);
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

/**
 * Começa um replay (roteiro do diretor). Devolve false se não deu (sem diretor, roteiro vazio, fora da partida). opc.fonte:
 * de onde ele toca (padrão: o anel; o mini-anel de um lance guardado — render/lances-guarda.js tocar); opc.aoFim(pulou): o
 * replay de DENTRO de uma cena (os lances do intervalo, os "Melhores momentos") volta a ela no fim ou no pulo, em vez de
 * andar a fila (proximaCena), que tiraria o jogador da cena (R8).
 */
function iniciarReplay(ro, opc = {}) {
  if (!diretor || !ro || !mundo.partida) return false;
  // o replay de dentro de uma cena tocando (com aoFim): outro sem aoFim não o corta — a cena esperaria um fim que não vem
  if (diretor.ativo && replayAoFim && !opc.aoFim) return false;
  if (!diretor.iniciar(ro, opc.fonte ?? anel)) return false;
  replayAoFim = opc.aoFim ?? null;
  // o que já está segurado não pula (só um aperto novo); os apertos curtos já vistos não contam
  entrada?.limparPulsos();
  replayBotoes = entrada ? entrada.ler(yawEntrada()).botoes : 0;
  // o O/RB segurado como PEGAR vira PRESSÃO quando a fase vira defesa (entrada.js RELE_NA_DEFESA) — no apito do
  // impedimento do meu time isso acontece no quadro seguinte ao começo do replay: o mesmo botão segurado não é aperto novo
  // (sem isto o replay sumia sozinho; teste-replay C9). Solto, o bit sai de replayBotoes (botaoPula) e o aperto novo pula
  if (replayBotoes & BOTAO.PEGAR) replayBotoes |= BOTAO.PRESSAO;
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
  // o guardador de lances: o gol entra aqui com ou sem replay (tratarEvento já chamou na saída, no intervalo e no fim)
  guardarGolPendente();
  const ro = diretor ? diretor.depoisDoGol() : null;
  const ok = replayAuto && iniciarReplay(ro);
  // (o replay automático do gol conta no espaço dos replays de parada: nunca dois seguidos)
  if (ok && lances) registrarReplay(lances, mundo.tick, 'gol');
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
  // o replay de dentro de uma cena volta a ela (sem a fila)
  const af = replayAoFim;
  replayAoFim = null;
  if (af) { af(pulou); return; }
  // a fila: a cena de substituição (gol + troca na mesma parada: depois do replay INTEIRO), as faixas; vazia, os sons
  proximaCena();
  talvezFaixaExpulso();
}

// ------------------------------------------------------------------ replays nas paradas (lances.js)
/**
 * Depois de cada passo da partida (rodarPasso): o classificador lê os eventos; o lance da bola morta que passa no teto e no
 * espaço (decidirReplay) fica ARMADO — nunca pela API dos testes (rodarPassos) nem com os replays de parada desligados.
 * Gol, intervalo, fim e recomeço desarmam (a parada do lance acabou sem a montagem dele).
 */
function passoLances(eventos) {
  const l = lancesPasso(lances, mundo, eventos);
  if (replayParada) for (const e of eventos) {
    const t = e.tipo;
    if (t === 'gol' || t === 'intervalo' || t === 'fimDeJogo' || t === 'recomeco' || t === 'saida') { replayParada = null; break; }
  }
  if (l && !emRodarPassos && mundo.partida && decidirReplay(lances, l, { tempo: mundo.partida.tempo, ligado: replayParadaLigado() })) {
    // (o lance é o objeto reaproveitado do classificador: o armado é uma cópia)
    replayParada = { ...l, ids: [...l.ids] };
  }
  // o guardador de lances: toda parada A/B, com ou sem replay (aceito, no teto ou desligado), entra no passo antes da
  // montagem (guardarParadaPendente), quando a janela até o desfecho + 0,5 s já está gravada (R9)
  if (l && mundo.partida) lanceGuardar = { ...l, ids: [...l.ids], tempo: mundo.partida.tempo };
}

/**
 * O gol pendente (golGuardar) entra no guardador de lances — no posGol() e nos passos que o chamam (a saída, o intervalo, o
 * fim), com ou sem replay. Sem o módulo (SOB.cenas), pede e guarda quando chegar (guardarLance).
 */
function guardarGolPendente() {
  const g = golGuardar;
  if (!g) return;
  golGuardar = null;
  guardarLance(g);
}

/**
 * A parada classificada (lanceGuardar) entra no guardador no passo ANTES da montagem (lances.js montaNoProximoPasso: também
 * o fim do tempo), o mesmo ponto do replay de parada (seguraParaReplayParada chama isto no topo), com ou sem replay. A parada
 * que acabou sem a montagem dela (mundo novo, gol): esquece.
 */
function guardarParadaPendente() {
  const lc = lanceGuardar;
  if (!lc) return;
  const m = mundo, pr = m.parada;
  if (!lances || !m.partida || m.partida.estado !== 'parada' || !pr || pr.inicio !== lc.morta || pr.cobrador != null) { lanceGuardar = null; return; }
  if (!montaNoProximoPasso(m)) return;
  lanceGuardar = null;
  guardarLance(lc);
}

/**
 * Guarda o lance (o gol ou a parada) agora; sem o módulo baixado (cartão, gol antes da pré-carga), pede o SOB.cenas e
 * guarda quando chegar — se ainda for o mesmo mundo e a janela ainda estiver no anel (guardar com `inteira`; o fim dela
 * fica no fim do anel de agora: o que veio depois não é do lance).
 */
function guardarLance(l) {
  if (!lances) return;
  if (MOD_CEN) { guardarAgora(l, false); return; }
  const m0 = mundo, lc = { ...l, ateMax: Math.min(l.ateMax ?? Infinity, anel.ultimo) };
  carregarSobDemanda('cenas').then(() => { if (mundo === m0 && lances && MOD_CEN) guardarAgora(lc, true); }, () => {});
}
/**
 * A memória do guardador e do mini-anel (~5,7 MB), uma vez: na PARTIDA, quando o módulo chega (SOB.cenas) ou quando a partida
 * começa com ele já baixado (R20: a pré-carga roda também nos treinos — lá nada é alocado), e não no meio de um lance.
 */
function garantirGuarda() {
  if (!MOD_CEN || !lances) return;
  guarda ??= MOD_CEN.lg.criarGuarda(MOD_CEN.cfg.LANCES_GUARDA, { vagas: anel.vagas, nj: NJ });
  miniLance ??= MOD_CEN.lg.criarMini(guarda);
}
/** Os lances guardados (cópias, na ordem em que entraram: lances-guarda.js listar); [] sem o guardador. */
function lancesGuardados() { return guarda ? MOD_CEN.lg.listar(guarda) : []; }
/**
 * Toca o lance guardado k pelo diretor do replay — para a cena do intervalo (os lances do 1º tempo) e a do fim ("Melhores
 * momentos"; a escolha: lances-guarda.js escolherLances): descomprime no mini-anel (tocar), o roteiro do lance (um plano
 * 'tv' 1×: roteiroLance) e o replay com a fonte = o mini-anel; aoFim(pulou) no fim ou no pulo, sem andar a fila (R8). A
 * simulação fica parada enquanto ele toca (o ramo do diretor no laço). Devolve false se não deu (sem o guardador ou o
 * diretor, outro replay tocando, fora da partida, a vaga vazia).
 */
function tocarLanceGuardado(k, aoFim = null) {
  if (!guarda || !miniLance || !diretor || diretor.ativo || !mundo.partida) return false;
  const mt = MOD_CEN.lg.tocar(guarda, k, miniLance);
  if (!mt) return false;
  return iniciarReplay(diretor.lance(miniLance, mt), { fonte: miniLance, aoFim });
}
function guardarAgora(l, inteira) {
  garantirGuarda();
  const t0 = agoraMs();
  const k = MOD_CEN.lg.guardar(guarda, anel, l, batidasRede, { inteira });
  if (histGuarda.length < 64) histGuarda.push({ tick: mundo.tick, tipo: l.tipo, classe: l.classe, chave: l.chave, fim: l.fim, k, ms: agoraMs() - t0, tarde: inteira });
}

/**
 * O TOPO de cada volta do laço (antes da entrada da demo, que escreve no mundo, e no online antes de MOD_ON.podePassar /
 * entradas, que consomem a fila): com um replay de parada armado e o PRÓXIMO passo montando a bola parada (ou acabando o
 * tempo: o replay vem antes do intervalo/fim), o replay começa e a volta para sem rodar o passo — a simulação fica no
 * tick da espera e segue no mesmo tick quando ele acaba (o hash é o mesmo com e sem ele). A parada do lance que acabou
 * sem montagem (mundo novo, gol...), os replays desligados ou o replay ainda não baixado: desarma sem segurar. Devolve
 * true se o replay começou.
 */
function seguraParaReplayParada() {
  // o guardador de lances no mesmo ponto (com ou sem replay)
  if (lanceGuardar) guardarParadaPendente();
  const lc = replayParada;
  if (!lc) return false;
  const m = mundo, pr = m.parada;
  if (!lances || !m.partida || m.partida.estado !== 'parada' || !pr || pr.inicio !== lc.morta || pr.cobrador != null || !replayParadaLigado()) {
    replayParada = null; talvezFaixaExpulso(); return false;
  }
  if (!montaNoProximoPasso(m)) return false;
  replayParada = null;
  if (!diretor || !iniciarReplay(diretor.parada(lc))) { talvezFaixaExpulso(); return false; }
  registrarReplay(lances, m.tick, 'parada');
  // a faixa "Você foi expulso" desta bola morta espera o replay (e a cena do cartão, que veio antes): aparece depois dele
  // (fimReplay → proximaCena), com os 6 s contando dali
  if (expulsoPendente && lc.morta === expulsoTick) { expulsoPendente = false; filaCenas.push(faixaExpulso); }
  if (histParadas.length < 64) histParadas.push({ tick: m.tick, morta: lc.morta, chave: lc.chave, classe: lc.classe, tipo: lc.tipo, dur: diretor.estado.duracao, cams: diretor.estado.cams });
  return true;
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
    if (mundo.online && PAG_ONLINE) PAG_ONLINE.enviarPacote(agoraMs, 0);
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
  if (mundo.online && PAG_ONLINE) quadroOnline(dt, ent, agoraMs);
  else if (cenaSub) {
    // cena de substituição: a simulação fica parada (como no replay; o laço não recupera o tempo); pausa, aba escondida e
    // celular em pé congelam a cena (ela volta de onde parou); um aperto novo depois de 0,5 s pula
    laco.ultimo = agoraMs;
    if (!pausado() && !pausaTeste && !document.hidden) quadroSubst(dt, ent);
  } else if (cenaCartao) {
    // cena do cartão: a simulação fica PARADA no tick do cartão (nenhum passo, nenhuma entrada vai ao mundo; o laço não
    // recupera o tempo); o estádio anda no relógio do desenho; pausa, aba escondida e celular em pé congelam a cena; um
    // aperto novo depois de 0,5 s pula
    laco.ultimo = agoraMs;
    if (!pausado() && !pausaTeste && !document.hidden) {
      quadroCartao(dt, ent);
      // (sem passos, ninguém mais limpa o aperto curto: um toque antes de 0,5 s ficaria preso e o aperto novo depois não
      // seria novo)
      entrada.limparPulsos();
    }
    alfa = 1;
  } else if (diretor && diretor.ativo) {
    // replay: a simulação fica parada (como na pausa; o laço não recupera o tempo); um aperto novo pula
    laco.ultimo = agoraMs;
    if (!pausado()) {
      // (um lance da cena do intervalo ou dos melhores momentos do pós-jogo: o estádio anda no relógio do desenho, como na
      // cena — com o laço segurado)
      if (seguraIntervalo()) estadioSegurado(dt);
      if (botaoPula(ent.botoes)) fimReplay(true);
      else if (!diretor.avancar(dt)) fimReplay(false);
    }
  } else if (seguraIntervalo()) {
    // cena do intervalo antes do plano geral (e a do pós-jogo fora do online, até sair): a simulação fica PARADA no tick do
    // 'intervalo' / do 'fimDeJogo' (nenhum passo, nenhuma entrada vai ao mundo; o laço não recupera o tempo); o estádio
    // anda no relógio do desenho; pausa, aba escondida e celular em pé congelam a cena; um aperto novo depois de 0,5 s vai
    // ao próximo bloco
    laco.ultimo = agoraMs;
    if (!pausado() && !pausaTeste && !document.hidden) {
      quadroFim(dt, ent);
      entrada.limparPulsos();
    }
    alfa = 1;
  } else if (pausado() || pausaTeste) {
    laco.ultimo = agoraMs;     // ao voltar, não tenta recuperar o tempo parado
    // o aperto feito com o jogo parado não fica guardado para o 1º passo depois da pausa
    if (pz) entrada.limparPulsos();
  } else {
    // comemoração: anda no relógio do desenho (um aperto novo depois de 0,5 s pula)
    if (cenaGol) quadroComemoracao(dt, ent);
    // o plano geral da cena do intervalo (o laço solto: os 3 s do intervalo correm por baixo, a saída acaba a cena)
    if (cenaFim) quadroFim(dt, ent);
    const r = avancarLaco(laco, agoraMs);
    // cortina (a comemoração pulada antes da hora; o intervalo pulado): os passos que faltam até a saída,
    // COMEM.passosCortina por quadro
    const fimRapido = !!cenaFim && cenaFim.rapido;
    const nPassos = (cenaGol && cenaRapida) || fimRapido ? Math.max(r.passos, COMEM.passosCortina) : r.passos;
    let segurou = false;
    for (let i = 0; i < nPassos; i++) {
      // a cena rodando segura a montagem da saída: a simulação espera no passo gol + 149
      if (seguraSimulacao()) { segurou = true; break; }
      // o cartão que saiu no gol (vantagem): a cena dele começa no gol + 149, depois da comemoração — também na cortina,
      // que para ali (ANTES da entrada da demo: o tick da espera fica intocado)
      if (cartaoGolNoPonto()) break;
      // o replay de parada armado começa no passo antes da montagem: a volta para sem rodar o passo (ANTES da entrada da
      // demo, que escreve no mundo: o tick da espera fica intocado)
      if (seguraParaReplayParada()) break;
      // a cena do intervalo segura no tick do 'intervalo' até o plano geral (também ANTES da entrada da demo)
      if (seguraIntervalo()) { segurou = true; break; }
      // durante a cena o humano assiste: a entrada dele não vai para a simulação (a demo segue) — também no plano geral da
      // cena do intervalo, com o laço solto (os apertos ali são da cena: o próximo bloco, o pulo)
      // do 2º passo do quadro em diante o analógico é a MESMA leitura (sim.js aplicarEntrada: `repete` — um gesto que
      // pulou no passo anterior ainda não acabou de ser lido)
      ent.repete = i > 0;
      // (o travado do TM expulso: ninguém do time é dele — a entrada não vai para o mundo)
      const e = DEMO_ON ? (entradaDemoDoMundo(mundo) ?? ent) : cenaGol || cenaFim || expulsoAvisado || golNeutroAgora() ? ENTRADA_NEUTRA : ent;
      let ac = filaAcoes.length ? filaAcoes.splice(0) : null;
      // a edição do time entra ANTES das outras ações, no 1º passo depois da pausa (e a mudança de jogadores do Livre)
      if (edicaoNaFila) { ac = ac ? [edicaoNaFila, ...ac] : [edicaoNaFila]; edicaoNaFila = null; }
      { const al = PAG_LIVRE?.tirarDaFila(); if (al) ac = ac ? [al, ...ac] : [al]; }
      // o que este passo vê dos botões (o reaperto entre dois passos vira solto + apertado: entrada.js). ANTES do passo:
      // o replay que começa dentro dele (impedimento, gol na saída) limpa isso (limparPulsos) — depois, a tecla
      // segurada no apito ficava como "vista" o replay inteiro e não pulava mais
      entrada.passoUsou(e.botoes);
      rodarPasso(e, ac);
      // o aperto curto (tocou e soltou entre dois passos) já foi visto por um passo
      if (i === 0) { entrada.limparPulsos(true); ent.botoes = entrada.ler(yawEntrada(), agoraMs).botoes; }
      // o replay (gol, impedimento), a cena de substituição, a do cartão ou a do intervalo começou neste passo: os passos que
      // sobraram não rodam (a simulação espera)
      if ((diretor && diretor.ativo) || cenaSub || cenaCartao || seguraIntervalo()) break;
      // a cortina acabou na saída (a cena saiu): o resto do quadro é do laço normal
      if (i >= r.passos - 1 && !cenaGol && !(cenaFim && cenaFim.rapido)) break;
    }
    // segurando, o laço não acumula o tempo parado (e o desenho da simulação fica no passo mais novo); a cena do cartão
    // e a do intervalo que começaram agora também
    if (segurou || cenaCartao || seguraIntervalo()) { laco.acum = Math.min(laco.acum, laco.passo / 2); alfa = 1; } else alfa = r.alfa;

  }
  // a faixa ENTRA/SAI no relógio do laço (na cena, a página do plano; no jogo, pelo tempo)
  hud.faixaSubstQuadro(agoraMs, cenaSub ? infoFaixaCena() : null);
  // em pé no celular a tela "Gire o celular" cobre tudo: não gasta bateria desenhando por baixo
  if (diretor && diretor.ativo && !cenaSub && !cenaCartao) desenharReplay(dt, agoraMs, desenhar && !retratoBloqueado());
  else desenharQuadro(dt, agoraMs, desenhar && !retratoBloqueado());
  medirQps(dtReal, agoraMs);
  adaptarQualidade(dtReal, agoraMs);
}

/**
 * Online 1×1 (contrato "Online 1×1"): o laço pela sessão (online.js). Só roda o passo com as DUAS entradas dele; a minha
 * lida agora vale para o passo n + D. O que é local — o replay, a comemoração, a minha pausa, o celular em pé — só segura
 * a MINHA simulação (sem passo, sem entrada nova): o outro espera sozinho ("Aguardando…"). Menu, Ajuda e o editor
 * abertos NÃO param o jogo: a minha entrada vai com o bit IA (a IA joga pelo meu controlado, nos dois aparelhos). Um
 * pacote por quadro; o hash do mundo a cada 60 passos (dessincronia).
 */
let dtMedioOn = PASSO;
// testes do online sem pessoa (?online=…&ia=1): a IA joga pelo meu controlado o tempo todo (o bit IA)
const IA_ONLINE_TESTE = ONLINE_BC && params.get('ia') === '1';
const trintaQps = () => dtMedioOn > 0.025;
function quadroOnline(dt, ent, agoraMs) {
  const s = PAG_ONLINE.s;
  dtMedioOn += (dt - dtMedioOn) * 0.05;
  const segPausa = PAG_ONLINE.quadro(agoraMs, { fim: mundo.partida?.estado === 'fim' });
  let segura = segPausa || retratoBloqueado() || PAG_ONLINE.encerrado;
  if (diretor && diretor.ativo) {
    segura = true;
    if (botaoPula(ent.botoes)) fimReplay(true);
    else if (!diretor.avancar(dt)) fimReplay(false);
  } else if (cenaGol && !segura) quadroComemoracao(dt, ent);
  // a cena do pós-jogo (no online NÃO segura: o lockstep segue andando o tick do 'fim'; a cena só usa cópias — R5)
  else if (cenaFim && !segura) quadroFim(dt, ent);
  let quer = 0, rodou = 0, segurou = false;
  if (!segura) {
    const r = avancarLaco(laco, agoraMs);
    quer = MOD_ON.passosDoQuadro(s, r.passos, agoraMs);
    alfa = r.alfa;
  } else laco.ultimo = agoraMs;
  const ia = IA_ONLINE_TESTE || hud.menuAberto || hud.ajudaAberta || !!editor?.aberto;
  for (let i = 0; i < quer; i++) {
    // a comemoração rodando segura a montagem da saída (como fora do online: só a MINHA simulação espera)
    if (seguraSimulacao()) { segurou = true; break; }
    // o replay de parada (só o MEU lado espera; antes de podePassar/entradas: nada da fila é consumido) — segurou: o
    // marcarParado não conta a espera como "esperando o outro"
    if (seguraParaReplayParada()) { segurou = true; break; }
    if (!MOD_ON.podePassar(s)) break;
    const { e, acoes } = MOD_ON.entradas(s);
    rodarPasso(e, acoes);
    MOD_ON.passou(s);
    MOD_ON.ajustarAtraso(s, trintaQps());
    const n = s.n - 1;
    if (n % MOD_ON.HASH_CADA === 0) { const h = hashMundo(mundo); MOD_ON.registrarHash(s, n, h); PAG_ONLINE.enviarControle({ tipo: 'hash', n, h }); }
    // a minha entrada do passo n + D (a leitura do quadro; do 2º passo em diante a mesma leitura: `repete`) e, se o
    // editor entregou, a edição do MEU time (vai pelo canal confiável, marcada na entrada)
    const acao = edicaoNaFila && edicaoNaFila.time === TIME_HUMANO ? edicaoNaFila : null;
    edicaoNaFila = null;
    const minha = ia ? { x: 0, z: 0, botoes: 0, ia: true } : { x: ent.x, z: ent.z, mx: ent.mx, mz: ent.mz, botoes: ent.botoes, repete: i > 0 };
    entrada.passoUsou(minha.botoes);
    const nProd = MOD_ON.produzir(s, minha, acao);
    if (acao) PAG_ONLINE.enviarControle({ tipo: 'acao', n: nProd, acao });
    if (i === 0) { entrada.limparPulsos(true); ent.botoes = entrada.ler(yawEntrada(), agoraMs).botoes; }
    rodou++;
    if ((diretor && diretor.ativo) || cenaSub || cenaCartao) break;
  }
  const parado = quer > 0 && rodou === 0 && !segurou;
  MOD_ON.marcarParado(s, parado, agoraMs);
  // parado esperando o outro: o tempo parado não é recuperado depois (correr para alcançar gasta a folga do atraso D)
  if (parado || segurou) { laco.acum = Math.min(laco.acum, laco.passo / 2); if (segurou) alfa = 1; }
  PAG_ONLINE.enviarPacote(agoraMs, (trintaQps() ? MOD_ON.E_30QPS : 0) | (ia ? MOD_ON.E_MENU : 0));
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
  campo.definirQualidade(qAtual);
  const sombras = QUALIDADE[qAtual].sombras;
  bola3d.definirSombras(sombras);
  jog3d.definirSombras(sombras);
  redimensionar();
  hud.definirEstado({ qualidadeEscolha: escolhaQ, qualidadeAtual: qAtual });
}

function redimensionar() {
  const w = window.innerWidth, h = window.innerHeight;
  cena3d.redimensionar(w, h);
  campo?.definirAlturaTela(h);
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
  // cartão: o mesmo (a pausa congela a cena)
  if (cenaCartao && !pausado() && a !== 'qps' && a !== 'pausa') { pularCartao(); return; }
  // intervalo e pós-jogo: qualquer ação MENOS a pausa (a pausa congela a cena e tem o "Editar time" / o "Voltar ao Total
  // Match") vai ao próximo bloco — menos na faixa final do pós-jogo (as ações de sempre)
  if (cenaFim && !(cenaFim.tipo === 'fim' && cenaFim.geral) && !pausado() && a !== 'qps' && a !== 'pausa') { proximoBlocoFim(); return; }
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
  // (no Livre a C/R3 passa pelas 6 câmeras dele)
  if (a === 'camera') { comando('camera', mundo.livre ? 'proxima' : cam.modo === 'tv' ? 'aproximada' : 'tv'); return; }
  // Modo Livre: R = a bola no pé do controlado
  if (mundo.livre && a === 'recomecar') { filaAcoes.push({ tipo: 'livreRecomecar', onde: 'pe' }); hud.evento('recomecar'); return; }
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
  // o Livre também; ele entra com a pausa aberta no submenu Jogadores (o "Jogar" começa)
  if (v === 'livre' && !MOD_LIVRE) { carregarLivre().then(() => trocarModo(v)).catch(() => {}); return; }
  modoPagina = v;
  try {
    const u = new URL(location.href);
    if (v === 'partida') u.searchParams.delete('modo'); else u.searchParams.set('modo', v);
    history.replaceState(null, '', u);
  } catch (_) { /* sem history (arquivo local): segue */ }
  trocarMundo(novoMundo(), { prejogo: v === 'partida' ? 'preferencia' : null });
  if (v === 'livre' && !PRINTS && !DEMO_ON) paginaLivre().abrirJogadores();
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
  // online: o curto (ou menos, se a preferência for menos) — o outro espera o pré-jogo mais longo dos dois
  if (ONLINE) return prefs.prejogo === 'desligado' || prefs.prejogo === 'escalacao' ? prefs.prejogo : 'curto';
  return PREJOGO.modos.includes(prefs.prejogo) ? prefs.prejogo : 'completo';
}
const NOME_PREJOGO = { completo: 'completo', curto: 'curto', escalacao: 'só escalação', desligado: 'desligado' };
function marcarPrejogo() {
  const v = PREJOGO.modos.includes(prefs.prejogo) ? prefs.prejogo : 'completo';
  const e = document.getElementById('estado-prejogo');
  if (e) e.textContent = NOME_PREJOGO[v];
}
/** O rótulo da opção "Cenas" (ligadas | desligadas); no online, desligadas (só o ícone de hoje). */
function marcarCenas() {
  const e = document.getElementById('estado-cenas');
  if (e) e.textContent = cenasLigadas() ? 'ligadas' : 'desligadas';
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
  if (TM && mundo.livre) return { livre: { placar: [mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0] } };
  return TM && sumula ? resultadoTM(sumula, mundo, TM.mapa) : null;
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
  // (o replay de parada armado não toca: o fim zera o classificador — iniciarEstados)
  replayParada = null;
  // (a faixa "Você foi expulso" que esperava o fim do replay não volta: o fimReplay abaixo andaria a fila)
  const iFx = filaCenas.indexOf(faixaExpulso);
  if (iFx >= 0) filaCenas.splice(iFx, 1);
  // (a faixa que esperava a cena do cartão ou o replay também não: o fim do "Simular o resto" mostra a faixa do fim)
  expulsoPendente = false;
  // (o replay de dentro de uma cena não volta a ela; os lances pendentes do guardador não entram: o fim zera o guardador —
  // iniciarEstados)
  replayAoFim = null; golGuardar = null; lanceGuardar = null;
  if (diretor && diretor.ativo) fimReplay(false);
  encerrarComemoracao();
  if (cenaSub) { cenaSub = null; if (cam) cam.definirCinema(null); }
  // a cena do cartão em andamento, a da vantagem que esperava o gol + 149 e a tarja saem (sem andar a fila: R21); a do
  // intervalo e as tarjas dela também
  descartarCartao();
  descartarFim();
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
      sumulaPasso(sumula, mundo, ev);
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
    else hud.faixa({ titulo: 'Fim de jogo', placar: textoPlacar(), botao: true, botaoTexto: 'Voltar ao Total Match', botaoCmd: 'voltar-tm', final: true });
    ok(r);
  };
  requestAnimationFrame(fatia);
  return promessa;
}
/** "Voltar ao Total Match": manda o resultado (tm3d:fim); antes do apito final, simula o resto primeiro. */
function voltarAoTM() {
  if (!TM) return;
  if (mundo.online) { fimTM(resultadoAtualTM(), { online: { hashFinal: hashMundo(mundo) >>> 0 } }); return; }
  // Modo Livre: volta já, sem simular nem resultado
  if (mundo.livre) { fimTM(resultadoAtualTM()); return; }
  if (mundo.partida?.estado === 'fim') { fimTM(resultadoAtualTM()); return; }
  simularResto().then(r => { if (r) fimTM(r); });
}

// Modo Livre: a parte da página (livre-pagina.js; pausa mínima — o acabamento e a Câmera do Livre entram depois)
function paginaLivre() {
  PAG_LIVRE ??= MOD_PAG_LIVRE.criarPaginaLivre({
    hud, logica: MOD_LIVRE, mundo: () => mundo, timeHumano: TIME_HUMANO, pedidoLivre: LIVRE_TM ? PEDIDO_TM?.livre ?? null : null,
    comando, acao: a => filaAcoes.push(a), soltar: () => entrada?.soltarTudo(),
    // a câmera do Livre (render/camera-livre.js): a da página, as prefs, o rumo do ataque do meu time e ?camera=
    camera: () => cam, prefs, salvarPrefs, dirAtaque: () => mundo.ataca?.[TIME_HUMANO] ?? 1, cameraPedida: params.get('camera'),
    cena: () => cena3d?.cena,
  });
  return PAG_LIVRE;
}
/** O "N contra M" da linha Modo Livre do "Modo de jogo" sem o módulo (a última escolha salva). */
function rotuloModoLivre() {
  const el = document.getElementById('estado-modo-livre');
  if (!el || PAG_LIVRE) return;
  try {
    const e = JSON.parse(localStorage.getItem('golaco.livre.v1') || 'null');
    const t = k => (e?.linha?.[k] ?? 4) + (e?.goleiro?.[k] === false ? 0 : 1);
    if (e) el.textContent = `${t(0)} contra ${t(1)}`;
  } catch (_) { /* sem armazenamento */ }
}

function comando(c, v) {
  // Modo Livre: o submenu Jogadores e os recomeços (livre-pagina.js)
  if (c.startsWith('livre-')) { PAG_LIVRE?.comando(c, v); return; }
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
      // um lance da cena tocando (o intervalo, o fim: iniciarReplay com aoFim): a pausa fica aberta, o lance segue depois dela
      if (diretor.ativo && replayAoFim) break;
      // pedido na espera da bola morta: o lance da parada armada já está nele — o automático não repete a jogada
      if (replayParada && mundo.parada?.inicio === replayParada.morta && mundo.parada.cobrador == null) replayParada = null;
      hud.fecharMenu();
      // com a cena de substituição rodando, o replay espera ela acabar (ou ser pulada): antes ele começava por baixo dela,
      // invisível, e a classe em-replay escondia a faixa ENTRA/SAI a cena inteira (contraprova de 14/10)
      if (cenaSub || cenaCartao) { filaCenas.unshift({ tipo: 'replay', ro }); break; }
      // na cena do intervalo, o replay toca DENTRO dela e volta a ela no fim (como um lance do guardador: R8)
      if (cenaFim) { iniciarReplay(ro, { aoFim: () => { corteCamera = true; if (cenaFim) cenaFim.botoes = entrada ? entrada.ler(yawEntrada()).botoes : 0; } }); break; }
      iniciarReplay(ro);
      break;
    }
    case 'replay-pular': if (diretor?.ativo) fimReplay(true); break;
    case 'comemoracao-pular': pularComemoracao(); break;
    case 'substituicao-pular': pularSubst(); break;
    // a camada das cenas: o "Pular" (no intervalo, a saída do 2º tempo), o toque na camada (no intervalo, o próximo bloco; no
    // cartão, o pulo) e o botão da pausa (o intervalo, só com toque)
    case 'cena-pular': if (cenaFim) pularFim(); else pularCartao(); break;
    case 'cena-toque': if (cenaFim) proximoBlocoFim(); else pularCartao(); break;
    case 'cena-menu': entrada?.soltarTudo(); hud.abrirMenu(); break;
    // a faixa final do pós-jogo: os lances do guardador (o Pular volta à faixa)
    case 'melhores-momentos': iniciarMelhores(); break;
    case 'cenas-ciclo':
      // "Modo de jogo" → "Cenas": ligadas ↔ desligadas (desligadas = o ícone do cartão de hoje); salvo
      cenasPref = !cenasLigadas();
      prefs.cenas = cenasPref; salvarPrefs(prefs);
      marcarCenas();
      break;
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
      // Modo Livre: as 6 câmeras dele (livre-pagina.js; o rumo fixo do ataque do meu time vem pelo cam.yaw)
      if (mundo.livre && PAG_LIVRE?.camera(v)) break;
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
// ---- rostos reais (edição pro do TM): o perfil de cada jogador do pedido e o índice das texturas
const LIGAS_ROSTOS = ['br'];
const slugTM = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
function ligarRostosReais() {
  const base = new URL('../assets/rostos-reais/', import.meta.url);
  Promise.all(LIGAS_ROSTOS.map(l => fetch(new URL(l + '.json', base)).then(r => (r.ok ? r.json() : {})).catch(() => ({})).then(t => [l, t])))
    .then(listas => {
      const indice = {}, ligaDe = {};
      for (const [l, t] of listas) for (const [k, v] of Object.entries(t)) { indice[k] = v; ligaDe[k] = l; }
      if (!Object.keys(indice).length) return;
      const cache = new Map();
      const perfil = id => {
        if (cache.has(id)) return cache.get(id);
        const e = TM.mapa?.[id];
        let r = null;
        if (e) {
          const t = e.lado === 1 ? PEDIDO_TM.away : PEDIDO_TM.home;
          const p = t?.players?.find(q => q.tmId === e.tmId);
          if (p) {
            const fim = `${slugTM(t.name)}__${slugTM(p.nomeCompleto || p.name)}`;
            const chave = LIGAS_ROSTOS.map(l => `${l}-${fim}`).find(k => indice[k]) ?? null;
            r = { chave, num: p.num ?? null };
          }
        }
        cache.set(id, r);
        return r;
      };
      // a textura de cada um mora na pasta da liga dele: o índice leva a chave já com a liga ("br-...")
      const pastas = {};
      for (const l of LIGAS_ROSTOS) pastas[l] = new URL(l + '/', base);
      jog3d.definirPerfis(perfil, { indice, base: pastas.br, ligaDe });
    });
}

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
  // online: a sessão e o transporte ANTES do 'tm3d:pronto' (o TM entrega a porta em resposta a ele)
  if (ONLINE && !PAG_ONLINE) {
    const on = ONLINE_TM ? PEDIDO_TM.online : null;
    PAG_ONLINE = MOD_PAG_ON.criarPaginaOnline({
      lado: LADO_ONLINE, D: on ? on.D0 : +params.get('D') || 4, nomes: on?.nomes ?? ['Lado 0', 'Lado 1'],
      transporte: ONLINE_TM ? 'porta' : 'bc', sala: on ? on.sala : params.get('online'),
      ao: {
        menuPausar: () => { if (PAG_ONLINE.pausar(performance.now())) hud.fecharMenu(); },
        // sair no meio = derrota (fair play no TM); o 'abandono' vai antes, para o outro ver o W.O. na hora
        menuSair: () => { hud.fecharMenu(); PAG_ONLINE.sair(); setTimeout(() => { if (TM) avisarTM('tm3d:sair', { abandono: true }); }, 400); },
        wo: (vencedor, motivo) => { if (TM) fimTM(resultadoAtualTM(), { online: { wo: { vencedor, motivo }, hashFinal: hashMundo(mundo) >>> 0 } }); },
        dessinc: info => { if (TM) fimTM(null, { online: { dessinc: true, n: info?.n ?? null } }); },
      },
    });
  }
  hud.progresso('Preparando o gramado…');
  await proximoQuadro();
  const canvas = document.getElementById('tela');
  cena3d = criarCena({ canvas, qualidade: qAtual, hora });
  cam = criarCamera(window.innerWidth / window.innerHeight);
  cam.definirModo(camInicial);
  PAG_LIVRE?.ligarCamera(!!mundo.livre);
  // identidade visual: com ?tm, os escudos decodificados ANTES dos canvas do estádio e da torcida (desenhados uma vez só)
  IDENT = await identidadeDaPagina();
  if (IDENT) { COR_TIME[0] = IDENT.hud.faixa[0]; COR_TIME[1] = IDENT.hud.faixa[1]; }
  campo = criarCampo({ qualidade: qAtual, aniso: cena3d.anisotropia(), identidade: IDENT });
  cena3d.cena.add(campo.grupo);
  if (MOD_CAD) campo.ligarCadeiras(MOD_CAD);
  campo.definirHora(hora);
  hud.progresso('Enchendo as arquibancadas…');
  await proximoQuadro();
  torcida = criarTorcida(cena3d.cena, { qualidade: qAtual, mascara: mascaraDaIdentidade(IDENT), hora, identidade: IDENT });
  hud.progresso('Montando os jogadores…');
  await proximoQuadro();
  bola3d = criarBola3D(cena3d.cena, qAtual);
  // ?corpo=humano: o corpo realista da Etapa 5 (sob demanda; o manequim desenha até ele chegar). Na edição pro do Total
  // Match (o "Season Update", trancado por chave: a versão de teste com os jogadores reais) ele já vem ligado;
  // ?corpo=manequim desliga
  const corpoPedido = params.get('corpo') ?? (PEDIDO_TM?.edicao === 'pro' ? 'humano' : null);
  jog3d = criarJogadores3D(cena3d.cena, qAtual, { corpo: corpoPedido === 'humano' ? 'humano' : null });
  // uniformes do Total Match (resolvidos sem confusão: identidade.js) nas chaves que o elenco dele usa
  if (IDENT) jog3d.definirKits(IDENT.kits);
  // a cena de substituição com o máximo de trocas numa parada (5 + 5) desenha 22 + 10 reservas + o quarto árbitro (+ os
  // 2 treinadores); mais 3 vagas para os árbitros das cenas das paradas (200–202: o árbitro e os assistentes)
  jog3d.reservar(22 + 2 * CFG.PARTIDA.subsMax + 1 + (TECNICOS_ON ? IDS_TECNICOS.length : 0) + 3);
  // rostos reais (edição pro do Total Match, a versão de teste com os jogadores reais): cada jogador acha a textura do
  // rosto dele pela foto do TM ("<liga>-<clube>__<nome>"), carregada só para quem está na partida
  if (TM && corpoPedido === 'humano' && PEDIDO_TM?.edicao === 'pro') ligarRostosReais();
  marcas = criarMarcas(cena3d.cena, { timeHumano: TIME_HUMANO }); // só a bola alta do meu time ganha marca
  linhaImped = criarLinhaImpedimento(cena3d.cena);
  marcasLat = criarMarcasLateral(cena3d.cena);
  const sombras = QUALIDADE[qAtual].sombras;
  bola3d.definirSombras(sombras);
  jog3d.definirSombras(sombras);
  // os controles de toque apareceram/sumiram: o topo se ajusta e o padrão do minimapa (celular × PC) muda junto
  entrada = criarEntrada({ forcarToque: params.get('toque') === '1', aoAcao: tratarAcao, tela: () => (telaMira.ok ? telaMira : null), aoMudarLayout: () => { hud.ajustarTopo(); hud.definirEstado({ minimapa: minimapaLigado() }); } });
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
  // as cenas das paradas: o vão das placas na frente do túnel (o expulso sai por ele; render/vao-placas.js, o mesmo do
  // pré-jogo) e, se o módulo das cenas já chegou, o cartão 3D (senão ele nasce quando o módulo chegar: SOB.cenas)
  vaoCenas = criarVaoPlacas({ campo, cena3d });
  if (MOD_CEN && !cartao3d) cartao3d = MOD_CEN.c3.criarCartao3D(cena3d.cena);
  marcarCenas();
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
  // Modo Livre: a pausa aberta no submenu Jogadores (o "Jogar" começa)
  rotuloModoLivre();
  if (mundo.livre && !PRINTS && !DEMO_ON) paginaLivre().abrirJogadores();
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
  PAG_LIVRE?.limparFila();
  // a súmula é do mundo novo
  sumula = criarSumula();
  if (TM) { expulsoAvisado = false; expulsoTick = -1; simulandoTM = null; }
  expulsoPendente = false;
  golNeutro = null;
  kitCache.clear();
  limparOndas(ondas);
  for (const bt of batidasRede) bt.ativo = false;
  zerarEmocao(emocao);
  zerarAutorGol(autorGol);
  // replay: o anel e o gol pendente são do mundo velho (os sons adiados e a fila de cenas vão junto)
  somAdiado.length = 0; filaCenas.length = 0; linhaNoReplay = null;
  // substituição: a cena em andamento e a faixa saem (sem tocar nada da fila: ela já foi esvaziada)
  if (cenaSub) { cenaSub = null; if (cam) cam.definirCinema(null); entrada?.reposicionar?.(); }
  substNoPasso.length = 0; faixaSub2T.length = 0;
  hud.substituicao(false); hud.esconderFaixaSubst();
  // cartão: a cena em andamento, a da vantagem pendente, a tarja e a memória das variações (o mundo novo começa do zero)
  descartarCartao(); ultimaAmarelo = null; ultimaVermelho = null;
  // a cena do intervalo (e as tarjas dela; o guardador esquece os lances em iniciarEstados)
  descartarFim();
  // (o replay de dentro de uma cena não volta a ela: o mundo é outro)
  replayAoFim = null;
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
  PAG_LIVRE?.ligarCamera(!!mundo.livre);
  if (mundo.livre) PAG_LIVRE?.marcar();
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
        // a edição na fila (Editar time / editarTime) entra no 1º passo, como no laço da página (e a do Livre)
        if (edicaoNaFila) { ac = ac ? [edicaoNaFila, ...ac] : [edicaoNaFila]; edicaoNaFila = null; }
        { const al = PAG_LIVRE?.tirarDaFila(); if (al) ac = ac ? [al, ...ac] : [al]; }
        rodarPasso({ x: e.x ?? 0, z: e.z ?? 0, mx: e.mx, mz: e.mz, botoes: e.botoes ?? 0, iaCobra: !!(e.ia || e.iaCobra) }, ac);
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
    sumula() { return sumula ? structuredClone({ ...sumula, autor: undefined }) : null; },
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
  // bola parada (testes): o módulo sob demanda, o estado, a linha só no desenho, os pontos da linha
  bolaParada: { carregar: carregarBP, get estado() { return bp.tela?.estado(mundo, cam, bp.plano) ?? null; }, linha(v) { bp.linha = !!v; }, pontos: () => bp.tela?.pontos(mundo) ?? [] },
  /** Modo Livre: escolha(), ajustar({linha, goleiro}), recomecar('meio' | 'pe'), naFila (livre-pagina.js api; null fora). */
  get livre() { return PAG_LIVRE ? PAG_LIVRE.api : { escolha: () => null, ajustar: () => null, recomecar: () => null, naFila: null }; },
  /** Online 1×1 (testes): o estado da sessão — passo, atraso, RTT, paradas, os hashes guardados ([n, h]) e o placar. */
  get online() {
    if (!PAG_ONLINE) return null;
    const s = PAG_ONLINE.s;
    return { lado: s.lado, n: s.n, D: s.D, rtt: s.rtt, paradas: s.paradas, dessinc: s.dessinc, hashes: [...s.hashesLoc.entries()],
      placar: [mundo.placar?.[0] ?? 0, mundo.placar?.[1] ?? 0], estado: mundo.partida?.estado ?? null, tick: mundo.tick,
      conexao: MOD_ON.estadoConexao(s, performance.now()).estado, pausado: PAG_ONLINE.pausado, pausasRestam: PAG_ONLINE.pausasRestam,
      pausar: () => PAG_ONLINE.pausar(performance.now()), retomar: () => PAG_ONLINE.retomar(performance.now()) };
  },
  /** Carrega o Livre (livre.js + livre-pagina.js) antes de um reiniciar({modo: 'livre'}) — o trocarModo já carrega. */
  carregarLivre() { return carregarLivre().then(() => true); },
  /** Cópia de m.times[t] (partida) ou null. */
  estadoTime(t = TIME_HUMANO) { return mundo.times?.[t] ? structuredClone(mundo.times[t]) : null; },
  /**
   * Módulos sob demanda (config.js SOB_DEMANDA): ja() pede todos já (sem esperar a pré-carga) e devolve true quando
   * chegaram — os testes de navegador esperam por ele depois do pronto (waitForFunction); estado = {replay, editor, cenas}.
   */
  sobDemanda: {
    ja() { if (!SOB.replay.ok || !SOB.editor.ok || !SOB.cenas.ok || !SOB.cadeiras.ok) carregarSobDemanda().catch(() => {}); return SOB.replay.ok && SOB.editor.ok && SOB.cenas.ok && SOB.cadeiras.ok; },
    get carregado() { return SOB.replay.ok && SOB.editor.ok && SOB.cenas.ok && SOB.cadeiras.ok; },
    get estado() { return { replay: SOB.replay.ok, editor: SOB.editor.ok, cenas: SOB.cenas.ok, cadeiras: SOB.cadeiras.ok }; },
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
   * null; segundo: true → quem faz a falta já tinha um amarelo (o 2º amarelo: o vermelho com `segundo`); doMeu: a falta é
   * do controlado}. Passa pelas regras e pelos eventos da página (apito, cartão, câmera) e pela decisão da cena do cartão
   * (como o fim do passo: decidirCartao). Devolve {parada, def, cond, cartao, cena (a cena do cartão começou ou está na
   * fila)}.
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
    if (opc.segundo) m.partida.cartoes[d.id] = 1;
    const f = montarFalta(m, d, c, 'bote', true);
    if ('cartao' in opc) f.cartao = opc.cartao;
    else if (opc.segundo) f.cartao = 'amarelo';
    m.eventos = []; m.faltaPendente = f;
    regrasPartida(m);
    estadioPasso(m.eventos);
    for (const ev of m.eventos) tratarEvento(ev);
    // a cena do cartão (como no fim do passo) e a faixa do expulso pendente
    decidirCartao(m.eventos);
    talvezFaixaExpulso();
    return { parada: m.parada?.tipo ?? null, def: d.id, cond: c.id, cartao: f.cartao, cena: !!cenaCartao || filaCenas.some(it => it && it.tipo === 'cartao') };
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
    /**
     * Replays nas paradas (22/10; lances.js): ligado (o padrão da página E "Replays: Ligado"), o lance armado (cópia ou
     * null), a contagem por tempo, o último replay automático ({tick, tipo}), o histórico dos que tocaram ({tick, morta,
     * chave, classe, tipo, dur, cams}), o último lance classificado e forcar(lance): arma um lance de teste (toca no passo
     * antes da montagem da parada em andamento, com `morta` = o início dela).
     */
    paradas: {
      get ligado() { return replayParadaLigado(); },
      get armado() { return replayParada ? { ...replayParada, ids: [...replayParada.ids] } : null; },
      get contagem() { return lances ? [...lances.porTempo] : null; },
      get ultimoTick() { return lances ? lances.ultimoTick : null; },
      get ultimoTipo() { return lances ? lances.ultimoTipo : null; },
      get historico() { return histParadas.map(h => ({ ...h, cams: [...(h.cams ?? [])] })); },
      forcar(l) { replayParada = l ? { classe: 'A', ids: [], ateMax: null, morta: mundo.parada?.inicio ?? -1, ...l } : null; return !!replayParada; },
      /** O ponto (x, y, z) na câmera do replay agora, em coordenadas normalizadas ({x, y} em −1…1; atras = atrás dela), ou null. */
      ndc(x, y, z) { if (!diretor?.ativo) return null; _proj.set(x, y, z).project(diretor.camera); return { x: _proj.x, y: _proj.y, atras: _proj.z > 1 }; },
    },
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
   * Cenas das paradas — o cartão (testes de navegador e prints; PLANO-CENAS.md §3.3):
   *  carregado (o SOB.cenas chegou), ligado (o que vale agora), ligar(b) (sem salvar; null volta à preferência/padrão),
   *  ativo, tipo ('cartao' | null), fila (os tipos da fila de cenas), estado ({fase, plano, tempo, duracao, k, tick, id,
   *  time, cor, segundo, variante, apoio, planos, tempos, camera, tarja}), atores() (cena-cartao.js infoAtoresCartao),
   *  pular(), forcarVariante(cor, v) (a variação do próximo cartão daquela cor), cartaoDeTeste({id, cor, segundo}) (a cena
   *  num jogador do mundo agora, sem falta: só desenho), cartao3d ({visivel, cor, x, y, z} | null), maoArbitro ({x, y, z}:
   *  a mão direita DESENHADA do árbitro no último quadro, com a postura do corpo novo | null), naTela(id | 'cartao') (caixa
   *  px CSS da pose desenhada de um ator — padrão: o punido — ou do cartão 3D), tarja ({visivel, texto, cartoes, cor,
   *  sigla, num, nome, caixa} | null), cartaoGolPendente, cartaoComCena, relogioEstadio ({tSim, tSegurado, t}), vao (o
   *  estado do vão das placas), expulsoPendente, custo ({msPorTick, ticks}), zerarCusto().
   */
  cenas: {
    get carregado() { return !!MOD_CEN; },
    get ligado() { return cenasLigadas(); },
    ligar(b) { cenasPref = b == null ? (typeof prefs.cenas === 'boolean' ? prefs.cenas : null) : !!b; marcarCenas(); return cenasLigadas(); },
    get ativo() { return !!cenaCartao || !!cenaFim; },
    get tipo() { return cenaCartao ? 'cartao' : cenaFim ? cenaFim.tipo : null; },
    get fila() { return filaCenas.map(it => (typeof it === 'function' ? 'faixa' : it.tipo)); },
    get estado() {
      const F = cenaFim;
      if (F) {
        const c = F.c, P = c.plano, M = MOD_CEN.cf;
        const o = {
          tipo: F.tipo, fase: M.faseFim(c), plano: planoCamFim?.nome ?? null, tempo: M.tempoCenaFim(c), duracao: M.duracaoCenaFim(c), k: c.k,
          tick: P.tick, planos: P.planos.map(p => ({ ...p })), geral: F.geral, rapido: F.rapido, emLances: c.emLances,
          lances: [...F.lances], iLance: F.iLance, tocando: F.tocando, tLances: P.tLances, tarjaDe: P.tarja ? { ...P.tarja } : null,
          placarCena: { ...P.placar }, vencedor: P.vencedor, bolaVisivel: c.bolaVisivel, vazio: !!c.vazio, camera: cam?.cinema ?? null,
          tarjaPlacar: M.tarjaPlacarVisivel(c), atoresAtivos: c.atores.filter(a => a.ativo).length,
        };
        // o pós-jogo: o resultado, a versão curta, se segura o laço, o melhor em campo (o do plano e a tarja), o par da troca
        // de camisa (os ids e o kit misto desenhado de cada um), o aperto dos treinadores, a faixa final e os melhores momentos
        if (F.tipo === 'fim') {
          const kt = id => { const a = c.porId.get(id); return a ? kitTrocaDe(F, a) : null; };
          Object.assign(o, {
            resultado: P.resultado, curto: !!P.curto, segura: F.segura, melhor: P.melhor ? { ...P.melhor } : null,
            tarjaMelhor: M.tarjaMelhorVisivel(c), trocou: !!c.trocou,
            troca: P.troca ? { ...P.troca, kitA: c.trocou ? kt(P.troca.a) : null, kitB: c.trocou ? kt(P.troca.b) : null } : null,
            treinadores: c.trPar ? { aperto: c.trPar.t0 >= 0, t0: c.trPar.t0 } : null, faixaFinal: F.geral,
            mm: F.mm ? { lances: [...F.mm.lances], i: F.mm.i, tocando: F.mm.tocando, vistos: F.mm.vistos } : null,
          });
        }
        return o;
      }
      const C = cenaCartao;
      if (!C) return null;
      const c = C.c, P = c.plano, M = MOD_CEN.cc;
      return {
        tipo: 'cartao', fase: M.faseCartao(c), plano: planoCamCartao?.nome ?? null, tempo: M.tempoCenaCartao(c), duracao: M.duracaoCenaCartao(c), k: c.k,
        tick: P.tick, id: P.id, time: P.time, cor: P.cor, segundo: P.segundo, variante: P.variante, apoio: P.apoio, motivo: P.motivo,
        planos: P.planos.map(p => ({ ...p })), tempos: { ...P.tempos }, camera: cam?.cinema ?? null,
        tarja: telaCenas ? telaCenas.estado().visivel : false,
      };
    },
    atores() { return cenaCartao ? MOD_CEN.cc.infoAtoresCartao(cenaCartao.c) : cenaFim ? MOD_CEN.cf.infoAtoresFim(cenaFim.c) : null; },
    /**
     * Pula a cena: o cartão acaba; o intervalo vai à saída do 2º tempo (o geral e os passos correndo atrás da cortina); o
     * pós-jogo vai ao plano geral com a faixa final.
     */
    pular() { if (cenaFim) pularFim(); else pularCartao(); },
    /**
     * O próximo bloco (o toque/Enter): no intervalo campo → lances → estatísticas → geral → saída; no pós-jogo os planos de
     * campo → melhor → placar → estatísticas → geral (a faixa final).
     */
    proximo() { if (cenaFim) proximoBlocoFim(); },
    /**
     * PÓS-JOGO (testes; PLANO-CENAS.md §5.6): leva a partida de agora até `antes` passos (padrão 30) do apito final pelos
     * passos da demo SEM abrir cena nenhuma no caminho (como rodarPassos), com o placar forçado se `placar` vier ([casa,
     * fora]: escrito no MUNDO — só testes; a súmula não ganha os gols). Depois, quadros (relogio.avancar) até a cena começar
     * (a cena só abre pelo laço da página). Devolve {tick, fim (o tick previsto do apito, sem um gol no caminho), placar} ou
     * null fora da partida. Os três desfechos: placar [2, 1] (vitória da casa), [0, 1] (derrota) e [1, 1] (empate).
     */
    fimDeTeste(o = {}) {
      const m = mundo, p = m.partida;
      if (!p || mundo.disputa || mundo.livre) return null;
      const antes = o.antes ?? 30;
      const um = () => { emRodarPassos = true; try { rodarPasso(entradaDemoDoMundo(mundo) ?? { x: 0, z: 0, botoes: 0 }, null); } finally { emRodarPassos = false; } };
      for (let n = 0; n < 500000 && p.estado !== 'fim' && !(p.tempo === 2 && p.acrescimo != null); n++) um();
      if (p.estado === 'fim') return { tick: m.tick, fim: m.tick, placar: [m.placar[0], m.placar[1]] };
      const fim = () => p.tick0Tempo + p.ticksPorTempo + Math.round(p.acrescimo * p.ticksPorTempo / 45);
      for (let n = 0; n < 500000 && p.estado !== 'fim' && m.tick < fim() - antes; n++) um();
      if (Array.isArray(o.placar)) { m.placar[0] = o.placar[0] | 0; m.placar[1] = o.placar[1] | 0; hud.placar(m.placar[0], m.placar[1]); }
      return { tick: m.tick, fim: fim(), placar: [m.placar[0], m.placar[1]] };
    },
    /** "Melhores momentos" da faixa final do pós-jogo (o mesmo do botão); false se não deu (sem faixa, sem lances). */
    melhoresMomentos() { return iniciarMelhores(); },
    /**
     * As cenas do pós-jogo desta página: {tick, inicio, geral ({tick, quando} | null), pulou, planos, curto, melhor, troca,
     * segura, mm ({lances, vistos, pulou, fim} | null)}.
     */
    get historicoPosJogo() { return histPos.map(h => structuredClone(h)); },
    /** A faixa final agora: {visivel, titulo, placar, botoes: [{texto, cmd, visivel}]}. */
    get faixaFinal() {
      const fx = document.getElementById('faixa');
      if (!fx) return null;
      const b = id => { const e = document.getElementById(id); return e ? { texto: e.textContent.trim(), cmd: e.dataset.cmd, visivel: !e.hidden && !fx.hidden && getComputedStyle(fx).display !== 'none' } : null; };
      return { visivel: !fx.hidden && getComputedStyle(fx).display !== 'none', titulo: document.getElementById('faixa-titulo')?.textContent ?? '',
        placar: document.getElementById('faixa-placar')?.textContent ?? '', botoes: [b('faixa-botao'), b('faixa-botao2')] };
    },
    get custoPosJogo() { return { msPorTick: custoFim.ms / Math.max(1, custoFim.n), ticks: custoFim.n }; },
    /**
     * As tarjas e o painel agora (cenas-tela.js estado + as caixas px CSS de cada peça: tarja, placar, estatisticas), com o
     * placar e o "Pular" e o botão da pausa da camada (as caixas, para nada encostar).
     */
    get tarjas() {
      if (!telaCenas) return null;
      const cx = sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' ? { x0: r.left, y0: r.top, x1: r.right, y1: r.bottom } : null; };
      return { ...telaCenas.estado(), caixas: { ...telaCenas.caixas(), placarHud: cx('[data-caixa="placar"]'), pular: cx('#cena-pular'), menu: cx('#cena-menu') } };
    },
    /** As cenas do intervalo desta página ({tick, lances, inicio, geral: {tick, quando}, fim: {tick, quando, rapido}, pulou}). */
    get historicoIntervalo() { return histFim.map(h => ({ ...h, lances: [...h.lances] })); },
    get custoIntervalo() { return { msPorTick: custoFim.ms / Math.max(1, custoFim.n), ticks: custoFim.n }; },
    /** A tarja do placar do online (nos 3 s da faixa) ou null. */
    get tarjaOnline() { return tarjaOnline ? structuredClone(tarjaOnline) : null; },
    /** A súmula da partida agora (escanteios, faltas e porTempo inclusive; sem o autor-gol interno). */
    sumula() { return sumula ? structuredClone({ ...sumula, autor: undefined }) : null; },
    forcarVariante(cor, v) { if (cor === 'amarelo' || cor === 'vermelho') forcarVariante[cor] = v ?? null; },
    cartaoDeTeste(o = {}) {
      if (!MOD_CEN || !mundo.partida || cenaCartao) return false;
      const j = (o.id != null ? mundo.jogadores.find(q => q.id === o.id) : null) ?? mundo.jogadores.find(q => q.time !== TIME_HUMANO && q.posicao !== 'GOL');
      if (!j) return false;
      const seg = !!o.segundo;
      const cartao = { id: j.id, time: j.time, cor: seg || o.cor === 'vermelho' ? 'vermelho' : 'amarelo', segundo: seg, motivo: 'teste', outros: [] };
      cartaoComCena = { id: j.id, tick: mundo.tick };
      return iniciarCartao({ tipo: 'cartao', cartao, tickEvento: mundo.tick });
    },
    get cartao3d() { return cartao3d && cartao3d.visivel ? { visivel: true, cor: cartao3d.cor, x: cartao3d.mesh.position.x, y: cartao3d.mesh.position.y, z: cartao3d.mesh.position.z } : null; },
    get maoArbitro() {
      if (!cenaCartao || !jog3d) return null;
      const o = jog3d.poseDesenhada(cenaCartao.c.arbitro.id, new Float32Array(NJ * 3));
      if (!o) return null;
      const i = JUNTA.maoD * 3;
      return { x: o[i], y: o[i + 1], z: o[i + 2] };
    },
    naTela(id) {
      if ((!cenaCartao && !cenaFim) || !cam) return null;
      const W = window.innerWidth, H = window.innerHeight;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, atras = false;
      const ponto = (x, y, z) => {
        _proj.set(x, y, z).project(cam.camera);
        if (_proj.z > 1) atras = true;
        const px = (_proj.x + 1) / 2 * W, py = (1 - _proj.y) / 2 * H;
        x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
      };
      if (id === 'cartao') {
        if (!cartao3d || !cartao3d.visivel) return null;
        const m = cartao3d.mesh;
        m.updateMatrixWorld();
        const v = new THREE.Vector3();
        for (const [u, w] of [[-0.055, -0.08], [0.055, -0.08], [0.055, 0.08], [-0.055, 0.08]]) { v.set(u, w, 0).applyMatrix4(m.matrixWorld); ponto(v.x, v.y, v.z); }
      } else {
        const c = cenaCartao ? cenaCartao.c : cenaFim.c, a = c.atores.find(q => q.id === (id ?? (cenaCartao ? c.plano.id : c.arbitro.id)));
        if (!a || !a.des) return null;
        for (let i = 0; i < NJ; i++) ponto(a.des[i * 3], a.des[i * 3 + 1], a.des[i * 3 + 2]);
      }
      return { x0, y0, x1, y1, altura: y1 - y0, largura: x1 - x0, dentro: !atras && x0 >= 0 && x1 <= W && y0 >= 0 && y1 <= H, atras };
    },
    get tarja() { return telaCenas ? { ...telaCenas.estado(), caixa: telaCenas.caixa() } : null; },
    get cartaoGolPendente() { return cartaoGolPendente ? { id: cartaoGolPendente.cartao.id, cor: cartaoGolPendente.cartao.cor, desde: cartaoGolPendente.desde } : null; },
    get cartaoComCena() { return cartaoComCena ? { ...cartaoComCena } : null; },
    get relogioEstadio() { return { ...relEst }; },
    get vao() { return vaoCenas ? vaoCenas.info : null; },
    get expulsoPendente() { return expulsoPendente; },
    get custo() { return { msPorTick: custoCartao.ms / Math.max(1, custoCartao.n), ticks: custoCartao.n }; },
    zerarCusto() { custoCartao.n = 0; custoCartao.ms = 0; },
    /**
     * O guardador de lances (PR 3; render/lances-guarda.js): lances (os guardados, na ordem em que entraram: {k, tipo, classe,
     * peso, chave, fim, de, ate, lado, time, ids, x, z, tempo, quadros, batidas, segundos}), guarda ({bytes, mini, saturou} |
     * null: ainda não alocado), historicoGuarda ({tick, tipo, classe, chave, fim, k (−1: ficou de fora), ms, tarde}),
     * pendentes ({gol, parada}), tocarLance(k) (testes: tocarLanceGuardado — o lance k pelo diretor, com a fonte = o mini-anel
     * e o aoFim; a fila não anda; false se não deu), fimLance (o último aoFim: {k, pulou, tick, ms (descomprimir e começar)} |
     * null) e escolherLances(o).
     */
    get lances() { return lancesGuardados(); },
    get guarda() { return guarda ? { bytes: guarda.bytes, mini: miniLance ? miniLance.bytes : 0, saturou: guarda.saturou } : null; },
    get historicoGuarda() { return histGuarda.map(h => ({ ...h })); },
    get pendentes() { return { gol: !!golGuardar, parada: lanceGuardar ? lanceGuardar.tipo : null }; },
    tocarLance(k) {
      const t0 = agoraMs();
      let ms = 0;
      fimLanceTeste = null;
      const ok = tocarLanceGuardado(k, pulou => { fimLanceTeste = { k, pulou, tick: mundo.tick, ms }; });
      ms = agoraMs() - t0;
      return ok;
    },
    /** Os k escolhidos para uma cena (lances-guarda.js escolherLances: o = {tempo, max, maxSegundos, cronologica}). */
    escolherLances(o) { return guarda ? MOD_CEN.lg.escolherLances(guarda, o, []) : []; },
    get fimLance() { return fimLanceTeste ? { ...fimLanceTeste } : null; },
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
    /** As cadeiras 3D de perto neste quadro (item 69): {carregado, blocos, instancias, teto, mascara}. */
    get cadeiras() { return campo ? campo.cadeiras : null; },
    /** As malhas das arquibancadas neste quadro: nome, visível, triângulos, em escada (item 69). */
    get arquibancadas() { return campo ? campo.arquibancadas : null; },
    /** Mostra/esconde as cadeiras 3D de perto (conferência nos testes: o mesmo quadro com e sem elas). */
    mostrarCadeiras(v) { campo?.mostrarCadeiras(v); },
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
    get corpo() { return jog3d ? jog3d.humano : null; },
    /** As cores do manequim de um jogador desenhado no último quadro (render/jogador3d.js coresDe; o kit misto da troca). */
    coresJogador(id) { return jog3d?.coresDe ? jog3d.coresDe(id) : null; },
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
