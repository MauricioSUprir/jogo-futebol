// Teste dos OBJETOS DA RUA (js/objetos.js): onde ficam (na calçada, fora dos prédios, postes e árvores; nada nos lugares da
// história nem no campus) e o que o herói faz com eles — o hidrante estoura passando raspando em velocidade (e volta
// depois do jato), a lixeira voa, cai deitada e volta ao lugar com o herói longe, o cachorro-quente enche a energia uma
// vez por parada (e espera para o próximo), os pombos voam com o susto e não com quem passa devagar longe.
// Uso: node velocista/tools/teste-objetos.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const imp = (f) => import(pathToFileURL(path.join(AQUI, '../js', f)).href);
const O = await imp('objetos.js'), cid = await imp('cidade.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };

// ---- 1. onde ficam
const cont = {}; let ruins = 0, total = 0, emMarco = 0;
for (let i = 0; i < cid.N; i++) for (let j = 0; j < cid.N; j++) {
  const b = cid.bloco(i, j), os = O.objetosDoBloco(i, j);
  if ((b.tipo === 'marco' || b.tipo === 'lab') && os.length) emMarco++;
  for (const o of os) {
    total++; cont[o.tipo] = (cont[o.tipo] || 0) + 1;
    const naCalcada = cid.alturaDoChao(o.x, o.z) === cid.CALCADA;
    const R = cid.retangulosPerto(o.x, o.z, 0), bate = cid.empurrar(R, o.x, o.z, 0.25, cid.CALCADA, 1.8).bateu;
    if (!naCalcada || bate) ruins++;
  }
}
ok(ruins === 0, `${total} objetos na calçada, nenhum dentro de prédio ou poste (${ruins} fora do lugar)`);
ok(emMarco === 0, 'nada nos lugares da história nem no campus do laboratório');
ok(cont.hidrante > 1000 && cont.lixeira > 2000 && cont.jornal > 300 && cont.lanche > 100 && cont.pombos > 300, `de tudo um pouco (${JSON.stringify(cont)})`);
ok(JSON.stringify(O.objetosDoBloco(10, 12)) === JSON.stringify(O.objetosDoBloco(10, 12)), 'sempre no mesmo lugar');

// ---- 2. o que o herói faz com eles
const todos = []; for (let i = 0; i < cid.N; i++) for (let j = 0; j < cid.N; j++) todos.push(...O.objetosDoBloco(i, j));
const um = (tipo) => todos.find((o) => o.tipo === tipo);
function passar(ob, o, { v = 30, d = 0.6, segs = 2, dt = 1 / 30, ficar = false } = {}) {
  // o herói passa em linha reta ao lado do objeto (ou fica parado ao lado), a `v` m/s; devolve os acontecimentos
  const P = { x: o.x - v * segs / 2, y: cid.CALCADA, z: o.z + d, vx: v, vz: 0 }, ev = [];
  if (ficar) Object.assign(P, { x: o.x + d, z: o.z, vx: 0 });
  for (let t = 0; t < segs; t += dt) { if (!ficar) P.x += v * dt; ev.push(...ob.atualizar(dt, P, [o])); }
  return { ev, P };
}
const longe = (ob, o, segs, dt = 0.5) => { for (let t = 0; t < segs; t += dt) ob.atualizar(dt, { x: o.x + 200, y: 0.3, z: o.z, vx: 0, vz: 0 }, [o]); };
{
  const ob = O.criarObjetos(), h = um('hidrante');
  ok(!passar(ob, h, { v: 8 }).ev.length, 'hidrante: passando devagar, nada');
  const r = passar(ob, h, { v: 30 });
  ok(r.ev.some((e) => e.tipo === 'hidrante') && ob.estado(h)?.jato, 'hidrante: passando a 30 m/s, estoura no jato');
  longe(ob, h, 13);
  ok(!ob.estado(h), 'e o jato acaba sozinho');
}
{
  const ob = O.criarObjetos(), l = um('lixeira');
  ok(!passar(ob, l, { v: 12 }).ev.length, 'lixeira: a 12 m/s, fica');
  passar(ob, l, { v: 45, segs: 0.4 });
  const e = ob.estado(l);
  ok(e?.voando && e.vy > 0, 'lixeira: a 45 m/s, voa');
  longe(ob, l, 4, 1 / 30);
  const e2 = ob.estado(l);
  ok(e2?.caido && Math.hypot(e2.x - l.x, e2.z - l.z) > 2 && Math.abs(e2.y - cid.alturaDoChao(e2.x, e2.z)) < 1e-6, `cai deitada no chão, longe do lugar (${e2 && Math.hypot(e2.x - l.x, e2.z - l.z).toFixed(1)} m)`);
  longe(ob, l, 30);
  ok(!ob.estado(l), 'e volta ao lugar com o herói longe');
}
{
  const ob = O.criarObjetos(), c = um('lanche');
  const r = passar(ob, c, { ficar: true, d: 1.5, segs: 1.5 });
  ok(r.ev.filter((e) => e.tipo === 'lanche').length === 1 && r.ev[0].energia > 0, 'cachorro-quente: parado do lado, um lanche (+energia)');
  ok(!passar(ob, c, { ficar: true, d: 1.5, segs: 3 }).ev.length, 'e o próximo só depois de um tempo');
  ok(!passar(O.criarObjetos(), c, { v: 20, d: 1.2 }).ev.length, 'passando correndo, não come');
}
{
  const ob = O.criarObjetos(), p = um('pombos');
  ok(!passar(ob, p, { v: 2, d: 7 }).ev.length, 'pombos: alguém andando a 7 m, ficam');
  ok(passar(ob, p, { v: 20, d: 6 }).ev.some((e) => e.tipo === 'pombos') && ob.estado(p)?.voando, 'o Flash passando a 6 m: voam');
  const no = O.pomboNoAr(p, ob.estado(p), 2, 7, 2);
  ok(no.y > 5 && Math.hypot(no.x - p.x, no.z - p.z) > 8, `subindo e para longe (${no.y.toFixed(1)} m de altura em 2 s)`);
}
process.exit(falhas ? 1 : 0);
