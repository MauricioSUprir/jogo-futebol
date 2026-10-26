// OBJETOS DA RUA com que o herói mexe (dono, 26/10: "coisas mais interativas no mapa"): hidrantes que estouram num jato
// d'água quando o Flash passa raspando, lixeiras e caixas de jornal que voam com o vento dele, carrinhos de cachorro-quente
// que enchem a energia (parado do lado por um instante: o metabolismo do velocista) e bandos de pombos que levantam voo.
// PURO (sem three.js nem DOM): onde cada um fica (por quarteirão, com um sorteio próprio — a cidade sorteada não muda) e o
// estado de cada um a cada quadro. O desenho é objetos3d.js.
import { BLOCO, CALCADA, bloco, centroDe, celulaDe, dentro, alturaDoChao } from './cidade.js';

export const OBJ = {
  raio: 110,                 // só os objetos a até essa distância do herói existem (desenho e lógica)
  hidrante: { gatilho: 1.5, vMin: 14, jato: 12 },          // passar a ≥ 14 m/s a 1,5 m estoura; o jato dura 12 s
  solto: { gatilho: 1.6, vMin: 18, volta: 25, longe: 50 }, // lixeira e caixa de jornal: voam; voltam ao lugar depois de 25 s, longe do herói
  lanche: { raio: 2.8, vMax: 3, tempo: 0.8, energia: 0.3, espera: 45 },
  pombos: { susto: 9, vSusto: 5, perto: 3, voo: 5, volta: 40, longe: 60 },
};

function hash(i, j, sal) {
  let h = (Math.imul(i + 4099, 2654435761) ^ Math.imul(j + 911, 1597334677) ^ Math.imul(sal + 77, 3812015801)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822519) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}
function sorteio(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const cache = new Map();
/** Os objetos do quarteirão (i, j): [{id, tipo, x, z, h}] na calçada, fora dos prédios, postes e árvores (nada no campus
 *  do laboratório nem nos lugares da história, que têm desenho próprio). */
export function objetosDoBloco(i, j) {
  const k = i * 1000 + j; if (cache.has(k)) return cache.get(k);
  const b = bloco(i, j), out = [];
  cache.set(k, out);
  if (b.tipo === 'lab' || b.tipo === 'marco') return out;
  const r = sorteio(hash(i, j, 3)), cx = centroDe(i), cz = centroDe(j), m = BLOCO / 2;
  // lados: 0 norte (z = cz − m), 1 oeste (x = cx − m), 2 sul, 3 leste; `af` = o quanto entra na calçada a partir do meio-fio
  const ponto = (lado, u, af) => (lado === 0 ? [cx + u, cz - m + af] : lado === 1 ? [cx - m + af, cz + u] : lado === 2 ? [cx + u, cz + m - af] : [cx + m - af, cz + u]);
  const rumo = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];            // de frente para a rua
  const livre = (x, z, folga = 1.3) => !b.lotes.some((l) => x > l.x0 - 0.4 && x < l.x1 + 0.4 && z > l.z0 - 0.4 && z < l.z1 + 0.4)
    && !b.postes.some((p) => Math.hypot(p.x - x, p.z - z) < folga) && !b.arvores.some((a) => Math.hypot(a.x - x, a.z - z) < folga + 0.6)
    && !out.some((o) => Math.hypot(o.x - x, o.z - z) < folga + 0.4);
  const por = (tipo, lado, u, af) => { const [x, z] = ponto(lado, u, af); if (!livre(x, z)) return false; out.push({ id: `${i},${j},${out.length}`, tipo, x, z, h: rumo[lado] + (tipo === 'pombos' ? r() * 6.28 : 0) }); return true; };
  const lado = () => Math.floor(r() * 4), u = (a) => (r() - 0.5) * 2 * a;
  if (r() < 0.85) { const s = r() < 0.5 ? -1 : 1; por('hidrante', lado(), s * (23 + r() * 3), 0.7); }
  for (let n = 0; n < 2; n++) por('lixeira', lado(), u(22), 1.5);
  if (r() < 0.35) por('jornal', lado(), u(20), 1.4);
  if (r() < 0.14) por('lanche', lado(), u(14), 1.3);
  if (r() < 0.4) por('pombos', lado(), u(16), 1.2);
  return out;
}

export function criarObjetos() {
  const est = new Map();                                     // id → estado de quem já foi mexido
  const lancheT = new Map();                                 // carrinho → a hora em que dá para comer de novo
  let t = 0, parado = 0;
  /** os objetos a até `raio` de (x, z), com o estado de cada um */
  function perto(x, z, raio = OBJ.raio) {
    const ci = celulaDe(x), cj = celulaDe(z), n = Math.ceil(raio / 76), v = [];
    for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) {
      if (!dentro(i, j)) continue;
      for (const o of objetosDoBloco(i, j)) if (Math.abs(o.x - x) < raio && Math.abs(o.z - z) < raio) v.push(o);
    }
    return v;
  }
  const estado = (o) => est.get(o.id) || null;
  /**
   * Um passo: o herói (P: x, y, z, vx, vz) mexe no que está perto. Devolve os acontecimentos
   * [{tipo: 'hidrante'|'voou'|'pombos'|'lanche', o}] (o lanche traz `energia`).
   */
  function atualizar(dt, P, lista) {
    t += dt;
    const v = Math.hypot(P.vx, P.vz), ev = [], chao = P.y < 3;
    parado = v < OBJ.lanche.vMax ? parado + dt : 0;
    for (const o of lista) {
      const d = Math.hypot(P.x - o.x, P.z - o.z), e = estado(o);
      if (o.tipo === 'hidrante') {
        if (e && t > e.fim) est.delete(o.id);
        else if (!e && chao && d < OBJ.hidrante.gatilho && v >= OBJ.hidrante.vMin) { est.set(o.id, { jato: true, t0: t, fim: t + OBJ.hidrante.jato }); ev.push({ tipo: 'hidrante', o }); }
      } else if (o.tipo === 'lixeira' || o.tipo === 'jornal') {
        if (!e) {
          if (chao && d < OBJ.solto.gatilho && v >= OBJ.solto.vMin) {
            // voa para a frente do herói e para o lado de onde ele passou, girando
            const fx = P.vx / v, fz = P.vz / v, lx = (o.x - P.x) / (d || 1), lz = (o.z - P.z) / (d || 1), f = Math.min(1, v / 60);
            est.set(o.id, { voando: true, t0: t, x: o.x, y: alturaDoChao(o.x, o.z), z: o.z, vx: fx * v * 0.35 * f + lx * 4, vz: fz * v * 0.35 * f + lz * 4, vy: 5 + 6 * f, rx: 0, rz: 0, wx: (Math.random() - 0.5) * 14, wz: (Math.random() - 0.5) * 14 });
            ev.push({ tipo: 'voou', o });
          }
        } else if (e.voando) {
          e.vy -= 24 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; e.rx += e.wx * dt; e.rz += e.wz * dt;
          const h = alturaDoChao(e.x, e.z);
          if (e.y <= h) {                                     // quica e para deitado
            e.y = h; e.vy = Math.abs(e.vy) > 3 ? -e.vy * 0.3 : 0; e.vx *= 0.6; e.vz *= 0.6; e.wx *= 0.5; e.wz *= 0.5;
            if (Math.hypot(e.vx, e.vz) < 0.6 && e.vy === 0) { e.voando = false; e.caido = true; e.rx = Math.PI / 2; e.rz = 0; e.tCaiu = t; }
          }
        } else if (e.caido && t - e.tCaiu > OBJ.solto.volta && Math.hypot(P.x - e.x, P.z - e.z) > OBJ.solto.longe && d > OBJ.solto.longe) est.delete(o.id);
      } else if (o.tipo === 'lanche') {
        if (d < OBJ.lanche.raio && chao && parado >= OBJ.lanche.tempo && t >= (lancheT.get(o.id) || 0)) {
          lancheT.set(o.id, t + OBJ.lanche.espera); parado = -1e9;              // (um lanche por parada)
          ev.push({ tipo: 'lanche', o, energia: OBJ.lanche.energia });
        }
      } else if (o.tipo === 'pombos') {
        if (!e && chao && (d < OBJ.pombos.perto || (d < OBJ.pombos.susto && v >= OBJ.pombos.vSusto))) { est.set(o.id, { voando: true, t0: t, de: [P.x, P.z] }); ev.push({ tipo: 'pombos', o }); }
        else if (e && t - e.t0 > OBJ.pombos.volta && d > OBJ.pombos.longe) est.delete(o.id);
      }
    }
    if (parado < 0 && v >= OBJ.lanche.vMax) parado = 0;
    return ev;
  }
  return { perto, atualizar, estado, get t() { return t; }, zerar() { est.clear(); lancheT.clear(); } };
}

/** onde fica um pombo do bando (k de n) no tempo `tt` desde o susto (null = ainda no chão): sai do herói, subindo e espalhando */
export function pomboNoAr(o, e, k, n, tt) {
  const a = o.h + (k / n) * Math.PI * 2, base = Math.atan2(o.z - e.de[1], o.x - e.de[0]) + Math.sin(k * 7.3) * 0.9;
  const s = tt * (6 + (k % 3)), sobe = tt * (4 + (k % 2) * 1.5);
  return { x: o.x + Math.cos(a) * 0.6 + Math.cos(base) * s, y: CALCADA + 0.15 + sobe, z: o.z + Math.sin(a) * 0.6 + Math.sin(base) * s, h: base };
}
