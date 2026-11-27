import {
  Archive,
  ArchiveRestore,
  Flag,
  Gift,
  Grid3x3,
  Megaphone,
  PartyPopper,
  Radio,
  RefreshCw,
  ScrollText,
  Shuffle,
  Sparkles,
  UserMinus,
  UserPlus,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { dataHora } from "@/lib/formatos";

export type Registro = { id: number; kind: string; data: Record<string, unknown>; created_at: string };

const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Uma linha da linha do tempo (event_log) em frase humana. null = não mostrar. Nada aqui revela o sorteio. */
export function fraseDoRegistro(kind: string, data: Record<string, unknown>): { texto: string; icone: LucideIcon; destaque?: boolean } | null {
  switch (kind) {
    case "created":
      return { texto: "O amigo oculto foi criado", icone: Sparkles, destaque: true };
    case "joined":
      return { texto: `${t(data.nome) ?? "Alguém"} entrou no grupo`, icone: UserPlus };
    case "left":
      return { texto: `${t(data.nome) ?? "Alguém"} saiu do grupo`, icone: UserMinus };
    case "removed":
      return { texto: `${t(data.nome) ?? "Alguém"} deixou o grupo`, icone: UserMinus };
    case "rules_changed":
      return { texto: "As regras do grupo foram atualizadas", icone: ScrollText };
    case "draw": {
      const n = Number(data.participantes);
      return { texto: n ? `O sorteio foi realizado com ${n} participantes` : "O sorteio foi realizado", icone: Shuffle, destaque: true };
    }
    case "redraw":
      return { texto: "O sorteio foi refeito", icone: RefreshCw };
    case "announcement":
      return { texto: t(data.titulo) ? `Aviso: ${t(data.titulo)}` : "Novo aviso do organizador", icone: Megaphone };
    case "poll":
      return { texto: t(data.pergunta) ? `Nova enquete: ${t(data.pergunta)}` : "Nova enquete", icone: Vote };
    case "live_started":
      return { texto: "A revelação ao vivo começou", icone: Radio, destaque: true };
    case "reveal":
      return t(data.de) && t(data.para) ? { texto: `${t(data.de)} revelou que tirou ${t(data.para)}`, icone: Gift } : { texto: "Uma revelação ao vivo", icone: Gift };
    case "bingo":
      return { texto: `${t(data.nome) ?? "Alguém"} fez BINGO!`, icone: Grid3x3 };
    case "live_finished":
      return { texto: "A revelação ao vivo terminou com festa", icone: PartyPopper, destaque: true };
    case "finished":
      return { texto: data.automatico ? "O amigo oculto foi encerrado automaticamente" : "O amigo oculto foi encerrado", icone: Flag, destaque: true };
    case "archived":
      return { texto: "O grupo foi arquivado", icone: Archive };
    case "unarchived":
      return { texto: "O grupo saiu do arquivo", icone: ArchiveRestore };
    default:
      return null;
  }
}

export function LinhaDoTempo({ registros }: { registros: Registro[] }) {
  const itens = registros.map((r) => ({ r, f: fraseDoRegistro(r.kind, r.data ?? {}) })).filter((x) => x.f);
  if (!itens.length) return <p className="text-sm text-suave">Nada registrado ainda.</p>;
  return (
    <ol className="relative flex flex-col gap-4 border-l-2 border-[color-mix(in_oklab,var(--t1)_30%,transparent)] pl-6">
      {itens.map(({ r, f }) => {
        const Icone = f!.icone;
        return (
          <li key={r.id} className="relative">
            <span
              className={
                f!.destaque
                  ? "absolute -left-[2.35rem] top-0 inline-flex size-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_65%,black))] text-white shadow-md"
                  : "absolute -left-[2.1rem] top-0.5 inline-flex size-7 items-center justify-center rounded-full border border-borda bg-[var(--fundo)] text-t1"
              }
              aria-hidden
            >
              <Icone className="size-4" />
            </span>
            <p className={f!.destaque ? "font-titulo text-lg font-semibold" : "text-[15px]"}>{f!.texto}</p>
            <p className="text-xs text-suave">{dataHora(r.created_at, { year: "numeric" })}</p>
          </li>
        );
      })}
    </ol>
  );
}
