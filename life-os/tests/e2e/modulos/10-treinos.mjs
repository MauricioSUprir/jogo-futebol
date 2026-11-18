// E2E do Fitness Center: ficha → sessão pela ficha (carga da última vez), partida com gol e assistência
// (estatísticas da temporada), cardio com distância (ritmo), recuperação (alerta de desconforto) e o dia
// de treino no Hydro Track.
export const nome = "Fitness Center";
export const rotasCelular = ["/treinos", "/treinos?aba=futebol", "/treinos?aba=musculacao", "/treinos?aba=cardio", "/treinos?aba=recuperacao", "/treinos/sessao"];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
function diaLocal(deslocamentoDias = 0) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() + deslocamentoDias * 86400000));
}
const curto = (k) => `${Number(k.slice(8))} ${MESES[Number(k.slice(5, 7)) - 1]}`;

export async function testar({ pagina: p, BASE, confere, enviar, visivel, saida, path }) {
  const dlg = p.locator("dialog[open]");

  // ── Ficha de treino ──
  await p.goto(BASE + "/treinos?aba=musculacao");
  await p.getByRole("button", { name: "Nova ficha" }).click();
  await p.fill("#fi-nome", "Treino A");
  await p.fill("#fi-foco", "peito e pernas");
  const dow = new Date(diaLocal() + "T12:00:00Z").getUTCDay();
  await dlg.locator(`label:has(input[name=dias][value="${dow}"])`).click();
  await dlg.getByLabel("Nome do exercício 1").fill("Supino reto");
  await dlg.getByLabel("Carga (kg)").first().fill("30");
  await dlg.getByRole("button", { name: "Adicionar exercício" }).click();
  await dlg.getByLabel("Nome do exercício 2").fill("Agachamento");
  await dlg.getByLabel("Repetições").nth(1).fill("12");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.getByText("Treino A", { exact: true })), "ficha criada com 2 exercícios");
  confere(await visivel(p.locator("main").getByText("2 exercícios · peito e pernas")), "ficha mostra os exercícios e o foco");
  confere((await p.locator("ol li a[href^='/treinos/sessao?ficha=']").count()) >= 1, "ficha aparece no dia de hoje da semana de treinamento");

  // ── Sessão pela ficha ──
  await Promise.all([p.waitForURL(/\/treinos\/sessao\?ficha=/), p.getByRole("link", { name: "Treinar" }).first().click()]);
  const reps1 = await p.getByLabel("Supino reto: repetições da série 1").inputValue();
  const carga1 = await p.getByLabel("Supino reto: carga da série 1").inputValue();
  confere(reps1 === "10" && carga1 === "30", `séries vêm da ficha (10 reps, 30 kg): ${reps1}/${carga1}`);
  confere((await p.locator("input[aria-label^='Agachamento: repetições']").count()) === 3, "3 séries do agachamento");
  for (const [k, v] of [[1, "30"], [2, "32,5"], [3, "35"]]) await p.getByLabel(`Supino reto: carga da série ${k}`).fill(v);
  await p.getByRole("button", { name: /Descanso 60 s/ }).first().click();
  confere(await visivel(p.getByRole("timer")), "cronômetro de intervalo aparece");
  await p.getByRole("button", { name: "Mais 15 segundos" }).click();
  confere(/^1:1\d$/.test((await p.getByRole("timer").locator("p.numero").innerText()).trim()), "+15 s soma ao descanso");
  await p.getByRole("button", { name: "Pausar" }).click();
  confere(await visivel(p.getByText("Descanso pausado")), "pausa o cronômetro");
  await p.getByRole("button", { name: "Fechar cronômetro" }).click();
  await p.fill("#ss-notas", "Descida controlada no supino.");
  await p.selectOption("#ss-esf", "6");
  await Promise.all([p.waitForURL(/\/treinos\?aba=musculacao/), p.getByRole("button", { name: "Concluir sessão" }).click()]);
  confere(await visivel(p.getByText("Descida controlada no supino.")), "sessão no histórico com a observação de técnica");
  confere(await visivel(p.getByText("Maior carga por sessão (kg) · Supino reto")), "evolução da carga do supino");
  await p.getByText("Ver em tabela").first().click();
  confere(await visivel(p.locator("td", { hasText: "35 kg" })), "maior carga da sessão = 35 kg");

  // A sessão nova pela mesma ficha já vem com a carga da última vez.
  await p.goto(BASE + "/treinos?aba=musculacao");
  await Promise.all([p.waitForURL(/\/treinos\/sessao\?ficha=/), p.getByRole("link", { name: "Treinar" }).first().click()]);
  confere((await p.getByLabel("Supino reto: carga da série 2").inputValue()) === "32,5", "nova sessão pré-preenchida com a carga da última vez");
  await p.goto(BASE + "/treinos?aba=musculacao");
  await Promise.all([p.waitForURL(/\/treinos\/sessao\/.+/), p.getByRole("link", { name: "Editar Treino A" }).first().click()]);
  confere((await p.getByLabel("Supino reto: carga da série 3").inputValue()) === "35", "editar sessão abre com as séries salvas");

  // ── Futebol ──
  await p.goto(BASE + "/treinos?aba=futebol");
  await p.getByRole("button", { name: "Registrar jogo" }).click();
  await p.fill("#fb-dur", "90");
  await p.fill("#fb-min", "80");
  await p.fill("#fb-gols", "1");
  await p.fill("#fb-ast", "1");
  await p.selectOption("#fb-pos", "meia");
  await p.fill("#fb-adv", "Leões");
  await p.selectOption("#fb-nota", "8");
  await enviar(p, "dialog[open] button[type=submit]");
  const temporada = p.locator("section[aria-label^='Temporada']");
  confere(await visivel(temporada.getByText("1 partida(s) · 0 recreativo(s)")), "estatística: 1 jogo na temporada");
  confere(/GOLS\s+1\s+1 assistência\(s\)/i.test(await temporada.locator("div", { hasText: "Gols" }).last().innerText()), "estatística: 1 gol e 1 assistência");
  confere(await visivel(temporada.getByText("desempenho médio 8")), "desempenho médio 8");
  await p.getByRole("button", { name: "Treino técnico" }).click();
  await p.fill("#fb-notas", "Finalização de perna esquerda");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(temporada.getByText("1 treino(s) técnico(s)")), "treino técnico conta à parte (não é jogo)");
  confere(await visivel(p.getByText("Partida × Leões")), "partida na lista da temporada");
  await p.getByRole("button", { name: "Editar Partida × Leões" }).click();
  confere((await p.locator("#fb-gols").inputValue()) === "1", "editar partida abre com os gols");
  await p.locator("dialog[open]").getByRole("button", { name: "Fechar" }).click();

  // ── Cardio (ontem) e o dia de treino no Hydro Track ──
  const ontem = diaLocal(-1);
  await p.goto(BASE + "/treinos?aba=cardio");
  await p.getByRole("button", { name: "Registrar cardio" }).click();
  await p.selectOption("#cd-sub", "corrida");
  await p.fill("#cd-dia", ontem);
  await p.fill("#cd-dur", "30");
  await p.fill("#cd-km", "5");
  confere(await visivel(dlg.getByText("6:00 /km")), "ritmo calculado no formulário");
  await enviar(p, "dialog[open] button[type=submit]");
  confere(await visivel(p.locator("main li", { hasText: "6:00 /km" })), "corrida com distância e ritmo no histórico");
  // Um cardio a mais, apagado em seguida (com confirmação).
  await p.getByRole("button", { name: "Registrar cardio" }).click();
  await p.selectOption("#cd-sub", "caminhada");
  await p.fill("#cd-dur", "20");
  await enviar(p, "dialog[open] button[type=submit]");
  const caminhadas = p.locator('main li:has(button[aria-label="Apagar Caminhada"])');
  const antes = await caminhadas.count();
  await p.getByRole("button", { name: "Apagar Caminhada" }).first().click();
  await enviar(p, "dialog[open] button:has-text('Apagar')");
  confere(antes === 1 && (await caminhadas.count()) === 0, "apaga um registro com confirmação");

  await p.goto(BASE + "/agua");
  await p.getByText("Ver em tabela").click();
  const linhaOntem = p.locator("table tr", { has: p.locator("td", { hasText: new RegExp(`^${curto(ontem)}$`) }) });
  confere((await linhaOntem.locator("td").nth(3).innerText()).trim() === "Sim", `o dia da corrida (${curto(ontem)}) virou dia de treino no Hydro Track`);

  // ── Recuperação ──
  await p.goto(BASE + "/treinos?aba=recuperacao");
  await p.locator("label:has(input[name=cansaco][value='3'])").click();
  await p.locator("label:has(input[name=recuperacao][value='4'])").click();
  await p.locator("label:has(input[name=dor][value='2'])").click();
  await p.fill("#rc-desc", "incômodo leve ao correr");
  await p.fill("#rc-local", "joelho direito");
  await enviar(p, "button:has-text('Salvar recuperação')");
  confere(await visivel(p.getByText("Recuperação salva.")), "registra o dia de recuperação");
  confere(await visivel(p.getByText(/adulto de confiança ou um profissional de saúde/)), "alerta gentil de desconforto");
  confere(await visivel(p.getByText("incômodo leve ao correr (joelho direito)")), "desconforto no histórico");
  confere(await visivel(p.getByText(/Registre o sono no Sleep Lab/)), "convite para o Sleep Lab sem noites registradas");

  // ── Visão geral ──
  await p.goto(BASE + "/treinos");
  confere(await visivel(p.getByText("Últimas atividades")), "visão geral abre");
  confere(await visivel(p.locator("main li", { hasText: "Treino A" })), "sessão nas últimas atividades");
  confere(await visivel(p.locator("ol li span.text-ok", { hasText: "Treino A" })), "treino de hoje marcado como feito na grade");
  await p.getByRole("button", { name: "Registrar atividade" }).click();
  confere(await visivel(dlg.getByRole("button", { name: /Musculação/ })), "Registrar atividade oferece as 3 opções");
  await dlg.getByRole("button", { name: "Fechar" }).click();
  await p.screenshot({ path: path.join(saida, "pc-treinos.png"), fullPage: true });
}
