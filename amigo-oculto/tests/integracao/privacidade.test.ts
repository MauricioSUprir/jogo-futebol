/**
 * Privacidade: mensagens anônimas, denúncias, jogos, cápsula do tempo, revelação ao vivo e álbum.
 * Nenhuma resposta da API pode entregar quem tirou quem antes da hora.
 */
import { describe, expect, it } from "vitest";
import { executarSorteio } from "@/lib/sorteio/servico";
import { admin, erro, grupo, ok, participanteDe, pessoa, type Pessoa } from "./apoio";

type Meu = { receiver: { participant_id: string; user_id: string; display_name: string } };

async function sorteado(n = 4) {
  const g = await grupo(n);
  await executarSorteio({ eventoId: g.id, autorId: g.dono.id });
  const resultado = new Map<string, Meu["receiver"]>();
  for (const p of g.todos) resultado.set(p.id, ((await ok(p.c.rpc("my_assignment", { p_event: g.id }))) as Meu).receiver);
  /** quem tirou a pessoa `alvo` */
  const santaDe = (alvo: Pessoa) => g.todos.find((p) => resultado.get(p.id)!.user_id === alvo.id)!;
  return { ...g, resultado, santaDe };
}

describe("mensagens anônimas", () => {
  it("quem recebe nunca vê quem mandou — nem nas respostas da API", async () => {
    const g = await sorteado(4);
    const alvo = g.membros[0];
    const santa = g.santaDe(alvo);
    await ok(santa.c.rpc("send_secret_message", { p_event: g.id, p_to: "receiver", p_kind: "question", p_body: "Qual seu número de calçado? 😊" }));
    await ok(santa.c.rpc("send_secret_message", { p_event: g.id, p_to: "receiver", p_kind: "clue", p_body: "Eu adoro café." }));

    const threads = (await ok(alvo.c.rpc("secret_threads", { p_event: g.id }))) as {
      with_santa: { messages: { body: string; mine: boolean; kind: string }[] };
    };
    expect(threads.with_santa.messages.map((m) => m.body)).toEqual(["Qual seu número de calçado? 😊", "Eu adoro café."]);
    const bruto = JSON.stringify(threads.with_santa);
    const idParticipanteSanta = await participanteDe(g.dono.c, g.id, santa.id);
    expect(bruto).not.toContain(santa.id);
    expect(bruto).not.toContain(idParticipanteSanta);
    expect(bruto).not.toContain(santa.nome);
    expect(bruto).not.toMatch(/assignment|giver/);

    // resposta do alvo chega ao santa
    await ok(alvo.c.rpc("send_secret_message", { p_event: g.id, p_to: "santa", p_kind: "message", p_body: "Calço 38!" }));
    const doSanta = (await ok(santa.c.rpc("secret_threads", { p_event: g.id }))) as {
      with_receiver: { receiver_name: string; messages: { body: string; mine: boolean }[] };
    };
    expect(doSanta.with_receiver.receiver_name).toBe(alvo.nome);
    expect(doSanta.with_receiver.messages.map((m) => [m.body, m.mine])).toEqual([
      ["Qual seu número de calçado? 😊", true],
      ["Eu adoro café.", true],
      ["Calço 38!", false],
    ]);

    // a notificação também não entrega o remetente
    const notif = await ok(alvo.c.from("notifications").select("title, body, link").eq("kind", "secret_message"));
    expect(JSON.stringify(notif)).not.toContain(santa.nome);

    // ninguém (nem o organizador) lê a tabela
    expect(await erro(g.dono.c.from("secret_messages").select("*"))).toMatch(/permission denied/);
  });

  it("denúncia: some para quem denunciou, o organizador vê o texto mas não o remetente, e pode silenciar sem saber quem é", async () => {
    const g = await sorteado(4);
    const alvo = g.membros[1];
    const santa = g.santaDe(alvo);
    const id = await ok(santa.c.rpc("send_secret_message", { p_event: g.id, p_to: "receiver", p_kind: "message", p_body: "mensagem chata" }));
    // outra pessoa não pode denunciar a mensagem
    const outro = g.todos.find((p) => p.id !== alvo.id && p.id !== santa.id)!;
    expect(await erro(outro.c.rpc("report_secret_message", { p_message: id as string }))).toBe("forbidden");
    await ok(alvo.c.rpc("report_secret_message", { p_message: id as string, p_reason: "spam" }));
    const t = (await ok(alvo.c.rpc("secret_threads", { p_event: g.id }))) as { with_santa: { messages: { body: string | null; hidden: boolean }[] } };
    expect(t.with_santa.messages[0]).toMatchObject({ body: null, hidden: true });

    const denuncias = await ok(g.dono.c.from("reports").select("*").eq("event_id", g.id));
    expect(denuncias).toHaveLength(1);
    expect(denuncias[0].snapshot).toBe("mensagem chata");
    const bruto = JSON.stringify(denuncias);
    expect(bruto).not.toContain(santa.id);
    expect(bruto).not.toContain(santa.nome);

    await ok(g.dono.c.rpc("resolve_report", { p_report: denuncias[0].id, p_action: "muted" }));
    expect(await erro(santa.c.rpc("send_secret_message", { p_event: g.id, p_to: "receiver", p_kind: "message", p_body: "de novo" }))).toBe(
      "secret_blocked",
    );
  });

  it("bloqueio pelo destinatário", async () => {
    const g = await sorteado(3);
    const alvo = g.membros[0];
    const santa = g.santaDe(alvo);
    await ok(alvo.c.rpc("block_secret_santa", { p_event: g.id, p_block: true }));
    expect(await erro(santa.c.rpc("send_secret_message", { p_event: g.id, p_to: "receiver", p_kind: "message", p_body: "oi" }))).toBe(
      "secret_blocked",
    );
    await ok(alvo.c.rpc("block_secret_santa", { p_event: g.id, p_block: false }));
    await ok(santa.c.rpc("send_secret_message", { p_event: g.id, p_to: "receiver", p_kind: "message", p_body: "oi" }));
  });
});

describe("jogos sem vazar o sorteio", () => {
  it("palpite: sem resposta antes do encerramento; depois, só o próprio acerto", async () => {
    const g = await sorteado(4);
    const eu = g.membros[2];
    const santa = g.santaDe(eu);
    const idSanta = await participanteDe(g.dono.c, g.id, santa.id);
    await ok(eu.c.rpc("save_guess", { p_event: g.id, p_guessed: idSanta }));
    const antes = (await ok(eu.c.rpc("my_guess", { p_event: g.id }))) as Record<string, unknown>;
    expect(antes.correct).toBeUndefined();
    expect(antes.guessed_id).toBe(idSanta);
    expect(await erro(eu.c.from("guesses").select("*"))).toMatch(/permission denied/);
    await ok(g.dono.c.rpc("finish_event", { p_event: g.id }));
    const depois = (await ok(eu.c.rpc("my_guess", { p_event: g.id }))) as Record<string, unknown>;
    expect(depois.correct).toBe(true);
    expect(depois.total_correct).toBe(1);
  });

  it("quiz: a resposta certa só aparece para quem já respondeu ou para o autor", async () => {
    const g = await grupo(3);
    const autor = g.membros[0];
    await ok(autor.c.rpc("quiz_create", { p_event: g.id, p_question: "Minha comida favorita?", p_options: ["Pizza", "Sushi", "Feijoada"], p_correct: 2 }));
    const outro = g.membros[1];
    const lista = (await ok(outro.c.rpc("quiz_list", { p_event: g.id }))) as { id: string; correct_index: number | null }[];
    expect(lista[0].correct_index).toBeNull();
    expect(await erro(outro.c.from("quiz_questions").select("correct_index"))).toMatch(/permission denied/);
    const resp = (await ok(outro.c.rpc("quiz_answer", { p_question: lista[0].id, p_choice: 2 }))) as { correct: boolean };
    expect(resp.correct).toBe(true);
    expect(await erro(outro.c.rpc("quiz_answer", { p_question: lista[0].id, p_choice: 1 }))).toBe("quiz_answered");
    expect(await erro(autor.c.rpc("quiz_answer", { p_question: lista[0].id, p_choice: 0 }))).toBe("quiz_own");
  });

  it("cápsula do tempo fica lacrada para o grupo até a data", async () => {
    const g = await grupo(3);
    const autor = g.membros[0];
    const abre = new Date(Date.now() + 3 * 86400_000).toISOString();
    await ok(autor.c.from("time_capsules").insert({ event_id: g.id, body: "Mensagem para o futuro", open_at: abre }));
    expect(await ok(autor.c.from("time_capsules").select("body").eq("event_id", g.id))).toHaveLength(1);
    expect(await ok(g.membros[1].c.from("time_capsules").select("body").eq("event_id", g.id))).toHaveLength(0);
    const resumo = (await ok(g.membros[1].c.rpc("capsule_summary", { p_event: g.id }))) as { sealed: number };
    expect(resumo.sealed).toBe(1);
    // ninguém lacra com data no passado
    expect(await erro(autor.c.from("time_capsules").insert({ event_id: g.id, body: "x", open_at: new Date().toISOString() }))).toBeTruthy();
  });

  it("bingo: cartela com 24 itens distintos e o centro livre; só marca o que foi chamado; bingo conferido no servidor", async () => {
    const g = await grupo(3);
    const jogo = (await ok(g.dono.c.rpc("bingo_new", { p_event: g.id }))) as string;
    const j = g.membros[0];
    await ok(j.c.rpc("bingo_join", { p_game: jogo }));
    const { data: cartela } = await j.c.from("bingo_cards").select("*").eq("game_id", jogo).single();
    expect(cartela!.cells[12]).toBe(-1);
    expect(new Set(cartela!.cells.filter((c: number) => c >= 0)).size).toBe(24);
    // não marca o que não foi chamado
    expect(await erro(j.c.rpc("bingo_mark", { p_game: jogo, p_position: 0 }))).toBe("bingo_not_called");
    expect(await ok(j.c.rpc("bingo_claim", { p_game: jogo }))).toBe(false);
    // chama tudo e completa a 1ª linha
    for (let i = 0; i < 75; i++) await ok(g.dono.c.rpc("bingo_call", { p_game: jogo }));
    for (const pos of [0, 1, 2, 3, 4]) await ok(j.c.rpc("bingo_mark", { p_game: jogo, p_position: pos }));
    expect(await ok(j.c.rpc("bingo_claim", { p_game: jogo }))).toBe(true);
    // membro não chama número
    expect(await erro(j.c.rpc("bingo_call", { p_game: jogo }))).toBe("forbidden");
    // cartela dos outros é privada
    expect(await ok(g.membros[1].c.from("bingo_cards").select("*").eq("game_id", jogo))).toHaveLength(0);
  });

  it("cartão anônimo só para quem você tirou, e chega sem o nome de quem mandou", async () => {
    const g = await sorteado(3);
    const eu = g.membros[0];
    const meuAlvo = g.resultado.get(eu.id)!;
    const outroQualquer = await participanteDe(
      g.dono.c,
      g.id,
      g.todos.find((p) => p.id !== eu.id && p.id !== meuAlvo.user_id)!.id,
    );
    expect(
      await erro(eu.c.rpc("send_card", { p_event: g.id, p_recipient: outroQualquer, p_template: "estrela", p_title: "Oi", p_body: "x", p_anonymous: true })),
    ).toBe("card_anonymous_only_receiver");
    await ok(eu.c.rpc("send_card", { p_event: g.id, p_recipient: meuAlvo.participant_id, p_template: "estrela", p_title: "Feliz Natal", p_body: "Com carinho", p_anonymous: true }));
    const alvo = g.todos.find((p) => p.id === meuAlvo.user_id)!;
    const cartoes = (await ok(alvo.c.rpc("my_cards", { p_event: g.id }))) as { received: Record<string, unknown>[] };
    expect(cartoes.received[0].sender_name).toBeNull();
    expect(JSON.stringify(cartoes)).not.toContain(eu.nome);
    expect(await erro(alvo.c.from("cards").select("*"))).toMatch(/permission denied/);
  });
});

describe("revelação ao vivo e álbum", () => {
  it("só o próprio revela (ou o organizador com autorização); a corrente segue quem foi revelado", async () => {
    const g = await sorteado(4);
    await ok(g.dono.c.rpc("live_start", { p_event: g.id, p_mode: "chain", p_seconds: 30 }));
    const { data: s } = await g.dono.c.from("live_sessions").select("*").eq("event_id", g.id).single();
    const ids = new Map<string, Pessoa>();
    for (const p of g.todos) ids.set(await participanteDe(g.dono.c, g.id, p.id), p);
    const atual = ids.get(s!.current_id!)!;

    // nada revelado ainda
    expect(await ok(g.membros[0].c.from("live_reveals").select("*").eq("event_id", g.id))).toHaveLength(0);
    // o organizador não revela por quem não autorizou (a menos que seja ele mesmo o da vez)
    if (atual.id !== g.dono.id) {
      expect(await erro(g.dono.c.rpc("live_reveal_for", { p_event: g.id, p_participant: s!.current_id! }))).toBe("reveal_not_authorized");
    }
    // quem não está na vez não revela
    const outro = g.todos.find((p) => p.id !== atual.id)!;
    expect(await erro(outro.c.rpc("live_reveal", { p_event: g.id }))).toBe("live_not_your_turn");

    await ok(atual.c.rpc("live_reveal", { p_event: g.id }));
    const revs = await ok(g.membros[1].c.from("live_reveals").select("*").eq("event_id", g.id));
    expect(revs).toHaveLength(1);
    const proximo = (await ok(g.dono.c.rpc("live_next", { p_event: g.id }))) as string;
    expect(proximo).toBe(revs[0].receiver_id); // corrente: quem foi revelado apresenta em seguida

    // autorização prévia: o organizador pode revelar pela pessoa
    const daVez = ids.get(proximo)!;
    await ok(daVez.c.from("participants").update({ allow_public_reveal: true }).eq("event_id", g.id).eq("user_id", daVez.id));
    await ok(g.dono.c.rpc("live_reveal_for", { p_event: g.id, p_participant: proximo }));
    expect(await ok(g.membros[0].c.from("live_reveals").select("*").eq("event_id", g.id))).toHaveLength(2);

    await ok(g.dono.c.rpc("live_finish", { p_event: g.id }));
    const { data: ev } = await g.dono.c.from("events").select("status").eq("id", g.id).single();
    expect(ev!.status).toBe("finished");
  });

  it("álbum privado: só membros leem e enviam (na própria pasta), com o álbum aberto", async () => {
    const g = await sorteado(3);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const membro = g.membros[0];
    // álbum ainda fechado
    expect(await erro(membro.c.storage.from("album").upload(`${g.id}/${membro.id}/a.png`, png, { contentType: "image/png" }))).toBeTruthy();
    await ok(g.dono.c.rpc("finish_event", { p_event: g.id }));
    await ok(membro.c.storage.from("album").upload(`${g.id}/${membro.id}/a.png`, png, { contentType: "image/png" }));
    await ok(membro.c.from("album_photos").insert({ event_id: g.id, storage_path: `${g.id}/${membro.id}/a.png`, caption: "Todos juntos" }));
    // na pasta de outra pessoa, não
    expect(await erro(membro.c.storage.from("album").upload(`${g.id}/${g.dono.id}/b.png`, png, { contentType: "image/png" }))).toBeTruthy();
    // membro gera URL assinada; estranho não
    await ok(g.membros[1].c.storage.from("album").createSignedUrl(`${g.id}/${membro.id}/a.png`, 60));
    const estranho = await pessoa("Curioso");
    expect(await erro(estranho.c.storage.from("album").createSignedUrl(`${g.id}/${membro.id}/a.png`, 60))).toBeTruthy();
    expect(await ok(estranho.c.from("album_photos").select("*").eq("event_id", g.id))).toHaveLength(0);
    // bucket público de mídia: só na própria pasta
    await ok(membro.c.storage.from("media").upload(`${membro.id}/avatar.png`, png, { contentType: "image/png", upsert: true }));
    expect(await erro(membro.c.storage.from("media").upload(`${g.dono.id}/x.png`, png, { contentType: "image/png" }))).toBeTruthy();
    void admin;
  });
});
