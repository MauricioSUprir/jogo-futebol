import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Cliente = SupabaseClient<Database>;

const URL_SB = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICO = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function admin(): Cliente {
  return createClient<Database>(URL_SB(), SERVICO(), { auth: { persistSession: false, autoRefreshToken: false } });
}

export function anonimo(): Cliente {
  return createClient<Database>(URL_SB(), ANON(), { auth: { persistSession: false, autoRefreshToken: false } });
}

let contador = 0;
export type Pessoa = { id: string; email: string; nome: string; c: Cliente };

/** Cria um usuário confirmado e devolve um cliente logado como ele. */
export async function pessoa(nome: string): Promise<Pessoa> {
  const email = `${nome.toLowerCase().replace(/\W/g, "")}.${Date.now()}.${contador++}@teste.local`;
  const senha = "Senha-de-teste-123";
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { display_name: nome },
  });
  if (error) throw error;
  const c = anonimo();
  const { error: e2 } = await c.auth.signInWithPassword({ email, password: senha });
  if (e2) throw e2;
  return { id: data.user!.id, email, nome, c };
}

/** Convidado (login anônimo do Supabase). */
export async function convidado(nome: string): Promise<Pessoa> {
  const c = anonimo();
  const { data, error } = await c.auth.signInAnonymously({ options: { data: { display_name: nome } } });
  if (error) throw error;
  return { id: data.user!.id, email: "", nome, c };
}

export async function ok<T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`esperava sucesso: ${JSON.stringify(error)}`);
  return data as T;
}

export async function erro(p: PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>): Promise<string> {
  const { error } = await p;
  if (!error) throw new Error("esperava erro, mas deu certo");
  return error.message ?? error.code ?? "erro";
}

/** Grupo com organizador + n membros já dentro. */
export async function grupo(n: number, opcoes: { requires_approval?: boolean } = {}) {
  const dono = await pessoa("Organizadora");
  const id = await ok(dono.c.rpc("create_event", { p_name: "Amigo oculto de teste", p_gift_min: 50, p_gift_max: 100, p_requires_approval: opcoes.requires_approval }));
  const { data: ev } = await dono.c.from("events").select("*").eq("id", id).single();
  const membros: Pessoa[] = [];
  for (let i = 0; i < n; i++) {
    const p = await pessoa(`Membro${i}`);
    await ok(p.c.rpc("join_event", { p_code: ev!.invite_code }));
    membros.push(p);
  }
  return { id, codigo: ev!.invite_code, dono, membros, todos: [dono, ...membros] };
}

export async function participanteDe(c: Cliente, eventoId: string, userId: string): Promise<string> {
  const { data } = await c.from("participants").select("id").eq("event_id", eventoId).eq("user_id", userId).single();
  return data!.id;
}
