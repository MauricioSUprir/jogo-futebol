"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Images, Lightbulb, Monitor, Pause, Play, RotateCcw, Send, SkipForward, Sparkles, Square, Wand2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { Cartao, Vazio } from "@/components/ui/cartao";
import { Campo, Interruptor } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar, vibrar } from "@/components/efeitos/som";
import {
  autorizarRevelacaoPublica,
  encerrarAoVivo,
  enviarPistaAoVivo,
  proximoAoVivo,
  revelarMeuAmigo,
  revelarPorParticipante,
  temporizadorAoVivo,
} from "@/lib/acoes/aovivo";
import { relativo } from "@/lib/formatos";
import { mmss, temporizador, useAgora, useAoVivo, type EstadoAoVivo, type PessoaAoVivo } from "@/components/aovivo/estado";
import { ParRevelado } from "@/components/aovivo/partes";

export function ParticiparAoVivo({
  eventoId,
  euId,
  admin,
  pessoas,
  inicial,
  meuAmigo,
}: {
  eventoId: string;
  euId: string;
  admin: boolean;
  pessoas: PessoaAoVivo[];
  inicial: EstadoAoVivo;
  meuAmigo: { nome: string; avatar: string | null } | null;
}) {
  const { som, vibracao, menosMovimento } = usePreferencias();
  const confete = useRef<ConfeteHandle>(null);
  const { avisar } = useAvisos();
  const mapa = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);
  const { estado, recarregar } = useAoVivo(eventoId, inicial, {
    aoRevelar: (r) => {
      tocar("revelar", som);
      if (r.giver_id === euId || r.receiver_id === euId) confete.current?.disparar({ quantidade: 160 });
    },
  });
  const [pista, setPista] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [pendente, iniciar] = useTransition();
  const sessao = estado.sessao;
  const agora = useAgora(500);
  const relogio = temporizador(sessao, agora);
  const minhaVez = sessao?.status === "running" && sessao.current_id === euId;
  const jaRevelei = estado.revelacoes.find((r) => r.giver_id === euId) ?? null;
  const autorizo = estado.autoriza[euId] ?? false;
  const atual = sessao?.current_id ? mapa.get(sessao.current_id) ?? null : null;
  const revelacaoAtual = sessao?.current_id ? estado.revelacoes.find((r) => r.giver_id === sessao.current_id) : null;
  const minhasPistas = estado.pistas.filter((p) => p.participant_id === euId);

  // avisa quando chega a minha vez
  const vezAntes = useRef(minhaVez);
  useEffect(() => {
    if (minhaVez && !vezAntes.current) {
      tocar("sino", som);
      vibrar([80, 60, 80, 60, 200], vibracao);
      avisar("É a sua vez! Faça o seu discurso e revele quem você tirou.", "info");
    }
    vezAntes.current = minhaVez;
  }, [minhaVez, som, vibracao, avisar]);

  function executar(fn: () => Promise<{ ok: boolean; erro?: string; mensagem?: string }>, depois?: () => void) {
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.mensagem) avisar(r.mensagem);
        depois?.();
      } else avisar(r.erro ?? "Algo deu errado.", "erro");
      await recarregar();
    });
  }

  const controlesAdmin = admin ? (
    <Cartao>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-titulo text-lg font-semibold">Controles do organizador</h3>
        <BotaoLink href={`/telao/${eventoId}`} target="_blank" rel="noopener" variante="contorno" tamanho="p">
          <Monitor className="size-4" aria-hidden /> Abrir telão
        </BotaoLink>
      </div>
      {sessao?.status === "running" ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 font-titulo text-2xl font-semibold tabular-nums">{mmss(relogio.restantes)}</span>
            <Botao variante="vidro" tamanho="p" disabled={pendente} onClick={() => executar(() => temporizadorAoVivo(eventoId, relogio.rodando ? "pause" : "start"))}>
              {relogio.rodando ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
              {relogio.rodando ? "Pausar" : "Discurso"}
            </Botao>
            <Botao variante="fantasma" tamanho="p" disabled={pendente} onClick={() => executar(() => temporizadorAoVivo(eventoId, "reset"))}>
              <RotateCcw className="size-4" aria-hidden /> Zerar
            </Botao>
          </div>
          <div className="flex flex-wrap gap-2">
            {atual && !revelacaoAtual && atual.id !== euId ? (
              <Botao
                variante="ouro"
                tamanho="p"
                disabled={!estado.autoriza[atual.id] || pendente}
                onClick={() => executar(() => revelarPorParticipante(eventoId, atual.id))}
                title={estado.autoriza[atual.id] ? undefined : "Essa pessoa não autorizou: ela revela pelo celular"}
              >
                <Wand2 className="size-4" aria-hidden /> Revelar por {atual.nome.split(" ")[0]}
              </Botao>
            ) : null}
            <Botao tamanho="p" disabled={pendente} onClick={() => executar(() => proximoAoVivo(eventoId))}>
              <SkipForward className="size-4" aria-hidden /> Próximo
            </Botao>
            <Botao variante="contorno" tamanho="p" disabled={pendente} onClick={() => setConfirmarFim(true)}>
              <Square className="size-4" aria-hidden /> Encerrar
            </Botao>
          </div>
        </div>
      ) : (
        <p className="text-sm text-suave">Configure e inicie a revelação pelo telão (TV ou computador).</p>
      )}
    </Cartao>
  ) : null;

  return (
    <div className="flex flex-col gap-5">
      <Confete ref={confete} desligado={menosMovimento} />
      {!sessao ? (
        <>
          <Cartao forte className="text-center">
            <Sparkles className="mx-auto size-10 text-ouro" aria-hidden />
            <h2 className="mt-3 font-titulo text-2xl font-semibold">Revelação ao vivo</h2>
            <p className="mx-auto mt-2 max-w-lg text-suave">
              No dia do encontro, o organizador abre o telão na TV ou no computador. Na sua vez, você faz um discurso, solta pistas pelo celular e
              revela quem tirou — com festa na tela.
            </p>
          </Cartao>
          {controlesAdmin}
        </>
      ) : sessao.status === "finished" ? (
        <Cartao forte className="text-center">
          <Images className="mx-auto size-10 text-ouro" aria-hidden />
          <h2 className="mt-3 font-titulo text-2xl font-semibold">A revelação terminou</h2>
          <p className="mx-auto mt-2 max-w-md text-suave">Que noite! Agora mande suas fotos e recados para o álbum de memórias.</p>
          <BotaoLink href={`/grupo/${eventoId}/album`} className="mt-4" brilho>
            Abrir o álbum
          </BotaoLink>
        </Cartao>
      ) : (
        <>
          {minhaVez ? (
            <motion.section
              initial={menosMovimento ? false : { scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="vidro-forte relative overflow-hidden rounded-cartao p-5 ring-4 ring-[color-mix(in_oklab,var(--ouro)_55%,transparent)] sm:p-6"
              aria-labelledby="sua-vez"
            >
              <div className="fita-ouro absolute inset-x-0 top-0 h-1" aria-hidden />
              <h2 id="sua-vez" className="font-titulo text-3xl font-semibold text-t1">
                Sua vez!
              </h2>
              <p className="mt-1 text-sm text-suave">
                {relogio.rodando ? `Discurso: ${mmss(relogio.restantes)}` : "Faça o seu discurso. Quando quiser, solte pistas e revele."}
              </p>
              {jaRevelei ? (
                <div className="mt-4">
                  <p className="mb-3 text-sm font-semibold">Você revelou! Olhe para o telão.</p>
                  <ParRevelado de={mapa.get(euId) ?? { nome: "Você", avatar: null }} para={mapa.get(jaRevelei.receiver_id) ?? { nome: "?", avatar: null }} />
                </div>
              ) : (
                <>
                  <form
                    className="mt-4 flex items-end gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!pista.trim()) return;
                      executar(() => enviarPistaAoVivo(eventoId, pista), () => setPista(""));
                    }}
                  >
                    <Campo
                      wrapperClassName="flex-1"
                      rotulo="Mandar uma pista para o telão"
                      placeholder="Ex.: Adora café e viagens"
                      value={pista}
                      maxLength={200}
                      onChange={(e) => setPista(e.target.value)}
                      dica={`${minhasPistas.length}/10 pistas`}
                    />
                    <Botao type="submit" disabled={!pista.trim() || pendente || minhasPistas.length >= 10} aria-label="Enviar pista" className="mb-6 shrink-0">
                      <Send className="size-4" aria-hidden />
                    </Botao>
                  </form>
                  {minhasPistas.length ? (
                    <ul className="mb-4 flex flex-wrap gap-2">
                      {minhasPistas.map((p) => (
                        <li key={p.id} className="vidro rounded-full px-3 py-1 text-sm">
                          {p.body}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Botao variante="ouro" tamanho="g" brilho className="w-full" onClick={() => setConfirmar(true)} disabled={pendente}>
                    <Sparkles className="size-5" aria-hidden /> Revelar quem eu tirei
                  </Botao>
                </>
              )}
            </motion.section>
          ) : (
            <Cartao forte>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-suave">Na vez agora</p>
              {atual ? (
                <div className="mt-3 flex items-center gap-4">
                  <Avatar nome={atual.nome} caminho={atual.avatar} tamanho={64} anel />
                  <div className="min-w-0">
                    <p className="font-titulo text-2xl font-semibold">{atual.nome}</p>
                    <p className="text-sm text-suave">
                      {revelacaoAtual ? `Revelou: tirou ${mapa.get(revelacaoAtual.receiver_id)?.nome ?? "?"}!` : relogio.rodando ? `Discurso: ${mmss(relogio.restantes)}` : "Preparando a revelação…"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 font-titulo text-xl font-semibold">Todos já apresentaram — o grande final vem aí!</p>
              )}
              {jaRevelei ? (
                <p className="mt-4 text-sm text-suave">
                  Você já revelou: <strong className="text-texto">{mapa.get(jaRevelei.receiver_id)?.nome}</strong>.
                </p>
              ) : (
                <p className="mt-4 text-sm text-suave">Fique de olho: quando for a sua vez, este aparelho avisa.</p>
              )}
            </Cartao>
          )}

          {controlesAdmin}
        </>
      )}

      {sessao?.status !== "finished" ? (
        <Cartao>
          <Interruptor
            rotulo="Autorizo o organizador a revelar por mim no telão"
            descricao="Útil se você estiver sem celular na hora. Sem essa autorização, só você revela o seu par."
            marcado={autorizo}
            desabilitado={pendente || !!jaRevelei}
            aoMudar={(v) => executar(() => autorizarRevelacaoPublica(eventoId, v))}
          />
        </Cartao>
      ) : null}

      {estado.revelacoes.length ? (
        <Cartao>
          <h3 className="mb-3 font-titulo text-lg font-semibold">Revelações</h3>
          <ol className="flex flex-col gap-3" aria-live="polite">
            <AnimatePresence initial={false}>
              {[...estado.revelacoes].reverse().map((r) => (
                <motion.li
                  key={r.id}
                  initial={menosMovimento ? false : { opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="vidro rounded-2xl p-3"
                >
                  <ParRevelado de={mapa.get(r.giver_id) ?? { nome: "?", avatar: null }} para={mapa.get(r.receiver_id) ?? { nome: "?", avatar: null }} tamanho={44} />
                  <p className="mt-2 text-center text-xs text-suave">
                    {r.method === "presenter" ? "Revelado pelo organizador (autorizado)" : "Revelado pela própria pessoa"} · {relativo(r.revealed_at)}
                  </p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </Cartao>
      ) : sessao?.status === "running" ? (
        <Vazio icone={<Lightbulb className="size-10" />} titulo="Nenhuma revelação ainda" texto="As revelações aparecem aqui assim que acontecem." />
      ) : null}

      {sessao?.status === "running" ? (
        <p className="text-center text-xs text-suave">
          Participantes: {pessoas.length} · Revelaram: {estado.revelacoes.length}
          {admin ? (
            <>
              {" · "}
              <Link href={`/telao/${eventoId}`} className="font-semibold text-t1 underline-offset-4 hover:underline">
                telão
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <Dialogo
        aberto={confirmar}
        aoFechar={() => setConfirmar(false)}
        titulo="Revelar agora?"
        descricao="Todo mundo vai ver no telão quem você tirou. Não dá para desfazer."
      >
        {meuAmigo ? (
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-black/5 p-3 dark:bg-white/5">
            <Avatar nome={meuAmigo.nome} caminho={meuAmigo.avatar} tamanho={48} />
            <p className="text-sm">
              Você tirou <strong>{meuAmigo.nome}</strong>.
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={() => setConfirmar(false)}>
            Ainda não
          </Botao>
          <Botao
            variante="ouro"
            carregando={pendente}
            onClick={() =>
              executar(
                () => revelarMeuAmigo(eventoId),
                () => {
                  setConfirmar(false);
                  confete.current?.disparar({ quantidade: 200 });
                  tocar("festa", som);
                  vibrar([40, 30, 40, 30, 120], vibracao);
                },
              )
            }
          >
            <Sparkles className="size-4" aria-hidden /> Revelar
          </Botao>
        </div>
      </Dialogo>

      <Dialogo aberto={confirmarFim} aoFechar={() => setConfirmarFim(false)} titulo="Encerrar a revelação?" descricao="O amigo oculto é encerrado e o álbum abre para todos.">
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={() => setConfirmarFim(false)}>
            Ainda não
          </Botao>
          <Botao variante="perigo" carregando={pendente} onClick={() => executar(() => encerrarAoVivo(eventoId), () => setConfirmarFim(false))}>
            Encerrar
          </Botao>
        </div>
      </Dialogo>
    </div>
  );
}
