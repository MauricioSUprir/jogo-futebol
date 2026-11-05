/* ===== tools/bundle.mjs — gera o StudyLab em UM arquivo HTML =====
   Uso: node studylab/tools/bundle.mjs [saida.html]

   O app normal usa módulos ES separados (melhor para editar). Algumas hospedagens
   — como os Artifacts do Claude — só aceitam uma página autocontida. Este script
   junta CSS + todos os módulos em um único HTML, resolvendo os imports na mão:
   cada módulo vira uma função registrada em __M e os `import` viram desestruturação. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAIDA = process.argv[2] || path.join(RAIZ, 'studylab-single.html');

const ler = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');
const chave = (p) => path.normalize(p).replace(/\\/g, '/');

/* ---------- lê um módulo e devolve seus imports resolvidos ---------- */
const RE_IMPORT = /import\s+(?:\*\s+as\s+([\w$]+)|\{([\s\S]*?)\})\s+from\s+['"]([^'"]+)['"];?/g;
const modulos = new Map();

function carregar(rel) {
  const k = chave(rel);
  if (modulos.has(k)) return modulos.get(k);
  const src = ler(k);
  const deps = [];
  let corpo = src.replace(RE_IMPORT, (_, ns, nomes, spec) => {
    const alvo = chave(path.join(path.dirname(k), spec));
    deps.push(alvo);
    if (ns) return `const ${ns} = __M[${JSON.stringify(alvo)}];`;
    const lista = nomes.split(',').map((n) => n.trim()).filter(Boolean)
      .map((n) => n.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${lista} } = __M[${JSON.stringify(alvo)}];`;
  });

  const exports = [];
  corpo = corpo.replace(/^export\s+(async\s+)?function\s+([\w$]+)/gm, (_, a, nome) => {
    exports.push(nome); return `${a || ''}function ${nome}`;
  }).replace(/^export\s+(const|let)\s+([\w$]+)/gm, (_, tipo, nome) => {
    exports.push(nome); return `${tipo} ${nome}`;
  });
  if (/^export\s/m.test(corpo)) throw new Error(`Forma de export não suportada em ${k}`);

  const mod = { k, deps, corpo, exports };
  modulos.set(k, mod);
  for (const d of deps) carregar(d);
  return mod;
}

/* ---------- ordem topológica (dependência antes de quem depende) ---------- */
function ordenar(entrada) {
  const visto = new Set(), pilha = new Set(), saida = [];
  (function visitar(k) {
    if (visto.has(k)) return;
    if (pilha.has(k)) throw new Error(`Import circular envolvendo ${k}`);
    pilha.add(k);
    for (const d of modulos.get(k).deps) visitar(d);
    pilha.delete(k); visto.add(k); saida.push(k);
  })(chave(entrada));
  return saida;
}

carregar('js/app.js');
// no arquivo único não existe ./sw.js para registrar
modulos.get('js/app.js').corpo = modulos.get('js/app.js').corpo.replace(
  /if \('serviceWorker' in navigator[\s\S]*?\n  \}/,
  '/* service worker removido no build de arquivo único */',
);
const ordem = ordenar('js/app.js');

const bundle = [
  '/* StudyLab — build de arquivo único, gerado por tools/bundle.mjs */',
  'const __M = {};',
  ...ordem.map((k) => {
    const m = modulos.get(k);
    return `__M[${JSON.stringify(k)}] = (() => {\n${m.corpo}\nreturn { ${m.exports.join(', ')} };\n})();`;
  }),
].join('\n\n');

/* ---------- monta o HTML ---------- */
let html = ler('index.html');
const css = ler('css/app.css');

html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, '')
  .replace(/\s*<link rel="icon"[^>]*>/, '')
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
  // ATENÇÃO: replacer em função — como string, "$$" do código viraria "$".
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="module"[^>]*><\/script>/, () => `<script type="module">\n${bundle}\n</script>`);

/* --artifact: só o conteúdo, sem <html>/<head>/<body>.
   Alguns hosts (Artifacts do Claude) já envolvem a página no próprio esqueleto. */
if (process.argv.includes('--artifact')) {
  const titulo = html.match(/<title>[\s\S]*?<\/title>/)[0];
  const estilo = html.match(/<style>[\s\S]*?<\/style>/)[0];
  const corpo = html.match(/<body[^>]*>([\s\S]*)<\/body>/)[1];
  html = `${titulo}\n${estilo}\n${corpo.trim()}\n`;
}

fs.writeFileSync(SAIDA, html);
console.log(`✔ ${SAIDA}`);
console.log(`  ${ordem.length} módulos · ${(html.length / 1024).toFixed(0)} KB`);
