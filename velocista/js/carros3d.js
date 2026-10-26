// OS CARROS DA CIDADE (dono, 26/10: "melhore as texturas ... assim como os carros"): seis modelos com a forma de carro de
// verdade, no lugar da caixa com cabine: sedã, hatch, utilitário (SUV), van, táxi e viatura da polícia. Cada um é o perfil
// lateral extrudado na largura com as bordas arredondadas e os ARCOS DAS RODAS recortados, a estufa de vidro mais estreita
// que a carroceria (como nos carros de verdade), o teto, as colunas, os para-choques, a grade, os espelhos, as placas e as
// rodas com pneu, aro e cubo. Cor por vértice (a carroceria em branco, para a cor de cada instância) e o atributo `luz`
// (a cor dos faróis, lanternas e do giroflex) para o material acender sem uma malha a mais. Frente em +x.
// Sem DOM (o THREE vem por parâmetro): roda nos testes em Node.

const PRETO = [0.04, 0.04, 0.045], PNEU = [0.06, 0.06, 0.065], ARO = [0.62, 0.63, 0.66], VIDRO = [0.05, 0.07, 0.1], CINZA = [0.2, 0.21, 0.23];
const BRANCO = [1, 1, 1], PLACA = [0.92, 0.92, 0.88], ESCURO = [0.08, 0.08, 0.09];
// (o giroflex com o canal acima de 1,5: o material faz piscar o vermelho e o azul alternados)
const FAROL = [1, 0.95, 0.8], LANTERNA = [1, 0.08, 0.05], AZUL = [0.3, 0.7, 2], VERMELHO = [2, 0.2, 0.16];

// as medidas de cada modelo: comprimento, largura, entre-eixos/2, raio da roda, altura do chão, linha da cintura, teto,
// e o perfil da estufa (x da base do para-brisa, x do alto do para-brisa, x do alto do vidro de trás, x da base dele)
export const MODELOS = {
  sedan: { L: 4.5, W: 1.8, eixo: 1.38, roda: 0.33, chao: 0.3, cint: 0.96, teto: 1.43, estufa: [0.95, 0.22, -0.88, -1.6], capo: 0.82, mala: 0.92 },
  hatch: { L: 4.0, W: 1.76, eixo: 1.25, roda: 0.32, chao: 0.3, cint: 0.95, teto: 1.47, estufa: [0.9, 0.15, -1.38, -1.82], capo: 0.82, mala: 0.98 },
  suv: { L: 4.6, W: 1.9, eixo: 1.42, roda: 0.39, chao: 0.42, cint: 1.12, teto: 1.75, estufa: [1.05, 0.38, -1.62, -2.08], capo: 1.02, mala: 1.12 },
  van: { L: 5.0, W: 1.95, eixo: 1.62, roda: 0.36, chao: 0.36, cint: 1.15, teto: 2.25, estufa: [1.75, 1.15, -2.38, -2.42], capo: 1.0, mala: 1.15 },
  taxi: null, policia: null,
};
MODELOS.taxi = { ...MODELOS.sedan, extra: 'taxi' };
MODELOS.policia = { ...MODELOS.sedan, extra: 'policia' };
export const TIPOS = Object.keys(MODELOS);

// `tinta` = 1 só na lataria (BRANCO): a cor de cada carro tinge ela e não os pneus, aros, vidros e luzes
function pintar(THREE, g, cor, luz = [0, 0, 0]) {
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  const n = g.attributes.position.count, c = new Float32Array(n * 3), l = new Float32Array(n * 3), t = new Float32Array(n).fill(cor === BRANCO ? 1 : 0);
  for (let i = 0; i < n; i++) { c.set(cor, i * 3); l.set(luz, i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('luz', new THREE.BufferAttribute(l, 3)); g.setAttribute('tinta', new THREE.BufferAttribute(t, 1));
  return g;
}
function caixa(THREE, w, h, d, x, y, z, cor, luz) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return pintar(THREE, g, cor, luz); }
// um perfil [x, y] extrudado na largura (centrado em z = 0), com as bordas arredondadas
function perfil(THREE, forma, largura, borda, cor, leve = false) {
  const g = leve ? new THREE.ExtrudeGeometry(forma, { depth: largura, bevelEnabled: false, curveSegments: 3 })
    : new THREE.ExtrudeGeometry(forma, { depth: Math.max(0.01, largura - 2 * borda), bevelEnabled: true, bevelThickness: borda, bevelSize: borda * 0.85, bevelSegments: 2, curveSegments: 7 });
  g.translate(0, 0, leve ? -largura / 2 : -(largura - 2 * borda) / 2);
  return pintar(THREE, g, cor);
}
function juntar(THREE, gs) {
  let n = 0; for (const g of gs) n += g.attributes.position.count;
  const r = new THREE.BufferGeometry(), at = { position: 3, normal: 3, color: 3, luz: 3, tinta: 1 };
  for (const [k, s] of Object.entries(at)) {
    const a = new Float32Array(n * s); let o = 0;
    for (const g of gs) { a.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    r.setAttribute(k, new THREE.BufferAttribute(a, s));
  }
  for (const g of gs) g.dispose();
  r.computeBoundingSphere(); return r;
}

/** A geometria de um modelo (frente em +x, rodas no chão em y = 0). Atributos: position, normal, color, luz. `leve`: a dos
 *  estacionados (são centenas em volta): menos segmentos, sem espelhos, placas, grade nem cubo. */
export function geometriaCarro(THREE, tipo = 'sedan', { leve = false } = {}) {
  const M = MODELOS[tipo] || MODELOS.sedan, { L, W, eixo, roda, chao, cint, teto } = M, f = L / 2;
  const [eb, et, rt, rb] = M.estufa, partes = [];
  // a carroceria de baixo (até a cintura): frente arredondada, capô, cintura, tampa da mala e os arcos das rodas
  const s = new THREE.Shape(), ra = roda + 0.07, wy = roda;
  s.moveTo(f - 0.06, chao);
  s.lineTo(f, chao + 0.28); s.quadraticCurveTo(f + 0.02, M.capo, f - 0.32, M.capo + 0.02);
  s.lineTo(eb + 0.05, cint - 0.02); s.lineTo(rb, cint);
  s.lineTo(-f + 0.3, M.mala); s.quadraticCurveTo(-f, M.mala - 0.02, -f, chao + 0.3); s.lineTo(-f + 0.06, chao);
  s.lineTo(-eixo - ra, chao); s.lineTo(-eixo - ra, wy); s.absarc(-eixo, wy, ra, Math.PI, 0, true); s.lineTo(-eixo + ra, chao);
  s.lineTo(eixo - ra, chao); s.lineTo(eixo - ra, wy); s.absarc(eixo, wy, ra, Math.PI, 0, true); s.lineTo(eixo + ra, chao);
  s.lineTo(f - 0.06, chao);
  partes.push(perfil(THREE, s, W, 0.1, BRANCO, leve));
  // a estufa de vidro, mais estreita, e o teto por cima dela
  const v = new THREE.Shape();
  v.moveTo(eb, cint - 0.04); v.lineTo(et, teto - 0.06); v.lineTo(rt, teto - 0.06); v.lineTo(rb, cint - 0.04); v.lineTo(eb, cint - 0.04);
  partes.push(perfil(THREE, v, W - 0.26, 0.05, VIDRO, leve));
  const t = new THREE.Shape(), tx0 = et + 0.08, tx1 = rt - 0.05;
  t.moveTo(tx0, teto - 0.08); t.lineTo(tx0 - 0.04, teto); t.lineTo(tx1 + 0.04, teto); t.lineTo(tx1, teto - 0.08); t.lineTo(tx0, teto - 0.08);
  if (!leve) partes.push(perfil(THREE, t, W - 0.2, 0.04, BRANCO));
  // colunas do meio (B) e do fundo, na cor do carro
  const meio = (eb + rb) / 2 - 0.1;
  for (const z of [1, -1]) {
    if (!leve) partes.push(caixa(THREE, 0.12, teto - cint, 0.06, meio, (teto + cint) / 2 - 0.03, z * (W / 2 - 0.13), BRANCO));
    if (!leve) partes.push(caixa(THREE, 0.14, 0.1, 0.18, eb - 0.12, cint + 0.06, z * (W / 2 + 0.03), BRANCO));        // espelho
  }
  // para-choques, grade, placas e as luzes (o atributo `luz` acende no material)
  partes.push(caixa(THREE, 0.16, 0.2, W - 0.06, f - 0.02, chao + 0.14, 0, CINZA), caixa(THREE, 0.16, 0.2, W - 0.06, -f + 0.02, chao + 0.16, 0, CINZA));
  if (!leve) {
    partes.push(caixa(THREE, 0.06, 0.16, W * 0.42, f + 0.01, chao + 0.4, 0, ESCURO));
    partes.push(caixa(THREE, 0.03, 0.12, 0.42, f + 0.08, chao + 0.15, 0, PLACA), caixa(THREE, 0.03, 0.12, 0.42, -f - 0.08, chao + 0.36, 0, PLACA));
  }
  for (const z of leve ? [] : [1, -1]) {                       // (os estacionados ganham as luzes à parte, no balde das lâmpadas)
    partes.push(caixa(THREE, 0.06, 0.13, 0.36, f + 0.07, chao + 0.42, z * (W / 2 - 0.3), [0.2, 0.2, 0.18], FAROL));          // (à frente do chanfro da lataria)
    partes.push(caixa(THREE, 0.06, 0.14, 0.32, -f - 0.07, M.mala - 0.18, z * (W / 2 - 0.26), [0.25, 0.03, 0.02], LANTERNA));
  }
  // rodas: pneu, aro e cubo
  const pneu = new THREE.CylinderGeometry(roda, roda, 0.24, leve ? 9 : 16); pneu.rotateX(Math.PI / 2);
  const aro = new THREE.CylinderGeometry(roda * 0.62, roda * 0.62, 0.02, leve ? 7 : 12); aro.rotateX(Math.PI / 2);
  const cubo = new THREE.CylinderGeometry(roda * 0.18, roda * 0.18, 0.03, 8); cubo.rotateX(Math.PI / 2);
  for (const x of [eixo, -eixo]) for (const z of [1, -1]) {
    const zr = z * (W / 2 - 0.1);
    partes.push(pintar(THREE, pneu.clone().translate(x, roda, zr), PNEU));
    partes.push(pintar(THREE, aro.clone().translate(x, roda, zr + z * 0.12), ARO));
    if (!leve) partes.push(pintar(THREE, cubo.clone().translate(x, roda, zr + z * 0.135), CINZA));
  }
  pneu.dispose(); aro.dispose(); cubo.dispose();
  // o que só o táxi e a viatura têm: a placa de TÁXI no teto; o giroflex e as portas pretas
  if (M.extra === 'taxi') partes.push(caixa(THREE, 0.32, 0.16, 0.62, (tx0 + tx1) / 2, teto + 0.08, 0, [0.95, 0.95, 0.9], [0.9, 0.8, 0.4]));
  if (M.extra === 'policia') {
    const cx = (tx0 + tx1) / 2;
    partes.push(caixa(THREE, 0.26, 0.12, 0.5, cx, teto + 0.06, 0.28, [0.3, 0.05, 0.05], VERMELHO), caixa(THREE, 0.26, 0.12, 0.5, cx, teto + 0.06, -0.28, [0.04, 0.08, 0.3], AZUL));
    for (const z of [1, -1]) partes.push(caixa(THREE, 2.0, cint - chao - 0.25, 0.03, meio + 0.15, (cint + chao) / 2 + 0.05, z * (W / 2 + 0.005), PRETO));
  }
  return juntar(THREE, partes);
}

/** A parte do material que acende as luzes (`luz`): uFarol (mais forte à noite) e uTempo (o giroflex). Chame antes de usar. */
export function luzesNoMaterial(material) {
  const uni = { uFarol: { value: 0.4 }, uTempo: { value: 0 } };
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uFarol = uni.uFarol; sh.uniforms.uTempo = uni.uTempo;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 luz;\nattribute float tinta;\nvarying vec3 vLuz;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLuz = luz;')
      .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvColor.xyz = mix(color.xyz, vColor.xyz, tinta);\n#endif');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLuz;\nuniform float uFarol;\nuniform float uTempo;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        vec3 cLuz = vLuz;
        if (cLuz.r > 1.5) cLuz *= 0.7 * step(0.0, sin(uTempo * 13.0)); else if (cLuz.b > 1.5) cLuz *= 0.7 * step(0.0, -sin(uTempo * 13.0));
        totalEmissiveRadiance += cLuz * uFarol * 2.2;`);
  };
  material.customProgramCacheKey = () => 'carro-luzes';
  return uni;
}
