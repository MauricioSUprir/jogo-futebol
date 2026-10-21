// Estádio com FORMA PRÓPRIA (js/estadio-planta.js, pura; pedido do dono de 16/10: "não tem nada a ver com o maracanã").
// A 1ª família (tigela oval com anel de cobertura, o Maracanã de assets/tm/estadios.json) contra as metas da pesquisa
// e contra o que já existe (o gramado e a simulação não mudam):
//   F1) a forma da base é válida: a 1ª fileira contém a quina das placas com ≥ 1,5 m e passa pela boca do túnel (x = 0);
//   F2) medidas da pesquisa: furo da cobertura 160 × 122 (± 5 m), profundidade da cobertura 68 m, fachada ~304 × 266,
//       a última fileira a ~25 m;
//   F3) os lugares da torcida: no degrau (≤ 5 cm), nenhum na boca do túnel nem com a cabeça dentro de um sólido, nos 4
//       setores; a torcida de cada qualidade com até 15% a mais e até 30% a menos de torcedores que a de hoje (cadeiras à mostra);
//   F4) a festa no lugar: sinalizadores e bandeiras de mastro no degrau, faixas sem se encostar e na frente da mureta,
//       bandeirões sem furar a cabeça de ninguém (o mais alto, 2,15 m, embaixo do pano);
//   F5) a câmera de TV (PC e celular, a bola em qualquer lugar do campo) nunca dentro da cobertura nem de um sólido que
//       fique no desenho; dentro da tigela de cá só com o lado de cá fora do desenho (cameraNoLadoDeCa);
//   F6) sem forma, nada muda: solidoEm igual ao de antes num grid de pontos (definirForma(null)) e a torcida de hoje.
//   node tools/teste-estadio-forma.mjs [--js <pasta js>]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let PL = null;
try { PL = await imp('estadio-planta.js'); } catch (_) { PL = null; }
if (!PL) {
  reg('forma própria do estádio (js/estadio-planta.js)', 'não existe (todo estádio é a mesma caixa)', 'existe', false);
} else {
  const { CAMPO, ESTADIO, CAMERA } = await imp('config.js');
  const F = await imp('estadio-forma.js');
  const TD = await imp('render/torcida-dados.js');
  const BD = await imp('render/bandeiras-dados.js');
  const base = JSON.parse(fs.readFileSync(path.join(pastaJs, '../assets/tm/estadios.json'), 'utf8'));
  const bruta = base.estadios.maracana?.forma;
  const forma = PL.validarForma(bruta);
  const P = forma ? PL.criarPlanta(forma) : null;
  // F6 antes de ligar a forma: o grid de pontos de hoje
  const grid = [];
  for (let x = -110; x <= 110; x += 7.3) for (let z = -100; z <= 100; z += 6.1) for (const y of [0.5, 2, 6, 14, 24, 31]) grid.push([x, y, z]);
  const antes = grid.map(([x, y, z]) => F.solidoEm(x, y, z, 0.3, true) + '|' + F.solidoEm(x, y, z, 0.3, false));
  const tAntes = TD.gerarTorcidaNiveis();

  // F1
  const PX = CAMPO.meioX + CAMPO.entorno + 0.14, PZ = CAMPO.meioZ + CAMPO.entorno + 0.14;
  const folgaQuina = P ? P.rF(Math.atan2(PZ, PX)) - Math.hypot(PX, PZ) : -1;
  reg('F1 a forma do Maracanã na base é válida (tigela)', P ? `${P.familia}; frente ${fmt(forma.frente.a, 1)} × ${fmt(forma.frente.b, 1)} n ${fmt(forma.frente.n, 2)}` : 'inválida', 'tigela', !!P);
  if (P) {
    reg('F1 a 1ª fileira contém a quina das placas e passa pela boca do túnel', `quina ${fmt(folgaQuina, 2)} m; frente em x = 0: ${fmt(P.rF(Math.PI / 2), 2)} m (túnel ${ESTADIO.tunel.z})`, '≥ 1,5 m; = túnel', folgaQuina >= 1.5 && Math.abs(P.rF(Math.PI / 2) - ESTADIO.tunel.z) < 0.01);
    // F2
    const furoX = 2 * P.rCobDentro(0), furoZ = 2 * P.rCobDentro(Math.PI / 2);
    let profMin = Infinity, profMax = 0;
    for (let t = 0; t < 2 * Math.PI; t += 0.05) {
      // distância da borda de dentro à de fora pela normal da elipse de fora
      const C = forma.cobertura, cx = C.a * Math.cos(t), cz = C.b * Math.sin(t);
      let best = Infinity;
      for (let k = 0; k < 720; k++) { const a = (2 * Math.PI * k) / 720, r = P.rCobDentro(a); best = Math.min(best, Math.hypot(cx - r * Math.cos(a), cz - r * Math.sin(a))); }
      profMin = Math.min(profMin, best); profMax = Math.max(profMax, best);
    }
    reg('F2 furo da cobertura 160 × 122 m (Structurae) e profundidade constante de 68 m', `${fmt(furoX, 1)} × ${fmt(furoZ, 1)} m; profundidade ${fmt(profMin, 1)}–${fmt(profMax, 1)} m`, '± 5 m; 68 ± 1,5 m', Math.abs(furoX - 160) <= 5 && Math.abs(furoZ - 122) <= 5 && profMin >= 66.5 && profMax <= 69.5);
    reg('F2 fachada ~304 × 266 m (60 eixos) e a última fileira a ~25 m', `${fmt(2 * forma.fachada.a, 0)} × ${fmt(2 * forma.fachada.b, 0)} m, ${forma.fachada.eixos} eixos; topo ${fmt(P.perfil(1), 1)} m`, '300–320 × 260–285; 24–26 m', 2 * forma.fachada.a >= 300 && 2 * forma.fachada.a <= 320 && 2 * forma.fachada.b >= 260 && 2 * forma.fachada.b <= 285 && P.perfil(1) >= 24 && P.perfil(1) <= 26);

    // liga a forma (como render/estadio-real.js ligarForma, sem o desenho)
    F.definirForma(P); TD.definirLadoDeCa(P.cameraNoLadoDeCa); BD.definirFormaBandeiras(P);
    // F3 lugares
    const L = P.lugares;
    let foraDegrau = 0, noTunel = 0, cabecaSolida = 0, maxErr = 0;
    const porSetor = [0, 0, 0, 0], exemplos = [];
    const T = ESTADIO.tunel;
    L.iterar((st, f, a, x, y, z, esc) => {
      porSetor[st]++;
      const s = P.sDe(x, z), e = Math.abs(P.perfil(s) - y);
      maxErr = Math.max(maxErr, e);
      if (e > 0.05) foraDegrau++;
      if (z > 0 && Math.abs(x) < T.largura / 2 + 0.4 && y < T.altura + T.laje + 0.3) noTunel++;
      const sol = F.solidoEm(x, y + 1.7 * esc, z, 0, true);
      if (sol) { cabecaSolida++; if (exemplos.length < 3) exemplos.push(`${sol} (${fmt(x, 1)}, ${fmt(y, 1)}, ${fmt(z, 1)})`); }
    });
    reg('F3 lugares no degrau (≤ 5 cm), nenhum na boca do túnel, cabeça fora dos sólidos', `${L.n} lugares (${porSetor.join('/')}); fora do degrau ${foraDegrau} (máx ${fmt(maxErr * 100, 1)} cm); túnel ${noTunel}; cabeça em sólido ${cabecaSolida}${exemplos.length ? ': ' + exemplos.join(', ') : ''}`, '0; 0; 0; os 4 setores', foraDegrau === 0 && noTunel === 0 && cabecaSolida === 0 && porSetor.every(n => n > 1000));
    const tF = TD.gerarTorcidaNiveis(null, null, L);
    const conta = d => { const c = [0, 0, 0]; for (const g of d.faixas) for (let q = 0; q < 3; q++) c[q] += g.porNivel[q]; return [c[0], c[0] + c[1], c[0] + c[1] + c[2]]; };
    const ca = conta(tAntes), cf = conta(tF);
    // até 15% a MAIS (o custo no celular) e até 30% a menos: a rodada 1 da prévia deixa ~15% das cadeiras do mosaico à
    // mostra (escadas, fileiras de cima, manchas, setor visitante) — "o vermelho em 100% apaga o Maracanã"
    const okQ = cf.every((v, q) => (v - ca[q]) / ca[q] <= 0.15 && (ca[q] - v) / ca[q] <= 0.3);
    reg('F3 torcida por qualidade (Baixa/Média/Alta): +15% / −30% da de hoje', `${cf.join('/')} × hoje ${ca.join('/')}`, '+15% / −30%', okQ);
    // F4 festa
    const sinal = P.sinalizadores(), errS = [];
    for (const k of ['organizada', 'quinas', 'visitante']) for (const [x, y, z] of sinal[k]) { const e = Math.abs(P.perfil(P.sDe(x, z)) - y); if (e > 0.05 || P.sDe(x, z) < 0) errS.push(`${k} ${fmt(e * 100, 0)} cm`); }
    const band = BD.bandeiras(), errB = band.filter(b => Math.abs(P.perfil(P.sDe(b.x, b.z)) + 1.45 - b.y) > 0.05 || P.sDe(b.x, b.z) < 0).length;
    reg('F4 sinalizadores e bandeiras de mastro no degrau', `sinalizadores ${errS.length ? errS.join(', ') : 'todos'}; bandeiras ${band.length - errB}/${band.length}`, 'todos', errS.length === 0 && errB === 0 && band.length === 32);
    const fx = BD.faixas().filter(f => f.setor === 0).sort((a, b) => a.centro - b.centro);
    let encosta = 0, maxVao = 0, atras = 0;
    for (let i = 0; i < fx.length; i++) {
      if (i && fx[i].centro - fx[i].larg / 2 < fx[i - 1].centro + fx[i - 1].larg / 2 + 0.3) encosta++;
      for (const x of [fx[i].centro - fx[i].larg / 2, fx[i].centro, fx[i].centro + fx[i].larg / 2]) {
        const th = Math.atan2(fx[i].z, x), zF = P.rF(Math.atan2(-44, x)) * Math.sin(Math.atan2(-44, x));
        void th;
        const vao = fx[i].z - zF;
        if (vao < -0.02) atras++;
        maxVao = Math.max(maxVao, vao);
      }
    }
    reg('F4 faixas do lado de lá sem se encostar, na frente da mureta (vão ≤ 1,2 m)', `${fx.length} faixas; encostadas ${encosta}; atrás da mureta ${atras}; maior vão ${fmt(maxVao, 2)} m`, '0; 0; ≤ 1,2 m', encosta === 0 && atras === 0 && maxVao <= 1.2);
    let furam = 0;
    for (const b of BD.bandeiroes()) {
      L.iterar((st, f, a, x, y, z, esc) => {
        // projeção no pano (U, V); embaixo dele: a cabeça (2,15 m · escala) fica abaixo do plano (pela normal)
        const d = [x - b.A[0], y - b.A[1], z - b.A[2]];
        const lu = (d[0] * b.U[0] + d[1] * b.U[1] + d[2] * b.U[2]) / (b.larg * b.larg), lv = (d[0] * b.V[0] + d[1] * b.V[1] + d[2] * b.V[2]) / (b.prof * b.prof);
        if (lu < 0 || lu > 1 || lv < 0 || lv > 1) return;
        const h = [x - b.A[0], y + 2.15 * esc - b.A[1], z - b.A[2]];
        if (h[0] * b.N[0] + h[1] * b.N[1] + h[2] * b.N[2] > 0) furam++;
      });
    }
    reg('F4 bandeirões sem furar a cabeça de ninguém embaixo', `${furam} cabeças acima do pano`, '0', furam === 0);
    // F5 câmera de TV
    const ruins = [], semEsconder = [];
    let nCa = 0, pontos = 0;
    for (const perfil of [{ d: CAMERA.distancia, h: CAMERA.altura }, { d: CAMERA.celular.distancia, h: CAMERA.celular.altura }]) {
      for (let bx = -50; bx <= 50; bx += 5) for (let bz = -34; bz <= 34; bz += 4) {
        const p = { x: bx * 0.92, y: perfil.h, z: bz + perfil.d };
        pontos++;
        const s = P.solido(p.x, p.y, p.z, 0.3, false, false);
        const naCa = P.cameraNoLadoDeCa(p);
        if (naCa) nCa++;
        if (s && s !== 'arquibancada') ruins.push(`${s} (${fmt(p.x, 0)}, ${fmt(p.y, 1)}, ${fmt(p.z, 0)})`);
        if (s === 'arquibancada' && !naCa) semEsconder.push(`(${fmt(p.x, 0)}, ${fmt(p.z, 0)})`);
      }
    }
    reg('F5 câmera de TV (PC e celular) fora da cobertura e dos sólidos; dentro do lado de cá só com ele escondido', `${pontos} posições: ${ruins.length} em sólido${ruins.length ? ' (' + ruins.slice(0, 2).join(', ') + ')' : ''}; ${semEsconder.length} na tigela sem esconder; ${nCa} com o lado de cá escondido`, '0; 0', ruins.length === 0 && semEsconder.length === 0);
    // F6 sem forma: tudo como antes
    F.definirForma(null); TD.definirLadoDeCa(null); BD.definirFormaBandeiras(null);
    const depois = grid.map(([x, y, z]) => F.solidoEm(x, y, z, 0.3, true) + '|' + F.solidoEm(x, y, z, 0.3, false));
    const dif = depois.filter((v, i) => v !== antes[i]).length;
    const t2 = TD.gerarTorcidaNiveis();
    const igualT = t2.n === tAntes.n && t2.pos.every((v, i) => v === tAntes.pos[i]);
    reg('F6 sem forma nada muda (sólidos num grid e a torcida de hoje)', `${dif} de ${grid.length} pontos diferentes; torcida ${igualT ? 'igual' : 'diferente'} (${t2.n})`, '0; igual', dif === 0 && igualT);
  }
}
console.log(tabelaTexto(linhas));
console.log(`\nteste-estadio-forma: ${falhas ? `REPROVOU (${falhas})` : 'PASSOU'}`);
process.exit(falhas ? 1 : 0);
