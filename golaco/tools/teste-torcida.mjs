// Torcida no estádio e ânimo dela (contas puras do desenho, em Node):
//   A) torcida-dados.js: torcedores sentados nas cadeiras das arquibancadas (lado de lá e fundos), mais
//      gente na Alta que na Média e na Baixa, mandante maioria, setor visitante separado, organizada,
//      mosaico de camisas verdes, mesmo resultado sempre; atlas das 8 poses (em pé mais alto que
//      sentado, braços para cima, pesos de cor certos);
//   B) emocao.js: murmúrio sobe com a bola no terço final, explosão no gol (segura e cai), "uuuh" na
//      chance perdida (defesa, trave, fora perto da trave), palmas da outra torcida, apitos;
//   C) a regra da pose (a mesma do vertex shader): calma = sentada, ataque = em pé, gol = braços para
//      cima pulando, chance perdida = mãos na cabeça.
// Na versão publicada a arquibancada é vazia e não há som: este teste reprova (os módulos não existem).
//   node tools/teste-torcida.mjs [--js <pasta js>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href).catch(() => null);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

const TD = await imp('render/torcida-dados.js');
const EM = await imp('render/emocao.js');
if (!TD) reg('torcida no estádio (render/torcida-dados.js)', 'não existe (arquibancada vazia)', 'existe', false);
if (!EM) reg('ânimo da torcida e som (render/emocao.js)', 'não existe (sem som)', 'existe', false);

if (TD) {
  const { gerarTorcida, cadeiras, atlasTorcida, ARQUIBANCADA: A, TORCIDA: T, POSE, poseDoTorcedor, VERDE_MOSAICO } = TD;
  const nA = Math.round(A.comprimento / A.assento);
  // máscara de teste: um retângulo nas fileiras de baixo do lado de lá (o "GOLAÇO" real vem do canvas)
  const mascara = new Uint8Array(nA * A.fileiras);
  for (let f = 26; f < 34; f++) for (let a = 70; a < 180; a++) if (a % A.corredor >= 2) mascara[a + f * nA] = 1;
  const Q = {};
  for (const q of ['baixa', 'media', 'alta']) Q[q] = gerarTorcida(q, mascara);
  const nCad = cadeiras().length;
  reg('Torcedores por qualidade (Baixa < Média < Alta)', `baixa ${Q.baixa.n} · média ${Q.media.n} · alta ${Q.alta.n} (de ${nCad} cadeiras)`, 'alta ≥ 15 mil, média 9–14 mil, baixa ≤ 9 mil',
    Q.alta.n >= 15000 && Q.media.n >= 9000 && Q.media.n <= 14000 && Q.baixa.n <= 9000 && Q.baixa.n < Q.media.n && Q.media.n < Q.alta.n);
  const R = Q.alta;
  // em cima do degrau de cada arquibancada
  let foraDoDegrau = 0, foraLimites = 0;
  const sLado = (y) => (y - A.yBase) / (A.yTopoLado - A.yBase);
  for (let i = 0; i < R.n; i++) {
    const x = R.pos[4 * i], y = R.pos[4 * i + 1], z = R.pos[4 * i + 2], setor = Math.round(R.info[4 * i + 1] / 85);
    if (setor === 0) {
      const s = sLado(y);
      if (Math.abs(z - (-A.frenteZ - A.profLado * s)) > 0.01) foraDoDegrau++;
      if (Math.abs(x) > A.meioComprimento || s < 0 || s > 1) foraLimites++;
    } else {
      const sg = setor === 1 ? 1 : -1;
      const s = (y - A.yBase) / (A.yTopoFundo - A.yBase);
      if (Math.abs(sg * x - (A.fundoX0 + A.profFundo * s)) > 0.07) foraDoDegrau++;
      if (z < -(A.frenteZ + A.profLado) || z > A.frenteZ || s < 0 || s > 1) foraLimites++;
    }
  }
  reg('Todos sentados nos degraus das arquibancadas', `${foraDoDegrau} fora do degrau, ${foraLimites} fora dos limites`, '0 e 0', foraDoDegrau === 0 && foraLimites === 0);
  // setores e times
  let casa = 0, fora = 0, foraNoFundoMenos = 0, foraEspalhados = 0, foraNaOrganizada = 0, naSeparacao = 0, org = 0;
  const [vz0, vz1] = T.visitante.z;
  for (let i = 0; i < R.n; i++) {
    const time = R.info[4 * i] > 127 ? 1 : 0, setor = Math.round(R.info[4 * i + 1] / 85), z = R.pos[4 * i + 2];
    if (R.info[4 * i + 2] > 127) org++;
    if (time === 0) casa++; else fora++;
    if (time === 1 && setor === 2) foraNoFundoMenos++;
    if (time === 1 && setor === 0) foraEspalhados++;
    if (time === 1 && setor === 1) foraNaOrganizada++;
    if (setor === 2 && ((z > vz0 - T.visitante.vazio && z < vz0) || (z > vz1 && z < vz1 + T.visitante.vazio))) naSeparacao++;
  }
  reg('Mandante maioria (Golaço FC)', `${fmt(100 * casa / R.n, 1)}% da casa · ${fora} visitantes (${foraNoFundoMenos} no setor do fundo −x, ${foraEspalhados} espalhados)`, '≥ 85% da casa; visitantes quase todos no setor',
    casa / R.n >= 0.85 && foraNoFundoMenos >= 0.7 * fora && foraNaOrganizada === 0);
  reg('Setor visitante separado por cadeiras vazias', `${naSeparacao} torcedores na faixa de ${T.visitante.vazio} m`, '0', naSeparacao === 0);
  reg('Organizada da casa no fundo +x', `${org} torcedores`, '≥ 1500', org >= 1500);
  // mosaico
  let mosaicoVerde = 0, mosaicoTotal = 0;
  const verde = [parseInt(VERDE_MOSAICO.slice(1, 3), 16), parseInt(VERDE_MOSAICO.slice(3, 5), 16), parseInt(VERDE_MOSAICO.slice(5, 7), 16)];
  for (const c of cadeiras()) if (c.setor === 0 && mascara[c.a + c.f * nA]) mosaicoTotal++;
  for (let i = 0; i < R.n; i++) {
    if (Math.round(R.info[4 * i + 1] / 85) !== 0) continue;
    const a = Math.round((R.pos[4 * i] + A.meioComprimento) / A.assento - 0.5), f = Math.round((1 - (R.pos[4 * i + 1] - A.yBase) / (A.yTopoLado - A.yBase)) * A.fileiras - 0.5);
    if (mascara[a + f * nA] && R.camisa[4 * i] === verde[0] && R.camisa[4 * i + 1] === verde[1] && R.camisa[4 * i + 2] === verde[2]) mosaicoVerde++;
  }
  reg('Mosaico "GOLAÇO" vira camisas verdes (Alta)', `${mosaicoVerde} de ${mosaicoTotal} cadeiras do mosaico`, 'todas', mosaicoVerde === mosaicoTotal && mosaicoTotal > 0);
  // variedade de roupa, pele e cabelo
  const conta = arr => { const s = new Set(); for (let i = 0; i < R.n; i++) s.add(arr[4 * i] << 16 | arr[4 * i + 1] << 8 | arr[4 * i + 2]); return s.size; };
  reg('Variedade (cores de camisa, pele e cabelo)', `${conta(R.camisa)} camisas · ${conta(R.pele)} peles · ${conta(R.cabelo)} cabelos`, '≥ 10, ≥ 8, ≥ 8', conta(R.camisa) >= 10 && conta(R.pele) >= 8 && conta(R.cabelo) >= 8);
  // sem dois na mesma cadeira: na mesma fileira e setor, ≥ 0,35 m entre vizinhos
  let perto = 0;
  const porFila = new Map();
  for (let i = 0; i < R.n; i++) { const k = `${R.info[4 * i + 1]}:${R.pos[4 * i + 1].toFixed(3)}`; if (!porFila.has(k)) porFila.set(k, []); porFila.get(k).push(Math.round(R.info[4 * i + 1] / 85) === 0 ? R.pos[4 * i] : R.pos[4 * i + 2]); }
  for (const l of porFila.values()) { l.sort((a, b) => a - b); for (let k = 1; k < l.length; k++) if (l[k] - l[k - 1] < 0.35) perto++; }
  reg('Um torcedor por cadeira', `${perto} pares a < 0,35 m`, '0', perto === 0);
  const R2 = gerarTorcida('alta', mascara);
  const igual = R2.n === R.n && R2.pos.every((v, i) => v === R.pos[i]) && R2.camisa.every((v, i) => v === R.camisa[i]) && R2.info.every((v, i) => v === R.info[i]);
  reg('Mesma torcida em toda abertura (semente fixa)', igual ? 'igual' : 'diferente', 'igual', igual);
  // contraprova M4: as qualidades são PREFIXOS umas das outras em cada arquibancada (montar uma vez; trocar a
  // qualidade = quantos desenhar) e, no nível, da fileira da frente para a de cima (desenho da frente para trás)
  if (TD.gerarTorcidaNiveis) {
    const t0 = performance.now();
    const NV = TD.gerarTorcidaNiveis(mascara);
    const ms = performance.now() - t0;
    const chave = (d, i) => `${d.pos.subarray(4 * i, 4 * i + 4).join(',')}|${d.camisa.subarray(4 * i, 4 * i + 4).join(',')}|${d.info.subarray(4 * i, 4 * i + 4).join(',')}`;
    let prefixoOk = true, totais = [];
    for (const q of ['baixa', 'media', 'alta']) {
      const conj = new Set();
      for (let i = 0; i < Q[q].n; i++) conj.add(chave(Q[q], i));
      let k = 0;
      for (let setor = 0; setor < 3; setor++) {
        const f = NV.faixas[setor], m = TD.quantosNoSetor(NV, setor, q);
        for (let i = f.inicio; i < f.inicio + m; i++) if (!conj.has(chave(NV, i))) prefixoOk = false;
        k += m;
      }
      if (k !== Q[q].n) prefixoOk = false;
      totais.push(k);
    }
    let ordemOk = true;
    for (let setor = 0; setor < 3; setor++) {
      const f = NV.faixas[setor];
      let fim = f.inicio;
      for (let v = 0; v < 3; v++) {
        // dentro do nível: y (altura do degrau) nunca desce (frente → cima)
        for (let i = fim + 1; i < fim + f.porNivel[v]; i++) if (NV.pos[4 * i + 1] < NV.pos[4 * (i - 1) + 1] - 1e-4 || NV.nivel[i] !== v) ordemOk = false;
        fim += f.porNivel[v];
      }
    }
    reg('Qualidades são prefixos (montar uma vez, trocar = quantos desenhar)', `${totais.join(' · ')} torcedores; ${prefixoOk ? 'os mesmos de cada qualidade' : 'DIFERENTES'}; ordem frente → cima ${ordemOk ? 'sim' : 'não'}; montar tudo ${fmt(ms, 0)} ms`, 'prefixos iguais e em ordem', prefixoOk && ordemOk);
  } else reg('Qualidades são prefixos (montar uma vez, trocar = quantos desenhar)', 'não (cada qualidade remonta a torcida)', 'prefixos', false);

  // atlas
  const at = atlasTorcida(64, 128);
  const W = at.largura, H = at.altura;
  const topo = [], cobertura = [];
  let pesoMaior = 0;
  for (let p = 0; p < T.quadros; p++) {
    let t = 0, cob = 0;
    for (let r = 0; r < H; r++) for (let c = 0; c < 64; c++) {
      const k = (r * W + p * 64 + c) * 4;
      const a = at.dados[k + 3];
      if (a > 127) { t = Math.max(t, r); cob++; }
      pesoMaior = Math.max(pesoMaior, at.dados[k] + at.dados[k + 1] + at.dados[k + 2] - a);
    }
    topo.push((t + 1) / H * T.altura); cobertura.push(cob);
  }
  reg('Atlas: em pé mais alto que sentado', `sentado ${fmt(topo[POSE.SENTADO], 2)} m · em pé ${fmt(topo[POSE.EM_PE], 2)} m`, 'em pé ≥ sentado + 0,3', topo[POSE.EM_PE] >= topo[POSE.SENTADO] + 0.3);
  reg('Atlas: braços para cima no gol', `V ${fmt(topo[POSE.BRACOS_V], 2)} m · um braço ${fmt(topo[POSE.UM_BRACO], 2)} · cachecol ${fmt(topo[POSE.CACHECOL], 2)}`, '≥ 1,95 m', Math.min(topo[POSE.BRACOS_V], topo[POSE.UM_BRACO], topo[POSE.CACHECOL]) >= 1.95);
  reg('Atlas: as 8 poses desenhadas', cobertura.join(' · ') + ' px', 'todas ≥ 600 px', cobertura.every(c => c >= 600));
  reg('Atlas: pesos de cor ≤ cobertura (mipmap certo)', `excesso máx ${pesoMaior}`, '≤ 2 (arredondamento)', pesoMaior <= 2);
  // contraprova M3: o quadro de cada torcedor encolhe para a caixa da pose — nada da figura fica de fora dela
  if (TD.CAIXA_POSE) {
    let fora = 0, area = 0;
    for (let p = 0; p < T.quadros; p++) {
      const [w, h] = TD.CAIXA_POSE[p];
      area += w * h / T.quadros;
      for (let r = 0; r < H; r++) for (let c = 0; c < 64; c++) {
        const a = at.dados[(r * W + p * 64 + c) * 4 + 3];
        if (a > 8 && (Math.abs((c + 0.5) / 64 - 0.5) > w / 2 || (r + 0.5) / H > h)) fora++;
      }
    }
    reg('Quadro do torcedor na medida da pose (menos pixels descartados)', `${fora} px da figura fora da caixa; área média ${fmt(100 * area, 0)}% do quadro cheio (sentado ${fmt(100 * TD.CAIXA_POSE[0][0] * TD.CAIXA_POSE[0][1], 0)}%)`, '0 px fora; área < 75%', fora === 0 && area < 0.75);
  } else reg('Quadro do torcedor na medida da pose (menos pixels descartados)', 'quadro cheio (1,1 × 2,2 m) em toda pose', 'caixa por pose', false);

  // C) regra da pose
  const amostra = (niv, org = false, t = 0.37) => {
    const c = { sent: 0, pe: 0, v: 0, cab: 0, pulo: 0 };
    const rnd = TD.geradorTorcida(7);
    for (let i = 0; i < 2000; i++) {
      const r = poseDoTorcedor(niv, rnd(), rnd(), org, t + rnd() * 0.5);
      if (r.pose === POSE.SENTADO || r.pose === POSE.SENTADO_PALMAS) c.sent++; else c.pe++;
      if (r.pose === POSE.BRACOS_V || r.pose === POSE.UM_BRACO || r.pose === POSE.CACHECOL) c.v++;
      if (r.pose === POSE.MAOS_CABECA) c.cab++;
      if (r.pulo > 0.02) c.pulo++;
    }
    for (const k in c) c[k] /= 20;
    return c;
  };
  const calma = amostra({ excita: 0, tensao: 0.05, lamento: 0, palmas: 0 });
  const ataque = amostra({ excita: 0, tensao: 1, lamento: 0, palmas: 0 });
  const gol = amostra({ excita: 1, tensao: 1, lamento: 0, palmas: 0 });
  const perdeu = amostra({ excita: 0, tensao: 0.6, lamento: 1, palmas: 0 });
  const ultra = amostra({ excita: 0, tensao: 0, lamento: 0, palmas: 0 }, true);
  reg('Pose: jogo no meio-campo = torcida sentada', `${fmt(calma.sent, 0)}% sentados`, '≥ 85%', calma.sent >= 85);
  reg('Pose: time atacando perto do gol = levanta', `${fmt(ataque.pe, 0)}% em pé`, '≥ 85%', ataque.pe >= 85);
  reg('Pose: gol = braços para cima e pulando', `${fmt(gol.v, 0)}% braços para cima, ${fmt(gol.pulo, 0)}% no ar`, '≥ 85% e ≥ 35%', gol.v >= 85 && gol.pulo >= 35);
  reg('Pose: chance perdida = mãos na cabeça', `${fmt(perdeu.cab, 0)}%`, '≥ 70%', perdeu.cab >= 70);
  reg('Pose: organizada sempre em pé, pulando no ritmo', `${fmt(ultra.pe, 0)}% em pé, ${fmt(ultra.pulo, 0)}% no ar`, '100% e ≥ 30%', ultra.pe === 100 && ultra.pulo >= 30);
}

if (EM) {
  const { criarEmocao, emocaoEvento, emocaoPasso, consumirDisparos, EMOCAO } = EM;
  const ataca = { 0: 1, 1: -1 };
  const timeDe = id => (id >= 100 ? 1 : 0);
  /** Roda s segundos a 60 Hz com a bola parada em (x, z) e a posse do time k. */
  function roda(est, s, bola, k, t0, estado = 'jogo') {
    let t = t0;
    for (let i = 0; i < Math.round(s * 60); i++) { t += 1 / 60; emocaoPasso(est, { t, bola, posseTime: k, ataca, estado }, 1 / 60); }
    return t;
  }
  const ctx = (t, bola) => ({ t, timeDe, bola, ataca });
  // murmúrio
  {
    const e1 = criarEmocao(); roda(e1, 4, { x: -5, z: 0 }, 0, 0);
    const e2 = criarEmocao(); roda(e2, 4, { x: 32, z: 8 }, 0, 0);
    const e3 = criarEmocao(); roda(e3, 4, { x: 44, z: 2 }, 0, 0);
    const e4 = criarEmocao(); roda(e4, 4, { x: -44, z: 2 }, 1, 0);
    const e5 = criarEmocao(); roda(e5, 4, { x: 44, z: 2 }, 0, 0, 'intervalo');
    reg('Murmúrio sobe com a bola no terço final', `meio ${fmt(e1.agito, 2)} · terço final ${fmt(e2.agito, 2)} · área ${fmt(e3.agito, 2)} · área do visitante ${fmt(e4.agito, 2)} · intervalo ${fmt(e5.agito, 2)}`,
      'meio ≤ 0,3; terço > 0,55; área > 0,8 (dos dois lados); intervalo ≤ 0,15', e1.agito <= 0.3 && e2.agito > 0.55 && e3.agito > 0.8 && e4.agito > 0.8 && e5.agito <= 0.15);
    reg('Torcida do time que ataca levanta (a outra não)', `casa ${fmt(e3.torcida[0].tensao, 2)} · visitante ${fmt(e3.torcida[1].tensao, 2)}`, 'casa > 0,8; visitante < 0,1', e3.torcida[0].tensao > 0.8 && e3.torcida[1].tensao < 0.1);
  }
  // gol da casa
  {
    const e = criarEmocao();
    let t = roda(e, 1, { x: 50, z: 0 }, 0, 0);
    emocaoEvento(e, { tipo: 'gol', time: 0, autor: 9 }, ctx(t, { x: 53, z: 0 }));
    const d = consumirDisparos(e).map(x => `${x.tipo}:${x.grupo}`);
    const t2 = roda(e, 2.4, { x: 53, z: 0 }, null, t);
    const seg = e.torcida[0].excita, agito = e.agito;
    roda(e, 6, { x: 0, z: 0 }, 1, t2);
    reg('Gol da casa: explosão (segura 2,5 s e cai)', `disparos [${d}], excita ${fmt(seg, 2)} aos 2,4 s → ${fmt(e.torcida[0].excita, 2)} aos 8,4 s; barulho ${fmt(agito, 2)}`, 'gol:0; ≥ 0,95 → < 0,3; barulho ≥ 0,95',
      d.includes('gol:0') && seg >= 0.95 && e.torcida[0].excita < 0.3 && agito >= 0.95);
  }
  // gol do visitante: a casa lamenta, o setor visitante explode
  {
    const e = criarEmocao();
    emocaoEvento(e, { tipo: 'gol', time: 1, autor: 109 }, ctx(1, { x: -53, z: 0 }));
    reg('Gol do visitante: o setor deles explode, a casa lamenta', `excita visitante ${fmt(e.torcida[1].excita, 2)}, lamento casa ${fmt(e.torcida[0].lamento, 2)}, disparo ${consumirDisparos(e).map(x => `${x.tipo}:${x.grupo}`)}`,
      '1, 1, gol:1', e.torcida[1].excita === 1 && e.torcida[0].lamento === 1);
  }
  // contraprova I4: no gol do visitante o estádio da casa (87,6% da torcida) CALA — o barulho geral cai; no gol da
  // casa vai ao máximo. Os dois depois de 10 s de bola no meio-campo, medido 1,5 s depois do gol.
  {
    const nivel = time => {
      const e = criarEmocao();
      const t = roda(e, 10, { x: 0, z: 0 }, 0, 0);
      emocaoEvento(e, { tipo: 'gol', time, autor: time ? 109 : 9 }, ctx(t, { x: time ? -53 : 53, z: 0 }));
      roda(e, 1.5, { x: time ? -53 : 53, z: 0 }, null, t, 'gol');
      return e.agito;
    };
    const casa = nivel(0), fora = nivel(1);
    reg('Gol do visitante: a casa cala (barulho 1,5 s depois do gol)', `gol da casa ${fmt(casa, 2)} · gol do visitante ${fmt(fora, 2)}`, 'casa ≥ 0,9; visitante ≤ 0,15', casa >= 0.9 && fora <= 0.15);
  }
  // chance perdida: chute de 16 m e defesa
  {
    const e = criarEmocao();
    emocaoEvento(e, { tipo: 'chute', id: 9, v: 26 }, ctx(1, { x: 36.5, z: 2 }));
    emocaoEvento(e, { tipo: 'defesa', id: 101, modo: 'espalmada' }, ctx(1.4, { x: 51, z: 1 }));
    const d = consumirDisparos(e).map(x => `${x.tipo}:${x.grupo}`);
    reg('Chute de 16 m defendido: "uuuh" da casa e palmas do visitante', `[${d}], lamento ${fmt(e.torcida[0].lamento, 2)}`, 'chute, uuuh:0, palmas:1; lamento ≥ 0,7',
      d.includes('chute:0') && d.includes('uuuh:0') && d.includes('palmas:1') && e.torcida[0].lamento >= 0.7);
    const e2 = criarEmocao();
    emocaoEvento(e2, { tipo: 'chute', id: 9, v: 22 }, ctx(1, { x: 10, z: 2 }));
    emocaoEvento(e2, { tipo: 'defesa', id: 101, modo: 'encaixe' }, ctx(2.4, { x: 51, z: 1 }));
    const d2 = consumirDisparos(e2).map(x => x.tipo);
    reg('Chute de 42 m defendido não é chance ("uuuh")', `[${d2}]`, 'sem uuuh', !d2.includes('uuuh'));
    const e3 = criarEmocao();
    emocaoEvento(e3, { tipo: 'chute', id: 9, v: 28 }, ctx(1, { x: 34, z: -3 }));
    emocaoEvento(e3, { tipo: 'trave', forca: 20 }, ctx(1.6, { x: 52.4, z: -3.7 }));
    const d3 = consumirDisparos(e3);
    const u3 = d3.find(x => x.tipo === 'uuuh');
    reg('Bola na trave: "uuuh" forte', u3 ? `uuuh força ${fmt(u3.forca, 2)} (grupo ${u3.grupo})` : 'nenhum', 'força ≥ 0,9, grupo 0', !!u3 && u3.forca >= 0.9 && u3.grupo === 0);
    const e4 = criarEmocao();
    emocaoEvento(e4, { tipo: 'chute', id: 105, v: 24 }, ctx(1, { x: -36, z: 4 }));
    emocaoEvento(e4, { tipo: 'tiroDeMeta', time: 0, id: 1 }, ctx(2.2, { x: -52.8, z: 4.6 }));
    const u4 = consumirDisparos(e4).find(x => x.tipo === 'uuuh');
    reg('Chute para fora rente à trave: "uuuh" do visitante', u4 ? `uuuh ${fmt(u4.forca, 2)} grupo ${u4.grupo}` : 'nenhum', 'grupo 1, força ≥ 0,8', !!u4 && u4.grupo === 1 && u4.forca >= 0.8);
  }
  // apitos
  {
    const e = criarEmocao();
    emocaoEvento(e, { tipo: 'saida', time: 0 }, ctx(0.1, { x: 0, z: 0 }));
    emocaoEvento(e, { tipo: 'intervalo' }, ctx(240, { x: 0, z: 0 }));
    emocaoEvento(e, { tipo: 'fimDeJogo', placar: { 0: 2, 1: 1 } }, ctx(480, { x: 0, z: 0 }));
    const d = consumirDisparos(e).map(x => x.tipo);
    reg('Apitos: saída, intervalo e fim (vitória da casa: festa)', `[${d}], excita casa ${fmt(e.torcida[0].excita, 2)}`, 'apito, apitoIntervalo, apitoFim, palmas', ['apito', 'apitoIntervalo', 'apitoFim', 'palmas'].every(x => d.includes(x)) && e.torcida[0].excita > 0.5);
  }
  // fila limitada
  {
    const e = criarEmocao();
    for (let i = 0; i < 50; i++) emocaoEvento(e, { tipo: 'redeImpacto', vel: 20 }, ctx(i, { x: 54, z: 0 }));
    reg('Fila de sons limitada (nada acumula com o som desligado)', `${e.disparos.length} na fila`, `≤ ${EMOCAO.maxDisparos}`, e.disparos.length <= EMOCAO.maxDisparos);
  }
}

// D) autor do gol (contraprova M5): o último toque DE VERDADE pelos eventos (condução e domínio contam); desvio
// e defesa do adversário depois do chute de quem marcou contam para quem chutou
{
  const AG = await imp('render/autor-gol.js');
  if (!AG) reg('Autor do gol pelo último toque de verdade (render/autor-gol.js)', 'não existe (ev.autor = m.ultimoToque: condução não conta)', 'existe', false);
  else {
    const timeDe = id => (id == null ? null : id >= 100 ? 1 : 0);
    const caso = passos => {
      const est = AG.criarAutorGol();
      let tick = 0;
      for (const evs of passos) AG.autorEventos(est, evs, ++tick, timeDe);
      return est.gol.ativo ? { id: est.gol.id, contra: est.gol.contra, desvio: est.gol.desvio } : null;
    };
    const CASOS = [
      // o caso da contraprova: passe do 7 do Golaço, condução do 106 do Ventania, a bola entra no gol do Ventania
      { nome: 'condução do adversário depois do passe → gol contra dele', passos: [[{ tipo: 'passe', id: 7 }], [{ tipo: 'toque', id: 106 }], [{ tipo: 'toque', id: 106 }], [{ tipo: 'gol', time: 0, autor: 7 }]], id: 106, contra: true },
      { nome: 'chute e o goleiro espalma para dentro → gol de quem chutou', passos: [[{ tipo: 'toque', id: 9 }, { tipo: 'chute', id: 9 }], [{ tipo: 'defesa', id: 101, modo: 'espalmada' }], [{ tipo: 'gol', time: 0, autor: 101 }]], id: 9, contra: false },
      { nome: 'chute desviado no corpo do zagueiro → gol de quem chutou', passos: [[{ tipo: 'chute', id: 10 }], [{ tipo: 'bateuCorpo', id: 104 }], [{ tipo: 'gol', time: 0, autor: 10 }]], id: 10, contra: false },
      { nome: 'chute, o zagueiro domina e conduz para o próprio gol → gol contra', passos: [[{ tipo: 'chute', id: 10 }], [{ tipo: 'toque', id: 104, modo: 'dominio' }], [{ tipo: 'toque', id: 104 }], [{ tipo: 'gol', time: 0, autor: 10 }]], id: 104, contra: true },
      { nome: 'dividida perdida não toca na bola', passos: [[{ tipo: 'toque', id: 9 }], [{ tipo: 'dividida', id: 103, ganhou: false }], [{ tipo: 'chute', id: 9 }], [{ tipo: 'gol', time: 0, autor: 9 }]], id: 9, contra: false },
      { nome: 'cabeceio do visitante → gol dele', passos: [[{ tipo: 'passe', id: 108 }], [{ tipo: 'cabeceio', id: 109 }], [{ tipo: 'gol', time: 1, autor: 109 }]], id: 109, contra: false },
    ];
    const erros = [];
    for (const c of CASOS) { const r = caso(c.passos); if (!r || r.id !== c.id || r.contra !== c.contra) erros.push(`${c.nome}: ${JSON.stringify(r)}`); }
    reg('Autor do gol pelo último toque de verdade (6 lances)', erros.length ? erros.join(' | ') : `os ${CASOS.length} certos (condução conta; desvio/defesa → quem chutou)`, '6 certos', erros.length === 0);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-torcida: REPROVOU (${falhas})` : '\nteste-torcida: PASSOU');
process.exit(falhas ? 1 : 0);
