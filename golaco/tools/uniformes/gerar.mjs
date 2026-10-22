// Camisas REAIS da temporada (edição pro do Total Match): a pesquisa de cada clube (tools/uniformes/pesquisa/<clube>.json,
// formato em pesquisa/FORMATO.md — cores estimadas pelas fotos oficiais e de loja, com as fontes) vira a base que a página
// carrega (assets/tm/uniformes.json), já no formato dos uniformes do desenho (render/jogador3d.js KITS + os campos do
// corpo humano). Nada de patrocinador nem de marca de fornecedor: só cores e o desenho.
//   padrão: listras_verticais → stripes, listras_horizontais → hoops, faixa_diagonal → sash, faixa_horizontal_peito →
//   band, metades → halves; liso, grafismo (tom sobre tom), degradê e xadrez → plain (a cor de fundo)
//   node tools/uniformes/gerar.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const SAIDA = path.resolve(AQUI, '../../assets/tm/uniformes.json');
const PADRAO = { listras_verticais: 'stripes', listras_horizontais: 'hoops', faixa_diagonal: 'sash', faixa_horizontal_peito: 'band', metades: 'halves' };
const hex = v => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
const lum = h => { const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const dif = (a, b) => { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

function kit(u, goleiro = false) {
  if (!u || !hex(u.camisa)) return null;
  const camisa = hex(u.camisa);
  const padrao = PADRAO[u.padrao] ?? 'plain';
  const segunda = hex(u.padrao_cores?.[0]) ?? camisa;
  const gola = hex(u.gola?.cor) ?? camisa;
  const punho = hex(u.punhos) ?? gola;
  // o detalhe (luva, mancha da identidade): a gola se ela se destaca; senão a 2ª cor; senão o contraste
  const contraste = lum(camisa) > 0.3 ? '#15191b' : '#f2f4f5';
  const acento = dif(gola, camisa) > 40 ? gola : dif(segunda, camisa) > 40 ? segunda : contraste;
  const meiao = hex(u.meiao) ?? camisa;
  const k = {
    real: true, nome: u.nome ?? null,
    camisa, segunda, padrao, manga: hex(u.mangas) ?? camisa, gola, punho,
    acabamento: hex(u.ombros) ?? hex(u.laterais) ?? camisa,
    calcao: hex(u.calcao) ?? contraste, barra: hex(u.calcao_detalhe) ?? hex(u.calcao) ?? contraste,
    meiao, meiaoDetalhe: hex(u.meiao_detalhe),
    chuteira: lum(meiao) < 0.02 ? '#e9ecee' : '#15191b', sola: '#0b0d0e',
    acento, luva: goleiro ? (lum(camisa) > 0.5 ? '#15191b' : '#e9ecee') : acento,
    numero: hex(u.numero_cor) ?? contraste,
  };
  if (padrao !== 'plain') { if (Number.isFinite(u.padrao_n) && u.padrao_n > 0) k.padraoN = u.padrao_n; if (Number.isFinite(u.padrao_largura) && u.padrao_largura > 0) k.padraoLargura = u.padrao_largura; }
  if (u.mangas_padrao === 'igual_tronco' && padrao !== 'plain') k.mangaPadrao = true;
  return k;
}

const clubes = {};
const PASTA = path.join(AQUI, 'pesquisa');
for (const f of fs.readdirSync(PASTA).filter(f => f.endsWith('.json')).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(PASTA, f), 'utf8'));
  const [liga, nome] = String(d.chave).split('/');
  const fontes = [...new Set(['casa', 'fora', 'terceira', 'goleiro', 'goleiro2'].flatMap(k => d[k]?.fontes ?? []))];
  clubes[nome ?? d.clube] = {
    liga, chave: d.chave, temporada: d.temporada, confianca: d.confianca ?? null,
    home: kit(d.casa), away: kit(d.fora), third: kit(d.terceira), gk: kit(d.goleiro, true), gkAway: kit(d.goleiro2, true),
    fontes: fontes.length,
  };
}
const saida = {
  descricao: 'Camisas reais da temporada (edição pro do Total Match): cores e desenho, sem patrocinador nem marca. Gerado por golaco/tools/uniformes/gerar.mjs a partir de tools/uniformes/pesquisa/.',
  clubes,
};
fs.writeFileSync(SAIDA, JSON.stringify(saida) + '\n');
console.log(`${Object.keys(clubes).length} clubes → ${path.relative(process.cwd(), SAIDA)} (${fs.statSync(SAIDA).size} bytes)`);
