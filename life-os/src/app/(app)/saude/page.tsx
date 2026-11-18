// SAÚDE E BEM-ESTAR — o ponto de entrada dos módulos de saúde, com o resumo de cada um.
import { HeartPulse } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { aguaDoPeriodo } from "@/lib/servidor/dados";
import { resumoSono } from "@/lib/servidor/sono";
import { resumoSaude } from "@/lib/servidor/saude";
import { checkinsDoPeriodo } from "@/lib/servidor/checkin";
import { db } from "@/lib/db";
import { MODULOS } from "@/lib/modulos";
import { chaveParaData, diaRelativo, hoje, somaDias } from "@/lib/datas";
import { formatarMl } from "@/lib/agua";
import { duracaoMin, formatarDuracao } from "@/lib/sono";
import { HUMOR } from "@/lib/checkin";
import { CabecalhoPagina } from "@/components/ui";
import { CartaoModulo } from "@/components/modulos";
import { CartaoPainelCheckin } from "@/components/checkin/cartao-painel";

export const metadata = { title: "Saúde" };

export default async function PaginaSaude() {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const [agua, sono, saude, checkins, semana, refeicoes] = await Promise.all([
    aguaDoPeriodo(user, hojeK, hojeK),
    resumoSono(user, hojeK),
    resumoSaude(user, hojeK),
    checkinsDoPeriodo(user.id, hojeK, hojeK),
    db.activity.aggregate({
      where: { userId: user.id, day: { gte: chaveParaData(somaDias(hojeK, -6)), lte: chaveParaData(hojeK) } },
      _count: true,
      _sum: { durationMin: true },
    }),
    db.meal.count({ where: { userId: user.id, day: chaveParaData(hojeK) } }),
  ]);
  const dia = agua.resumo[0];
  const humor = checkins.get(hojeK)?.humor;
  const consulta = saude.consultas[0];
  const resumos: Record<string, string> = {
    "/agua": `${formatarMl(dia.aguaMl)} de ${formatarMl(dia.meta)} hoje`,
    "/treinos": semana._count
      ? `${semana._count} ${semana._count === 1 ? "atividade" : "atividades"} · ${formatarDuracao(semana._sum.durationMin ?? 0)} em 7 dias`
      : "Nenhuma atividade nos últimos 7 dias",
    "/sono": sono.ultima ? `Última noite: ${formatarDuracao(duracaoMin(sono.ultima))}` : "Nenhuma noite registrada ainda",
    "/mente": humor ? `Humor de hoje: ${HUMOR[humor]}` : "Sem check-in de humor hoje",
    "/alimentacao": refeicoes ? `${refeicoes} ${refeicoes === 1 ? "refeição registrada" : "refeições registradas"} hoje` : "Nenhuma refeição registrada hoje",
    "/saude/central": consulta
      ? `Próxima consulta: ${diaRelativo(consulta.dia, hojeK)}${consulta.hora ? ` às ${consulta.hora}` : ""}`
      : saude.medicamentosAtivos
        ? `${saude.medicamentosAtivos} medicamento(s) em uso`
        : "Nenhuma consulta marcada",
  };
  const mods = MODULOS.filter((m) => m.grupo === "saude");
  return (
    <>
      <CabecalhoPagina
        rotulo="Saúde"
        titulo={
          <span className="flex items-center gap-2">
            <HeartPulse className="h-7 w-7 text-eletrico-claro" /> Saúde e bem-estar
          </span>
        }
        descricao="Acompanhar, sem diagnosticar: os módulos mostram padrões dos seus próprios registros."
      />
      <div className="mb-4">
        <CartaoPainelCheckin user={user} hojeK={hojeK} />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {mods.map((m) => (
          <CartaoModulo key={m.nome} m={m} resumo={m.href ? resumos[m.href] : undefined} />
        ))}
      </div>
      <p className="mt-6 text-xs text-apagado">
        O LIFE OS não faz diagnóstico nem substitui orientação profissional. Em caso de dúvida sobre a sua saúde, procure um
        profissional e converse com um adulto de confiança.
      </p>
    </>
  );
}
