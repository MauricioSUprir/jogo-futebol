// Rostos REAIS (Etapa 5.2, a versão de teste da edição pro do Total Match): o que vai para o site em
// assets/rostos-reais/ (gerado por tools/rostos-reais/processar_liga.py a partir da foto livre mais recente e neutra de
// cada jogador — tools/rostos-reais/fotos_html.py).
//   R1 índice: cada chave "<liga>-<clube>__<jogador>" tem nome, pele '#rrggbb' e a foto (título, data, licença, página);
//   R2 cada chave tem a textura <liga>/<chave>.webp, WebP de 512 × 512, ≤ 64 KB; nenhuma textura sobrando sem chave;
//   R3 a licença de toda foto é LIVRE (CC0, CC BY, CC BY-SA, domínio público) e os créditos (CREDITOS-<liga>.md) citam
//      cada chave com o autor, a licença e a página (a textura é obra derivada da foto);
//   R4 a chave é a foto do jogador no TM (legacy-total-match/assets/jogadores/<chave>.jpg): é por ela que o jogo acha o
//      rosto (main.js ligarRostosReais);
//   R5 a pele de cada um é um tom de pele (L* 20–80, matiz 30–75°) — a foto escura, de flash ou de luz verde não passa;
//   R6 o tamanho da pasta da liga ≤ 8 MB (baixado só na edição pro, só os rostos de quem está em campo);
//   R7 a foto é de frente e neutra (|yaw| ≤ 22°, pitch −13…16°, sorriso ≤ 0,65, boca ≤ 0,15, bico ≤ 0,45, olhos abertos).
// Na versão sem os rostos reais reprova (R1: o índice não existe).
//   node tools/teste-rostos-reais.mjs [--liga br]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tabelaTexto } from './lib/medidas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const LIGA = args.includes('--liga') ? args[args.indexOf('--liga') + 1] : 'br';
const PASTA = path.join(RAIZ, 'assets/rostos-reais');
const FOTOS_TM = path.join(RAIZ, '../legacy-total-match/assets/jogadores');
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const arqIndice = path.join(PASTA, LIGA + '.json');
if (!fs.existsSync(arqIndice)) {
  reg(`R1 índice dos rostos reais (assets/rostos-reais/${LIGA}.json)`, 'não existe', 'existe', false);
  console.log(tabelaTexto(linhas)); process.exit(1);
}
const indice = JSON.parse(fs.readFileSync(arqIndice, 'utf8'));
const chaves = Object.keys(indice);

// R1
const ruinsR1 = chaves.filter(k => {
  const v = indice[k];
  return !new RegExp(`^${LIGA}-[a-z0-9-]+__[a-z0-9-]+$`).test(k) || !v.nome || !/^#[0-9a-f]{6}$/i.test(v.pele ?? '') ||
    !v.foto?.titulo || !Array.isArray(v.foto?.data) || !v.foto?.licenca || !/^https:\/\/commons\.wikimedia\.org\//.test(v.foto?.pagina ?? '');
});
reg('R1 índice: chave, nome, pele e a foto (título, data, licença, página) de cada um', `${chaves.length} rostos; ${ruinsR1.length} incompletos${ruinsR1.length ? ' (ex.: ' + ruinsR1[0] + ')' : ''}`,
  '≥ 1; 0 incompletos', chaves.length >= 1 && ruinsR1.length === 0);

// R2: dimensões do WebP pelo cabeçalho (VP8 / VP8L / VP8X)
function webpTamanho(b) {
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const t = b.toString('ascii', 12, 16);
  if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (t === 'VP8X') return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))];
  return null;
}
const pastaLiga = path.join(PASTA, LIGA);
const arquivos = fs.existsSync(pastaLiga) ? fs.readdirSync(pastaLiga).filter(f => f.endsWith('.webp')) : [];
let ruinsR2 = [], maior = 0, total = 0;
for (const k of chaves) {
  const f = path.join(pastaLiga, k + '.webp');
  if (!fs.existsSync(f)) { ruinsR2.push(k + ' (falta)'); continue; }
  const b = fs.readFileSync(f); total += b.length; maior = Math.max(maior, b.length);
  const d = webpTamanho(b);
  if (!d || d[0] !== 512 || d[1] !== 512 || b.length > 64 * 1024) ruinsR2.push(`${k} (${d ? d.join('×') : 'não é WebP'}, ${Math.round(b.length / 1024)} KB)`);
}
const sobrando = arquivos.filter(f => !indice[f.slice(0, -5)]);
reg('R2 textura de cada rosto: WebP 512 × 512, ≤ 64 KB; nenhuma sobrando', `${ruinsR2.length} ruins${ruinsR2.length ? ' (ex.: ' + ruinsR2[0] + ')' : ''}; maior ${Math.round(maior / 1024)} KB; ${sobrando.length} sobrando`,
  '0; 0', ruinsR2.length === 0 && sobrando.length === 0);

// R3
const LIVRE = /^(cc0|cc[ -]by(-sa)?( \d\.\d)?( [a-z]{2,3})?|public domain|pd.*|attribution.*|fal)$/i;
const naoLivres = chaves.filter(k => !LIVRE.test(String(indice[k].foto?.licenca ?? '').trim()));
const arqCred = path.join(PASTA, `CREDITOS-${LIGA}.md`);
const cred = fs.existsSync(arqCred) ? fs.readFileSync(arqCred, 'utf8') : '';
const semCredito = chaves.filter(k => { const l = cred.split('\n').find(x => x.includes('`' + k + '`')); return !l || !l.includes(indice[k].foto.licenca) || !l.includes(indice[k].foto.pagina); });
reg('R3 licença livre e créditos (autor, licença, página) de cada foto', `${naoLivres.length} não livres${naoLivres.length ? ' (ex.: ' + naoLivres[0] + ': ' + indice[naoLivres[0]].foto?.licenca + ')' : ''}; ${semCredito.length} sem crédito`,
  '0; 0', naoLivres.length === 0 && semCredito.length === 0 && cred.length > 0);

// R4
const semFotoTM = fs.existsSync(FOTOS_TM) ? chaves.filter(k => !fs.existsSync(path.join(FOTOS_TM, k + '.jpg'))) : null;
reg('R4 a chave é a foto do jogador no TM (é por ela que o jogo acha o rosto)', semFotoTM == null ? 'pasta do TM não encontrada' : `${semFotoTM.length} sem foto no TM${semFotoTM.length ? ' (ex.: ' + semFotoTM[0] + ')' : ''}`,
  '0', semFotoTM != null && semFotoTM.length === 0);

// R5: L* e matiz da pele (sRGB → Lab D65)
function lab(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  const X = (0.4124 * c[0] + 0.3576 * c[1] + 0.1805 * c[2]) / 0.95047, Y = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], Z = (0.0193 * c[0] + 0.1192 * c[1] + 0.9505 * c[2]) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const foraDaPele = chaves.filter(k => { const [L, a, b] = lab(indice[k].pele); const h = Math.atan2(b, a) * 180 / Math.PI; return L < 20 || L > 80 || h < 30 || h > 75; });
reg('R5 a pele de cada um é um tom de pele (L* 20–80, matiz 30–75°)', `${foraDaPele.length} fora${foraDaPele.length ? ' (ex.: ' + foraDaPele[0] + ' ' + indice[foraDaPele[0]].pele + ')' : ''}`, '0', foraDaPele.length === 0);

// R7: a foto é de frente e com o rosto neutro (o rosto vira a pele da cabeça: a expressão fica para sempre)
const naoNeutra = chaves.filter(k => {
  const a = indice[k].foto?.av;
  return !a || a.sorriso == null || Math.abs(a.yaw) > 22 || a.pitch < -13 || a.pitch > 16 || Math.abs(a.roll ?? 0) > 15 || a.sorriso > 0.65 || a.boca > 0.15 || a.bico > 0.45 || a.piscada >= 0.5;
});
reg('R7 foto de frente e com o rosto neutro (sem sorriso aberto, boca aberta, bico, olho fechado)', `${naoNeutra.length} fora${naoNeutra.length ? ' (ex.: ' + naoNeutra[0] + ')' : ''}`, '0', naoNeutra.length === 0);

// R6
reg('R6 tamanho da pasta da liga', `${(total / 1048576).toFixed(2).replace('.', ',')} MB em ${arquivos.length} texturas`, '≤ 8 MB', total <= 8 * 1048576);

// informativo: a idade das fotos
const anos = chaves.map(k => indice[k].foto.data?.[0]).filter(Boolean);
const recentes = anos.filter(a => a >= 2024).length;
console.log(`teste-rostos-reais (${LIGA}): ${chaves.length} rostos; fotos de 2024 em diante: ${recentes} (${Math.round(100 * recentes / Math.max(1, anos.length))}%), mediana ${[...anos].sort((a, b) => a - b)[anos.length >> 1] ?? '-'}`);
console.log(tabelaTexto(linhas));
process.exit(falhas ? 1 : 0);
