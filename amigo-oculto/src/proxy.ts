import { NextResponse, type NextRequest } from "next/server";
import { atualizarSessao } from "@/lib/supabase/proxy";

const PROTEGIDAS = ["/painel", "/criar", "/conta", "/lista-de-desejos", "/notificacoes", "/mensagens", "/grupo"];

export async function proxy(request: NextRequest) {
  const { resposta, usuario } = await atualizarSessao(request);
  const { pathname, search } = request.nextUrl;
  if (!usuario && PROTEGIDAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?proximo=${encodeURIComponent(pathname + search)}`;
    const redir = NextResponse.redirect(url);
    for (const c of resposta.cookies.getAll()) redir.cookies.set(c);
    return redir;
  }
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icone|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
