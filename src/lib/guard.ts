import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Garante que o usuário é admin (defesa em profundidade além do middleware). */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.papel !== "admin") redirect("/pipeline");
  return session;
}
