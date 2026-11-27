/**
 * Teste de ponta a ponta do Amigo Oculto (Chromium, contra o build de produção + Supabase local).
 *
 *   npm run build && npm run start &      (porta 3100)
 *   node tests/e2e/fluxo.mjs              (E2E_BASE muda o endereço)
 *
 * Percorre o caminho principal com 3 pessoas reais em navegadores separados (organizadora no PC, participante e
 * convidado sem cadastro no celular): página inicial → criar pelo assistente → compartilhar (código, QR, WhatsApp) →
 * entrar pelo convite (com conta e como convidado) → sortear → revelação → mensagem anônima (sem vazar o remetente na
 * tela, no HTML nem nas respostas de rede) → páginas pessoais. Em cada tela: sem erros no console, sem rolagem lateral
 * no celular e acessibilidade (axe, WCAG 2 A/AA: violações sérias ou críticas reprovam).
 */
import { BASE, SAIDA, acessibilidade, criarPessoa, entrar, novoContexto, playwright, resumo, sbAdmin, semRolagemHorizontal, verificar, vigiarErros } from "./apoio.mjs";

const erros = [];
const a11y = [];
const navegador = await playwright.chromium.launch();

async function abrir(contexto) {
  const page = await contexto.newPage();
  vigiarErros(page, erros);
  return page;
}

async function conferirTela(page, nome, { celular = false } = {}) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.screenshot({ path: `${SAIDA}${nome}.png`, fullPage: false });
  if (celular) verificar(await semRolagemHorizontal(page), `${nome}: sem rolagem lateral no celular`);
  const r = await acessibilidade(page, nome);
  if (!r.pulado) a11y.push(...r.violacoes.map((v) => `${nome}: ${v.id}`));
}

function local(diasDaqui) {
  const d = new Date(Date.now() + diasDaqui * 86400e3 - 3 * 3600e3); // horário de São Paulo
  return d.toISOString().slice(0, 16);
}

try {
  const ana = await criarPessoa("Ana Organizadora");
  const bruno = await criarPessoa("Bruno Participante");

  // ------------------------------------------------------------------------------------------- 1) página inicial
  console.log("\n1. Página inicial");
  const visitante = await novoContexto(navegador, { celular: true });
  const pv = await abrir(visitante);
  await pv.goto(`${BASE}/`, { waitUntil: "networkidle" });
  verificar(await pv.getByRole("link", { name: /Criar amigo oculto/ }).first().isVisible(), "botão Criar amigo oculto");
  verificar((await pv.getByLabel(/código/i).count()) > 0, "campo de código de convite");
  await conferirTela(pv, "01-inicio-celular", { celular: true });
  await pv.goto(`${BASE}/entrar`, { waitUntil: "networkidle" });
  await conferirTela(pv, "02-entrar-celular", { celular: true });

  // ------------------------------------------------------------------------------- 2) criar pelo assistente (PC)
  console.log("\n2. Criar amigo oculto");
  const ctxAna = await novoContexto(navegador);
  const pa = await abrir(ctxAna);
  await entrar(pa, ana);
  const nome = `Amigo Oculto E2E ${Date.now().toString(36)}`;
  await pa.goto(`${BASE}/criar`, { waitUntil: "networkidle" });
  await pa.getByLabel("Nome do amigo oculto").fill(nome);
  await pa.getByRole("button", { name: "Avançar" }).click();
  await pa.getByRole("heading", { name: "Quando e onde" }).waitFor();
  await pa.getByLabel(/Data e horário da revelação/).fill(local(10));
  await pa.getByLabel(/Local do encontro/).fill("Salão de festas");
  await pa.getByRole("button", { name: "Avançar" }).click();
  await pa.getByRole("heading", { name: "Presentes" }).waitFor();
  await pa.getByLabel(/Valor mínimo/).fill("50");
  await pa.getByLabel(/Valor máximo/).fill("100");
  await pa.getByRole("button", { name: "Avançar" }).click();
  await pa.getByRole("heading", { name: "Participação e sorteio" }).waitFor();
  await pa.getByRole("button", { name: "Avançar" }).click();
  await pa.getByRole("heading", { name: "Regras" }).waitFor();
  await pa.getByRole("button", { name: "Revisar" }).click();
  await pa.getByRole("heading", { name: "Revisão" }).waitFor();
  await Promise.all([
    pa.waitForURL(/\/grupo\/[0-9a-f-]+\/compartilhar/, { timeout: 60000 }),
    pa.getByRole("button", { name: "Criar amigo oculto" }).click(),
  ]);
  const eventoId = /\/grupo\/([0-9a-f-]+)\//.exec(pa.url())[1];
  verificar(!!eventoId, "evento criado");
  await pa.waitForLoadState("networkidle");
  const codigo = (await pa.locator("p.font-mono").first().textContent()).trim();
  verificar(/^[A-Z0-9]{8}$/.test(codigo), `código exclusivo (${codigo})`);
  verificar((await pa.locator('svg[aria-label="QR Code do convite"]').count()) > 0, "QR Code do convite");
  const whats = await pa.getByRole("link", { name: /WhatsApp/ }).getAttribute("href");
  verificar(whats.startsWith("https://wa.me/?text=") && decodeURIComponent(whats).includes(`/convite/${codigo}`), "link do WhatsApp com o convite");
  await conferirTela(pa, "03-compartilhar-pc");

  // ------------------------------------------------------------------------- 3) entrar pelo convite (com conta)
  console.log("\n3. Entrar pelo convite");
  const ctxBruno = await novoContexto(navegador, { celular: true });
  const pb = await abrir(ctxBruno);
  await entrar(pb, bruno);
  await pb.goto(`${BASE}/convite/${codigo}`, { waitUntil: "networkidle" });
  await conferirTela(pb, "04-convite-celular", { celular: true });
  await Promise.all([pb.waitForURL(new RegExp(`/grupo/${eventoId}$`), { timeout: 60000 }), pb.getByRole("button", { name: "Participar" }).first().click()]);
  verificar(true, "Bruno entrou com a conta dele");

  // ------------------------------------------------------------------- 4) convidado sem cadastro (sessão anônima)
  const ctxGil = await novoContexto(navegador, { celular: true });
  const pg = await abrir(ctxGil);
  await pg.goto(`${BASE}/convite/${codigo.toLowerCase()}`, { waitUntil: "networkidle" });
  await pg.getByRole("button", { name: "Participar sem cadastro" }).click();
  await pg.getByLabel("Como você quer aparecer no grupo?").fill("Gil Convidado");
  await Promise.all([pg.waitForURL(new RegExp(`/grupo/${eventoId}$`), { timeout: 60000 }), pg.getByRole("button", { name: "Entrar no grupo" }).click()]);
  verificar(true, "convidado entrou sem cadastro");
  await conferirTela(pg, "05-sala-convidado-celular", { celular: true });
  const { count } = await sbAdmin.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventoId).eq("status", "approved");
  verificar(count === 3, `3 participantes aprovados no banco (${count})`);

  // ------------------------------------------------------------------------------------------------ 5) sortear
  console.log("\n4. Sorteio");
  await pa.goto(`${BASE}/grupo/${eventoId}/admin?aba=sorteio`, { waitUntil: "networkidle" });
  const respostasAna = [];
  pa.on("response", async (r) => {
    try {
      if (/supabase|\/grupo\//.test(r.url()) && (r.headers()["content-type"] ?? "").match(/json|text/)) respostasAna.push(await r.text());
    } catch {}
  });
  await pa.getByRole("button", { name: "Realizar sorteio agora" }).click();
  await pa.getByRole("button", { name: "Sortear agora" }).click();
  await pa.getByRole("heading", { name: "Sorteio realizado" }).waitFor({ timeout: 60000 });
  await conferirTela(pa, "06-admin-sorteado-pc");
  const { data: pares } = await sbAdmin.from("assignments").select("giver_id, receiver_id").eq("event_id", eventoId);
  const { data: ps } = await sbAdmin.from("participants").select("id, user_id, profiles(display_name)").eq("event_id", eventoId);
  verificar(pares.length === 3 && new Set(pares.map((p) => p.receiver_id)).size === 3 && pares.every((p) => p.giver_id !== p.receiver_id), "sorteio válido no banco");
  // o painel do organizador não recebe os pares
  const idsParticipantes = ps.map((p) => p.id);
  const vazouAdmin = respostasAna.some((t) => /receiver_id|giver_id/.test(t)) || (await pa.content()).match(/receiver_id|giver_id/);
  verificar(!vazouAdmin, "painel do organizador sem nenhum par (tela e rede)");
  void idsParticipantes;

  // ---------------------------------------------------------------------------------------------- 6) revelação
  console.log("\n5. Revelação");
  const partBruno = ps.find((p) => p.user_id === bruno.id);
  const alvoBruno = ps.find((p) => p.id === pares.find((x) => x.giver_id === partBruno.id).receiver_id);
  const nomeAlvo = alvoBruno.profiles.display_name;
  await pb.goto(`${BASE}/grupo/${eventoId}/revelacao`, { waitUntil: "networkidle" });
  const textoAntes = await pb.evaluate(() => document.body.innerText);
  verificar(!textoAntes.includes(nomeAlvo), "antes de abrir o presente o nome não aparece na tela");
  await pb.getByRole("button", { name: /Toque no presente/ }).click();
  await pb.waitForFunction((n) => document.body.innerText.includes(n), nomeAlvo, { timeout: 20000 });
  verificar(true, `revelação mostra quem o Bruno tirou (${nomeAlvo})`);
  await pb.waitForTimeout(1500);
  await conferirTela(pb, "07-revelacao-celular", { celular: true });
  const { data: viu } = await sbAdmin.from("participants").select("result_viewed_at").eq("id", partBruno.id).single();
  verificar(!!viu.result_viewed_at, "o \"já viu\" foi gravado");

  // ------------------------------------------------------------------------------ 7) mensagem anônima sem vazar
  console.log("\n6. Mensagens anônimas");
  await pb.goto(`${BASE}/grupo/${eventoId}/mensagens`, { waitUntil: "networkidle" });
  const pergunta = `Qual seu tamanho de camiseta? ${Date.now().toString(36)}`;
  const painel = pb.locator("#painel-receiver");
  await painel.locator("textarea").fill(pergunta);
  await painel.getByRole("button", { name: "Enviar em segredo" }).click();
  await pb.waitForFunction((t) => document.body.innerText.includes(t), pergunta, { timeout: 15000 });
  verificar(true, "mensagem anônima enviada");
  // quem recebe: Ana ou o convidado
  const paginaAlvo = alvoBruno.user_id === ana.id ? pa : pg;
  const respostasAlvo = [];
  paginaAlvo.on("response", async (r) => {
    try {
      if ((r.headers()["content-type"] ?? "").match(/json|text|x-component/)) respostasAlvo.push(await r.text());
    } catch {}
  });
  await paginaAlvo.goto(`${BASE}/grupo/${eventoId}/mensagens`, { waitUntil: "networkidle" });
  await paginaAlvo.waitForFunction((t) => document.body.innerText.includes(t), pergunta, { timeout: 15000 });
  const textoAlvo = await paginaAlvo.evaluate(() => document.body.innerText);
  const htmlAlvo = await paginaAlvo.content();
  verificar(textoAlvo.includes("Seu amigo oculto"), "quem recebe vê \"Seu amigo oculto\"");
  verificar(!textoAlvo.includes("Bruno"), "a tela de quem recebe não mostra quem mandou");
  verificar(!htmlAlvo.includes(bruno.id) && !htmlAlvo.includes(partBruno.id), "o HTML de quem recebe não tem o id de quem mandou");
  verificar(!respostasAlvo.some((t) => t.includes(bruno.id) || t.includes(partBruno.id) || t.includes("Bruno Participante")), "nenhuma resposta de rede de quem recebe traz quem mandou");
  await conferirTela(paginaAlvo, "08-mensagens-quem-recebe", { celular: paginaAlvo === pg });

  // ------------------------------------------------------------------------------------- 8) páginas pessoais
  console.log("\n7. Páginas da sala e pessoais");
  for (const [caminho, nomeTela] of [
    [`/grupo/${eventoId}`, "09-sala"],
    [`/grupo/${eventoId}/participantes`, "10-participantes"],
    [`/grupo/${eventoId}/chat`, "11-chat"],
    [`/grupo/${eventoId}/jogos`, "12-jogos"],
    ["/painel", "13-painel"],
    ["/lista-de-desejos", "14-lista-de-desejos"],
    ["/notificacoes", "15-notificacoes"],
    ["/conta", "16-conta"],
  ]) {
    await pb.goto(`${BASE}${caminho}`, { waitUntil: "networkidle" });
    verificar(!(await pb.title()).includes("404") && (await pb.locator("main").count()) > 0, `${nomeTela} abre`);
    await conferirTela(pb, `${nomeTela}-celular`, { celular: true });
  }
  // modo escuro no PC
  const ctxEscuro = await novoContexto(navegador, { escuro: true });
  const pe = await abrir(ctxEscuro);
  await entrar(pe, bruno);
  await pe.goto(`${BASE}/grupo/${eventoId}`, { waitUntil: "networkidle" });
  verificar(await pe.evaluate(() => getComputedStyle(document.body).backgroundColor !== "rgb(251, 247, 239)"), "modo escuro segue o sistema");
  await conferirTela(pe, "17-sala-escuro-pc");

  // proteção: quem não participa não abre a sala
  const intruso = await criarPessoa("Intrusa");
  const ctxIntruso = await novoContexto(navegador);
  const pi = await abrir(ctxIntruso);
  await entrar(pi, intruso);
  const resp = await pi.goto(`${BASE}/grupo/${eventoId}/revelacao`);
  verificar(resp.status() === 404, `quem não participa recebe 404 na revelação (${resp.status()})`);
} catch (e) {
  console.error(e);
  verificar(false, `exceção: ${e.message}`);
}

await navegador.close();
const reais = erros.filter((e) => !/status of 404/.test(e));
verificar(reais.length === 0, `sem erros de JavaScript no console${reais.length ? `: ${reais.slice(0, 5).join(" | ")}` : ""}`);
verificar(a11y.length === 0, `acessibilidade sem violações sérias${a11y.length ? `: ${[...new Set(a11y)].join(", ")}` : ""}`);
process.exit(resumo() ? 1 : 0);
