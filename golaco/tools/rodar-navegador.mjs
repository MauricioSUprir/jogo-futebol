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
  ['som da torcida durante o jogo (leito, apito, cantos, iPhone, interrupção, limitador, hash)', 'teste-som-jogo.mjs'],
  ['rede véu de noiva na tela (forma, branca de dia e de noite, mexe na batida; PC e celular)', 'teste-rede-tela.mjs'],
  ['tela limpa (HUD mínimo no celular e no PC, linha de impedimento só no apito)', 'teste-hud-minimo.mjs', { deploy: true }],
  ['replay (gol, impedimento com a linha, pausa; simulação parada e hash igual)', 'teste-replay.mjs'],
  ['comemoração do gol (cena, câmera de cinema, pular, celular; simulação segura e hash igual)', 'teste-comemoracao-tela.mjs', { deploy: true }],
  ['área técnica e treinadores na tela (celular — visíveis com o banco no quadro, chamadas iguais, CPU)', 'teste-tecnicos-tela.mjs'],
  ['cena de substituição e faixa ENTRA/SAI (fila depois do replay, pular, pausa, celular, nada encosta; hash igual)', 'teste-substituicao-tela.mjs', { deploy: true }],
  ['Pênaltis 3D (disputa até o fim, bolinhas, faixa, teclado com a câmera atrás do cobrador, celular, ?tm)', 'teste-penaltis-tela.mjs', { deploy: true }],
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
