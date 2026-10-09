// Passes (seção 5): passe rasteiro no pé (chegada ≤ 1 m do recebedor), enfiada no espaço
// (chegada ≥ 4 m à frente; o recebedor arranca em ≤ 0,2 s), lançamento (bom lançador a ±3 m a
// 40 m), cruzamento na zona escolhida, escolha do alvo pelo analógico (cone ±30°), jogada de
// primeira e tabela. Cenários com companheiros parados/correndo e sem marcação.
//   node tools/teste-passes.mjs
import { criarMundo, passo, jogadorPorId } from '../js/sim.js';
import { BOTAO, PASSO, CAMPO } from '../js/config.js';
import { tabelaTexto, fmt, media, percentil, DEG } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

/** Mundo com o passador (id 0, humano) com a bola e companheiros. */
function cena(semente, companheiros, opc = {}) {
  const jog = [{ id: 0, x: opc.x ?? 0, z: opc.z ?? 0, rumo: opc.rumo ?? 0, time: 0, papel: 'humano', posicao: 'MEI', attr: opc.attr ?? {} }];
  for (const c of companheiros) jog.push({ time: 0, papel: 'ia', posicao: c.posicao ?? 'ATA', rumo: c.rumo ?? 0, ...c });
  if (opc.goleiro) jog.push({ id: 20, x: CAMPO.meioX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL' });
  const r = opc.rumo ?? 0;
  return criarMundo({ semente, jogadores: jog, bola: { x: (opc.x ?? 0) + Math.cos(r) * 0.4, z: (opc.z ?? 0) + Math.sin(r) * 0.4 }, posse: 0, log: true });
}

/** Aperta o botão por n ticks com o analógico em (ax, az) e solta; depois roda até `depois` ticks. */
function apertar(m, bot, n, ax, az, depois = 1, mod = false, aoTick = null) {
  for (let i = 0; i < n; i++) { passo(m, { 0: { x: ax, z: az, botoes: bot | (mod ? BOTAO.MOD : 0) } }); aoTick?.(m, i); }
  for (let i = 0; i < depois; i++) { passo(m, { 0: { x: ax * 0.0, z: az * 0.0, botoes: mod ? BOTAO.MOD : 0 } }); aoTick?.(m, n + i); }
}

function primeiroPasse(m) { return m.log.find(l => l.acao); }

// ------------------------------------------------ passe rasteiro: no pé, ≤ 1 m
{
  const dists = [];
  let certo = 0, recebeu = 0, N = 0;
  for (let s = 1; s <= 24; s++) {
    const ang = ((s * 47) % 360) / DEG;
    const L = 8 + (s % 5) * 5;
    const tx = Math.cos(ang) * L, tz = Math.sin(ang) * L;
    // o outro companheiro fica bem fora do cone (90° a 270° do primeiro), em outra distância
    const ang2 = ang + (90 + ((s * 31) % 180)) / DEG, L2 = 10 + ((s * 7) % 15);
    const comp = [{ id: 1, x: tx, z: tz, posicao: 'MEI' }, { id: 2, x: Math.cos(ang2) * L2, z: Math.sin(ang2) * L2, posicao: 'MEI' }];
    const m = cena(s, comp);
    const a0 = Math.atan2(tz, tx) + (((s * 13) % 41) - 20) / DEG; // analógico até ±20° fora
    apertar(m, BOTAO.PASSE, 10, Math.cos(a0), Math.sin(a0), 1);
    for (let i = 0; i < 60 && !primeiroPasse(m); i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    const l = primeiroPasse(m);
    if (!l) continue;
    N++;
    if (l.para === 1) certo++;
    dists.push(Math.hypot(l.alvoX - l.rx, l.alvoZ - l.rz));
    for (let i = 0; i < 240 && m.posse !== 1; i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    if (m.posse === 1) recebeu++;
  }
  reg('passe — analógico a ±20° escolhe o companheiro certo', `${certo}/${N}`, '100%', certo === N && N >= 20);
  reg('passe — chegada a ≤ 1 m do recebedor (máx)', `${fmt(Math.max(...dists))} m`, '≤ 1 m', Math.max(...dists) <= 1.0);
  reg('passe — o recebedor domina', `${recebeu}/${N}`, '≥ 95%', recebeu >= 0.95 * N);
}

// ------------------------------------------------ enfiada: ≥ 4 m à frente; arranca ≤ 0,2 s
{
  const frente = [], reacoes = [];
  let pegou = 0, N = 0;
  for (let s = 1; s <= 20; s++) {
    const correndo = s % 2 === 0;
    const rz = ((s * 7) % 21) - 10;
    const comp = [{ id: 1, x: 14 + (s % 4), z: rz, posicao: 'ATA' }];
    const m = cena(100 + s, comp);
    const r = jogadorPorId(m, 1);
    if (correndo) { r.corrida = { x: 45, z: rz * 0.5, ate: 9999, tipo: 'teste' }; for (let i = 0; i < 50; i++) passo(m, { 0: { x: 0.4, z: 0, botoes: 0 } }); }
    // arrancar = a velocidade NA DIREÇÃO do ponto da enfiada sobe 0,4 m/s (quem andava para o
    // outro lado já conta ao frear e virar para lá)
    let s0 = null, tPasse = null, tArr = null, ux = 1, uz = 0;
    const vAlvo = () => r.vx * ux + r.vz * uz;
    const marcar = (mm) => {
      const l = primeiroPasse(mm);
      if (l && tPasse === null) {
        tPasse = mm.tick;
        const d = Math.hypot(l.alvoX - r.x, l.alvoZ - r.z) || 1;
        ux = (l.alvoX - r.x) / d; uz = (l.alvoZ - r.z) / d;
        s0 = vAlvo();
      }
    };
    const a = Math.atan2(r.z - m.jogadores[0].z, r.x - m.jogadores[0].x);
    apertar(m, BOTAO.ENFIADA, 12 + (s % 3) * 8, Math.cos(a), Math.sin(a), 1, false, marcar);
    for (let i = 0; i < 300; i++) {
      passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      marcar(m);
      if (tPasse !== null && tArr === null && vAlvo() > s0 + 0.4) tArr = (m.tick - tPasse) * PASSO;
      if (m.posse === 1) break;
    }
    const l = primeiroPasse(m);
    if (!l || l.tipo !== 'enfiada') continue;
    N++;
    // à frente: distância do ponto de chegada à posição do recebedor no passe, no sentido do ataque
    frente.push(Math.hypot(l.alvoX - l.rx, l.alvoZ - l.rz) * Math.sign(l.alvoX - l.rx || 1));
    if (!correndo) reacoes.push(tArr ?? 9); // arrancar só se mede em quem estava parado
    if (m.posse === 1) pegou++;
  }
  reg('enfiada — chegada à frente do recebedor (mín)', `${fmt(Math.min(...frente))} m (méd ${fmt(media(frente))})`, '≥ 4 m', Math.min(...frente) >= 4);
  reg('enfiada — recebedor arranca (pior)', `${fmt(Math.max(...reacoes), 3)} s`, '≤ 0,2 s', Math.max(...reacoes) <= 0.2);
  reg('enfiada — recebedor alcança a bola', `${pegou}/${N}`, '≥ 85%', pegou >= 0.85 * N && N >= 16);
}

// ------------------------------------------------ ninguém correndo: arranca o mais adiantado na direção
{
  const m = cena(300, [{ id: 1, x: 10, z: -15, posicao: 'PON' }, { id: 2, x: 22, z: 2, posicao: 'ATA' }, { id: 3, x: -8, z: 10, posicao: 'VOL' }]);
  apertar(m, BOTAO.ENFIADA, 16, 1, 0.1, 1);
  for (let i = 0; i < 30 && !primeiroPasse(m); i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
  const l = primeiroPasse(m);
  reg('enfiada sem ninguém correndo — vai para o mais adiantado na direção', l ? `para ${l.para}` : 'sem passe', 'para 2', !!l && l.para === 2);
}

// ------------------------------------------------ lançamento: ±3 m a 40 m (bom lançador)
// bom lançador: passe longo 90 e perna ruim boa (85, como os bons lançadores); fraco: 45 e 50
for (const [nome, attr, meta, peFraco] of [['bom (90)', 90, 0.85, 85], ['fraco (45)', 45, null, 50]]) {
  const erros = [];
  for (let s = 1; s <= 80; s++) {
    const ang = (((s * 29) % 120) - 60) / DEG;
    const tx = Math.cos(ang) * 40, tz = Math.sin(ang) * 40;
    const m = cena(400 + s, [{ id: 1, x: tx - 10, z: tz * 0.8, posicao: 'ATA' }], { x: -10, attr: { passeLongo: attr, peFraco } });
    jogadorPorId(m, 1).papel = 'parado';
    apertar(m, BOTAO.LANCAMENTO, 30, Math.cos(ang), Math.sin(ang), 1);
    for (let i = 0; i < 30 && !primeiroPasse(m); i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    const l = primeiroPasse(m);
    if (!l || l.tipo !== 'lancamento') continue;
    // onde a bola cai de fato × o alvo pedido (o companheiro)
    let caiu = null;
    for (let i = 0; i < 300 && !caiu; i++) { passo(m, { 0: { x: 0, z: 0, botoes: 0 } }); if (m.eventos.some(e => e.tipo === 'quique')) caiu = { x: m.bola.p.x, z: m.bola.p.z }; }
    const alvo = m.voo?.alvoPedido ?? { x: l.rx, z: l.rz };
    if (caiu) erros.push(Math.hypot(caiu.x - (l.rx ?? alvo.x), caiu.z - (l.rz ?? alvo.z)));
  }
  const dentro = erros.filter(e => e <= 3).length / Math.max(erros.length, 1);
  // ±3 m a 40 m (especificação); erro médio ~1,6 m (Carlsson 2018: 0,82 m a 20 m, erro angular)
  if (meta) reg(`lançamento de 40 m — ${nome}: queda perto do alvo`, `méd ${fmt(media(erros))} m; ${fmt(dentro * 100, 0)}% a ≤ 3 m`, 'méd 1,2–2,0 m e ≥ 85% a ≤ 3 m', media(erros) >= 1.2 && media(erros) <= 2.0 && dentro >= meta && erros.length >= 70);
  else reg(`lançamento de 40 m — ${nome} erra mais`, `${fmt(dentro * 100, 0)}% a ≤ 3 m (méd ${fmt(media(erros))} m)`, 'pior que o bom', dentro < 0.8);
}

// ------------------------------------------------ tempo do passe rasteiro e do lançamento
// StatsBomb (pesquisa da Etapa 2, 101 mil passes rasteiros): velocidade média do toque à recepção
// 8,7 / 10,8 / 12,4 / 13,6 / 14,6 / 15,0 m/s a 7,5 / 12,5 / 17,5 / 22,5 / 27,5 / 35 m (±2 m/s
// entre p25 e p75). Lançamento: voo de 2,3 / 2,8 / 3,3 s a 35 / 45 / 55 m (±0,4 s).
{
  const tempoAte = (m, x0, z0, d) => {
    for (let i = 1; i <= 400; i++) {
      passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      if (Math.hypot(m.bola.p.x - x0, m.bola.p.z - z0) >= d - 0.3) return i * PASSO;
    }
    return 99;
  };
  const res = [];
  let ok = true;
  for (const [d, vMed] of [[7.5, 8.7], [12.5, 10.8], [17.5, 12.4], [22.5, 13.6], [27.5, 14.6], [35, 15.0]]) {
    // recebedor parado (não vem ao encontro), força do meio da barra
    const m = cena(800 + d, [{ id: 1, x: d, z: 0, posicao: 'MEI', papel: 'parado' }]);
    apertar(m, BOTAO.PASSE, 22, 1, 0, 0);
    let l = null;
    for (let i = 0; i < 40 && !(l = primeiroPasse(m)); i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    if (!l) { ok = false; res.push(`${d} m: sem passe`); continue; }
    // distância real do toque até o recebedor (o passador anda um pouco antes de tocar); a bola
    // para no corpo dele, então mede até 0,5 m antes
    const dr = Math.hypot(d - l.bx, l.bz);
    const t = tempoAte(m, l.bx, l.bz, dr - 0.2) + PASSO;
    const tMin = dr / (vMed + 2), tMax = dr / (vMed - 2);
    ok = ok && t >= tMin && t <= tMax;
    res.push(`${fmt(dr, 1)} m ${fmt(t, 2)} s (${fmt(tMin, 2)}–${fmt(tMax, 2)})`);
  }
  reg('passe rasteiro — tempo do toque à chegada (força média)', res.join(' · '), 'na faixa p25–p75 dos dados', ok);
  const resL = [];
  let okL = true;
  for (const [d, tAlvo] of [[35, 2.3], [45, 2.8], [55, 3.3]]) {
    const m = cena(900 + d, [{ id: 1, x: d - 15, z: 0, posicao: 'ATA', papel: 'parado' }], { x: -15 });
    apertar(m, BOTAO.LANCAMENTO, 30, 1, 0, 1);
    let l = null;
    for (let i = 0; i < 40 && !(l = primeiroPasse(m)); i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    let t = null;
    for (let i = 1; i <= 400 && t == null; i++) { passo(m, { 0: { x: 0, z: 0, botoes: 0 } }); if (m.eventos.some(e => e.tipo === 'quique')) t = i * PASSO; }
    okL = okL && t != null && Math.abs(t - tAlvo) <= 0.4;
    resL.push(`${d} m ${t == null ? '—' : fmt(t, 2)} s (${tAlvo})`);
  }
  reg('lançamento — tempo de voo', resL.join(' · '), '±0,4 s dos dados', okL);
}

// ------------------------------------------------ cruzamento: cai na zona pedida
{
  const zonas = { primeiroPau: 0, segundoPau: 0, marcaPenalti: 0 };
  const acertos = { primeiroPau: 0, segundoPau: 0, marcaPenalti: 0 };
  for (let s = 1; s <= 30; s++) {
    const lado = s % 2 ? 1 : -1;
    const x0 = 34, z0 = lado * 26;
    const alvoZona = ['primeiroPau', 'segundoPau', 'marcaPenalti'][s % 3];
    const pz = { primeiroPau: lado * 2.2, segundoPau: -lado * 3.2, marcaPenalti: 0 }[alvoZona];
    const px = { primeiroPau: 47, segundoPau: 46, marcaPenalti: 41.5 }[alvoZona];
    const m = cena(500 + s, [{ id: 1, x: 40, z: 0, posicao: 'ATA' }, { id: 2, x: 44, z: -lado * 5, posicao: 'ATA' }], { x: x0, z: z0, rumo: lado > 0 ? -1.2 : 1.2, attr: { passeLongo: 85 } });
    // analógico em setores: 50° para a linha de fundo = 1º pau; atravessado = 2º pau; 50° para trás = pênalti
    const phi = { primeiroPau: 50, segundoPau: 0, marcaPenalti: -50 }[alvoZona] / DEG;
    apertar(m, BOTAO.LANCAMENTO, 20, Math.sin(phi), -lado * Math.cos(phi), 1);
    for (let i = 0; i < 30 && !primeiroPasse(m); i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    const l = primeiroPasse(m);
    if (!l || l.tipo !== 'cruzamento') continue;
    zonas[alvoZona]++;
    const zona = m.voo?.zona;
    // ponto em que a bola passa a 2,2 m de altura descendo (altura de cabeceio) ou em que alguém
    // a toca antes (cabeçada, domínio)
    let p = null;
    for (let i = 0; i < 240 && !p; i++) {
      const antes = { x: m.bola.p.x, z: m.bola.p.z };
      passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      if (m.eventos.some(e => ['cabeceio', 'dominioAereo', 'toque'].includes(e.tipo) && e.id !== 0) || m.posse != null) p = antes;
      else if (m.bola.v.y < 0 && m.bola.p.y < 2.2) p = { x: m.bola.p.x, z: m.bola.p.z };
    }
    if (zona === alvoZona && p && Math.hypot(p.x - px, p.z - pz) <= 3) acertos[alvoZona]++;
  }
  const tot = Object.values(zonas).reduce((a, b) => a + b, 0), ac = Object.values(acertos).reduce((a, b) => a + b, 0);
  reg('cruzamento — chega na zona pedida (1º pau, 2º pau, pênalti) a ≤ 3 m', `${ac}/${tot} (${Object.entries(acertos).map(([k, v]) => `${k} ${v}/${zonas[k]}`).join(', ')})`, '≥ 80%', tot >= 25 && ac >= 0.8 * tot);
}

// ------------------------------------------------ de primeira: bate sem dominar
{
  let ok = 0, N = 0;
  for (let s = 1; s <= 12; s++) {
    const m = cena(600 + s, [{ id: 1, x: 14, z: 6, posicao: 'ATA' }], { goleiro: true });
    apertar(m, BOTAO.PASSE, 8, 14, 6, 1);
    // o recebedor (agora o controlado) aperta CHUTE antes de a bola chegar
    for (let i = 0; i < 8; i++) passo(m, { 0: { x: 1, z: 0, botoes: BOTAO.CHUTE } });
    passo(m, { 0: { x: 1, z: 0, botoes: 0 } });
    let dominou = false, chutou = false;
    for (let i = 0; i < 120; i++) {
      passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
      for (const e of m.eventos) {
        if (e.tipo === 'toque' && e.id === 1 && e.modo === 'dominio') dominou = true;
        if (e.tipo === 'chute' && e.id === 1) chutou = true;
      }
      if (chutou) break;
    }
    N++;
    if (chutou && !dominou) ok++;
  }
  reg('de primeira — chute pedido antes da bola chegar sai sem domínio', `${ok}/${N}`, '≥ 90%', ok >= 0.9 * N);
}

// ------------------------------------------------ tabela: passa e corre com o modificador
{
  const m = cena(700, [{ id: 1, x: 10, z: 4, posicao: 'MEI' }]);
  const j0 = jogadorPorId(m, 0);
  apertar(m, BOTAO.PASSE, 8, 10, 4, 1, true);
  for (let i = 0; i < 30; i++) passo(m, { 0: { x: 0, z: 0, botoes: BOTAO.MOD } });
  // o controle passou para o 1; o 0 (IA) corre para o espaço
  for (let i = 0; i < 60; i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
  reg('tabela — o passador corre para o espaço', `x ${fmt(j0.x)} m, vel ${fmt(Math.hypot(j0.vx, j0.vz))} m/s`, 'avança > 4 m', j0.x > 4);
}

// ------------------------------------------------ TROCAR: segurar troca uma vez; botão segurado não vira carga
{
  // defendendo (o time 1 tem a bola): o humano do time 0 segura TROCAR por 8 passos
  const jog = [
    { id: 0, x: 0, z: 0, rumo: 0, time: 0, papel: 'humano', posicao: 'VOL' },
    { id: 1, x: 8, z: 6, rumo: 0, time: 0, papel: 'ia', posicao: 'ZAG' },
    { id: 2, x: 8, z: -6, rumo: 0, time: 0, papel: 'ia', posicao: 'ZAG' },
    { id: 30, x: 14, z: 0, rumo: Math.PI, time: 1, papel: 'parado', posicao: 'ATA' },
  ];
  const m = criarMundo({ semente: 950, jogadores: jog, bola: { x: 13.6, z: 0 }, posse: 30 });
  let trocas = 0;
  for (let i = 0; i < 12; i++) {
    passo(m, { 0: { x: 0, z: 0, botoes: i < 8 ? BOTAO.TROCAR : 0 } });
    trocas += m.eventos.filter(e => e.tipo === 'troca').length;
  }
  reg('TROCAR segurado por 8 passos', `${trocas} troca(s)`, '1', trocas === 1);
  // PASSE segurado quando o controle troca sozinho (o adversário ganha a bola): o novo jogador
  // não começa carga nenhuma
  const jog2 = [
    { id: 0, x: -12, z: 0, rumo: 0, time: 0, papel: 'humano', posicao: 'VOL' },
    { id: 1, x: 4, z: 2.5, rumo: 0, time: 0, papel: 'ia', posicao: 'ZAG' },
    { id: 30, x: 7, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'ATA' },
  ];
  const m2 = criarMundo({ semente: 951, jogadores: jog2, bola: { x: 4, z: 0 }, posse: null });
  m2.bola.v.x = 2.5; m2.bola.rolando = true;
  let falsa = false, trocou = false;
  for (let i = 0; i < 90; i++) {
    passo(m2, { 0: { x: 0, z: 0, botoes: BOTAO.PASSE } });
    if (m2.eventos.some(e => e.tipo === 'troca' && e.auto)) trocou = true;
    // a carga que acompanha a troca é a do aperto original (tick 0); uma carga nova seria falsa
    const c = jogadorPorId(m2, m2.controlado[0]);
    if (c.id !== 0 && c.carga && c.carga.t0 !== 0) falsa = true;
  }
  reg('botão segurado na troca automática não cria carga nova', `${trocou ? 'trocou' : 'NÃO trocou'}; ${falsa ? 'carga falsa' : 'sem carga'}`, 'trocou; sem carga', trocou && !falsa);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-passes: REPROVOU (${falhas})` : '\nteste-passes: PASSOU');
process.exit(falhas ? 1 : 0);
