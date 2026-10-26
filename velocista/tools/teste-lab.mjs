// Teste dos LABORATÓRIOS ESTRELA.
//   node velocista/tools/teste-lab.mjs                    → só a parte de Node (plano, portas, caminhos, telhado)
//   node velocista/tools/teste-lab.mjs --prints <pasta>   → também abre lab.html no Chromium, confere orçamento/erros e grava prints
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const args = process.argv.slice(2);
const pastaPrints = args.includes('--prints') ? args[args.indexOf('--prints') + 1] : null;
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK  ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

const lab = await import(pathToFileURL(path.join(RAIZ, 'js/lab.js')).href);
const cid = await import(pathToFileURL(path.join(RAIZ, 'js/cidade.js')).href);
const [I, J] = lab.LAB_CELULA, cx = cid.CENTRO_CAMPUS.x, cz = cid.CENTRO_CAMPUS.z;
ok(cx === 76 && cz === 76 && cid.ehCampus(I, J) && cid.ehCampus(I + 1, J + 1) && !cid.ehCampus(I + 2, J), `campus de 2 × 2 células a partir de (${I},${J}), prédio no centro (${cx}, ${cz})`);
const plano = lab.planoLab(cx, cz);
const R = plano.rects;

// ---- 1. retângulos sãos e determinismo
const sao = R.every((q) => [q.x0, q.x1, q.z0, q.z1, q.y0, q.y1].every(Number.isFinite) && q.x1 > q.x0 && q.z1 > q.z0 && q.y1 > q.y0);
ok(sao && R.length > 60, `${R.length} retângulos finitos e bem-formados`);
ok(JSON.stringify(lab.planoLab(cx, cz).rects) === JSON.stringify(R), 'plano determinístico');
const cxe = plano.caixaExterna;
const cmp = plano.campus;
ok(R.every((q) => q.x0 >= cmp.x0 + 2 && q.x1 <= cmp.x1 - 2 && q.z0 >= cmp.z0 + 2 && q.z1 <= cmp.z1 - 2), 'tudo dentro do campus, a ≥ 2 m da rua');
ok(cxe.x0 - cx === -27 && cid.CELL === 76 && (cxe.x1 - cxe.x0) === 54 && cmp.x1 - cmp.x0 === 136, 'prédio principal de 54 m no meio de uma praça de 136 m');
ok(cmp.x0 === cid.centroDe(I) - cid.BLOCO / 2 && cmp.x1 === cid.centroDe(I + 1) + cid.BLOCO / 2, 'a praça cobre as ruas de dentro e para no meio-fio das ruas da borda');
{ // as células do campus guardam os sólidos que as tocam: a colisão perto de qualquer canto acha o prédio, a torre e as alas
  const perto = (x, z) => cid.retangulosPerto(x, z, 1);
  ok(perto(cx + 49, cz - 25).some((q) => q.y1 === lab.ALAS[1].y1) && perto(cx, cz + 64).some((q) => q.y1 === lab.TORRE.y1) && perto(cx - 70, cz).some((q) => q.y1 === lab.ALAS[0].y1), 'sólidos do campus achados pela colisão de qualquer canto');
  const todos = perto(cx, cz); ok(new Set(todos).size === todos.length, 'sem sólido repetido na colisão');
  ok(!cid.arestaNoCampus(I, J, I + 1, J) && cid.arestaNoCampus(I + 1, J, I + 1, J + 1) && cid.noNoCampus(I + 1, J + 1), 'ruas da borda continuam; as de dentro viraram praça');
}

// ---- 2. portas ≥ 4 m e livres para um corpo de 1,8 m
const livre = (x, z, y = cid.CALCADA) => !cid.empurrar(R, x, z, 0.45, y, 1.8).bateu;
for (const p of lab.PAREDES) for (const [s0, s1] of p.vaos) {
  const larg = s1 - s0, c = p.c, meio = (s0 + s1) / 2;
  ok(larg >= 4, `porta ${p.id} [${s0}, ${s1}]: ${larg} m de largura`);
  let passa = true;
  for (const s of [s0 + 0.6, meio, s1 - 0.6]) for (const dc of [-0.6, 0, 0.6]) {
    const u = p.eixo === 'x' ? s : c + dc, v = p.eixo === 'x' ? c + dc : s;
    if (!livre(cx + u, cz + v)) passa = false;
  }
  ok(passa, `porta ${p.id} [${s0}, ${s1}] livre para o corpo de 1,8 m (verga em y = ${lab.PORTA_Y})`);
}

// ---- 3. caminhar pelos cômodos com a mesma colisão do jogo
function anda(x, z, y, alvoX, alvoZ, passo = 0.2) {
  let i = 0;
  while (Math.hypot(alvoX - x, alvoZ - z) > 0.3 && i++ < 2000) {
    const d = Math.hypot(alvoX - x, alvoZ - z), s = Math.min(passo, d);
    let nx = x + ((alvoX - x) / d) * s, nz = z + ((alvoZ - z) / d) * s;
    const r = cid.empurrar(R, nx, nz, 0.45, y, 1.8); nx = r.x; nz = r.z;
    if (Math.hypot(nx - x, nz - z) < 1e-4) break;                  // travou
    x = nx; z = nz; y = cid.chaoEm(R, x, z, y);
  }
  return { x, z, y, chegou: Math.hypot(alvoX - x, alvoZ - z) <= 0.5 };
}
function rota(nome, pontos) {
  let [x, z] = [cx + pontos[0][0], cz + pontos[0][1]], y = 0.3, falhou = null;
  for (let k = 1; k < pontos.length; k++) {
    const r = anda(x, z, y, cx + pontos[k][0], cz + pontos[k][1]); ({ x, z, y } = r);
    if (!r.chegou) { falhou = `parou em (${(x - cx).toFixed(1)}, ${(z - cz).toFixed(1)}) indo para ${pontos[k]}`; break; }
  }
  ok(!falhou, `rota ${nome}${falhou ? ': ' + falhou : ''}`);
}
const ida = [[0, -31], [0, -28], [0, -22], [0, -15], [0, -9], [3.2, -4], [3.2, 0], [16, 0], [20, 0], [20, 9], [20, 12], [20, 16], [8, 15.6], [-8, 15.6], [-20, 15.6], [-20, 11], [-20, 0], [-20, 6.5], [-15.5, 6.5], [-15.5, 0], [-9, 0], [-3.2, 0], [-3.2, 7], [0, 11.5], [0, 15.6]];
rota('entrada → Cortex → Contenção → Acelerador → Esteira → Cortex → Acelerador', ida);
rota('Acelerador → Cortex → átrio → rua', [[0, 15.6], [0, 11], [3.2, 7], [3.2, 0], [3.2, -4], [0, -9], [0, -15], [0, -24], [0, -31], [0, -66]]);
rota('volta no prédio pela praça (por baixo das passarelas)', [[0, -40], [-31, -40], [-31, 33], [31, 33], [31, -40], [0, -40]]);
rota('átrio → Contenção (porta do átrio) → Cortex', [[0, -17.5], [20, -17.5], [20, -15], [20, -9], [20, -3], [16, -1], [3.2, 0]]);
rota('átrio → Esteira (porta do átrio) → Acelerador', [[0, -17.5], [-20, -17.5], [-20, -15], [-20, -9], [-20, 9], [-20, 12], [-20, 15.6]]);
// de baixo do tubo do acelerador (y0 = 2,2) passa um corpo de 1,8 m
ok(!cid.empurrar(R, cx + 3, cz + TUBO_V(), 0.45, 0.3, 1.8).bateu, 'por baixo do tubo do acelerador (entre dois ímãs) passa um corpo de 1,8 m');
function TUBO_V() { return lab.TUBO.v; }

// ---- 4. telhado plano e caminhável; platibanda
{
  const t = plano.pontosDeInteresse.find((p) => p.nome === 'telhado');
  const TP = lab.TOPO;
  ok(cid.chaoEm(R, t.x, t.z, TP) === TP, `telhado em y = ${TP} sob (${(t.x - cx).toFixed(0)}, ${(t.z - cz).toFixed(0)})`);
  let y = TP, [x, z] = [t.x, t.z], tudo = true;
  for (const [u, v] of [[12, -18], [20, -8], [20, 6], [8, 19], [-10, 20], [-20, 4], [-20, -14], [-12, -18]]) { const r = anda(x, z, y, cx + u, cz + v); ({ x, z, y } = r); if (!r.chegou || y !== TP) tudo = false; }
  ok(tudo, `caminha pelo telhado ao redor da cúpula (y = ${TP}, sem cair)`);
  // o poço da cúpula: 20 × 20 m de H − 1 até o telhado
  ok(!R.some((q) => q.y1 > lab.H - 1.5 && Math.abs(q.x0 + q.x1 - 2 * cx) < 1 && cx >= q.x0 && cx <= q.x1 && cz >= q.z0 && cz <= q.z1), 'poço sob a cúpula (nada sólido sobre o centro do Cortex)');
  // escalada: a parede da frente vai até o telhado
  ok(R.some((q) => q.y1 === TP && q.z1 - q.z0 === 1 && Math.abs(q.z0 - (cz - 27)) < 1e-6 && q.x1 - q.x0 > 20), `parede da frente sobe até y = ${TP} (escalável)`);
  ok(R.some((q) => q.y1 === lab.TORRE.y1 && q.x1 - q.x0 === lab.TORRE.u1 - lab.TORRE.u0), `torre de ${lab.TORRE.y1} m sólida (escalável)`);
}

// ---- 5. dentro() coerente
{
  const esperado = { atrio: 'atrio', cortex: 'cortex', contencao: 'contencao', esteira: 'esteira', acelerador: 'acelerador', entrada: null, telhado: null };
  for (const p of plano.pontosDeInteresse) ok(plano.dentro(p.x, p.z, p.y) === esperado[p.nome], `dentro() em "${p.nome}" = ${plano.dentro(p.x, p.z, p.y)}`);
  ok(plano.dentro(cx, cz, 17) === null, 'dentro() acima do teto do Cortex = null');
  ok(plano.entrada.z < cxe.z0 - 3 && Math.abs(plano.entrada.x - cx) < 1 && plano.entrada.z > cmp.z0 + 20, 'entrada diante da porta, na praça do campus');
}

// ---- 6. navegador: orçamento, erros e prints
if (pastaPrints) {
  fs.mkdirSync(pastaPrints, { recursive: true });
  const { servidor, abrir } = await import(pathToFileURL(path.join(RAIZ, '../golaco/tools/lib/navegador.mjs')).href);
  const srv = await servidor(0, RAIZ);
  const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
  const so = args.includes('--cams') ? args[args.indexOf('--cams') + 1].split(',') : null;
  const cams = so || ['fora', 'fora2', 'fundo', 'entrada', 'atrio', 'atrio2', 'cortex', 'cortex2', 'cortexalto', 'contencao', 'contencao2', 'esteira', 'esteira2', 'acelerador', 'acelerador2', 'topo', 'telhado', 'campus', 'campus2', 'torre', 'anel', 'longe'];
  let maxCalls = 0, maxTris = 0;
  for (const noite of [0, 1]) for (const cam of cams) {
    if (noite && !so && !['fora', 'entrada', 'cortex', 'acelerador', 'topo', 'contencao', 'campus'].includes(cam)) continue;
    await pagina.goto(`${srv.url}lab.html?cam=${cam}${noite ? '&noite=1' : ''}`);
    await pagina.waitForFunction(() => window.__lab && window.__lab.quadros > 4, null, { timeout: 120000 });
    const info = await pagina.evaluate(() => { const i = window.__lab.renderer.info.render; return { calls: i.calls, tris: i.triangles }; });
    maxCalls = Math.max(maxCalls, info.calls); maxTris = Math.max(maxTris, info.tris);
    await pagina.screenshot({ path: path.join(pastaPrints, `${cam}${noite ? '-noite' : ''}.png`) });
  }
  const total = await pagina.evaluate(() => { let t = 0; window.__lab.lab.geos.forEach((g) => { t += g.index ? g.index.count / 3 : 0; }); return { tris: t, meshes: window.__lab.lab.grupo.children.length }; });
  ok(maxCalls <= 60, `chamadas de desenho no pior quadro: ${maxCalls} (meta ≤ 60; inclui chão e laje da página de teste)`);
  ok(total.tris <= 150000, `triângulos do laboratório: ${Math.round(total.tris)} (meta ≤ 150 mil); maior quadro: ${maxTris}`);
  ok(erros.length === 0, `sem erros no console (${erros.slice(0, 3).join(' | ')})`);
  await navegador.close(); await srv.fechar();
}
process.exit(falhas ? 1 : 0);
