import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <AppShell papel={session.user.papel} nome={session.user.name ?? "Usuário"}>
      {children}
    </AppShell>
  );
}
