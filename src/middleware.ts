import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Protege tudo, menos assets estáticos e as rotas internas do Auth.js.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
