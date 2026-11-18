"use server";
// STUDY CENTER: matérias, provas e trabalhos (na agenda), checklist, sessões de estudo e Pomodoro,
// conteúdos com revisões programadas, flashcards, notas, simulados, resumos e o plano da semana.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { salvarPref, lerPref } from "@/lib/servidor/prefs";
import { chaveNoFuso, chaveParaData, dataParaChave, diasEntre, hoje, inicioDaSemana, localParaUtc, somaDias, validaChave, validaHora } from "@/lib/datas";
import { CORES_HABITO } from "@/lib/catalogo";
import {
  CHECKLIST_PADRAO,
  TIPOS_SESSAO,
  configPomodoro,
  planejarSemana as planejar,
  proximaRevisao,
  registrarRevisao,
  responderCartao,
  tituloEstudo,
  type ConfigPomodoro,
} from "@/lib/estudos";
import type { Estado } from "./tipos";

function revalidar(agenda = false) {
  revalidatePath("/");
  revalidatePath("/estudos");
  if (agenda) {
    revalidatePath("/agenda");
    revalidatePath("/agenda/foco");
  }
}

const texto = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};
const bruto = (fd: FormData, campos: string[]) => Object.fromEntries(campos.map((k) => [k, texto(fd.get(k))]));
const idDe = (fd: FormData, campo = "id") => String(fd.get(campo) ?? "");

/** A matéria é do usuário? (null = sem matéria) */
async function materiaDoUsuario(userId: string, id: string | undefined): Promise<string | null | false> {
  if (!id) return null;
  const m = await db.subject.findFirst({ where: { id, userId }, select: { id: true } });
  return m ? m.id : false;
}

// ───────────── Matérias ─────────────

const esquemaMateria = z.object({
  nome: z.string().min(1, "Dê um nome à matéria.").max(60),
  cor: z.string().refine((c) => c in CORES_HABITO, "Cor inválida.").default("azul"),
  media: z.coerce.number().min(0, "Média entre 0 e 10.").max(10, "Média entre 0 e 10.").default(6),
  meta: z.coerce.number().int().min(0, "Meta semanal de 0 a 1.500 min.").max(1500, "Meta semanal de 0 a 1.500 min.").default(120),
});

export async function salvarMateria(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaMateria.safeParse(bruto(fd, ["nome", "cor", "media", "meta"]));
  if (!r.success) return { erro: r.error.issues[0].message };
  const dados = { name: r.data.nome, color: r.data.cor, targetAvg: r.data.media, weeklyGoalMin: r.data.meta };
  const id = idDe(fd);
  if (id) {
    const n = await db.subject.updateMany({ where: { id, userId: user.id }, data: dados });
    if (!n.count) return { erro: "Matéria não encontrada." };
  } else {
    const ja = await db.subject.findFirst({ where: { userId: user.id, name: { equals: r.data.nome, mode: "insensitive" }, archived: false } });
    if (ja) return { erro: "Você já tem uma matéria com esse nome." };
    const total = await db.subject.count({ where: { userId: user.id } });
    await db.subject.create({ data: { ...dados, userId: user.id, position: total } });
  }
  revalidar();
  return { ok: id ? "Matéria atualizada." : "Matéria criada." };
}

export async function arquivarMateria(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.subject.updateMany({ where: { id: idDe(fd), userId: user.id }, data: { archived: fd.get("valor") !== "0" } });
  revalidar();
}

/** Só matérias arquivadas podem ser excluídas (leva junto conteúdos e notas). */
export async function excluirMateria(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.subject.deleteMany({ where: { id: idDe(fd), userId: user.id, archived: true } });
  revalidar(true);
}

// ───────────── Provas e trabalhos (eventos da agenda) ─────────────

const esquemaProva = z.object({
  titulo: z.string().min(1, "Dê um título.").max(120),
  tipo: z.enum(["prova", "trabalho"]),
  materia: z.string().optional(),
  dia: z.string().refine(validaChave, "Data inválida."),
  inicio: z.string().refine(validaHora, "Horário inválido.").optional(),
  fim: z.string().refine(validaHora, "Horário final inválido.").optional(),
  notas: z.string().max(2000).optional(),
});

export async function salvarProva(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaProva.safeParse(bruto(fd, ["titulo", "tipo", "materia", "dia", "inicio", "fim", "notas"]));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const materia = await materiaDoUsuario(user.id, d.materia);
  if (materia === false) return { erro: "Matéria não encontrada." };
  const tz = user.timezone;
  let start: Date;
  let end: Date | null = null;
  const allDay = !d.inicio;
  if (allDay) start = chaveParaData(d.dia);
  else {
    start = localParaUtc(d.dia, d.inicio!, tz);
    if (d.fim) {
      end = localParaUtc(d.dia, d.fim, tz);
      if (end <= start) return { erro: "O fim precisa ser depois do início." };
    }
  }
  const dados = { title: d.titulo, category: d.tipo, allDay, start, end, notes: d.notas ?? null, subjectId: materia };
  const id = idDe(fd);
  if (id) {
    const n = await db.calendarEvent.updateMany({ where: { id, userId: user.id, category: { in: ["prova", "trabalho"] } }, data: dados });
    if (!n.count) return { erro: "Prova ou trabalho não encontrado." };
  } else {
    const ev = await db.calendarEvent.create({ data: { ...dados, userId: user.id } });
    if (d.tipo === "prova") {
      await db.checklistItem.createMany({ data: CHECKLIST_PADRAO.map((t, i) => ({ userId: user.id, eventId: ev.id, text: t, position: i })) });
    }
  }
  revalidar(true);
  return { ok: id ? "Atualizado." : d.tipo === "prova" ? "Prova marcada na agenda." : "Trabalho marcado na agenda." };
}

export async function excluirProva(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = idDe(fd);
  const n = await db.calendarEvent.deleteMany({ where: { id, userId: user.id, category: { in: ["prova", "trabalho"] } } });
  if (n.count) await db.checklistItem.deleteMany({ where: { userId: user.id, eventId: id } });
  revalidar(true);
}

export async function adicionarItemChecklist(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const eventId = idDe(fd, "evento");
  const t = texto(fd.get("texto"))?.slice(0, 120);
  if (!t) return;
  const ev = await db.calendarEvent.findFirst({ where: { id: eventId, userId: user.id }, select: { id: true } });
  if (!ev) return;
  const total = await db.checklistItem.count({ where: { userId: user.id, eventId } });
  await db.checklistItem.create({ data: { userId: user.id, eventId, text: t, position: total } });
  revalidar();
}

export async function alternarItemChecklist(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.checklistItem.updateMany({ where: { id: idDe(fd), userId: user.id }, data: { done: fd.get("valor") === "1" } });
  revalidar();
}

export async function excluirItemChecklist(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.checklistItem.deleteMany({ where: { id: idDe(fd), userId: user.id } });
  revalidar();
}

// ───────────── Sessões de estudo e Pomodoro ─────────────

const esquemaSessao = z.object({
  materia: z.string().optional(),
  minutos: z.coerce.number().int().min(1, "Mínimo de 1 minuto.").max(600, "Máximo de 10 h por registro."),
  tipo: z.string().refine((t) => t in TIPOS_SESSAO, "Tipo inválido.").default("estudo"),
  dia: z.string().optional(),
  hora: z.string().optional(),
  conteudo: z.string().max(120).optional(),
  notas: z.string().max(1000).optional(),
});

export async function registrarSessao(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaSessao.safeParse(bruto(fd, ["materia", "minutos", "tipo", "dia", "hora", "conteudo", "notas"]));
  if (!r.success) return { erro: r.error.issues[0].message };
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const dia = r.data.dia && validaChave(r.data.dia) ? r.data.dia : hojeK;
  if (diasEntre(dia, hojeK) < 0) return { erro: "Não dá para registrar no futuro." };
  if (diasEntre(dia, hojeK) > 30) return { erro: "Só dá para registrar até 30 dias atrás." };
  const materia = await materiaDoUsuario(user.id, r.data.materia);
  if (materia === false) return { erro: "Matéria não encontrada." };
  const at = r.data.hora && validaHora(r.data.hora) ? localParaUtc(dia, r.data.hora, tz) : dia === hojeK ? new Date() : localParaUtc(dia, "12:00", tz);
  if (at.getTime() > Date.now() + 60_000) return { erro: "Esse horário ainda não chegou." };
  await db.studySession.create({
    data: {
      userId: user.id,
      subjectId: materia,
      day: chaveParaData(dia),
      at,
      durationMin: r.data.minutos,
      kind: r.data.tipo,
      topic: r.data.conteudo ?? null,
      notes: r.data.notas ?? null,
    },
  });
  revalidar();
  return { ok: `Registrado: ${r.data.minutos} min.` };
}

/** Chamado pelo cronômetro ao fim de um foco (ou "concluir agora"). */
export async function registrarPomodoro(dados: { materiaId?: string | null; minutos: number; conteudo?: string | null }): Promise<Estado> {
  const user = await exigirUsuario();
  const minutos = Math.round(Number(dados.minutos));
  if (!Number.isFinite(minutos) || minutos < 1 || minutos > 180) return { erro: "Duração inválida." };
  const materia = await materiaDoUsuario(user.id, dados.materiaId ?? undefined);
  if (materia === false) return { erro: "Matéria não encontrada." };
  await db.studySession.create({
    data: {
      userId: user.id,
      subjectId: materia,
      day: chaveParaData(hoje(user.timezone)),
      at: new Date(),
      durationMin: minutos,
      kind: "pomodoro",
      topic: dados.conteudo?.trim().slice(0, 120) || null,
    },
  });
  revalidar();
  return { ok: `Foco de ${minutos} min registrado.` };
}

export async function excluirSessao(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.studySession.deleteMany({ where: { id: idDe(fd), userId: user.id } });
  revalidar();
}

export async function salvarConfigEstudos(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const cfg: ConfigPomodoro = configPomodoro({
    foco: Number(fd.get("foco")),
    curta: Number(fd.get("curta")),
    longa: Number(fd.get("longa")),
    cadaLonga: Number(fd.get("cadaLonga")),
  });
  const metaTotalTxt = texto(fd.get("metaTotal"));
  const metaTotal = metaTotalTxt === undefined ? null : Math.round(Number(metaTotalTxt));
  if (metaTotal !== null && (!Number.isFinite(metaTotal) || metaTotal < 0 || metaTotal > 5000)) return { erro: "Meta semanal total de 0 a 5.000 min." };
  const atual = lerPref<{ metaTotal: number | null }>(user, "estudos");
  await salvarPref(user.id, "estudos", { ...atual, ...cfg, metaTotal });
  revalidar();
  return { ok: "Configuração salva." };
}

// ───────────── Plano da semana (tarefas na agenda) ─────────────

export async function planejarSemana(_: Estado): Promise<Estado> {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const ini = inicioDaSemana(hojeK);
  const fim = somaDias(ini, 6);
  const [materias, sessoes, abertas, provas] = await Promise.all([
    db.subject.findMany({ where: { userId: user.id, archived: false }, orderBy: { position: "asc" } }),
    db.studySession.groupBy({ by: ["subjectId"], where: { userId: user.id, day: { gte: chaveParaData(ini), lte: chaveParaData(fim) } }, _sum: { durationMin: true } }),
    db.task.findMany({ where: { userId: user.id, done: false, title: { startsWith: "Estudar " } }, select: { title: true, durationMin: true } }),
    db.calendarEvent.findMany({
      where: { userId: user.id, category: "prova", subjectId: { not: null }, start: { gte: chaveParaData(somaDias(hojeK, -1)), lte: chaveParaData(somaDias(hojeK, 8)) } },
      select: { subjectId: true, start: true, allDay: true },
    }),
  ]);
  if (!materias.length) return { erro: "Cadastre uma matéria primeiro." };
  const feitos = new Map(sessoes.map((s) => [s.subjectId, s._sum.durationMin ?? 0]));
  const plano = planejar(
    materias.map((m) => {
      const titulo = tituloEstudo(m.name);
      const prova = provas
        .filter((p) => p.subjectId === m.id)
        .map((p) => diasEntre(hojeK, p.allDay ? dataParaChave(p.start) : chaveNoFuso(p.start, user.timezone)))
        .filter((n) => n >= 0)
        .sort((a, b) => a - b)[0];
      return {
        id: m.id,
        nome: m.name,
        metaMin: m.weeklyGoalMin,
        feitosMin: feitos.get(m.id) ?? 0,
        planejadosMin: abertas.filter((t) => t.title === titulo).reduce((s, t) => s + t.durationMin, 0),
        provaEmDias: prova ?? null,
      };
    }),
  );
  if (!plano.length) return { ok: "A semana já está planejada: nada falta das metas." };
  await db.task.createMany({
    data: plano.map((t) => ({
      userId: user.id,
      title: t.titulo,
      durationMin: t.duracao,
      priority: t.prioridade,
      dueDay: chaveParaData(fim),
      notes: "Criada pelo Study Center (plano da semana).",
    })),
  });
  revalidar(true);
  return { ok: `${plano.length} ${plano.length === 1 ? "tarefa criada" : "tarefas criadas"} na agenda. Encaixe nos horários livres em Agenda › Tarefas.` };
}

// ───────────── Conteúdos e revisões programadas ─────────────

const esquemaConteudo = z.object({
  materia: z.string().min(1, "Escolha a matéria."),
  titulo: z.string().min(1, "Dê um nome ao conteúdo.").max(120),
});

export async function salvarConteudo(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaConteudo.safeParse(bruto(fd, ["materia", "titulo"]));
  if (!r.success) return { erro: r.error.issues[0].message };
  const materia = await materiaDoUsuario(user.id, r.data.materia);
  if (!materia) return { erro: "Matéria não encontrada." };
  const total = await db.studyTopic.count({ where: { subjectId: materia } });
  await db.studyTopic.create({ data: { userId: user.id, subjectId: materia, title: r.data.titulo, position: total } });
  revalidar();
  return { ok: "Conteúdo criado." };
}

export async function mudarStatusConteudo(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const status = String(fd.get("status") ?? "");
  if (!["pendente", "estudando", "concluido"].includes(status)) return;
  const hojeK = hoje(user.timezone);
  const dados =
    status === "concluido"
      ? { status, completedAt: new Date(), reviewStage: 0, nextReview: chaveParaData(proximaRevisao(0, hojeK)!) }
      : { status, completedAt: null, reviewStage: 0, nextReview: null };
  await db.studyTopic.updateMany({ where: { id: idDe(fd), userId: user.id }, data: dados });
  revalidar();
}

export async function revisarConteudo(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const t = await db.studyTopic.findFirst({ where: { id: idDe(fd), userId: user.id } });
  if (!t || t.status !== "concluido") return;
  const r = registrarRevisao(t.reviewStage, hoje(user.timezone));
  await db.studyTopic.update({ where: { id: t.id }, data: { reviewStage: r.etapa, nextReview: r.proxima ? chaveParaData(r.proxima) : null } });
  // A revisão também conta como estudo (15 min, ajustável no histórico).
  if (fd.get("registrar") === "1") {
    await db.studySession.create({
      data: { userId: user.id, subjectId: t.subjectId, day: chaveParaData(hoje(user.timezone)), at: new Date(), durationMin: 15, kind: "revisao", topic: t.title },
    });
  }
  revalidar();
}

export async function salvarDificuldade(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const dificil = fd.get("dificil") === "on" || fd.get("dificil") === "1";
  const nota = texto(fd.get("nota"))?.slice(0, 500) ?? null;
  const n = await db.studyTopic.updateMany({ where: { id: idDe(fd), userId: user.id }, data: { difficulty: dificil, difficultyNote: dificil ? nota : null } });
  if (!n.count) return { erro: "Conteúdo não encontrado." };
  revalidar();
  return { ok: "Salvo." };
}

export async function excluirConteudo(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.studyTopic.deleteMany({ where: { id: idDe(fd), userId: user.id } });
  revalidar();
}

// ───────────── Flashcards ─────────────

const esquemaCartao = z.object({
  materia: z.string().optional(),
  frente: z.string().min(1, "Escreva a frente.").max(500),
  verso: z.string().min(1, "Escreva o verso.").max(1000),
});

export async function salvarFlashcard(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaCartao.safeParse(bruto(fd, ["materia", "frente", "verso"]));
  if (!r.success) return { erro: r.error.issues[0].message };
  const materia = await materiaDoUsuario(user.id, r.data.materia);
  if (materia === false) return { erro: "Matéria não encontrada." };
  const id = idDe(fd);
  if (id) {
    const n = await db.flashcard.updateMany({ where: { id, userId: user.id }, data: { subjectId: materia, front: r.data.frente, back: r.data.verso } });
    if (!n.count) return { erro: "Cartão não encontrado." };
  } else {
    await db.flashcard.create({
      data: { userId: user.id, subjectId: materia, front: r.data.frente, back: r.data.verso, box: 1, due: chaveParaData(hoje(user.timezone)) },
    });
  }
  revalidar();
  return { ok: id ? "Cartão atualizado." : "Cartão criado. Ele já entra na revisão de hoje." };
}

/** Resposta na revisão (cliente). */
export async function responderFlashcard(id: string, acertou: boolean): Promise<Estado> {
  const user = await exigirUsuario();
  const c = await db.flashcard.findFirst({ where: { id: String(id), userId: user.id } });
  if (!c) return { erro: "Cartão não encontrado." };
  const r = responderCartao(c.box, !!acertou, hoje(user.timezone));
  await db.flashcard.update({
    where: { id: c.id },
    data: { box: r.caixa, due: chaveParaData(r.proxima), lastReviewed: new Date(), correct: { increment: acertou ? 1 : 0 }, wrong: { increment: acertou ? 0 : 1 } },
  });
  revalidar();
  return { ok: acertou ? `Caixa ${r.caixa}` : "Volta para a caixa 1" };
}

export async function excluirFlashcard(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.flashcard.deleteMany({ where: { id: idDe(fd), userId: user.id } });
  revalidar();
}

// ───────────── Notas ─────────────

const esquemaNota = z
  .object({
    materia: z.string().min(1, "Escolha a matéria."),
    titulo: z.string().min(1, "Dê um nome à avaliação.").max(80),
    valor: z.coerce.number().min(0, "A nota não pode ser negativa."),
    maximo: z.coerce.number().positive("Nota máxima inválida.").max(1000).default(10),
    peso: z.coerce.number().positive("O peso precisa ser maior que zero.").max(100).default(1),
    dia: z.string().refine(validaChave, "Data inválida.").optional(),
    bimestre: z.string().max(40).optional(),
  })
  .refine((d) => d.valor <= d.maximo, { message: "A nota passa da nota máxima." });

export async function salvarNota(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaNota.safeParse(bruto(fd, ["materia", "titulo", "valor", "maximo", "peso", "dia", "bimestre"]));
  if (!r.success) return { erro: r.error.issues[0].message };
  const materia = await materiaDoUsuario(user.id, r.data.materia);
  if (!materia) return { erro: "Matéria não encontrada." };
  const dados = {
    subjectId: materia,
    title: r.data.titulo,
    value: r.data.valor,
    maxValue: r.data.maximo,
    weight: r.data.peso,
    day: chaveParaData(r.data.dia ?? hoje(user.timezone)),
    term: r.data.bimestre ?? null,
  };
  const id = idDe(fd);
  if (id) {
    const n = await db.grade.updateMany({ where: { id, userId: user.id }, data: dados });
    if (!n.count) return { erro: "Nota não encontrada." };
  } else await db.grade.create({ data: { ...dados, userId: user.id } });
  revalidar();
  return { ok: "Nota registrada." };
}

export async function excluirNota(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.grade.deleteMany({ where: { id: idDe(fd), userId: user.id } });
  revalidar();
}

// ───────────── Simulados e resumos ─────────────

const esquemaSimulado = z
  .object({
    materia: z.string().optional(),
    titulo: z.string().min(1, "Dê um nome ao simulado.").max(80),
    total: z.coerce.number().int().min(1, "Total de questões: pelo menos 1.").max(500),
    acertos: z.coerce.number().int().min(0, "Acertos não podem ser negativos."),
    dia: z.string().refine(validaChave, "Data inválida.").optional(),
    notas: z.string().max(1000).optional(),
  })
  .refine((d) => d.acertos <= d.total, { message: "Acertos passam do total de questões." });

export async function salvarSimulado(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaSimulado.safeParse(bruto(fd, ["materia", "titulo", "total", "acertos", "dia", "notas"]));
  if (!r.success) return { erro: r.error.issues[0].message };
  const materia = await materiaDoUsuario(user.id, r.data.materia);
  if (materia === false) return { erro: "Matéria não encontrada." };
  const hojeK = hoje(user.timezone);
  const dia = r.data.dia ?? hojeK;
  if (dia > hojeK) return { erro: "Não dá para registrar no futuro." };
  await db.quizResult.create({
    data: { userId: user.id, subjectId: materia, title: r.data.titulo, day: chaveParaData(dia), total: r.data.total, correct: r.data.acertos, notes: r.data.notas ?? null },
  });
  revalidar();
  return { ok: "Resultado registrado." };
}

export async function excluirSimulado(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.quizResult.deleteMany({ where: { id: idDe(fd), userId: user.id } });
  revalidar();
}

const esquemaResumo = z.object({
  materia: z.string().optional(),
  titulo: z.string().min(1, "Dê um título ao resumo.").max(120),
  texto: z.string().min(1, "Escreva o resumo.").max(20000, "Resumo: no máximo 20.000 caracteres."),
});

export async function salvarResumo(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaResumo.safeParse({ materia: texto(fd.get("materia")), titulo: texto(fd.get("titulo")), texto: String(fd.get("texto") ?? "").trim() || undefined });
  if (!r.success) return { erro: r.error.issues[0].message };
  const materia = await materiaDoUsuario(user.id, r.data.materia);
  if (materia === false) return { erro: "Matéria não encontrada." };
  const dados = { subjectId: materia, title: r.data.titulo, body: r.data.texto };
  const id = idDe(fd);
  if (id) {
    const n = await db.studyNote.updateMany({ where: { id, userId: user.id }, data: dados });
    if (!n.count) return { erro: "Resumo não encontrado." };
  } else await db.studyNote.create({ data: { ...dados, userId: user.id } });
  revalidar();
  return { ok: "Resumo salvo." };
}

export async function excluirResumo(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.studyNote.deleteMany({ where: { id: idDe(fd), userId: user.id } });
  revalidar();
}
