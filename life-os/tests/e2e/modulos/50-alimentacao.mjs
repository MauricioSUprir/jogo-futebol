// Nutrition Hub: refeição com frutas e vegetais, variedade do dia, plano para dia de treino, lista de compras e receita.
export const nome = "Nutrition Hub";
export const rotasCelular = ["/alimentacao", "/alimentacao?aba=compras", "/alimentacao?aba=historico", "/alimentacao?aba=plano", "/alimentacao?aba=receitas"];

export async function testar({ pagina, BASE, confere, enviar, visivel, saida, path }) {
  const dlg = pagina.locator("dialog[open]");
  const chip = (nome, valor) => dlg.locator(`label:has(input[name="${nome}"][value="${valor}"])`).first().click();

  await pagina.goto(BASE + "/alimentacao");
  confere(await visivel(pagina.getByRole("heading", { name: "Alimentação" })), "Nutrition Hub abre");
  confere(!(await pagina.content()).match(/calorias? (?:consumidas|do dia)|kcal/i), "sem contagem de calorias na tela");

  // Refeição com frutas e vegetais.
  await pagina.getByRole("button", { name: "Refeição", exact: true }).click();
  await pagina.selectOption("#cab-tipo", "almoco");
  await pagina.fill("#cab-desc", "Arroz, feijão, frango, salada e laranja");
  for (const g of ["frutas", "vegetais", "cereais", "proteinas", "leguminosas"]) await chip("grupos", g);
  await chip("fome", 4);
  await chip("saciedade", 3);
  await enviar(pagina, 'dialog[open] button:has-text("Registrar refeição")');
  confere(await visivel(pagina.getByText("Arroz, feijão, frango, salada e laranja")), "refeição registrada aparece no dia");
  const resumo = pagina.getByRole("region", { name: "Resumo" });
  confere(await visivel(resumo.getByText("5/7")), "variedade do dia: 5 de 7 grupos");
  confere(await visivel(resumo.getByText("1 de 7").first()), "fruta e vegetal contam o dia");

  // Plano para dia de treino (hoje foi marcado como dia de treino no Hydro Track).
  await pagina.goto(BASE + "/alimentacao?aba=plano");
  await pagina.getByRole("button", { name: "Planejar" }).click();
  await pagina.selectOption("#pl-tipo", "pre_treino");
  await pagina.fill("#pl-desc", "Banana com aveia antes do treino");
  await chip("dias", 6);
  await chip("dias", 0);
  await dlg.locator('input[name="treino"]').check();
  await enviar(pagina, 'dialog[open] button:has-text("Adicionar ao planejamento")');
  confere(await visivel(pagina.getByText("Banana com aveia antes do treino").first()), "item do planejamento criado");
  await pagina.goto(BASE + "/alimentacao");
  const plano = pagina.getByTestId("plano-do-dia");
  confere(await visivel(plano.getByText("Banana com aveia antes do treino")), "no dia de treino, o plano de treino aparece em Hoje");

  // Lista de compras.
  await pagina.goto(BASE + "/alimentacao?aba=compras");
  await pagina.fill("#cp-nome", "Bananas");
  await pagina.fill("#cp-qtd", "1 dúzia");
  await pagina.selectOption("#cp-cat", "hortifruti");
  await enviar(pagina, 'form:has(#cp-nome) button[type=submit]');
  confere(await visivel(pagina.getByText("Bananas")), "item na lista de compras");
  await enviar(pagina, 'button[aria-label="Marcar Bananas"]');
  confere(await visivel(pagina.locator('button[aria-label="Desmarcar Bananas"]')), "item marcado");
  confere(await visivel(pagina.getByRole("button", { name: "Limpar marcados (1)" })), "limpar marcados disponível");

  // Receita favorita e os ingredientes na lista.
  await pagina.goto(BASE + "/alimentacao?aba=receitas");
  await pagina.getByRole("button", { name: "Nova receita" }).click();
  await pagina.fill("#rc-titulo", "Vitamina de banana");
  await pagina.fill("#rc-ing", "2 bananas\n1 copo de leite\n1,5 colher de aveia");
  await pagina.fill("#rc-tags", "lanche, rápido");
  await dlg.locator('input[name="treino"]').check();
  await enviar(pagina, 'dialog[open] button:has-text("Salvar receita")');
  confere(await visivel(pagina.getByRole("heading", { name: "Vitamina de banana" })), "receita salva");
  confere(await visivel(pagina.locator('button[aria-label="Tirar Vitamina de banana das favoritas"]')), "receita nova já é favorita");
  await enviar(pagina, 'button:has-text("Ingredientes na lista")');
  await pagina.goto(BASE + "/alimentacao?aba=compras");
  const itens = await pagina.getByTestId("item-compra").allInnerTexts();
  confere(["2 bananas", "1 copo de leite", "1,5 colher de aveia"].every((i) => itens.some((t) => t.includes(i))), "ingredientes da receita foram para a lista (sem quebrar o 1,5)");

  // Histórico.
  await pagina.goto(BASE + "/alimentacao?aba=historico");
  confere(await visivel(pagina.getByText("Grupos mais e menos presentes")), "histórico com a presença dos grupos");
  await pagina.screenshot({ path: path.join(saida, "pc-alimentacao.png"), fullPage: true });
}
