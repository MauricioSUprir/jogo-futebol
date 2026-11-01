// Os aliados de fora do laboratório: o detetive Joe (que criou você) e a Iris (repórter do Picture News). Corpos do
// Rocketbox (MIT; pessoas genéricas da biblioteca, só os nomes são da história), convertidos como a equipe do Cortex.
// Aparecem no ponto do passo da história que os chama (marcos.js PONTOS: a porta da Delegacia, o Jitters, a praça da
// Prefeitura...) e ficam até a cena daquele passo acabar; viram para o herói quando ele chega perto e gesticulam quando falam.
// Também quem aparece só numa cena da vida do Barry: o VULTO da noite do raio e o homem de amarelo na cozinha dos West (os
// dois vibrando, o rosto borrado).
import * as THREE from 'three';
import { criarHeroi } from './humano.js';
import { pontoMundo } from './marcos.js';
import { colocarAderecos } from './aderecos.js';
import { PESSOAL } from './edicao.js';

// Parte 2: o Cisco bilionário da linha do tempo alterada (na praça da Prefeitura), o Corredor Negro parado na praça e a
// Cigarra mascarada (o corpo do Rocketbox com a máscara e a adaga de aderecos.js); Parte 4: a velocista de roxo (o corpo da Iris
// com a roupa roxa e os óculos de corrida: ela tem o rosto da mãe)
const PERFIS = { joe: { pessoa: 'joe' }, iris: { pessoa: 'iris' }, cisco: { pessoa: 'cisco' }, caitlin: { pessoa: 'caitlin' }, cigarra: { pessoa: 'frio', aderecos: 'cigarra' }, violeta: { pessoa: 'iris', aderecos: 'violeta' }, vulto: { traje: 'vulto', vibra: true }, reverso: { traje: 'reverso', vibra: true }, negro: { traje: 'negro', vibra: true } };
// EDIÇÃO PESSOAL — o elenco da temporada (dono, 31/10: "todos os personagens terem seu boneco"; tools/personagens/elenco.py):
// quem fala numa cena e não está nela entra andando (encenar); o Snart, o Rory e os Mardon com os adereços dos vilões
export const ELENCO = ['oliver', 'pai', 'nora', 'crianca', 'eddie', 'singh', 'felicity', 'ronnie', 'stein', 'eiling', 'stagg', 'bette', 'tony', 'hartley',
  'linda', 'mason', 'lisa', 'tina', 'lance', 'ray', 'grodd'];
if (PESSOAL) {
  for (const id of ELENCO) PERFIS[id] = { pessoa: id, ...(id === 'grodd' ? { aderecos: 'grodd' } : {}) };
  Object.assign(PERFIS, { wells: { pessoa: 'wells' }, mago: { pessoa: 'mago' }, mark: { pessoa: 'mago' }, frio: { pessoa: 'frio', aderecos: 'frio' }, onda: { pessoa: 'onda', aderecos: 'onda' } });
}
const IDS = Object.keys(PERFIS);

export function criarAliados(cena, { mobile = false, aniso = 2, chao = () => 0.3 } = {}) {
  const pessoas = {};                                        // id → {modelo, raiz, x, z, h, ponto}
  const carregando = {};
  async function carregar(id) {
    if (!carregando[id]) carregando[id] = criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, ...PERFIS[id] }).then((modelo) => {
      if (PERFIS[id].aderecos) colocarAderecos(PERFIS[id].aderecos, modelo);
      const raiz = new THREE.Group(); raiz.add(modelo.grupo); raiz.visible = false; cena.add(raiz);
      modelo.grupo.traverse((o) => { if (o.isMesh) o.castShadow = !mobile; });
      pessoas[id] = { id, modelo, raiz, x: 0, z: 0, h: 0, ponto: null };
    }).catch((e) => { console.warn('aliado sem corpo', id, e); });
    return carregando[id];
  }
  let quadro = {};                                           // id → nome do ponto (o que o passo atual pede)
  /** quem fica onde: {joe: 'delegacia', iris: 'cafe', vulto: 'cantoCsi'}; null ou {} esconde todos */
  function posicionar(mapa) {
    quadro = mapa || {};
    for (const id of IDS) {
      const nome = quadro[id];
      if (!nome) { if (pessoas[id]) pessoas[id].raiz.visible = false; continue; }
      carregar(id);
      const p = pessoas[id]; if (!p || p.ponto === nome) continue;
      const w = pontoMundo(nome); p.ponto = nome; p.x = w.x; p.z = w.z; p.h = w.h; p.h0 = w.h; p.y = w.y ?? chao(p.x, p.z);
      p.raiz.position.set(p.x, p.y, p.z); p.raiz.rotation.y = p.h;
    }
  }
  const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function atualizar(dt, P, { quemFala = null, olhar = null } = {}) {
    for (const id of IDS) {
      const p = pessoas[id]; if (!p) continue;
      const mc = !quadro[id] && marcas.get(id);
      if (mc) {                                                   // o elenco da cena: entra andando até a marca
        if (!p.cena) { p.cena = true; p.x = mc.sx; p.z = mc.sz; p.y = mc.y; p.h = Math.atan2(mc.x - mc.sx, mc.z - mc.sz); p.ponto = null; }
        const dx = mc.x - p.x, dz = mc.z - p.z, d = Math.hypot(dx, dz), passo = Math.min(d, ANDAR * dt);
        let v = 0;
        if (d > 0.04) { p.x += dx / d * passo; p.z += dz / d * passo; v = d > 0.25 ? ANDAR : d * 4; }
        const o = d > 0.3 ? null : olhar?.(id);
        const alvo = d > 0.3 ? Math.atan2(dx, dz) : o ? Math.atan2(o.x - p.x, o.z - p.z) : mc.h;
        p.h += ang(alvo - p.h) * Math.min(1, dt * (d > 0.3 ? 8 : 3.5)); p.raiz.rotation.y = p.h;
        p.raiz.position.set(p.x, p.y, p.z); p.raiz.visible = true;
        p.modelo.aplicar({ v, noChao: true, fala: quemFala === id && d < 0.3, vibrando: !!PERFIS[id].vibra }, dt);
        continue;
      }
      if (p.cena) { p.cena = false; p.ponto = null; if (!quadro[id]) { p.raiz.visible = false; continue; } posicionar(quadro); }
      const ativo = !!quadro[id];
      if (ativo && p.ponto !== quadro[id]) posicionar(quadro);    // o corpo acabou de carregar
      const perto = ativo && Math.hypot(P.x - p.x, P.z - p.z) < 160 && Math.abs(P.y - (p.y ?? P.y)) < 40;   // (dentro de um lugar: só com o herói lá)
      p.raiz.visible = perto;
      if (!perto) continue;
      // numa cena, quem escuta vira para quem fala (e quem fala, para o herói); fora dela, para o herói quando ele chega perto
      const o = olhar?.(id);
      const alvo = o ? Math.atan2(o.x - p.x, o.z - p.z) : Math.hypot(P.x - p.x, P.z - p.z) < 14 ? Math.atan2(P.x - p.x, P.z - p.z) : p.h0;
      p.h += ang(alvo - p.h) * Math.min(1, dt * 3); p.raiz.rotation.y = p.h;
      p.modelo.aplicar({ v: 0, noChao: true, fala: quemFala === id, vibrando: !!PERFIS[id].vibra }, dt);
    }
  }
  // ---------- o elenco da cena (edição pessoal) ----------
  const ANDAR = 1.45;                                         // passo de quem chega para a conversa (m/s)
  const marcas = new Map();                                   // id → {x, z, y, h, sx, sz}: a marca e de onde sai andando
  // as marcas em volta de quem está no centro (o herói): de frente, dos lados, um pouco mais longe; nenhuma dentro de parede
  const VOLTA = [[2.5, 0], [2.7, 0.8], [2.7, -0.8], [3.1, 1.45], [3.1, -1.45], [3.5, 0.4], [3.5, -0.4], [3.6, 2.1], [3.6, -2.1], [3.9, 0], [2.6, 2.6], [2.6, -2.6]];
  /** a cena: `ids` entram andando até marcas em volta de `centro` ({x, y, z, h}: o herói e para onde ele olha); `livre(x, z, y)`
   *  diz se um corpo cabe ali */
  function encenar(ids, centro, livre = () => true) {
    marcas.clear();
    const usadas = [];
    for (const id of ids) {
      if (!PERFIS[id]) continue;
      let m = null;
      for (const [d, a] of VOLTA) {
        const h = centro.h + a, x = centro.x + Math.sin(h) * d, z = centro.z + Math.cos(h) * d;
        if (usadas.some((u) => Math.hypot(u.x - x, u.z - z) < 1.15) || !livre(x, z, centro.y)) continue;
        // sai andando de mais longe, na mesma direção (se lá não for parede; senão, de mais perto)
        let sx = x, sz = z;
        for (const k of [4.5, 3, 1.6]) { const tx = centro.x + Math.sin(h) * (d + k), tz = centro.z + Math.cos(h) * (d + k); if (livre(tx, tz, centro.y) && livre((tx + x) / 2, (tz + z) / 2, centro.y)) { sx = tx; sz = tz; break; } }
        m = { x, z, y: centro.y, h: h + Math.PI, sx, sz }; break;
      }
      if (!m) continue;
      usadas.push(m); marcas.set(id, m); carregar(id);
    }
    return [...marcas.keys()];
  }
  /** o fim da cena: o elenco dela sai */
  function dispensar() { marcas.clear(); }
  return {
    posicionar, atualizar, carregar, encenar, dispensar,
    /** este personagem tem corpo (pode entrar numa cena) */
    temPerfil: (id) => !!PERFIS[id],
    /** quem do elenco está na cena agora */
    get emCena() { return [...marcas.keys()]; },
    /** foco de câmera de quem está em cena (null se não está) */
    foco: (id) => ((quadro[id] || marcas.has(id)) && pessoas[id]?.raiz.visible ? { x: pessoas[id].x, y: pessoas[id].raiz.position.y, z: pessoas[id].z } : null),
    /** onde o herói fica para conversar: a `d` m à frente do primeiro aliado em cena, olhando para ele */
    diante(d = 3.6) {
      // (de frente para quem é de carne e osso; só com o vulto ou o homem de amarelo em cena, de frente para ele)
      let ids = IDS.filter((id) => quadro[id] && !PERFIS[id].vibra); if (!ids.length) ids = IDS.filter((id) => quadro[id]); if (!ids.length) return null;
      const ws = ids.map((id) => pontoMundo(quadro[id])), mx = ws.reduce((a, w) => a + w.x, 0) / ws.length, mz = ws.reduce((a, w) => a + w.z, 0) / ws.length, h = ws[0].h;
      const x = mx + Math.sin(h) * d, z = mz + Math.cos(h) * d;
      return { x, z, h: Math.atan2(mx - x, mz - z), y: ws[0].y };
    },
    get pessoas() { return pessoas; },
  };
}
