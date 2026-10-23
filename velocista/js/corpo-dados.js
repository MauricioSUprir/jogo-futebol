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
  return { ossos: indice.ossos, repouso: indice.repouso, lods };
}
