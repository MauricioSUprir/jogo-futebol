// Porta de entrada: sem cookie de sessão, toda página privada vai para o login.
// (A conferência de verdade da sessão é no servidor, em cada página e ação: lib/servidor/sessao.ts.)
import { NextResponse, type NextRequest } from "next/server";

const PUBLICAS = ["/entrar", "/configurar", "/offline", "/manifest.webmanifest", "/sw.js", "/icones", "/api/saude", "/robots.txt", "/favicon.png"];
const COOKIE = "lifeos_sessao";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ erro: "não autenticado" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("de", pathname);
    return NextResponse.redirect(url);
  }

  // Sessão deslizante: quem usa o sistema não é deslogado no meio do mês. Só em GET: num POST (ação) o
  // cookie pode estar sendo apagado pela própria ação (Sair) e não pode ser regravado na mesma resposta.
  const res = NextResponse.next();
  if (req.method !== "GET") return res;
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.LIFEOS_COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 86_400,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|apple-touch-icon.png).*)"],
};
