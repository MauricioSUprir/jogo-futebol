import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/servidor/sessao";
import { FormVerificar } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verificação" };

export default async function PaginaVerificar({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (!s.mfaPending) redirect("/");
  const { de } = await searchParams;
  return <FormVerificar de={de ?? ""} />;
}
