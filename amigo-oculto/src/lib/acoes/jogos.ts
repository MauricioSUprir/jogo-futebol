"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { entregarEmSegundoPlano } from "@/lib/servidor/entrega";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";

/**
 * Minigames: todas as regras (quem pode, limites, sigilo do sorteio) estão nas funções do banco.
 * Aqui só validamos a entrada, chamamos a função e atualizamos a tela.
 */

const id = z.uuid("Identificador inválido.");

async function sessao() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  return { usuario, supabase: await clienteServidor() };
}

const NAO_LOGADO: Resultado<never> = { ok: false, erro: "Entre na sua conta para continuar." };
const base = (eventoId: string) => `/grupo/${eventoId}/jogos`;

// ---------------------------------------------------------------------------------------------------------------------
// Adivinhe quem te tirou
// ---------------------------------------------------------------------------------------------------------------------
export async function salvarPalpite(eventoId: string, palpiteId: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, palpiteId: id }), { eventoId, palpiteId });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("save_guess", { p_event: eventoId, p_guessed: palpiteId });
  if (error) return falha(error);
  revalidatePath(`${base(eventoId)}/adivinhar`);
  return sucesso("Palpite guardado! Você pode trocar até o fim do amigo oculto.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------------------------------------------------
const esquemaPergunta = z.object({
  pergunta: z.string().trim().min(3, "Escreva a pergunta (3 letras ou mais).").max(200, "Use até 200 caracteres."),
  opcoes: z
    .array(z.string().trim().min(1, "Preencha a opção.").max(80, "Use até 80 caracteres."))
    .min(2, "Coloque pelo menos 2 opções.")
    .max(4, "No máximo 4 opções."),
  certa: z.number().int().min(0),
});

export async function criarPerguntaQuiz(
  eventoId: string,
  entrada: { pergunta: string; opcoes: string[]; certa: number },
): Promise<Resultado> {
  const v = validar(esquemaPergunta, entrada);
  if (!v.ok) return v.resultado;
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Grupo inválido." };
  if (v.dados.certa >= v.dados.opcoes.length) return { ok: false, erro: "Marque qual opção é a certa." };
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("quiz_create", {
    p_event: eventoId,
    p_question: v.dados.pergunta,
    p_options: v.dados.opcoes,
    p_correct: v.dados.certa,
  });
  if (error) return falha(error);
  revalidatePath(`${base(eventoId)}/quiz`);
  return sucesso("Pergunta publicada! Agora é só esperar os palpites.");
}

export async function responderQuiz(
  eventoId: string,
  perguntaId: string,
  escolha: number,
): Promise<Resultado<{ certa: boolean; indiceCerto: number }>> {
  const v = validar(z.object({ eventoId: id, perguntaId: id, escolha: z.number().int().min(0).max(3) }), { eventoId, perguntaId, escolha });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.rpc("quiz_answer", { p_question: perguntaId, p_choice: escolha });
  if (error) return falha(error);
  const r = data as { correct: boolean; correct_index: number };
  revalidatePath(`${base(eventoId)}/quiz`);
  return sucesso(r.correct ? "Acertou!" : "Não foi dessa vez.", { certa: r.correct, indiceCerto: r.correct_index });
}

export async function excluirPerguntaQuiz(eventoId: string, perguntaId: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, perguntaId: id }), { eventoId, perguntaId });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("quiz_delete", { p_question: perguntaId });
  if (error) return falha(error);
  revalidatePath(`${base(eventoId)}/quiz`);
  return sucesso("Pergunta excluída.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Roleta de desafios
// ---------------------------------------------------------------------------------------------------------------------
export async function girarRoleta(
  eventoId: string,
): Promise<Resultado<{ id: string; indice: number; texto: string; total: number }>> {
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Grupo inválido." };
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.rpc("spin_challenge", { p_event: eventoId });
  if (error) return falha(error);
  const r = data as { id: string; index: number; text: string; total: number };
  return sucesso(undefined, { id: r.id, indice: r.index, texto: r.text, total: r.total });
}

export async function resolverDesafio(eventoId: string, giroId: string, situacao: "done" | "skipped"): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, giroId: id, situacao: z.enum(["done", "skipped"]) }), { eventoId, giroId, situacao });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("update_challenge", { p_spin: giroId, p_status: situacao });
  if (error) return falha(error);
  revalidatePath(`${base(eventoId)}/roleta`);
  return sucesso(situacao === "done" ? "Desafio cumprido! +6 pontos no ranking." : "Desafio pulado. Sem problema!");
}

// ---------------------------------------------------------------------------------------------------------------------
// Bingo natalino
// ---------------------------------------------------------------------------------------------------------------------
export async function novoBingo(eventoId: string): Promise<Resultado<{ id: string }>> {
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Grupo inválido." };
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.rpc("bingo_new", { p_event: eventoId });
  if (error) return falha(error);
  entregarEmSegundoPlano();
  return sucesso("Bingo aberto! Todos foram avisados para pegar a cartela.", { id: data as string });
}

export async function chamarBingo(eventoId: string, jogoId: string): Promise<Resultado<{ numero: number }>> {
  const v = validar(z.object({ eventoId: id, jogoId: id }), { eventoId, jogoId });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.rpc("bingo_call", { p_game: jogoId });
  if (error) return falha(error);
  return sucesso(undefined, { numero: data as number });
}

export async function encerrarBingo(eventoId: string, jogoId: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, jogoId: id }), { eventoId, jogoId });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("bingo_finish", { p_game: jogoId });
  if (error) return falha(error);
  return sucesso("Bingo encerrado.");
}

export async function entrarBingo(eventoId: string, jogoId: string): Promise<Resultado<{ cells: number[]; marked: number[] }>> {
  const v = validar(z.object({ eventoId: id, jogoId: id }), { eventoId, jogoId });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("bingo_join", { p_game: jogoId });
  if (error) return falha(error);
  const { data: cartela } = await s.supabase.from("bingo_cards").select("cells, marked").eq("game_id", jogoId).maybeSingle();
  if (!cartela) return { ok: false, erro: "Não foi possível pegar a cartela. Tente de novo." };
  return sucesso("Cartela na mão! Boa sorte.", { cells: cartela.cells, marked: cartela.marked });
}

export async function marcarBingo(eventoId: string, jogoId: string, posicao: number): Promise<Resultado<{ marked: number[] }>> {
  const v = validar(z.object({ eventoId: id, jogoId: id, posicao: z.number().int().min(0).max(24) }), { eventoId, jogoId, posicao });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.rpc("bingo_mark", { p_game: jogoId, p_position: posicao });
  if (error) return falha(error);
  return sucesso(undefined, { marked: data as number[] });
}

export async function gritarBingo(eventoId: string, jogoId: string): Promise<Resultado<{ valeu: boolean }>> {
  const v = validar(z.object({ eventoId: id, jogoId: id }), { eventoId, jogoId });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.rpc("bingo_claim", { p_game: jogoId });
  if (error) return falha(error);
  if (data) {
    entregarEmSegundoPlano();
    revalidatePath(`${base(eventoId)}/ranking`);
  }
  return sucesso(data ? "BINGO conferido! Parabéns!" : undefined, { valeu: !!data });
}

// ---------------------------------------------------------------------------------------------------------------------
// Cápsula do tempo
// ---------------------------------------------------------------------------------------------------------------------
const UMA_HORA = 3600_000;
const CINCO_ANOS = 5 * 365 * 86400_000;

export async function lacrarCapsula(eventoId: string, texto: string, abreEm: string): Promise<Resultado> {
  const v = validar(
    z.object({
      eventoId: id,
      texto: z.string().trim().min(1, "Escreva a sua mensagem.").max(2000, "Use até 2000 caracteres."),
      abreEm: z.iso.datetime({ message: "Escolha quando a cápsula abre.", offset: true }),
    }),
    { eventoId, texto, abreEm },
  );
  if (!v.ok) return v.resultado;
  const quando = new Date(v.dados.abreEm).getTime();
  // margem de 2 minutos sobre a regra do banco (≥ 1 h), para o relógio do aparelho não atrapalhar
  if (quando < Date.now() + UMA_HORA + 2 * 60_000) return { ok: false, erro: "A cápsula precisa ficar lacrada por pelo menos 1 hora.", campos: { abreEm: "Escolha uma data daqui a mais de 1 hora." } };
  if (quando > Date.now() + CINCO_ANOS - 86400_000) return { ok: false, erro: "O máximo é 5 anos.", campos: { abreEm: "Escolha uma data em até 5 anos." } };
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase
    .from("time_capsules")
    .insert({ event_id: eventoId, user_id: s.usuario.id, body: v.dados.texto, open_at: new Date(quando).toISOString() });
  if (error) return falha(error, "Não foi possível lacrar a cápsula. Confira a data e tente de novo.");
  revalidatePath(`${base(eventoId)}/capsula`);
  return sucesso("Cápsula lacrada! Ninguém lê antes da data — nem você.");
}

export async function excluirCapsula(eventoId: string, capsulaId: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, capsulaId: id }), { eventoId, capsulaId });
  if (!v.ok) return v.resultado;
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.from("time_capsules").delete().eq("id", capsulaId).eq("event_id", eventoId).select("id");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: "Só dá para desfazer uma cápsula sua que ainda não abriu." };
  revalidatePath(`${base(eventoId)}/capsula`);
  return sucesso("Cápsula desfeita.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Cartões virtuais
// ---------------------------------------------------------------------------------------------------------------------
// (em arquivo "use server" só se exportam funções assíncronas: a lista fica aqui dentro)
const MODELOS_CARTAO = ["estrela", "arvore", "presente", "neve", "bolo", "balao", "classico", "brinde"] as const;

export async function enviarCartao(
  eventoId: string,
  entrada: { destinatario: string; modelo: string; titulo: string; texto: string; anonimo: boolean },
): Promise<Resultado> {
  const v = validar(
    z.object({
      destinatario: z.uuid("Escolha para quem vai o cartão."),
      modelo: z.enum(MODELOS_CARTAO, { message: "Escolha um modelo." }),
      titulo: z.string().trim().max(80, "Use até 80 caracteres."),
      texto: z.string().trim().min(1, "Escreva a mensagem do cartão.").max(600, "Use até 600 caracteres."),
      anonimo: z.boolean(),
    }),
    entrada,
  );
  if (!v.ok) return v.resultado;
  if (!id.safeParse(eventoId).success) return { ok: false, erro: "Grupo inválido." };
  const s = await sessao();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("send_card", {
    p_event: eventoId,
    p_recipient: v.dados.destinatario,
    p_template: v.dados.modelo,
    p_title: v.dados.titulo,
    p_body: v.dados.texto,
    p_anonymous: v.dados.anonimo,
  });
  if (error) return falha(error);
  entregarEmSegundoPlano();
  revalidatePath(`${base(eventoId)}/cartoes`);
  return sucesso(v.dados.anonimo ? "Cartão enviado em segredo!" : "Cartão enviado!");
}
