// Teste dos PEDESTRES (js/pedestres.js), em Node com o three.js de verdade (baixado do jsdelivr uma vez):
// com o herói parado perto, quem é "da foto" levanta o celular e o flash pisca, quem é "da festa" ergue os braços;
// com um perigo a até 45 m, as pessoas fogem (ficam mais longe dele e correm); com a vitória, quem está em volta comemora
// mesmo com o herói passando correndo longe. Lê os atributos que vão para o shader (iGesto, iAnim).
// Uso: node velocista/tools/teste-pedestres.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const arq = path.join(os.tmpdir(), 'three-0.170.0.module.js');
if (!fs.existsSync(arq)) execFileSync('curl', ['-sSfL', '-o', arq, 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js']);
const THREE = await import(pathToFileURL(arq).href);
const { criarPedestres, FUGA, FESTA } = await import('../js/pedestres.js');
let falhas = 0;
const ok = (c, msg) => { console.log(`${c ? 'OK ' : 'ERRO'} ${msg}`); if (!c) falhas++; };
const cena = { add() {}, remove() {} };
const dt = 1 / 30, rodar = (ped, s, J, extra) => { for (let t = 0; t < s; t += dt) ped.atualizar(dt, J, 0, typeof extra === 'function' ? extra() : extra); };

// 1) o herói parado perto de cada uma: foto com flash ou braços para cima
{
  const ped = criarPedestres(THREE, cena, { semente: 7 }), G = ped.malha.geometry.attributes.iGesto;
  const J = { x: 0, z: 0, vx: 0, vz: 0 };
  rodar(ped, 0.5, J);
  const conta = { foto: [0, 0, 0], festa: [0, 0], nada: [0, 0], cruza: 0 };
  for (let k = 0; k < 24; k++) {
    const p = ped.pessoas[k]; if (!p.vivo) continue;
    Object.assign(J, { x: p.x + 4, z: p.z, vx: 0, vz: 0 });
    let flashes = 0, f0 = 0;
    for (let t = 0; t < 4.5; t += dt) { ped.atualizar(dt, J, 0); const f = G.getZ(k); if (f > 0.9 && f0 <= 0.9) flashes++; f0 = f; }
    const festa = G.getX(k), foto = G.getY(k), j = p.jeito || 'nada';
    if (p.estado === 'cruza' || p.cruzando) conta.cruza++;            // atravessando a rua: termina a travessia, não para no asfalto
    else if (j === 'foto') { conta.foto[0]++; if (foto > 0.9 && festa < 0.1) conta.foto[1]++; if (flashes >= 1) conta.foto[2]++; }
    else if (j === 'festa') { conta.festa[0]++; if (festa > 0.9 && foto < 0.1) conta.festa[1]++; }
    else { conta.nada[0]++; if (festa < 0.1 && foto < 0.1) conta.nada[1]++; }
    Object.assign(J, { x: p.x + 60, z: p.z + 60 }); rodar(ped, 1, J);               // sai de perto: os gestos acabam
    ok(G.getX(k) < 0.05 && G.getY(k) < 0.05, `#${k} (${j}): sem o herói perto, o gesto acaba`);
  }
  ok(conta.foto[0] >= 3 && conta.foto[1] === conta.foto[0], `foto: ${conta.foto[1]}/${conta.foto[0]} levantam o celular`);
  ok(conta.foto[2] === conta.foto[0], `foto: ${conta.foto[2]}/${conta.foto[0]} piscam o flash`);
  ok(conta.festa[0] >= 3 && conta.festa[1] === conta.festa[0], `festa: ${conta.festa[1]}/${conta.festa[0]} erguem os braços`);
  ok(conta.nada[1] === conta.nada[0], `os outros ${conta.nada[1]}/${conta.nada[0]} só olham (${conta.cruza} atravessando seguem)`);
}
// 2) o perigo perto: fogem (mais longe dele, correndo) e param de fugir depois que ele some
{
  const ped = criarPedestres(THREE, cena, { semente: 3 }), A = ped.malha.geometry.attributes.iAnim;
  const J = { x: 0, z: 0, vx: 0, vz: 0 };
  rodar(ped, 0.5, J);
  const perigo = { x: 15, z: 10 };
  const alvo = ped.pessoas.map((p, k) => ({ k, p, d0: Math.hypot(p.x - perigo.x, p.z - perigo.z) })).filter((o) => o.p.vivo && o.d0 < FUGA.raio - 5);
  rodar(ped, 3, J, { perigos: [perigo] });
  const ganho = alvo.map((o) => Math.hypot(o.p.x - perigo.x, o.p.z - perigo.z) - o.d0), media = ganho.reduce((a, b) => a + b, 0) / (ganho.length || 1);
  const correndo = alvo.filter((o) => A.getY(o.k) > 0.8).length;
  ok(alvo.length >= 4 && media > 5, `${alvo.length} pessoas a até ${FUGA.raio - 5} m do perigo: ${media.toFixed(1)} m mais longe em 3 s (> 5)`);
  ok(correndo >= alvo.length * 0.8, `${correndo}/${alvo.length} correm (braços e pernas embalados)`);
  rodar(ped, FUGA.depois + 1, J, { perigos: [] });
  ok(alvo.every((o) => o.p.medo <= 0), 'sem o perigo, param de fugir');
}
// 3) a vitória: quem está em volta comemora, mesmo com o herói passando longe e rápido
{
  const ped = criarPedestres(THREE, cena, { semente: 5 }), G = ped.malha.geometry.attributes.iGesto;
  const J = { x: 0, z: 0, vx: 0, vz: 0 };
  rodar(ped, 0.5, J);
  const lugar = { x: 0, z: 0 }, perto = ped.pessoas.map((p, k) => ({ p, k })).filter((o) => o.p.vivo && Math.hypot(o.p.x, o.p.z) < FESTA.raio - 2);
  Object.assign(J, { x: 70, z: 0, vx: 0, vz: 40 });
  ped.atualizar(dt, J, 0, { festa: lugar });
  rodar(ped, 1.2, J);
  const festa = perto.filter((o) => G.getX(o.k) > 0.9).length;
  ok(perto.length >= 4 && festa >= perto.length * 0.9, `${festa}/${perto.length} a até ${FESTA.raio} m comemoram`);
  rodar(ped, FESTA.tempo * 1.4 + 1, J);
  ok(perto.every((o) => G.getX(o.k) < 0.05), 'a festa acaba sozinha');
}
process.exit(falhas ? 1 : 0);
