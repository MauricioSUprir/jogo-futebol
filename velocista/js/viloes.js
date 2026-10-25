// Os vilões da história (além das missões): capítulo 1 — Zoom; capítulo 2 — Flash Reverso, o cérebro de tudo; e a
// batalha final contra os dois juntos, em frente ao S.T.A.R. Labs. Trajes, emblemas e raios com desenho próprio
// (traje.js / humano.js / raios.js): Zoom preto com raios azuis, Flash Reverso amarelo com raios vermelhos.
//
// Cada capítulo: o vilão aparece num ponto da cidade (o guia mostra) → PERSEGUIÇÃO pelas ruas: alcance-o e aperte BATER
// (o avanço relâmpago chega até 16 m) as vezes pedidas; durante a perseguição a energia não gasta e vai enchendo →
// LUTA: o vilão rodeia, carrega e dá a investida (desvia quem corre de lado, pula ou vibra); depois dela fica cansado
// (é a hora de bater); fora disso desvia da maioria dos golpes. O Flash Reverso desvia mais, joga raios e acelera na
// metade da vida (mais difícil que o Zoom, mas justo). Perdeu a luta: ela recomeça, e cada derrota (até 3) deixa o
// vilão mais fácil (desvia menos, fere menos, fica mais tempo cansado). Vida do herói só nas lutas (P.vida).
import * as THREE from 'three';
import { CELL, N, MEIO } from './cidade.js';
import { criarHeroi } from './humano.js';
import { criarRaios } from './raios.js';

export const PERFIS = {
  zoom: {
    nome: 'ZOOM', titulo: 'Zoom', traje: 'zoom', raio: 'azul', cor: '#3fa0ff', corRaio: [0.25, 0.65, 2.2],
    vida: 100, capturas: 3, vFuga: 52, vCansado: 33, folego: 5, cansaco: 2.4,
    rodeia: [1.4, 2.6], telegrafo: 0.6, recupera: 1.35, dano: 0.12, esquiva: 0.75, raios: false, fase2: false, regen: 0.015,
  },
  reverso: {
    nome: 'FLASH REVERSO', titulo: 'Flash Reverso', traje: 'reverso', raio: 'vermelho', cor: '#ff3b30', corRaio: [2.4, 0.15, 0.08],
    vida: 130, capturas: 3, vFuga: 56, vCansado: 35, folego: 4.5, cansaco: 2.4,
    rodeia: [1.2, 2.2], telegrafo: 0.58, recupera: 1.2, dano: 0.13, esquiva: 0.82, raios: true, fase2: true, regen: 0.012,
  },
};
export const CAPITULOS = [
  { id: 'zoom', titulo: 'Capítulo 1 — Zoom', viloes: ['zoom'], perseguicao: true, texto: 'Um velocista de preto está aterrorizando a cidade. Encontre o Zoom e persiga-o.' },
  { id: 'reverso', titulo: 'Capítulo 2 — Flash Reverso', viloes: ['reverso'], perseguicao: true, missoes: 14, texto: 'O Zoom era só o começo. Quem arquitetou tudo foi o Flash Reverso. Alcance-o.' },
  { id: 'final', titulo: 'Batalha final', viloes: ['zoom', 'reverso'], perseguicao: false, texto: 'Os dois voltaram juntos e esperam por você em frente ao S.T.A.R. Labs.' },
];
const DANO = { soco: 5, gancho: 9, raio: 14, ciclone: 18, sonico: 28 };
const CHAVE = 'theflash.viloes.v1';
const eixo = (k) => k * CELL - MEIO;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ang = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------- corrida pela grade de ruas (a fuga) ----------
function escolherDir(c, heroi) {
  const ops = [];
  for (let d = 0; d < 4; d++) {
    if (d === (c.dir + 2) % 4) continue;
    const nx = c.kx + DIRS[d][0], nz = c.kz + DIRS[d][1];
    if (nx < 3 || nz < 3 || nx > N - 3 || nz > N - 3) continue;
    const longe = Math.hypot(eixo(nx) - heroi.x, eixo(nz) - heroi.z);
    ops.push([d, longe * 0.4 + (d === c.dir ? 60 : 0) + Math.random() * 50]);      // segue reto mais vezes
  }
  if (!ops.length) return (c.dir + 2) % 4;
  ops.sort((a, b) => b[1] - a[1]); return ops[0][0];
}
function andarGrade(c, dist, heroi) {
  c.t += dist / CELL;
  while (c.t >= 1) { c.t -= 1; c.kx += DIRS[c.dir][0]; c.kz += DIRS[c.dir][1]; c.dir = escolherDir(c, heroi); }
  const [dx, dz] = DIRS[c.dir];
  return { x: eixo(c.kx) + dx * c.t * CELL - dz * 1.5, z: eixo(c.kz) + dz * c.t * CELL + dx * 1.5, h: Math.atan2(dx, dz) };
}

export function criarViloes(cena, { mobile = false, aniso = 2, combate, colide = null, chao = null, avisar = () => {}, armazem = null, labPos = { x: 0, z: 0 } } = {}) {
  let salvo = null; try { salvo = JSON.parse(armazem?.getItem(CHAVE) || 'null'); } catch { salvo = null; }
  const S = { vencidos: new Set(salvo?.vencidos || []) };
  const FACIL = 0.12;                                       // cada derrota na luta (até 3) deixa o vilão 12% mais fácil
  const gravar = () => { try { armazem?.setItem(CHAVE, JSON.stringify({ vencidos: [...S.vencidos] })); } catch { /* sem armazenamento */ } };

  // capítulo em andamento: {cap, fase: 'espera'|'aparece'|'perseguicao'|'choque'|'luta'|'derrota'|'vitoria', t, viloes: [...]}
  let C = null, espera = 0, forcado = null;
  const fx = combate.efeitos;
  const modelos = {};                                       // o vilão é carregado uma vez e reaproveitado

  // ---------- HUD ----------
  const hud = document.getElementById('hud');
  const painel = document.createElement('div'); painel.id = 'chefe'; painel.hidden = true;
  painel.innerHTML = '<div class="chefe-titulo"></div><div class="chefe-barras"></div><div class="chefe-info"></div>';
  hud.appendChild(painel);
  const vidaBox = document.createElement('div'); vidaBox.id = 'vidaHeroi'; vidaBox.hidden = true;
  vidaBox.innerHTML = '<div class="rotulo">Vida</div><div class="barra"><div class="nivel"></div></div>';
  document.getElementById('energia').prepend(vidaBox);
  const pTitulo = painel.querySelector('.chefe-titulo'), pBarras = painel.querySelector('.chefe-barras'), pInfo = painel.querySelector('.chefe-info'), vNivel = vidaBox.querySelector('.nivel');

  // ---------- o vilão ----------
  function criarVilao(id) {
    const perf = PERFIS[id];
    const v = {
      extra: true, id, perf, x: 0, y: 0, z: 0, vx: 0, vz: 0, h: 0, vel: 0, vida: perf.vida, fase2: false,
      estado: 'oculto', acao: 'rodeia', t: 0, at: 0, ang: rnd(0, 6.28), capturas: 0, cansado: false, ciclo: perf.folego,
      grupo: new THREE.Group(), modelo: modelos[id] || null, raios: criarRaios(cena, { mobile, cor: perf.raio }), barra: null,
    };
    v.grupo.visible = false; cena.add(v.grupo);
    if (v.modelo) v.grupo.add(v.modelo.grupo);
    else criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, traje: perf.traje }).then((m) => { modelos[id] = m; v.modelo = m; v.grupo.add(m.grupo); m.grupo.traverse((o) => { if (o.isMesh) o.castShadow = !mobile; }); }).catch((e) => console.warn('vilão sem corpo', e));
    // aviso da investida: uma faixa no chão do vilão até depois do herói
    v.aviso = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(...perf.corRaio), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    v.aviso.visible = false; cena.add(v.aviso);
    v.alvejavel = () => v.estado === 'perseguicao' || (v.estado === 'luta' && v.vida > 0);
    v.golpe = (tipo, P, info) => receberGolpe(v, tipo, P, info);
    return v;
  }
  function soltarVilao(v) {
    combate.removerAlvo(v); v.grupo.visible = false; v.aviso.visible = false;
    if (v.modelo) v.grupo.remove(v.modelo.grupo);
    cena.remove(v.grupo, v.aviso); v.raios.dispose();
  }

  // ---------- capítulos ----------
  const liberado = (i, missaoIdx) => (i === 0 ? missaoIdx > 6 || S.vencidos.has('zoom') : S.vencidos.has(CAPITULOS[i - 1].id));
  // sozinho, o capítulo só começa depois das missões que a história pede (na pausa dá para jogar o liberado antes)
  function proximo(missaoIdx) {
    for (let i = 0; i < CAPITULOS.length; i++) if (!S.vencidos.has(CAPITULOS[i].id) && liberado(i, missaoIdx) && missaoIdx >= (CAPITULOS[i].missoes || 0)) return i;
    return -1;
  }
  function comecar(i, P) {
    if (C) encerrar();
    const cap = CAPITULOS[i];
    C = { i, cap, fase: 'aparece', t: 0, viloes: cap.viloes.map(criarVilao), fora: 0, derrotas: 0 };
    let base;
    if (cap.perseguicao) {
      // longe do herói (250–450 m), num cruzamento
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * 6.28, r = rnd(250, 450), kx = Math.round((P.x + Math.cos(a) * r + MEIO) / CELL), kz = Math.round((P.z + Math.sin(a) * r + MEIO) / CELL);
        if (kx >= 4 && kz >= 4 && kx <= N - 4 && kz <= N - 4) { base = { x: eixo(kx), z: eixo(kz), kx, kz }; break; }
      }
      base = base || { x: eixo(N / 2 + 4), z: eixo(N / 2 + 4), kx: N / 2 + 4, kz: N / 2 + 4 };
    } else base = { x: labPos.x, z: labPos.z };
    C.viloes.forEach((v, k) => {
      v.x = base.x + (k ? 4 : 0); v.z = base.z + (k ? 2 : 0); v.y = 0; v.estado = 'aparece'; v.grupo.visible = true;
      v.cam = base.kx !== undefined ? { kx: base.kx, kz: base.kz, dir: Math.floor(Math.random() * 4), t: 0 } : null;
      combate.registrarAlvo(v);
    });
    if (cap.viloes.length > 1) avisar('Zoom e Flash Reverso', 'Batalha final', 'reverso');
    else avisar(`${PERFIS[cap.viloes[0]].titulo} apareceu`, 'Alerta na cidade', cap.viloes[0]);
    return C;
  }
  function encerrar() {
    if (!C) return;
    for (const v of C.viloes) soltarVilao(v);
    C = null; painel.hidden = true; vidaBox.hidden = true;
  }
  function iniciarLuta(P) {
    C.fase = 'luta'; C.t = 0; P.vida = 1;
    const k = 1 - FACIL * Math.min(3, C.derrotas);
    for (const v of C.viloes) {
      v.facil = k;
      v.estado = 'luta'; v.acao = 'rodeia'; v.at = rnd(...v.perf.rodeia) * (C.viloes.length > 1 ? 1.4 : 1); v.vida = v.perf.vida; v.fase2 = false; v.vx = v.vz = 0;
    }
    avisar(C.viloes.length > 1 ? 'Derrote os dois' : C.viloes[0].perf.titulo, 'Luta', C.viloes.length > 1 ? 'reverso' : C.viloes[0].id);
    eventos.push({ tipo: 'luta', id: C.cap.id });
  }

  // ---------- golpes do herói nos vilões (chamado pelo combate) ----------
  function receberGolpe(v, tipo, P) {
    if (v.estado === 'perseguicao') { capturar(v, P); return true; }
    if (v.estado !== 'luta' || v.vida <= 0) return false;
    const vulneravel = v.acao === 'recupera' || v.acao === 'atordoado';
    if (!vulneravel) {
      const esp = v.perf.esquiva * (tipo === 'ciclone' || tipo === 'sonico' ? 0.6 : tipo === 'raio' ? 0.8 : 1) * (v.fase2 ? 1.04 : 1) * (v.facil ?? 1);
      if (Math.random() < esp) { esquivar(v, P); return false; }
    }
    const dano = (DANO[tipo] || 5) * (vulneravel ? 1 : 0.7);
    v.vida = Math.max(0, v.vida - dano);
    P.energia = Math.min(1, P.energia + 0.04);                 // acertar o vilão devolve energia para os especiais
    fx.clarao(v.x, v.y + 1.3, v.z, 2.2, 0.18);
    if (tipo !== 'soco' || !vulneravel) { v.acao = 'atordoado'; v.at = tipo === 'soco' ? 0.35 : 0.7; }
    if (v.perf.fase2 && !v.fase2 && v.vida < v.perf.vida * 0.5) { v.fase2 = true; avisar(`${v.perf.titulo} acelerou`, 'Cuidado', v.id); eventos.push({ tipo: 'fase2', id: v.id }); }
    if (v.vida <= 0) derrotar(v);
    return true;
  }
  function esquivar(v, P) {
    // some num borrão e reaparece de lado
    const dx = v.x - P.x, dz = v.z - P.z, d = Math.hypot(dx, dz) || 1, lado = Math.random() < 0.5 ? -1 : 1;
    const ox = v.x, oz = v.z;
    v.x += (-dz / d) * 3.5 * lado + (dx / d) * 1.5; v.z += (dx / d) * 3.5 * lado + (dz / d) * 1.5;
    if (colide) { const r = colide(v.x, v.z, v.y); v.x = r.x; v.z = r.z; }
    const c = v.perf.corRaio;
    for (let i = 0; i < 4; i++) fx.raio(ox, v.y + rnd(0.3, 1.7), oz, v.x, v.y + rnd(0.3, 1.7), v.z, { vida: 0.2, desvio: 0.4, r: c[0], g: c[1], b: c[2] });
  }
  function capturar(v, P) {
    // o herói chega num relâmpago até as costas do vilão
    const dx = v.x - P.x, dz = v.z - P.z, d = Math.hypot(dx, dz) || 1, ox = P.x, oz = P.z;
    if (d > 1.4) { P.x = v.x - (dx / d) * 1.2; P.z = v.z - (dz / d) * 1.2; for (let i = 0; i < 4; i++) fx.raio(ox, P.y + rnd(0.3, 1.6), oz, P.x, P.y + rnd(0.3, 1.6), P.z, { vida: 0.25, desvio: 0.5 }); }
    P.h = Math.atan2(dx, dz);
    v.capturas++; C.fase = 'choque'; C.t = 0; C.choque = v;
    eventos.push({ tipo: 'captura', id: v.id, n: v.capturas, total: v.perf.capturas });
    fx.clarao(v.x, v.y + 1.2, v.z, 5, 0.35); fx.onda(v.x, v.y, v.z, 10, 0.5);
    combate.hitstop = 0.15;
    const c = v.perf.corRaio;
    for (let i = 0; i < 8; i++) { const a = rnd(0, 6.28); fx.raio(v.x, v.y + 1.2, v.z, v.x + Math.cos(a) * rnd(2, 5), v.y + rnd(0, 3), v.z + Math.sin(a) * rnd(2, 5), { vida: 0.35, desvio: 0.6, r: c[0], g: c[1], b: c[2] }); }
    P.vx = P.vz = 0;
    avisar(v.capturas >= v.perf.capturas ? `${v.perf.titulo} encurralado` : `Alcançou ${v.capturas}/${v.perf.capturas}`, 'Perseguição', v.id);
  }
  function derrotar(v) {
    v.acao = 'caido'; v.at = 0; v.aviso.visible = false;
    combate.hitstop = 0.25;
    fx.onda(v.x, v.y, v.z, 12, 0.7);
    avisar(`${v.perf.titulo} derrotado`, 'Vitória', 'ok');
  }
  function ferirHeroi(P, dano, dx, dz) {
    const k = Math.min(...C.viloes.map((v) => v.facil ?? 1));
    P.vida = Math.max(0, P.vida - dano * k); C.semGolpe = 0;
    const d = Math.hypot(dx, dz) || 1; P.vx += (dx / d) * 9; P.vz += (dz / d) * 9;
    eventos.push({ tipo: 'dano' });
  }
  const eventos = [];

  // o herói desvia de um ataque se está num golpe rápido, vibrando, no ar ou correndo de lado
  function desvia(P, chaoY, vx, vz) {
    if (combate.intocavel || P.vibrando || P.y - chaoY > 0.9) return true;
    const v = Math.hypot(P.vx, P.vz); if (v < 13) return false;
    const vn = Math.hypot(vx, vz) || 1, perp = Math.abs((P.vx * vz - P.vz * vx) / vn) / v;   // quanto o herói corre de lado
    return perp > 0.5;
  }

  // ---------- IA da luta ----------
  function passoLuta(v, dt, P, outros) {
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz) || 1;
    const f2 = v.fase2 ? 0.8 : 1, chaoY = chao ? chao(P.x, P.z, P.y + 1) : 0;
    v.at -= dt; v.t += dt;
    const ocupado = outros.some((o) => o !== v && (o.acao === 'prepara' || o.acao === 'investida' || o.acao === 'carrega'));
    switch (v.acao) {
      case 'rodeia': {
        v.ang += dt * (v.fase2 ? 2.4 : 1.7) * (v.id === 'zoom' ? 1 : -1);
        const R = 6.5, tx = P.x + Math.cos(v.ang) * R, tz = P.z + Math.sin(v.ang) * R, gx = tx - v.x, gz = tz - v.z, gd = Math.hypot(gx, gz) || 1;
        const vm = Math.min(32, gd * 6);
        v.vx = lerp(v.vx, (gx / gd) * vm, Math.min(1, dt * 8)); v.vz = lerp(v.vz, (gz / gd) * vm, Math.min(1, dt * 8));
        if (d < 2.2) v.perto = (v.perto || 0) + dt; else v.perto = 0;
        if (v.at <= 0 && !ocupado) {
          if (v.perto > 0.6) { v.acao = 'combo'; v.at = 0; v.golpes = 0; }
          else if (v.perf.raios && Math.random() < (v.fase2 ? 0.45 : 0.3)) { v.acao = 'carrega'; v.at = 0.65 * f2; }
          else { v.acao = 'prepara'; v.at = v.perf.telegrafo * f2; }
        }
        break;
      }
      case 'prepara': {
        v.vx *= 0.8; v.vz *= 0.8;
        // a faixa no chão mostra por onde a investida vai passar (mira no herói até o último instante)
        const len = d + 8, h = Math.atan2(dx, dz);
        v.aviso.visible = true; v.aviso.position.set(v.x, 0.08, v.z); v.aviso.rotation.y = h; v.aviso.scale.set(1.2, 1, len);
        v.aviso.material.opacity = 0.25 + 0.5 * (1 - v.at / (v.perf.telegrafo * f2));
        if (v.at <= 0) { v.acao = 'investida'; v.at = len / 75; v.dir = [dx / d, dz / d]; v.acertou = false; v.aviso.visible = false; }
        break;
      }
      case 'investida': {
        v.vx = v.dir[0] * 75; v.vz = v.dir[1] * 75;
        // passou pelo herói neste quadro? (varre o trecho andado: a 75 m/s um quadro lento anda mais de 3 m)
        const px = P.x - v.x, pz = P.z - v.z, ao = px * v.dir[0] + pz * v.dir[1], lado = Math.abs(px * v.dir[1] - pz * v.dir[0]);
        if (!v.acertou && ao > -0.8 && ao - 75 * dt < 0.8 && lado < 1.3) {
          v.acertou = true;
          if (!desvia(P, chaoY, v.vx, v.vz)) { ferirHeroi(P, v.perf.dano, v.dir[0], v.dir[1]); fx.clarao(P.x, P.y + 1.2, P.z, 2.5, 0.2); combate.hitstop = 0.08; }
        }
        if (v.at <= 0) { v.acao = 'recupera'; v.at = v.perf.recupera * (v.fase2 ? 0.85 : 1) / (v.facil ?? 1); v.vx *= 0.2; v.vz *= 0.2; }
        break;
      }
      case 'carrega': {
        v.vx *= 0.8; v.vz *= 0.8;
        if (v.at <= 0) {
          const c = v.perf.corRaio;
          for (let i = 0; i < 4; i++) fx.raio(v.x + Math.sin(v.h) * 0.6, v.y + 1.45, v.z + Math.cos(v.h) * 0.6, P.x, P.y + 1.1, P.z, { vida: 0.35, desvio: 1.2, r: c[0], g: c[1], b: c[2] });
          if (!desvia(P, chaoY, -dz, dx)) { ferirHeroi(P, v.perf.dano * 0.8, dx, dz); fx.clarao(P.x, P.y + 1.2, P.z, 3, 0.25); }
          v.acao = 'rodeia'; v.at = rnd(...v.perf.rodeia) * f2;
        }
        break;
      }
      case 'combo': {
        // três socos rápidos de perto (0,28 s cada)
        v.vx *= 0.7; v.vz *= 0.7;
        if (v.at <= 0) {
          if (v.golpes >= 3) { v.acao = 'recupera'; v.at = 0.55; break; }
          v.golpes++; v.at = 0.28 * f2;
          if (d < 2.0 && !desvia(P, chaoY, dz, -dx)) ferirHeroi(P, v.perf.dano * 0.45, dx, dz);
        }
        break;
      }
      case 'recupera': case 'atordoado':
        v.vx *= 0.85; v.vz *= 0.85;
        if (v.at <= 0) { v.acao = 'rodeia'; v.at = rnd(...v.perf.rodeia) * f2; }
        break;
      case 'caido': v.vx = v.vz = 0; break;
      default: break;
    }
    v.x += v.vx * dt; v.z += v.vz * dt;
    if (colide && v.acao !== 'investida') { const r = colide(v.x, v.z, v.y); v.x = r.x; v.z = r.z; }
    v.y = chao ? chao(v.x, v.z, v.y + 1) : 0;
    const alvoH = v.acao === 'investida' ? Math.atan2(v.vx, v.vz) : Math.atan2(dx, dz);
    if (v.acao !== 'caido') v.h += ang(alvoH - v.h) * Math.min(1, dt * 14);
  }

  // ---------- passo ----------
  /** ctx: {missaoIdx, podeComecar} → eventos [{tipo: 'dano'|'vitoria'|'capitulo'|'derrota'}] */
  function atualizar(dt, P, ctx) {
    if (!C) {
      const i = forcado ?? proximo(ctx.missaoIdx);
      if (i >= 0 && (forcado !== null || ctx.podeComecar)) { espera -= dt; if (espera <= 0 || forcado !== null) { forcado = null; comecar(i, P); eventos.push({ tipo: 'capitulo', id: CAPITULOS[i].id }); } }
      else espera = Math.max(espera, 20);
      return eventos.splice(0);
    }
    C.t += dt; C.P = P;
    const vs = C.viloes, chaoP = chao ? chao(P.x, P.z, P.y + 1) : 0;
    if (C.fase === 'aparece') {
      for (const v of vs) { v.vx = v.vz = 0; v.t += dt; v.h += ang(Math.atan2(P.x - v.x, P.z - v.z) - v.h) * Math.min(1, dt * 4); }
      const d = Math.min(...vs.map((v) => Math.hypot(P.x - v.x, P.z - v.z)));
      // chegou perto: a cena do encontro (historia.js) e depois a perseguição ou a luta (continuar)
      if (d < (C.cap.perseguicao ? 45 : 30) && Math.abs(P.y - chaoP) < 3) { C.fase = 'encontro'; C.t = 0; eventos.push({ tipo: 'encontro', id: C.cap.id }); }
    } else if (C.fase === 'encontro') {
      for (const v of vs) { v.vx = v.vz = 0; v.h += ang(Math.atan2(P.x - v.x, P.z - v.z) - v.h) * Math.min(1, dt * 4); }
      if (C.t > 60) continuar();
    } else if (C.fase === 'perseguicao') {
      const v = vs[0], d = Math.hypot(P.x - v.x, P.z - v.z);
      v.ciclo -= dt; if (v.ciclo <= 0) { v.cansado = !v.cansado; v.ciclo = v.cansado ? v.perf.cansaco : v.perf.folego; }
      let alvoV = v.cansado ? v.perf.vCansado : v.perf.vFuga;
      if (d > 90) alvoV *= 0.5; else if (d < 10 && !v.cansado) alvoV *= 1.12;            // espera o herói / arranca quando ele encosta
      v.vel = lerp(v.vel, alvoV, Math.min(1, dt * 3));
      const p = andarGrade(v.cam, v.vel * dt, P);
      v.vx = (p.x - v.x) / Math.max(dt, 1e-3); v.vz = (p.z - v.z) / Math.max(dt, 1e-3); v.x = p.x; v.z = p.z; v.h = p.h;
      v.y = 0;
      // trombada: encostou correndo também alcança
      if (d < 2.4 && Math.hypot(P.vx, P.vz) > 25 && Math.abs(P.y - v.y) < 2) capturar(v, P);
      if (d > 300) { C.fora += dt; if (C.fora > 7) { avisar(`${v.perf.titulo} escapou`, 'Perseguição', 'alerta'); const i = C.i; encerrar(); espera = 15; forcado = null; eventos.push({ tipo: 'escapou', i, id: CAPITULOS[i].id }); return eventos.splice(0); } }
      else C.fora = 0;
    } else if (C.fase === 'choque') {
      const v = C.choque; v.vx = v.vz = 0; P.vx *= 0.5; P.vz *= 0.5;
      if (C.t > 1.1) {
        if (v.capturas >= v.perf.capturas) iniciarLuta(P);
        else {
          // foge de novo com vantagem: some num raio e reaparece 30 m à frente pela rua
          const ox = v.x, oz = v.z, p = andarGrade(v.cam, 30, P); v.x = p.x; v.z = p.z; v.h = p.h; v.vel = v.perf.vFuga;
          const c = v.perf.corRaio; for (let i = 0; i < 5; i++) fx.raio(ox, rnd(0.3, 1.8), oz, v.x, rnd(0.3, 1.8), v.z, { vida: 0.3, desvio: 1, r: c[0], g: c[1], b: c[2] });
          C.fase = 'perseguicao'; v.ciclo = v.perf.folego; v.cansado = false;
        }
      }
    } else if (C.fase === 'luta') {
      const vivos = vs.filter((v) => v.vida > 0);
      for (const v of vs) passoLuta(v, dt, P, vivos);
      C.semGolpe = (C.semGolpe || 0) + dt;
      const regen = vs.length > 1 ? 0.008 : vs[0].perf.regen;
      if (C.semGolpe > 3) P.vida = Math.min(1, P.vida + regen * dt);
      if (P.vida <= 0) { C.fase = 'derrota'; C.t = 0; C.derrotas++; avisar('A luta vai recomeçar', 'Você foi derrotado', 'alerta'); eventos.push({ tipo: 'derrota', id: C.cap.id, n: C.derrotas }); }
      else if (!vivos.length) { C.fase = 'vitoria'; C.t = 0; }
    } else if (C.fase === 'derrota') {
      for (const v of vs) { v.vx *= 0.8; v.vz *= 0.8; }
      if (C.t > 3) { iniciarLuta(P); for (const v of vs) { const a = rnd(0, 6.28); v.x = P.x + Math.cos(a) * 9; v.z = P.z + Math.sin(a) * 9; } }
    } else if (C.fase === 'vitoria') {
      if (C.t > 1.6) { C.fase = 'fimcena'; C.t = 0; eventos.push({ tipo: 'derrotado', id: C.cap.id }); }       // a cena da derrota do vilão
    } else if (C.fase === 'fimcena') {
      if (C.t > 60) continuar();
    }
    if (!C) return eventos.splice(0);
    desenhar(dt);
    atualizarHud(P);
    return eventos.splice(0);
  }
  /** depois da cena: o encontro vira perseguição/luta; a derrota do vilão encerra o capítulo */
  function continuar() {
    if (!C) return;
    const P = C.P, vs = C.viloes;
    if (C.fase === 'encontro') {
      if (C.cap.perseguicao) { C.fase = 'perseguicao'; C.t = 0; for (const v of vs) { v.estado = 'perseguicao'; v.vel = 20; } avisar(`Persiga o ${vs[0].perf.titulo}`, 'Perseguição', vs[0].id); }
      else iniciarLuta(P);
    } else if (C.fase === 'fimcena' || C.fase === 'vitoria') {
      // o vilão some num raio da cor dele
      for (const v of vs) { const c = v.perf.corRaio; for (let i = 0; i < 8; i++) fx.raio(v.x, v.y + rnd(0.2, 1.6), v.z, v.x + rnd(-6, 6), v.y + rnd(0, 4), v.z + rnd(-6, 6), { vida: 0.4, desvio: 0.8, r: c[0], g: c[1], b: c[2] }); fx.clarao(v.x, v.y + 1, v.z, 4, 0.3); }
      S.vencidos.add(C.cap.id); gravar();
      const cap = C.cap; encerrar(); espera = 90;
      if (cap.id === 'final') avisar('A cidade está salva', 'Fim', 'ok'); else avisar(cap.titulo.replace(/^.* — /, ''), 'Capítulo concluído', 'ok');
      eventos.push({ tipo: 'vitoria', id: cap.id });
    }
  }
  /** só o desenho (pose, raios), também durante as cenas com o jogo parado */
  function desenhar(dt) {
    if (!C) return;
    const vs = C.viloes;
    for (const v of vs) {
      const vel = Math.hypot(v.vx, v.vz);
      v.grupo.position.set(v.x, v.y, v.z);
      v.grupo.rotation.set(v.acao === 'caido' ? 0 : 0, v.h, 0);
      if (v.modelo) {
        let golpe = null;
        if (v.acao === 'combo') golpe = { tipo: 'soco', lado: v.golpes % 2 ? 1 : -1, k: clamp(1 - v.at / 0.28, 0, 1) };
        else if (v.acao === 'carrega') golpe = { tipo: 'raio', lado: 1, k: clamp(1 - v.at / 0.65, 0, 1) };
        v.modelo.aplicar({ v: vel, noChao: true, golpe, luta: C.fase === 'luta' && v.acao !== 'investida' ? 1 : 0, vibrando: v.acao === 'prepara' || v.acao === 'carrega' }, dt);
        // derrotado: cai de joelhos e tomba
        if (v.acao === 'caido') { v.at += dt; v.grupo.rotation.x = -Math.min(1.35, v.at * 2.2); v.grupo.position.y = v.y + 0.1; }
      }
      v.raios.atualizar(dt, v, vel, { vibrando: v.acao === 'prepara' || v.acao === 'carrega' || C.fase === 'aparece' || C.fase === 'encontro' });
    }
  }

  function atualizarHud(P) {
    const emLuta = C && (C.fase === 'luta' || C.fase === 'derrota' || C.fase === 'vitoria' || C.fase === 'fimcena');
    painel.hidden = !C; vidaBox.hidden = !emLuta;
    if (!C) return;
    const vs = C.viloes;
    pTitulo.textContent = vs.map((v) => v.perf.nome).join(' · ');
    pTitulo.style.color = vs.length > 1 ? '#fff' : vs[0].perf.cor;
    if (pBarras.childElementCount !== vs.length) pBarras.innerHTML = vs.map(() => '<div class="chefe-barra"><i></i></div>').join('');
    vs.forEach((v, k) => { const b = pBarras.children[k].firstChild; b.style.width = `${(v.vida / v.perf.vida) * 100}%`; b.style.background = v.perf.cor; });
    pBarras.style.display = emLuta ? '' : 'none';
    if (C.fase === 'aparece') pInfo.textContent = C.cap.texto;
    else if (C.fase === 'perseguicao' || C.fase === 'choque') { const v = vs[0]; pInfo.textContent = `Alcance e aperte BATER · ${v.capturas}/${v.perf.capturas} · ${Math.round(Math.hypot(P.x - v.x, P.z - v.z))} m · energia livre`; }
    else if (C.fase === 'luta') pInfo.textContent = vs.some((v) => v.acao === 'recupera' || v.acao === 'atordoado') ? 'Agora! Ele está cansado' : 'Desvie da investida (corra de lado, pule ou vibre) e bata quando ele cansar';
    else pInfo.textContent = '';
    vNivel.style.width = `${(P.vida ?? 1) * 100}%`;
  }

  return {
    atualizar, continuar,
    /** durante as cenas (jogo parado): só anima os vilões */
    posar(dt) { desenhar(dt); },
    /** onde a câmera da cena olha: o vilão (ou o meio dos dois) */
    foco(id) {
      if (!C) return null;
      const vs = id ? C.viloes.filter((v) => v.id === id) : C.viloes, n = vs.length; if (!n) return null;
      return { x: vs.reduce((a, v) => a + v.x, 0) / n, y: vs[0].y, z: vs.reduce((a, v) => a + v.z, 0) / n };
    },
    /** ids dos vilões do capítulo em andamento */
    get ids() { return C ? C.viloes.map((v) => v.id) : []; },
    /** quantas vezes o herói perdeu esta luta (cada uma deixa o vilão mais fácil, até 3) */
    get derrotas() { return C?.derrotas || 0; },
    get ativo() { return !!C; },
    get fase() { return C?.fase || null; },
    get emLuta() { return !!C && (C.fase === 'luta' || C.fase === 'derrota'); },
    /** durante a perseguição a energia não gasta e vai enchendo */
    get energiaLivre() { return !!C && (C.fase === 'perseguicao' || C.fase === 'choque' || C.fase === 'aparece' || C.fase === 'encontro'); },
    get viloes() { return C?.viloes || []; },
    /** alvo do guia: o vilão a encontrar ou perseguir */
    alvo() {
      if (!C || !(C.fase === 'aparece' || C.fase === 'perseguicao' || C.fase === 'choque')) return null;
      const v = C.viloes[0]; return { x: v.x, z: v.z, cor: v.perf.cor, rotulo: C.viloes.length > 1 ? 'Zoom e Flash Reverso' : v.perf.nome[0] + v.perf.nome.slice(1).toLowerCase() };
    },
    /** lista para a pausa: [{id, titulo, estado: 'bloqueado'|'liberado'|'vencido'}] */
    lista(missaoIdx) { return CAPITULOS.map((c, i) => ({ id: c.id, titulo: c.titulo, estado: S.vencidos.has(c.id) ? 'vencido' : liberado(i, missaoIdx) ? 'liberado' : 'bloqueado' })); },
    /** começa um capítulo agora (pausa ou ?capitulo=) */
    iniciar(id) { const i = CAPITULOS.findIndex((c) => c.id === id); if (i >= 0) { encerrar(); forcado = i; espera = 0; } },
    abandonar: encerrar,
    zerar() { encerrar(); S.vencidos.clear(); gravar(); },
  };
}
