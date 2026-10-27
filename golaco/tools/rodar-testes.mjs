// Roda toda a bateria de testes em Node (a mesma que o GitHub Actions roda antes de publicar).
// Os testes rodam em paralelo (um processo cada, até o número de núcleos); o resultado sai na
// ordem da lista. Sai com código 1 se algum reprovar.
//   node tools/rodar-testes.mjs              (grupo padrão: o que o CI roda)
//   node tools/rodar-testes.mjs --etapa3     (padrão + o grupo 'etapa3')
//   node tools/rodar-testes.mjs --so etapa3  (só o grupo 'etapa3')
//   node tools/rodar-testes.mjs --par 2      (no máximo 2 testes ao mesmo tempo; padrão: um por núcleo)
// Cada linha: [nome, arquivo, argumentos (opcional), grupo (opcional; padrão = 'padrao'), processos (opcional)].
// processos: o teste roda suas partidas em vários processos (--par k); ele ocupa k vagas (k = o pedido, até --par) e
// sai PRIMEIRO, sozinho com suas k vagas — assim leva ~1/k do tempo em vez de disputar a CPU com os outros (o
// teste-nao-passa levava 687 s no CI num processo só; o teste-faltas roda as 36 partidas da parte D em 3). A ordem do
// resultado continua a da lista.
// Grupo 'etapa3' (Etapa 3): marcadores que saem com "AGUARDANDO PARTE N" e testes novos que ainda
// não passaram 5 vezes seguidas com sementes diferentes (plano 5). Não entram no padrão, para o CI
// da main continuar verde. Quando o teste de uma parte estiver pronto, ela tira o 'etapa3' da linha
// DELA (só da dela; a lista não muda de lugar).
//
// CI em partes (dono, 15/10: "diminuir o tempo"): --parte i --de n roda só a parte i de n. A lista (do grupo
// escolhido) é dividida pelo tempo medido no CI (lib/tempos-ci.mjs; teste novo conta 60 s): o mais demorado
// primeiro, cada um na parte mais leve até ali. A divisão não depende da máquina, então as n partes juntas são a
// lista inteira, sem repetir. O GitHub Actions roda as 4 partes em 4 máquinas ao mesmo tempo (golaco-testes.yml).
//   node tools/rodar-testes.mjs --parte 2 --de 4     (só a parte 2 de 4)
//   node tools/rodar-testes.mjs --de 4 --lista       (só imprime as 4 partes, sem rodar; com --parte, só aquela)
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dividirPorCusto, lerParte } from './lib/partes.mjs';
import { TEMPOS_NODE, TEMPO_NOVO } from './lib/tempos-ci.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LISTA = [
  ['matemática determinística (igual em todo motor JS)', 'teste-matdet.mjs'],
  ['física da bola', 'teste-bola.mjs'],
  ['determinismo (semente → mesmo hash)', 'teste-determinismo.mjs'],
  ['entrada e zona morta radial', 'teste-entrada.mjs'],
  ['laço de passo fixo e interpolação', 'teste-laco.mjs'],
  ['resposta do corpo (≤ 0,1 s)', 'teste-resposta.mjs'],
  ['condução — 16 cenas + 4', 'teste-conducao.mjs'],
  ['cortes, giro de 180° e puxada', 'teste-cortes.mjs'],
  ['60 s sem perder a bola', 'teste-perda.mjs'],
  ['patinação dos pés', 'teste-patinacao.mjs'],
  ['tronco inclina na arrancada, freada e curva', 'teste-inclinacao.mjs'],
  ['domínio orientado', 'teste-dominio.mjs'],
  ['recepção que nunca se afasta da bola (canhão de passes e bolas livres)', 'teste-recepcao.mjs'],
  ['proteção de corpo', 'teste-protecao.mjs'],
  ['condução curta e pedalada', 'teste-dribles.mjs'],
  // Pedido do dono de 12/10: "condução mais curtinha, com a bola mais no pé"
  ['condução curta: bola no pé e toque por faixa de velocidade (humano e IA × IA)', 'teste-conducao-curta.mjs'],
  ['recomeço do treino (bola no pé, bola fora)', 'teste-recomeco.mjs'],
  // Etapa 2
  ['passes: rasteiro, enfiada, lançamento, cruzamento, primeira, tabela', 'teste-passes.mjs'],
  ['chute: velocidade, curva, dispersão, perna ruim, cavadinha', 'teste-chutes.mjs'],
  ['cavadinha com dois toques no CHUTE (humano): de qualquer lugar, um toque nunca, chute carregado no mesmo tick, bola parada, botão herdado na troca', 'teste-cavadinha.mjs'],
  ['goleiro: defesas pelos dados, posição, botão GOLEIRO, mãos', 'teste-goleiro.mjs'],
  ['goleiro pula e espalma: mergulho desenhado, mão na bola, espalmada para fora do perigo', 'teste-mergulho.mjs'],
  ['jogo aéreo: domínio no peito e cabeceio', 'teste-aereo.mjs'],
  ['cabeceio na bola rolando: pulo desenhado, cabeça na bola, intenção, disputa pelo alto', 'teste-cabeceio.mjs'],
  ['treino de ataque com a IA: não trava e chega ao chute', 'teste-treino.mjs'],
  // Correções depois da Etapa 2
  ['goleiro com a bola na mão não trava no treino (repõe sozinho, TROCAR)', 'teste-goleiro-trava.mjs'],
  ['movimento da IA sem a bola (vai e volta, tremor, amontoado, pressão)', 'teste-movimento.mjs'],
  // Etapa 3 (partida 11×11, tática, IA e Editar time)
  ['custo da partida 11×11 (razão partida ÷ treino ≤ 2,5×)', 'teste-custo.mjs'],
  ['partida 11×11: relógio, intervalo, fim e recomeços (Parte 1)', 'teste-partida.mjs'],
  ['ninguém passa da bola quase dominada (42 partidas: IA × IA e o humano roteirizado no celular)', 'teste-nao-passa.mjs', [], 'padrao', 4],
  ['Editar time: elenco, formações, encaixe, edição e substituição (Parte 1)', 'teste-editor.mjs'],
  ['forma do time sem e com a bola (Parte 2)', 'teste-forma.mjs', [], 'etapa3'],
  ['táticas do Editar time movem a forma (Parte 2)', 'teste-taticas.mjs'],
  ['pressão, PPDA e contrapressão (Parte 2)', 'teste-pressao.mjs', [], 'etapa3'],
  // (D5, item 22: sai do etapa3 — 5 rodadas de 8 sementes passando, vai e volta 6,8–7,4/min contra 8,3 na main)
  // (C1, 27/10: 32 sementes em 4 processos — o anda-para-anda da main fica a 0,1 da meta e 8 sementes reprovavam por sorteio)
  ['movimento da IA no 11×11 (Parte 2): vai e volta, anda-para-anda, de costas, sem recuo', 'teste-movimento.mjs', ['--modo', 'partida'], 'padrao', 4],
  ['apoio, corredores, corridas e área (Parte 3)', 'teste-apoio.mjs', [], 'etapa3'],
  ['intensidade e sanidade da partida (Parte 3)', 'teste-intensidade.mjs', [], 'etapa3'],
  ['CONTER, DIVIDIDA e PRESSÃO do humano (Parte 4)', 'teste-defesa-humano.mjs'],
  ['troca para quem disputa a bola alta ≥ 90% — canhão e assistência (Parte 4)', 'teste-aereo-troca.mjs', ['--so', 'canhao']],
  ['troca para quem disputa a bola alta ≥ 90% — jogo natural (Parte 4)', 'teste-aereo-troca.mjs', ['--so', 'natural']],
  // PR "IA intensa" (dono, 10/10: "a IA não corre para trás"): recomposição depois da perda
  ['transição defensiva: recomposição em disparada (IA × IA)', 'teste-transicao.mjs'],
  ['transição defensiva contra o humano roteirizado', 'teste-transicao.mjs', ['--humano'], 'etapa3'],
  ['defesa contra a arrancada do humano: recua no corredor, roubada não desfeita, bloco armado', 'teste-defesa-corrida.mjs'],
  ['interceptação: a IA lê a linha do passe e corta o alcançável, sem deixar o homem livre', 'teste-intercepta.mjs'],
  // Estádio: rede que balança, torcida e som (contas puras do desenho)
  ['rede que balança: bolsa, onda, batidas com a física da bola, bola desenhada no bojo', 'teste-rede.mjs'],
  ['rede véu de noiva: forma pela física, morre no fundo, nada atravessa, gol pelo véu, desenho', 'teste-rede-veu.mjs'],
  ['torcida: lugares, setores, atlas das poses e ânimo (murmúrio, gol, "uuuh", apitos)', 'teste-torcida.mjs'],
  ['replay: anel dos últimos 10 s, roteiros do gol/impedimento/pausa e o replay de lances de verdade', 'teste-replay-anel.mjs'],
  ['replays nas paradas: o classificador de lances (árbitro independente), o roteiro, o orçamento, a pureza e o predicado da montagem', 'teste-replay-paradas.mjs'],
  ['replay: a cena semiautomática do impedimento e a checagem de posição legal (durações, critério, câmera, selo, coerência)', 'teste-saot.mjs'],
  ['comemoração do gol: cena pura (locomoção, golpes, gestos, abraço, quem sofreu, câmera; o mundo não muda)', 'teste-comemoracao.mjs'],
  ['cena de substituição: quem sai pela linha mais perto (Regra 3.3), quem entra pelo meio, placa, câmera; o mundo não muda', 'teste-substituicao.mjs'],
  // Cenas das paradas (dono, 22/10: "as cenas de cartões")
  ['cenas das paradas: canhão de 144 cartões (árbitro, cartão no alto, IFAB, as 3 + 3 variações, o expulso no túnel, corpo, câmera), 56 intervalos e 56 pós-jogos (planos, cumprimentos, troca de camisa, melhor em campo, treinadores), variedade, pureza, relógio do estádio e custo', 'teste-cenas.mjs'],
  ['guardador de lances do intervalo e do fim: memória fixa, quantização, tocar no mini-anel, prioridade, custo e as janelas dos gols e das paradas em 24 partidas', 'teste-lances-guarda.mjs'],
  // Área técnica e treinadores (dono, 12/10: "quero a área técnica e o treinador")
  ['área técnica (Regra 1) e os 2 treinadores: dentro da área, pé plantado, gestos, olham a bola, reagem ao gol, nunca tapam a TV, hash igual', 'teste-tecnicos.mjs'],
  // (15/10, frente "replay robusto") os casos sem partida no --estresse: a reação ao gol de qualquer gesto e quem corre
  // perto da área técnica de 16 direções (segundos de CPU; as 72 partidas do --estresse ficam fora do CI)
  ['treinadores sem partida (--estresse): a reação ao gol de qualquer gesto e quem corre perto da área técnica', 'teste-tecnicos.mjs', ['--so-sinteticos', '--estresse']],
  // Etapa 4: regras (IFAB)
  ['impedimento (Regra 11: cenas, tiro livre indireto, árbitro independente) e acréscimos (Regra 7.3)', 'teste-impedimento.mjs'],
  ['faltas, vantagem, cartões e expulsão (Regra 12), tiro livre direto e pênalti (Regra 14)', 'teste-faltas.mjs', [], 'padrao', 3],
  // Pedido do dono de 15/10: "faltas muito forçadas e sem sentido"
  ['faltas com sentido: contato a passo não é falta, quem só corre atrás não atropela, a falta de verdade continua', 'teste-faltas-sentido.mjs'],
  // Pedidos do dono de 11/10 (regras e controles)
  ['jogador parado com a bola: a IA fecha e dá o bote (condutor lento)', 'teste-parado.mjs'],
  ['PRESSÃO perceptível: com × sem o botão (pareado), marca, um a mais na pressão', 'teste-pressao-humano.mjs'],
  // Categoria D (dono, 24/10: "a IA correr, tanto pra marcar, tanto pra atacar, pq ela não corre"): a régua da corrida da IA
  // contra a pessoa (3 roteiros × 8 sementes — a amostra da decisão: com 4, a roubada sofrida pela IA, V5, ia de 2,21 a 2,79
  // entre a base e o D3 nas sementes 1–4 e 2,33 → 2,34 nas 8; seções P o portão, A ataque, M marcação (D3) e V guardas
  // valendo — C informativa até o D4)
  ['a IA corre contra a pessoa: o portão, condutor, apoio perto da bola, corridas até a área, chutes da área; a marcação perto da bola e o 1º homem saindo; volume, vai e volta e roubadas (guardas)', 'teste-ia-corre.mjs', ['--sementes', '8'], 'padrao', 3],
  // (D3, item 20: a pressão da IA contra a pessoa — a pessoa "espelho", que joga com a decisão da IA sem a marca `ia`: PPDA
  // 8–10,5, agressão ≤ 78%, retomada 34–54%; 3 processos)
  ['pressão da IA contra a pessoa (D3): PPDA, agressão e retomada contra o espelho', 'teste-pressao.mjs', ['--humano'], 'padrao', 3],
  ['goleiro pelas Leis do Jogo (mão só na área, recuo, 8 s) e na mão do humano (anda, TROCAR, PEGAR)', 'teste-goleiro-regras.mjs'],
  // Pedido do dono de 15/10 ("defende mais bolas difíceis do que fáceis", espalmar e segurar realistas, movimento) e a
  // pendência #114 (sai no 1×1 e no cruzamento): canhão de estados do meio da partida em 4 processos
  ['goleiro realista: defende a fácil e não a difícil, segura × espalma, set no chute, 1×1, bola solta e saída no cruzamento', 'teste-goleiro-realista.mjs', [], 'padrao', 4],
  ['bolas paradas: lateral com as mãos e 3 opções (Regra 15), tiro de meta (16), escanteio por zonas, barreira (13)', 'teste-bolas-paradas.mjs'],
  ['cobrança mirada (escanteio, falta, tiro de meta da pessoa): a linha = a física, curva, controles, canhão roteirizado, a IA não usa', 'teste-mira.mjs'],
  // Auditoria dos botões (dono, 12/10: "ainda tem botões que não funcionam"): o efeito de cada botão no mundo
  ['botões: toque aéreo vencido, troca sem desfazer o TROCAR, PRESSÃO no passe, bola parada, pênalti, cruzamento rasteiro, primeira, barreira', 'teste-botoes.mjs'],
  // Pré-jogo (pedido de 11/10): o cortejo do túnel até a fila e o roteiro com os trilhos de câmera (contas puras)
  ['pré-jogo: cortejo do túnel até a fila (pés, colisão, vaga, rumo, custo, hash da partida)', 'teste-cortejo.mjs'],
  ['pré-jogo: roteiro, escalações de 10 s, pular e trilhos de câmera fora dos sólidos', 'teste-prejogo-roteiro.mjs'],
  ['pré-jogo no Maracanã (forma própria): os trilhos ajustados fora dos sólidos dele', 'teste-prejogo-roteiro.mjs', ['--forma', 'maracana']],
  // Total Match (dono, 15/10: "a logo dos times, torcida, e estádio adaptáveis a cada time"): identidade visual
  ['identidade dos times: padrão = hoje, uniformes sem confusão (ΔE₀₀), torcida, faixas, placas, HUD do TM e o estádio (real na pro, Estádio Total Match na pública)', 'teste-identidade.mjs'],
  // Estádio com forma própria (dono, 16/10: "não tem nada a ver com o maracanã"): a tigela do Maracanã (estadio-planta.js)
  ['estádio com forma própria (Maracanã): medidas da pesquisa, torcida no degrau, festa no lugar, câmera de TV, sem forma nada muda', 'teste-estadio-forma.mjs'],
  ['estádios de forma genérica (tigela, inglesa, arena, pista, pequeno): a base inteira — torcida, festa, câmera de TV, trilhos do pré-jogo', 'teste-estadio-generico.mjs'],
  // Etapa 5 (corpo humano realista; só desenho): o esqueleto do desenho a partir das juntas e o nível de detalhe
  ['corpo humano: esqueleto do desenho pelas juntas (juntas exatas, sem saltos, sola no chão, dobra com volume) e os assets', 'teste-ossos.mjs'],
  ['corpo humano: nível de detalhe pela altura na tela (histerese, ≤ 2 na LOD0, ≤ 3 níveis, teto de triângulos)', 'teste-lod-humano.mjs'],
  ['rostos reais (edição pro): índice, texturas 512², licença livre e créditos, a foto do TM, tom de pele, foto neutra', 'teste-rostos-reais.mjs'],
  ['patrocínios nas camisas reais (versão de teste da pro): índice, logos 512 × 256, nada sobrando, decalques nos kits só com a base', 'teste-patrocinios.mjs'],
  // Ponte com o Total Match (15/10): o pedido do TM vira os times, o humano no lado do usuário, a trava e a súmula
  ['ponte com o Total Match: pedido → times, humano no visitante, trava "só o meu jogador", súmula e resultado', 'teste-ponte-tm.mjs'],
  // Modo Pênaltis 3D (dono, 15/10: "crie uma versão só de jogador de pênaltis"): a disputa pela Regra 10 da IFAB
  ['disputa de pênaltis (Regra 10): 5 alternadas, fim antecipado, alternadas, fila dos cobradores, lugares, goleiro na linha, fim da cobrança, IA × IA até o fim, humano bate e defende, cavadinha repetida, resultado do TM', 'teste-disputa.mjs'],
  // Modo Livre 3D (dono, 16/10: "um modo livre, como no fifa ... a quantidade de jogadores que eu escolher"): N contra M
  ['modo livre: montagem N × M nas bordas, mudar no meio do jogo, IA × IA 3×3/5×5/1×0 (posse, chutes, ninguém longe), recomeços sem cobrador nulo, determinismo, goleiro sozinho', 'teste-livre.mjs'],
  // Online 1×1 (dono, 16/10: "duas pessoas consigam jogar uma contra a outra"; contrato "Online 1×1" no CONTRATOS.md)
  ['online, etapa 0: nada de Math não exata, Math.random nem relógio no passo com 2 humanos (partida inteira, 2 sementes), sort total, nenhum ** na lógica', 'teste-math-proibido.mjs'],
  ['online, etapa 1: dois humanos — cada cobrança pelo humano DAQUELE time, a entrada de um time não vaza para o outro, TROCAR/GOLEIRO/PRESSÃO por time, bit IA, 1 humano bit a bit igual', 'teste-dois-humanos.mjs'],
  ['online, etapa 2: a sessão de troca de entradas — formato, o mesmo jogo nos dois em 5 redes (perda, 30 qps, degrau, rajada), paradas, edições, ausência, dessincronia, custo', 'teste-online.mjs'],
];
const argv = process.argv.slice(2);
const iSo = argv.indexOf('--so');
const so = iSo >= 0 ? argv[iSo + 1] : null;
const grupos = so ? [so] : argv.includes('--etapa3') ? ['padrao', 'etapa3'] : ['padrao'];
const DO_GRUPO = LISTA.filter(([, , , g = 'padrao']) => grupos.includes(g));
// --parte i --de n: só a parte i (ver o cabeçalho); --lista: imprime a divisão e sai
const PARTE = lerParte(argv);
const tempoDe = ([, arq, args = []]) => TEMPOS_NODE[[arq, ...args].join(' ')] ?? TEMPO_NOVO;
const PARTES = dividirPorCusto(DO_GRUPO.map(tempoDe), PARTE?.n ?? 1);
const TESTES = PARTE?.i ? PARTES[PARTE.i - 1].idx.map(k => DO_GRUPO[k]) : DO_GRUPO;
if (argv.includes('--lista')) {
  PARTES.forEach((p, k) => {
    if (PARTE?.i && PARTE.i !== k + 1) return;
    console.log(`parte ${k + 1} de ${PARTES.length}: ${p.idx.length} testes, ~${Math.round(p.carga)} s`);
    for (const t of p.idx.map(j => DO_GRUPO[j])) console.log(`  ${[t[1], ...(t[2] ?? [])].join(' ')}  (~${tempoDe(t)} s)`);
  });
  process.exit(0);
}
if (PARTE?.i) console.log(`parte ${PARTE.i} de ${PARTE.n}: ${TESTES.length} de ${DO_GRUPO.length} testes, ~${Math.round(PARTES[PARTE.i - 1].carga)} s\n`);

function rodar(arq, args = []) {
  return new Promise(resolve => {
    const ti = Date.now();
    const p = spawn(process.execPath, [path.join(AQUI, arq), ...args], { cwd: path.resolve(AQUI, '..') });
    let saida = '';
    p.stdout.on('data', d => { saida += d; });
    p.stderr.on('data', d => { saida += d; });
    p.on('close', codigo => resolve({ ok: codigo === 0, saida, s: (Date.now() - ti) / 1000 }));
  });
}

const t0 = Date.now();
// --par N: no máximo N testes ao mesmo tempo (máquina dividida com outros processos)
const iPar = process.argv.indexOf('--par');
const parPedido = iPar >= 0 ? Math.max(1, Math.floor(+process.argv[iPar + 1] || 1)) : null;
const nPar = parPedido ?? Math.max(2, Math.min(TESTES.length, os.cpus().length || 2));
const res = new Array(TESTES.length);
let impresso = 0;
function imprimir() {
  while (impresso < TESTES.length && res[impresso]) {
    const r = res[impresso], [nome] = TESTES[impresso];
    process.stdout.write(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome}  (${r.s.toFixed(1)} s)\n`);
    if (!r.ok) process.stdout.write(r.saida + '\n');
    impresso++;
  }
}
// vagas: cada teste ocupa 1 (ou k = os processos dele, até nPar); os de vários processos saem primeiro
const vagas = TESTES.map(([, , , , k]) => (k ? Math.max(1, Math.min(nPar, k)) : 1));
const ordem = TESTES.map((_, i) => i).sort((a, b) => vagas[b] - vagas[a] || a - b);
await new Promise(fim => {
  let k = 0, ocupadas = 0, feitos = 0;
  const lancar = () => {
    while (k < ordem.length) {
      const i = ordem[k], v = vagas[i];
      if (ocupadas > 0 && ocupadas + v > nPar) break;
      k++; ocupadas += v;
      const args = TESTES[i][4] ? [...(TESTES[i][2] ?? []), '--par', String(v)] : TESTES[i][2];
      rodar(TESTES[i][1], args).then(r => {
        res[i] = r; ocupadas -= v; feitos++;
        imprimir();
        if (feitos === TESTES.length) fim(); else lancar();
      });
    }
  };
  if (TESTES.length) lancar(); else fim();
});
const falhas = res.filter(r => !r.ok);
console.log(`\n${res.length - falhas.length}/${res.length} testes passaram em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas.length ? 1 : 0);
