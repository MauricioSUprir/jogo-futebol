"use server";
// Health Center: registros (consultas, vacinas, exames, medicamentos, orientações, alergias, lesões, dores e sintomas),
// documentos anexados e informações para emergências. A consulta marcada vira um evento na agenda.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { chaveParaData, diasEntre, hoje, localParaUtc, validaChave, validaHora } from "@/lib/datas";
import { DEF_TIPOS, TIPOS_SANGUINEOS, tipoValido, type TipoSaude } from "@/lib/saude";
import type { User } from "@/generated/prisma/client";
import type { Estado } from "./tipos";

function revalidar() {
  for (const p of ["/", "/saude", "/saude/central", "/agenda", "/agenda/foco"]) revalidatePath(p);
}

const vazio = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};

const data = (msg: string) => z.string().refine(validaChave, msg);

const esquema = z.object({
  tipo: z.string().refine(tipoValido, "Tipo inválido."),
  titulo: z.string().trim().min(1, "Preencha o nome.").max(120, "Nome: no máximo 120 caracteres."),
  dia: data("Data inválida."),
  hora: z.string().refine(validaHora, "Horário inválido.").optional(),
  diaFim: data("Data final inválida.").optional(),
  profissional: z.string().trim().max(120, "No máximo 120 caracteres.").optional(),
  detalhes: z.string().trim().max(4000, "Texto: no máximo 4.000 caracteres.").optional(),
  dose: z.string().trim().max(120, "Dose: no máximo 120 caracteres.").optional(),
  proximo: data("Data da próxima inválida.").optional(),
  intensidade: z.coerce.number({ message: "Intensidade de 0 a 10." }).int().min(0, "Intensidade de 0 a 10.").max(10, "Intensidade de 0 a 10.").optional(),
  parteCorpo: z.string().trim().max(60, "Parte do corpo: no máximo 60 caracteres.").optional(),
  status: z.enum(["ativo", "encerrado"]).optional(),
});

/** Cria, atualiza ou apaga o evento da agenda de uma consulta. Devolve o id do evento (ou null). */
async function sincronizarEvento(
  user: User,
  reg: { titulo: string; dia: string; hora?: string; profissional?: string; detalhes?: string },
  eventoAtual: string | null,
  criarSeFuturo: boolean,
): Promise<string | null> {
  const tz = user.timezone;
  const start = reg.hora ? localParaUtc(reg.dia, reg.hora, tz) : chaveParaData(reg.dia);
  const dados = {
    title: `Consulta: ${reg.titulo}`.slice(0, 120),
    category: "consulta",
    allDay: !reg.hora,
    start,
    end: reg.hora ? new Date(start.getTime() + 60 * 60_000) : null,
    location: reg.profissional ?? null,
    notes: reg.detalhes ?? null,
  };
  if (eventoAtual) {
    const n = await db.calendarEvent.updateMany({ where: { id: eventoAtual, userId: user.id }, data: dados });
    if (n.count) return eventoAtual;
  }
  if (!criarSeFuturo) return null;
  const ev = await db.calendarEvent.create({ data: { ...dados, userId: user.id } });
  return ev.id;
}

export async function salvarRegistroSaude(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const bruto: Record<string, string | undefined> = {};
  for (const k of ["tipo", "titulo", "dia", "hora", "diaFim", "profissional", "detalhes", "dose", "proximo", "intensidade", "parteCorpo", "status"])
    bruto[k] = vazio(fd.get(k));
  const r = esquema.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const tipo = d.tipo as TipoSaude;
  const def = DEF_TIPOS[tipo];
  // Só os campos que o tipo usa (o resto fica vazio, mesmo que o formulário mande).
  const usa = (c: keyof typeof def.campos) => c in def.campos;
  const hojeK = hoje(user.timezone);
  if (!def.futuro && diasEntre(d.dia, hojeK) < 0) return { erro: "Essa data ainda não chegou." };
  if (usa("diaFim") && d.diaFim && d.diaFim < d.dia) return { erro: "A data final precisa ser depois da inicial." };
  if (usa("proximo") && d.proximo && d.proximo < d.dia) return { erro: "A próxima data precisa ser depois desta." };

  const dados = {
    type: tipo,
    title: d.titulo,
    day: chaveParaData(d.dia),
    at: usa("hora") && d.hora ? localParaUtc(d.dia, d.hora, user.timezone) : null,
    endDay: usa("diaFim") && d.diaFim ? chaveParaData(d.diaFim) : null,
    professional: usa("profissional") ? (d.profissional ?? null) : null,
    details: usa("detalhes") ? (d.detalhes ?? null) : null,
    dose: usa("dose") ? (d.dose ?? null) : null,
    nextDay: usa("proximo") && d.proximo ? chaveParaData(d.proximo) : null,
    severity: usa("intensidade") ? (d.intensidade ?? null) : null,
    bodyPart: usa("parteCorpo") ? (d.parteCorpo ?? null) : null,
    status: def.status ? (d.status ?? "ativo") : "ativo",
  };

  const id = String(fd.get("id") ?? "");
  const antigo = id ? await db.healthRecord.findFirst({ where: { id, userId: user.id } }) : null;
  if (id && !antigo) return { erro: "Registro não encontrado." };

  let eventId: string | null = antigo?.eventId ?? null;
  if (tipo === "consulta") {
    const futura = (d.hora ? localParaUtc(d.dia, d.hora, user.timezone).getTime() > Date.now() : d.dia >= hojeK);
    eventId = await sincronizarEvento(user, { titulo: d.titulo, dia: d.dia, hora: d.hora, profissional: d.profissional, detalhes: d.detalhes }, eventId, futura);
  }

  if (antigo) {
    await db.healthRecord.updateMany({ where: { id, userId: user.id }, data: { ...dados, eventId } });
  } else {
    await db.healthRecord.create({ data: { ...dados, eventId, userId: user.id } });
  }
  revalidar();
  return { ok: antigo ? "Registro atualizado." : "Registro salvo." };
}

export async function excluirRegistroSaude(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const reg = await db.healthRecord.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  if (!reg) return;
  if (reg.eventId) await db.calendarEvent.deleteMany({ where: { id: reg.eventId, userId: user.id } });
  await db.healthRecord.deleteMany({ where: { id: reg.id, userId: user.id } }); // os documentos vão junto (cascade)
  revalidar();
}

/** Ativo ↔ encerrado (medicamento, orientação, alergia, lesão). Encerrar sem data final põe hoje. */
export async function alternarStatusSaude(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const reg = await db.healthRecord.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  if (!reg || !tipoValido(reg.type) || !DEF_TIPOS[reg.type].status) return;
  const encerrar = reg.status === "ativo";
  const temFim = "diaFim" in DEF_TIPOS[reg.type].campos;
  await db.healthRecord.updateMany({
    where: { id: reg.id, userId: user.id },
    data: {
      status: encerrar ? "encerrado" : "ativo",
      ...(temFim ? { endDay: encerrar ? (reg.endDay ?? chaveParaData(hoje(user.timezone))) : null } : {}),
    },
  });
  revalidar();
}

export async function excluirDocumento(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.healthFile.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

// ───── Emergência ─────

const esquemaEmergencia = z.object({
  sangue: z.string().refine((s) => (TIPOS_SANGUINEOS as readonly string[]).includes(s), "Tipo sanguíneo inválido.").optional(),
  alergias: z.string().trim().max(1000, "Alergias: no máximo 1.000 caracteres.").optional(),
  condicoes: z.string().trim().max(1000, "Condições: no máximo 1.000 caracteres.").optional(),
  medicamentos: z.string().trim().max(1000, "Medicamentos: no máximo 1.000 caracteres.").optional(),
  plano: z.string().trim().max(200, "Plano de saúde: no máximo 200 caracteres.").optional(),
  observacoes: z.string().trim().max(2000, "Observações: no máximo 2.000 caracteres.").optional(),
});

export async function salvarEmergencia(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const bruto: Record<string, string | undefined> = {};
  for (const k of ["sangue", "alergias", "condicoes", "medicamentos", "plano", "observacoes"]) bruto[k] = vazio(fd.get(k));
  const r = esquemaEmergencia.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message };
  const nomes = fd.getAll("contatoNome").map((x) => String(x).trim());
  const relacoes = fd.getAll("contatoRelacao").map((x) => String(x).trim());
  const tels = fd.getAll("contatoTelefone").map((x) => String(x).trim());
  const contatos = nomes
    .map((nome, i) => ({ nome: nome.slice(0, 80), relacao: (relacoes[i] ?? "").slice(0, 60), telefone: (tels[i] ?? "").slice(0, 30) }))
    .filter((c) => c.nome || c.telefone)
    .slice(0, 5);
  if (contatos.some((c) => !c.nome || !c.telefone)) return { erro: "Cada contato precisa de nome e telefone." };
  const d = r.data;
  const dados = {
    bloodType: d.sangue ?? null,
    allergies: d.alergias ?? null,
    conditions: d.condicoes ?? null,
    medications: d.medicamentos ?? null,
    insurance: d.plano ?? null,
    notes: d.observacoes ?? null,
    contacts: contatos,
  };
  await db.emergencyInfo.upsert({ where: { userId: user.id }, create: { userId: user.id, ...dados }, update: dados });
  revalidar();
  return { ok: "Informações de emergência salvas." };
}
