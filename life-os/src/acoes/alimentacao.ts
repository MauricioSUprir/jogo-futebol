"use server";
// NUTRITION HUB: refeições, planejamento, lista de compras e receitas. Sem calorias, peso ou restrição.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { chaveParaData, diasEntre, hoje, localParaUtc, validaChave, validaHora } from "@/lib/datas";
import { categoriaCompraValida, grupoValido, ingredientesParaLista, refeicaoValida } from "@/lib/alimentacao";
import type { Estado } from "./tipos";

function revalidar() {
  revalidatePath("/");
  revalidatePath("/saude");
  revalidatePath("/alimentacao");
}

const nota15 = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : Number(v)), z.number().int().min(1).max(5).nullable());

const esquemaRefeicao = z.object({
  tipo: z.string().refine(refeicaoValida, "Escolha o tipo da refeição."),
  descricao: z.string().trim().min(1, "Descreva a refeição.").max(300, "Descrição: no máximo 300 caracteres."),
  fome: nota15,
  saciedade: nota15,
  notas: z.string().trim().max(1000, "Observações: no máximo 1.000 caracteres.").optional(),
});

export async function registrarRefeicao(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaRefeicao.safeParse({
    tipo: fd.get("tipo") ?? "",
    descricao: fd.get("descricao") ?? "",
    fome: fd.get("fome"),
    saciedade: fd.get("saciedade"),
    notas: fd.get("notas") ?? undefined,
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const diaBruto = String(fd.get("dia") ?? "");
  const dia = validaChave(diaBruto) ? diaBruto : hojeK;
  if (diasEntre(dia, hojeK) < 0) return { erro: "Não dá para registrar no futuro." };
  if (diasEntre(dia, hojeK) > 60) return { erro: "Só dá para registrar até 60 dias atrás." };
  const hora = String(fd.get("hora") ?? "");
  const at = validaHora(hora) ? localParaUtc(dia, hora, tz) : dia === hojeK ? new Date() : localParaUtc(dia, "12:00", tz);
  if (at.getTime() > Date.now() + 60_000) return { erro: "Esse horário ainda não chegou." };
  const grupos = [...new Set(fd.getAll("grupos").map(String).filter(grupoValido))];
  const dados = {
    day: chaveParaData(dia),
    at,
    slot: r.data.tipo,
    description: r.data.descricao,
    groups: grupos,
    hunger: r.data.fome,
    satiety: r.data.saciedade,
    notes: r.data.notas || null,
  };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const n = await db.meal.updateMany({ where: { id, userId: user.id }, data: dados });
    if (n.count === 0) return { erro: "Refeição não encontrada." };
  } else {
    await db.meal.create({ data: { userId: user.id, ...dados } });
  }
  revalidar();
  return { ok: id ? "Refeição atualizada." : "Refeição registrada." };
}

export async function excluirRefeicao(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.meal.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

// ───── Planejamento ─────

const esquemaPlano = z.object({
  tipo: z.string().refine(refeicaoValida, "Escolha o tipo da refeição."),
  descricao: z.string().trim().min(1, "Descreva o que planejou.").max(200, "No máximo 200 caracteres."),
});

export async function salvarItemPlano(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaPlano.safeParse({ tipo: fd.get("tipo") ?? "", descricao: fd.get("descricao") ?? "" });
  if (!r.success) return { erro: r.error.issues[0].message };
  const dias = fd
    .getAll("dias")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (dias.length === 0) return { erro: "Escolha pelo menos um dia da semana." };
  const weekdays = dias.reduce((m, d) => m | (1 << d), 0);
  const total = await db.mealPlanItem.count({ where: { userId: user.id } });
  if (total >= 200) return { erro: "Limite de 200 itens no planejamento." };
  await db.mealPlanItem.create({
    data: { userId: user.id, weekdays, slot: r.data.tipo, description: r.data.descricao, trainingDay: fd.get("treino") === "1", position: total },
  });
  revalidar();
  return { ok: "Adicionado ao planejamento." };
}

export async function excluirItemPlano(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.mealPlanItem.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

// ───── Lista de compras ─────

const esquemaCompra = z.object({
  nome: z.string().trim().min(1, "Escreva o item.").max(120, "Item: no máximo 120 caracteres."),
  quantidade: z.string().trim().max(40, "Quantidade: no máximo 40 caracteres.").optional(),
  categoria: z.string().refine(categoriaCompraValida).catch("outros"),
});

export async function adicionarCompra(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaCompra.safeParse({ nome: fd.get("nome") ?? "", quantidade: fd.get("quantidade") ?? undefined, categoria: fd.get("categoria") ?? "outros" });
  if (!r.success) return { erro: r.error.issues[0].message };
  if ((await db.shoppingItem.count({ where: { userId: user.id } })) >= 300) return { erro: "Limite de 300 itens na lista." };
  await db.shoppingItem.create({ data: { userId: user.id, name: r.data.nome, quantity: r.data.quantidade || null, category: r.data.categoria } });
  revalidatePath("/alimentacao");
  return { ok: "Item adicionado." };
}

export async function alternarCompra(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.shoppingItem.updateMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id }, data: { checked: fd.get("marcar") === "1" } });
  revalidatePath("/alimentacao");
}

export async function excluirCompra(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.shoppingItem.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidatePath("/alimentacao");
}

export async function limparMarcados(): Promise<void> {
  const user = await exigirUsuario();
  await db.shoppingItem.deleteMany({ where: { userId: user.id, checked: true } });
  revalidatePath("/alimentacao");
}

// ───── Receitas ─────

const esquemaReceita = z.object({
  titulo: z.string().trim().min(1, "Dê um nome à receita.").max(100, "Nome: no máximo 100 caracteres."),
  ingredientes: z.string().trim().min(1, "Liste os ingredientes.").max(4000, "Ingredientes: no máximo 4.000 caracteres."),
  preparo: z.string().trim().max(8000, "Modo de preparo: no máximo 8.000 caracteres.").optional(),
  etiquetas: z.string().max(200).optional(),
});

export async function salvarReceita(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaReceita.safeParse({
    titulo: fd.get("titulo") ?? "",
    ingredientes: fd.get("ingredientes") ?? "",
    preparo: fd.get("preparo") ?? undefined,
    etiquetas: fd.get("etiquetas") ?? undefined,
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const tags = [
    ...new Set(
      (r.data.etiquetas ?? "")
        .split(",")
        .map((t) => t.trim().toLocaleLowerCase("pt-BR").slice(0, 30))
        .filter(Boolean),
    ),
  ].slice(0, 8);
  const dados = {
    title: r.data.titulo,
    ingredients: r.data.ingredientes,
    steps: r.data.preparo || null,
    tags,
    forTraining: fd.get("treino") === "1",
    favorite: fd.get("favorita") !== "0",
  };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const n = await db.recipe.updateMany({ where: { id, userId: user.id }, data: dados });
    if (n.count === 0) return { erro: "Receita não encontrada." };
  } else {
    if ((await db.recipe.count({ where: { userId: user.id } })) >= 300) return { erro: "Limite de 300 receitas." };
    await db.recipe.create({ data: { userId: user.id, ...dados } });
  }
  revalidatePath("/alimentacao");
  return { ok: id ? "Receita atualizada." : "Receita salva." };
}

export async function alternarFavorita(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.recipe.updateMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id }, data: { favorite: fd.get("favorita") === "1" } });
  revalidatePath("/alimentacao");
}

export async function excluirReceita(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.recipe.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidatePath("/alimentacao");
}

/** Põe os ingredientes da receita na lista de compras (sem repetir o que já está lá, desmarcado). */
export async function ingredientesNaLista(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const receita = await db.recipe.findFirst({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  if (!receita) return;
  const ja = new Set(
    (await db.shoppingItem.findMany({ where: { userId: user.id, checked: false }, select: { name: true } })).map((i) => i.name.toLocaleLowerCase("pt-BR")),
  );
  const novos = ingredientesParaLista(receita.ingredients).filter((n) => !ja.has(n.toLocaleLowerCase("pt-BR")));
  const total = await db.shoppingItem.count({ where: { userId: user.id } });
  const cabem = novos.slice(0, Math.max(0, 300 - total));
  if (cabem.length) await db.shoppingItem.createMany({ data: cabem.map((name) => ({ userId: user.id, name, category: "outros" })) });
  revalidatePath("/alimentacao");
}
