import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { db } from "@/db";
import { usuarios } from "@/db/schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const [u] = await db
          .select()
          .from(usuarios)
          .where(eq(usuarios.email, email))
          .limit(1);
        if (!u) return null;

        const ok = await bcrypt.compare(password, u.senhaHash);
        if (!ok) return null;

        return { id: u.id, name: u.nome, email: u.email, papel: u.papel };
      },
    }),
  ],
});
