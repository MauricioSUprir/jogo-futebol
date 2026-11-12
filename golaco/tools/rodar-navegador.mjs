// Roda os testes no navegador (Chromium pelo Playwright) que o GitHub Actions roda, um de cada vez (cada um sobe o
// seu servidor e o seu Chromium), com a saída de cada teste ao vivo. Sai com código 1 se algum reprovar.
// A lista dos testes de navegador do CI fica AQUI (não no YAML): teste de navegador novo entra nesta lista.
//   NODE_PATH=<pasta com o playwright>/node_modules node tools/rodar-navegador.mjs
//   node tools/rodar-navegador.mjs --parte 2 --de 3     (só a parte 2 de 3, dividida pelo tempo; lib/partes.mjs)
//   node tools/rodar-navegador.mjs --deploy             (só os marcados para o deploy, como o deploy-pages.yml)
//   node tools/rodar-navegador.mjs --de 3 --lista       (só imprime a divisão, sem rodar)
// Cada linha: [nome, arquivo, opções]. Opções: tentativas (padrão 1; o teste-carga tem 2, como antes no YAML),
// informativo (reprovar não bloqueia: só mostra os números), deploy (roda também antes de publicar).
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dividirPorCusto, lerParte } from './lib/partes.mjs';
import { TEMPOS_NAVEGADOR, TEMPO_NOVO } from './lib/tempos-ci.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const LISTA = [
  ['carga, erros, download, determinismo Node = Chromium', 'teste-carga.mjs', { tentativas: 2, deploy: true }],
  ['controles na página (teclado no PC e toque no celular)', 'teste-controles.mjs'],
  ['Editar time (mouse, teclado e toque; Node = Chromium; nada encosta em 6 telas)', 'teste-editor-tela.mjs', { deploy: true }],
  ['estádio (torcida, rede que balança num gol de verdade, efeito de gol e som)', 'teste-estadio.mjs'],
  ['pré-jogo (cenas, cortejo, escalações no campinho, pular, som, hash igual depois)', 'teste-prejogo.mjs'],
  // Item 64 (dono, 23/10: "quero que fique NESSE NÍVEL" — a pré-partida do EA FC com a cara do TM)
  ['tela antes do jogo (item 64: liga/desliga, simulação parada e hash, sem rolar e nada encosta em 10 telas, letras, alvos, teclado, controle, toque, som, Personalizar pela escalação, Livre, Pênaltis, TM e o Rumo ao Estrelato, voltas, contraste, download, reserva; as fotos da pro nas fichas — item 31)', 'teste-prepartida-tela.mjs', { deploy: true }],
  ['som da torcida durante o jogo (leito, apito, cantos, iPhone, interrupção, limitador, hash)', 'teste-som-jogo.mjs'],
  ['rede véu de noiva na tela (forma, branca de dia e de noite, mexe na batida; PC e celular)', 'teste-rede-tela.mjs'],
  ['tela limpa (HUD mínimo no celular e no PC, linha de impedimento só no apito)', 'teste-hud-minimo.mjs', { deploy: true }],
  ['replay (gol, impedimento com a linha, pausa; simulação parada e hash igual)', 'teste-replay.mjs'],
  ['replays nas paradas (o lance de verdade no passo antes da montagem, simulação parada e hash igual, pular, desligado, celular, online, corpo novo)', 'teste-replay-paradas-tela.mjs'],
  ['comemoração do gol (cena, câmera de cinema, pular, celular; simulação segura e hash igual; o cartão do autor com a foto da pro, o número e o nome — item 31)', 'teste-comemoracao-tela.mjs', { deploy: true }],
  ['área técnica e treinadores na tela (celular — visíveis com o banco no quadro, chamadas iguais, CPU)', 'teste-tecnicos-tela.mjs'],
  ['cena de substituição e faixa ENTRA/SAI (fila depois do replay, pular, pausa, celular, nada encosta; hash igual)', 'teste-substituicao-tela.mjs', { deploy: true }],
  ['cenas das paradas: cartão (o cartão na mão, a tarja só na cena, pular, sem o ícone, hash igual, celular e corpo novo, cartão → replay de parada, vantagem que virou gol, TM expulso), intervalo e pós-jogo (o mundo parado até a faixa final, tarjas = súmula, melhor em campo, troca de camisa, melhores momentos, celular, corpo novo, TM, online)', 'teste-cenas-tela.mjs', { deploy: true }],
  ['Pênaltis 3D (disputa até o fim, bolinhas, faixa, teclado com a câmera atrás do cobrador, celular, ?tm)', 'teste-penaltis-tela.mjs', { deploy: true }],
  // (item 65: a mira minimalista pelos pixels — largura, contraste dia/noite, o anel, o arco, o custo — e a curva por arrasto com
  // toque de verdade, também em 568×320 com o entalhe)
  ['bolas paradas no estilo FIFA (câmera atrás do cobrador nos 4 tipos, nada na lente, a mira da cobrança mirada, a curva no teclado e por arrasto no toque; PC e celular)', 'teste-bola-parada-tela.mjs'],
  // Item 66 (dono, 23/10: "a câmera não acompanha a bola e não dá pra ver a área completamente")
  ['câmera de TV na tela (a projeção e a câmera = Node, a bola fora do HUD, a torcida, o controlado, o custo, a área inteira, o escanteio da pessoa alto e o da IA na TV, de noite; PC e celular)', 'teste-camera-tela.mjs'],
  ['Modo Livre (pausa sem rolar, as 6 câmeras pela pausa, C/R3, rumo do ataque, Altura/Distância salvas, celular, ?tm)', 'teste-livre-tela.mjs', { deploy: true }],
  ['Online 1×1 na tela (duas abas pelo BroadcastChannel: o mesmo jogo, pausa combinada, menu sem parar, a partida inteira, a pausa no celular; a cena de substituição com a escolha do anfitrião, cada lado segurando só a sua — item 30; o menu aberto não pula a comemoração nem o replay — item 129)', 'teste-online-tela.mjs', { deploy: true }],
  // Item 58 (dono, 23/10: "quero ele igual ao do FIFA ... o campinho do time no canto direito")
  ['pausa do FC 24 com o campinho (lista à esquerda, cartão do time à direita, sem rolar em 4 telas do celular e no PC, o jogo à vista, teclado/controle/toque, leitor de tela, ?tm e online)', 'teste-pausa-tela.mjs', { deploy: true }],
  ['corpo humano no jogo (?corpo=humano: todos desenhados, chamadas, teto de triângulos, nada baixado sem ele, a nuca até a gola, as máscaras e as bordas dos patrocínios)', 'teste-corpo-tela.mjs'],
  ['mira pelo que se vê na tela (o meio e os paus vistos → a mira no alvo, PC e celular, pênalti, câmera aproximada e as do Livre)', 'teste-mira-tela.mjs'],
  // Item 45 (FILA: "Urgente: melhora extrema dos gráficos no celular — qualidade baixa/média"; PLANO-GRAFICOS.md §4): a régua dos
  // gráficos com as metas valendo desde o C14. Fora do deploy: o CI do PR já os roda em toda mudança do golaco/ e no deploy a CPU
  // pareada não tem a base (só informaria), com ~8 min de testes a mais na publicação
  ['gráficos do celular pelos módulos (item 45: a sonda do MSAA, o serrilhado do campo, os finos do gol na Média, na Baixa e na queda, o gramado UEFA e as linhas, de dia e de noite, e o PC Alta)', 'teste-graficos-celular.mjs'],
  ['gráficos do celular pela página (item 45: o MSAA no celular, no tablet e no PC, o serrilhado do quadro inteiro, as franjas, as chamadas, a CPU pareada com a base do PR, o painel ?perf, ?gfx=antigo e ?tom, a troca de qualidade, o contexto perdido, a queda, o redimensionar e o teto)', 'teste-graficos-pagina.mjs'],
  // informativo até passar 5 vezes seguidas (a CPU da simulação no celular simulado ainda passa do teto do plano 4.1)
  ['desempenho no celular simulado (CPU 4×, informativo)', 'teste-desempenho-celular.mjs', { informativo: true }],
];
const argv = process.argv.slice(2);
const DO_GRUPO = argv.includes('--deploy') ? LISTA.filter(([, , o = {}]) => o.deploy) : LISTA;
const PARTE = lerParte(argv);
const tempoDe = ([, arq]) => TEMPOS_NAVEGADOR[arq] ?? TEMPO_NOVO;
const PARTES = dividirPorCusto(DO_GRUPO.map(tempoDe), PARTE?.n ?? 1);
const TESTES = PARTE?.i ? PARTES[PARTE.i - 1].idx.map(k => DO_GRUPO[k]) : DO_GRUPO;
if (argv.includes('--lista')) {
  PARTES.forEach((p, k) => {
    if (PARTE?.i && PARTE.i !== k + 1) return;
    console.log(`parte ${k + 1} de ${PARTES.length}: ${p.idx.length} testes, ~${Math.round(p.carga)} s`);
    for (const t of p.idx.map(j => DO_GRUPO[j])) console.log(`  ${t[1]}  (~${tempoDe(t)} s)`);
  });
  process.exit(0);
}

function rodar(arq) {
  return new Promise(resolve => {
    const ti = Date.now();
    const p = spawn(process.execPath, [path.join(AQUI, arq)], { stdio: 'inherit' });
    p.on('close', codigo => resolve({ ok: codigo === 0, s: (Date.now() - ti) / 1000 }));
  });
}

const t0 = Date.now();
if (PARTE?.i) console.log(`parte ${PARTE.i} de ${PARTE.n}: ${TESTES.length} de ${DO_GRUPO.length} testes, ~${Math.round(PARTES[PARTE.i - 1].carga)} s`);
const res = [];
for (const [nome, arq, o = {}] of TESTES) {
  let r;
  for (let k = 1; k <= (o.tentativas ?? 1); k++) {
    console.log(`\n=== ${nome} (${arq}${k > 1 ? `, tentativa ${k}` : ''})`);
    r = await rodar(arq);
    if (r.ok) break;
  }
  const rotulo = r.ok ? 'PASSOU  ' : o.informativo ? 'INFORMATIVO (não passou; não bloqueia)' : 'REPROVOU';
  console.log(`${rotulo}  ${nome}  (${r.s.toFixed(1)} s)`);
  res.push({ nome, passou: r.ok, bloqueia: !r.ok && !o.informativo, rotulo, s: r.s });
}
console.log(`\nResumo:`);
for (const r of res) console.log(`${r.rotulo}  ${r.nome}  (${r.s.toFixed(1)} s)`);
const falhas = res.filter(r => r.bloqueia);
console.log(`\n${res.filter(r => r.passou).length}/${res.length} testes no navegador passaram em ${((Date.now() - t0) / 1000).toFixed(1)} s` +
  (falhas.length ? ` (${falhas.length} reprovaram)` : ''));
process.exit(falhas.length ? 1 : 0);
