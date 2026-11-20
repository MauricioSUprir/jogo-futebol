import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sessaoAtual } from "@/lib/servidor/sessao";
import { FormEntrar } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar" };

export default async function PaginaEntrar({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  if ((await db.user.count()) === 0) redirect("/configurar");
  const s = await sessaoAtual();
  if (s && !s.mfaPending) redirect("/");
  const { de } = await searchParams;
  return <FormEntrar de={de ?? ""} />;
}
