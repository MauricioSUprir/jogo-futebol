"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, ChevronRight, CircleHelp, Clock, Crown, Eye, EyeOff, Gift, Search, ShoppingBag, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Selo, Vazio } from "@/components/ui/cartao";
import { cn } from "@/lib/cn";

export type CartaoMembro = {
  participanteId: string;
  usuarioId: string;
  nome: string;
  apelido: string | null;
  avatar: string | null;
  admin: boolean;
  dono: boolean;
  eu: boolean;
  rsvp: "yes" | "maybe" | "no" | null;
  comprou: boolean;
  viu: boolean;
  itensDesejos: number;
};

const PRESENCA = {
  yes: { texto: "Vai", icone: Check, cor: "esmeralda" as const },
  maybe: { texto: "Talvez", icone: CircleHelp, cor: "ouro" as const },
  no: { texto: "Não vai", icone: X, cor: "rubi" as const },
};

/** Grade de participantes com busca (só aparece com mais de 6 pessoas). */
export function GradeParticipantes({ base, membros, sorteado }: { base: string; membros: CartaoMembro[]; sorteado: boolean }) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const q = busca.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!q) return membros;
    return membros.filter((m) =>
      `${m.nome} ${m.apelido ?? ""}`.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q),
    );
  }, [busca, membros]);
  return (
    <div className="flex flex-col gap-4">
      {membros.length > 6 ? (
        <label className="vidro flex h-12 items-center gap-2 rounded-full px-4 focus-within:ring-4 focus-within:ring-ouro/30">
          <Search className="size-4 shrink-0 text-suave" aria-hidden />
          <span className="sr-only">Buscar participante</span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pelo nome ou apelido"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-suave/80"
          />
        </label>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {busca ? `${lista.length} participante${lista.length === 1 ? "" : "s"} encontrado${lista.length === 1 ? "" : "s"}` : ""}
      </p>
      {lista.length === 0 ? (
        <Vazio titulo="Ninguém com esse nome" texto="Confira a grafia ou apague a busca." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((m) => {
            const p = m.rsvp ? PRESENCA[m.rsvp] : null;
            const IconeP = p?.icone ?? Clock;
            return (
              <li key={m.participanteId}>
                <Link
                  href={`${base}/participantes/${m.participanteId}`}
                  className={cn(
                    "vidro group flex h-full flex-col gap-3 rounded-cartao p-4 transition hover:-translate-y-0.5",
                    m.eu && "ring-2 ring-[color-mix(in_oklab,var(--t1)_45%,transparent)]",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Avatar nome={m.nome} caminho={m.avatar} tamanho={56} anel={m.admin} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        <span className="truncate">{m.nome}</span>
                        {m.eu ? <span className="shrink-0 text-xs font-medium text-suave">(você)</span> : null}
                      </p>
                      {m.apelido ? <p className="truncate text-sm text-suave">“{m.apelido}”</p> : null}
                      <div className="mt-1 flex flex-wrap gap-1">
                        {m.admin ? (
                          <Selo cor="ouro">
                            <Crown className="size-3" aria-hidden /> {m.dono ? "Criador" : "Organiza"}
                          </Selo>
                        ) : null}
                        <Selo cor={p?.cor ?? "neutro"}>
                          <IconeP className="size-3" aria-hidden /> {p ? p.texto : "Sem resposta"}
                        </Selo>
                      </div>
                    </div>
                    <ChevronRight className="size-5 shrink-0 text-suave transition group-hover:translate-x-0.5" aria-hidden />
                  </div>
                  <ul className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 border-t border-borda pt-3 text-xs font-medium text-suave">
                    <li className="flex items-center gap-1.5">
                      <Gift className="size-3.5 text-t1" aria-hidden />
                      {m.itensDesejos ? `${m.itensDesejos} ${m.itensDesejos === 1 ? "desejo" : "desejos"} na lista` : "Lista vazia"}
                    </li>
                    {sorteado ? (
                      <>
                        <li className={cn("flex items-center gap-1.5", m.viu && "text-esmeralda")}>
                          {m.viu ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                          {m.viu ? "Viu o resultado" : "Ainda não viu"}
                        </li>
                        <li className={cn("flex items-center gap-1.5", m.comprou && "text-esmeralda")}>
                          <ShoppingBag className="size-3.5" aria-hidden />
                          {m.comprou ? "Comprou" : "Ainda não comprou"}
                        </li>
                      </>
                    ) : null}
                  </ul>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
