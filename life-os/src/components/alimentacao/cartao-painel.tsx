// Cartão do Nutrition Hub no painel: refeições e grupos de hoje e o planejado para o dia.
import Link from "next/link";
import { Apple, ArrowRight, Dumbbell } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { GRUPOS, GRUPOS_VARIEDADE, REFEICOES, gruposDiferentes, planoDoDia, type Refeicao } from "@/lib/alimentacao";
import { diasDeTreino, refeicoesDoPeriodo } from "@/lib/servidor/alimentacao";
import { Cartao, Selo, classesBotao } from "../ui";

export async function CartaoPainelAlimentacao({ user, hojeK }: { user: User; hojeK: string }) {
  const [refeicoes, treino, plano] = await Promise.all([
    refeicoesDoPeriodo(user, hojeK, hojeK),
    diasDeTreino(user.id, hojeK, hojeK),
    db.mealPlanItem.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } }),
  ]);
  const grupos = gruposDiferentes(refeicoes);
  const ehTreino = treino.has(hojeK);
  const doDia = planoDoDia(plano, hojeK, ehTreino).slice(0, 3);
  return (
    <Cartao
      titulo="Nutrition Hub"
      icone={Apple}
      acao={
        <Link href="/alimentacao" className={classesBotao("fantasma", "p")}>
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="rotulo">Refeições hoje</dt>
          <dd className="numero mt-1 font-display text-xl font-semibold">{refeicoes.length}</dd>
        </div>
        <div>
          <dt className="rotulo">Variedade</dt>
          <dd className="numero mt-1 font-display text-xl font-semibold">
            {grupos.length}/{GRUPOS_VARIEDADE.length} <span className="text-xs font-normal text-suave">grupos</span>
          </dd>
        </div>
      </dl>
      {grupos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Grupos de hoje">
          {grupos.map((g) => (
            <li key={g}>
              <Selo cor="#34d399">{GRUPOS[g]}</Selo>
            </li>
          ))}
        </ul>
      )}
      {doDia.length > 0 && (
        <div className="mt-4 border-t border-borda pt-3">
          <p className="rotulo mb-1.5 flex items-center gap-1.5">
            Planejado para hoje {ehTreino && <Dumbbell className="h-3.5 w-3.5 text-ok" aria-label="dia de treino" />}
          </p>
          <ul className="grid grid-cols-1 gap-1 text-sm">
            {doDia.map((i) => (
              <li key={i.id} className="truncate">
                <span className="text-suave">{REFEICOES[i.slot as Refeicao] ?? i.slot}:</span> {i.description}
              </li>
            ))}
          </ul>
        </div>
      )}
      {refeicoes.length === 0 && doDia.length === 0 && <p className="mt-3 text-sm text-suave">Registre as refeições pelo botão Registrar.</p>}
    </Cartao>
  );
}
