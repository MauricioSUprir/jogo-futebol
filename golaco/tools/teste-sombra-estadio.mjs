// A SOMBRA DO ESTÁDIO no chão (item 46; js/sombra-estadio.js, puro; contrato "Sombra do estádio (item 46)" no CONTRATOS.md):
//   S1) RAIO × SÓLIDOS: em pontos sorteados do chão aberto do estádio (o ar livre logo acima do chão: dentro da frente das
//       arquibancadas, as placas e os cantos abertos) e a 1,0 e 1,8 m de altura (o corpo de quem joga), um árbitro
//       independente anda o raio até o sol pelo SÓLIDO do estádio (estadio-forma.js solidoEm, sem folga, o do jogo:
//       fora = false) — o Estádio Golaço, o Maracanã (estadio-planta.js) e as plantas genéricas (estadio-generico.js: os FIXOS,
//       um de cada peça — vigas, cubo, a estrutura larga do Morumbi, as torres por lado, os postes, as torres de canto, os
//       cantos abertos, a pista, o anel, a retrátil —, e mais um a cada `--passo` da base) — e a máscara tem de dizer o mesmo longe
//       da borda (|distância| > 0,3 m): ≤ 0,3% de discordância em cada estádio. As peças finas (as torres de refletor, os
//       telões, o cubo e as vigas) seguem o DESENHO (o sólido delas é a folga da câmera): nelas o árbitro é a peça exata
//       (dentroDaPeca: a caixa, a barra e o cilindro), não o sólido; a rede do gol não faz sombra (não é opaca);
//   S2) sem cobertura (as tigelas e a inglesa "nenhuma"): ≥ 95% do campo ao sol (só as placas e as peças finas);
//   S3) o sol é UM só: o SOL_DIA = o do render/cena.js (que o importa) = o SOLD das plantas (a sombra das cadeiras);
//   S4) a leitura: a decodificação dos 8 bits e a filtragem bilinear (distanciaNoChao) = a conta à mão do texel; o sol
//       contínuo (sem degrau) atravessando a borda; fora da caixa, sol; a máscara vazia = sol em todo lugar;
//   S5) o GLSL: o fwidth só no TOPO (SOMBRA_GLSL_F_TOPO), nenhuma derivada nem leitura com mip nas funções (textureLod), o
//       fator só na luz de índice 0; as constantes do GLSL = as do JS (o uniforms);
//   S6) o custo: a máscara dos 3 estádios mais pesados da amostra ≤ 300 ms em Node (a menor de 3 vezes) e a maior fatia entre
//       duas pausas ≤ 40 ms (a página roda as fatias no tempo ocioso).
// Na main (sem js/sombra-estadio.js) reprova.
//   node tools/teste-sombra-estadio.mjs [--js <pasta js>] [--passo N (um estádio da base a cada N; 0 = só os fixos)]
//     [--pontos N (por estádio)] [--so chave1,chave2]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const pastaJs = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let S = null;
try { S = await imp('sombra-estadio.js'); } catch (_) { S = null; }
if (!S) {
  reg('a sombra do estádio (js/sombra-estadio.js)', 'não existe (só o mapa de sombra dos jogadores)', 'existe', false);
} else {
  const F = await imp('estadio-forma.js');
  const G = await imp('estadio-generico.js');
  const P = await imp('estadio-planta.js');
  const base = JSON.parse(fs.readFileSync(path.join(pastaJs, '../assets/tm/estadios.json'), 'utf8'));
  const PASSO = Number(arg('--passo', 6)), NPT = Number(arg('--pontos', 900)), SO = arg('--so', null)?.split(',') ?? null;
  const sol = S.SOL_DIA, n = Math.hypot(...sol), sd = sol.map(v => v / n);
  const FINAS = new Set(['refletor', 'telão', 'viga', 'cubo']);

  // ---------------------------------------------------------------- S1: raio × sólidos
  // o sorteio (determinístico por estádio)
  const sorteio = semente => { let a = semente >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const hashStr = s => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  /** O árbitro: o raio do ponto até o sol bate em algo? (o sólido do jogo, menos as finas — essas pela peça exata do desenho) */
  function arbitro(planta, finas, x, y, z, ate = 95) {
    for (let t = 0.02; t < 160; ) {
      const px = x + sd[0] * t, py = y + sd[1] * t, pz = z + sd[2] * t;
      if (py > ate) return false;
      const r = F.solidoEm(px, py, pz, 0, false);
      if (r && r !== 'chão' && r !== 'gol' && !FINAS.has(r)) {
        // (o Maracanã: o sólido da câmera fecha a coluna inteira ACIMA da borda de fora da cobertura — `y > yc && u < 0,02`;
        // ali não há nada: o raio que passa por cima da cobertura segue)
        let vale = true;
        if (r === 'cobertura' && planta && !planta.generica) {
          const u = planta.uCob(px, pz), C = planta.forma.cobertura;
          if (py > planta.alturaCob(Math.min(1, Math.max(0, u))) + 1.0 + (C.cone ?? 0)) vale = false;
        }
        if (vale) return true;
      }
      for (const p of finas) if (S.dentroDaPeca(p, px, py, pz)) return true;
      // passos finos perto do chão (as placas têm 14 cm) e de 0,2 m acima (as chapas da cobertura têm ≥ 2,4 m de altura)
      t += py < 3 ? 0.03 : 0.2;
    }
    return false;
  }
  /** Ar livre logo acima do chão (onde se joga ou se vê o chão): nada sólido a 0,35 m e dentro da caixa da máscara. */
  const [X0, Z0, X1, Z1] = S.SOMBRA_ESTADIO.caixa;
  const livre = (x, z) => !F.solidoEm(x, 0.35, z, 0, false) && !F.solidoEm(x, 2.2, z, 0, false);
  const resumo = [];
  function medir(nome, planta) {
    F.definirForma(planta);
    const t0 = performance.now();
    const pecas = S.pecasDoEstadio(planta);
    const it = S.calcularMascara(planta, S.SOL_DIA, { pecas });
    let r, ta = performance.now(), maior = 0;
    do { r = it.next(); const tb = performance.now(); maior = Math.max(maior, tb - ta); ta = tb; } while (!r.done);
    const m = r.value, ms = performance.now() - t0;
    const finas = pecas.filter(p => FINAS.has(p.classe));
    const rng = sorteio(hashStr(nome));
    const cont = { n: 0, borda: 0, disc: 0, sombraRef: 0, ex: [] };
    let tent = 0;
    while (cont.n < NPT && tent < NPT * 40) {
      tent++;
      // metade dos pontos no campo e no entorno (onde se joga), metade na caixa toda
      const x = rng() < 0.5 ? -60 + 120 * rng() : X0 + 2 + (X1 - X0 - 4) * rng(), z = rng() < 0.5 ? -42 + 84 * rng() : Z0 + 2 + (Z1 - Z0 - 4) * rng();
      // (o corredor do túnel é um vão na arquibancada que a máscara não abre: o chão dele fica debaixo dela)
      if (!livre(x, z) || F.noCorredorDoTunel(x, 1, z)) continue;
      const y = [0.02, 1.0, 1.8][cont.n % 3];
      // o chão tocado pelo raio que passa pelo ponto: com uma peça BAIXA entre ele e o ponto (o raio do chão até a altura do
      // ponto bate em algo — o banco, a placa) a projeção não vale e o ponto não entra (contrato: "abaixo do que faz sombra")
      const k = S.deslocamentoSol(), gx = x + y * k[0], gz = z + y * k[1];
      if (y > 0.1 && (!livre(gx, gz) || arbitro(planta, finas, gx, 0.02, gz, y))) { cont.baixa = (cont.baixa ?? 0) + 1; continue; }
      cont.n++;
      const ref = arbitro(planta, finas, x, y, z);
      if (ref) cont.sombraRef++;
      const d = S.distanciaNoChao(m, gx, gz);
      // (perto da borda, de 0,1 a 0,3 m, só informativo: a borda da máscara contra a do árbitro)
      if (Math.abs(d) > 0.1 && Math.abs(d) <= 0.3) { cont.perto = (cont.perto ?? 0) + 1; if ((d < 0) === ref) cont.pertoOk = (cont.pertoOk ?? 0) + 1; }
      if (Math.abs(d) <= 0.3) { cont.borda++; continue; }
      if ((d < 0) !== ref) { cont.disc++; if (cont.ex.length < 8) cont.ex.push(`(${x.toFixed(1)}, ${y}, ${z.toFixed(1)}) árbitro ${ref ? 'sombra' : 'sol'}, máscara ${fmt(d, 2)} m`); }
    }
    const fora = cont.n - cont.borda, frac = fora ? cont.disc / fora : 0;
    resumo.push({ nome, frac, ...cont, ms, maior, sombra: m.sombra, campo: fracCampo(m) });
  }
  /** A fração do CAMPO (as linhas) ao sol, de 0,5 em 0,5 m. */
  function fracCampo(m) {
    let sol = 0, tot = 0;
    for (let x = -52.25; x < 52.5; x += 0.5) for (let z = -33.75; z < 34; z += 0.5) { tot++; sol += S.solNoChao(m, x, z); }
    return sol / tot;
  }
  const casos = [['golaço', null]];
  const mar = Object.entries(base.estadios).find(([, e]) => e.forma && e.forma.entorno === 'maracana');
  if (mar) casos.push(['maracanã', () => P.criarPlanta(P.validarForma(mar[1].forma))]);
  // os FIXOS: um de cada peça (as vigas e as rampas do San Siro, o cubo da Veltins, a estrutura larga do Morumbi, as torres
  // por lado de São Januário, as torres de canto e os cantos abertos da Serrinha, os postes da Bombonera, a pista do
  // Olímpico Universitário, o anel do Beira-Rio, a retrátil da Johan Cruyff, a inglesa coberta de Anfield, os telões do
  // Allianz Parque)
  const FIXOS = ['san siro', 'veltins arena', 'morumbi', 'sao januario', 'serrinha', 'la bombonera', 'estadio olimpico universitario', 'beira rio', 'johan cruyff arena', 'anfield', 'allianz parque'];
  let i = 0;
  for (const [k, e] of Object.entries(base.estadios)) {
    if (!e.forma || e.forma.entorno === 'maracana') continue;
    if (SO ? !SO.includes(k) : !(FIXOS.includes(k) || (PASSO > 0 && i++ % PASSO === 0))) continue;
    casos.push([k, () => G.criarPlantaGenerica(e.forma)]);
  }
  for (const [nome, criar] of casos) {
    if (SO && !SO.includes(nome)) continue;
    medir(nome, criar ? criar() : null);
  }
  F.definirForma(null);
  const pior = resumo.reduce((a, b) => (b.frac > a.frac ? b : a), resumo[0]);
  const tot = resumo.reduce((a, b) => ({ n: a.n + b.n, borda: a.borda + b.borda, disc: a.disc + b.disc }), { n: 0, borda: 0, disc: 0 });
  reg(`S1 raio × sólidos: a máscara × o raio até o sol pelo sólido do jogo (as finas pelo desenho), longe da borda (> 0,3 m), no chão e a 1,0/1,8 m — ${resumo.length} estádios, ${tot.n} pontos`,
    `discordância total ${fmt(100 * tot.disc / Math.max(1, tot.n - tot.borda), 3)}%; pior ${pior.nome} ${fmt(100 * pior.frac, 2)}% (${pior.disc}/${pior.n - pior.borda})${pior.ex.length ? ': ' + pior.ex.join('; ') : ''}; na borda ${fmt(100 * tot.borda / tot.n, 1)}%`,
    '≤ 0,3% em cada estádio', resumo.every(r => r.frac <= 0.003));
  const perto = resumo.reduce((a, b) => ({ n: a.n + (b.perto ?? 0), ok: a.ok + (b.pertoOk ?? 0) }), { n: 0, ok: 0 });
  linhas.push(['S1i (informativo) perto da borda, de 0,1 a 0,3 m dela pela máscara: o árbitro concorda', `${perto.ok}/${perto.n} (${fmt(100 * perto.ok / Math.max(1, perto.n), 1)}%)`, '—', 'INFO']);
  // S1b: a amostra exercita sombras de verdade no campo (o S1 só prova algo se a máscara não estiver quase toda ao sol): ≥ 5
  // estádios com ≥ 25% do campo na sombra e os pontos do campo deles na sombra pelo árbitro
  const grandes = resumo.filter(r => r.campo <= 0.75);
  reg('S1b a amostra tem sombra de verdade no campo: estádios com ≥ 25% do campo na sombra (o árbitro concorda neles pelo S1)',
    grandes.map(r => `${r.nome} ${fmt(100 * (1 - r.campo), 0)}%`).join(' · ') || '(nenhum)', '≥ 5 estádios', grandes.length >= 5);
  // golaço: só a torre do canto de cá −x no campo (o painel)
  const gol = resumo.find(r => r.nome === 'golaço');
  if (gol) reg('S1c o Estádio Golaço: o campo quase todo ao sol (a sombra do painel da torre do canto −x de cá entra perto da bandeirinha)', `${fmt(100 * gol.campo, 2)}% ao sol`, '98–99,9%', gol.campo >= 0.98 && gol.campo <= 0.999);

  // ---------------------------------------------------------------- S2: sem cobertura
  const sem = Object.entries(base.estadios).filter(([, e]) => e.forma && e.forma.entorno !== 'maracana' && (e.forma.cob?.tipo ?? e.forma.cobertura?.tipo) === 'nenhuma');
  const s2 = sem.map(([k, e]) => { const pl = G.criarPlantaGenerica(e.forma); const m = S.mascaraDoChao(pl); return [k, fracCampo(m)]; });
  reg('S2 sem cobertura: o campo ao sol (só as placas e as peças finas fazem sombra nele)', s2.map(([k, v]) => `${k} ${fmt(100 * v, 1)}%`).join(' · '), '≥ 95% em todos', s2.length > 0 && s2.every(([, v]) => v >= 0.95));

  // ---------------------------------------------------------------- S3: um sol só
  {
    const cena = fs.readFileSync(path.join(pastaJs, 'render/cena.js'), 'utf8');
    const usa = /import\s*\{[^}]*SOL_DIA[^}]*\}\s*from\s*'\.\.\/sombra-estadio\.js'/.test(cena) && /solDir:\s*SOL_DIA/.test(cena);
    const solds = ['estadio-planta.js', 'estadio-generico.js'].map(f => {
      const m = fs.readFileSync(path.join(pastaJs, f), 'utf8').match(/const SOLD = \[([^\]]+)\]/);
      return m ? m[1].split(',').map(Number) : null;
    });
    const iguais = solds.every(v => v && v.length === 3 && v.every((c, i) => c === S.SOL_DIA[i]));
    reg('S3 um sol só: o render/cena.js usa o SOL_DIA no dia e o SOLD das plantas (a sombra das cadeiras) é o mesmo', `cena.js ${usa ? 'importa' : 'NÃO importa'}; plantas ${solds.map(v => v ? v.join(', ') : '?').join(' | ')}`, `[${S.SOL_DIA.join(', ')}] em todos`, usa && iguais);
  }

  // ---------------------------------------------------------------- S4: a leitura
  {
    // uma máscara de 4 × 3 texels à mão: a bilinear no meio de 4 texels e a decodificação
    const m = { nx: 4, nz: 3, x0: 0, z0: 0, passo: 1, faixa: 3, penumbra: 0.4, k: [0, 0], dados: new Uint8Array([0, 51, 102, 153, 204, 255, 128, 64, 32, 16, 8, 4]) };
    const T = (i, j) => m.dados[j * 4 + i] / 255;
    const esp = ((T(1, 0) + T(2, 0) + T(1, 1) + T(2, 1)) / 4 - 0.5) * 6;
    const lido = S.distanciaNoChao(m, 2, 1);
    // atravessando uma borda reta da máscara do Golaço (a do painel): o sol sobe sem degrau maior que a resolução
    const mg = S.mascaraDoChao(null);
    let maxSalto = 0, prev = null;
    for (let x = -62; x <= -40; x += 0.01) { const v = S.solNoChao(mg, x, 30); if (prev != null) maxSalto = Math.max(maxSalto, Math.abs(v - prev)); prev = v; }
    const vazia = S.mascaraVazia();
    const vaz = [[-200, 0], [0, 0], [50, 30], [95, 71]].every(([x, z]) => S.solNoChao(vazia, x, z) === 1);
    const fora = S.solNoChao(mg, 120, 0) === 1 && S.solNoChao(mg, 0, -90) === 1;
    reg('S4 a leitura: bilinear + decodificação = a conta à mão; o sol contínuo na borda (passo de 1 cm); fora da caixa e na máscara vazia, sol',
      `meio de 4 texels ${fmt(lido, 4)} × ${fmt(esp, 4)} m; maior salto ${fmt(maxSalto, 3)} por cm; fora ${fora}; vazia ${vaz}`, 'igual; ≤ 0,05; true; true',
      Math.abs(lido - esp) < 1e-9 && maxSalto <= 0.05 && fora && vaz);
  }

  // ---------------------------------------------------------------- S5: o GLSL
  {
    const funcoes = S.SOMBRA_GLSL_F_DECL;
    const derivNasFuncoes = /\b(fwidth|dFdx|dFdy|texture2D|texture)\s*\(/.test(funcoes.replace(/textureLod/g, ''));
    const topo = /fwidth\s*\(\s*vSombraChao\s*\)/.test(S.SOMBRA_GLSL_F_TOPO);
    const luz = /UNROLLED_LOOP_INDEX\s*==\s*0/.test(S.SOMBRA_GLSL_LUZ) && /getDirectionalLightInfo/.test(S.SOMBRA_GLSL_LUZ);
    const vert = /instanceMatrix/.test(S.SOMBRA_GLSL_V) && /batchingMatrix/.test(S.SOMBRA_GLSL_V) && /uSombraK/.test(S.SOMBRA_GLSL_V);
    const U = S.uniformsDaMascara(S.mascaraVazia());
    const k = S.deslocamentoSol();
    const okU = Math.abs(U.borda - S.SOMBRA_ESTADIO.penumbra / 2) < 1e-12 && U.faixa === S.SOMBRA_ESTADIO.faixa && Math.abs(k[0] + S.SOL_DIA[0] / S.SOL_DIA[1]) < 1e-12;
    reg('S5 o GLSL: fwidth só no topo do main, nenhuma derivada nem leitura com mip nas funções (textureLod), o fator só na luz 0, o vertex com a instância e o lote; os uniforms = as constantes',
      `funções ${derivNasFuncoes ? 'COM derivada' : 'sem derivada'}; topo ${topo}; luz 0 ${luz}; vertex ${vert}; uniforms ${okU}`, 'sem; true; true; true; true', !derivNasFuncoes && topo && luz && vert && okU);
  }

  // ---------------------------------------------------------------- S6: o custo
  // (os 3 estádios mais pesados da amostra de novo, 3 vezes cada, vale a menor de cada — uma pausa do coletor de lixo ou a
  // máquina dividida com outro teste não é o custo)
  const pesados = [...resumo].sort((a, b) => b.ms - a.ms).slice(0, 3);
  const medidos = pesados.map(r => {
    const criar = casos.find(c => c[0] === r.nome)[1];
    let ms = Infinity, fatia = Infinity;
    for (let k = 0; k < 3; k++) {
      const planta = criar ? criar() : null;
      const t0 = performance.now();
      const it = S.calcularMascara(planta, S.SOL_DIA);
      let res, ta = performance.now(), maior = 0;
      do { res = it.next(); const tb = performance.now(); maior = Math.max(maior, tb - ta); ta = tb; } while (!res.done);
      ms = Math.min(ms, performance.now() - t0); fatia = Math.min(fatia, maior);
    }
    return { nome: r.nome, ms, fatia };
  });
  const pM = medidos.reduce((a, b) => (b.ms > a.ms ? b : a), medidos[0]);
  reg('S6 o custo em Node: a máscara (peças, pintura, distância e textura) dos 3 estádios mais pesados da amostra (a menor de 3) e a maior fatia entre duas pausas',
    medidos.map(m => `${m.nome} ${fmt(m.ms, 0)} ms (fatia ${fmt(m.fatia, 1)})`).join(' · '), '≤ 300 ms; ≤ 40 ms', pM.ms <= 300 && medidos.every(m => m.fatia <= 40));

  // a tabela por estádio (informativa)
  console.log(tabelaTexto([['estádio', 'pontos', 'na borda', 'discordam', 'fora (peça baixa)', 'campo ao sol', 'caixa na sombra', 'ms', 'maior fatia'],
    ...resumo.map(r => [r.nome, r.n, r.borda, `${r.disc} (${fmt(100 * r.frac, 2)}%)`, r.baixa ?? 0, `${fmt(100 * r.campo, 1)}%`, `${fmt(100 * r.sombra, 1)}%`, fmt(r.ms, 0), fmt(r.maior, 1)])]));
}
console.log(tabelaTexto(linhas));
console.log(falhas ? `\n${falhas} REPROVADO(S)` : '\nTODOS PASSARAM');
process.exit(falhas ? 1 : 0);
