// Health Center: consulta marcada na agenda, vacina com próxima dose, documento cifrado (envio, download idêntico,
// formato falso recusado, envio de outro site recusado), emergência com link tel: e o diário de saúde.
import { createRequire } from "node:module";

const pg = createRequire(import.meta.url)("pg");

export const nome = "Health Center";
export const rotasCelular = ["/saude/central", "/saude/central?aba=emergencia", "/saude/central?aba=diario", "/saude/central?aba=lesoes"];

// PNG 1×1 de verdade.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

export async function testar({ pagina: p, BASE, confere, enviar, visivel, saida, path }) {
  const diaSP = (n) => p.evaluate((n) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + n * 86400000)), n);
  const depoisDeAmanha = await diaSP(2);
  const daqui30 = await diaSP(30);

  // ── Consulta marcada → agenda
  await p.goto(BASE + "/saude/central?aba=consultas");
  await p.getByRole("button", { name: "Novo" }).first().click();
  await p.fill("#sr-consulta-titulo", "Ortopedista");
  await p.fill("#sr-consulta-dia", depoisDeAmanha);
  await p.fill("#sr-consulta-hora", "14:30");
  await p.fill("#sr-consulta-prof", "Dra. Ana, Clínica Centro");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("Ortopedista")), "consulta marcada aparece em Consultas marcadas");
  confere(await visivel(p.getByText("na agenda")), "consulta marcada fica ligada à agenda");
  await p.goto(BASE + `/agenda?vista=dia&dia=${depoisDeAmanha}`);
  confere(await visivel(p.getByText("Consulta: Ortopedista")), "a consulta aparece na agenda do dia");

  // Editar a consulta muda o evento da agenda
  await p.goto(BASE + "/saude/central?aba=consultas");
  await p.getByRole("button", { name: "Editar Ortopedista" }).click();
  await p.fill("#sr-consulta-titulo", "Ortopedista (retorno)");
  await enviar(p, "dialog[open] button[type=submit]");
  await p.goto(BASE + `/agenda?vista=dia&dia=${depoisDeAmanha}`);
  confere(await visivel(p.getByText("Consulta: Ortopedista (retorno)")), "editar a consulta atualiza o evento da agenda");

  // ── Vacina com próxima dose → Resumo
  await p.goto(BASE + "/saude/central?aba=vacinas");
  await p.getByRole("button", { name: "Novo" }).first().click();
  await p.fill("#sr-vacina-titulo", "Febre amarela");
  await p.fill("#sr-vacina-dose", "Reforço");
  await p.fill("#sr-vacina-prox", daqui30);
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("Febre amarela")), "vacina registrada");
  await p.goto(BASE + "/saude/central");
  const doses = p.locator("section", { has: p.getByRole("heading", { name: "Próximas doses" }) });
  confere(await visivel(doses.getByText("Febre amarela")), "próxima dose aparece no Resumo");
  confere(await visivel(p.getByText("Ortopedista (retorno)")), "próxima consulta aparece no Resumo");

  // ── Exame com documento cifrado
  await p.goto(BASE + "/saude/central?aba=exames");
  await p.getByRole("button", { name: "Novo" }).first().click();
  await p.fill("#sr-exame-titulo", "Hemograma");
  await p.fill("#sr-exame-prof", "Laboratório Vida");
  await p.fill("#sr-exame-det", "Tudo dentro da referência, segundo o médico.");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("Hemograma")), "exame registrado");
  await p.setInputFiles('input[aria-label="Anexar documento a Hemograma"]', { name: "resultado-hemograma.png", mimeType: "image/png", buffer: PNG });
  confere(await visivel(p.getByRole("link", { name: "Baixar resultado-hemograma.png" })), "documento anexado ao exame");
  const href = await p.getByRole("link", { name: "Baixar resultado-hemograma.png" }).first().getAttribute("href");
  const cookie = (await p.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
  const baixado = await fetch(BASE + href, { headers: { cookie } });
  const bytes = Buffer.from(await baixado.arrayBuffer());
  confere(baixado.ok && bytes.equals(PNG), "download devolve o arquivo idêntico");
  confere(
    (baixado.headers.get("content-disposition") ?? "").startsWith("attachment;") && baixado.headers.get("x-content-type-options") === "nosniff" && (baixado.headers.get("cache-control") ?? "").includes("no-store"),
    "download como anexo, nosniff e sem cache",
  );
  confere((await fetch(BASE + href)).status === 401, "download sem sessão é recusado");

  // As recusas vão direto ao servidor (no navegador, toda resposta 4xx vira "erro no console").
  const db = new pg.Client({ connectionString: process.env.E2E_DATABASE_URL ?? "postgresql://postgres@127.0.0.1:5544/lifeos_e2e" });
  await db.connect();
  const registroId = (await db.query(`select id from "HealthRecord" where title = 'Hemograma' limit 1`)).rows[0]?.id;
  const guardado = (await db.query(`select data from "HealthFile" where name = 'resultado-hemograma.png' limit 1`)).rows[0]?.data;
  await db.end();
  const envio = (conteudo, origem) => {
    const fd = new FormData();
    fd.set("registroId", registroId);
    fd.set("arquivo", new Blob([conteudo], { type: "image/png" }), "x.png");
    return fetch(BASE + "/api/documentos", { method: "POST", body: fd, headers: { cookie, origin: origem, "sec-fetch-site": origem === BASE ? "same-origin" : "cross-site" } });
  };
  // Arquivo falso (texto com nome e tipo de PNG) é recusado pelo conteúdo.
  const falso = await envio(Buffer.from("<html>não sou imagem</html>"), BASE);
  confere(falso.status === 415 && (await falso.json()).erro.startsWith("Formato não aceito"), "arquivo falso é recusado pelo conteúdo (415)");
  // Envio de outro site é recusado (CSRF), mesmo com o cookie.
  confere((await envio(PNG, "https://site-malicioso.example")).status === 403, "envio vindo de outro site é recusado (403)");
  // Registro de outra pessoa / inexistente.
  const fdOutro = new FormData();
  fdOutro.set("registroId", "nao-existe");
  fdOutro.set("arquivo", new Blob([PNG], { type: "image/png" }), "x.png");
  const semRegistro = await fetch(BASE + "/api/documentos", { method: "POST", body: fdOutro, headers: { cookie, origin: BASE, "sec-fetch-site": "same-origin" } });
  confere(semRegistro.status === 404, "documento só entra em registro do próprio usuário (404)");

  // No banco o arquivo está cifrado: o conteúdo guardado não contém o PNG.
  confere(Buffer.isBuffer(guardado) && guardado.length > PNG.length && guardado.indexOf(PNG.subarray(0, 8)) === -1 && guardado.indexOf(PNG.subarray(16)) === -1, "documento guardado cifrado no banco");
  await p.screenshot({ path: path.join(saida, "pc-saude-exames.png"), fullPage: true });

  // ── Emergência
  await p.goto(BASE + "/saude/central?aba=emergencia");
  await p.getByRole("button", { name: "Preencher" }).click();
  await p.selectOption("#em-sangue", "O+");
  await p.fill("#em-alergias", "Dipirona");
  await p.fill('input[aria-label="Nome do contato 1"]', "Mãe");
  await p.fill('input[aria-label="Relação do contato 1"]', "mãe");
  await p.fill('input[aria-label="Telefone do contato 1"]', "(11) 98888-7777");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.locator('a[href="tel:11988887777"]')), "contato de emergência com link tel:");
  confere(await visivel(p.getByText("O+", { exact: true })), "tipo sanguíneo na tela de emergência");

  // ── Lesão (status) e dor
  await p.goto(BASE + "/saude/central?aba=lesoes");
  await p.getByRole("button", { name: "Novo" }).first().click();
  await p.fill("#sr-lesao-titulo", "Entorse de tornozelo");
  await p.fill("#sr-lesao-parte", "tornozelo direito");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("Em recuperação")), "lesão em recuperação");
  await enviar(p, "button:has-text('Marcar como recuperada')");
  confere(await visivel(p.getByText("Recuperadas (1)")), "lesão marcada como recuperada");

  // ── Diário de saúde (check-in)
  await p.goto(BASE + "/saude/central?aba=diario");
  await p.locator('label:has(input[name=energia][value="8"])').click();
  await p.locator('label:has(input[name=disposicao][value="3"])').click();
  await p.fill("#ck-notas", "Dia tranquilo.");
  await enviar(p, "button:has-text('Salvar no diário')");
  confere(await visivel(p.getByText(/Energia: 8\/10 · Disposição: Boa/)), "check-in do diário de saúde no formato do plano");
  confere(await visivel(p.getByText(/Observações: Dia tranquilo\./)), "observações no diário");
  await p.screenshot({ path: path.join(saida, "pc-saude-diario.png"), fullPage: true });
}
