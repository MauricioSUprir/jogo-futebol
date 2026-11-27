import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { clienteServidor } from "@/lib/supabase/servidor";

/**
 * Volta do Google (OAuth com PKCE) e dos links de e-mail (confirmação, recuperação de senha, troca de e-mail).
 * Aceita ?code= (PKCE) e ?token_hash=&type= (modelos de e-mail do Supabase com TokenHash).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const proximoBruto = url.searchParams.get("proximo") ?? "/painel";
  const proximo = proximoBruto.startsWith("/") && !proximoBruto.startsWith("//") ? proximoBruto : "/painel";
  const supabase = await clienteServidor();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;
  const erroProvedor = url.searchParams.get("error_description");

  let ok = false;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  } else if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    ok = !error;
  }
  const destino = url.clone();
  destino.search = "";
  if (ok) {
    destino.pathname = tipo === "recovery" ? "/atualizar-senha" : proximo;
    return NextResponse.redirect(destino);
  }
  destino.pathname = "/entrar";
  destino.searchParams.set("erro", erroProvedor ? "provedor" : "link");
  return NextResponse.redirect(destino);
}
