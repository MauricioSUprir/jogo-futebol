// E2E do Goals Center: meta por etapas concluída sozinha + conquista; meta numérica com prazo na agenda e progresso.
export const nome = "Goals Center";
export const rotasCelular = ["/metas", "/metas?aba=anuais", "/metas?aba=concluidas", "/metas?aba=conquistas"];

export async function testar({ pagina: p, BASE, confere, enviar, visivel, saida, path }) {
  await p.goto(BASE + "/metas");
  confere(await visivel(p.getByText("Crie sua primeira meta")), "metas: vazio convida a criar");

  // Meta por etapas
  await p.getByRole("button", { name: "Nova meta" }).click();
  await p.fill("#mt-titulo", "Programar um jogo");
  await p.locator("dialog[open]").getByRole("radio", { name: "Tecnologia" }).click();
  await p.fill("#mt-etapas", "Fazer o curso de lógica\nCriar o primeiro protótipo");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByTestId("meta-Programar um jogo")), "metas: meta criada na lista");
  await Promise.all([p.waitForURL(/\/metas\/.+/), p.getByTestId("meta-Programar um jogo").click()]);
  await enviar(p, 'button[aria-label=\'Marcar a etapa "Fazer o curso de lógica"\']');
  confere((await p.getByTestId("progresso-meta").innerText()).trim() === "50%", "metas: 1 de 2 etapas = 50%");
  await enviar(p, 'button[aria-label=\'Marcar a etapa "Criar o primeiro protótipo"\']');
  confere(await visivel(p.getByText(/Meta concluída/)), "metas: as 2 etapas concluem a meta sozinha (com aviso)");
  confere((await p.getByTestId("progresso-meta").innerText()).trim() === "100%", "metas: 100%");
  await p.goto(BASE + "/metas?aba=conquistas");
  confere((await p.locator('[data-conquista="primeira"][data-ok="1"]').count()) === 1, "metas: conquista 'Primeira meta' desbloqueada");
  confere((await p.locator('[data-conquista="cinco"][data-ok="0"]').count()) === 1, "metas: 'Cinco metas' ainda bloqueada");
  await p.goto(BASE + "/metas?aba=concluidas");
  confere(await visivel(p.getByTestId("meta-Programar um jogo")), "metas: aparece nas concluídas");

  // Meta numérica com prazo (vira evento "meta" na agenda) e progresso
  const prazo = await p.evaluate(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + 30 * 86400000)));
  await p.goto(BASE + "/metas");
  await p.getByRole("button", { name: "Nova meta" }).click();
  await p.fill("#mt-titulo", "Fazer 20 gols na temporada");
  const d = p.locator("dialog[open]");
  await d.getByRole("radio", { name: "Futebol" }).click();
  await d.getByRole("radio", { name: "Alta" }).click();
  await d.getByRole("radio", { name: "Por número" }).click();
  await p.fill("#mt-alvo", "20");
  await p.fill("#mt-unidade", "gols");
  await p.fill("#mt-prazo", prazo);
  await d.getByLabel("Objetivo anual").check();
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByTestId("meta-Fazer 20 gols na temporada").getByText("0 de 20 gols")), "metas: meta numérica 0 de 20 gols");
  confere(await visivel(p.getByTestId("meta-Fazer 20 gols na temporada").getByText("faltam 30 dias")), "metas: prazo na lista");
  await p.goto(BASE + `/agenda?vista=dia&dia=${prazo}`);
  confere(await visivel(p.getByText("Meta: Fazer 20 gols na temporada")), "metas: prazo virou evento na agenda");
  await p.goto(BASE + "/metas?aba=anuais");
  confere(await visivel(p.getByText(/Objetivos de \d{4}/)), "metas: objetivo anual na seção do ano");
  await Promise.all([p.waitForURL(/\/metas\/.+/), p.getByTestId("meta-Fazer 20 gols na temporada").click()]);
  for (const [v, nota] of [["3", "Hat-trick no campeonato"], ["2", ""]]) {
    await p.getByRole("button", { name: "Registrar progresso" }).click();
    await p.fill("#pg-valor", v);
    if (nota) await p.fill("#pg-nota", nota);
    await enviar(p, "dialog[open] button[type=submit]");
  }
  confere((await p.getByTestId("progresso-meta").innerText()).trim() === "25%", "metas: 5 de 20 gols = 25%");
  confere(await visivel(p.getByText("Hat-trick no campeonato")), "metas: histórico de progresso com a nota");
  confere(await visivel(p.getByRole("img", { name: /Evolução da meta/ })), "metas: gráfico de evolução com 2 registros");
  await p.screenshot({ path: path.join(saida, "pc-meta.png"), fullPage: true });
}
