// Teste de ponta a ponta do LIFE OS no Chromium, contra o build de produção e um banco zerado.
// Uso: npm run build && node tests/e2e/fluxo.mjs
//   E2E_DATABASE_URL (padrão: postgresql://postgres@127.0.0.1:5544/lifeos_e2e) — o banco é APAGADO e recriado.
//   E2E_PORTA (padrão 3100) — porta do servidor de teste.
//   E2E_MODULOS=treinos,sono — roda só esses testes de módulo (tests/e2e/modulos/*.mjs); vazio = todos.
//   --sem-servidor --url http://localhost:3100   usa um servidor já rodando
//
// Testes dos módulos da Fase 2: cada arquivo de tests/e2e/modulos/ exporta
//   export const nome = "Fitness Center";
//   export const rotasCelular = ["/treinos"];              // conferidas no iPhone (sem rolagem lateral)
//   export async function testar({ pagina, BASE, confere, enviar, visivel, saida, path }) { … }
// e roda logado, depois da agenda, na ordem do nome do arquivo.
import { createRequire } from "node:module";
import { spawn, execSync } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const pg = require("pg");

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const saida = path.join(raiz, "tests/e2e/saida");
const args = process.argv.slice(2);
const PORTA = process.env.E2E_PORTA ?? "3100";
const BASE = args.includes("--url") ? args[args.indexOf("--url") + 1] : `http://127.0.0.1:${PORTA}`;
const DB = process.env.E2E_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5544/lifeos_e2e";
const TOKEN = process.env.E2E_TOKEN ?? "token-de-teste-" + randomBytes(4).toString("hex");
const SENHA = "Senha-forte-2026";

let falhas = 0;
let total = 0;
function confere(cond, msg) {
  total++;
  if (cond) console.log("  ok  " + msg);
  else {
    falhas++;
    console.log("  FALHOU  " + msg);
  }
}

// TOTP (RFC 6238) independente do código do app.
function totp(segredoB32, t = Date.now()) {
  const alfa = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, val = 0;
  const bytes = [];
  for (const c of segredoB32.replace(/=+$/, "")) {
    val = (val << 5) | alfa.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      bytes.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const mac = createHmac("sha1", Buffer.from(bytes)).update(msg).digest();
  const o = mac[19] & 15;
  return String((((mac[o] & 127) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3]) % 1e6).padStart(6, "0");
}

async function zerarBanco() {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  await c.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await c.end();
  execSync("npx prisma migrate deploy", { cwd: raiz, env: { ...process.env, DATABASE_URL: DB }, stdio: "pipe" });
}

async function subirServidor() {
  try {
    await fetch(BASE + "/api/saude");
    throw new Error(`Já existe um servidor em ${BASE}: pare-o ou use --sem-servidor.`);
  } catch (e) {
    if (String(e.message).startsWith("Já existe")) throw e;
  }
  const env = {
    ...process.env,
    NODE_ENV: "production",
    DATABASE_URL: DB,
    LIFEOS_SETUP_TOKEN: TOKEN,
    LIFEOS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    LIFEOS_COOKIE_SECURE: "0",
    LIFEOS_TRUST_PROXY: "0",
    PORT: PORTA,
  };
  // O mesmo servidor do Docker (output standalone).
  const p = spawn(process.execPath, [".next/standalone/server.js"], { cwd: raiz, env: { ...env, HOSTNAME: "127.0.0.1" }, stdio: ["ignore", "pipe", "pipe"] });
  let log = "";
  p.stdout.on("data", (d) => (log += d));
  p.stderr.on("data", (d) => (log += d));
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + "/api/saude");
      if (r.ok) return { p, log: () => log };
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  console.log(log);
  throw new Error("servidor não subiu");
}

async function semRolagemLateral(pagina, nome) {
  // Mede contra a largura da tela do aparelho: se algo estoura, o navegador alarga a página (innerWidth cresce junto).
  const r = await pagina.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: Math.min(window.innerWidth, screen.width) }));
  confere(r.sw <= r.w + 1, `${nome}: sem rolagem lateral (${r.sw} ≤ ${r.w})`);
}

const visivel = (loc, timeout = 8000) => loc.first().waitFor({ state: "visible", timeout }).then(() => true, () => false);

async function carregarModulos() {
  const pasta = path.join(raiz, "tests/e2e/modulos");
  const filtro = (process.env.E2E_MODULOS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const arquivos = (await readdir(pasta).catch(() => [])).filter((a) => a.endsWith(".mjs")).sort();
  const mods = [];
  for (const a of arquivos) {
    if (filtro.length && !filtro.includes(a.replace(/\.mjs$/, ""))) continue;
    mods.push({ arquivo: a, ...(await import(pathToFileURL(path.join(pasta, a)).href)) });
  }
  return mods;
}

async function enviar(pagina, seletorBotao) {
  await Promise.all([pagina.waitForLoadState("networkidle"), pagina.locator(seletorBotao).first().click()]);
  await pagina.waitForTimeout(250);
}

async function main() {
  await mkdir(saida, { recursive: true });
  const modulos = await carregarModulos();
  let servidor = null;
  if (!args.includes("--sem-servidor")) {
    console.log("Zerando o banco de teste e subindo o servidor…");
    await zerarBanco();
    servidor = await subirServidor();
  }
  const nav = await chromium.launch();
  const erros = [];
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 860 }, locale: "pt-BR", timezoneId: "America/Sao_Paulo", acceptDownloads: true });
  const pg1 = await ctx.newPage();
  pg1.on("console", (m) => m.type() === "error" && erros.push(`[${pg1.url()}] ${m.text()}`));
  pg1.on("pageerror", (e) => erros.push(`[${pg1.url()}] ${e.message}`));

  try {
    console.log("\n1. Primeira configuração");
    await pg1.goto(BASE + "/");
    confere(pg1.url().endsWith("/configurar"), "sem conta, / leva a /configurar");
    const api = await fetch(BASE + "/api/exportar");
    confere(api.status === 401, "API sem sessão responde 401");
    await pg1.fill("#token", "errado");
    await pg1.fill("#nome", "Gui");
    await pg1.fill("#usuario", "gui");
    await pg1.fill("#senha", SENHA);
    await pg1.fill("#confirma", SENHA);
    await enviar(pg1, "button[type=submit]");
    confere(await pg1.getByText("Código de configuração incorreto.").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "código de configuração errado é recusado");
    await pg1.fill("#token", TOKEN);
    await pg1.fill("#senha", SENHA);
    await pg1.fill("#confirma", SENHA);
    await Promise.all([pg1.waitForURL(BASE + "/"), pg1.locator("button[type=submit]").click()]);
    confere(await pg1.getByRole("heading", { level: 1 }).innerText().then((t) => t.includes("Gui")), "entra na Central de Comando com o nome");
    await pg1.goto(BASE + "/configurar");
    confere(pg1.url().includes("/entrar") || pg1.url() === BASE + "/", "com conta criada, /configurar não abre mais");

    console.log("\n2. Hydro Track");
    await pg1.goto(BASE + "/");
    await enviar(pg1, 'form:has(input[name=tipo][value=copo]) button');
    confere(await pg1.locator("text=250 ml").first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "+250 ml no painel");
    await pg1.goto(BASE + "/agua");
    await enviar(pg1, 'form:has(input[name=tipo][value=garrafa]) button');
    confere(await pg1.locator("dd", { hasText: "750 ml" }).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "garrafa soma 500 ml (750 ml no total)");
    await pg1.getByRole("button", { name: "Personalizar" }).click();
    await pg1.fill("#b-ml", "300");
    await pg1.selectOption("#b-beb", "suco");
    await enviar(pg1, "dialog[open] button[type=submit]");
    confere(await pg1.getByText(/Outras bebidas hoje/).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "suco fica fora da meta (outras bebidas)");
    confere(await pg1.locator("dd", { hasText: "750 ml" }).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "suco não soma na água");
    await pg1.getByRole("button", { name: "Meta e copos" }).click();
    await pg1.fill("#c-meta", "2400");
    await enviar(pg1, "dialog[open] button[type=submit]");
    confere(await pg1.locator("dd", { hasText: "2,4 L" }).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "meta configurada para 2,4 L");
    await enviar(pg1, 'form:has(input[name=valor][value="1"]) button');
    confere(await pg1.getByRole("button", { name: "Dia de treino" }).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "marca dia de treino");
    const nRegs = await pg1.locator('button[aria-label^="Apagar registro"]').count();
    await enviar(pg1, 'button[aria-label^="Apagar registro"]');
    confere((await pg1.locator('button[aria-label^="Apagar registro"]').count()) === nRegs - 1, "apaga um registro");
    await pg1.screenshot({ path: path.join(saida, "pc-agua.png"), fullPage: true });

    console.log("\n3. Hábitos");
    await pg1.goto(BASE + "/habitos");
    await enviar(pg1, "button:has-text('Criar hábitos escolhidos')");
    confere((await pg1.locator("main li.painel").count()) === 6, "6 hábitos sugeridos criados");
    await enviar(pg1, 'button[aria-label=\'Marcar "Ler" como feito\']');
    confere(await pg1.locator('button[aria-label=\'Desmarcar "Ler"\']').waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "marca 'Ler' como feito");
    await pg1.getByRole("button", { name: "Novo hábito" }).click();
    await pg1.fill("#h-nome", "Treinar finalização");
    await pg1.getByRole("button", { name: "Dias da semana" }).click();
    await enviar(pg1, "dialog[open] button[type=submit]");
    confere(await pg1.getByText("Treinar finalização").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "cria hábito em dias da semana");
    await pg1.getByRole("link", { name: "Ler", exact: true }).click();
    await pg1.waitForURL(/\/habitos\/.+/);
    confere(await pg1.getByText("Conquistas").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "detalhe do hábito com conquistas");
    const ontem = await pg1.locator("form button[aria-label*='Alternar feito']").count();
    confere(ontem > 0, "calendário com dias para marcar");
    await pg1.screenshot({ path: path.join(saida, "pc-habito.png"), fullPage: true });

    console.log("\n4. Agenda, tarefas e planejamento");
    await pg1.goto(BASE + "/agenda");
    await pg1.getByRole("button", { name: "Evento" }).first().click();
    await pg1.fill("#ev-titulo", "Prova de Matemática");
    await pg1.selectOption("#ev-cat", "prova");
    const amanha = await pg1.evaluate(() => {
      const d = new Date(Date.now() + 86400000);
      return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
    });
    await pg1.fill("#ev-dia", amanha);
    await pg1.fill("#ev-ini", "08:00");
    await pg1.fill("#ev-fim", "10:00");
    await enviar(pg1, "dialog[open] button[type=submit]");
    confere(await pg1.getByText("Prova de Matemática").first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "evento criado aparece na semana");
    for (const [t, dur, pri] of [["Revisar frações", "50", "Alta"], ["Lista de exercícios", "45", "Média"], ["Organizar a mochila", "15", "Baixa"]]) {
      await pg1.getByRole("button", { name: "Tarefa" }).first().click();
      await pg1.fill("#tf-titulo", t);
      await pg1.fill("#tf-dur", dur);
      await pg1.locator("dialog[open]").getByRole("button", { name: pri }).click();
      await enviar(pg1, "dialog[open] button[type=submit]");
    }
    await pg1.goto(BASE + "/agenda?vista=tarefas");
    confere((await pg1.getByText("Sem horário (3)").count()) === 1, "3 tarefas sem horário");
    await pg1.fill('input[name=dia][type=date]', amanha);
    await enviar(pg1, "button:has-text('Planejar')");
    const propostas = await pg1.locator("input[name=item]").count();
    confere(propostas === 3, `planejador encaixou as 3 tarefas (${propostas})`);
    const horarios = await pg1.locator("input[name=item]").evaluateAll((els) => els.map((e) => e.value.split("@")[1]));
    confere(horarios.every((h) => h < "08:00" ? true : h >= "10:10"), `nada em cima da prova (8h–10h + folga): ${horarios.join(", ")}`);
    await enviar(pg1, "button:has-text('Aplicar plano')");
    confere(await pg1.getByText("Plano aplicado").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "plano aplicado");
    await pg1.goto(BASE + `/agenda?vista=dia&dia=${amanha}`);
    confere(await pg1.getByText("Revisar frações").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "tarefa planejada aparece no dia");
    await pg1.goto(BASE + "/agenda?vista=mes");
    confere(await pg1.getByText("Prova de Matemática").first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "visão do mês");
    await pg1.goto(BASE + "/agenda/foco");
    confere(await pg1.getByText("Modo foco").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "modo foco abre");
    await pg1.goto(BASE + "/");
    confere(await pg1.getByText("Prova de Matemática").first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "painel mostra a prova nos próximos 7 dias");
    await pg1.screenshot({ path: path.join(saida, "pc-painel.png"), fullPage: true });

    let n = 0;
    for (const m of modulos) {
      console.log(`\n4.${++n}. ${m.nome ?? m.arquivo}`);
      try {
        await m.testar({ pagina: pg1, BASE, confere, enviar, visivel, saida, path });
      } catch (e) {
        falhas++;
        console.error(`ERRO no teste de ${m.arquivo}:`, e);
        await pg1.screenshot({ path: path.join(saida, `erro-${m.arquivo}.png`), fullPage: true }).catch(() => {});
      }
    }

    console.log("\n5. Verificação em duas etapas");
    await pg1.goto(BASE + "/configuracoes/seguranca");
    await enviar(pg1, "button:has-text('Ligar verificação em duas etapas')");
    const segredo = (await pg1.getByTestId("segredo-totp").innerText()).trim();
    confere(/^[A-Z2-7]{32}$/.test(segredo), "segredo TOTP gerado");
    await pg1.fill("#t-cod", "000000");
    await enviar(pg1, "button:has-text('Ativar')");
    confere(await pg1.getByText(/Código incorreto/).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "código errado não ativa");
    await pg1.fill("#t-cod", totp(segredo));
    await enviar(pg1, "button:has-text('Ativar')");
    const codigos = await pg1.getByTestId("codigos-recuperacao").locator("li").allInnerTexts();
    confere(codigos.length === 8, "8 códigos de recuperação");
    await pg1.goto(BASE + "/mais");
    await Promise.all([pg1.waitForURL(/\/entrar/), pg1.getByRole("button", { name: "Sair" }).first().click()]);
    confere(pg1.url().includes("/entrar"), "sair leva ao login");
    await pg1.goto(BASE + "/agua");
    confere(pg1.url().includes("/entrar"), "depois de sair, página privada pede login");

    await pg1.goto(BASE + "/entrar");
    await pg1.fill("#usuario", "gui");
    await pg1.fill("#senha", SENHA);
    await Promise.all([pg1.waitForURL(/verificar/), pg1.locator("button[type=submit]").click()]);
    confere(pg1.url().includes("/entrar/verificar"), "com 2 etapas, a senha leva ao código");
    await pg1.goto(BASE + "/agua");
    confere(pg1.url().includes("/entrar"), "só a senha não abre as páginas");
    await pg1.goto(BASE + "/entrar/verificar");
    await pg1.fill("#codigo", totp(segredo)); // o mesmo código da ativação
    await enviar(pg1, "button[type=submit]");
    confere(await pg1.getByText(/incorreto ou já usado/).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "o mesmo código não vale duas vezes");
    await pg1.fill("#codigo", totp(segredo, Date.now() + 30000));
    await Promise.all([pg1.waitForURL(BASE + "/"), pg1.locator("button[type=submit]").click()]);
    confere(pg1.url() === BASE + "/", "entra com o código seguinte do autenticador");

    await pg1.goto(BASE + "/mais");
    await Promise.all([pg1.waitForURL(/\/entrar/), pg1.getByRole("button", { name: "Sair" }).first().click()]);
    await pg1.fill("#usuario", "gui");
    await pg1.fill("#senha", SENHA);
    await Promise.all([pg1.waitForURL(/verificar/), pg1.locator("button[type=submit]").click()]);
    await pg1.getByRole("button", { name: "Usar código de recuperação" }).click();
    await pg1.fill("#codigo", codigos[0].toLowerCase());
    await Promise.all([pg1.waitForURL(BASE + "/"), pg1.locator("button[type=submit]").click()]);
    confere(pg1.url() === BASE + "/", "entra com código de recuperação");

    console.log("\n6. Sessões, registro e exportação");
    await pg1.goto(BASE + "/configuracoes/seguranca");
    confere(await pg1.getByText("7 código(s) de recuperação sem uso").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "código de recuperação usado sai da conta (7)");
    confere(await pg1.getByRole("cell", { name: "Entrou com código de recuperação" }).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "registro de acessos");
    confere(await pg1.getByRole("cell", { name: "Verificação em duas etapas ligada" }).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "registro da ativação");
    const cookies = (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const cookieSessao = (await ctx.cookies()).find((c) => c.name === "lifeos_sessao");
    confere(cookieSessao?.httpOnly && cookieSessao.sameSite === "Lax", "cookie de sessão httpOnly e SameSite=Lax");
    const json = await (await fetch(BASE + "/api/exportar", { headers: { cookie: cookies } })).json();
    confere(json.formato === "life-os/v2" && json.habitos.length === 7 && json.agua.registros.length >= 2, "exportação JSON completa");
    confere(["treinos", "saude", "sono", "mente", "alimentacao", "estudos", "metas"].every((k) => json[k] && typeof json[k] === "object"), "exportação inclui os módulos da Fase 2");
    confere(!("checkins" in json.saude) && Array.isArray(json.mente.checkins), "check-ins exportados uma vez só");
    confere(!JSON.stringify(json).includes("passwordHash") && !JSON.stringify(json).includes("totpSecret"), "exportação sem senha nem segredo");
    const csv = await (await fetch(BASE + "/api/exportar/agua", { headers: { cookie: cookies } })).text();
    confere(csv.includes("dia;hora;ml;bebida;tipo") && csv.includes("Água;garrafa"), "CSV da água");
    const ics = await (await fetch(BASE + "/api/exportar/agenda", { headers: { cookie: cookies } })).text();
    confere(ics.startsWith("BEGIN:VCALENDAR") && ics.includes("SUMMARY:Prova de Matemática") && ics.includes("SUMMARY:Revisar frações"), "agenda .ics");
    const cabecalhos = (await fetch(BASE + "/entrar")).headers;
    confere((cabecalhos.get("content-security-policy") ?? "").includes("frame-ancestors 'none'") && cabecalhos.get("x-frame-options") === "DENY", "cabeçalhos de segurança");

    console.log("\n7. Celular (iPhone)");
    const cel = await nav.newContext({ ...require("playwright").devices["iPhone 13"], locale: "pt-BR", timezoneId: "America/Sao_Paulo" });
    await cel.addCookies((await ctx.cookies()).map((c) => ({ ...c })));
    const pc = await cel.newPage();
    pc.on("pageerror", (e) => erros.push(`[cel ${pc.url()}] ${e.message}`));
    const rotasMods = modulos.flatMap((m) => m.rotasCelular ?? []);
    for (const rota of ["/", "/agua", "/habitos", "/agenda", "/agenda?vista=mes", "/agenda?vista=tarefas", "/saude", "/mais", "/configuracoes/seguranca", ...rotasMods]) {
      await pc.goto(BASE + rota);
      await semRolagemLateral(pc, rota);
    }
    await pc.goto(BASE + "/");
    confere(await pc.getByRole("navigation", { name: "Atalhos" }).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "barra inferior no celular");
    confere(!(await pc.locator("aside").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false) /*negativo*/), "menu lateral escondido no celular");
    await pc.getByRole("navigation", { name: "Atalhos" }).getByRole("button", { name: "Registrar" }).click();
    confere(await pc.getByRole("dialog").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "botão central abre o Registrar");
    await pc.screenshot({ path: path.join(saida, "cel-registrar.png") });
    await enviar(pc, 'dialog[open] form:has(input[name=tipo][value=copo]) button');
    await pc.getByRole("dialog").getByRole("button", { name: "Fechar" }).click();
    await pc.screenshot({ path: path.join(saida, "cel-painel.png"), fullPage: true });
    await pc.goto(BASE + "/agua");
    confere(await pc.locator("dd", { hasText: "1 L" }).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false) || (await pc.locator("dd", { hasText: "1.000" }).count()) > 0, "copo pelo Registrar soma na água");
    await pc.screenshot({ path: path.join(saida, "cel-agua.png"), fullPage: true });
    await pc.goto(BASE + "/agenda");
    await pc.screenshot({ path: path.join(saida, "cel-agenda.png"), fullPage: true });
    await pc.goto(BASE + "/habitos");
    await pc.screenshot({ path: path.join(saida, "cel-habitos.png"), fullPage: true });
    await cel.close();

    console.log("\n8. Limite de tentativas");
    const anon = await nav.newContext();
    const pa = await anon.newPage();
    await pa.goto(BASE + "/entrar");
    for (let i = 0; i < 5; i++) {
      await pa.fill("#usuario", "gui");
      await pa.fill("#senha", "errada-" + i);
      await enviar(pa, "button[type=submit]");
    }
    await pa.fill("#usuario", "gui");
    await pa.fill("#senha", SENHA);
    await enviar(pa, "button[type=submit]");
    confere(await pa.getByText(/Muitas tentativas/).waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "6ª tentativa bloqueada (mesmo com a senha certa)");
    await pa.fill("#usuario", "ninguem");
    await pa.fill("#senha", "qualquer-coisa-1");
    await enviar(pa, "button[type=submit]");
    await pa.screenshot({ path: path.join(saida, "limite.png") });
    confere(await pa.getByText("Usuário ou senha incorretos.").waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false), "usuário inexistente: mesma mensagem (não revela quem existe)");
    await anon.close();

    confere(erros.length === 0, `sem erros no console (${erros.length})`);
    if (erros.length) console.log(erros.join("\n"));
  } catch (e) {
    falhas++;
    console.error("ERRO:", e);
    await pg1.screenshot({ path: path.join(saida, "erro.png"), fullPage: true }).catch(() => {});
  } finally {
    await nav.close();
    if (servidor) {
      if (falhas) console.log("\n--- log do servidor ---\n" + servidor.log().slice(-4000));
      servidor.p.kill("SIGTERM");
    }
  }
  console.log(`\n${total - falhas}/${total} verificações ok${falhas ? ` — ${falhas} FALHA(S)` : ""}`);
  process.exit(falhas ? 1 : 0);
}

main();
