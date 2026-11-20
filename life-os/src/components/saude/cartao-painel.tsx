// Cartão do Health Center no painel: próxima consulta, próxima dose, medicamentos em uso e o check-in de hoje.
import Link from "next/link";
import { ArrowRight, CalendarClock, HeartPulse, Pill, Stethoscope, Syringe } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { diaRelativo } from "@/lib/datas";
import { DISPOSICAO } from "@/lib/checkin";
import { resumoSaude } from "@/lib/servidor/saude";
import { Cartao, classesBotao } from "../ui";

export async function CartaoPainelSaude({ user, hojeK }: { user: User; hojeK: string }) {
  const r = await resumoSaude(user, hojeK);
  const prox = r.consultas[0];
  const dose = r.doses[0];
  const linhas = [
    {
      icone: CalendarClock,
      rotulo: "Próxima consulta",
      valor: prox ? `${diaRelativo(prox.dia, hojeK)}${prox.hora ? ` ${prox.hora}` : ""} · ${prox.titulo}` : "Nenhuma marcada",
    },
    { icone: Syringe, rotulo: "Próxima dose", valor: dose ? `${diaRelativo(dose.dia, hojeK)} · ${dose.titulo}` : "Nenhuma registrada" },
    { icone: Pill, rotulo: "Medicamentos em uso", valor: String(r.medicamentosAtivos) },
    {
      icone: HeartPulse,
      rotulo: "Check-in de hoje",
      valor: r.checkinHoje
        ? `Energia ${r.checkinHoje.energia ?? "—"}/10${r.checkinHoje.disposicao ? ` · ${DISPOSICAO[r.checkinHoje.disposicao]}` : ""}`
        : "Ainda não feito",
    },
  ];
  return (
    <Cartao
      titulo="Health Center"
      icone={Stethoscope}
      acao={
        <Link href="/saude/central" className={classesBotao("fantasma", "p")}>
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <ul className="grid grid-cols-1 gap-2">
        {linhas.map((l) => (
          <li key={l.rotulo} className="flex min-w-0 items-center gap-3">
            <l.icone className="h-4 w-4 shrink-0 text-eletrico-claro" aria-hidden />
            <div className="min-w-0">
              <p className="text-[0.7rem] text-apagado">{l.rotulo}</p>
              <p className="truncate text-sm">{l.valor}</p>
            </div>
          </li>
        ))}
      </ul>
      {!r.checkinHoje && (
        <Link href="/saude/central?aba=diario" className={classesBotao("contorno", "p", "mt-3")}>
          Fazer o check-in
        </Link>
      )}
    </Cartao>
  );
}
