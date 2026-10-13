// Roda toda a bateria de testes em Node (a mesma que o GitHub Actions roda antes de publicar).
// Os testes rodam em paralelo (um processo cada, até o número de núcleos); o resultado sai na
// ordem da lista. Sai com código 1 se algum reprovar.
//   node tools/rodar-testes.mjs              (grupo padrão: o que o CI roda)
//   node tools/rodar-testes.mjs --etapa3     (padrão + o grupo 'etapa3')
//   node tools/rodar-testes.mjs --so etapa3  (só o grupo 'etapa3')
//   node tools/rodar-testes.mjs --par 2      (no máximo 2 testes ao mesmo tempo; padrão: um por núcleo)
// Cada linha: [nome, arquivo, argumentos (opcional), grupo (opcional; padrão = 'padrao')].
// Grupo 'etapa3' (Etapa 3): marcadores que saem com "AGUARDANDO PARTE N" e testes novos que ainda
// não passaram 5 vezes seguidas com sementes diferentes (plano 5). Não entram no padrão, para o CI
// da main continuar verde. Quando o teste de uma parte estiver pronto, ela tira o 'etapa3' da linha
// DELA (só da dela; a lista não muda de lugar).
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  ['recomeço do treino (bola no pé, bola fora)', 'teste-recomeco.mjs'],
  // Etapa 2
  ['passes: rasteiro, enfiada, lançamento, cruzamento, primeira, tabela', 'teste-passes.mjs'],
  ['chute: velocidade, curva, dispersão, perna ruim, cavadinha', 'teste-chutes.mjs'],
  ['goleiro: defesas pelos dados, posição, botão GOLEIRO, mãos', 'teste-goleiro.mjs'],
  ['goleiro pula e espalma: mergulho desenhado, mão na bola, espalmada para fora do perigo', 'teste-mergulho.mjs'],
  ['jogo aéreo: domínio no peito e cabeceio', 'teste-aereo.mjs'],
  ['treino de ataque com a IA: não trava e chega ao chute', 'teste-treino.mjs'],
  // Correções depois da Etapa 2
  ['goleiro com a bola na mão não trava no treino (repõe sozinho, TROCAR)', 'teste-goleiro-trava.mjs'],
  ['movimento da IA sem a bola (vai e volta, tremor, amontoado, pressão)', 'teste-movimento.mjs'],
  // Etapa 3 (partida 11×11, tática, IA e Editar time)
  ['custo da partida 11×11 (razão partida ÷ treino ≤ 2,5×)', 'teste-custo.mjs'],
  ['partida 11×11: relógio, intervalo, fim e recomeços (Parte 1)', 'teste-partida.mjs'],
  ['Editar time: elenco, formações, encaixe, edição e substituição (Parte 1)', 'teste-editor.mjs'],
  ['forma do time sem e com a bola (Parte 2)', 'teste-forma.mjs', [], 'etapa3'],
  ['táticas do Editar time movem a forma (Parte 2)', 'teste-taticas.mjs'],
  ['pressão, PPDA e contrapressão (Parte 2)', 'teste-pressao.mjs', [], 'etapa3'],
  ['movimento da IA no 11×11 (Parte 2)', 'teste-movimento.mjs', ['--modo', 'partida'], 'etapa3'],
  ['apoio, corredores, corridas e área (Parte 3)', 'teste-apoio.mjs', [], 'etapa3'],
  ['intensidade e sanidade da partida (Parte 3)', 'teste-intensidade.mjs', [], 'etapa3'],
  ['CONTER, DIVIDIDA e PRESSÃO do humano (Parte 4)', 'teste-defesa-humano.mjs'],
  ['troca para quem disputa a bola alta ≥ 90% — canhão e assistência (Parte 4)', 'teste-aereo-troca.mjs', ['--so', 'canhao']],
  ['troca para quem disputa a bola alta ≥ 90% — jogo natural (Parte 4)', 'teste-aereo-troca.mjs', ['--so', 'natural']],
  // PR "IA intensa" (dono, 10/10: "a IA não corre para trás"): recomposição depois da perda
  ['transição defensiva: recomposição em disparada (IA × IA)', 'teste-transicao.mjs'],
  ['transição defensiva contra o humano roteirizado', 'teste-transicao.mjs', ['--humano'], 'etapa3'],
  // Estádio: rede que balança, torcida e som (contas puras do desenho)
  ['rede que balança: bolsa, onda, batidas com a física da bola, bola desenhada no bojo', 'teste-rede.mjs'],
  ['rede véu de noiva: forma pela física, morre no fundo, nada atravessa, gol pelo véu, desenho', 'teste-rede-veu.mjs'],
  ['torcida: lugares, setores, atlas das poses e ânimo (murmúrio, gol, "uuuh", apitos)', 'teste-torcida.mjs'],
  ['replay: anel dos últimos 10 s, roteiros do gol/impedimento/pausa e o replay de lances de verdade', 'teste-replay-anel.mjs'],
  ['comemoração do gol: cena pura (locomoção, golpes, gestos, abraço, quem sofreu, câmera; o mundo não muda)', 'teste-comemoracao.mjs'],
  // Etapa 4: regras (IFAB)
  ['impedimento (Regra 11: cenas, tiro livre indireto, árbitro independente) e acréscimos (Regra 7.3)', 'teste-impedimento.mjs'],
  ['faltas, vantagem, cartões e expulsão (Regra 12), tiro livre direto e pênalti (Regra 14)', 'teste-faltas.mjs'],
  // Pedidos do dono de 11/10 (regras e controles)
  ['jogador parado com a bola: a IA fecha e dá o bote (condutor lento)', 'teste-parado.mjs'],
  ['PRESSÃO perceptível: com × sem o botão (pareado), marca, um a mais na pressão', 'teste-pressao-humano.mjs'],
  ['goleiro pelas Leis do Jogo (mão só na área, recuo, 8 s) e na mão do humano (anda, TROCAR, PEGAR)', 'teste-goleiro-regras.mjs'],
  ['bolas paradas: lateral com as mãos e 3 opções (Regra 15), tiro de meta (16), escanteio por zonas, barreira (13)', 'teste-bolas-paradas.mjs'],
  // Auditoria dos botões (dono, 12/10: "ainda tem botões que não funcionam"): o efeito de cada botão no mundo
  ['botões: toque aéreo vencido, troca sem desfazer o TROCAR, PRESSÃO no passe, bola parada, pênalti, cruzamento rasteiro, primeira, barreira', 'teste-botoes.mjs'],
  // Pré-jogo (pedido de 11/10): o cortejo do túnel até a fila e o roteiro com os trilhos de câmera (contas puras)
  ['pré-jogo: cortejo do túnel até a fila (pés, colisão, vaga, rumo, custo, hash da partida)', 'teste-cortejo.mjs'],
  ['pré-jogo: roteiro, escalações de 10 s, pular e trilhos de câmera fora dos sólidos', 'teste-prejogo-roteiro.mjs'],
];
const argv = process.argv.slice(2);
const iSo = argv.indexOf('--so');
const so = iSo >= 0 ? argv[iSo + 1] : null;
const grupos = so ? [so] : argv.includes('--etapa3') ? ['padrao', 'etapa3'] : ['padrao'];
const TESTES = LISTA.filter(([, , , g = 'padrao']) => grupos.includes(g));

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
let prox = 0, impresso = 0;
function imprimir() {
  while (impresso < TESTES.length && res[impresso]) {
    const r = res[impresso], [nome] = TESTES[impresso];
    process.stdout.write(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome}  (${r.s.toFixed(1)} s)\n`);
    if (!r.ok) process.stdout.write(r.saida + '\n');
    impresso++;
  }
}
async function trabalhador() {
  while (prox < TESTES.length) {
    const i = prox++;
    res[i] = await rodar(TESTES[i][1], TESTES[i][2]);
    imprimir();
  }
}
await Promise.all(Array.from({ length: nPar }, trabalhador));
const falhas = res.filter(r => !r.ok);
console.log(`\n${res.length - falhas.length}/${res.length} testes passaram em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas.length ? 1 : 0);
