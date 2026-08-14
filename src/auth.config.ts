import type { NextAuthConfig } from "next-auth";

/**
 * Config edge-safe (sem acesso ao banco). Usada pelo middleware para
 * proteção de rotas e RBAC. Os provedores que tocam o banco ficam em auth.ts.
 */

// Rotas restritas a admin (métricas financeiras, configurações de API, pilares).
const ADMIN_ONLY = ["/metricas", "/config", "/pilares", "/sugestoes"];

export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [], // preenchido em auth.ts
  callbacks: {
    jwt({ token, user }) {
      if (user) token.papel = (user as { papel?: "admin" | "editor" }).papel ?? "editor";
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.papel = (token.papel as "admin" | "editor") ?? "editor";
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const logado = !!auth?.user;
      const papel = auth?.user?.papel ?? "editor";

      const ehLogin = pathname === "/login";
      if (ehLogin) return true; // a própria página de login lida com o redirect
      if (!logado) return false; // dispara redirect para /login

      // Editor não acessa rotas administrativas.
      if (papel === "editor" && ADMIN_ONLY.some((p) => pathname.startsWith(p))) {
        return Response.redirect(new URL("/pipeline", request.nextUrl));
      }
      return true;
    },
  },
};
