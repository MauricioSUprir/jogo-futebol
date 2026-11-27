/**
 * Segurança do sorteio contra o Supabase de verdade (local): RLS, permissões das funções e respostas da API.
 * Rodar com o Supabase local no ar: npm run db:start && npm run test:integracao
 */
import { describe, expect, it } from "vitest";
import { executarSorteio } from "@/lib/sorteio/servico";
import { admin, anonimo, convidado, erro, grupo, ok, participanteDe, pessoa } from "./apoio";

type Resultado = { status: string; receiver?: { participant_id: string; user_id: string; display_name: string } };

describe("sorteio seguro", () => {
  it("cada um vê só o seu resultado; a permutação é válida; o organizador não vê os pares", async () => {
    const g = await grupo(5);
    const guest = await convidado("Convidada Bia");
    await ok(guest.c.rpc("join_event", { p_code: g.codigo }));
    const todos = [...g.todos, guest];

    // antes do sorteio: ninguém tem resultado
    const antes = (await ok(g.membros[0].c.rpc("my_assignment", { p_event: g.id }))) as Resultado;
    expect(antes.status).toBe("open");
    expect(antes.receiver).toBeUndefined();

    const r = await executarSorteio({ eventoId: g.id, autorId: g.dono.id });
    expect(r.versao).toBe(1);
    expect(r.participantes).toBe(7);

    const recebidos = new Set<string>();
    for (const p of todos) {
      const meu = (await ok(p.c.rpc("my_assignment", { p_event: g.id }))) as Resultado;
      expect(meu.status).toBe("drawn");
      expect(meu.receiver).toBeTruthy();
      expect(meu.receiver!.user_id).not.toBe(p.id);
      recebidos.add(meu.receiver!.participant_id);
    }
    expect(recebidos.size).toBe(7);

    // o organizador NÃO lê a tabela de resultados (nem nenhum membro)
    expect(await erro(g.dono.c.from("assignments").select("*"))).toMatch(/permission denied/);
    expect(await erro(g.membros[1].c.from("assignments").select("giver_id, receiver_id"))).toMatch(/permission denied/);
    expect(await erro(anonimo().from("assignments").select("*"))).toMatch(/permission denied/);

    // o organizador não consegue gravar um sorteio escolhido por ele nem ler a entrada do algoritmo
    expect(await erro(g.dono.c.rpc("commit_draw", { p_event: g.id, p_pairs: [], p_expected_version: 1, p_redraw: true }))).toMatch(
      /permission denied/,
    );
    expect(await erro(g.dono.c.rpc("draw_input", { p_event: g.id }))).toMatch(/permission denied/);
    expect(await erro(g.dono.c.rpc("cron_due_draws"))).toMatch(/permission denied/);
    expect(await erro(g.dono.c.rpc("claim_notifications", { p_limit: 5 }))).toMatch(/permission denied/);

    // estatísticas do organizador não trazem pares
    const stats = await ok(g.dono.c.rpc("admin_event_stats", { p_event: g.id }));
    expect(JSON.stringify(stats)).not.toMatch(/receiver|giver/);

    // quem é de fora não vê o grupo nem o resultado
    const estranho = await pessoa("Estranho");
    expect(await erro(estranho.c.rpc("my_assignment", { p_event: g.id }))).toMatch(/forbidden/);
    expect(await ok(estranho.c.from("participants").select("*").eq("event_id", g.id))).toHaveLength(0);
    expect(await ok(estranho.c.from("events").select("*").eq("id", g.id))).toHaveLength(0);
  });

  it("respeita as restrições em 25 sorteios seguidos (refazendo) e invalida o resultado anterior", async () => {
    const g = await grupo(3);
    const ids = await Promise.all(g.todos.map((p) => participanteDe(g.dono.c, g.id, p.id)));
    // dono e membro0 não se tiram (mútuo); membro1 não tira membro2
    await ok(g.dono.c.from("restrictions").insert({ event_id: g.id, giver_id: ids[0], receiver_id: ids[1], mutual: true }));
    await ok(g.dono.c.from("restrictions").insert({ event_id: g.id, giver_id: ids[2], receiver_id: ids[3], mutual: false }));
    // membro comum não vê nem cria restrições
    expect(await ok(g.membros[0].c.from("restrictions").select("*").eq("event_id", g.id))).toHaveLength(0);
    expect(await erro(g.membros[0].c.from("restrictions").insert({ event_id: g.id, giver_id: ids[1], receiver_id: ids[2] }))).toBeTruthy();

    await executarSorteio({ eventoId: g.id, autorId: g.dono.id });
    for (let i = 0; i < 25; i++) {
      const pares = new Map<string, string>();
      for (let k = 0; k < g.todos.length; k++) {
        const r = (await ok(g.todos[k].c.rpc("my_assignment", { p_event: g.id }))) as Resultado;
        pares.set(ids[k], r.receiver!.participant_id);
      }
      expect(pares.get(ids[0])).not.toBe(ids[1]);
      expect(pares.get(ids[1])).not.toBe(ids[0]);
      expect(pares.get(ids[2])).not.toBe(ids[3]);
      await executarSorteio({ eventoId: g.id, autorId: g.dono.id, refazer: true, motivo: "teste" });
    }
    const { data: ev } = await g.dono.c.from("events").select("draw_version").eq("id", g.id).single();
    expect(ev!.draw_version).toBe(26);
    // todos foram avisados do sorteio refeito
    const avisos = await ok(g.membros[1].c.from("notifications").select("kind").eq("event_id", g.id).eq("kind", "redraw"));
    expect(avisos.length).toBe(25);
    // restrições não mudam mais depois do sorteio
    expect(await erro(g.dono.c.from("restrictions").insert({ event_id: g.id, giver_id: ids[1], receiver_id: ids[2] }))).toBeTruthy();
  });

  it("recusa sorteio impossível e com menos de 3 pessoas", async () => {
    const g = await grupo(2);
    const ids = await Promise.all(g.todos.map((p) => participanteDe(g.dono.c, g.id, p.id)));
    // a organizadora não pode tirar nenhum dos dois: impossível
    await ok(g.dono.c.from("restrictions").insert({ event_id: g.id, giver_id: ids[0], receiver_id: ids[1], mutual: false }));
    await ok(g.dono.c.from("restrictions").insert({ event_id: g.id, giver_id: ids[0], receiver_id: ids[2], mutual: false }));
    await expect(executarSorteio({ eventoId: g.id, autorId: g.dono.id })).rejects.toThrow(/impossivel/);

    const pequeno = await grupo(1);
    await expect(executarSorteio({ eventoId: pequeno.id, autorId: pequeno.dono.id })).rejects.toThrow(/poucos_participantes|not_enough/);
  });

  it("o banco recusa pares adulterados mesmo vindos do servidor", async () => {
    const g = await grupo(3);
    const ids = await Promise.all(g.todos.map((p) => participanteDe(g.dono.c, g.id, p.id)));
    const sv = admin();
    const consigo = ids.map((id) => ({ giver: id, receiver: id }));
    expect(await erro(sv.rpc("commit_draw", { p_event: g.id, p_pairs: consigo, p_expected_version: 0 }))).toBe("invalid_draw_self");
    const duplicado = ids.map((id, i) => ({ giver: id, receiver: ids[(i + 1) % 2] }));
    expect(await erro(sv.rpc("commit_draw", { p_event: g.id, p_pairs: duplicado, p_expected_version: 0 }))).toBe("roster_changed");
    const faltando = ids.slice(1).map((id, i, a) => ({ giver: id, receiver: a[(i + 1) % a.length] }));
    expect(await erro(sv.rpc("commit_draw", { p_event: g.id, p_pairs: faltando, p_expected_version: 0 }))).toBe("roster_changed");
    const valido = ids.map((id, i) => ({ giver: id, receiver: ids[(i + 1) % ids.length] }));
    expect(await erro(sv.rpc("commit_draw", { p_event: g.id, p_pairs: valido, p_expected_version: 7 }))).toBe("version_conflict");
    // não-organizador como autor
    expect(
      await erro(sv.rpc("commit_draw", { p_event: g.id, p_pairs: valido, p_expected_version: 0, p_actor: g.membros[0].id })),
    ).toBe("forbidden");
  });

  it("depois do sorteio ninguém entra, sai ou é removido", async () => {
    const g = await grupo(3);
    await executarSorteio({ eventoId: g.id, autorId: g.dono.id });
    const novato = await pessoa("Atrasado");
    expect(await erro(novato.c.rpc("join_event", { p_code: g.codigo }))).toBe("event_closed");
    expect(await erro(g.membros[0].c.rpc("leave_event", { p_event: g.id }))).toBe("locked_after_draw");
    const alvo = await participanteDe(g.dono.c, g.id, g.membros[1].id);
    expect(await erro(g.dono.c.rpc("remove_participant", { p_participant: alvo }))).toBe("locked_after_draw");
    // o resultado de quem tentou sair continua lá
    const r = (await ok(g.membros[0].c.rpc("my_assignment", { p_event: g.id }))) as Resultado;
    expect(r.receiver).toBeTruthy();
  });

  it("aprovação: pendente não entra no sorteio e é avisado", async () => {
    const g = await grupo(3, { requires_approval: true });
    // com aprovação, os 3 ficaram pendentes; aprova 2
    const { data: pend } = await g.dono.c.from("participants").select("id, user_id, status").eq("event_id", g.id).eq("status", "pending");
    expect(pend).toHaveLength(3);
    await ok(g.dono.c.rpc("approve_participant", { p_participant: pend![0].id, p_approve: true }));
    await ok(g.dono.c.rpc("approve_participant", { p_participant: pend![1].id, p_approve: true }));
    const r = await executarSorteio({ eventoId: g.id, autorId: g.dono.id });
    expect(r.participantes).toBe(3);
    const pendente = g.membros.find((m) => m.id === pend![2].user_id)!;
    expect(await erro(pendente.c.rpc("my_assignment", { p_event: g.id }))).toBe("forbidden");
    const avisos = await ok(pendente.c.from("notifications").select("kind").eq("kind", "rejected"));
    expect(avisos.length).toBeGreaterThan(0);
  });
});

describe("prévia do convite e grupos públicos", () => {
  it("visitante vê só o resumo pelo código; código errado devolve nada", async () => {
    const g = await grupo(2);
    const prev = (await ok(anonimo().rpc("event_preview", { p_code: g.codigo.toLowerCase() }))) as Record<string, unknown>;
    expect(prev.name).toBe("Amigo oculto de teste");
    expect(prev.participant_count).toBe(3);
    expect(prev.accepting).toBe(true);
    expect(Object.keys(prev)).not.toContain("invite_code");
    expect(await ok(anonimo().rpc("event_preview", { p_code: "ZZZZZZZZ" }))).toBeNull();
    // visitante não lê tabelas
    expect(await erro(anonimo().from("events").select("*"))).toMatch(/permission denied/);
  });
});
