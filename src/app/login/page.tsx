import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/pipeline");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span
            className="mb-3 grid h-16 w-16 place-items-center rounded-2xl"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.14), rgba(255,194,31,.18))" }}
          >
            <Logo size={50} />
          </span>
          <h1 className="text-2xl font-bold">CreateFlow</h1>
          <p className="text-sm text-muted-foreground">Entre para gerenciar sua produção.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
