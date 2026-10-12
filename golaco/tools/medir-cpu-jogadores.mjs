// CPU da parte "jogadores" do quadro (Etapa 5.1): interpolar as poses + atualizar o desenho dos 22, no manequim (hoje)
// e no corpo humano (?corpo=novo), em NODE com o mesmo código de desenho (three.js do CDN por tools/lib/three-node.mjs;
// nada vai para a placa de vídeo — a parte "jogadores" do medirQuadro da página também é só CPU).
// Por que em Node: no navegador o tempo é de relógio, e com a máquina dividida (carga 100+ em 4 CPUs) o p95 mede a fila
// do sistema, não o código; aqui a conta é o TEMPO DE CPU do processo (process.cpuUsage), em blocos alternados
// (manequim, corpo, manequim, …: a mesma carga nos dois), e o p95 é o dos blocos.
// Cena: 600 passos de uma partida IA × IA (22 jogadores andando, correndo, chutando) na câmera de TV do celular
// deitado (Média, 844×390 dpr 2; CAMERA.celular com o foco na bola, limitado a 14 m da linha de fundo como a página).
// Meta (plano 5.1, "jogadores" ≤ 1,1× a de hoje): corpo ÷ manequim ≤ 1,1× na média e na mediana dos blocos (o p95 sai
// como informação: com a máquina dividida ele mede a fila do sistema; o p95 por quadro da página está no
// teste-desempenho-celular).
//   node tools/medir-cpu-jogadores.mjs [--quadros 600] [--blocos 40] [--qualidade media]
import './lib/three-node.mjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const QUADROS = +arg('--quadros', 600);
const BLOCOS = +arg('--blocos', 40);
const QUAL = arg('--qualidade', 'media');

const THREE = await import('three');
const { criarJogadores3D } = await import('../js/render/jogador3d.js');
const { criarCorpos3D } = await import('../js/render/corpo3d.js');
const { lerCorpo } = await import('../js/render/corpo-leitor.js');
const { pose, interpolarPose, NJ } = await import('../js/anim.js');
const PT = await import('./lib/partida-tatica.mjs');
const { CAMERA } = await import('../js/config.js');

// poses de 600 passos de uma partida (o desenho interpola entre dois passos: guarda as duas)
const LP = await PT.carregar(path.join(AQUI, '..', 'js'));
const m = PT.criarJogo(LP, 7, { minutos: 60, ataque: PT.parte3Presente(LP) ? 'jogo' : 'substituto' });
for (let i = 0; i < 120; i++) PT.passoJogo(LP, m);
const N = m.jogadores.length;
const poses = [], bolas = [];
for (let q = 0; q <= QUADROS; q++) {
  PT.passoJogo(LP, m);
  const fr = new Float32Array(N * NJ * 3);
  m.jogadores.forEach((j, k) => pose(j, m, fr.subarray(k * NJ * 3, (k + 1) * NJ * 3)));
  poses.push(fr); bolas.push(m.bola.p.x);
}
const ids = m.jogadores.map(j => ({ id: j.id, time: j.time, goleiro: j.posicao === 'GOL' }));

const buf = fs.readFileSync(path.join(AQUI, '..', 'assets', 'jogador', 'corpo.bin'));
const corpo = lerCorpo(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const W = 844, H = 390, DPR = 2;
function montar(tipo) {
  const cena = new THREE.Scene();
  const d = tipo === 'corpo' ? criarCorpos3D(cena, QUAL, corpo) : criarJogadores3D(cena, QUAL);
  d.definirTela(H * DPR);
  // a câmera de TV do celular deitado (config.js CAMERA.celular, plano pela largura × telaPequena): ~40 m de largura
  const dist = Math.hypot(CAMERA.celular.altura, CAMERA.celular.distancia), larg = CAMERA.largura * CAMERA.telaPequena;
  const fov = 2 * Math.atan(larg / (W / H) / 2 / dist) * 180 / Math.PI;
  const cam = new THREE.PerspectiveCamera(fov, W / H, 0.5, 400);
  const lista = ids.map(e => ({ ...e, pose: new Float32Array(NJ * 3), controlado: false, proximo: false, x: 0, z: 0, rumo: 0 }));
  lista[3].controlado = true;
  return { d, cam, lista };
}
const D = { manequim: montar('manequim'), corpo: montar('corpo') };
// um quadro: interpola as poses (alfa 0,5) e atualiza o desenho (o que a página mede como "jogadores")
function quadro(x, q) {
  const a = poses[q % QUADROS], b = poses[(q % QUADROS) + 1];
  for (let k = 0; k < N; k++) {
    const it = x.lista[k];
    interpolarPose(a.subarray(k * NJ * 3, (k + 1) * NJ * 3), b.subarray(k * NJ * 3, (k + 1) * NJ * 3), 0.5, it.pose);
    it.x = it.pose[0]; it.z = it.pose[2];
  }
  const bx = bolas[q % QUADROS];
  const fx = Math.max(-38.5, Math.min(38.5, bx));
  x.cam.position.set(fx, CAMERA.celular.altura, CAMERA.celular.distancia); x.cam.lookAt(fx, 0, 0); x.cam.updateMatrixWorld();
  x.d.atualizar(x.lista, x.cam);
}
// aquece os dois (o otimizador do V8)
for (let t0 = Date.now(), q = 0; Date.now() - t0 < 3000 || q < 3000; q++) { quadro(D.manequim, q); quadro(D.corpo, q); }
const porBloco = { manequim: [], corpo: [] };
for (let b = 0; b < BLOCOS; b++) {
  for (const k of b % 2 ? ['corpo', 'manequim'] : ['manequim', 'corpo']) {
    const c0 = process.cpuUsage();
    for (let q = 0; q < QUADROS; q++) quadro(D[k], q);
    const c = process.cpuUsage(c0);
    porBloco[k].push((c.user + c.system) / 1000 / QUADROS);
  }
}
const est = v => { const s = [...v].sort((a, b) => a - b); return { media: v.reduce((a, b) => a + b, 0) / v.length, p50: s[Math.floor(s.length / 2)], p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] }; };
const A = est(porBloco.manequim), B = est(porBloco.corpo);
const f = v => (v * 1000).toFixed(1);
console.log(`CPU por quadro da parte "jogadores" (${N} jogadores, ${QUAL}, ${BLOCOS} blocos de ${QUADROS} quadros cada, tempo de CPU):`);
console.log(`  manequim:   média ${f(A.media)} µs · mediana ${f(A.p50)} · p95 ${f(A.p95)}`);
console.log(`  corpo novo: média ${f(B.media)} µs · mediana ${f(B.p50)} · p95 ${f(B.p95)}`);
const rP95 = B.p95 / A.p95, rMed = B.media / A.media, rP50 = B.p50 / A.p50;
// o p95 dos blocos mede a fila do sistema quando a máquina está dividida (os dois desenhos fazem a mesma conta a cada
// quadro, sem picos próprios): a meta fica na média e na mediana; o p95 sai como informação
const ok = rMed <= 1.1 && rP50 <= 1.1;
console.log(`${ok ? 'PASSOU  ' : 'REPROVOU'}  corpo ÷ manequim: média ${rMed.toFixed(2)}× · mediana ${rP50.toFixed(2)}×   (alvo: ≤ 1,1×)`);
console.log(`INFO      p95 dos blocos ${rP95.toFixed(2)}× (com a máquina dividida, o p95 é a fila do sistema)`);
process.exit(ok ? 0 : 1);
