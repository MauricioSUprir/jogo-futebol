// Captura de tela de uma página do app (para conferir o visual). Faz login pela própria tela /entrar.
// Uso: node scripts/print.mjs --url /painel --saida /tmp/x.png [--email a@b --senha S] [--largura 390] [--escuro] [--pagina-inteira]
//      sem --email: usa a 1ª pessoa do .demo.json (node scripts/semente-demo.mjs). --anonimo: sem login.
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require("playwright"); } catch { playwright = require("/opt/node-tools/node_modules/playwright"); }

const args = process.argv.slice(2);
const arg = (n, padrao) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : padrao; };
const tem = (n) => args.includes(`--${n}`);
const base = arg("base", "http://127.0.0.1:3100");
const url = arg("url", "/");
const saida = arg("saida", "/tmp/print.png");
const largura = Number(arg("largura", "1280"));
const altura = Number(arg("altura", largura < 600 ? "844" : "860"));
let email = arg("email");
let senha = arg("senha");
const arquivoDemo = arg("demo") ?? new URL("../.demo.json", import.meta.url);
if (!email && !tem("anonimo") && existsSync(arquivoDemo)) {
  const demo = JSON.parse(readFileSync(arquivoDemo, "utf8"));
  const quem = Number(arg("pessoa", "0"));
  email = demo.pessoas[quem].email;
  senha = demo.senha;
}

const navegador = await playwright.chromium.launch();
const ctx = await navegador.newContext({
  viewport: { width: largura, height: altura },
  deviceScaleFactor: 1,
  colorScheme: tem("escuro") ? "dark" : "light",
  reducedMotion: tem("movimento") ? "no-preference" : "reduce",
  locale: "pt-BR",
  timezoneId: "America/Sao_Paulo",
});
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error") erros.push(`console: ${m.text()}`); });
if (email && !tem("anonimo")) {
  await page.goto(`${base}/entrar`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="senha"]', senha);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60000 }), page.click('button[type="submit"]')]);
}
await page.goto(`${base}${url}`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForTimeout(Number(arg("espera", "800")));
await page.screenshot({ path: saida, fullPage: tem("pagina-inteira") });
console.log(JSON.stringify({ saida, url: page.url(), erros }, null, 1));
await navegador.close();
