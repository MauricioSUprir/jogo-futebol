import Link from "next/link";
import { Archive, ExternalLink, Flag, MonitorPlay, Radio, Smartphone, Trash2 } from "lucide-react";
import type { Grupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao, Selo, TituloCartao } from "@/components/ui/cartao";
import { classesBotao } from "@/components/ui/botao";
import { BotaoArquivar, BotaoEncerrar, BotaoExcluir } from "@/components/admin/encerramento-cliente";
import { dataHora } from "@/lib/formatos";

export async function SecaoEncerramento({ g }: { g: Grupo }) {
  const e = g.evento;
  const supabase = await clienteServidor();
  const { data: sessao } = await supabase
    .from("live_sessions")
    .select("status, mode, presented, speech_seconds, started_at, finished_at")
    .eq("event_id", e.id)
    .maybeSingle();
  const sorteado = e.status !== "open";
  const apresentados = sessao?.presented?.length ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <Cartao forte>
        <TituloCartao
          icone={<MonitorPlay className="size-5" />}
          titulo="Revelação ao vivo"
          descricao="No dia do encontro, abra o telão numa TV ou projetor: cada pessoa revela quem tirou pelo próprio celular."
        />
        {!sorteado ? (
          <p className="rounded-2xl bg-ouro/12 px-4 py-3 text-sm">A revelação ao vivo fica disponível depois do sorteio.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {sessao ? (
                sessao.status === "running" ? (
                  <Selo cor="rubi">
                    <Radio className="size-3" aria-hidden /> Acontecendo agora
                  </Selo>
                ) : (
                  <Selo cor="esmeralda">Encerrada {sessao.finished_at ? `em ${dataHora(sessao.finished_at)}` : ""}</Selo>
                )
              ) : (
                <Selo>Ainda não começou</Selo>
              )}
              {sessao ? (
                <span className="text-suave">
                  Modo {sessao.mode === "chain" ? "corrente (quem foi revelado apresenta o próximo)" : "aleatório"} · {apresentados} de{" "}
                  {g.totalAprovados} já apresentaram · {sessao.speech_seconds}s por pessoa
                </span>
              ) : (
                <span className="text-suave">Você escolhe o modo (corrente ou ordem aleatória) e o tempo de fala ao iniciar no telão.</span>
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a href={`/telao/${e.id}`} target="_blank" rel="noopener" className={classesBotao("primario", "m")}>
                <MonitorPlay className="size-4" aria-hidden /> {sessao?.status === "running" ? "Abrir o telão" : "Ir para o telão"}
                <ExternalLink className="size-3.5 opacity-80" aria-hidden />
              </a>
              <Link href={`/grupo/${e.id}/ao-vivo/participar`} className={classesBotao("contorno", "m")}>
                <Smartphone className="size-4" aria-hidden /> Tela do participante
              </Link>
            </div>
            <p className="text-xs text-suave">O telão só mostra os pares que cada pessoa revelou por conta própria (ou autorizou você a revelar).</p>
          </div>
        )}
      </Cartao>

      <Cartao>
        <TituloCartao icone={<Flag className="size-5" />} titulo="Encerrar" descricao="Quando a troca de presentes acabar: encerra o evento e abre o álbum de memórias para todos." />
        {e.status === "finished" ? (
          <p className="text-sm text-suave">Encerrado em {dataHora(e.finished_at)}.</p>
        ) : (
          <>
            <BotaoEncerrar eventoId={e.id} podeEncerrar={e.status === "drawn"} />
            {e.status !== "drawn" ? <p className="mt-2 text-xs text-suave">Disponível depois do sorteio.</p> : null}
          </>
        )}
      </Cartao>

      <Cartao>
        <TituloCartao
          icone={<Archive className="size-5" />}
          titulo={e.archived_at ? "Grupo arquivado" : "Arquivar"}
          descricao={e.archived_at ? `Arquivado em ${dataHora(e.archived_at)}.` : "Guarda o grupo sem apagar nada. Bom para pausar ou para tirar da lista depois da festa."}
        />
        <BotaoArquivar eventoId={e.id} arquivado={!!e.archived_at} />
      </Cartao>

      <Cartao className="border-rubi/30">
        <TituloCartao icone={<Trash2 className="size-5" />} titulo="Excluir o grupo" descricao="Apaga tudo para sempre. Só quem criou o grupo pode excluir." />
        {g.dono ? <BotaoExcluir eventoId={e.id} nome={e.name} /> : <p className="text-sm text-suave">Só quem criou o grupo pode excluí-lo.</p>}
      </Cartao>
    </div>
  );
}
