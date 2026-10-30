// Os vilões da história (além das missões): capítulo 1 — Zoom; 2 — Capitão Frio; 3 — Onda Térmica; 4 — Mago do Tempo
// (os três com arma: ver PERFIS abaixo); 5 — Flash Reverso, o cérebro de tudo; e a batalha final contra Zoom e Reverso
// juntos, em frente ao S.T.A.R. Labs. Trajes, emblemas e raios com desenho próprio
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
import { colocarAderecos } from './aderecos.js';

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
// os vilões com ARMA (gente comum que ganhou poder com o Núcleo ou roubou tecnologia): não correm como velocistas;
// mantêm distância, avisam o ataque no chão (linha, cone, círculo) e ficam abertos enquanto recarregam. Fora disso o
// escudo do elemento segura parte dos golpes. Corpo do Rocketbox com a roupa tingida e adereços próprios (aderecos.js).
Object.assign(PERFIS, {
  frio: {
    nome: 'CAPITÃO FRIO', titulo: 'Capitão Frio', pessoa: 'frio', arma: 'gelo', cor: '#9fe6ff', corRaio: [0.5, 1.5, 2.6],
    vida: 90, esquiva: 0.5, dano: 0.12, telegrafo: 0.85, recupera: 1.7, rodeia: [1.4, 2.4], distancia: 13, regen: 0.015, fase2: false,
  },
  onda: {
    nome: 'ONDA TÉRMICA', titulo: 'Onda Térmica', pessoa: 'onda', arma: 'fogo', cor: '#ff8a3d', corRaio: [2.6, 0.9, 0.15],
    vida: 100, esquiva: 0.5, dano: 0.13, telegrafo: 0.8, recupera: 1.6, rodeia: [1.3, 2.3], distancia: 8, regen: 0.015, fase2: false,
  },
  mago: {
    nome: 'MAGO DO TEMPO', titulo: 'Mago do Tempo', pessoa: 'mago', arma: 'tempo', cor: '#7dffa8', corRaio: [0.6, 2.4, 1.0],
    vida: 110, esquiva: 0.55, dano: 0.14, telegrafo: 0.95, recupera: 1.5, rodeia: [1.2, 2.1], distancia: 14, regen: 0.012, fase2: false,
  },
});
// Ato 3 e 4: Savitar (velocista de armadura — a armadura tem de quebrar antes da vida) e DeVoe, o Pensador (não corre:
// flutua num disco, arremessa carros com a mente, solta um pulso que só quem pula escapa, cria cópias de si mesmo e se
// esconde atrás de um escudo alimentado por três torres — derrube as torres; na metade da vida ele as reergue)
Object.assign(PERFIS, {
  savitar: {
    nome: 'SAVITAR', titulo: 'Savitar', traje: 'savitar', aderecos: true, raio: 'azul', cor: '#9fdcff', corRaio: [0.7, 1.7, 2.8],
    vida: 140, capturas: 3, vFuga: 58, vCansado: 36, folego: 4.5, cansaco: 2.4, armadura: 70,
    rodeia: [1.1, 2.0], telegrafo: 0.55, recupera: 1.15, dano: 0.14, esquiva: 0.8, raios: true, fase2: true, regen: 0.012,
  },
  devoe: {
    nome: 'DEVOE', titulo: 'DeVoe', pessoa: 'devoe', arma: 'mente', cor: '#c79bff', corRaio: [1.7, 0.9, 2.7],
    vida: 160, esquiva: 0.35, dano: 0.13, telegrafo: 0.9, recupera: 1.6, rodeia: [1.3, 2.2], distancia: 15, regen: 0.01, fase2: true, flutua: 1.3,
  },
});
// Parte 2: a NEVASCA (a Caitlin da linha do tempo alterada: o raio de gelo do Capitão Frio, saindo das mãos; o corpo da
// Caitlin com a pele e a roupa geladas e uma coroa de gelo — aderecos.js) e o CORREDOR NEGRO (velocista; cada investida que
// acerta também drena a energia do herói: `drena`)
Object.assign(PERFIS, {
  nevasca: {
    nome: 'NEVASCA', titulo: 'Nevasca', pessoa: 'caitlin', arma: 'gelo', cor: '#dff4ff', corRaio: [0.75, 1.6, 2.8],
    vida: 95, esquiva: 0.5, dano: 0.11, telegrafo: 0.9, recupera: 1.7, rodeia: [1.4, 2.4], distancia: 13, regen: 0.015, fase2: false,
  },
  negro: {
    nome: 'CORREDOR NEGRO', titulo: 'Corredor Negro', traje: 'negro', raio: 'branco', cor: '#c8ccd6', corRaio: [1.6, 1.65, 1.9],
    vida: 140, capturas: 3, vFuga: 57, vCansado: 35, folego: 4.5, cansaco: 2.4,
    rodeia: [1.2, 2.2], telegrafo: 0.58, recupera: 1.2, dano: 0.13, esquiva: 0.8, raios: true, fase2: true, regen: 0.012, drena: 0.18,
  },
});
// Parte 2, Atos 7 e 8: a CIGARRA (gente comum com a ADAGA, um estilhaço do Núcleo que brilha verde: a mesma linha no chão do
// raio de gelo, mas a adaga voa e volta para a mão; quem ela acerta perde energia e fica lento por um instante) e o GODSPEED
// (velocista de armadura prata e dourada, como o Savitar, com o raio prateado)
Object.assign(PERFIS, {
  cigarra: {
    nome: 'CIGARRA', titulo: 'Cigarra', pessoa: 'frio', arma: 'adaga', cor: '#9dff6a', corRaio: [0.9, 2.4, 0.5],
    vida: 110, esquiva: 0.55, dano: 0.12, telegrafo: 0.8, recupera: 1.5, rodeia: [1.2, 2.2], distancia: 12, regen: 0.012, fase2: false, drena: 0.22,
  },
  godspeed: {
    nome: 'GODSPEED', titulo: 'Godspeed', traje: 'godspeed', aderecos: true, raio: 'prata', cor: '#f2e6c4', corRaio: [1.9, 1.75, 1.2],
    vida: 160, capturas: 3, vFuga: 60, vCansado: 37, folego: 4.2, cansaco: 2.4, armadura: 80,
    rodeia: [1.0, 1.9], telegrafo: 0.52, recupera: 1.1, dano: 0.15, esquiva: 0.82, raios: true, fase2: true, regen: 0.012,
  },
});
export const CAPITULOS = [
  { id: 'zoom', titulo: 'Capítulo 1 — Zoom', viloes: ['zoom'], perseguicao: true, texto: 'Um velocista de preto está aterrorizando a cidade. Encontre o Zoom e persiga-o.' },
  { id: 'frio', titulo: 'Capítulo 2 — Capitão Frio', viloes: ['frio'], perseguicao: false, lugar: 'cidade', texto: 'Um quarteirão do centro congelou. Encontre o Capitão Frio.' },
  { id: 'onda', titulo: 'Capítulo 3 — Onda Térmica', viloes: ['onda'], perseguicao: false, lugar: 'cidade', texto: 'Incêndios pelo centro. O Onda Térmica está no meio do fogo.' },
  { id: 'mago', titulo: 'Capítulo 4 — Mago do Tempo', viloes: ['mago'], perseguicao: false, lugar: 'cidade', texto: 'Uma tempestade verde se formou sobre a cidade. Encontre o Mago do Tempo.' },
  { id: 'reverso', titulo: 'Capítulo 5 — Flash Reverso', viloes: ['reverso'], perseguicao: true, texto: 'O Zoom era só o começo. Quem arquitetou tudo foi o Flash Reverso. Alcance-o.' },
  { id: 'final', titulo: 'Batalha final', viloes: ['zoom', 'reverso'], perseguicao: false, texto: 'Os dois voltaram juntos e esperam por você em frente ao S.T.A.R. Labs.' },
  { id: 'savitar', titulo: 'Capítulo 6 — Savitar', viloes: ['savitar'], perseguicao: true, texto: 'Algo saiu do túnel do tempo junto com você. Encontre o Savitar.' },
  { id: 'devoe', titulo: 'Capítulo 7 — DeVoe', viloes: ['devoe'], perseguicao: false, texto: 'O Pensador espera em frente ao S.T.A.R. Labs. Ele quer o Núcleo.' },
  { id: 'nevasca', titulo: 'Capítulo 8 — Nevasca', viloes: ['nevasca'], perseguicao: false, lugar: 'cidade', texto: 'Um quarteirão inteiro congelou em dez segundos. A Nevasca está no meio do gelo.' },
  { id: 'negro', titulo: 'Capítulo 9 — Corredor Negro', viloes: ['negro'], perseguicao: true, texto: 'Ele não tem rosto, não tem coração e não vai embora. Enfrente o Corredor Negro.' },
  { id: 'cigarra', titulo: 'Capítulo 10 — Cigarra', viloes: ['cigarra'], perseguicao: false, lugar: 'cidade', texto: 'A Cigarra está na cidade com a adaga. Encontre-a antes que ela risque mais um nome.' },
  { id: 'godspeed', titulo: 'Capítulo 11 — Godspeed', viloes: ['godspeed'], perseguicao: true, texto: 'O deus da velocidade quer o seu raio. Alcance o Godspeed.' },
  { id: 'nevasca2', titulo: 'Capítulo 12 — Nevasca', viloes: ['nevasca'], perseguicao: false, lugar: 'cidade', texto: 'A Nevasca acordou dentro da Caitlin. Encontre-a e traga a Caitlin de volta.' },
  { id: 'reverso2', titulo: 'Capítulo 13 — O acordo', viloes: ['reverso'], perseguicao: true, texto: 'O homem de amarelo não foi para o Núcleo. Alcance o Flash Reverso.' },
  { id: 'negro2', titulo: 'Capítulo 14 — O fim de toda corrida', viloes: ['negro'], perseguicao: false, texto: 'O Corredor Negro espera em frente ao S.T.A.R. Labs. Tudo o que você tem: agora.' },
  { id: 'malandros', titulo: 'Capítulo 15 — Os Malandros', viloes: ['frio', 'onda', 'mago'], perseguicao: false, lugar: 'cidade', texto: 'Gelo, fogo e tempestade no mesmo quarteirão. Os três juntos.' },
  { id: 'devoe2', titulo: 'Capítulo 16 — O Pensador de metal', viloes: ['devoe'], perseguicao: false, lugar: 'cidade', texto: 'O corpo novo do DeVoe está pronto, num galpão perto da ponte.' },
  { id: 'reinicio', titulo: 'Capítulo 17 — O Grande Reinício', viloes: ['devoe', 'frio', 'onda', 'mago'], perseguicao: false, texto: 'O DeVoe e os Malandros, juntos, em frente ao S.T.A.R. Labs. O satélite está caindo.' },
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

export function criarViloes(cena, { mobile = false, aniso = 2, combate, colide = null, chao = null, avisar = () => {}, armazem = null, labPos = { x: 0, z: 0 }, aoModelo = () => {} } = {}) {
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
      grupo: new THREE.Group(), modelo: modelos[id] || null, raios: perf.arma ? null : criarRaios(cena, { mobile, cor: perf.raio }), barra: null,
    };
    v.grupo.visible = false; cena.add(v.grupo);
    if (v.modelo) v.grupo.add(v.modelo.grupo);
    else criarHeroi({ aniso, lod: mobile ? 1 : 0, mobile, traje: perf.traje, pessoa: perf.pessoa }).then((m) => {
      if (perf.arma || perf.aderecos) m.adereco = colocarAderecos(id, m);
      modelos[id] = m; v.modelo = m; v.grupo.add(m.grupo); m.grupo.traverse((o) => { if (o.isMesh) o.castShadow = !mobile; }); aoModelo(id, m);
    }).catch((e) => console.warn('vilão sem corpo', e));
    // aviso da investida: uma faixa no chão do vilão até depois do herói
    v.aviso = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(...perf.corRaio), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    v.aviso.visible = false; cena.add(v.aviso);
    v.alvejavel = () => v.estado === 'perseguicao' || (v.estado === 'luta' && v.vida > 0);
    if (perf.arma === 'mente') prepararCopias();
    v.golpe = (tipo, P, info) => receberGolpe(v, tipo, P, info);
    return v;
  }
  function soltarVilao(v) {
    combate.removerAlvo(v); v.grupo.visible = false; v.aviso.visible = false;
    if (v.modelo) v.grupo.remove(v.modelo.grupo);
    cena.remove(v.grupo, v.aviso); v.raios?.dispose(); limparDevoe(v);
    if (v.efx) for (const m of Object.values(v.efx)) { cena.remove(m); m.material.dispose(); }
  }

  // ---------- capítulos ----------
  const liberado = (i, missaoIdx) => (i === 0 ? missaoIdx > 6 || S.vencidos.has('zoom') : S.vencidos.has(CAPITULOS[i - 1].id));
  // sozinho, o capítulo começa quando a história chega ao passo dele (missoes.js: `capitulo`); depois do fim, só pela pausa
  const proximo = (capitulo) => (capitulo && !S.vencidos.has(capitulo) ? CAPITULOS.findIndex((c) => c.id === capitulo) : -1);
  function comecar(i, P) {
    if (C) encerrar();
    const cap = CAPITULOS[i];
    C = { i, cap, fase: 'aparece', t: 0, viloes: cap.viloes.map(criarVilao), fora: 0, derrotas: 0 };
    let base;
    if (cap.perseguicao || cap.lugar === 'cidade') {
      // longe do herói (250–450 m), num cruzamento
      for (let k = 0; k < 40; k++) {
        const a = Math.random() * 6.28, r = rnd(250, 450), kx = Math.round((P.x + Math.cos(a) * r + MEIO) / CELL), kz = Math.round((P.z + Math.sin(a) * r + MEIO) / CELL);
        if (kx >= 4 && kz >= 4 && kx <= N - 4 && kz <= N - 4) { base = { x: eixo(kx), z: eixo(kz), kx, kz }; break; }
      }
      base = base || { x: eixo(N / 2 + 4), z: eixo(N / 2 + 4), kx: N / 2 + 4, kz: N / 2 + 4 };
    } else base = { x: labPos.x, z: labPos.z };
    const OFF = [[0, 0], [4, 2], [-4, 3], [2, -4]];                // (até quatro juntos sem um em cima do outro: os Malandros são três)
    C.viloes.forEach((v, k) => {
      v.x = base.x + OFF[k % 4][0]; v.z = base.z + OFF[k % 4][1]; v.y = 0; v.estado = 'aparece'; v.grupo.visible = true;
      v.cam = base.kx !== undefined ? { kx: base.kx, kz: base.kz, dir: Math.floor(Math.random() * 4), t: 0 } : null;
      combate.registrarAlvo(v);
    });
    if (cap.lugar === 'cidade') for (const id of cap.viloes) {           // o rastro de cada um no chão (gelo do Frio, fogo do Onda)
      const pf = PERFIS[id];
      if (pf.arma === 'gelo') for (let k = 0; k < 9; k++) novoPerigo('gelo', base.x + rnd(-16, 16), base.z + rnd(-16, 16), rnd(2, 4.5), 1e9, [0.35, 0.75, 1.0], 0.3);
      if (pf.arma === 'fogo') for (let k = 0; k < 5; k++) novoPerigo('fogo', base.x + rnd(-18, 18), base.z + rnd(-18, 18), rnd(1.8, 3), 1e9, [2.2, 0.7, 0.12], 0.45);
    }
    const nomes = cap.viloes.map((id) => PERFIS[id].titulo);
    if (cap.viloes.length > 1) avisar(`${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`, cap.id === 'final' ? 'Batalha final' : cap.titulo.replace(/^.* — /, ''), cap.viloes[cap.viloes.length - 1]);
    else avisar(`${PERFIS[cap.viloes[0]].titulo} apareceu`, 'Alerta na cidade', cap.viloes[0]);
    return C;
  }
  function encerrar() {
    if (!C) return;
    for (const v of C.viloes) soltarVilao(v);
    limparPerigos();
    C = null; painel.hidden = true; vidaBox.hidden = true;
  }
  function iniciarLuta(P) {
    C.fase = 'luta'; C.t = 0; P.vida = 1; C.lento = 0;
    for (let i = perigos.length - 1; i >= 0; i--) if (perigos[i].vida < 1e8) { cena.remove(perigos[i].mesh); perigos[i].mesh.material.dispose(); perigos.splice(i, 1); }
    const k = 1 - FACIL * Math.min(3, C.derrotas);
    for (const v of C.viloes) {
      v.facil = k; v.ataques = 0; if (v.efx) esconderEfeitos(v);
      v.armadura = v.perf.armadura || 0;
      if (v.perf.arma === 'mente') { limparDevoe(v); criarTorres(v); }
      v.estado = 'luta'; v.acao = 'rodeia'; v.at = rnd(...v.perf.rodeia) * (C.viloes.length > 1 ? 1.4 : 1); v.vida = v.perf.vida; v.fase2 = false; v.vx = v.vz = 0;
    }
    avisar(C.viloes.length > 2 ? 'Derrote os três' : C.viloes.length > 1 ? 'Derrote os dois' : C.viloes[0].perf.titulo, 'Luta', C.viloes.length > 1 ? C.viloes[C.viloes.length - 1].id : C.viloes[0].id);
    eventos.push({ tipo: 'luta', id: C.cap.id });
  }

  // ---------- golpes do herói nos vilões (chamado pelo combate) ----------
  function receberGolpe(v, tipo, P, info) {
    if (v.estado === 'perseguicao') { capturar(v, P); return true; }
    if (v.estado !== 'luta' || v.vida <= 0) return false;
    const vulneravel = v.acao === 'recupera' || v.acao === 'atordoado';
    if (!vulneravel) {
      const esp = v.perf.esquiva * (tipo === 'ciclone' || tipo === 'sonico' ? 0.6 : tipo === 'raio' ? 0.8 : 1) * (v.fase2 ? 1.04 : 1) * (v.facil ?? 1);
      if (Math.random() < esp) { esquivar(v, P); return false; }
    }
    if (v.perf.arma === 'mente' && v.torres?.some((t) => t.vida > 0)) { esquivar(v, P); eventos.push({ tipo: 'escudo', id: v.id }); return false; }   // DeVoe: o escudo das torres segura tudo
    const dano = (DANO[tipo] || 5) * (vulneravel ? 1 : 0.7);
    if (v.armadura > 0) {
      // Savitar: a armadura apanha primeiro (os especiais racham mais); quebrada, a vida fica aberta
      v.armadura = Math.max(0, v.armadura - dano * (info?.especial || (tipo !== 'soco' && tipo !== 'gancho') ? 1.5 : 1));
      fx.clarao(v.x, v.y + 1.3, v.z, 1.8, 0.14);
      for (let i = 0; i < 3; i++) fx.raio(v.x, v.y + rnd(0.8, 1.7), v.z, v.x + rnd(-1.5, 1.5), v.y + rnd(0.5, 2.2), v.z + rnd(-1.5, 1.5), { vida: 0.15, desvio: 0.3, r: 2.4, g: 2.4, b: 2.6 });
      if (v.armadura <= 0) { fx.onda(v.x, v.y, v.z, 8, 0.5); combate.hitstop = 0.15; avisar('A armadura quebrou', v.perf.titulo, 'ok'); eventos.push({ tipo: 'armadura', id: v.id }); }
      if (tipo !== 'soco' || !vulneravel) { v.acao = 'atordoado'; v.at = 0.3; }
      return true;
    }
    v.vida = Math.max(0, v.vida - dano);
    P.energia = Math.min(1, P.energia + 0.04);                 // acertar o vilão devolve energia para os especiais
    fx.clarao(v.x, v.y + 1.3, v.z, 2.2, 0.18);
    if (tipo !== 'soco' || !vulneravel) { v.acao = 'atordoado'; v.at = tipo === 'soco' ? 0.35 : 0.7; }
    if (v.perf.fase2 && !v.fase2 && v.vida < v.perf.vida * 0.5) {
      v.fase2 = true; eventos.push({ tipo: 'fase2', id: v.id });
      if (v.perf.arma === 'mente') { criarTorres(v); avisar('Ele reergueu as torres', 'DeVoe', 'devoe'); } else avisar(`${v.perf.titulo} acelerou`, 'Cuidado', v.id);
    }
    if (v.vida <= 0) derrotar(v);
    return true;
  }
  function esquivar(v, P) {
    if (v.perf.arma) {
      // vilão com arma: o escudo do elemento segura o golpe e empurra o herói para trás
      const c = v.perf.corRaio, dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz) || 1;
      fx.clarao(v.x, v.y + 1.2, v.z, 2.6, 0.2, c); fx.onda(v.x, v.y, v.z, 4, 0.35);
      P.vx += (dx / d) * 6; P.vz += (dz / d) * 6;
      return;
    }
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
    P.vida = Math.max(0, P.vida - dano * k * (P.protecao ?? 1)); C.semGolpe = 0;      // (P.protecao: a armadura do traje novo)
    const dr = Math.max(...C.viloes.map((v) => v.perf.drena || 0));               // o Corredor Negro também leva a energia
    if (dr) P.energia = Math.max(0, (P.energia ?? 1) - dr * k);
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
    if (v.perf.arma) return passoArma(v, dt, P);
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

  // ---------- vilões com arma: ataques avisados no chão e o que fica no chão (gelo, fogo, tornado) ----------
  const GEO = {
    faixa: new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
    cone: new THREE.CircleGeometry(1, 28, Math.PI / 2 - 0.5, 1.0).rotateX(-Math.PI / 2),
    anel: new THREE.RingGeometry(0.86, 1, 48).rotateX(-Math.PI / 2),
    disco: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
    feixe: new THREE.CylinderGeometry(0.11, 0.11, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    chama: new THREE.ConeGeometry(1, 1, 18, 1, true).rotateX(-Math.PI / 2).translate(0, 0, 0.5),
    tornado: new THREE.CylinderGeometry(4.2, 0.5, 15, 28, 8, true).translate(0, 7.5, 0),
  };
  // mancha no chão com a borda sumindo (gradiente radial) e um pouco de textura (gelo rachado / brasa)
  const texMancha = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.55, 'rgba(255,255,255,0.75)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    g.globalCompositeOperation = 'destination-out'; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1.2;
    for (let i = 0; i < 14; i++) { g.beginPath(); let x = 64, y = 64, a = Math.random() * 6.28; g.moveTo(x, y); for (let k = 0; k < 6; k++) { a += (Math.random() - 0.5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke(); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const matMancha = (rgb, op) => new THREE.MeshBasicMaterial({ map: texMancha, color: new THREE.Color(...rgb), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const matAditivo = (rgb, op) => new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const perigos = [];                                       // {tipo, x, z, r, t, vida, mesh, vx, vz}
  function novoPerigo(tipo, x, z, r, vida, rgb, op, geo = GEO.disco) {
    const mesh = new THREE.Mesh(geo, geo === GEO.disco ? matMancha(rgb, op * 1.4) : matAditivo(rgb, op)); mesh.position.set(x, (chao ? chao(x, z, 2) : 0) + 0.06, z); mesh.scale.setScalar(r);
    if (geo === GEO.disco) mesh.rotation.y = Math.random() * 6.28;
    cena.add(mesh); const p = { tipo, x, z, r, t: 0, vida, mesh, op, vx: 0, vz: 0 }; perigos.push(p); return p;
  }
  function limparPerigos() { for (const p of perigos) { cena.remove(p.mesh); p.mesh.material.dispose(); } perigos.length = 0; }
  // o efeito que acompanha cada vilão (aviso no chão, feixe, chama) — criado na 1ª vez
  function efeitos(v) {
    if (v.efx) return v.efx;
    const c = v.perf.corRaio, e = {
      faixa: new THREE.Mesh(GEO.faixa, matAditivo(c, 0)), cone: new THREE.Mesh(GEO.cone, matAditivo(c, 0)), anel: new THREE.Mesh(GEO.anel, matAditivo(c, 0)),
      miolo: new THREE.Mesh(GEO.disco, matAditivo(c, 0)), feixe: new THREE.Mesh(GEO.feixe, matAditivo(c, 0)), chama: new THREE.Mesh(GEO.chama, matAditivo([2.6, 1.1, 0.25], 0)),
    };
    for (const m of Object.values(e)) { m.visible = false; cena.add(m); }
    v.efx = e; return e;
  }
  function esconderEfeitos(v) { if (v.efx) for (const m of Object.values(v.efx)) m.visible = false; }
  const vP = new THREE.Vector3();
  function bocaDaArma(v) {
    const a = v.modelo?.adereco; if (a) { a.ponta.getWorldPosition(vP); return { x: vP.x, y: vP.y, z: vP.z }; }
    return { x: v.x + Math.sin(v.h) * 0.6, y: v.y + 1.3, z: v.z + Math.cos(v.h) * 0.6 };
  }
  function ferirSemEmpurrar(P, dano) { P.vida = Math.max(0, P.vida - dano * (P.protecao ?? 1) * Math.min(...C.viloes.map((v) => v.facil ?? 1))); C.semGolpe = 0; eventos.push({ tipo: 'dano' }); }
  /** o herói escapa: vibrando, no ar (alto) ou no golpe rápido */
  const escapa = (P, chaoY, alto = 0.9) => combate.intocavel || P.vibrando || P.y - chaoY > alto;

  function passoArma(v, dt, P) {
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz) || 1, chaoY = chao ? chao(P.x, P.z, P.y + 1) : 0;
    const e = efeitos(v), pf = v.perf, c = pf.corRaio;
    v.at -= dt; v.t += dt;
    switch (v.acao) {
      case 'rodeia': {
        // mantém a distância dele e anda de lado em volta do herói (gente comum: no máximo ~8 m/s)
        v.ang += dt * 0.55 * (v.lado || (v.lado = Math.random() < 0.5 ? -1 : 1));
        const R = pf.distancia, tx = P.x - Math.cos(v.ang) * R, tz = P.z - Math.sin(v.ang) * R, gx = tx - v.x, gz = tz - v.z, gd = Math.hypot(gx, gz) || 1;
        const vm = Math.min(8, gd * 2.5);
        v.vx = lerp(v.vx, (gx / gd) * vm, Math.min(1, dt * 5)); v.vz = lerp(v.vz, (gz / gd) * vm, Math.min(1, dt * 5));
        if (d < 3.2) v.perto = (v.perto || 0) + dt; else v.perto = 0;
        if (v.perto > 0.7) { v.acao = 'empurra'; v.at = 0.4; v.perto = 0; break; }
        if (v.at <= 0) {
          v.ataques = (v.ataques || 0) + 1;
          v.golpeArma = pf.arma === 'tempo' && v.ataques % 3 === 0 ? 'tornado' : pf.arma === 'mente' ? ['carro', 'pulso', 'carro', 'ilusao'][(v.ataques - 1) % 4] : pf.arma;   // 1º carro, 2º pulso, 3º carro, 4º as cópias
          v.acao = 'prepara'; v.at = pf.telegrafo * (v.golpeArma === 'tornado' ? 1.2 : 1);
          const vh = Math.hypot(P.vx, P.vz), ad = Math.min(8, vh * 0.25) / (vh || 1);   // o raio e o tornado miram onde o herói vai estar (até 8 m à frente)
          v.alvo = { x: P.x + P.vx * ad, z: P.z + P.vz * ad };
        }
        break;
      }
      case 'prepara': {
        v.vx *= 0.8; v.vz *= 0.8;
        const k = 1 - Math.max(0, v.at) / pf.telegrafo, op = 0.18 + 0.5 * k;
        if (v.at > 0.25) v.mira = Math.atan2(dx, dz);                       // segue o herói até o último quarto de segundo
        const g = v.golpeArma;
        if (g === 'gelo' || g === 'adaga') { e.faixa.visible = true; e.faixa.position.set(v.x, (chaoY || 0) + 0.08, v.z); e.faixa.rotation.y = v.mira; e.faixa.scale.set(g === 'adaga' ? 1.2 : 1.6, 1, g === 'adaga' ? 24 : 28); e.faixa.material.opacity = op; }
        else if (g === 'fogo') { e.cone.visible = true; e.cone.position.set(v.x, (chaoY || 0) + 0.08, v.z); e.cone.rotation.y = v.mira; e.cone.scale.setScalar(11); e.cone.material.opacity = op * 0.8; }
        else if (g === 'pulso' || g === 'ilusao') {
          e.anel.visible = true; e.anel.position.set(v.x, (chao ? chao(v.x, v.z, v.y) : 0) + 0.08, v.z); e.anel.scale.setScalar(1 + 5 * k); e.anel.material.opacity = op;
          if (Math.random() < dt * 10) fx.raio(v.x, v.y + 1.7, v.z, v.x + rnd(-2, 2), v.y + rnd(1, 3), v.z + rnd(-2, 2), { vida: 0.12, desvio: 0.4, r: pf.corRaio[0], g: pf.corRaio[1], b: pf.corRaio[2] });
        } else {
          const r = g === 'tornado' ? 3.2 : g === 'carro' ? 3.4 : 2.6;
          if (g === 'carro') carroNoAr(v, k);
          if (g !== 'tornado') v.alvo = { x: lerp(v.alvo.x, P.x, Math.min(1, dt * 2)), z: lerp(v.alvo.z, P.z, Math.min(1, dt * 2)) };
          const y = (chao ? chao(v.alvo.x, v.alvo.z, P.y + 2) : 0) + 0.08;
          e.anel.visible = e.miolo.visible = true; e.anel.position.set(v.alvo.x, y, v.alvo.z); e.miolo.position.copy(e.anel.position);
          e.anel.scale.setScalar(r); e.miolo.scale.setScalar(r * k); e.anel.material.opacity = op; e.miolo.material.opacity = op * 0.35;
          if (Math.random() < dt * 8) { const b = bocaDaArma(v); fx.raio(b.x, b.y, b.z, b.x + rnd(-0.6, 0.6), b.y + rnd(0.2, 1), b.z + rnd(-0.6, 0.6), { vida: 0.12, desvio: 0.3, r: c[0], g: c[1], b: c[2] }); }
        }
        if (v.at <= 0) { esconderEfeitos(v); disparar(v, P, chaoY); v.acao = 'dispara'; v.at = v.golpeArma === 'fogo' ? 0.75 : 0.45; }
        break;
      }
      case 'dispara': {
        v.vx *= 0.7; v.vz *= 0.7;
        const b = bocaDaArma(v), g = v.golpeArma;
        if (g === 'gelo') {
          e.feixe.visible = true; e.feixe.position.set(b.x, b.y, b.z); e.feixe.rotation.set(0, v.mira, 0); e.feixe.scale.set(1 + Math.random() * 0.4, 1 + Math.random() * 0.4, 28);
          e.feixe.material.opacity = 0.9 * Math.max(0, v.at / 0.45);
        } else if (g === 'fogo') {
          e.chama.visible = true; e.chama.position.set(b.x, b.y, b.z); e.chama.rotation.set(0, v.mira, 0);
          const s = 11 * Math.min(1, (0.75 - v.at) * 6); e.chama.scale.set(s * 0.42, s * 0.3 * (0.9 + Math.random() * 0.2), s);
          e.chama.material.opacity = 0.55 + Math.random() * 0.25;
          // o jato queima enquanto dura: quem entra no cone apanha
          if (!v.acertou && dentroDoCone(v, P, 11, 0.5) && !escapa(P, chaoY, 1.6)) { v.acertou = true; ferirHeroi(P, pf.dano, dx, dz); fx.clarao(P.x, P.y + 1.2, P.z, 2.6, 0.2); }
        }
        if (v.at <= 0) { esconderEfeitos(v); v.acao = 'recupera'; v.at = pf.recupera / (v.facil ?? 1); }
        break;
      }
      case 'empurra': {
        // o herói colado nele: uma onda do elemento empurra para longe
        v.vx *= 0.7; v.vz *= 0.7;
        e.anel.visible = true; e.anel.position.set(v.x, v.y + 0.08, v.z); e.anel.scale.setScalar(4.5 * (1 - Math.max(0, v.at) / 0.4)); e.anel.material.opacity = 0.7;
        if (v.at <= 0) {
          esconderEfeitos(v); fx.onda(v.x, v.y, v.z, 6, 0.4); fx.clarao(v.x, v.y + 1.1, v.z, 3.5, 0.25);
          if (d < 4.6 && !escapa(P, chaoY)) { ferirSemEmpurrar(P, pf.dano * 0.45); P.vx += (dx / d) * 18; P.vz += (dz / d) * 18; P.vy = Math.max(P.vy || 0, 4); }
          v.acao = 'rodeia'; v.at = rnd(...pf.rodeia) * 0.6;
        }
        break;
      }
      case 'recupera': case 'atordoado':
        v.vx *= 0.85; v.vz *= 0.85;
        if (v.at <= 0) { v.acao = 'rodeia'; v.at = rnd(...pf.rodeia); }
        break;
      case 'caido': v.vx = v.vz = 0; esconderEfeitos(v); break;
      default: break;
    }
    v.x += v.vx * dt; v.z += v.vz * dt;
    if (colide) { const r = colide(v.x, v.z, v.y); v.x = r.x; v.z = r.z; }
    v.y = (chao ? chao(v.x, v.z, v.y + 1) : 0) + (pf.flutua ? pf.flutua + 0.15 * Math.sin(v.t * 1.7) : 0);
    if (pf.arma === 'mente') passoDevoe(v, dt, P);
    const alvoH = v.acao === 'prepara' || v.acao === 'dispara' ? v.mira ?? Math.atan2(dx, dz) : Math.atan2(dx, dz);
    if (v.acao !== 'caido') v.h += ang(alvoH - v.h) * Math.min(1, dt * 10);
  }
  function dentroDoCone(v, P, alcance, meio) {
    const dx = P.x - v.x, dz = P.z - v.z, d = Math.hypot(dx, dz);
    return d < alcance && Math.abs(ang(Math.atan2(dx, dz) - v.mira)) < meio + 0.6 / Math.max(1, d);
  }
  /** o golpe sai: acerta (ou não) e deixa o rastro no chão */
  function disparar(v, P, chaoY) {
    const pf = v.perf, c = pf.corRaio, g = v.golpeArma, b = bocaDaArma(v), dx = P.x - v.x, dz = P.z - v.z;
    v.acertou = false;
    if (g === 'gelo') {
      const ux = Math.sin(v.mira), uz = Math.cos(v.mira), ao = dx * ux + dz * uz, lado = Math.abs(dx * uz - dz * ux);
      for (let s = 4; s <= 26; s += 5.5) novoPerigo('gelo', v.x + ux * s, v.z + uz * s, rnd(1.8, 2.6), 9, [0.35, 0.75, 1.0], 0.32);   // o chão congela na linha
      if (ao > 0 && ao < 28 && lado < 1.4 && !escapa(P, chaoY)) { ferirHeroi(P, pf.dano, ux, uz); C.lento = 2.6; fx.clarao(P.x, P.y + 1.2, P.z, 3, 0.25); eventos.push({ tipo: 'congelado' }); }
      for (let i = 0; i < 3; i++) fx.raio(b.x, b.y, b.z, b.x + ux * 28, b.y - 0.8, b.z + uz * 28, { vida: 0.3, desvio: 0.25, r: c[0], g: c[1], b: c[2] });
    } else if (g === 'adaga') {
      // a adaga vai até 24 m na linha e volta (dois riscos verdes); quem está na linha perde energia (perf.drena) e fica lento
      const ux = Math.sin(v.mira), uz = Math.cos(v.mira), ao = dx * ux + dz * uz, lado = Math.abs(dx * uz - dz * ux);
      if (ao > 0 && ao < 24 && lado < 1.2 && !escapa(P, chaoY)) { ferirHeroi(P, pf.dano, ux, uz); C.lento = 1.2; fx.clarao(P.x, P.y + 1.2, P.z, 2.6, 0.25); }
      for (let i = 0; i < 2; i++) fx.raio(b.x, b.y, b.z, b.x + ux * 24, b.y - 0.6, b.z + uz * 24, { vida: 0.45, desvio: 0.15, r: c[0], g: c[1], b: c[2] });
    } else if (g === 'fogo') {
      const ux = Math.sin(v.mira), uz = Math.cos(v.mira);
      novoPerigo('fogo', v.x + ux * 7.5, v.z + uz * 7.5, 2.6, 4.5, [2.2, 0.7, 0.12], 0.5);
    } else if (g === 'tempo') {
      // o raio cai do céu no círculo
      const y0 = chao ? chao(v.alvo.x, v.alvo.z, P.y + 2) : 0;
      for (let i = 0; i < 3; i++) fx.raio(v.alvo.x + rnd(-1, 1), y0 + 34, v.alvo.z + rnd(-1, 1), v.alvo.x, y0, v.alvo.z, { vida: 0.35, desvio: 2.2, r: c[0], g: c[1], b: c[2] });
      fx.clarao(v.alvo.x, y0 + 1, v.alvo.z, 6, 0.3); fx.onda(v.alvo.x, y0, v.alvo.z, 5, 0.4); combate.hitstop = 0.05;
      if (Math.hypot(P.x - v.alvo.x, P.z - v.alvo.z) < 2.7 && !(combate.intocavel || P.vibrando)) ferirHeroi(P, pf.dano, P.x - v.alvo.x || 0.01, P.z - v.alvo.z);
    } else if (g === 'tornado') {
      const t = novoPerigo('tornado', v.alvo.x, v.alvo.z, 1, 5, [0.55, 1.4, 0.8], 0.28, GEO.tornado);
      t.mesh.position.y -= 0.06;
    } else if (g === 'carro') lancarCarro(v);
    else if (g === 'pulso') { const p = novoPerigo('pulso', v.x, v.z, 1, 1.7, v.perf.corRaio, 0.75, GEO.anel); p.y0 = v.y; p.acertou = false; }
    else if (g === 'ilusao') criarCopias(v, P);
  }
  /** o que ficou no chão: gelo (deixa lento), fogo (queima), tornado (puxa e machuca no centro) */
  function passoPerigos(dt, P) {
    const chaoY = chao ? chao(P.x, P.z, P.y + 1) : 0, noChao = P.y - chaoY < 0.3;
    for (let i = perigos.length - 1; i >= 0; i--) {
      const p = perigos[i]; p.t += dt;
      const fim = Math.min(1, (p.vida - p.t) / 0.6), d = Math.hypot(P.x - p.x, P.z - p.z);
      if (p.tipo === 'pulso') {
        // o anel do pulso mental se abre a 18 m/s: quem está no chão quando ele passa apanha e fica tonto
        p.r = 1 + 18 * p.t; p.mesh.scale.setScalar(p.r); p.mesh.material.opacity = p.op * fim;
        const dp = Math.hypot(P.x - p.x, P.z - p.z);
        if (!p.acertou && Math.abs(dp - p.r) < 1.3 && noChao && !P.vibrando && !combate.intocavel) { p.acertou = true; ferirSemEmpurrar(P, 0.11); P.vx *= 0.15; P.vz *= 0.15; fx.clarao(P.x, P.y + 1.2, P.z, 2.4, 0.2); }
      } else if (p.tipo === 'carro') {
        voarCarro(p, dt, P, noChao);
      } else if (p.tipo === 'tornado') {
        const dx = P.x - p.x, dz = P.z - p.z, n = d || 1;
        p.x += (dx / n) * 3.2 * dt; p.z += (dz / n) * 3.2 * dt;                 // anda atrás do herói
        p.mesh.position.x = p.x; p.mesh.position.z = p.z; p.mesh.rotation.y += dt * 6;
        p.mesh.material.opacity = p.op * fim * (0.85 + Math.random() * 0.3);
        // puxa: arrasta a posição (a freada do herói parado anulava um puxão só na velocidade); as paredes seguram
        if (d < 11 && d > 0.3 && !P.vibrando) {
          const f = 7.5 * (1 - d / 11) * dt, nx = P.x - (dx / n) * f, nz = P.z - (dz / n) * f;
          const r = colide ? colide(nx, nz, P.y) : { x: nx, z: nz }; P.x = r.x; P.z = r.z;
        }
        if (d < 1.8 && !P.vibrando) { ferirSemEmpurrar(P, 0.12 * dt); P.vy = Math.max(P.vy || 0, 3); }
        if (Math.random() < dt * 6) fx.raio(p.x + rnd(-2, 2), rnd(2, 12), p.z + rnd(-2, 2), p.x + rnd(-3, 3), rnd(2, 12), p.z + rnd(-3, 3), { vida: 0.15, desvio: 0.5, r: 0.6, g: 2.2, b: 1 });
      } else {
        p.mesh.material.opacity = p.op * fim * (p.tipo === 'fogo' ? 0.8 + Math.random() * 0.4 : 1);
        if (d < p.r && noChao && !P.vibrando) {
          if (p.tipo === 'gelo') C.lento = Math.max(C.lento || 0, 0.4);
          else if (p.tipo === 'fogo') ferirSemEmpurrar(P, 0.1 * dt);
        }
        if (p.tipo === 'fogo' && Math.random() < dt * 5) fx.raio(p.x + rnd(-p.r, p.r) * 0.7, (p.mesh.position.y) + 0.1, p.z + rnd(-p.r, p.r) * 0.7, p.x + rnd(-1, 1), p.mesh.position.y + rnd(1, 2.4), p.z + rnd(-1, 1), { vida: 0.18, desvio: 0.4, r: 2.6, g: 0.9, b: 0.15 });
      }
      if (p.t >= p.vida) { cena.remove(p.mesh); p.mesh.material.dispose(); perigos.splice(i, 1); }
    }
    if (C.lento > 0) C.lento -= dt;
  }

  // ---------- DeVoe: torres do escudo, carros arremessados e cópias ----------
  const GEO_TORRE = new THREE.CylinderGeometry(0.45, 0.7, 5, 12).translate(0, 2.5, 0), GEO_TOPO = new THREE.IcosahedronGeometry(0.55, 1);
  const GEO_FEIXE = new THREE.CylinderGeometry(0.06, 0.06, 1, 6, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const GEO_CARRO = new THREE.BoxGeometry(1.9, 1.3, 4.2);
  const vA = new THREE.Vector3(), vB = new THREE.Vector3();
  function criarTorres(v) {
    for (const t of v.torres || []) apagarTorre(t, true);
    v.torres = [];
    const c = v.perf.corRaio;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4, x = v.x + Math.cos(a) * 14, z = v.z + Math.sin(a) * 14, y = chao ? chao(x, z, 3) : 0;
      const g = new THREE.Group(); g.position.set(x, y, z);
      const mC = new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.85, roughness: 0.3 });
      const mL = new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), toneMapped: false });
      const corpo = new THREE.Mesh(GEO_TORRE, mC); corpo.castShadow = !mobile; g.add(corpo);
      const topo = new THREE.Mesh(GEO_TOPO, mL); topo.position.y = 5.4; g.add(topo);
      const feixe = new THREE.Mesh(GEO_FEIXE, new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      cena.add(g, feixe);
      const t = { x, z, y, vida: 4, g, feixe, topo, mats: [mC, mL, feixe.material] };
      t.alvo = { extra: true, x, y: y + 1, z, alvejavel: () => t.vida > 0, golpe: (tipo, P, info) => golpeTorre(v, t, tipo, info) };
      combate.registrarAlvo(t.alvo); v.torres.push(t);
    }
    if (!v.escudo) { v.escudo = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(...c), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); cena.add(v.escudo); }
  }
  function golpeTorre(v, t, tipo, info) {
    if (t.vida <= 0) return false;
    t.vida -= info?.especial || (tipo !== 'soco' && tipo !== 'gancho') ? 4 : 1.4;
    fx.clarao(t.x, t.y + 3, t.z, 2.5, 0.18);
    if (t.vida <= 0) {
      apagarTorre(t);
      fx.onda(t.x, t.y, t.z, 8, 0.5); combate.hitstop = 0.1;
      const c = v.perf.corRaio; for (let i = 0; i < 6; i++) fx.raio(t.x, t.y + 4, t.z, t.x + rnd(-4, 4), t.y + rnd(0, 6), t.z + rnd(-4, 4), { vida: 0.3, desvio: 0.6, r: c[0], g: c[1], b: c[2] });
      const resta = v.torres.filter((x) => x.vida > 0).length;
      avisar(resta ? `Torre derrubada (${3 - resta}/3)` : 'O escudo caiu', 'DeVoe', resta ? 'info' : 'ok');
      eventos.push({ tipo: resta ? 'torre' : 'escudo-caiu', id: v.id });
    }
    return true;
  }
  function apagarTorre(t, tudo = false) {
    combate.removerAlvo(t.alvo); t.vida = 0;
    cena.remove(t.feixe); t.feixe.material.dispose();
    if (tudo) { cena.remove(t.g); t.mats.forEach((m) => m.dispose()); }
    else { t.topo.visible = false; t.g.rotation.z = 0.5; t.g.position.y -= 0.8; }          // derrubada: fica caída no chão até o fim da luta
  }
  function limparDevoe(v) {
    for (const t of v.torres || []) apagarTorre(t, true);
    v.torres = [];
    for (const c of v.copias || []) sumirCopia(c, true);
    v.copias = [];
    if (v.escudo) { cena.remove(v.escudo); v.escudo.material.dispose(); v.escudo.geometry.dispose(); v.escudo = null; }
    if (v.carroNoAr) { cena.remove(v.carroNoAr); v.carroNoAr.material.dispose(); v.carroNoAr = null; }
  }
  function passoDevoe(v, dt, P) {
    const c = v.perf.corRaio, protegido = v.torres?.some((t) => t.vida > 0);
    for (const t of v.torres || []) {
      if (t.vida <= 0) continue;
      vA.set(t.x, t.y + 5.4, t.z); vB.set(v.x, v.y + 1.2, v.z);
      t.feixe.position.copy(vA); t.feixe.lookAt(vB); t.feixe.scale.set(1, 1, vA.distanceTo(vB));
      t.feixe.material.opacity = 0.45 + 0.3 * Math.random(); t.topo.rotation.y += dt * 2;
    }
    if (v.escudo) { v.escudo.visible = !!protegido && v.acao !== 'caido'; v.escudo.position.set(v.x, v.y + 1.1, v.z); v.escudo.material.opacity = 0.14 + 0.06 * Math.sin(v.t * 6); }
    // as cópias: flutuam, olham para o herói e soltam um raio fraco de vez em quando
    for (const cp of v.copias || []) {
      if (!cp.vivo) continue;
      cp.t += dt; cp.y = (chao ? chao(cp.x, cp.z, 3) : 0) + 1.3 + 0.15 * Math.sin(cp.t * 1.7 + 1);
      cp.raiz.position.set(cp.x, cp.y, cp.z); cp.raiz.rotation.y = Math.atan2(P.x - cp.x, P.z - cp.z);
      cp.modelo.aplicar({ v: 0, noChao: true, golpe: { tipo: 'raio', lado: 1, k: 0.4 } }, dt);
      cp.alvo.x = cp.x; cp.alvo.y = cp.y; cp.alvo.z = cp.z;
      cp.tiro -= dt;
      if (cp.tiro <= 0) {
        cp.tiro = rnd(1.6, 2.6);
        fx.raio(cp.x, cp.y + 1.6, cp.z, P.x, P.y + 1.1, P.z, { vida: 0.25, desvio: 0.8, r: c[0], g: c[1], b: c[2] });
        if (!escapa(P, chao ? chao(P.x, P.z, P.y + 1) : 0)) ferirSemEmpurrar(P, 0.035);
      }
      if (cp.t > 8) sumirCopia(cp);
    }
  }
  // o carro sobe ao lado dele no aviso (girando, com o brilho do poder) e é arremessado no círculo
  const CORES_CARRO = [0x8a1f2a, 0x1f3f8a, 0xd8d8d0, 0x202428, 0x2f6b3a];
  function carroNoAr(v, k) {
    if (!v.carroNoAr) {
      v.carroNoAr = new THREE.Mesh(GEO_CARRO, new THREE.MeshStandardMaterial({ color: CORES_CARRO[Math.floor(Math.random() * CORES_CARRO.length)], metalness: 0.6, roughness: 0.35, emissive: new THREE.Color(...v.perf.corRaio).multiplyScalar(0.12) }));
      v.carroNoAr.castShadow = !mobile; cena.add(v.carroNoAr);
    }
    v.carroNoAr.position.set(v.x + Math.sin(v.h + 1.3) * 3, v.y + 2.5 + 2.5 * k, v.z + Math.cos(v.h + 1.3) * 3);
    v.carroNoAr.rotation.set(Math.sin(v.t * 3) * 0.4, v.t * 1.5, Math.cos(v.t * 2) * 0.3);
  }
  function lancarCarro(v) {
    const m = v.carroNoAr; if (!m) return; v.carroNoAr = null;
    const p = { tipo: 'carro', x: v.alvo.x, z: v.alvo.z, r: 3.4, t: 0, vida: 7, mesh: m, op: 1, de: m.position.clone(), dur: 0.6, caiu: false };
    perigos.push(p);
  }
  function voarCarro(p, dt, P, noChao) {
    const m = p.mesh;
    if (p.t < p.dur) {
      const k = p.t / p.dur, y0 = chao ? chao(p.x, p.z, 3) : 0;
      m.position.set(lerp(p.de.x, p.x, k), lerp(p.de.y, y0 + 0.65, k) + Math.sin(k * Math.PI) * 6, lerp(p.de.z, p.z, k));
      m.rotation.x += dt * 6;
    } else if (!p.caiu) {
      p.caiu = true; const y0 = chao ? chao(p.x, p.z, 3) : 0;
      m.position.set(p.x, y0 + 0.65, p.z); m.rotation.set(0, m.rotation.y, Math.PI * (Math.random() < 0.5 ? 0 : 1));
      fx.clarao(p.x, y0 + 1, p.z, 5, 0.3); fx.onda(p.x, y0, p.z, 9, 0.5); combate.hitstop = 0.06;
      if (Math.hypot(P.x - p.x, P.z - p.z) < 3.4 && !escapa(P, chao ? chao(P.x, P.z, P.y + 1) : 0)) ferirHeroi(P, 0.14, P.x - p.x || 0.01, P.z - p.z);
    } else if (p.vida - p.t < 0.6) m.scale.setScalar(Math.max(0.01, (p.vida - p.t) / 0.6));
  }
  // as cópias: o DeVoe some e aparece em um de três lugares em volta do herói; as outras duas são ilusões
  const modelosCopia = [];
  function prepararCopias() {
    while (modelosCopia.length < 2) {
      const slot = { modelo: null };
      modelosCopia.push(slot);
      criarHeroi({ aniso, lod: 1, mobile, pessoa: 'devoe' }).then((m) => { colocarAderecos('devoe', m); slot.modelo = m; }).catch(() => {});
    }
  }
  function criarCopias(v, P) {
    const a0 = rnd(0, 6.28), lugares = [0, 1, 2].map((k) => ({ x: P.x + Math.cos(a0 + k * 2.09) * 10, z: P.z + Math.sin(a0 + k * 2.09) * 10 }));
    const real = Math.floor(Math.random() * 3), c = v.perf.corRaio;
    fx.clarao(v.x, v.y + 1.2, v.z, 3, 0.25);
    const r = colide ? colide(lugares[real].x, lugares[real].z, 0) : lugares[real]; v.x = r.x; v.z = r.z;
    for (const cp of v.copias || []) sumirCopia(cp, true);
    v.copias = [];
    lugares.forEach((l, k) => {
      if (k === real) return;
      const slot = modelosCopia.find((s) => s.modelo && !s.usado); if (!slot) return;
      slot.usado = true;
      const raiz = new THREE.Group(); raiz.add(slot.modelo.grupo); cena.add(raiz);
      const q = colide ? colide(l.x, l.z, 0) : l;
      const cp = { slot, modelo: slot.modelo, raiz, x: q.x, z: q.z, y: 0, t: 0, tiro: rnd(0.8, 2), vivo: true };
      cp.alvo = { extra: true, x: cp.x, y: 1, z: cp.z, alvejavel: () => cp.vivo, golpe: () => { sumirCopia(cp); avisar('Era uma ilusão', 'DeVoe', 'info'); return true; } };
      combate.registrarAlvo(cp.alvo); v.copias.push(cp);
      fx.clarao(cp.x, 2.5, cp.z, 3, 0.25);
    });
    for (const l of lugares) for (let i = 0; i < 2; i++) fx.raio(l.x, 6, l.z, l.x + rnd(-1, 1), 0.5, l.z + rnd(-1, 1), { vida: 0.25, desvio: 0.8, r: c[0], g: c[1], b: c[2] });
  }
  function sumirCopia(cp, tudo = false) {
    if (!cp.vivo && !tudo) return;
    cp.vivo = false; combate.removerAlvo(cp.alvo);
    if (!tudo) { const c = PERFIS.devoe.corRaio; fx.clarao(cp.x, cp.y + 1.2, cp.z, 3, 0.3); for (let i = 0; i < 4; i++) fx.raio(cp.x, cp.y + 1.2, cp.z, cp.x + rnd(-3, 3), cp.y + rnd(0, 3), cp.z + rnd(-3, 3), { vida: 0.2, desvio: 0.5, r: c[0], g: c[1], b: c[2] }); }
    cp.raiz.remove(cp.modelo.grupo); cena.remove(cp.raiz); cp.slot.usado = false;
  }

  // ---------- passo ----------
  /** ctx: {capitulo (o do passo atual da história), podeComecar} → eventos [{tipo: 'dano'|'vitoria'|'capitulo'|'derrota'}] */
  function atualizar(dt, P, ctx) {
    if (!C) {
      const i = forcado ?? proximo(ctx.capitulo);
      if (i >= 0 && (forcado !== null || ctx.podeComecar)) { espera -= dt; if (espera <= 0 || forcado !== null) { forcado = null; comecar(i, P); eventos.push({ tipo: 'capitulo', id: CAPITULOS[i].id }); } }
      else espera = Math.max(espera, 2.5);                    // o passo do capítulo chegou: começa logo (2,5 s para o rádio respirar)
      return eventos.splice(0);
    }
    C.t += dt; C.P = P;
    const vs = C.viloes, chaoP = chao ? chao(P.x, P.z, P.y + 1) : 0;
    if (C.fase === 'aparece') {
      for (const v of vs) { v.vx = v.vz = 0; v.t += dt; v.h += ang(Math.atan2(P.x - v.x, P.z - v.z) - v.h) * Math.min(1, dt * 4); }
      for (const v of vs) if (v.perf.arma === 'tempo' && Math.random() < dt * 1.2) { const c = v.perf.corRaio, x = v.x + rnd(-25, 25), z = v.z + rnd(-25, 25); fx.raio(x, 40, z, x + rnd(-2, 2), 0, z + rnd(-2, 2), { vida: 0.3, desvio: 2.5, r: c[0], g: c[1], b: c[2] }); }
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
      if (d > 300) { C.fora += dt; if (C.fora > 7) { avisar(`${v.perf.titulo} escapou`, 'Perseguição', 'alerta'); const i = C.i; encerrar(); espera = 6; forcado = null; eventos.push({ tipo: 'escapou', i, id: CAPITULOS[i].id }); return eventos.splice(0); } }
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
      passoPerigos(dt, P);
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
      const cap = C.cap; encerrar(); espera = 3;
      if (cap.id === 'final') avisar('A cidade está salva', 'Fim', 'ok'); else avisar(cap.titulo.replace(/^.* — /, ''), 'Capítulo concluído', 'ok');
      eventos.push({ tipo: 'vitoria', id: cap.id });
    }
  }
  /** só o desenho (pose, raios), também durante as cenas com o jogo parado */
  function desenhar(dt, quemFala = null) {
    if (!C) return;
    const vs = C.viloes;
    for (const v of vs) {
      const vel = Math.hypot(v.vx, v.vz);
      v.grupo.position.set(v.x, v.y, v.z);
      v.grupo.rotation.set(v.acao === 'caido' ? 0 : 0, v.h, 0);
      if (v.modelo) {
        let golpe = null;
        if (v.perf.arma) golpe = { tipo: 'raio', lado: 1, k: v.acao === 'prepara' || v.acao === 'dispara' ? 1 : v.acao === 'caido' ? 0 : 0.35 };
        else if (v.acao === 'combo') golpe = { tipo: 'soco', lado: v.golpes % 2 ? 1 : -1, k: clamp(1 - v.at / 0.28, 0, 1) };
        else if (v.acao === 'carrega') golpe = { tipo: 'raio', lado: 1, k: clamp(1 - v.at / 0.65, 0, 1) };
        v.modelo.aplicar({ v: vel, noChao: true, golpe, luta: C.fase === 'luta' && v.acao !== 'investida' && !v.perf.arma ? 1 : 0, vibrando: v.acao === 'prepara' || v.acao === 'carrega', fala: quemFala === v.id }, dt);
        // derrotado: cai de joelhos e tomba
        if (v.acao === 'caido') { v.at += dt; v.grupo.rotation.x = -Math.min(1.35, v.at * 2.2); v.grupo.position.y = v.y + 0.1; }
      }
      v.raios?.atualizar(dt, v, vel, { vibrando: v.acao === 'prepara' || v.acao === 'carrega' || C.fase === 'aparece' });   // na conversa, sem os raios por cima do rosto
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
    // com armadura, a barra mostra a armadura (prata); quebrada, a vida
    vs.forEach((v, k) => { const b = pBarras.children[k].firstChild, arm = v.armadura > 0; b.style.width = `${(arm ? v.armadura / v.perf.armadura : v.vida / v.perf.vida) * 100}%`; b.style.background = arm ? '#c9d6e3' : v.perf.cor; });
    pBarras.style.display = emLuta ? '' : 'none';
    if (C.fase === 'aparece') pInfo.textContent = C.cap.texto;
    else if (C.fase === 'perseguicao' || C.fase === 'choque') { const v = vs[0]; pInfo.textContent = `Alcance e aperte BATER · ${v.capturas}/${v.perf.capturas} · ${Math.round(Math.hypot(P.x - v.x, P.z - v.z))} m · energia livre`; }
    else if (C.fase === 'luta') {
      const arma = vs[0].perf.arma, aberto = vs.some((v) => v.acao === 'recupera' || v.acao === 'atordoado');
      const v0 = vs[0], torres = v0.torres?.filter((t) => t.vida > 0).length || 0;
      pInfo.textContent = arma === 'mente' && torres ? `Derrube as torres do escudo (${torres} de pé) · pule o pulso mental`
        : v0.armadura > 0 ? `Quebre a armadura (${Math.round((v0.armadura / v0.perf.armadura) * 100)}%) · os especiais racham mais`
        : aberto ? (arma ? 'Agora! Ele está aberto' : 'Agora! Ele está cansado')
        : arma === 'gelo' ? 'Saia da linha do raio de gelo e bata quando ele recarregar' : arma === 'adaga' ? 'Saia da linha da adaga e bata quando ela voltar para a mão' : arma === 'fogo' ? 'Fique fora do jato de fogo e bata quando ele parar'
        : arma === 'tempo' ? 'Saia do círculo antes do raio e fuja do tornado'
        : arma === 'mente' ? 'Saia do círculo do carro, pule o pulso e ache o verdadeiro entre as cópias' : 'Desvie da investida (corra de lado, pule ou vibre) e bata quando ele cansar';
    }
    else pInfo.textContent = '';
    vNivel.style.width = `${(P.vida ?? 1) * 100}%`;
  }

  return {
    atualizar, continuar,
    /** durante as cenas (jogo parado): só anima os vilões */
    posar(dt, quemFala) { desenhar(dt, quemFala); },
    /** onde a câmera da cena olha: o vilão (ou o meio dos dois) */
    foco(id) {
      if (!C) return null;
      const vs = id ? C.viloes.filter((v) => v.id === id) : C.viloes, n = vs.length; if (!n) return null;
      return { x: vs.reduce((a, v) => a + v.x, 0) / n, y: vs[0].y, z: vs.reduce((a, v) => a + v.z, 0) / n };
    },
    /** todos os vilões viram de frente para o herói (começo de uma cena) */
    encarar(P) { for (const v of C?.viloes || []) v.h = Math.atan2(P.x - v.x, P.z - v.z); },
    /** o capítulo já foi vencido */
    vencido(id) { return S.vencidos.has(id); },
    /** ids dos vilões do capítulo em andamento */
    get ids() { return C ? C.viloes.map((v) => v.id) : []; },
    /** quantas vezes o herói perdeu esta luta (cada uma deixa o vilão mais fácil, até 3) */
    get derrotas() { return C?.derrotas || 0; },
    get ativo() { return !!C; },
    get fase() { return C?.fase || null; },
    get emLuta() { return !!C && (C.fase === 'luta' || C.fase === 'derrota'); },
    /** durante a perseguição a energia não gasta e vai enchendo */
    /** o que está no chão agora (gelo, fogo, tornado) — para os testes */
    get perigos() { return perigos.map((p) => ({ tipo: p.tipo, x: p.x, z: p.z, t: p.t, vida: p.vida })); },
    /** o gelo do Capitão Frio deixa o herói lento (multiplica a velocidade máxima) */
    get lentidao() { return C && C.lento > 0 ? 0.42 : 1; },
    get energiaLivre() { return !!C && (C.fase === 'perseguicao' || C.fase === 'choque' || C.fase === 'aparece' || C.fase === 'encontro'); },
    get viloes() { return C?.viloes || []; },
    /** alvo do guia: o vilão a encontrar ou perseguir */
    alvo() {
      if (!C || !(C.fase === 'aparece' || C.fase === 'perseguicao' || C.fase === 'choque')) return null;
      const v = C.viloes[0]; return { x: v.x, z: v.z, cor: v.perf.cor, rotulo: C.viloes.length > 1 ? 'Zoom e Flash Reverso' : v.perf.titulo };
    },
    /** lista para a pausa: [{id, titulo, estado: 'bloqueado'|'liberado'|'vencido'}] */
    lista(missaoIdx) { return CAPITULOS.map((c, i) => ({ id: c.id, titulo: c.titulo, estado: S.vencidos.has(c.id) ? 'vencido' : liberado(i, missaoIdx) ? 'liberado' : 'bloqueado' })); },
    /** começa um capítulo agora (pausa ou ?capitulo=) */
    iniciar(id) { const i = CAPITULOS.findIndex((c) => c.id === id); if (i >= 0) { encerrar(); forcado = i; espera = 0; } },
    abandonar: encerrar,
    zerar() { encerrar(); S.vencidos.clear(); gravar(); },
  };
}
