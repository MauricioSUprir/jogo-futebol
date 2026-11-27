import type { z } from "zod";
import { mensagemDeErro } from "@/lib/erros";

/** Resultado padrão das Server Actions (sempre serializável). */
export type Resultado<T = undefined> =
  | { ok: true; mensagem?: string; dados?: T }
  | { ok: false; erro: string; campos?: Record<string, string> };

export const sucesso = <T,>(mensagem?: string, dados?: T): Resultado<T> => ({ ok: true, mensagem, dados });
export const falha = (erro: unknown, padrao?: string): Resultado<never> => ({ ok: false, erro: mensagemDeErro(erro, padrao) });

/** Valida com zod e devolve os erros por campo (primeira mensagem de cada). */
export function validar<S extends z.ZodType>(esquema: S, entrada: unknown):
  | { ok: true; dados: z.infer<S> }
  | { ok: false; resultado: Resultado<never> } {
  const r = esquema.safeParse(entrada);
  if (r.success) return { ok: true, dados: r.data };
  const campos: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const chave = issue.path.join(".") || "_";
    if (!campos[chave]) campos[chave] = issue.message;
  }
  return { ok: false, resultado: { ok: false, erro: "Confira os campos destacados.", campos } };
}

/** FormData → objeto simples (checkbox ausente = undefined). */
export function objetoDoForm(form: FormData): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") o[k] = v;
  return o;
}
