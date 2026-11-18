// Cartão do Fitness Center na Central de Comando: minutos da semana, o treino de hoje pela grade, a última
// atividade e o alerta de recuperação mais importante.
import Link from "next/link";
import { ArrowRight, Dumbbell, Play, ShieldAlert } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { Cartao, classesBotao } from "../ui";
import { baseDosAlertas, carregarAtividades } from "@/lib/servidor/treinos";
import { dataParaChave, diaDaSemana, diaRelativo, somaDias } from "@/lib/datas";
import { formatarDuracao, minutosPorTipo } from "@/lib/treinos";
import { tituloAtividade } from "./partes";

export async function CartaoPainelTreinos({ user, hojeK }: { user: User; hojeK: string }) {
  const dow = diaDaSemana(hojeK);
  const [base, recentes, fichas] = await Promise.all([
    baseDosAlertas(user.id, hojeK),
    carregarAtividades(user.id, somaDias(hojeK, -30), hojeK),
    db.workoutPlan.findMany({ where: { userId: user.id, archived: false }, select: { id: true, name: true, weekdays: true } }),
  ]);
  const porTipo = minutosPorTipo(base.resumo, somaDias(hojeK, -6), hojeK);
  const total = porTipo.musculacao + porTipo.cardio + porTipo.futebol;
  const deHoje = fichas.filter((f) => (f.weekdays >> dow) & 1);
  const feitoHoje = recentes.some((a) => dataParaChave(a.day) === hojeK);
  const ultima = recentes[0];
  const alerta = base.alertas.find((a) => a.tom === "atencao");
  return (
    <Cartao
      titulo="Fitness Center"
      icone={Dumbbell}
      acao={
        <Link href="/treinos" className={classesBotao("fantasma", "p")}>
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <dl className="grid grid-cols-3 gap-2">
        {[
          { r: "Musculação", v: porTipo.musculacao },
          { r: "Cardio", v: porTipo.cardio },
          { r: "Futebol", v: porTipo.futebol },
        ].map((k) => (
          <div key={k.r} className="min-w-0">
            <dt className="rotulo truncate">{k.r}</dt>
            <dd className="numero mt-0.5 font-display text-lg font-semibold">{k.v}<span className="text-xs font-normal text-suave"> min</span></dd>
          </div>
        ))}
      </dl>
      <p className="mt-1 text-xs text-apagado">Últimos 7 dias · {formatarDuracao(total)} no total</p>
      <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
        {deHoje.length > 0 && !feitoHoje ? (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="text-suave">Hoje:</span>
            {deHoje.map((f) => (
              <Link key={f.id} href={`/treinos/sessao?ficha=${f.id}`} className={classesBotao("secundario", "p", "max-w-full")}>
                <Play className="h-3.5 w-3.5 text-eletrico-claro" aria-hidden /> <span className="truncate">{f.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-suave">{feitoHoje ? "Atividade de hoje registrada." : fichas.length ? "Hoje é dia de recuperação na sua grade." : "Nenhuma ficha na semana ainda."}</p>
        )}
        {ultima && (
          <p className="truncate text-xs text-apagado">
            Última: {tituloAtividade(ultima)} · {diaRelativo(dataParaChave(ultima.day), hojeK)} · {formatarDuracao(ultima.durationMin)}
          </p>
        )}
        {alerta && (
          <p className="flex gap-2 rounded-xl border border-alerta/30 bg-alerta/10 px-3 py-2 text-xs">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-alerta" aria-hidden />
            <span>{alerta.texto}</span>
          </p>
        )}
      </div>
    </Cartao>
  );
}
