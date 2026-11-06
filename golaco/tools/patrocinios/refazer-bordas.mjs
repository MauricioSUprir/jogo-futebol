// Refaz a BORDA das máscaras de patrocínio já publicadas (assets/tm/patrocinios/, item 63): sem a névoa, nada fora da caixa
// do shader e o desenho a ≥ 8 px da borda dela (borda.mjs prepararMascara). Os logos de origem não estão no repositório
// (a pesquisa aponta para arquivos de fora), então o gerar.mjs não roda de novo: esta é a mesma conta nas máscaras que já
// existem. Grava as máscaras que mudam e a `escala` de cada decalque no índice (assets/tm/patrocinios.json; o jogo alarga
// a caixa por 1 ÷ escala e o logo fica do mesmo tamanho) e o registro `bordas` ({logo: escala}: a rampa da névoa não é
// idempotente — o logo já registrado não passa de novo). Rodar de novo não muda nada.
//   node tools/patrocinios/refazer-bordas.mjs [--conferir]   (--conferir: só mede, não grava)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrir } from '../lib/navegador.mjs';
import { prepararMascara, medirMascara, lerAlfa, webpDoAlfa, BORDA } from './borda.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CONFERIR = process.argv.includes('--conferir');
const arqIdx = path.join(RAIZ, 'assets/tm/patrocinios.json'), pasta = path.join(RAIZ, 'assets/tm/patrocinios');
const idx = JSON.parse(fs.readFileSync(arqIdx, 'utf8'));
// cada logo: a proporção (a mesma em todos os decalques dele: gerar.mjs) e a escala de antes
const logos = new Map();
for (const kits of Object.values(idx.clubes)) for (const lista of Object.values(kits)) for (const d of lista) {
  const l = logos.get(d.logo);
  if (l && (l.asp !== d.asp || (l.escala ?? 1) !== (d.escala ?? 1))) throw new Error(`${d.logo}: proporção/escala diferentes entre os decalques`);
  logos.set(d.logo, { asp: d.asp, escala: d.escala ?? 1 });
}
const feitas = idx.bordas ?? {};
const nav = await abrir({ largura: 600, altura: 400 });
const pg = nav.pagina;
let mudou = 0, bytes0 = 0, bytes1 = 0, perdas = 0;
const antes = { semMargem: 0, nevoa: 0, fora: 0 }, depois = { semMargem: 0, nevoa: 0, fora: 0 };
const conta = (o, m) => { if (m.margem !== null && m.margem < BORDA.margem) o.semMargem++; if (m.nevoa > 0.001) o.nevoa++; if (m.fora > 0) o.fora++; };
for (const [rel, l] of [...logos].sort()) {
  const f = path.join(pasta, rel), buf = fs.readFileSync(f);
  bytes0 += buf.length;
  const alfa = await lerAlfa(pg, 'data:image/webp;base64,' + buf.toString('base64'));
  conta(antes, medirMascara(alfa, l.asp));
  if (rel in feitas) { conta(depois, medirMascara(alfa, l.asp)); bytes1 += buf.length; continue; }
  const r = prepararMascara(alfa, l.asp);
  conta(depois, medirMascara(r.alfa, l.asp));
  let igual = r.escala === 1;
  if (igual) for (let i = 0; i < alfa.length; i++) if (alfa[i] !== r.alfa[i]) { igual = false; break; }
  l.escalaNova = Math.round(l.escala * r.escala * 1e4) / 1e4;
  if (igual) { bytes1 += buf.length; continue; }
  mudou++;
  const webp = await webpDoAlfa(pg, r.alfa);
  // o alfa do WebP tem de voltar igual (sem perda)
  const volta = await lerAlfa(pg, 'data:image/webp;base64,' + webp.toString('base64'));
  for (let i = 0; i < volta.length; i++) if (volta[i] !== r.alfa[i]) { perdas++; console.warn(`${rel}: o alfa do WebP não voltou igual`); break; }
  bytes1 += webp.length;
  if (!CONFERIR) fs.writeFileSync(f, webp);
}
await nav.navegador.close();
if (!CONFERIR) {
  for (const kits of Object.values(idx.clubes)) for (const lista of Object.values(kits)) for (const d of lista) {
    const e = logos.get(d.logo).escalaNova;
    if (e === undefined) continue;
    if (e < 1) d.escala = e; else delete d.escala;
  }
  // o registro das máscaras com a borda feita (em ordem; a escala de cada uma)
  for (const [rel, l] of logos) if (l.escalaNova !== undefined) feitas[rel] = l.escalaNova;
  idx.bordas = Object.fromEntries(Object.entries(feitas).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.writeFileSync(arqIdx, JSON.stringify(idx) + '\n');
}
const kb = b => `${(b / 1024).toFixed(0)} KB`;
console.log(`${logos.size} máscaras; ${mudou} ${CONFERIR ? 'mudariam' : 'refeitas'} (${kb(bytes0)} → ${kb(bytes1)}); alfa com perda: ${perdas}`);
console.log(`antes:  margem < ${BORDA.margem} px ${antes.semMargem}, névoa > 0,1% ${antes.nevoa}, alfa fora da caixa ${antes.fora}`);
console.log(`depois: margem < ${BORDA.margem} px ${depois.semMargem}, névoa > 0,1% ${depois.nevoa}, alfa fora da caixa ${depois.fora}`);
process.exit(perdas ? 1 : 0);
