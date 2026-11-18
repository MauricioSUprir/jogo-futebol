// Cartão do Study Center na Central de Comando: minutos da semana × meta, revisões de hoje e a próxima prova.
import Link from "next/link";
import { ArrowRight, CalendarClock, GraduationCap, Repeat } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { resumoEstudos } from "@/lib/servidor/estudos";
import { diaRelativo, diasEntre } from "@/lib/datas";
import { contagem, formatarMinutos, pct } from "@/lib/estudos";
import { Barra, Cartao, classesBotao } from "../ui";

export async function CartaoPainelEstudos({ user, hojeK }: { user: User; hojeK: string }) {
  const r = await resumoEstudos(user, hojeK);
  const revisoes = r.revisoesHoje + r.cartoesHoje;
  return (
    <Cartao
      titulo="Study Center"
      icone={GraduationCap}
      acao={
        <Link href="/estudos" className={classesBotao("fantasma", "p")}>
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {r.materias === 0 ? (
        <p className="py-3 text-sm text-suave">
          <Link href="/estudos" className="text-eletrico-claro hover:underline">
            Cadastre as matérias
          </Link>{" "}
          para acompanhar horas, provas e notas.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div>
            <p className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-suave">Estudo da semana</span>
              <span className="numero">
                {formatarMinutos(r.minutosSemana)} <span className="text-suave">de {formatarMinutos(r.metaSemana)}</span>
              </span>
            </p>
            <Barra pct={pct(r.minutosSemana, r.metaSemana)} className="mt-1.5" rotulo="Estudo da semana" />
          </div>
          <Link href="/estudos?aba=revisoes" className="flex items-center gap-2 text-sm hover:text-eletrico-claro">
            <Repeat className="h-4 w-4 shrink-0 text-violeta-claro" aria-hidden />
            {revisoes ? `${revisoes} ${revisoes === 1 ? "revisão" : "revisões"} para hoje` : "Nenhuma revisão para hoje"}
          </Link>
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <CalendarClock className="h-4 w-4 shrink-0 text-perigo" aria-hidden />
            {r.proximaProva ? (
              <span className="min-w-0 truncate">
                {r.proximaProva.titulo} <span className="text-suave">· {diaRelativo(r.proximaProva.dia, hojeK)}
                  {Math.abs(diasEntre(hojeK, r.proximaProva.dia)) > 1 && ` (${contagem(diasEntre(hojeK, r.proximaProva.dia))})`}</span>
              </span>
            ) : (
              <span className="text-suave">Nenhuma prova nos próximos 30 dias</span>
            )}
          </p>
        </div>
      )}
    </Cartao>
  );
}
