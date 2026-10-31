// EDIÇÃO PESSOAL (dono, 31/10: "na versão normal, fica do jeito que está, na licenciada, deixa star labs igual, assim como os
// lugares do jogo, visuais dos personagens e vilões iguais"): uma recriação de fã só para o dono, com o visual no estilo da
// série (tudo desenhado aqui, nenhum arquivo oficial), trancada por SENHA na entrada. A senha NÃO fica no código: só o SHA-256
// dela (como no Viverde FC do Total Match). Acertou uma vez, o aparelho lembra. A versão normal (dos amigos) não muda.
// Atenção: é uma trava de entrada; os arquivos do site e do repositório continuam públicos (escolha do dono, 31/10).
// Lida na carga da página: os trajes são montados com a edição da página (trocar de edição recarrega).
const CHAVE = 'theflash.edicao.v1';
const HASH = 'ec59caef13d292ca95d936daa38fe8cad5c4980a456512fd6f00c728fa74cf80';

let salvo = null;
try { salvo = globalThis.localStorage?.getItem(CHAVE) ?? null; } catch { salvo = null; }
const forcaNormal = (() => { try { return new URLSearchParams(globalThis.location?.search || '').get('edicao') === 'normal'; } catch { return false; } })();
/** a página está na edição pessoal (senha conferida neste aparelho) */
export const PESSOAL = salvo === HASH && !forcaNormal;

const normalizar = (t) => String(t ?? '').trim().toLowerCase();
/** confere a senha (o SHA-256 do texto, sem espaços nas pontas e em minúsculas) */
export async function conferirSenha(texto) {
  const t = normalizar(texto); if (!t) return false;
  return (await sha256(t)) === HASH;
}
/** entra na edição pessoal (a senha já foi conferida): guarda e recarrega a página */
export function entrarPessoal() { try { globalThis.localStorage.setItem(CHAVE, HASH); } catch { /* sem armazenamento */ } globalThis.location?.reload(); }
/** volta para a versão normal: esquece a senha neste aparelho e recarrega */
export function sairPessoal() { try { globalThis.localStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ } globalThis.location?.reload(); }

async function sha256(texto) {
  const dados = new TextEncoder().encode(texto);
  if (globalThis.crypto?.subtle) {
    try { return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', dados))); } catch { /* cai na reserva */ }
  }
  return hex(sha256JS(dados));
}
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
// SHA-256 em JS puro (reserva para quando crypto.subtle não existe: página fora de https)
function sha256JS(m) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const l = m.length, n = (((l + 9) >> 6) + 1) << 6, b = new Uint8Array(n); b.set(m); b[l] = 0x80;
  const dv = new DataView(b.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const w = new Uint32Array(64), r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0; }
    let [a, bb, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + bb) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0; H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }
  const out = new Uint8Array(32), ov = new DataView(out.buffer); H.forEach((x, i) => ov.setUint32(i * 4, x)); return out;
}
export const _sha256JS = (t) => hex(sha256JS(new TextEncoder().encode(t)));   // (para o teste)
