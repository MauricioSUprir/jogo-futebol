// VILÕES DO DIA A DIA (dono, 26/10: "coloque vilões do flash, mais fáceis, só que ao invés de aparecer em missões,
// aparecem no dia a dia"): de tempos em tempos, com o herói solto pela cidade (nada em andamento: nem cena, nem
// cronômetro, nem crime, nem capítulo), um vilão menor aparece a 150–300 m aprontando — o aviso e o ponto roxo no mapa.
// É OPCIONAL: o guia continua na missão; ignorado, ele foge em 2 min. Cada um tem um truque e cai com poucos golpes:
//  - Capitão Bumerangue: joga bumerangues que vão e voltam (desvie de lado);
//  - Trapaceiro: joga bombas de brincadeira no chão (o círculo avisa; o confete deixa lento);
//  - Mestre dos Espelhos: duas cópias de vidro andam com ele (um golpe quebra a cópia; só o de verdade conta);
//  - Pião: gira como um tornado e puxa quem está perto; depois fica tonto (golpe dobrado);
//  - Peek-a-Boo: some e aparece longe quando o herói chega perto, até cansar.
// Os nomes são dos personagens; roupas, falas e golpes são desenhos próprios (traje.js).
import * as THREE from 'three';
import { criarHeroi } from './humano.js';
import { BLOCO, CELL, centroDe, celulaDe, dentro, bloco, alturaDoChao } from './cidade.js';

export const RIVAIS = {
  bumerangue: { nome: 'Capitão Bumerangue', vida: 4, truque: 'bumerangue', cor: '#5b8cff', frase: 'Ô, vermelhinho! Pega esse aqui!', caiu: 'Tá bom, tá bom... eu volto pro bar.' },
  trapaceiro: { nome: 'Trapaceiro', vida: 4, truque: 'bomba', cor: '#ffcf3a', frase: 'Ha! A piada é você, velocista!', caiu: 'Ninguém mais tem senso de humor nesta cidade...' },
  espelhos: { nome: 'Mestre dos Espelhos', vida: 3, truque: 'copias', cor: '#7dffb0', frase: 'Qual de nós é o verdadeiro, Flash?', caiu: 'Espelho meu... que dia horrível.' },
  piao: { nome: 'Pião', vida: 4, truque: 'giro', cor: '#ff9a2e', frase: 'Vamos ver quem fica tonto primeiro!', caiu: 'O mundo... ainda está girando...' },
  peekaboo: { nome: 'Peek-a-Boo', vida: 3, truque: 'teleporte', cor: '#d58bff', frase: 'Achou? Não achou!', caiu: 'Tá, você me achou. Chato.' },
};
const IDS = Object.keys(RIVAIS);
const rnd = (a, b) => a + Math.random() * (b - a);

export function criarRivais(cena, { mobile = false, aniso = 2, combate, fx, avisar = () => {} } = {}) {
  let R = null;                                              // o vilão do dia que está na cidade
  let espera = rnd(90, 150), proximoId = Math.floor(Math.random() * IDS.length), lento = 0, vencidos = 0;
  const modelos = {};
  // projéteis: o bumerangue (V girando) e a bomba (bola com pavio); o círculo de aviso no chão
  const bum = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 12, Math.PI * 0.9), new THREE.MeshStandardMaterial({ color: 0xdcdce4, metalness: 0.6, roughness: 0.3, emissive: 0x224488 }));
  const bomba = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshStandardMaterial({ color: 0x8a2be2, roughness: 0.4, emissive: 0x220033 }));
  const aviso = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false }));
  const tornado = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 0.5, 4.5, 16, 1, true).translate(0, 2.25, 0), new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
  for (const m of [bum, bomba, aviso, tornado]) { m.visible = false; cena.add(m); }

  function carregar(id) {
    if (!modelos[id]) modelos[id] = criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, traje: id });
    return modelos[id];
  }
  function lugarLonge(P) {                                    // uma calçada a 150–300 m, num quarteirão comum
    for (let k = 0; k < 40; k++) {
      const a = rnd(0, 6.28), d = rnd(150, 300), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, i = celulaDe(x), j = celulaDe(z);
      if (!dentro(i, j)) continue;
      const b = bloco(i, j); if (b.tipo === 'lab' || b.tipo === 'marco') continue;
      const cx = centroDe(i), cz = centroDe(j), u = rnd(-22, 22), lado = Math.floor(rnd(0, 4));
      const p = lado === 0 ? [cx + u, cz - BLOCO / 2 + 1] : lado === 1 ? [cx - BLOCO / 2 + 1, cz + u] : lado === 2 ? [cx + u, cz + BLOCO / 2 - 1] : [cx + BLOCO / 2 - 1, cz + u];
      if (b.lotes.some((l) => p[0] > l.x0 - 0.5 && p[0] < l.x1 + 0.5 && p[1] > l.z0 - 0.5 && p[1] < l.z1 + 0.5)) continue;
      return { x: p[0], z: p[1] };
    }
    return null;
  }
  function aparecer(P) {
    const id = IDS[proximoId++ % IDS.length], perf = RIVAIS[id], l = lugarLonge(P); if (!l) return false;
    const raiz = new THREE.Group(); raiz.visible = false; cena.add(raiz);
    R = { id, perf, x: l.x, z: l.z, y: alturaDoChao(l.x, l.z), h: 0, vx: 0, vz: 0, vida: perf.vida, estado: 'apronta', t: 0, at: rnd(1.5, 2.5), raiz, modelo: null, copias: [], teleportes: 0, tonto: 0, girando: 0, proj: null };
    carregar(id).then((m) => { if (!R || R.id !== id) return; R.modelo = m; raiz.add(m.grupo); m.grupo.traverse((o) => { if (o.isMesh) o.castShadow = !mobile; }); });
    if (perf.truque === 'copias') for (let k = 0; k < 2; k++) criarHeroi({ aniso, lod: 1, mobile, traje: id }).then((m) => {
      if (!R || R.id !== id) { m.dispose?.(); return; }
      m.grupo.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.55; } });
      const g = new THREE.Group(); g.add(m.grupo); cena.add(g); R.copias.push({ g, m, vida: 1, ang: k ? 2.1 : -2.1 });
    });
    R.alvo = { extra: true, get x() { return R?.x ?? 0; }, get y() { return R?.y ?? 0; }, get z() { return R?.z ?? 0; },
      alvejavel: () => !!R && R.estado === 'luta', golpe: (tipo, P, info) => golpear(info) };
    combate.registrarAlvo(R.alvo);
    avisar(perf.nome, 'Vilão na cidade', 'crime');
    return true;
  }
  function sumir() {
    if (!R) return;
    combate.removerAlvo(R.alvo);
    if (R.modelo) R.raiz.remove(R.modelo.grupo);
    cena.remove(R.raiz);
    for (const c of R.copias) { cena.remove(c.g); c.m.dispose?.(); }
    for (const m of [bum, bomba, aviso, tornado]) m.visible = false;
    R = null;
  }
  function golpear({ dano = 1, especial = false } = {}) {
    if (!R) return false;
    if (R.perf.truque === 'teleporte' && R.teleportes < 3) return false;              // ainda escapa (ver o passo)
    const d = (especial ? 2 : 1) * (R.tonto > 0 ? 2 : 1);
    R.vida -= d; fx.clarao(R.x, R.y + 1.2, R.z, 2.2, 0.2);
    if (R.vida <= 0) {
      R.estado = 'caido'; R.t = 0; vencidos++;
      avisar(`${R.perf.nome} nocauteado`, R.perf.caiu, 'ok');
      R.vencido = true;
    }
    return true;
  }
  function ferir(P, dx, dz, forca = 9) {                    // o herói leva o golpe: empurrão e a tela vermelha
    const d = Math.hypot(dx, dz) || 1; P.vx += (dx / d) * forca; P.vz += (dz / d) * forca;
    return { dano: true };
  }

  /** a cada quadro; `pode`: nada em andamento (o jogo decide). Devolve acontecimentos [{tipo:'apareceu'|'dano'|'vencido'|'fugiu', id}] */
  function atualizar(dt, P, { pode = false } = {}) {
    const ev = [];
    lento = Math.max(0, lento - dt);
    if (!R) {
      if (pode) { espera -= dt; if (espera <= 0) { espera = rnd(180, 300); if (aparecer(P)) ev.push({ tipo: 'apareceu', id: R.id }); } }
      return ev;
    }
    R.t += dt;
    const dx = P.x - R.x, dz = P.z - R.z, d = Math.hypot(dx, dz), perto = d < 140;
    R.raiz.visible = perto;
    if (R.estado === 'apronta') {
      // aprontando na calçada (sacudindo, olhando em volta); o herói chegou a 30 m: começa a briga
      R.h += dt * 0.8; if (d < 30 && Math.abs(P.y - R.y) < 4) { R.estado = 'luta'; R.t = 0; avisar(R.perf.nome, R.perf.frase, 'crime'); }
      else if (R.t > 120) { avisar(`${R.perf.nome} fugiu`, 'Vilão na cidade', 'alerta'); ev.push({ tipo: 'fugiu', id: R.id }); sumir(); return ev; }
    } else if (R.estado === 'luta') {
      const tr = R.perf.truque, ux = dx / (d || 1), uz = dz / (d || 1);
      // mantém 9–13 m do herói, andando de lado
      const alvoD = tr === 'giro' && R.girando > 0 ? 0 : 11, ladoX = -uz, ladoZ = ux;
      let vx = ux * (d - alvoD) * 0.8 + ladoX * 3 * Math.sin(R.t * 0.9), vz = uz * (d - alvoD) * 0.8 + ladoZ * 3 * Math.sin(R.t * 0.9);
      const vm = Math.hypot(vx, vz), vmax = R.tonto > 0 ? 0 : tr === 'giro' && R.girando > 0 ? 7 : 8;
      if (vm > vmax) { vx *= vmax / vm; vz *= vmax / vm; }
      R.x += vx * dt; R.z += vz * dt; R.y = alturaDoChao(R.x, R.z); R.h = Math.atan2(ux, uz);
      R.tonto = Math.max(0, R.tonto - dt); R.at -= dt;
      if (tr === 'teleporte' && d < 4 && R.teleportes < 3) {            // Peek-a-Boo: some e aparece longe
        fx.onda(R.x, R.y, R.z, 4, 0.35); const a = rnd(0, 6.28); R.x += Math.cos(a) * 16; R.z += Math.sin(a) * 16; R.y = alturaDoChao(R.x, R.z); R.teleportes++;
        fx.onda(R.x, R.y, R.z, 4, 0.35); if (R.teleportes >= 3) { R.tonto = 3.5; avisar(R.perf.nome, 'Ufa... cansei', 'info'); }
      }
      if (R.at <= 0 && R.tonto <= 0) {
        R.at = rnd(2.2, 3.2);
        if (tr === 'bumerangue') R.proj = { tipo: 'bum', t: 0, ox: R.x, oz: R.z, tx: P.x + P.vx * 0.4, tz: P.z + P.vz * 0.4 };
        else if (tr === 'bomba') R.proj = { tipo: 'bomba', t: 0, ox: R.x, oz: R.z, tx: P.x, tz: P.z };
        else if (tr === 'giro') { R.girando = 2.4; }
        else if (tr === 'copias' && R.copias.length) { const c = R.copias[Math.floor(rnd(0, R.copias.length))]; R.proj = { tipo: 'raioCopia', t: 0, c }; }
      }
      // os projéteis
      const p = R.proj;
      if (p?.tipo === 'bum') {
        p.t += dt; const T = 1.6, f = p.t / T, ida = Math.sin(f * Math.PI), lx = -(p.tz - p.oz), lz = p.tx - p.ox, ln = Math.hypot(lx, lz) || 1;
        const bx = p.ox + (p.tx - p.ox) * ida + (lx / ln) * Math.sin(f * Math.PI * 2) * 4, bz = p.oz + (p.tz - p.oz) * ida + (lz / ln) * Math.sin(f * Math.PI * 2) * 4;
        bum.visible = true; bum.position.set(bx, R.y + 1.2, bz); bum.rotation.set(Math.PI / 2, 0, p.t * 25);
        if (!p.acertou && Math.hypot(P.x - bx, P.z - bz) < 1.3 && !combate.intocavel && !P.vibrando) { p.acertou = true; ferir(P, P.x - bx, P.z - bz); ev.push({ tipo: 'dano', id: R.id }); }
        if (p.t >= T) { R.proj = null; bum.visible = false; }
      } else if (p?.tipo === 'bomba') {
        p.t += dt; const T = 0.7, f = Math.min(1, p.t / T);
        aviso.visible = true; aviso.position.set(p.tx, alturaDoChao(p.tx, p.tz) + 0.05, p.tz); aviso.material.opacity = 0.4 + 0.4 * Math.sin(p.t * 20);
        if (f < 1) { bomba.visible = true; bomba.position.set(p.ox + (p.tx - p.ox) * f, R.y + 1.5 + Math.sin(f * Math.PI) * 5, p.oz + (p.tz - p.oz) * f); }
        else bomba.visible = false;
        if (p.t > 1.5) {                                            // estoura: confete colorido e o círculo deixa lento
          for (let i = 0; i < 12; i++) { const a = rnd(0, 6.28), c = [[2.4, 0.6, 1.8], [0.6, 2.2, 0.8], [2.4, 2.0, 0.4]][i % 3]; fx.raio(p.tx, 0.6, p.tz, p.tx + Math.cos(a) * 2.6, rnd(0.3, 2.5), p.tz + Math.sin(a) * 2.6, { vida: 0.35, desvio: 0.8, r: c[0], g: c[1], b: c[2] }); }
          fx.clarao(p.tx, 1, p.tz, 4, 0.3);
          if (Math.hypot(P.x - p.tx, P.z - p.tz) < 2.6 && P.y < R.y + 3 && !combate.intocavel) { lento = 1.8; ferir(P, P.x - p.tx, P.z - p.tz, 5); ev.push({ tipo: 'dano', id: R.id }); }
          R.proj = null; aviso.visible = false;
        }
      } else if (p?.tipo === 'raioCopia') {
        p.t += dt; const c = p.c;
        if (p.t > 0.5 && !p.feito) { p.feito = true; fx.raio(c.g.position.x, c.g.position.y + 1.4, c.g.position.z, P.x, P.y + 1, P.z, { vida: 0.3, desvio: 0.4, r: 0.6, g: 2.2, b: 1.6 }); if (!combate.intocavel && !P.vibrando && Math.hypot(P.x - c.g.position.x, P.z - c.g.position.z) < 16) { ferir(P, P.x - c.g.position.x, P.z - c.g.position.z, 6); ev.push({ tipo: 'dano', id: R.id }); } }
        if (p.t > 0.8) R.proj = null;
      }
      // o Pião girando: o tornado puxa; depois fica tonto
      if (R.girando > 0) {
        R.girando -= dt; tornado.visible = true; tornado.position.set(R.x, R.y, R.z); tornado.rotation.y += dt * 14;
        if (d < 9 && d > 0.5) { P.vx -= ux * 18 * dt; P.vz -= uz * 18 * dt; }
        if (R.girando <= 0) { tornado.visible = false; R.tonto = 2.5; }
      }
      // as cópias de vidro: em volta dele; um golpe por perto quebra a cópia
      for (const c of R.copias) {
        c.ang += dt * 0.6; c.g.position.set(R.x + Math.cos(c.ang + R.t * 0.4) * 4, R.y, R.z + Math.sin(c.ang + R.t * 0.4) * 4); c.g.rotation.y = R.h; c.g.visible = perto;
        c.m.aplicar({ v: 3, noChao: true }, dt);
        if (combate.acao && Math.hypot(P.x - c.g.position.x, P.z - c.g.position.z) < 2.2) { fx.clarao(c.g.position.x, R.y + 1.2, c.g.position.z, 2.5, 0.25); for (let i = 0; i < 8; i++) { const a = rnd(0, 6.28); fx.raio(c.g.position.x, R.y + 1.2, c.g.position.z, c.g.position.x + Math.cos(a) * 1.5, R.y + rnd(0.2, 2.2), c.g.position.z + Math.sin(a) * 1.5, { vida: 0.25, desvio: 0.3, r: 1.8, g: 2.2, b: 2.4 }); } cena.remove(c.g); c.m.dispose?.(); c.morta = true; }
      }
      R.copias = R.copias.filter((c) => !c.morta);
      if (d > 220) { avisar(`${R.perf.nome} fugiu`, 'Vilão na cidade', 'alerta'); ev.push({ tipo: 'fugiu', id: R.id }); sumir(); return ev; }
    } else if (R.estado === 'caido') {
      if (R.t > 5) { ev.push({ tipo: 'vencido', id: R.id }); sumir(); return ev; }
    }
    // o corpo
    if (R && R.raiz) {
      R.raiz.position.set(R.x, R.y, R.z);
      R.raiz.rotation.set(R.estado === 'caido' ? -1.45 : 0, R.girando > 0 ? R.t * 18 : R.h, 0);
      if (R.estado === 'caido') R.raiz.position.y = R.y + 0.25;
      R.modelo?.aplicar({ v: R.estado === 'luta' ? Math.min(8, Math.hypot(R.vx, R.vz) + 3) : 0, noChao: true, golpe: null, vibrando: R.perf.truque === 'teleporte' && R.estado === 'luta' && R.teleportes < 3 && d < 8 }, dt);
    }
    return ev;
  }
  return {
    atualizar, sumir,
    get ativo() { return R && R.estado !== 'caido' ? { id: R.id, nome: R.perf.nome, x: R.x, z: R.z, estado: R.estado, cor: R.perf.cor } : null; },
    get lentidao() { return lento > 0 ? 0.5 : 1; },
    get vencidos() { return vencidos; },
    /** (testes) faz um aparecer agora */
    forcar(P, id) { if (R) sumir(); if (id) proximoId = IDS.indexOf(id); return aparecer(P); },
  };
}
