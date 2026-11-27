import Link from "next/link";
import { BarChart3, Ban, Flag, Megaphone, PencilLine, Send, ShieldAlert, Shuffle, Users } from "lucide-react";
import { SECOES, type IdSecao } from "@/components/admin/secoes";
import { cn } from "@/lib/cn";

const ICONES: Record<IdSecao, typeof Users> = {
  resumo: BarChart3,
  participantes: Users,
  sorteio: Shuffle,
  restricoes: Ban,
  convites: Send,
  avisos: Megaphone,
  moderacao: ShieldAlert,
  evento: PencilLine,
  encerramento: Flag,
};

/** Navegação entre as seções do painel: pílulas que rolam no celular, lista lateral no computador. */
export function NavAdmin({ id, atual, contadores }: { id: string; atual: IdSecao; contadores: Partial<Record<IdSecao, number>> }) {
  return (
    <nav aria-label="Seções do painel do organizador" className="-mx-3 lg:mx-0">
      <ul className="rolagem-fina flex gap-1.5 overflow-x-auto px-3 pb-1 lg:vidro lg:sticky lg:top-24 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:rounded-cartao lg:p-2">
        {SECOES.map((s) => {
          const Icone = ICONES[s.id];
          const ativo = s.id === atual;
          const n = contadores[s.id] ?? 0;
          return (
            <li key={s.id} className="shrink-0">
              <Link
                href={s.id === "resumo" ? `/grupo/${id}/admin` : `/grupo/${id}/admin?aba=${s.id}`}
                scroll={false}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition lg:rounded-2xl lg:px-3",
                  "max-lg:vidro",
                  ativo
                    ? "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white shadow-md"
                    : "text-suave hover:text-texto lg:hover:bg-black/5 lg:dark:hover:bg-white/5",
                )}
              >
                <Icone className="size-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap lg:flex-1">{s.rotulo}</span>
                {n > 0 ? (
                  <span
                    className={cn(
                      "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                      ativo ? "bg-white/25 text-white" : "bg-rubi text-white",
                    )}
                  >
                    {n}
                    <span className="sr-only"> pendente{n === 1 ? "" : "s"}</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
