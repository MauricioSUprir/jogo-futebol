// E2E do Study Center: matéria, notas e quanto falta, prova com checklist, estudo registrado,
// conteúdo concluído com revisão programada, flashcard (Leitner) e o plano da semana na agenda.
export const nome = "Study Center";
export const rotasCelular = [
  "/estudos",
  "/estudos?aba=materias",
  "/estudos?aba=provas",
  "/estudos?aba=pomodoro",
  "/estudos?aba=revisoes",
  "/estudos?aba=notas",
  "/estudos?aba=simulados",
];

const dialogo = (p) => p.locator("dialog[open]");

export async function testar({ pagina: p, BASE, confere, enviar, visivel, saida, path }) {
  await p.goto(BASE + "/estudos");
  confere(await visivel(p.getByText("Comece cadastrando as matérias")), "estudos: sem matérias, convite para cadastrar");

  // Matéria
  await p.getByRole("button", { name: "Matéria", exact: true }).click();
  await p.fill("#mt-nome", "Matemática");
  await p.fill("#mt-media", "7");
  await p.fill("#mt-meta", "120");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByTestId("painel-Matemática")), "estudos: matéria criada aparece no painel escolar");

  // Notas e quanto falta
  await p.goto(BASE + "/estudos?aba=notas");
  for (const [t, v] of [["Prova 1", "5"], ["Prova 2", "8"]]) {
    await p.getByRole("button", { name: "Registrar nota de Matemática" }).click();
    await p.fill("#nt-titulo", t);
    await p.fill("#nt-valor", v);
    await enviar(p, "dialog[open] button[type=submit]");
  }
  confere(await visivel(p.locator("dd", { hasText: "6,5" })), "estudos: média ponderada 6,5 com 5 e 8");
  const necessaria = (await p.getByTestId("nota-necessaria").first().innerText().catch(() => "")).trim();
  confere(necessaria === "8,0", `estudos: nota necessária na próxima de peso 1 = 8,0 (${necessaria})`);
  await p.locator("input[id^=peso-]").first().fill("3");
  const comPeso3 = (await p.getByTestId("nota-necessaria").first().innerText().catch(() => "")).trim();
  confere(comPeso3 === "7,4", `estudos: com peso 3 na próxima, precisa de 7,4 (${comPeso3})`);

  // Prova com checklist (vai para a agenda)
  await p.goto(BASE + "/estudos?aba=provas");
  await p.getByRole("button", { name: "Prova ou trabalho" }).first().click();
  await p.fill("#pv-titulo", "Prova de frações");
  await p.selectOption("#pv-materia", { label: "Matemática" });
  const diaProva = await p.inputValue("#pv-dia");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByTestId("prova-Prova de frações")), "estudos: prova marcada aparece com contagem regressiva");
  confere(await visivel(p.getByText("Revisar os resumos")), "estudos: prova já vem com o checklist padrão");
  await enviar(p, 'button[aria-label=\'Marcar "Revisar os resumos"\']');
  confere(await visivel(p.locator('button[aria-label=\'Desmarcar "Revisar os resumos"\']')), "estudos: item do checklist marcado");
  await p.goto(BASE + `/agenda?vista=dia&dia=${diaProva}`);
  confere(await visivel(p.getByText("Prova de frações")), "estudos: a prova está na agenda");

  // Estudo registrado (30 min de exercícios)
  await p.goto(BASE + "/estudos");
  await p.getByRole("button", { name: "Registrar estudo" }).click();
  await dialogo(p).getByRole("button", { name: "30 min" }).click();
  await p.selectOption("#ss-tipo", "exercicios");
  await enviar(p, "dialog[open] button[type=submit]");
  const painel = p.getByTestId("painel-Matemática");
  confere(await visivel(painel.getByText("exercícios concluídos")), "estudos: painel escolar mostra 'exercícios concluídos'");
  confere(await visivel(painel.getByText("30 min", { exact: true })), "estudos: 30 min na semana da matéria");

  // Conteúdo concluído → revisão programada
  await p.goto(BASE + "/estudos?aba=materias");
  await p.getByRole("button", { name: "Conteúdo" }).click();
  await p.fill("#ct-titulo", "Frações");
  await enviar(p, "dialog[open] button[type=submit]");
  await enviar(p, "button[aria-label='Frações: Concluído']");
  confere(await visivel(p.getByText("Revisão 1 de 5: amanhã")), "estudos: conteúdo concluído agenda a 1ª revisão para amanhã");

  // Flashcard acertado → caixa 2
  await p.goto(BASE + "/estudos?aba=revisoes");
  await p.getByRole("button", { name: "Cartão", exact: true }).click();
  await p.fill("#fc-frente", "Quanto é 1/2 + 1/4?");
  await p.fill("#fc-verso", "3/4");
  await enviar(p, "dialog[open] button[type=submit]");
  await p.getByRole("button", { name: "Mostrar a resposta" }).click();
  await p.getByRole("button", { name: "Acertei" }).click();
  confere(await visivel(p.getByText("Revisão do dia concluída")), "estudos: revisão de flashcards concluída");
  await p.waitForLoadState("networkidle");
  await p.waitForTimeout(1500);
  confere(await p.getByText("Revisão do dia concluída").isVisible(), "estudos: o resumo da revisão continua depois da página atualizar");
  await p.reload();
  await p.getByText(/Todos os cartões/).click();
  confere(await visivel(p.getByTestId("cartao-flash").getByText(/Caixa\s*2/)), "estudos: flashcard acertado foi para a caixa 2");

  // Plano da semana → tarefas na agenda
  await p.goto(BASE + "/estudos");
  await enviar(p, "button:has-text('Planejar a semana na agenda')");
  confere(await visivel(p.getByText(/tarefas? criadas? na agenda/)), "estudos: plano da semana cria tarefas");
  await p.goto(BASE + "/agenda?vista=tarefas");
  confere((await p.getByText("Estudar Matemática").count()) >= 2, "estudos: tarefas 'Estudar Matemática' na agenda (90 min em 2 blocos)");
  await p.goto(BASE + "/estudos");
  await enviar(p, "button:has-text('Planejar a semana na agenda')");
  confere(await visivel(p.getByText("A semana já está planejada")), "estudos: planejar de novo não duplica tarefas");

  await p.goto(BASE + "/estudos?aba=pomodoro");
  confere(await visivel(p.getByTestId("pomodoro-tempo")), "estudos: cronômetro Pomodoro abre (25:00)");
  await p.goto(BASE + "/estudos");
  await p.screenshot({ path: path.join(saida, "pc-estudos.png"), fullPage: true });
}
