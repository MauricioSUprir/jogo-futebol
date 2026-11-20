// Cartão do Mind Center no painel: o check-in de hoje e as coisas boas recentes.
// Nunca mostra o texto do diário; com a senha extra ligada, nem as coisas boas (só quantas foram).
import Link from "next/link";
import { ArrowRight, BrainCircuit, Sparkles } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { chaveParaData, somaDias } from "@/lib/datas";
import { ESTRESSE } from "@/lib/checkin";
import { checkinsDoPeriodo } from "@/lib/servidor/checkin";
import { lerEntradas } from "@/lib/servidor/mente";
import { Cartao, classesBotao } from "../ui";
import { SeloHumor } from "./humor";

export async function CartaoPainelMente({ user, hojeK }: { user: User; hojeK: string }) {
  const desde = somaDias(hojeK, -6);
  const [checkins, trava] = await Promise.all([
    checkinsDoPeriodo(user.id, hojeK, hojeK),
    db.journalLock.findUnique({ where: { userId: user.id }, select: { userId: true } }),
  ]);
  const hojeC = checkins.get(hojeK);
  let coisas: string[] = [];
  let contagem = 0;
  if (trava) {
    contagem = await db.journalEntry.count({ where: { userId: user.id, kind: "positivo", day: { gte: chaveParaData(desde) } } });
  } else {
    const ents = await lerEntradas(user.id, { temSenha: false, aberto: true }, { tipo: "positivo", de: desde, limite: 3 });
    coisas = ents.flatMap((e) => e.texto.split("\n")).filter(Boolean).slice(0, 3);
  }
  const temCheckin = hojeC && (hojeC.humor !== null || hojeC.energia !== null || hojeC.estresse !== null);
  return (
    <Cartao
      titulo="Mind Center"
      icone={BrainCircuit}
      acao={
        <Link href="/mente" className={classesBotao("fantasma", "p")}>
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {temCheckin ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {hojeC.humor !== null && <SeloHumor humor={hojeC.humor} grande />}
          <dl className="flex gap-4 text-sm">
            {hojeC.energia !== null && (
              <div>
                <dt className="rotulo">Energia</dt>
                <dd className="numero font-display text-lg font-semibold">{hojeC.energia}/10</dd>
              </div>
            )}
            {hojeC.estresse !== null && (
              <div>
                <dt className="rotulo">Estresse</dt>
                <dd className="font-display text-lg font-semibold">{ESTRESSE[hojeC.estresse]}</dd>
              </div>
            )}
          </dl>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-suave">Como você está hoje?</p>
          <Link href="/mente" className={classesBotao("secundario", "p")}>
            Fazer check-in
          </Link>
        </div>
      )}
      <div className="mt-4 border-t border-borda pt-3">
        <p className="rotulo mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-alerta" aria-hidden /> Coisas boas
        </p>
        {trava ? (
          <p className="text-sm text-suave">
            {contagem > 0 ? `${contagem} registro(s) nos últimos 7 dias, guardados no diário trancado.` : "Nenhuma nos últimos 7 dias."}
          </p>
        ) : coisas.length ? (
          <ul className="grid grid-cols-1 gap-1 text-sm">
            {coisas.map((c, i) => (
              <li key={i} className="truncate">
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-suave">Anote uma coisa boa de hoje no Mind Center.</p>
        )}
      </div>
    </Cartao>
  );
}
