// Leitor do corpo humano (assets/jogador/corpo.json + corpo.bin, gravados por tools/humano/exportar_bin.py). Puro: sem
// three.js nem DOM — o mesmo leitor roda no navegador (render/humano3d.js) e em Node (tools/teste-ossos.mjs). Devolve,
// por LOD e por parte (corpo, cabeça), os atributos já desquantizados em Float32Array (posição, normal, UV), os 4 ossos
// e os 4 pesos por vértice (Uint8Array; pesos somam 255) e os índices (Uint16Array).

/** indice: o JSON de corpo.json; bin: ArrayBuffer de corpo.bin. */
export function lerCorpo(indice, bin) {
  if (bin.byteLength !== indice.bin.bytes) throw new Error(`corpo.bin com ${bin.byteLength} bytes (o índice diz ${indice.bin.bytes})`);
  const lods = indice.lods.map(l => {
    const partes = {};
    for (const [nome, p] of Object.entries(l.partes)) {
      const nv = p.nv;
      const q = new Int16Array(bin, p.pos.off, nv * 3);
      const pos = new Float32Array(nv * 3);
      for (let i = 0; i < nv * 3; i++) {
        const k = i % 3;
        pos[i] = p.min[k] + ((q[i] + 32767) / 65534) * (p.max[k] - p.min[k]);
      }
      const qn = new Int8Array(bin, p.nor.off, nv * 3);
      const nor = new Float32Array(nv * 3);
      for (let i = 0; i < nv; i++) {
        const x = qn[i * 3] / 127, y = qn[i * 3 + 1] / 127, z = qn[i * 3 + 2] / 127;
        const n = Math.sqrt(x * x + y * y + z * z) || 1;
        nor[i * 3] = x / n; nor[i * 3 + 1] = y / n; nor[i * 3 + 2] = z / n;
      }
      const qu = new Uint16Array(bin, p.uv.off, nv * 2);
      const uv = new Float32Array(nv * 2);
      for (let i = 0; i < nv * 2; i++) uv[i] = qu[i] / 65535;
      partes[nome] = {
        nv, ntri: p.ntri, pos, nor, uv,
        ossos: new Uint8Array(bin, p.ossos.off, nv * 4),
        pesos: new Uint8Array(bin, p.pesos.off, nv * 4),
        idx: new Uint16Array(bin, p.idx.off, p.ntri * 3),
      };
    }
    return { nivel: l.nivel, triangulos: l.triangulos, partes };
  });
  // a normal da PALMA de cada mão no descanso (item 77: o corpo novo vira a palma da mão de apoio para o chão — esqueleto.js)
  return { ossos: indice.ossos, repouso: { ...indice.repouso, palma: palmas(lods[0].partes.corpo) }, lods };
}

/**
 * A normal da palma de cada mão no descanso, {E, D} (unitárias, coordenadas do jogo): a direção de MENOR espalhamento dos
 * vértices da mão (osso dominante maoE = 8, maoD = 12; análise de componentes principais, Jacobi 3 × 3), com o sinal para
 * DENTRO do corpo (no descanso as palmas olham as coxas: a mão esquerda fica em z < 0, a palma olha +z).
 */
function palmas(pt) {
  const res = {};
  for (const [nome, osso] of [['E', 8], ['D', 12]]) {
    const ids = [];
    for (let v = 0; v < pt.nv; v++) {
      let b = -1, w = -1;
      for (let k = 0; k < 4; k++) if (pt.pesos[v * 4 + k] > w) { w = pt.pesos[v * 4 + k]; b = pt.ossos[v * 4 + k]; }
      if (b === osso) ids.push(v);
    }
    if (ids.length < 8) continue;
    const mu = [0, 0, 0];
    for (const v of ids) for (let k = 0; k < 3; k++) mu[k] += pt.pos[v * 3 + k] / ids.length;
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const v of ids) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += (pt.pos[v * 3 + a] - mu[a]) * (pt.pos[v * 3 + b] - mu[b]);
    const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let it = 0; it < 50; it++) for (let p = 0; p < 3; p++) for (let r = p + 1; r < 3; r++) {
      if (Math.abs(C[p][r]) < 1e-15) continue;
      const th = 0.5 * Math.atan2(2 * C[p][r], C[r][r] - C[p][p]), c = Math.cos(th), s = Math.sin(th);
      for (let k = 0; k < 3; k++) { const a = C[k][p], b = C[k][r]; C[k][p] = c * a - s * b; C[k][r] = s * a + c * b; }
      for (let k = 0; k < 3; k++) { const a = C[p][k], b = C[r][k]; C[p][k] = c * a - s * b; C[r][k] = s * a + c * b; }
      for (let k = 0; k < 3; k++) { const a = V[k][p], b = V[k][r]; V[k][p] = c * a - s * b; V[k][r] = s * a + c * b; }
    }
    let i = 0;
    for (let k = 1; k < 3; k++) if (C[k][k] < C[i][i]) i = k;
    const n = [V[0][i], V[1][i], V[2][i]];
    if (n[2] * mu[2] > 0) for (let k = 0; k < 3; k++) n[k] = -n[k]; // para dentro (o z do meio do corpo)
    res[nome] = n;
  }
  return res;
}
