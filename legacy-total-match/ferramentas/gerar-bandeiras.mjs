// Bandeiras das seleções para as cartas (assets/bandeiras/<nação>.png, 96x72).
// Fonte: flag-icons 7.5.0 (MIT, Panayiotis Lipiridis) — baixa o SVG de cada país pelo
// jsDelivr (curl, respeita o proxy), desenha no Chromium e reduz as cores com o PIL.
//   node ferramentas/gerar-bandeiras.mjs   (precisa do Playwright e do python3 com PIL)
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import pkg from '/opt/node22/lib/node_modules/playwright/index.js';
const { chromium } = pkg;
const RAIZ = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const SAIDA = path.join(RAIZ, 'assets', 'bandeiras');
// chave da nação no jogo (inglês) -> código do flag-icons
const ISO = {"Brazil": "br", "Argentina": "ar", "France": "fr", "England": "gb-eng", "Spain": "es", "Germany": "de", "Portugal": "pt", "Netherlands": "nl", "Italy": "it", "Belgium": "be", "Croatia": "hr", "Uruguay": "uy", "Mexico": "mx", "USA": "us", "Colombia": "co", "Japan": "jp", "South Korea": "kr", "Senegal": "sn", "Morocco": "ma", "Nigeria": "ng", "Ghana": "gh", "Cameroon": "cm", "Ivory Coast": "ci", "Egypt": "eg", "Switzerland": "ch", "Denmark": "dk", "Poland": "pl", "Sweden": "se", "Austria": "at", "Serbia": "rs", "Ecuador": "ec", "Peru": "pe", "Chile": "cl", "Paraguay": "py", "Canada": "ca", "Australia": "au", "Saudi Arabia": "sa", "Qatar": "qa", "Iran": "ir", "Norway": "no", "Scotland": "gb-sct", "Turkey": "tr", "Ukraine": "ua", "Wales": "gb-wls", "Bosnia": "ba", "Cape Verde": "cv", "Tunisia": "tn", "Algeria": "dz", "Greece": "gr", "Czech Republic": "cz", "Hungary": "hu", "Romania": "ro", "Ireland": "ie", "Venezuela": "ve", "Costa Rica": "cr", "South Africa": "za", "DR Congo": "cd", "Jamaica": "jm", "Georgia": "ge", "Armenia": "am", "Russia": "ru", "Slovenia": "si", "Slovakia": "sk", "Finland": "fi", "Iceland": "is", "Albania": "al", "Kosovo": "xk", "North Macedonia": "mk", "Montenegro": "me", "Israel": "il", "Angola": "ao", "Mali": "ml", "Guinea": "gn", "Burkina Faso": "bf", "Zambia": "zm", "Gabon": "ga", "Congo": "cg", "Guinea-Bissau": "gw", "Mozambique": "mz", "Bolivia": "bo", "Honduras": "hn", "Panama": "pa", "Guatemala": "gt", "El Salvador": "sv", "Azerbaijan": "az", "Kazakhstan": "kz", "Uzbekistan": "uz", "Northern Ireland": "gb-nir", "Curaçao": "cw", "Suriname": "sr", "Equatorial Guinea": "gq", "Togo": "tg", "Benin": "bj", "Kenya": "ke", "Uganda": "ug", "Comoros": "km", "Madagascar": "mg", "New Zealand": "nz", "China": "cn", "Belarus": "by", "Moldova": "md", "Bulgaria": "bg", "Lithuania": "lt", "Luxembourg": "lu", "The Gambia": "gm", "Sierra Leone": "sl", "Burundi": "bi", "Mauritania": "mr", "Jordan": "jo"};
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bandeiras-'));
fs.mkdirSync(SAIDA, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 96, height: 72 } });
for (const [nome, cod] of Object.entries(ISO)) {
  const svg = path.join(tmp, cod + '.svg');
  if (!fs.existsSync(svg)) execFileSync('curl', ['-sS', '--max-time', '20', '-o', svg, 'https://cdn.jsdelivr.net/npm/flag-icons@7.5.0/flags/4x3/' + cod + '.svg']);
  const uri = 'data:image/svg+xml;base64,' + fs.readFileSync(svg).toString('base64');
  await p.setContent('<body style="margin:0"><img src="' + uri + '" style="width:96px;height:72px;display:block"></body>');
  await p.waitForFunction(() => document.images[0] && document.images[0].complete);
  await p.screenshot({ path: path.join(SAIDA, slug(nome) + '.png'), clip: { x: 0, y: 0, width: 96, height: 72 } });
}
await b.close();
// menos cores = arquivo pequeno (96 cores bastam para bandeira)
execFileSync('python3', ['-c', 'import sys,os\nfrom PIL import Image\nd=sys.argv[1]\nfor n in os.listdir(d):\n  f=os.path.join(d,n)\n  if n.endswith(".png"): Image.open(f).convert("RGB").quantize(colors=96,method=Image.MEDIANCUT).save(f,"PNG",optimize=True)', SAIDA]);
console.log('bandeiras:', Object.keys(ISO).length);
