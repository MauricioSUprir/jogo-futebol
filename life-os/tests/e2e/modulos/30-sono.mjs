// Sleep Lab: noite que cruza a meia-noite (23:30 → 07:15 = 7 h 45 min), uma noite por dia (registrar de novo substitui),
// meta de sono, gráfico com tabela e o sono aparecendo no diário de saúde.
export const nome = "Sleep Lab";
export const rotasCelular = ["/sono", "/sono?periodo=30"];

export async function testar({ pagina: p, BASE, confere, enviar, visivel, saida, path }) {
  const diaSP = (n) => p.evaluate((n) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + n * 86400000)), n);
  const ontem = await diaSP(-1);
  const anteontem = await diaSP(-2);

  await p.goto(BASE + "/sono");
  confere(await visivel(p.getByText("Nenhuma noite registrada")), "Sleep Lab abre vazio");

  // Noite que cruza a meia-noite, sem tempo até dormir.
  await p.getByRole("button", { name: "Registrar noite" }).click();
  await p.fill("#sn-dia", ontem);
  await p.fill("#sn-deitou", "23:30");
  await p.fill("#sn-acordou", "07:15");
  await p.locator('dialog[open] label:has(input[name=qualidade][value="4"])').click();
  await p.fill("#sn-notas", "Acordei bem.");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("7 h 45 min")), "23:30 → 07:15 = 7 h 45 min");
  confere(await visivel(p.getByText("23:30 → 07:15")), "horários da noite no histórico");

  // Registrar de novo o mesmo dia substitui (uma noite por dia), agora com 15 min até dormir.
  await p.getByRole("button", { name: "Registrar noite" }).click();
  await p.fill("#sn-dia", ontem);
  await p.fill("#sn-deitou", "23:00");
  await p.fill("#sn-acordou", "07:15");
  await p.fill("#sn-lat", "15");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("8 h", { exact: true })), "duração desconta o tempo até dormir (8 h)");
  confere((await p.getByRole("button", { name: /^Editar a noite de/ }).count()) === 1, "uma noite por dia: o novo registro substitui");

  // Dormir no limite proibido: noite curta demais é recusada.
  await p.getByRole("button", { name: "Registrar noite" }).click();
  await p.fill("#sn-dia", anteontem);
  await p.fill("#sn-deitou", "06:50");
  await p.fill("#sn-acordou", "07:15");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("Uma noite precisa ter pelo menos 1 hora.")), "noite de 25 min é recusada");
  await p.keyboard.press("Escape");

  // Meta de sono
  await p.getByRole("button", { name: "Meta e horários" }).click();
  await p.fill("#sc-meta", "8");
  await p.fill("#sc-lem", "45");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText(/Meta: 8 h/)), "meta de sono mudada para 8 h");
  confere(await visivel(p.getByText("chegou à meta", { exact: false })), "a noite de 8 h chega à meta de 8 h");

  // Gráfico e tabela
  confere(await visivel(p.locator('[role=img][aria-label^="Horas de sono por noite"]')), "gráfico de horas por noite");
  await p.locator("summary", { hasText: "Ver em tabela" }).first().click();
  confere(await visivel(p.getByRole("cell", { name: "8 h" })), "tabela do gráfico com a noite");
  await p.goto(BASE + "/sono?periodo=30");
  confere(await visivel(p.locator('a[aria-current="page"]', { hasText: "30 dias" })), "período de 30 dias");
  await p.screenshot({ path: path.join(saida, "pc-sono.png"), fullPage: true });

  // O sono aparece no diário de saúde do dia em que acordou.
  await p.goto(BASE + `/saude/central?aba=diario&dia=${ontem}`);
  confere(await visivel(p.getByText(/Sono: 8 h/)), "o sono da noite aparece no diário de saúde");
}
