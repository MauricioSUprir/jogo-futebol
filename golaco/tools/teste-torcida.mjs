// Torcida no estádio e ânimo dela (contas puras do desenho, em Node):
//   A) torcida-dados.js: torcedores sentados nas cadeiras das arquibancadas (lado de lá, fundos e lado de cá), mais
//      gente na Alta que na Média e na Baixa, mandante maioria, setor visitante separado, organizada,
//      mosaico de camisas verdes, mesmo resultado sempre; as fileiras da FRENTE cheias (as que a câmera de jogo
//      mostra) e o LADO DE CÁ com gente e sem ninguém em cima do túnel, fora da câmera de TV (pedido de 11/10);
//      atlas das 8 poses (em pé mais alto que sentado, braços para cima, pesos de cor certos);
//   B) emocao.js: murmúrio sobe com a bola no terço final, explosão no gol (segura e cai), "uuuh" na
//      chance perdida (defesa, trave, fora perto da trave), palmas da outra torcida, apitos;
//   C) a regra da pose (a mesma do vertex shader): calma = sentada, ataque = em pé, gol = braços para
//      cima pulando, chance perdida = mãos na cabeça;
//   G) o torcedor 3D (item 69, PR 2): o modelo com as 8 poses, sentado na cadeira e virado para o campo, a escala, as
//      poses, o cachecol, a pose do quadro (o mesmo ESTADO_GLSL; a ola e o bandeirão) e a escolha das fileiras.
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
  reg('Torcedores por qualidade (Baixa < Média < Alta)', `baixa ${Q.baixa.n} · média ${Q.media.n} · alta ${Q.alta.n} (de ${nCad} cadeiras, com o lado de cá)`, 'alta ≥ 22 mil, média 16–22 mil, baixa ≤ 15 mil',
    Q.alta.n >= 22000 && Q.media.n >= 16000 && Q.media.n <= 22000 && Q.baixa.n <= 15000 && Q.baixa.n < Q.media.n && Q.media.n < Q.alta.n);
  const R = Q.alta;
  // em cima do degrau de cada arquibancada: desde o item 69 (o degrau em geometria) cada torcedor senta no ASSENTO de uma
  // cadeira da grade (render/cadeiras-dados.js gradeGolaco: o piso do degrau e o centro do assento; ± 6 cm de sorteio na x)
  const CD = await imp('render/cadeiras-dados.js');
  const GR = CD ? CD.gradeGolaco() : null;
  let foraDoDegrau = 0, foraLimites = 0;
  const cadeiraDe = i => {
    if (!GR) return null;
    const x = R.pos[4 * i], z = R.pos[4 * i + 2], setor = Math.round(R.info[4 * i + 1] / 85);
    // o sorteio de ±6 cm na x: a cadeira mais perto das 3 vizinhas
    let melhor = null, dm = Infinity;
    for (const dx of [0, -0.25, 0.25]) { const c = GR.assentoEm(x + dx, z, setor); if (c) { const d = Math.hypot(c.x - x, c.z - z); if (d < dm) { dm = d; melhor = c; } } }
    return melhor;
  };
  for (let i = 0; i < R.n; i++) {
    const x = R.pos[4 * i], y = R.pos[4 * i + 1], z = R.pos[4 * i + 2], setor = Math.round(R.info[4 * i + 1] / 85);
    const c = cadeiraDe(i);
    if (!c || Math.abs(c.y - y) > 0.01 || Math.hypot(c.x - x, c.z - z) > 0.07) foraDoDegrau++;
    if (setor === 0 || setor === 3) { if (Math.abs(x) > A.meioComprimento || Math.abs(z) < A.frenteZ || Math.abs(z) > A.frenteZ + A.profLado) foraLimites++; }
    else if (z < -(A.frenteZ + A.profLado) || z > A.frenteZ || Math.abs(x) < A.fundoX0 || Math.abs(x) > A.fundoX0 + A.profFundo) foraLimites++;
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
    const c = cadeiraDe(i);
    if (!c) continue;
    const a = c.a, f = c.f;
    if (mascara[a + f * nA] && R.camisa[4 * i] === verde[0] && R.camisa[4 * i + 1] === verde[1] && R.camisa[4 * i + 2] === verde[2]) mosaicoVerde++;
  }
  reg('Mosaico "GOLAÇO" vira camisas verdes (Alta)', `${mosaicoVerde} de ${mosaicoTotal} cadeiras do mosaico`, 'todas', mosaicoVerde === mosaicoTotal && mosaicoTotal > 0);
  // variedade de roupa, pele e cabelo
  const conta = arr => { const s = new Set(); for (let i = 0; i < R.n; i++) s.add(arr[4 * i] << 16 | arr[4 * i + 1] << 8 | arr[4 * i + 2]); return s.size; };
  reg('Variedade (cores de camisa, pele e cabelo)', `${conta(R.camisa)} camisas · ${conta(R.pele)} peles · ${conta(R.cabelo)} cabelos`, '≥ 10, ≥ 8, ≥ 8', conta(R.camisa) >= 10 && conta(R.pele) >= 8 && conta(R.cabelo) >= 8);
  // sem dois na mesma cadeira: na mesma fileira e setor, ≥ 0,35 m entre vizinhos
  let perto = 0;
  const porFila = new Map();
  for (let i = 0; i < R.n; i++) { const k = `${R.info[4 * i + 1]}:${R.pos[4 * i + 1].toFixed(3)}`; if (!porFila.has(k)) porFila.set(k, []); const st = Math.round(R.info[4 * i + 1] / 85); porFila.get(k).push(st === 0 || st === 3 ? R.pos[4 * i] : R.pos[4 * i + 2]); }
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
      for (let setor = 0; setor < NV.faixas.length; setor++) {
        const f = NV.faixas[setor], m = TD.quantosNoSetor(NV, setor, q);
        for (let i = f.inicio; i < f.inicio + m; i++) if (!conj.has(chave(NV, i))) prefixoOk = false;
        k += m;
      }
      if (k !== Q[q].n) prefixoOk = false;
      totais.push(k);
    }
    let ordemOk = true;
    for (let setor = 0; setor < NV.faixas.length; setor++) {
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

  // pedido de 11/10: as fileiras da FRENTE cheias (a câmera de jogo só mostra as fileiras 0–5 do lado de lá, no máximo
  // até a 9: na Média só 62% delas tinham gente — os buracos apareciam)
  {
    const nFrente = cadeiras().filter(c => c.setor === 0 && A.fileiras - 1 - c.f < 9).length;
    const oc = {};
    for (const q of ['baixa', 'media', 'alta']) {
      let t = 0;
      for (let i = 0; i < Q[q].n; i++) {
        if (Math.round(Q[q].info[4 * i + 1] / 85) !== 0) continue;
        // a fileira pelo piso do degrau (item 69: o torcedor senta no piso da fileira dele)
        const f = A.fileiras - 1 - Math.round((Q[q].pos[4 * i + 1] - A.yBase) / ((A.yTopoLado - A.yBase) / A.fileiras));
        if (A.fileiras - 1 - f < 9) t++;
      }
      oc[q] = t / nFrente;
    }
    reg('Fileiras 0–8 do lado de lá cheias (as que a câmera de jogo mostra)', `baixa ${fmt(100 * oc.baixa, 0)}% · média ${fmt(100 * oc.media, 0)}% · alta ${fmt(100 * oc.alta, 0)}% das ${nFrente} cadeiras`,
      'baixa ≥ 80%, média ≥ 95%, alta ≥ 97%', oc.baixa >= 0.8 && oc.media >= 0.95 && oc.alta >= 0.97);
  }
  // o lado de cá (z +): gente na arquibancada nova, ninguém em cima da boca do túnel
  {
    const ca = q => { let n = 0; for (let i = 0; i < Q[q].n; i++) if (Math.round(Q[q].info[4 * i + 1] / 85) === 3) n++; return n; };
    let noTunel = 0;
    const T = TD.TORCIDA.tunel;
    for (let i = 0; i < R.n; i++) if (Math.round(R.info[4 * i + 1] / 85) === 3 && Math.abs(R.pos[4 * i]) < T.meiaLargura - 0.1 && R.pos[4 * i + 1] < T.topo) noTunel++;
    const cMedia = TD.gerarTorcida ? ca('media') : 0;
    reg('Lado de cá (z +): arquibancada com torcida, o túnel livre', `baixa ${ca('baixa')} · média ${cMedia} · alta ${ca('alta')} torcedores; ${noTunel} em cima da boca do túnel`,
      'média ≥ 4.000; 0 no túnel', cMedia >= 4000 && noTunel === 0);
  }
  // a câmera de TV fica DENTRO da arquibancada do lado de cá: com ela lá, nada do lado de cá vai para a GPU
  if (TD.cameraNoLadoDeCa) {
    const CAM = { pc: { d: 40, y: 18.3 }, cel: { d: 46, y: 12.3 } };
    let erradas = 0, dentro = 0, total = 0;
    for (const k of Object.keys(CAM)) {
      for (let fz = -22; fz <= 23; fz += 0.5) {
        const p = { x: 0, y: CAM[k].y, z: fz + CAM[k].d };
        total++;
        if (p.z > A.frenteZ - 1) { if (TD.cameraNoLadoDeCa(p)) dentro++; else erradas++; }
      }
    }
    const geral = TD.cameraNoLadoDeCa({ x: 0, y: 34, z: 78 }), reversa = TD.cameraNoLadoDeCa({ x: 0, y: 9, z: -30 });
    reg('Câmera de TV atrás da frente do lado de cá: o lado de cá sai do desenho', `${dentro} posições da TV (PC e celular) dentro do volume, ${erradas} fora; plano geral ${geral ? 'dentro' : 'fora'}, câmera do outro lado ${reversa ? 'dentro' : 'fora'}`,
      '0 fora; plano geral e câmera do outro lado fora (desenham)', erradas === 0 && dentro > 0 && !geral && !reversa);
  } else reg('Câmera de TV atrás da frente do lado de cá: o lado de cá sai do desenho', 'não existe (sem arquibancada do lado de cá)', 'existe', false);

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
  // janela de tempo das amostras: 0,5 s; a organizada pula em uníssono no surdo (1,28 Hz) — amostrada em 4 s (vários pulos)
  const amostra = (niv, org = false, t = 0.37, janela = org ? 4 : 0.5) => {
    const c = { sent: 0, pe: 0, v: 0, cab: 0, pulo: 0 };
    const rnd = TD.geradorTorcida(7);
    for (let i = 0; i < 2000; i++) {
      const r = poseDoTorcedor(niv, rnd(), rnd(), org, t + rnd() * janela);
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

// E) festa e mixagem do som (pedido de 11/10: "bota som de torcida também, pra durante o jogo"): a agenda dos cantos
//    (festa.js), a vaia, a reação que interrompe o canto e os níveis da mixagem (mixagem.js) — contas puras.
{
  const FE = await imp('render/festa.js');
  const MX = await imp('render/mixagem.js');
  const SM = await imp('render/som.js').catch(() => null);
  if (!FE || !MX || !EM) reg('Agenda dos cantos e mixagem do som (render/festa.js, render/mixagem.js)', 'não existe (um canto de 14 s ~20 dB abaixo do arquivo)', 'existe', false);
  else {
    const ataca = { 0: 1, 1: -1 };
    const timeDe = id => (id >= 100 ? 1 : 0);
    const ctx = (t, bola) => ({ t, timeDe, bola, ataca });
    // 3 min de jogo calmo (bola no meio-campo, a posse trocando a cada 9 s): quantos cantos e quanto tempo cantando
    const e = EM.criarEmocao();
    EM.emocaoEvento(e, { tipo: 'saida', time: 0 }, ctx(0, { x: 0, z: 0 }));
    const out = {};
    let t = 0, calmo = 0, canta = 0;
    for (let i = 0; i < 180 * 60; i++) {
      t += 1 / 60;
      EM.emocaoPasso(e, { t, bola: { x: 8 * Math.sin(t / 5), z: 0 }, posseTime: Math.floor(t / 9) % 2, ataca, estado: 'jogo' }, 1 / 60);
      MX.alvosMixagem(e, out);
      if (e.agito <= 0.3) { calmo++; if (out.canto >= 0.5 * out.ambiente) canta++; }
    }
    const clipes = new Set(e.festa.canto.cantados);
    reg('Cantos: a torcida canta a maior parte do tempo calmo (3 min de jogo)', `${clipes.size} cantos diferentes (${e.festa.canto.cantados.length} entradas), cantando em ${fmt(100 * canta / Math.max(1, calmo), 0)}% do tempo calmo`,
      '≥ 3 cantos; ≥ 55% (e ≤ 85%: tem pausa)', clipes.size >= 3 && canta / calmo >= 0.55 && canta / calmo <= 0.85);
    reg('Mixagem: leito audível com a bola no meio-campo', `murmúrio ${fmt(out.ambiente, 2)} · canto cheio ${fmt(MX.MIXAGEM.canto, 2)} · batucada ${fmt(MX.MIXAGEM.batucada, 2)} (unidades de −16 LUFS)`,
      'murmúrio ≥ 0,5; canto ≥ 0,55', out.ambiente >= 0.5 && MX.MIXAGEM.canto >= 0.55);
    // cada gravação nivelada para −16 LUFS pelo LUFS medido
    if (SM) {
      const erros = Object.entries(SM.SOM.arquivos).filter(([, a]) => a.lufs != null && Math.abs(a.lufs + 20 * Math.log10(MX.nivelamento(a.lufs)) - MX.MIXAGEM.alvoLufs) > 0.01);
      const papeis = FE.FESTA.cantos.papeis.length === SM.SOM.cantos.length && SM.SOM.cantos.every(n => SM.SOM.arquivos[n]?.canto);
      reg('Gravações niveladas para −16 LUFS e um arquivo por canto da agenda', `${Object.values(SM.SOM.arquivos).filter(a => a.lufs != null).length} niveladas, ${erros.length} fora; ${SM.SOM.cantos.length} cantos para ${FE.FESTA.cantos.papeis.length} papéis`, '0 fora; iguais', erros.length === 0 && papeis);
    }
    // reação: o "uuuh" abaixa o leito ~4 dB e o canto recua; os dois voltam
    {
      const e2 = EM.criarEmocao();
      let t2 = 0;
      // até a torcida estar cantando no nível cheio
      for (let i = 0; i < 90 * 60 && !(FE.nivelCanto(e2.festa) > 0.95 && e2.festa.canto.ate - t2 > 8); i++) { t2 += 1 / 60; EM.emocaoPasso(e2, { t: t2, bola: { x: 0, z: 0 }, posseTime: 0, ataca, estado: 'jogo' }, 1 / 60); }
      const antes = FE.nivelCanto(e2.festa);
      EM.emocaoEvento(e2, { tipo: 'chute', id: 9 }, ctx(t2, { x: 36, z: 2 }));
      EM.emocaoEvento(e2, { tipo: 'defesa', id: 101 }, ctx(t2 + 0.5, { x: 51, z: 1 }));
      t2 += 0.5;
      const ab = MX.abaixamento(e2, t2 + 0.1);
      EM.emocaoPasso(e2, { t: t2 + 0.1, bola: { x: 0, z: 0 }, posseTime: 0, ataca, estado: 'jogo' }, 0.1);
      const logo = FE.nivelCanto(e2.festa);
      let t3 = t2 + 0.1;
      for (let i = 0; i < 6 * 60; i++) { t3 += 1 / 60; EM.emocaoPasso(e2, { t: t3, bola: { x: 0, z: 0 }, posseTime: 0, ataca, estado: 'jogo' }, 1 / 60); }
      const volta = MX.abaixamento(e2, t3);
      const cantoVolta = FE.nivelCanto(e2.festa);
      reg('Reação ("uuuh") abaixa o leito ~4 dB e o canto recua; depois voltam', `canto ${fmt(antes, 2)} → ${fmt(logo, 2)} → ${fmt(cantoVolta, 2)}; leito ×${fmt(ab, 2)} (${fmt(20 * Math.log10(ab), 1)} dB) → ×${fmt(volta, 2)}`,
        'canto recua para ≤ 0,5 do nível; leito −3 a −5 dB e volta a ×1', antes > 0.5 && logo <= 0.5 * antes + 0.01 && ab <= 0.71 && ab >= 0.56 && volta > 0.99);
    }
    // gol: corta o canto; gol da casa → canto de festa; gol do visitante → o setor deles canta (lado 1)
    {
      const golE = time => {
        const e3 = EM.criarEmocao();
        let t3 = 0;
        for (let i = 0; i < 20 * 60; i++) { t3 += 1 / 60; EM.emocaoPasso(e3, { t: t3, bola: { x: 0, z: 0 }, posseTime: 0, ataca, estado: 'jogo' }, 1 / 60); }
        EM.emocaoEvento(e3, { tipo: 'gol', time }, ctx(t3, { x: time ? -53 : 53, z: 0 }));
        for (let i = 0; i < 30; i++) { t3 += 1 / 60; EM.emocaoPasso(e3, { t: t3, bola: { x: 0, z: 0 }, posseTime: null, ataca, estado: 'gol' }, 1 / 60); }
        const cortado = FE.nivelCanto(e3.festa);
        for (let i = 0; i < 6 * 60; i++) { t3 += 1 / 60; EM.emocaoPasso(e3, { t: t3, bola: { x: 0, z: 0 }, posseTime: null, ataca, estado: 'parada' }, 1 / 60); }
        const c = e3.festa.canto;
        return { cortado, papel: c.papel, lado: c.lado, nivel: FE.nivelCanto(e3.festa), acesos: e3.festa.acesos, band: e3.festa.bandeirao.n };
      };
      const gc = golE(0), gv = golE(1);
      reg('Gol: o grito corta o canto; depois a casa canta a festa (ou o setor visitante canta o deles)', `casa: cortado ${fmt(gc.cortado, 2)}, depois "${gc.papel}" lado ${gc.lado} · visitante: cortado ${fmt(gv.cortado, 2)}, depois "${gv.papel}" lado ${gv.lado}`,
        'cortado 0; festa/0 e visitante/1', gc.cortado === 0 && gc.papel === 'festa' && gc.lado === 0 && gv.cortado === 0 && gv.papel === 'visitante' && gv.lado === 1);
      // dois gols em seguida (contraprova de 12/10): gol da casa e, 20 s depois, gol do visitante — 10 s depois do 2º gol
      // canta quem marcou por último (antes a casa voltava a cantar a festa por cima do gol deles); e o contrário
      const doisGols = (a, b) => {
        const e6 = EM.criarEmocao();
        let t6 = 0;
        const anda = (s, estado = 'jogo') => { for (let i = 0; i < Math.round(s * 60); i++) { t6 += 1 / 60; EM.emocaoPasso(e6, { t: t6, bola: { x: 0, z: 0 }, posseTime: null, ataca, estado }, 1 / 60); } };
        anda(20);
        EM.emocaoEvento(e6, { tipo: 'gol', time: a }, ctx(t6, { x: a ? -53 : 53, z: 0 }));
        anda(20);
        EM.emocaoEvento(e6, { tipo: 'gol', time: b }, ctx(t6, { x: b ? -53 : 53, z: 0 }));
        anda(10);
        const c = e6.festa.canto;
        return `${c.fase === 'cantando' ? c.papel : c.fase}/${c.lado}`;
      };
      const cv = doisGols(0, 1), vc = doisGols(1, 0);
      reg('Dois gols em 20 s: depois do 2º canta quem marcou por último', `casa e depois visitante → ${cv} · visitante e depois casa → ${vc}`, 'visitante/1 · festa/0', cv === 'visitante/1' && vc === 'festa/0');
    }
    // vaia (contraprova de 12/10: a regra antiga — só perto da área por 15 s — dava 0 vaias em partidas inteiras): o
    // visitante com a bola conta 1 s por s no campo todo e FESTA.vaia.perto s por s rondando a área da casa; vaia ao
    // chegar a FESTA.vaia.segura e não repete antes de FESTA.vaia.pausa s; com a casa na bola, nada
    {
      const V = FE.FESTA.vaia;
      const vaiasCom = (bola, posseTime, s = 50) => {
        const e4 = EM.criarEmocao();
        let t4 = 0;
        const out = [];
        for (let i = 0; i < s * 60; i++) {
          t4 += 1 / 60;
          EM.emocaoPasso(e4, { t: t4, bola, posseTime, ataca, estado: 'jogo' }, 1 / 60);
          for (const d of EM.consumirDisparos(e4)) if (d.tipo === 'vaia') out.push(+t4.toFixed(1));
        }
        return out;
      };
      const perto = vaiasCom({ x: -38, z: 6 }, 1), meio = vaiasCom({ x: 10, z: 6 }, 1), casa = vaiasCom({ x: -38, z: 6 }, 0, 120);
      const tPerto = V.segura / (V.perto ?? 1), tMeio = V.segura;
      reg('Vaia: o visitante fica com a bola (mais depressa rondando a área da casa)', `perto da área: vaias aos [${perto.join(', ')}] s · no meio: [${meio.join(', ')}] s (50 s) · a casa com a bola: ${casa.length} em 2 min`,
        `1 aos ${fmt(tPerto, 1)} s · 1 aos ${fmt(tMeio, 0)} s · 0`, perto.length === 1 && Math.abs(perto[0] - tPerto) <= 0.6 && meio.length === 1 && Math.abs(meio[0] - tMeio) <= 0.6 && casa.length === 0 && tMeio > tPerto);
    }
  }
}

// F) festa visual (pedido de 11/10: "bandeirões, sinalizadores"): a agenda dos SINALIZADORES (só nos eventos), a
//    FUMAÇA nunca no campo, as BANDEIRAS fora do campo, o BANDEIRÃO na saída e no gol da casa e a OLA com a torcida calma.
{
  const FE = await imp('render/festa.js');
  const FU = await imp('render/fumaca.js');
  const BD = await imp('render/bandeiras-dados.js');
  if (!FE || !FU || !BD || !EM) reg('Festa: sinalizadores, fumaça, bandeiras, bandeirão e ola (festa.js, fumaca.js, bandeiras-dados.js)', 'não existe (nenhum elemento de festa)', 'existe', false);
  else {
    const ataca = { 0: 1, 1: -1 };
    const timeDe = id => (id >= 100 ? 1 : 0);
    const ctx = (t, bola) => ({ t, timeDe, bola, ataca });
    const roda = (e, t0, s, estado = 'jogo', bola = { x: 0, z: 0 }) => { let t = t0; for (let i = 0; i < Math.round(s * 60); i++) { t += 1 / 60; EM.emocaoPasso(e, { t, bola, posseTime: 0, ataca, estado }, 1 / 60); } return t; };
    const acesos = e => e.festa.flares.filter(s => s.ativo).length;
    // sinalizadores: 3 min sem evento → nenhum; saída do 1º tempo → acendem; a saída depois do gol não acende de novo
    const e = EM.criarEmocao();
    let t = roda(e, 0, 180);
    const semEvento = e.festa.acesos;
    EM.emocaoEvento(e, { tipo: 'saida', time: 0 }, ctx(t, { x: 0, z: 0 }));
    const naSaida = e.festa.acesos - semEvento;
    t = roda(e, t, 40);
    EM.emocaoEvento(e, { tipo: 'gol', time: 0 }, ctx(t, { x: 53, z: 0 }));
    const noGol = e.festa.acesos - semEvento - naSaida;
    t = roda(e, t, 4, 'gol');
    const antes = e.festa.acesos;
    EM.emocaoEvento(e, { tipo: 'saida', time: 1 }, ctx(t, { x: 0, z: 0 }));
    const saidaDepoisDoGol = e.festa.acesos - antes;
    const e2 = EM.criarEmocao();
    EM.emocaoEvento(e2, { tipo: 'gol', time: 1 }, ctx(30, { x: -53, z: 0 }));
    const vis = e2.festa.flares.filter(s => s.ativo);
    reg('Sinalizadores só em momento marcado (saída do tempo, gol, vitória)', `3 min sem evento ${semEvento} · saída do 1º tempo ${naSaida} · gol da casa ${noGol} · saída depois do gol ${saidaDepoisDoGol} · gol do visitante ${vis.length} (${vis.every(s => s.cor === 1 && s.x < -60) ? 'brancos no setor deles' : 'fora do setor'})`,
      '0 · ≥ 4 · ≥ 3 · 0 · 2 brancos no setor visitante', semEvento === 0 && naSaida >= 4 && noGol >= 3 && saidaDepoisDoGol === 0 && vis.length === 2 && vis.every(s => s.cor === 1 && s.x < -60));
    // fumaça: 60 s de todos os pontos acesos, o máximo de partículas — nenhuma entra no campo (|x| < 55, |z| < 37)
    {
      const P = FU.FUMACA.porQualidade.alta;
      const f = FE.criarFesta();
      const pontos = [...FE.PONTOS_SINALIZADOR.organizada, ...FE.PONTOS_SINALIZADOR.quinas, ...FE.PONTOS_SINALIZADOR.visitante];
      let dentro = 0, n = 0, maxAlt = 0;
      for (let i = 0; i < pontos.length; i += 8) {
        const lote = pontos.slice(i, i + 8);
        const sl = lote.map((p, k) => ({ ativo: true, t0: 0.4 * k, dur: 28, x: p[0], y: p[1], z: p[2], cor: 0, semente: (k + 1) / 9 }));
        for (let tt = 0; tt <= 60; tt += 0.25) for (const s of sl) for (let p = 0; p < P; p++) {
          const q = FU.fumacaParticula(s, p, P, tt);
          if (!q) continue;
          n++; maxAlt = Math.max(maxAlt, q.y);
          if (Math.abs(q.x) - q.tam / 2 < 55 && Math.abs(q.z) - q.tam / 2 < 37) dentro++;
        }
      }
      reg('Fumaça dos sinalizadores nunca entra no campo (60 s, todos os pontos)', `${dentro} de ${n} partículas no retângulo |x| < 55, |z| < 37 (com o tamanho); sobe até ${fmt(maxAlt, 1)} m`, '0', dentro === 0 && n > 1000);
    }
    // bandeiras: o pano e o mastro, balançando, nunca no campo + 3 m nem abaixo da mureta
    {
      const lista = BD.bandeiras();
      let noCampo = 0, baixo = 0, n = 0;
      const B = BD.BANDEIRAS;
      for (const b of lista) for (let tt = 0; tt < 6; tt += 0.11) for (let a = 0; a <= B.largura; a += 0.5) for (let bb = 0; bb <= B.altura; bb += 0.35) {
        const l = BD.pontoBandeira(a, bb, b.fase, tt);
        const x = b.x + b.ex * l.la + (-b.ez) * l.ln, y = b.y + l.lb, z = b.z + b.ez * l.la + b.ex * l.ln;
        n++;
        if (Math.abs(x) < 52.5 + 3 && Math.abs(z) < 34 + 3) noCampo++;
        if (y < 1.6) baixo++;
      }
      const qs = ['baixa', 'media', 'alta'].map(q => B.bandeiras[q]);
      reg('Bandeiras de mastro fora do campo (o pano balançando)', `${lista.length} bandeiras (Baixa ${qs[0]}, Média ${qs[1]}, Alta ${qs[2]}); ${noCampo} pontos no campo + 3 m e ${baixo} abaixo da mureta (de ${n})`, '0 e 0', noCampo === 0 && baixo === 0 && lista.length >= qs[2]);
    }
    // bandeirão: abre na saída de cada tempo e no gol da casa; não no gol do visitante; enrolado com a bola rolando
    {
      const eb = EM.criarEmocao();
      EM.emocaoEvento(eb, { tipo: 'saida', time: 0 }, ctx(0.1, { x: 0, z: 0 }));
      let tb = roda(eb, 0.1, 5);
      const naSaida = FE.aberturaBandeirao(eb.festa);
      tb = roda(eb, tb, 30);
      const rolando = FE.aberturaBandeirao(eb.festa);
      EM.emocaoEvento(eb, { tipo: 'gol', time: 1 }, ctx(tb, { x: -53, z: 0 }));
      tb = roda(eb, tb, 5, 'gol');
      const golVisit = FE.aberturaBandeirao(eb.festa);
      tb = roda(eb, tb, 20);
      EM.emocaoEvento(eb, { tipo: 'gol', time: 0 }, ctx(tb, { x: 53, z: 0 }));
      tb = roda(eb, tb, 5, 'gol');
      const golCasa = FE.aberturaBandeirao(eb.festa);
      reg('Bandeirão: abre na saída e no gol da casa; enrolado com a bola rolando', `saída ${fmt(naSaida, 2)} · 35 s depois ${fmt(rolando, 2)} · gol do visitante ${fmt(golVisit, 2)} · gol da casa ${fmt(golCasa, 2)}`, '1 · 0 · 0 · 1',
        naSaida > 0.99 && rolando === 0 && golVisit === 0 && golCasa > 0.99);
    }
    // bandeirão aberto (contraprova de 12/10: no gol, 1134 torcedores pulando e 15 das 32 bandeiras de mastro furavam o
    // pano): todos os torcedores (Alta) e todas as bandeiras com o pano dos dois bandeirões aberto, 4 s de gol (excitação
    // máxima: braços para cima e pulando), o topo de cada um contra o pano com a onda — ninguém fica acima do pano
    {
      const ban = BD.bandeiroes();
      const temRegra = typeof BD.sobBandeirao === 'function' && BD.BANDEIRAS.sob;
      const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const fura = (P, b, tt) => {
        const d = [P[0] - b.A[0], P[1] - b.A[1], P[2] - b.A[2]];
        const lu = Math.hypot(...b.U), lv = Math.hypot(...b.V);
        const u = dot(d, b.U) / (lu * lu), v = dot(d, b.V) / (lv * lv);
        return u >= 0 && u <= 1 && v >= 0 && v <= 1 && dot(d, b.N) > BD.ondaBandeirao(u, v, b.larg, tt, 1);
      };
      const d = TD.gerarTorcidaNiveis(null);
      const gol = { excita: 1, tensao: 0, lamento: 0, palmas: 0 };
      let furaT = 0, debaixo = 0;
      for (let i = 0; i < d.n; i++) {
        const x = d.pos[4 * i], y = d.pos[4 * i + 1], z = d.pos[4 * i + 2], esc = d.pos[4 * i + 3];
        const org = d.info[4 * i + 2] > 127, h = d.pele[4 * i + 3] / 255, h2 = d.info[4 * i + 3] / 255;
        const sob = !!temRegra && ban.some(b => BD.sobBandeirao([x, y, z], b, 1, BD.BANDEIRAS.sob.torcedor));
        if (sob) debaixo++;
        let f = false;
        for (let tt = 0; tt < 4 && !f; tt += 0.05) {
          let { pose, pulo } = TD.poseDoTorcedor(gol, h, h2, org, tt, true);
          if (sob) { pose = TD.POSE.BRACOS_V; pulo = 0; }
          const topo = y + TD.CAIXA_POSE[pose][1] * TD.TORCIDA.altura * esc + pulo;
          f = ban.some(b => fura([x, topo, z], b, tt));
        }
        if (f) furaT++;
      }
      let furaB = 0;
      const lista = BD.bandeiras(), B = BD.BANDEIRAS;
      for (const bd of lista) {
        const k = temRegra && ban.some(b => BD.sobBandeirao([bd.x, bd.y, bd.z], b, 1, B.sob.bandeira)) ? 0 : 1;
        let f = false;
        for (let tt = 0; tt < 4 && !f; tt += 0.1) for (let a = 0; a <= B.largura && !f; a += 0.25) for (let bb = 0; bb <= B.altura && !f; bb += 0.35) {
          const l = BD.pontoBandeira(a, bb, bd.fase, tt, 1);
          const P = [bd.x + (bd.ex * l.la + bd.nx * l.ln) * k, bd.y + l.lb * k, bd.z + (bd.ez * l.la + bd.nz * l.ln) * k];
          f = ban.some(b => fura(P, b, tt));
        }
        if (f) furaB++;
      }
      reg('Bandeirão aberto: ninguém fura o pano (torcedores pulando no gol e bandeiras de mastro)', `${furaT} de ${d.n} torcedores e ${furaB} de ${lista.length} bandeiras acima do pano (${debaixo} torcedores debaixo dele seguram o pano, sem pular)`,
        '0 e 0', temRegra && furaT === 0 && furaB === 0 && debaixo > 500);
    }
    // ola: 40 s de torcida calma com o jogo rolando → começa; corre no sentido horário; no máximo 1 a cada 3 min
    {
      const eo = EM.criarEmocao();
      let to = roda(eo, 0, 39);
      const cedo = eo.festa.ola.n;
      to = roda(eo, to, 2);
      const comecou = eo.festa.ola.n;
      const th0 = FE.estadoOla(eo.festa, to).theta;
      to = roda(eo, to, 5);
      const th1 = FE.estadoOla(eo.festa, to).theta;
      to = roda(eo, to, 170);
      const em3min = eo.festa.ola.n;
      const ea = EM.criarEmocao();
      roda(ea, 0, 120, 'jogo', { x: 45, z: 2 });
      // o peso na crista: 1 em cima dela, 0 a 30° dela
      const o = { ativa: true, theta: -Math.PI / 2, largura: FE.FESTA.ola.largura, forca: 1 };
      const naCrista = FE.olaPeso(0, -50, o), longe = FE.olaPeso(50 * Math.cos(-Math.PI / 2 + 0.52), 50 * Math.sin(-Math.PI / 2 + 0.52), o);
      reg('Ola: começa com a torcida calma por 40 s, sentido horário, no máximo 1 a cada 3 min', `aos 39 s ${cedo}, aos 41 s ${comecou}; a crista andou ${fmt((th1 - th0) * 180 / Math.PI, 0)}° em 5 s; ${em3min} em 3,6 min; ${ea.festa.ola.n} com o ataque perto da área; peso ${fmt(naCrista, 2)} na crista e ${fmt(longe, 2)} a 30°`,
        '0 → 1; > 0 (horário); 1; 0; 1 e 0', cedo === 0 && comecou === 1 && th1 > th0 && em3min === 1 && ea.festa.ola.n === 0 && naCrista > 0.99 && longe === 0);
    }
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

// G) o TORCEDOR 3D (item 69, PR 2 — dono, 29/10: "torcida 3D, em todos os estádios"): o modelo (Rocketbox, homem e mulher,
//    2 níveis) com as 8 poses da torcida numa textura de animação (VAT); sentado NA cadeira da grade (o quadril no assento,
//    os pés no piso, as costas na frente do encosto) e de pé na frente dela; virado para o rumo da cadeira (o campo, não a
//    câmera); a escala não tira ninguém do assento; o cachecol só no CACHECOL; a pose é a do quadro (o mesmo
//    ESTADO_GLSL nos dois shaders: a ola e o bandeirão); a escolha das fileiras pelo teto de triângulos com histerese.
//    (A GPU = JS da VAT e do estado fica no navegador: tools/teste-estadio.mjs, item 9.)
{
  const TQ = await imp('render/torcedor-dados.js');
  const TP = await imp('render/torcedor-pose.js');
  const CD = await imp('render/cadeiras-dados.js');
  if (!TQ || !TP) reg('Torcedor 3D (render/torcedor-dados.js, render/torcedor-pose.js)', 'não existe (só o quadro virado para a câmera)', 'existe', false);
  else {
    const fs = await import('node:fs');
    const raizJogo = path.resolve(pastaJs, '..');
    const arq = path.join(raizJogo, TQ.TORCEDOR3D.arquivo);
    const bin = fs.existsSync(arq) ? fs.readFileSync(arq) : null;
    const M = bin ? TQ.lerModelo(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength)) : null;
    if (!M) reg('Torcedor 3D: o modelo (assets/torcedor/torcedor.bin)', 'não existe', 'existe', false);
    else {
      const V = TQ.vatDados(M), R = TQ.REGIAO, P = TD.POSE;
      const kb = f => fs.statSync(path.join(pastaJs, f)).size / 1024;
      const tam = bin.length / 1024 + kb('render/torcedor3d.js') + kb('render/torcedor-dados.js');
      const tris = M.malhas.map(pv => pv.map(m => m.nTri));
      const regs = M.malhas.flat().map(m => new Set(m.regiao).size);
      reg('Torcedor 3D: modelo (homem e mulher × 2 níveis) e o que baixa sob demanda', `${M.nVar} variações, ${M.nLod} níveis, ${M.nPoses} poses; triângulos ${tris.map(t => t.join('/')).join(' · ')}; ${regs.join('/')} regiões; VAT ${V.largura}×${V.altura}; modelo + módulos ${fmt(tam, 0)} KB`,
        '2 × 2 × 8; nível 0 250–340, nível 1 100–150; 6 regiões; ≤ 150 KB',
        M.nVar === 2 && M.nLod === 2 && M.nPoses === 8 && tris.every(t => t[0] >= 250 && t[0] <= 340 && t[1] >= 100 && t[1] <= 150) && regs.every(n => n === 6) && tam <= 150);
      // as posições de uma malha numa pose (no espaço da cadeira, escala 1, sem pulo nem balanço)
      const pts = (v, l, pose, esc = 1, pulo = 0, bal = 0) => {
        const m = M.malhas[v][l], out = [];
        for (let i = 0; i < m.nV; i++) out.push(TQ.torcedorLocal(V, V.linha(v, l), i, pose, esc, pulo, bal).p);
        return out;
      };
      const reg5 = (v, l, r) => { const m = M.malhas[v][l]; const s2 = new Set(); for (let i = 0; i < m.nV; i++) if (m.regiao[i] === r) s2.add(i); return s2; };
      const ASS = CD.CADEIRA.assento.altura;
      // sentado: o quadril no assento, os pés no piso, as costas na frente do encosto; de pé: os pés no piso na frente do
      // assento (a passagem livre), nada dentro do assento
      const sent = [], pe = [];
      for (let v = 0; v < M.nVar; v++) for (let l = 0; l < M.nLod; l++) {
        for (const pose of [P.SENTADO, P.SENTADO_PALMAS]) {
          const q = pts(v, l, pose);
          const nad = q.filter(p => Math.abs(p[0]) < 0.17 && p[2] > -0.2 && p[2] < 0.1 && p[1] > 0.25);
          const pisoY = Math.min(...q.map(p => p[1]));
          const costas = Math.min(...q.filter(p => p[1] > ASS + 0.08 && p[1] < ASS + 0.4 && Math.abs(p[0]) < 0.2).map(p => p[2]));
          const pesZ = q.filter(p => p[1] < 0.12).map(p => p[2]);
          sent.push({ v, l, pose, nad: Math.min(...nad.map(p => p[1])), pisoY, costas, pes: [Math.min(...pesZ), Math.max(...pesZ)] });
        }
        for (const pose of [2, 3, 4, 5, 6, 7]) {
          const q = pts(v, l, pose);
          const pisoY = Math.min(...q.map(p => p[1]));
          const pesZ = q.filter(p => p[1] < 0.12).map(p => p[2]);
          const noAssento = Math.min(...q.filter(p => p[1] > ASS - 0.06 && p[1] < ASS + 0.06 && Math.abs(p[0]) < 0.23).map(p => p[2]));
          pe.push({ pose, pisoY, pes: [Math.min(...pesZ), Math.max(...pesZ)], noAssento });
        }
      }
      const faixa = (l, f) => `${fmt(Math.min(...l.map(f)), 3)}–${fmt(Math.max(...l.map(f)), 3)}`;
      reg('Torcedor 3D sentado NA cadeira (2 poses × 4 malhas): o quadril no assento, os pés no piso, as costas na frente do encosto',
        `nádegas a ${faixa(sent, x => x.nad)} m; pés a ${faixa(sent, x => x.pisoY)} m, z ${faixa(sent, x => x.pes[0])} a ${faixa(sent, x => x.pes[1])}; costas em z ≥ ${fmt(Math.min(...sent.map(x => x.costas)), 3)}`,
        `nádegas ${ASS} ± 0,035; pés −0,015–0,03 e no piso da fileira (z −0,25…0,50); costas ≥ −0,25 (o encosto: −0,22…−0,27)`,
        sent.every(x => Math.abs(x.nad - ASS) <= 0.035 && x.pisoY >= -0.015 && x.pisoY <= 0.03 && x.pes[0] >= -0.25 && x.pes[1] <= 0.5 && x.costas >= -0.25));
      reg('Torcedor 3D de pé (6 poses × 4 malhas): na passagem livre na frente do assento, pés no piso',
        `pés a ${faixa(pe, x => x.pisoY)} m, z ${faixa(pe, x => x.pes[0])} a ${faixa(pe, x => x.pes[1])}; na altura do assento nada antes de z ${fmt(Math.min(...pe.map(x => x.noAssento)), 3)}`,
        'pés −0,015–0,03, z 0,05…0,50 (o lábio do assento a 0,2 e o bico a ~0,51); nada antes de z 0,12 na altura do assento',
        pe.every(x => x.pisoY >= -0.015 && x.pisoY <= 0.03 && x.pes[0] >= 0.05 && x.pes[1] <= 0.5 && x.noAssento >= 0.12));
      // virado para o rumo da cadeira (o campo), no lugar dela: o nariz (o ponto mais à frente da cabeça) na direção do rumo
      const GR = CD.gradeGolaco();
      let rumoMin = 1, campoMin = 1, lugarMax = 0, nC = 0;
      const q0 = pts(0, 0, P.SENTADO);
      const topo = Math.max(...q0.map(p => p[1]));
      const cab = q0.filter(p => p[1] > topo - 0.25);
      const nariz = cab.reduce((a, b) => (b[2] > a[2] ? b : a));
      const meioCab = [cab.reduce((s2, p) => s2 + p[0], 0) / cab.length, nariz[1], cab.reduce((s2, p) => s2 + p[2], 0) / cab.length];
      GR.iterar(c => {
        if ((c.a * 7 + c.f * 3) % 97) return;
        nC++;
        const cad = [c.x, c.z, Math.cos(c.rumo), Math.sin(c.rumo)];
        const n = TQ.torcedorMundo(nariz, cad, c.y), mc = TQ.torcedorMundo(meioCab, cad, c.y), s0 = TQ.torcedorMundo([0, ASS, 0], cad, c.y);
        const dx = n[0] - mc[0], dz = n[2] - mc[2], L = Math.hypot(dx, dz);
        rumoMin = Math.min(rumoMin, (dx * cad[2] + dz * cad[3]) / L);
        // o ponto do campo mais perto da cadeira (o gramado: ±52,5 × ±34)
        const px = Math.max(-52.5, Math.min(52.5, c.x)) - c.x, pz = Math.max(-34, Math.min(34, c.z)) - c.z, Lc = Math.hypot(px, pz);
        campoMin = Math.min(campoMin, (dx * px + dz * pz) / (L * Lc));
        lugarMax = Math.max(lugarMax, Math.hypot(s0[0] - c.x, s0[1] - (c.y + ASS), s0[2] - c.z));
      });
      reg('Torcedor 3D virado para o rumo da cadeira — o campo, não a câmera (cadeiras dos 4 setores do Estádio Golaço)',
        `${nC} cadeiras: o rosto × o rumo ≥ ${fmt(rumoMin, 3)}; × a direção do ponto do gramado mais perto ≥ ${fmt(campoMin, 3)}; o assento do modelo a ≤ ${fmt(lugarMax * 1000, 2)} mm do da cadeira`,
        '≥ 0,95; ≥ 0,3 (as pontas dos fundos passam do canto do gramado e o veem de viés); ≤ 0,01 mm', nC >= 100 && rumoMin >= 0.95 && campoMin >= 0.3 && lugarMax <= 1e-5);
      // a escala (aPos.w) não tira ninguém do assento nem do piso; sentado não pula; de pé o pulo levanta tudo
      const sNad = e => Math.min(...pts(1, 0, P.SENTADO, e).filter(p => Math.abs(p[0]) < 0.17 && p[2] > -0.2 && p[2] < 0.1 && p[1] > 0.25).map(p => p[1]));
      const dNad = Math.max(Math.abs(sNad(0.5) - sNad(1)), Math.abs(sNad(2) - sNad(1)));
      const dPe = Math.max(...[0.5, 2].map(e => Math.abs(Math.min(...pts(1, 0, P.EM_PE, e).map(p => p[1])) - Math.min(...pts(1, 0, P.EM_PE).map(p => p[1])))));
      const puloSent = Math.max(...pts(0, 1, P.SENTADO, 1, 0.3).map((p, i) => Math.abs(p[1] - pts(0, 1, P.SENTADO)[i][1])));
      const puloPe = Math.min(...pts(0, 1, P.BRACOS_V, 1, 0.3).map((p, i) => p[1] - pts(0, 1, P.BRACOS_V)[i][1]));
      reg('Torcedor 3D: a escala do quadro (0,5–2) não tira do assento nem do piso; sentado não pula, de pé o pulo levanta o corpo inteiro',
        `nádegas mudam ${fmt(dNad * 1000, 1)} mm, os pés ${fmt(dPe * 1000, 1)} mm; pulo de 0,3 m: sentado ${fmt(puloSent, 3)} m, de pé ${fmt(puloPe, 3)} m`,
        'nádegas ≤ 12 mm (a altura do assento menos o quadril escalado), pés ≤ 1 mm; 0 e 0,3', dNad <= 0.012 && dPe <= 0.001 && puloSent === 0 && Math.abs(puloPe - 0.3) < 1e-6);
      // as 8 poses: sentado baixo, de pé alto, braços acima da cabeça, mãos na cabeça, palmas na frente do peito
      const alt = (v, l, pose) => Math.max(...pts(v, l, pose).map(p => p[1]));
      const frente = (v, l, pose, y0, y1, z0) => pts(v, l, pose).filter(p => p[1] > y0 && p[1] < y1 && p[2] > z0).length;
      const falhaPose = [];
      for (let v = 0; v < M.nVar; v++) for (let l = 0; l < M.nLod; l++) {
        const h = Array.from({ length: 8 }, (_, k) => alt(v, l, k));
        if (!(h[0] < 1.5 && h[1] < 1.5)) falhaPose.push(`${v}/${l} sentado alto (${fmt(h[0], 2)})`);
        if (!(h[2] > 1.55)) falhaPose.push(`${v}/${l} de pé baixo (${fmt(h[2], 2)})`);
        for (const k of [P.BRACOS_V, P.UM_BRACO, P.CACHECOL]) if (!(h[k] > h[2] + 0.2)) falhaPose.push(`${v}/${l} pose ${k} sem braço acima da cabeça`);
        if (!(h[P.MAOS_CABECA] < h[2] + 0.15 && h[P.MAOS_CABECA] > h[2] - 0.02)) falhaPose.push(`${v}/${l} mãos na cabeça (${fmt(h[7] - h[2], 2)})`);
        if (!(frente(v, l, P.SENTADO_PALMAS, 0.85, 1.4, 0.15) > frente(v, l, P.SENTADO, 0.85, 1.4, 0.15) + 2)) falhaPose.push(`${v}/${l} palmas sentado`);
        if (!(frente(v, l, P.EM_PE_PALMAS, 1.0, 1.5, 0.55) > frente(v, l, P.EM_PE, 1.0, 1.5, 0.55) + 2)) falhaPose.push(`${v}/${l} palmas de pé`);
        // o cachecol (região acento): só no CACHECOL, aberto acima da cabeça
        const ac = reg5(v, l, R.acento), m = M.malhas[v][l];
        const area = pose => { const q = pts(v, l, pose); let a = 0; for (let t = 0; t < m.nTri; t++) { const [i, j, k] = [m.indice[3 * t], m.indice[3 * t + 1], m.indice[3 * t + 2]]; if (!ac.has(i)) continue; const u = [0, 1, 2].map(c => q[j][c] - q[i][c]), w = [0, 1, 2].map(c => q[k][c] - q[i][c]); a += 0.5 * Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]); } return a; };
        for (let k = 0; k < 8; k++) { const a = area(k); if (k === P.CACHECOL ? a < 0.08 : a > 1e-6) falhaPose.push(`${v}/${l} cachecol na pose ${k} (${fmt(a, 3)} m²)`); }
        const yAc = Math.min(...[...ac].map(i => pts(v, l, P.CACHECOL)[i][1]));
        if (!(yAc > h[2] - 0.15)) falhaPose.push(`${v}/${l} cachecol baixo (${fmt(yAc, 2)})`);
      }
      reg('Torcedor 3D: as 8 poses do quadro (sentado, palmas, de pé, braços em V, um braço, cachecol, mãos na cabeça) e o cachecol só no CACHECOL',
        falhaPose.length ? falhaPose.slice(0, 6).join(' | ') : 'as 8 nas 4 malhas', 'nenhuma falha', falhaPose.length === 0);
      // a pose do 3D é a do quadro: o MESMO ESTADO_GLSL nos dois shaders (e nada de pose escrita à mão no quadro); a ola
      // levanta quem está na crista; debaixo do bandeirão aberto, braços em V sem pular
      const fonte = f => fs.readFileSync(path.join(pastaJs, f), 'utf8');
      const tq = fonte('render/torcida.js'), t3 = fonte('render/torcedor3d.js');
      const usaMesmo = [tq, t3].every(t => /import \{[^}]*ESTADO_GLSL[^}]*\} from '\.\/torcedor-pose\.js'/.test(t) && t.includes('${ESTADO_GLSL}') && t.includes('torcedorEstado(aPos.xyz, h, aInfo)')) && !/torcidaPose\(/.test(tq);
      const BD = await imp('render/bandeiras-dados.js'), FE = await imp('render/festa.js');
      const B = BD.bandeiroes();
      const calmos = [{ excita: 0, tensao: 0, lamento: 0, palmas: 0 }, { excita: 0, tensao: 0, lamento: 0, palmas: 0 }];
      const U0 = { tempo: 10, tempoOrg: 10, animada: 1, ola: null, bandeiroes: B, abre: [0, 0] };
      const lugarSob = [0, 1, 2].map(k => B[0].A[k] + B[0].U[k] * 0.5 + B[0].V[k] * 0.4 - B[0].N[k] * BD.BANDEIRAS.bandeirao.altura);
      const calmo = TP.estadoTorcedor(calmos, lugarSob, 0.5, [0, 0, 0, 0.5], U0);
      const sob = TP.estadoTorcedor(calmos, lugarSob, 0.5, [0, 0, 0, 0.5], { ...U0, abre: [1, 0] });
      const thL = Math.atan2(lugarSob[2], lugarSob[0]);
      const naOla = TP.estadoTorcedor(calmos, lugarSob, 0.5, [0, 0, 0, 0.5], { ...U0, ola: { theta: thL, largura: 0.2, forca: 1, ativa: true } });
      reg('Torcedor 3D: a pose é a do quadro (o mesmo ESTADO_GLSL nos dois shaders); a ola levanta e o bandeirão segura',
        `mesmo código: ${usaMesmo ? 'sim' : 'NÃO'}; calmo pose ${calmo.pose}; debaixo do bandeirão aberto pose ${sob.pose} pulo ${sob.pulo}; na crista da ola pose ${naOla.pose} pulo ${fmt(naOla.pulo, 2)} (peso ${fmt(FE.olaPeso(lugarSob[0], lugarSob[2], { theta: thL, largura: 0.2, forca: 1, ativa: true }), 2)})`,
        `sim; ${P.SENTADO}; ${P.BRACOS_V} e 0; ${P.BRACOS_V} e 0,3`,
        usaMesmo && calmo.pose === P.SENTADO && sob.pose === P.BRACOS_V && sob.pulo === 0 && naOla.pose === P.BRACOS_V && Math.abs(naOla.pulo - 0.3) < 1e-9);
      // a escolha das fileiras (pura): Baixa nada; o teto de triângulos; a histerese de entrada/saída e do nível 0; na TV
      // (nenhum bloco de cadeira 3D) nada
      const Q = TQ.TORCEDOR3D.qual, tri = [306, 128];
      const un = Array.from({ length: 40 }, (_, i) => ({ chave: 'b:' + i, px: 8 + i, n: 24 }));
      const eB = TQ.escolherTorcedores(un, new Map(), { ...Q.baixa, tri });
      const eM = TQ.escolherTorcedores(un, new Map(), { ...Q.media, tri });
      const eA = TQ.escolherTorcedores(un, new Map(), { ...Q.alta, tri });
      const meio = Q.media.pxSai + (Q.media.pxEntra - Q.media.pxSai) / 2;
      const entra = TQ.escolherTorcedores([{ chave: 'x', px: meio, n: 10 }], new Map(), { ...Q.media, tri }).escolha.size;
      const fica = TQ.escolherTorcedores([{ chave: 'x', px: meio, n: 10 }], new Map([['x', 1]]), { ...Q.media, tri }).escolha.size;
      const l0Entra = TQ.escolherTorcedores([{ chave: 'x', px: (Q.alta.pxLod0 + Q.alta.pxLod0Sai) / 2, n: 10 }], new Map([['x', 1]]), { ...Q.alta, tri }).escolha.get('x');
      const l0Fica = TQ.escolherTorcedores([{ chave: 'x', px: (Q.alta.pxLod0 + Q.alta.pxLod0Sai) / 2, n: 10 }], new Map([['x', 0]]), { ...Q.alta, tri }).escolha.get('x');
      const tv = TQ.escolherTorcedores([], new Map(), { ...Q.alta, tri }).escolha.size;
      const maisPerto = [...eM.escolha.keys()].every(k => +k.split(':')[1] >= Math.min(...[...eM.escolha.keys()].map(c => +c.split(':')[1])));
      reg('Torcedor 3D: a escolha das fileiras — Baixa sem 3D, o teto de triângulos, a histerese (entrar/sair e o nível 0), TV sem nada',
        `Baixa ${eB.escolha.size}; Média ${eM.torcedores} torcedores (${eM.triangulos} ≤ ${Q.media.teto}), as de mais px: ${maisPerto ? 'sim' : 'não'}; Alta ${eA.torcedores} (${eA.triangulos} ≤ ${Q.alta.teto}); entre a saída e a entrada: entra ${entra}, fica ${fica}; nível 0 entre os limiares: vindo do 1 → ${l0Entra}, vindo do 0 → ${l0Fica}; TV ${tv}`,
        '0; ≥ 1 e ≤ teto, sim; > Média e ≤ teto; 0 e 1; 1 e 0; 0',
        eB.escolha.size === 0 && eM.torcedores >= 1 && eM.triangulos <= Q.media.teto && maisPerto && eA.torcedores > eM.torcedores && eA.triangulos <= Q.alta.teto && entra === 0 && fica === 1 && l0Entra === 1 && l0Fica === 0 && tv === 0);
    }
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-torcida: REPROVOU (${falhas})` : '\nteste-torcida: PASSOU');
process.exit(falhas ? 1 : 0);
