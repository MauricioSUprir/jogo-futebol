// Cartão do Goals Center na Central de Comando: as 3 metas ativas de maior prioridade.
import Link from "next/link";
import { ArrowRight, Target } from "lucide-react";
import type { User } from "@/generated/prisma/client";
import { metasEmDestaque } from "@/lib/servidor/metas";
import { textoPrazo } from "@/lib/metas";
import { Barra, Cartao, classesBotao } from "../ui";
import { IconeCategoria } from "./icones";
import { cn } from "@/lib/cn";

export async function CartaoPainelMetas({ user, hojeK }: { user: User; hojeK: string }) {
  const metas = await metasEmDestaque(user.id, 3);
  return (
    <Cartao
      titulo="Metas"
      icone={Target}
      acao={
        <Link href="/metas" className={classesBotao("fantasma", "p")}>
          Abrir <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      {metas.length === 0 ? (
        <p className="py-3 text-sm text-suave">
          <Link href="/metas" className="text-eletrico-claro hover:underline">
            Crie uma meta
          </Link>{" "}
          e divida em etapas para acompanhar o progresso.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3">
          {metas.map((m) => {
            const prazo = m.prazo ? textoPrazo(m.prazo, hojeK) : null;
            return (
              <li key={m.id}>
                <Link href={`/metas/${m.id}`} className="flex min-w-0 items-center gap-3 hover:text-eletrico-claro">
                  <IconeCategoria categoria={m.category} tamanho="p" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{m.title}</span>
                      <span className="numero shrink-0 text-xs text-suave">{m.progresso}%</span>
                    </p>
                    <Barra pct={m.progresso} className="mt-1 h-1.5" rotulo={`Progresso de ${m.title}`} />
                    <p className={cn("mt-0.5 truncate text-xs", prazo?.atrasada ? "text-alerta" : "text-suave")}>
                      {m.texto}
                      {prazo && ` · ${prazo.texto}`}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Cartao>
  );
}
