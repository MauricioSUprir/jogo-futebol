// Patrocínios nas camisas reais — SÓ a versão de teste (edição pro do Total Match; dono, 22/10: "vamos tirar dps").
// Confere o que vai para o site em assets/tm/patrocinios.json + assets/tm/patrocinios/ (tools/patrocinios/gerar.mjs) e o
// caminho até o desenho (identidade.js comCamisasReais):
//   P1 cada clube de assets/tm/uniformes.json tem os decalques de casa (≥ 1, com o peito OU a marca do fornecedor);
//   P2 cada decalque: logo existente (WebP 512 × 256, ≤ 48 KB), posição conhecida, cor '#rrggbb', largura ÷ altura > 0;
//   P3 nenhum logo sobrando sem decalque; a pasta ≤ 2 MB;
//   P4 com a base dos patrocínios, comCamisasReais põe os decalques DENTRO dos kits (casa/fora/terceira/goleiro) com a
//      URL do logo; sem ela (edição pública: a página nem baixa), os kits ficam como eram (sem `decais`);
//   P5 a máscara não é uma mancha: em cada logo, ≤ 82% da caixa do desenho é cheia (logo com forma cheia tem o texto
//      vazado — gerar.mjs).
//   P6 o shader do corpo (js/render/humano3d.js, DECL_F + COR_F) sem derivada implícita dentro de desvio (item 63:
//      "retângulos tracejados brancos em volta dos números e patrocínios"; GLSL ES 3.00 §8.9 — indefinida em fluxo não
//      uniforme; a GPU de verdade pega um mip qualquer na borda da caixa): nenhum texture() nas texturas com mipmap (logos,
//      dígitos, rostos, cabeça) — só textureGrad ou textureLod —, nenhum dFdx/dFdy/fwidth nas funções do DECL_F e, no COR_F,
//      só antes do 1º desvio (no topo). É a REGRA no texto; o comportamento se mede no navegador (teste-corpo-tela C11: o
//      SwiftShader do CI mostra uma parte do defeito — o ponto no canto da caixa, a linha pontilhada na manga e o decalque de
//      cima apagando o de baixo em quads — e o C11 compara o shader com a variante de derivada implícita).
//   P7 a borda das máscaras feita (item 63; tools/patrocinios/borda.mjs + refazer-bordas.mjs — sem a névoa, o desenho a ≥ 8
//      px da caixa do shader, encolhido pela `escala`): cada logo no registro `bordas` do índice e a `escala` de cada
//      decalque = a do registro (ausente quando 1), entre 0,7 e 1 (o logo não perde mais de 30% da resolução). A máscara em
//      si (margem, névoa, nada fora da caixa) se mede no navegador: teste-corpo-tela C10.
// Na versão sem os patrocínios reprova (P1: o índice não existe); na base do item 63 (7cb052ad) reprovam o P6 e o P7.
//   node tools/teste-patrocinios.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto } from './lib/medidas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const arq = path.join(RAIZ, 'assets/tm/patrocinios.json');
if (!fs.existsSync(arq)) {
  reg('P1 índice dos patrocínios (assets/tm/patrocinios.json)', 'não existe', 'existe', false);
  console.log(tabelaTexto(linhas)); process.exit(1);
}
const idx = JSON.parse(fs.readFileSync(arq, 'utf8'));
const uniformes = JSON.parse(fs.readFileSync(path.join(RAIZ, 'assets/tm/uniformes.json'), 'utf8'));
const POS = new Set(['peito', 'ombro', 'manga', 'barra_frontal', 'acima_numero', 'abaixo_numero', 'calcao', 'fornecedor']);

// P1
const semCasa = Object.keys(uniformes.clubes).filter(c => !(idx.clubes?.[c]?.casa ?? []).some(d => d.pos === 'peito' || d.pos === 'fornecedor'));
reg('P1 cada clube das camisas reais tem os decalques de casa (peito ou fornecedor)', `${Object.keys(uniformes.clubes).length - semCasa.length}/${Object.keys(uniformes.clubes).length}${semCasa.length ? ' (sem: ' + semCasa.join(', ') + ')' : ''}`,
  'todos', semCasa.length === 0);

// P2 e P3
function webpTamanho(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const t = b.toString('ascii', 12, 16);
  if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (t === 'VP8X') return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
  return null;
}
const pasta = path.join(RAIZ, 'assets/tm/patrocinios');
const usados = new Set(), ruins = [];
let n = 0;
for (const [clube, kits] of Object.entries(idx.clubes ?? {})) for (const [k, lista] of Object.entries(kits)) for (const d of lista) {
  n++; usados.add(d.logo);
  const f = path.join(pasta, d.logo);
  const b = fs.existsSync(f) ? fs.readFileSync(f) : null, t = b && webpTamanho(b);
  if (!b || !t || t[0] !== 512 || t[1] !== 256 || b.length > 48 * 1024 || !POS.has(d.pos) || !/^#[0-9a-f]{6}$/i.test(d.cor ?? '') || !(d.asp > 0))
    ruins.push(`${clube}/${k}/${d.nome ?? d.logo}`);
}
reg('P2 cada decalque: logo WebP 512 × 256 ≤ 48 KB, posição, cor, proporção', `${n} decalques; ${ruins.length} ruins${ruins.length ? ' (ex.: ' + ruins[0] + ')' : ''}`, '0 ruins', n > 0 && ruins.length === 0);
const arquivos = fs.readdirSync(pasta, { recursive: true }).filter(f => String(f).endsWith('.webp')).map(f => String(f).split(path.sep).join('/'));
const sobrando = arquivos.filter(f => !usados.has(f));
const bytes = arquivos.reduce((s, f) => s + fs.statSync(path.join(pasta, f)).size, 0);
reg('P3 nenhum logo sobrando; a pasta ≤ 2 MB', `${sobrando.length} sobrando; ${(bytes / 1048576).toFixed(2).replace('.', ',')} MB em ${arquivos.length} logos`, '0; ≤ 2 MB', sobrando.length === 0 && bytes <= 2 * 1048576);

// P4
const ID = await import(pathToFileURL(path.join(RAIZ, 'js/identidade.js')).href);
const clube = Object.keys(uniformes.clubes)[0];
const com = ID.comCamisasReais({ name: clube, identidade: { pais: 'Brasil' } }, { ...uniformes, patrocinios: { ...idx, base: 'https://x/p/' } });
const sem = ID.comCamisasReais({ name: clube, identidade: { pais: 'Brasil' } }, uniformes);
const kh = com.kits?.home, okCom = Array.isArray(kh?.decais) && kh.decais.length > 0 && kh.decais.every(d => d.url?.startsWith('https://x/p/'));
const okSem = sem.kits?.home && !sem.kits.home.decais;
reg('P4 os decalques entram nos kits com a base e não entram sem ela', `${clube}: com a base ${kh?.decais?.length ?? 0} decalques na casa (URL ${okCom ? 'certa' : 'ERRADA'}); sem a base ${okSem ? 'nenhum' : 'TEM'}`,
  'com > 0; sem 0', okCom && okSem);

// P5: a máscara não é uma mancha (decodifica o WebP pela imagem do sharp? não: pelo Chromium não há em Node) — a cobertura
// vem do índice gerado (cheio), quando houver; senão fica de fora
let manchas = [];
const cheio = idx.cheio ?? null;
if (cheio) manchas = Object.entries(cheio).filter(([, v]) => v > 0.82).map(([k]) => k);
reg('P5 a máscara não é uma mancha (≤ 82% da caixa cheia)', cheio ? `${manchas.length} manchas${manchas.length ? ' (ex.: ' + manchas[0] + ')' : ''} em ${Object.keys(cheio).length}` : 'sem a medida no índice', '≤ 3', !!cheio && manchas.length <= 3);

// P7: a borda das máscaras feita (o registro e a escala de cada decalque)
{
  const bordas = idx.bordas ?? null;
  const erros = [];
  let nEsc = 0;
  for (const [clube, kits] of Object.entries(idx.clubes ?? {})) for (const [k, lista] of Object.entries(kits)) for (const d of lista) {
    const e = bordas?.[d.logo];
    if (e === undefined) { erros.push(`${clube}/${k}/${d.logo}: fora do registro`); continue; }
    if (!(e >= 0.7 && e <= 1)) erros.push(`${d.logo}: escala ${e}`);
    if ((d.escala ?? 1) !== e) erros.push(`${clube}/${k}/${d.logo}: escala ${d.escala} ≠ ${e}`);
    if (d.escala !== undefined) nEsc++;
  }
  reg('P7 a borda das máscaras feita: cada logo no registro, a escala do decalque = a dele (0,7–1)',
    bordas ? `${Object.keys(bordas).length} no registro; ${nEsc} decalques com escala; ${erros.length} erros${erros.length ? ' (ex.: ' + erros[0] + ')' : ''}` : 'sem o registro `bordas` no índice',
    'todos; 0 erros', !!bordas && erros.length === 0 && usados.size > 0 && [...usados].every(l => l in bordas));
}

// P6: o shader do corpo sem derivada implícita dentro de desvio
{
  const fonte = fs.readFileSync(path.join(RAIZ, 'js/render/humano3d.js'), 'utf8');
  const bloco = nome => (fonte.match(new RegExp('const ' + nome + ' = `([\\s\\S]*?)`;')) ?? [])[1] ?? null;
  const semComentario = t => t.replace(/\/\/[^\n]*/g, '');
  const decl = bloco('DECL_F'), cor = bloco('COR_F');
  if (!decl || !cor) reg('P6 o shader do corpo sem derivada implícita dentro de desvio', 'DECL_F/COR_F não achados em humano3d.js', 'achados', false);
  else {
    const d = semComentario(decl), c = semComentario(cor);
    const DER = /\b(dFdx|dFdy|fwidth)\s*\(/g, TEX = /\btexture\s*\(\s*(tLogos|tDigitos|tRostos|tCabeca)\b/g;
    const tex = [...(d + c).matchAll(TEX)].map(m => m[1]);
    const derDecl = [...d.matchAll(DER)].length;
    const i1 = c.search(/\bif\s*\(/);
    const derDesvio = [...c.matchAll(DER)].filter(m => i1 >= 0 && m.index > i1).length;
    reg('P6 o shader do corpo sem derivada implícita dentro de desvio (texture com mipmap; dFdx/dFdy/fwidth fora do topo)',
      `texture(): ${tex.length}${tex.length ? ' (' + tex.join(', ') + ')' : ''}; derivadas nas funções: ${derDecl}; no COR_F depois do 1º desvio: ${derDesvio}`,
      '0; 0; 0', tex.length === 0 && derDecl === 0 && derDesvio === 0);
  }
}

console.log(tabelaTexto(linhas));
process.exit(falhas ? 1 : 0);
