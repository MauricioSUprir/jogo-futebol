// Leitor do arquivo do corpo (assets/jogador/corpo.bin, gerado por tools/humano/gerar-corpo.mjs). PURO (sem three.js
// nem DOM; roda nos testes em Node). Formato próprio, sem GLTFLoader/Draco/KTX2: 'GCP1', u32 com o tamanho do
// cabeçalho JSON, o JSON (ossos, pose de repouso, níveis de detalhe, regiões do uniforme, cabelo, olhos e onde fica
// cada seção) e as seções: posição int16 ×3 (quantizada entre min e max), normal int8 ×3, ossos uint8 ×4, pesos
// uint8 ×4 (somam 255) e índices uint16 (os 3 níveis de detalhe, um atrás do outro, dividindo os mesmos vértices).
const TIPOS = { i16: Int16Array, i8: Int8Array, u8: Uint8Array, u16: Uint16Array };

/** ArrayBuffer → {cab, nv, pos, nrm (Float32Array), ossos (Uint8Array), pesos (Float32Array 0–1), idx (Uint16Array)}. */
export function lerCorpo(buf) {
  const dv = new DataView(buf);
  if (buf.byteLength < 8 || String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'GCP1') throw new Error('corpo: formato desconhecido');
  const H = dv.getUint32(4, true);
  const cab = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, H)));
  if (cab.versao !== 1) throw new Error('corpo: versão ' + cab.versao);
  const base = 8 + H, s = {};
  for (const [nome, m] of Object.entries(cab.secoes)) {
    const C = TIPOS[m.tipo];
    if (!C || base + m.off + m.n * C.BYTES_PER_ELEMENT > buf.byteLength) throw new Error('corpo: seção ' + nome + ' fora do arquivo');
    s[nome] = new C(buf.slice(base + m.off, base + m.off + m.n * C.BYTES_PER_ELEMENT));
  }
  const nv = cab.nv;
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), pesos = new Float32Array(nv * 4);
  for (let i = 0; i < nv * 3; i++) {
    const c = i % 3;
    pos[i] = cab.min[c] + ((s.pos[i] + 32768) / 65535) * (cab.max[c] - cab.min[c]);
  }
  for (let v = 0; v < nv; v++) {
    const x = s.nrm[v * 3], y = s.nrm[v * 3 + 1], z = s.nrm[v * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    nrm[v * 3] = x / l; nrm[v * 3 + 1] = y / l; nrm[v * 3 + 2] = z / l;
  }
  for (let i = 0; i < nv * 4; i++) pesos[i] = s.pesos[i] / 255;
  for (const l of cab.lods) if (l.ini + l.n > s.idx.length) throw new Error('corpo: nível de detalhe fora dos índices');
  for (let i = 0; i < s.idx.length; i++) if (s.idx[i] >= nv) throw new Error('corpo: índice fora dos vértices');
  for (let i = 0; i < s.ossos.length; i++) if (s.ossos[i] >= cab.ossos.length) throw new Error('corpo: osso inexistente');
  return { cab, nv, pos, nrm, ossos: s.ossos, pesos, idx: s.idx };
}
