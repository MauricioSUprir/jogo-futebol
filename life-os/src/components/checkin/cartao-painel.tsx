// Cartão "Como estou hoje" do painel: o check-in do dia (energia, humor, estresse e disposição).
import { Annoyed, Frown, HeartHandshake, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { checkinsDoPeriodo } from "@/lib/servidor/checkin";
import { DISPOSICAO, ESTRESSE, HUMOR, mediaDe, umaCasa } from "@/lib/checkin";
import { somaDias } from "@/lib/datas";
import { Cartao, classesBotao } from "../ui";
import { Dialogo } from "../cliente";
import { FormCheckin } from "./form";

const ICONES: Record<number, LucideIcon> = { 1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh };

export async function CartaoPainelCheckin({ user, hojeK }: { user: User; hojeK: string }) {
  const mapa = await checkinsDoPeriodo(user.id, somaDias(hojeK, -6), hojeK);
  const hojeC = mapa.get(hojeK) ?? null;
  const semana = [...mapa.values()];
  const energia7 = mediaDe(semana.map((c) => c.energia));
  const humor7 = mediaDe(semana.map((c) => c.humor));
  const IconeHumor = hojeC?.humor ? ICONES[hojeC.humor] : HeartHandshake;
  return (
    <Cartao
      titulo="Como estou hoje"
      icone={HeartHandshake}
      acao={
        <Dialogo
          gatilho={hojeC ? "Editar" : "Registrar"}
          classeGatilho={classesBotao(hojeC ? "fantasma" : "contorno", "p")}
          titulo="Como você está hoje?"
          descricao="Leva 10 segundos. Só você vê."
        >
          <FormCheckin dia={hojeK} atual={hojeC} />
        </Dialogo>
      }
    >
      {hojeC ? (
        <div className="flex items-center gap-4">
          <div className="grid grid-cols-1 h-14 w-14 shrink-0 place-items-center rounded-2xl border border-borda bg-painel-2">
            <IconeHumor className="h-7 w-7 text-violeta-claro" aria-hidden />
          </div>
          <dl className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-1 text-sm">
            <dt className="text-suave">Humor</dt>
            <dd className="text-right">{hojeC.humor ? HUMOR[hojeC.humor] : "—"}</dd>
            <dt className="text-suave">Energia</dt>
            <dd className="numero text-right">{hojeC.energia ? `${hojeC.energia}/10` : "—"}</dd>
            <dt className="text-suave">Estresse</dt>
            <dd className="text-right">{hojeC.estresse ? ESTRESSE[hojeC.estresse] : "—"}</dd>
            <dt className="text-suave">Disposição</dt>
            <dd className="text-right">{hojeC.disposicao ? DISPOSICAO[hojeC.disposicao] : "—"}</dd>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-suave">Ainda sem check-in hoje. Registre humor, energia e disposição para ver seus padrões com o tempo.</p>
      )}
      {semana.length >= 2 && (
        <p className="mt-3 text-xs text-suave">
          Últimos 7 dias: energia média <span className="numero text-texto">{umaCasa(energia7)}</span>/10
          {humor7 !== null && (
            <>
              {" "}· humor médio <span className="numero text-texto">{umaCasa(humor7)}</span>/5
            </>
          )}
          .
        </p>
      )}
    </Cartao>
  );
}
