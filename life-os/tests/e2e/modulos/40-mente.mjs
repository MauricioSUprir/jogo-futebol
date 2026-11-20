// Mind Center: check-in, coisas boas, diário cifrado, senha extra (trancar, senha errada e certa), respiração e padrões.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("pg");

export const nome = "Mind Center";
export const rotasCelular = ["/mente", "/mente?aba=diario", "/mente?aba=padroes", "/mente?aba=respirar"];

const SENHA_DIARIO = "Diario-forte-2026";
const SEGREDO = "TEXTO-SECRETO-123";

async function linhasDoDiario() {
  const c = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5544/lifeos_e2e" });
  await c.connect();
  const r = await c.query('select "titleEnc", "bodyEnc", locked from "JournalEntry"');
  const trava = await c.query('select count(*)::int as n from "JournalLock"');
  await c.end();
  return { linhas: r.rows, travas: trava.rows[0].n };
}

export async function testar({ pagina, BASE, confere, enviar, visivel, saida, path }) {
  const marcar = (nome, valor) => pagina.locator(`label:has(input[name="${nome}"][value="${valor}"])`).first().click();

  await pagina.goto(BASE + "/mente");
  confere(await visivel(pagina.getByRole("heading", { name: "Bem-estar emocional" })), "Mind Center abre");
  confere(await visivel(pagina.getByRole("complementary", { name: "Apoio" }).getByRole("link", { name: "188" })), "cartão de apoio com o CVV 188 no fim da página");

  // Check-in de humor (o check-in compartilhado, modo "mente").
  await marcar("humor", 4);
  await marcar("energia", 7);
  await marcar("estresse", 2);
  await marcar("emocoes", "calma");
  await enviar(pagina, 'button:has-text("Salvar check-in")');
  confere(await visivel(pagina.getByText("7/10")), "check-in salvo (energia 7/10 no resumo)");
  confere(await visivel(pagina.getByRole("list", { name: "Emoções de hoje" }).getByText("calma")), "emoção do dia aparece");

  // 3 coisas boas.
  await pagina.fill('input[aria-label="Coisa boa 1"]', "Ganhei o jogo de futsal");
  await pagina.fill('input[aria-label="Coisa boa 2"]', "Terminei a lista de exercícios");
  await enviar(pagina, 'button:has-text("Guardar coisas boas")');
  confere(await visivel(pagina.getByText("Ganhei o jogo de futsal")), "coisas boas guardadas");

  // Diário: nova entrada.
  await pagina.goto(BASE + "/mente?aba=diario");
  await pagina.getByRole("button", { name: "Nova entrada" }).click();
  await pagina.fill("dialog[open] #en-titulo", "Dia de prova");
  await pagina.fill("dialog[open] #en-texto", `${SEGREDO} hoje fiquei nervoso antes da prova`);
  await enviar(pagina, 'dialog[open] button:has-text("Salvar no diário")');
  confere(await visivel(pagina.getByText(SEGREDO, { exact: false })), "entrada do diário aparece");

  let banco = await linhasDoDiario();
  const claro = (rows) => rows.some((l) => [l.titleEnc, l.bodyEnc].some((v) => v && (v.includes("SECRETO") || v.includes("futsal") || v.includes("Dia de prova"))));
  confere(banco.linhas.length >= 2 && banco.linhas.every((l) => l.bodyEnc.startsWith("v1:")) && !claro(banco.linhas), "no banco o diário está cifrado (nada em claro)");

  // Ligar a senha extra.
  await pagina.getByRole("button", { name: "Ligar senha extra" }).click();
  await pagina.fill("#ds-senha", SENHA_DIARIO);
  await pagina.fill("#ds-confirma", SENHA_DIARIO);
  await pagina.locator('dialog[open] input[name="entendi"]').check();
  await enviar(pagina, 'dialog[open] button[type=submit]');
  confere(await visivel(pagina.getByText("Senha extra ligada · aberto agora")), "senha extra ligada (diário aberto por 15 min)");
  confere(await visivel(pagina.getByText(SEGREDO, { exact: false })), "com a senha ligada, o texto continua legível enquanto aberto");
  banco = await linhasDoDiario();
  confere(banco.travas === 1 && banco.linhas.every((l) => l.locked) && !claro(banco.linhas), "entradas recifradas com a chave da senha");

  // Trancar: o texto some até destrancar.
  await enviar(pagina, 'button:has-text("Trancar agora")');
  confere(await visivel(pagina.getByText("Diário trancado")), "trancar agora fecha o diário");
  confere((await pagina.getByText(SEGREDO, { exact: false }).count()) === 0, "trancado, o texto do diário não aparece");
  await pagina.goto(BASE + "/mente");
  confere((await pagina.getByText("Ganhei o jogo de futsal").count()) === 0 && (await visivel(pagina.getByText("O diário está trancado."))), "trancado, as coisas boas também ficam escondidas");

  // Senha errada é recusada; a certa abre.
  await pagina.goto(BASE + "/mente?aba=diario");
  await pagina.fill("#di-senha", "senha-errada-1");
  await enviar(pagina, 'button:has-text("Destrancar")');
  confere(await visivel(pagina.getByText("Senha do diário incorreta.")), "senha do diário errada é recusada");
  confere((await pagina.getByText(SEGREDO, { exact: false }).count()) === 0, "com a senha errada, nada aparece");
  await pagina.fill("#di-senha", SENHA_DIARIO);
  await enviar(pagina, 'button:has-text("Destrancar")');
  confere(await visivel(pagina.getByText(SEGREDO, { exact: false })), "com a senha certa, o texto volta");

  // Mais uma coisa boa, já com a senha (fica cifrada com a chave dela).
  await pagina.goto(BASE + "/mente");
  await pagina.fill('input[aria-label="Coisa boa 1"]', "Ajudei meu irmão com a lição");
  await enviar(pagina, 'button:has-text("Guardar coisas boas")');
  confere(await visivel(pagina.getByText("Ajudei meu irmão com a lição")), "coisa boa com o diário destrancado");
  banco = await linhasDoDiario();
  confere(banco.linhas.length >= 3 && banco.linhas.every((l) => l.locked) && !banco.linhas.some((l) => l.bodyEnc.includes("irmão")), "nova entrada cifrada com a chave da senha");

  // Respiração e padrões.
  await pagina.goto(BASE + "/mente?aba=respirar");
  await pagina.getByRole("button", { name: "Iniciar" }).click();
  confere(await visivel(pagina.getByText("Inspire")), "respiração começa (Inspire)");
  await pagina.getByRole("button", { name: "Pausar" }).click();
  await pagina.goto(BASE + "/mente?aba=padroes");
  confere(await visivel(pagina.getByText("Humor e estresse · 30 dias")), "padrões com o gráfico de 30 dias");
  confere(await visivel(pagina.getByRole("img", { name: /Humor e estresse por dia/ })), "gráfico com descrição acessível");
  await pagina.screenshot({ path: path.join(saida, "pc-mente.png"), fullPage: true });

  // O painel mostra o humor de hoje e nunca o texto do diário.
  await pagina.goto(BASE + "/");
  confere((await pagina.getByText(SEGREDO, { exact: false }).count()) === 0, "painel não mostra o texto do diário");
}
