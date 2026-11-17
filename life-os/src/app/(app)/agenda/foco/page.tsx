// MODO FOCO — só a atividade de agora (e a próxima).
import Link from "next/link";
import { ArrowLeft, Check, Coffee } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { carregarAgenda, itensDoDia } from "@/lib/servidor/dados";
import { hoje, horaNoFuso } from "@/lib/datas";
import { categoriaEvento } from "@/lib/catalogo";
import { concluirTarefa } from "@/acoes/agenda";
import { Atualizador } from "@/components/cliente";
import { Contagem } from "@/components/agenda/contagem";
import { classesBotao } from "@/components/ui";

export const metadata = { title: "Modo foco" };

export default async function ModoFoco() {
  const user = await exigirUsuario();
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const agora = Date.now();
  const itens = itensDoDia(await carregarAgenda(user, hojeK, hojeK), hojeK).filter((i) => !i.diaInteiro && !i.concluida);
  const atual = itens.find((i) => i.inicio.getTime() <= agora && (i.fim ? i.fim.getTime() : i.inicio.getTime() + 30 * 60_000) > agora);
  const proximo = itens.find((i) => i.inicio.getTime() > agora);
  const cor = atual ? (atual.tipo === "tarefa" ? "#a78bfa" : categoriaEvento(atual.categoria).cor) : "#60a5fa";

  return (
    <div className="grid grid-cols-1 min-h-[70dvh] place-items-center">
      <Atualizador segundos={30} />
      <div className="w-full max-w-2xl text-center">
        <Link href="/agenda" className={classesBotao("fantasma", "p", "mb-6")}>
          <ArrowLeft className="h-4 w-4" /> Sair do foco
        </Link>
        <div className="painel holo px-6 py-10 sm:px-10">
          <p className="rotulo mb-4">Modo foco</p>
          {atual ? (
            <>
              <p className="mb-2 text-sm" style={{ color: cor }}>
                {atual.tipo === "tarefa" ? "Tarefa" : categoriaEvento(atual.categoria).nome} · {horaNoFuso(atual.inicio, tz)}
                {atual.fim && `–${horaNoFuso(atual.fim, tz)}`}
              </p>
              <h1 className="mb-8 font-display text-3xl font-bold sm:text-4xl">{atual.titulo}</h1>
              <Contagem inicio={atual.inicio.getTime()} fim={atual.fim ? atual.fim.getTime() : atual.inicio.getTime() + 30 * 60_000} />
              {atual.tipo === "tarefa" && (
                <form action={concluirTarefa} className="mt-8">
                  <input type="hidden" name="id" value={atual.id} />
                  <button className={classesBotao("primario", "g")}>
                    <Check className="h-5 w-5" /> Concluir tarefa
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <Coffee className="mx-auto mb-3 h-10 w-10 text-eletrico-claro" aria-hidden />
              <h1 className="font-display text-3xl font-bold">Livre agora</h1>
              <p className="mt-2 text-suave">Nenhuma atividade marcada para este horário.</p>
            </>
          )}
        </div>
        {proximo && (
          <p className="mt-6 text-sm text-suave">
            A seguir: <span className="text-texto">{proximo.titulo}</span> às <span className="numero">{horaNoFuso(proximo.inicio, tz)}</span>
          </p>
        )}
      </div>
    </div>
  );
}
