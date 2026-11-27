// Utilitários do teste de ponta a ponta (Playwright + Supabase local).
import { createRequire } from "node:module";
import { readFileSync, existsSync, mkdirSync } from "node:fs";

const require = createRequire(import.meta.url);
function carregar(nome, reserva) {
  try {
    return require(nome);
  } catch {
    return require(reserva);
  }
}
export const playwright = carregar("playwright", "/opt/node-tools/node_modules/playwright");
let axe = null;
try {
  axe = require("@axe-core/playwright");
} catch {
  try {
    axe = require("/opt/node-tools/node_modules/@axe-core/playwright");
  } catch {
    axe = null;
  }
}

export const env = {};
const arq = new URL("../../.env.local", import.meta.url);
if (existsSync(arq)) {
  for (const l of readFileSync(arq, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(l.trim());
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
  }
}
for (const k of Object.keys(process.env)) if (k.startsWith("NEXT_PUBLIC_") || k.startsWith("SUPABASE_")) env[k] = process.env[k];

export const BASE = process.env.E2E_BASE ?? "http://127.0.0.1:3100";
export const SAIDA = new URL("./saida/", import.meta.url).pathname;
mkdirSync(SAIDA, { recursive: true });

const { createClient } = carregar("@supabase/supabase-js", new URL("../../node_modules/@supabase/supabase-js", import.meta.url).pathname);
export const sbAdmin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let n = 0;
export async function criarPessoa(nome) {
  const email = `e2e.${nome.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.${Date.now()}.${n++}@teste.local`;
  const senha = "Senha-e2e-2026";
  const { data, error } = await sbAdmin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { display_name: nome } });
  if (error) throw error;
  return { id: data.user.id, email, senha, nome };
}

let falhas = 0;
let passos = 0;
export function verificar(condicao, descricao) {
  passos++;
  if (condicao) console.log(`  ok  ${descricao}`);
  else {
    falhas++;
    console.log(`  FALHOU  ${descricao}`);
  }
}
export function resumo() {
  console.log(`\n${passos - falhas}/${passos} verificações passaram`);
  return falhas;
}

export async function novoContexto(navegador, { celular = false, escuro = false } = {}) {
  return navegador.newContext({
    viewport: celular ? { width: 390, height: 844 } : { width: 1280, height: 860 },
    deviceScaleFactor: 1,
    isMobile: celular,
    hasTouch: celular,
    colorScheme: escuro ? "dark" : "light",
    reducedMotion: "reduce",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  });
}

/** Erros de página/console (falha o teste se aparecerem em telas do app). */
export function vigiarErros(page, lista) {
  page.on("pageerror", (e) => lista.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/favicon|Failed to load resource: the server responded with a status of 40[134]/.test(m.text())) lista.push(`console: ${m.text()}`);
  });
}

export async function entrar(page, pessoa) {
  await page.goto(`${BASE}/entrar`);
  await page.fill('input[name="email"]', pessoa.email);
  await page.fill('input[name="senha"]', pessoa.senha);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/entrar"), { timeout: 60000 }), page.click('button[type="submit"]')]);
}

/** Acessibilidade com axe (WCAG 2 A/AA). Devolve as violações sérias/críticas. */
export async function acessibilidade(page, nome) {
  if (!axe) return { pulado: true, violacoes: [] };
  const AxeBuilder = axe.default ?? axe.AxeBuilder ?? axe;
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const graves = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (graves.length) {
    console.log(`  [axe] ${nome}:`);
    for (const v of graves) console.log(`     - ${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((x) => x.target.join(" ")).join(" | ")}`);
  }
  return { pulado: false, violacoes: graves };
}

export async function semRolagemHorizontal(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}
