import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

/** Cabeçalho das páginas de cada jogo: voltar para a central + título + descrição. */
export function TopoJogo({
  eventoId,
  icone,
  titulo,
  descricao,
  acao,
}: {
  eventoId: string;
  icone: ReactNode;
  titulo: string;
  descricao: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3">
      <Link
        href={`/grupo/${eventoId}/jogos`}
        className="inline-flex w-fit items-center gap-1.5 rounded-full py-1 pr-2 text-sm font-semibold text-suave transition hover:text-texto"
      >
        <ArrowLeft className="size-4" aria-hidden /> Todos os jogos
      </Link>
      <div className="flex flex-wrap items-start gap-4">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_75%,black))] text-white shadow-md">
          {icone}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-titulo text-2xl font-semibold leading-tight sm:text-3xl">{titulo}</h2>
          <p className="mt-1 max-w-2xl text-sm text-suave sm:text-[15px]">{descricao}</p>
        </div>
        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>
    </div>
  );
}

/** Aviso fixo de confiança: nada nos jogos revela o sorteio. */
export function AvisoSigilo({ children }: { children?: ReactNode }) {
  return (
    <p className="vidro flex items-start gap-2 rounded-2xl px-4 py-3 text-sm text-suave">
      <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-esmeralda" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      <span>{children ?? "Nenhum jogo revela quem tirou quem. O sigilo do sorteio fica guardado até a revelação."}</span>
    </p>
  );
}
