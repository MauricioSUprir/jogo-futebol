import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/pipeline");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">CreateFlow</h1>
          <p className="text-sm text-muted-foreground">Entre para gerenciar sua produção.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
