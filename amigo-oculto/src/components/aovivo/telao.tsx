"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Gift,
  Keyboard,
  Lightbulb,
  Link2,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  Shuffle,
  SkipForward,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wand2,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { Selo } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Logo } from "@/components/ui/logo";
import { useAvisos } from "@/components/ui/avisos";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { EnfeitesTema } from "@/components/grupo/enfeites";
import {
  ajustarSegundosAoVivo,
  encerrarAoVivo,
  iniciarAoVivo,
  proximoAoVivo,
  revelarMeuAmigo,
  revelarPorParticipante,
  temporizadorAoVivo,
} from "@/lib/acoes/aovivo";
import { cn } from "@/lib/cn";
import { IndicadorAoVivo } from "@/components/sala/ao-vivo";
import { temporizador, useAgora, useAoVivo, type EstadoAoVivo, type PessoaAoVivo, type Revelacao } from "@/components/aovivo/estado";
import { ParRevelado, RelogioDiscurso } from "@/components/aovivo/partes";
import { Encerramento } from "@/components/aovivo/encerramento";

type Evento = { nome: string; tema: string; status: "open" | "drawn" | "finished" };

export function Telao({
  eventoId,
  euId,
  evento,
  pessoas,
  inicial,
}: {
  eventoId: string;
  euId: string;
  evento: Evento;
  pessoas: PessoaAoVivo[];
  inicial: EstadoAoVivo;
}) {
  const prefs = usePreferencias();
  const [som, setSom] = useState(prefs.som);
  const somRef = useRef(som);
  useEffect(() => {
    somRef.current = som;
  }, [som]);
  const [celebracao, setCelebracao] = useState<Revelacao | null>(null);
  const [sorteando, setSorteando] = useState(false);
  const [confirmarPular, setConfirmarPular] = useState(false);
  const [confirmarFim, setConfirmarFim] = useState(false);
  const [confirmarMeu, setConfirmarMeu] = useState(false);
  const [telaCheia, setTelaCheia] = useState(false);
  const [pendente, iniciar] = useTransition();
  const confete = useRef<ConfeteHandle>(null);
  const { avisar } = useAvisos();
  const mapa = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);

  const { estado, recarregar, conexao } = useAoVivo(eventoId, inicial, {
    aoRevelar: (r) => setCelebracao(r),
    aoPista: () => tocar("tique", somRef.current),
  });
  const sessao = estado.sessao;
  const agora = useAgora(250);
  const relogio = temporizador(sessao, agora);

  // comemoração: suspense, revelação, festa
  useEffect(() => {
    if (!celebracao) return;
    const t: ReturnType<typeof setTimeout>[] = [];
    tocar("abrir", somRef.current);
    t.push(
      setTimeout(() => {
        tocar("revelar", somRef.current);
        confete.current?.disparar({ quantidade: 220, origemY: 0.4 });
      }, 1500),
    );
    t.push(
      setTimeout(() => {
        tocar("festa", somRef.current);
        confete.current?.disparar({ quantidade: 140, origemX: 0.15, origemY: 0.7 });
        confete.current?.disparar({ quantidade: 140, origemX: 0.85, origemY: 0.7 });
      }, 2300),
    );
    return () => t.forEach(clearTimeout);
  }, [celebracao]);

  // fim do tempo do discurso: um sino
  const anterior = useRef(relogio.restantes);
  useEffect(() => {
    if (anterior.current > 0 && relogio.restantes === 0 && sessao?.timer_ends_at) tocar("sino", somRef.current);
    anterior.current = relogio.restantes;
  }, [relogio.restantes, sessao?.timer_ends_at]);

  useEffect(() => {
    const f = () => setTelaCheia(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", f);
    return () => document.removeEventListener("fullscreenchange", f);
  }, []);

  const alternarTelaCheia = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => avisar("Este navegador não deixou entrar em tela cheia.", "erro"));
  }, [avisar]);

  const atual = sessao?.current_id ? mapa.get(sessao.current_id) ?? null : null;
  const revelacaoAtual = sessao?.current_id ? estado.revelacoes.find((r) => r.giver_id === sessao.current_id) ?? null : null;
  const autorizado = atual ? (estado.autoriza[atual.id] ?? atual.autorizaRevelar) : false;
  const pistasAtuais = atual ? estado.pistas.filter((p) => p.participant_id === atual.id) : [];

  const executar = useCallback(
    (fn: () => Promise<{ ok: boolean; erro?: string }>, depois?: () => void) => {
      iniciar(async () => {
        const r = await fn();
        if (!r.ok) avisar(r.erro ?? "Algo deu errado.", "erro");
        else depois?.();
        await recarregar();
      });
    },
    [avisar, recarregar],
  );

  const proximo = useCallback(
    (forcar = false) => {
      if (!sessao || sessao.status !== "running" || pendente) return;
      if (sessao.current_id && !revelacaoAtual && !forcar) {
        setConfirmarPular(true);
        return;
      }
      setConfirmarPular(false);
      setCelebracao(null);
      executar(() => proximoAoVivo(eventoId), () => tocar("virar", somRef.current));
    },
    [sessao, pendente, revelacaoAtual, executar, eventoId],
  );

  const alternarRelogio = useCallback(() => {
    if (!sessao || sessao.status !== "running") return;
    executar(() => temporizadorAoVivo(eventoId, relogio.rodando ? "pause" : "start"));
  }, [sessao, relogio.rodando, executar, eventoId]);

  // atalhos de teclado
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      const alvo = e.target as HTMLElement | null;
      if (alvo && (alvo.closest("input, textarea, select, [contenteditable=true]") || document.querySelector("dialog[open]"))) return;
      const k = e.key.toLowerCase();
      if (e.key === " " || e.key === "ArrowRight") {
        if (alvo?.closest("button, a")) return; // espaço num botão focado aciona o botão
        e.preventDefault();
        proximo();
      } else if (k === "t") alternarRelogio();
      else if (k === "r" && sessao?.status === "running") executar(() => temporizadorAoVivo(eventoId, "reset"));
      else if (k === "f") alternarTelaCheia();
      else if (k === "s") setSom((v) => !v);
      else if (e.key === "Escape" && celebracao) setCelebracao(null);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [proximo, alternarRelogio, alternarTelaCheia, executar, eventoId, sessao?.status, celebracao]);

  const revelados = new Set(estado.revelacoes.map((r) => r.giver_id));
  const apresentados = new Set([...(sessao?.presented ?? []), ...(sessao?.current_id ? [sessao.current_id] : [])]);
  const faltam = pessoas.filter((p) => !apresentados.has(p.id));

  return (
    <div className="dark telao min-h-dvh bg-[#070d0b] text-texto">
      <div data-tema={evento.tema} className="fundo-festivo relative flex min-h-dvh flex-col">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-48 opacity-60">
          <EnfeitesTema tema={evento.tema} />
        </div>
        <Confete ref={confete} desligado={prefs.menosMovimento} />

        <header className="nao-imprimir relative z-10 flex flex-wrap items-center gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
          <Logo tamanho={36} comTexto={false} />
          <div className="mr-auto min-w-0">
            <p className="text-[0.65em] font-semibold uppercase tracking-[0.25em] text-ouro-claro">Revelação ao vivo</p>
            <h1 className="truncate font-titulo text-[1.4em] font-semibold leading-tight">{evento.nome}</h1>
          </div>
          <IndicadorAoVivo estado={conexao} className="hidden text-[0.65em] sm:inline-flex" />
          {sessao?.status === "running" ? (
            <Selo cor="ouro" className="text-[0.7em]">
              {estado.revelacoes.length} de {pessoas.length} revelaram
            </Selo>
          ) : null}
          <button
            type="button"
            onClick={() => setSom((v) => !v)}
            aria-pressed={som}
            aria-label={som ? "Desligar som (S)" : "Ligar som (S)"}
            title={som ? "Desligar som (S)" : "Ligar som (S)"}
            className="vidro inline-flex size-11 items-center justify-center rounded-full"
          >
            {som ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={alternarTelaCheia}
            aria-label={telaCheia ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            title={telaCheia ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
            className="vidro inline-flex size-11 items-center justify-center rounded-full"
          >
            {telaCheia ? <Minimize className="size-5" aria-hidden /> : <Maximize className="size-5" aria-hidden />}
          </button>
          {sessao?.status === "running" ? (
            <Botao variante="vidro" tamanho="p" onClick={() => setConfirmarFim(true)} className="h-11">
              <Square className="size-4" aria-hidden /> Encerrar
            </Botao>
          ) : null}
          <Link
            href={`/grupo/${eventoId}/ao-vivo/participar`}
            className="vidro inline-flex size-11 items-center justify-center rounded-full"
            aria-label="Sair do telão"
            title="Sair do telão"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
        </header>

        <main className="relative z-10 flex flex-1 flex-col px-4 pb-6 pt-4 sm:px-8">
          {!sessao ? (
            evento.status === "drawn" ? (
              <Configurar
                pessoas={pessoas}
                pendente={pendente}
                aoIniciar={(modo, segundos) =>
                  executar(
                    () => iniciarAoVivo(eventoId, modo, segundos),
                    () => {
                      tocar("abrir", somRef.current);
                      setSorteando(true);
                    },
                  )
                }
              />
            ) : (
              <Aviso
                titulo={evento.status === "open" ? "O sorteio ainda não foi feito" : "Este amigo oculto já terminou"}
                texto={
                  evento.status === "open"
                    ? "A revelação ao vivo fica disponível depois do sorteio."
                    : "Ele foi encerrado sem a revelação ao vivo. As memórias estão no álbum."
                }
                acao={
                  <BotaoLink href={`/grupo/${eventoId}${evento.status === "open" ? "" : "/album"}`} variante="ouro" tamanho="g">
                    {evento.status === "open" ? "Voltar ao grupo" : "Abrir o álbum"}
                  </BotaoLink>
                }
              />
            )
          ) : sessao.status === "finished" ? (
            <Encerramento eventoId={eventoId} nomeEvento={evento.nome} pessoas={pessoas} revelacoes={estado.revelacoes} som={som} confete={confete} />
          ) : (
            <div className="grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22em)]">
              <section aria-labelledby="na-vez" className="vidro-forte relative flex flex-col items-center justify-center gap-5 overflow-hidden rounded-[2rem] px-4 py-8 text-center sm:px-8">
                {atual ? (
                  <>
                    <p id="na-vez" className="text-[0.75em] font-semibold uppercase tracking-[0.3em] text-ouro-claro">
                      {revelacaoAtual ? "Revelou!" : "Agora é a vez de"}
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={atual.id}
                        initial={prefs.menosMovimento ? false : { opacity: 0, scale: 0.8, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={prefs.menosMovimento ? undefined : { opacity: 0, scale: 0.9, y: -20 }}
                        transition={{ type: "spring", stiffness: 140, damping: 16 }}
                        className="flex flex-col items-center gap-4"
                      >
                        <div className="relative">
                          <div aria-hidden className="absolute -inset-4 animate-pulse rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--ouro)_45%,transparent),transparent_70%)]" />
                          <AvatarGrande nome={atual.nome} avatar={atual.avatar} className="relative size-[6.5em] sm:size-[7.5em]" anel />
                        </div>
                        <h2 className="font-titulo text-[3em] font-semibold leading-none">{atual.nome}</h2>
                      </motion.div>
                    </AnimatePresence>
                    {revelacaoAtual ? (
                      <div className="w-full max-w-md text-[1em]">
                        <ParRevelado
                          de={atual}
                          para={mapa.get(revelacaoAtual.receiver_id) ?? { nome: "?", avatar: null }}
                          tamanho={88}
                        />
                      </div>
                    ) : (
                      <p className="max-w-xl text-[0.9em] text-suave">
                        Discurso, pistas e suspense… A revelação sai pelo celular de {atual.nome.split(" ")[0]}
                        {autorizado ? " — ou pelo telão, com a autorização dele(a)." : "."}
                      </p>
                    )}

                    <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-6">
                      <RelogioDiscurso restantes={relogio.restantes} total={relogio.total} rodando={relogio.rodando} tamanho={150} />
                      <div className="flex flex-wrap justify-center gap-2 sm:flex-col">
                        <Botao variante="vidro" onClick={alternarRelogio} disabled={pendente} aria-keyshortcuts="T">
                          {relogio.rodando ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
                          {relogio.rodando ? "Pausar" : relogio.pausado ? "Continuar" : "Iniciar discurso"}
                        </Botao>
                        <Botao variante="fantasma" onClick={() => executar(() => temporizadorAoVivo(eventoId, "reset"))} disabled={pendente} aria-keyshortcuts="R">
                          <RotateCcw className="size-4" aria-hidden /> Zerar
                        </Botao>
                        <div className="flex items-center justify-center gap-1 text-[0.75em] text-suave">
                          <button
                            type="button"
                            className="vidro inline-flex size-9 items-center justify-center rounded-full font-bold"
                            onClick={() => executar(() => ajustarSegundosAoVivo(eventoId, Math.max(10, relogio.total - 15)))}
                            aria-label="Diminuir 15 segundos do discurso"
                          >
                            −
                          </button>
                          <span className="min-w-14 text-center tabular-nums">{relogio.total} s</span>
                          <button
                            type="button"
                            className="vidro inline-flex size-9 items-center justify-center rounded-full font-bold"
                            onClick={() => executar(() => ajustarSegundosAoVivo(eventoId, Math.min(600, relogio.total + 15)))}
                            aria-label="Aumentar 15 segundos do discurso"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {pistasAtuais.length ? (
                      <div className="w-full max-w-2xl" aria-live="polite">
                        <p className="mb-2 flex items-center justify-center gap-2 text-[0.7em] font-semibold uppercase tracking-[0.25em] text-ouro-claro">
                          <Lightbulb className="size-4" aria-hidden /> Pistas
                        </p>
                        <ul className="flex flex-wrap justify-center gap-2">
                          <AnimatePresence>
                            {pistasAtuais.map((p) => (
                              <motion.li
                                key={p.id}
                                initial={prefs.menosMovimento ? false : { opacity: 0, scale: 0.6, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className="vidro rounded-2xl px-4 py-2 text-[1em] font-semibold"
                              >
                                {p.body}
                              </motion.li>
                            ))}
                          </AnimatePresence>
                        </ul>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap justify-center gap-3">
                      {!revelacaoAtual && atual.id === euId ? (
                        <Botao variante="ouro" tamanho="g" brilho disabled={pendente} onClick={() => setConfirmarMeu(true)}>
                          <Wand2 className="size-5" aria-hidden /> Revelar o meu par
                        </Botao>
                      ) : !revelacaoAtual ? (
                        <Botao
                          variante="ouro"
                          tamanho="g"
                          disabled={!autorizado || pendente}
                          onClick={() => executar(() => revelarPorParticipante(eventoId, atual.id))}
                          title={autorizado ? "Revelar pelo telão" : `${atual.nome} não autorizou: a revelação é pelo celular dele(a)`}
                        >
                          <Wand2 className="size-5" aria-hidden /> Revelar por {atual.nome.split(" ")[0]}
                        </Botao>
                      ) : null}
                      <Botao tamanho="g" brilho={!!revelacaoAtual} onClick={() => proximo()} carregando={pendente} aria-keyshortcuts="Space">
                        <SkipForward className="size-5" aria-hidden /> Próximo
                      </Botao>
                    </div>
                    {!revelacaoAtual && !autorizado && atual.id !== euId ? (
                      <p className="text-[0.7em] text-suave">
                        {atual.nome.split(" ")[0]} não autorizou o organizador a revelar: a revelação é pelo celular.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <Sparkles className="size-16 text-ouro" aria-hidden />
                    <h2 id="na-vez" className="font-titulo text-[2.4em] font-semibold">Todos já apresentaram!</h2>
                    <p className="max-w-lg text-suave">Hora do grande final. Encerre para ver o resumo da noite.</p>
                    <Botao variante="ouro" tamanho="g" brilho onClick={() => setConfirmarFim(true)}>
                      <Sparkles className="size-5" aria-hidden /> Grande final
                    </Botao>
                  </div>
                )}
              </section>

              <aside className="flex flex-col gap-4" aria-label="Registro da revelação">
                <div className="vidro-forte rounded-[1.5rem] p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-titulo text-[1.2em] font-semibold">Registro</h2>
                    <span className="text-[0.75em] text-suave">
                      {sessao.mode === "chain" ? (
                        <>
                          <Link2 className="mr-1 inline size-4" aria-hidden />
                          Corrente
                        </>
                      ) : (
                        <>
                          <Shuffle className="mr-1 inline size-4" aria-hidden />
                          Aleatória
                        </>
                      )}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={pessoas.length} aria-valuenow={estado.revelacoes.length} aria-label="Revelações feitas">
                    <motion.div
                      className="h-full rounded-full bg-[linear-gradient(90deg,var(--ouro),var(--ouro-claro))]"
                      animate={{ width: `${pessoas.length ? (estado.revelacoes.length / pessoas.length) * 100 : 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[0.75em] text-suave">
                    {estado.revelacoes.length} revelaram · {faltam.length} faltam
                  </p>
                  {estado.revelacoes.length ? (
                    <ol className="mt-4 flex flex-col gap-3" aria-live="polite">
                      {[...estado.revelacoes].reverse().map((r) => {
                        const de = mapa.get(r.giver_id);
                        const para = mapa.get(r.receiver_id);
                        return (
                          <li key={r.id} className="vidro rounded-2xl p-3">
                            <ParRevelado de={de ?? { nome: "?", avatar: null }} para={para ?? { nome: "?", avatar: null }} tamanho={40} />
                          </li>
                        );
                      })}
                    </ol>
                  ) : (
                    <p className="mt-4 text-[0.8em] text-suave">As revelações aparecem aqui, em ordem.</p>
                  )}
                </div>
                {faltam.length ? (
                  <div className="vidro rounded-[1.5rem] p-5">
                    <h2 className="font-titulo text-[1.05em] font-semibold">Ainda vão apresentar</h2>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {faltam.map((p) => (
                        <li key={p.id} title={p.nome}>
                          <Avatar nome={p.nome} caminho={p.avatar} tamanho={40} />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="nao-imprimir hidden items-center gap-2 text-[0.65em] text-suave lg:flex">
                  <Keyboard className="size-4 shrink-0" aria-hidden />
                  Espaço: próximo · T: discurso · R: zerar · F: tela cheia · S: som
                </p>
              </aside>
            </div>
          )}
        </main>

        <AnimatePresence>
          {celebracao && sessao?.status === "running" ? (
            <Comemoracao
              key={celebracao.id}
              de={mapa.get(celebracao.giver_id) ?? { nome: "?", avatar: null }}
              para={mapa.get(celebracao.receiver_id) ?? { nome: "?", avatar: null }}
              corrente={sessao.mode === "chain"}
              menosMovimento={prefs.menosMovimento}
              aoFechar={() => setCelebracao(null)}
              aoProximo={() => proximo(true)}
            />
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {sorteando && sessao?.current_id ? (
            <SorteioInicial
              pessoas={pessoas}
              escolhido={sessao.current_id}
              menosMovimento={prefs.menosMovimento}
              som={som}
              aoTerminar={() => setSorteando(false)}
            />
          ) : null}
        </AnimatePresence>

        <Dialogo
          aberto={confirmarPular}
          aoFechar={() => setConfirmarPular(false)}
          titulo={`Passar a vez de ${atual?.nome ?? ""}?`}
          descricao="Essa pessoa ainda não revelou. Ela não volta para a fila."
          className="text-base"
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="contorno" onClick={() => setConfirmarPular(false)}>
              Esperar
            </Botao>
            <Botao autoFocus onClick={() => proximo(true)} carregando={pendente}>
              Passar a vez
            </Botao>
          </div>
        </Dialogo>

        <Dialogo
          aberto={confirmarMeu}
          aoFechar={() => setConfirmarMeu(false)}
          titulo="Revelar o seu par no telão?"
          descricao="É a sua vez: todo mundo vai ver quem você tirou."
          className="text-base"
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="contorno" onClick={() => setConfirmarMeu(false)}>
              Ainda não
            </Botao>
            <Botao variante="ouro" autoFocus carregando={pendente} onClick={() => executar(() => revelarMeuAmigo(eventoId), () => setConfirmarMeu(false))}>
              <Sparkles className="size-4" aria-hidden /> Revelar
            </Botao>
          </div>
        </Dialogo>

        <Dialogo
          aberto={confirmarFim}
          aoFechar={() => setConfirmarFim(false)}
          titulo="Encerrar a revelação?"
          descricao="O amigo oculto é encerrado, o álbum de memórias abre para todos e o telão mostra o grande final."
          className="text-base"
        >
          <div className="flex flex-wrap justify-end gap-2">
            <Botao variante="contorno" onClick={() => setConfirmarFim(false)}>
              Ainda não
            </Botao>
            <Botao
              variante="ouro"
              carregando={pendente}
              onClick={() =>
                executar(
                  () => encerrarAoVivo(eventoId),
                  () => {
                    setConfirmarFim(false);
                    setCelebracao(null);
                  },
                )
              }
            >
              <Sparkles className="size-4" aria-hidden /> Encerrar com festa
            </Botao>
          </div>
        </Dialogo>
      </div>
    </div>
  );
}

function Aviso({ titulo, texto, acao }: { titulo: string; texto: string; acao: React.ReactNode }) {
  return (
    <div className="m-auto flex max-w-xl flex-col items-center gap-4 py-16 text-center">
      <Gift className="size-16 text-ouro" aria-hidden />
      <h2 className="font-titulo text-[2em] font-semibold">{titulo}</h2>
      <p className="text-suave">{texto}</p>
      {acao}
    </div>
  );
}

const DURACOES = [30, 45, 60, 90, 120, 180, 300];

function Configurar({
  pessoas,
  pendente,
  aoIniciar,
}: {
  pessoas: PessoaAoVivo[];
  pendente: boolean;
  aoIniciar: (modo: "chain" | "random", segundos: number) => void;
}) {
  const [modo, setModo] = useState<"chain" | "random">("chain");
  const [segundos, setSegundos] = useState(60);
  const modos = [
    {
      id: "chain" as const,
      icone: Link2,
      titulo: "Corrente",
      texto: "Quem é revelado apresenta em seguida. Quem começa é sorteado agora.",
    },
    {
      id: "random" as const,
      icone: Shuffle,
      titulo: "Ordem aleatória",
      texto: "Uma fila embaralhada no início. Ninguém sabe quem vem depois.",
    },
  ];
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6 py-6">
      <div className="text-center">
        <h2 className="font-titulo text-[2.2em] font-semibold leading-tight">Preparar a revelação</h2>
        <p className="mx-auto mt-2 max-w-2xl text-[0.9em] text-suave">
          Deixe esta tela na TV ou no computador. Cada pessoa revela pelo próprio celular — o telão só mostra o par que ela mesma revelar (ou
          que ela autorizar você a revelar).
        </p>
      </div>
      <fieldset className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <legend className="sr-only">Ordem de apresentação</legend>
        {modos.map((m) => (
          <label
            key={m.id}
            className={cn(
              "vidro-forte relative flex cursor-pointer items-start gap-4 rounded-[1.5rem] p-5 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ouro/50",
              modo === m.id && "ring-2 ring-ouro",
            )}
          >
            <input type="radio" name="modo" className="sr-only" checked={modo === m.id} onChange={() => setModo(m.id)} />
            <m.icone className={cn("mt-1 size-7 shrink-0", modo === m.id ? "text-ouro" : "text-suave")} aria-hidden />
            <span>
              <span className="block font-titulo text-[1.25em] font-semibold">{m.titulo}</span>
              <span className="block text-[0.8em] text-suave">{m.texto}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="vidro flex flex-col items-center gap-3 rounded-[1.5rem] p-5 sm:flex-row sm:justify-between">
        <label htmlFor="segundos" className="font-semibold">
          Tempo de discurso de cada um
        </label>
        <select
          id="segundos"
          value={segundos}
          onChange={(e) => setSegundos(Number(e.target.value))}
          className="h-12 rounded-2xl border border-borda bg-white/5 px-4 text-[0.9em] font-semibold focus:outline-none focus:ring-4 focus:ring-ouro/30"
        >
          {DURACOES.map((d) => (
            <option key={d} value={d} className="bg-[#121b18]">
              {d < 60 ? `${d} segundos` : d === 60 ? "1 minuto" : `${d / 60} minutos`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap justify-center gap-2" aria-label={`${pessoas.length} participantes`}>
        {pessoas.map((p) => (
          <span key={p.id} title={p.nome}>
            <Avatar nome={p.nome} caminho={p.avatar} tamanho={44} />
          </span>
        ))}
      </div>
      <div className="flex justify-center">
        <Botao variante="ouro" tamanho="g" brilho onClick={() => aoIniciar(modo, segundos)} carregando={pendente} className="min-w-64 text-[1.05em]">
          <Sparkles className="size-5" aria-hidden /> Iniciar revelação
        </Botao>
      </div>
      <p className="text-center text-[0.7em] text-suave">Ao iniciar, todos recebem um aviso para abrir o modo ao vivo no celular.</p>
    </div>
  );
}

/** Avatares em roda, uma luz passando cada vez mais devagar até parar em quem começa. */
function SorteioInicial({
  pessoas,
  escolhido,
  menosMovimento,
  som,
  aoTerminar,
}: {
  pessoas: PessoaAoVivo[];
  escolhido: string;
  menosMovimento: boolean;
  som: boolean;
  aoTerminar: () => void;
}) {
  const alvo = Math.max(0, pessoas.findIndex((p) => p.id === escolhido));
  const [luz, setLuz] = useState(menosMovimento ? alvo : 0);
  const [parou, setParou] = useState(menosMovimento);
  const fim = useRef(aoTerminar);
  useEffect(() => {
    fim.current = aoTerminar;
  });

  useEffect(() => {
    const n = pessoas.length;
    const t: ReturnType<typeof setTimeout>[] = [];
    if (menosMovimento || n === 0) {
      t.push(setTimeout(() => fim.current(), 3000));
      return () => t.forEach(clearTimeout);
    }
    const passos = n * 3 + alvo;
    let acumulado = 0;
    for (let i = 1; i <= passos; i++) {
      const f = i / passos;
      acumulado += 55 + f * f * f * 420;
      t.push(
        setTimeout(() => {
          setLuz(i % n);
          tocar("tique", som);
          if (i === passos) {
            setParou(true);
            tocar("revelar", som);
          }
        }, acumulado),
      );
    }
    t.push(setTimeout(() => fim.current(), acumulado + 3200));
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const n = pessoas.length;
  const tamanho = n <= 8 ? 84 : n <= 16 ? 64 : 48;
  const escolhida = pessoas[alvo];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-6 bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal
      aria-label="Sorteando quem começa"
    >
      <p className="text-center font-titulo text-[1.8em] font-semibold text-white">{parou ? `${escolhida?.nome} começa!` : "Quem começa?"}</p>
      <div className="relative aspect-square w-[min(80vmin,34em)]">
        {pessoas.map((p, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const x = Math.round((50 + Math.cos(a) * 40) * 100) / 100;
          const y = Math.round((50 + Math.sin(a) * 40) * 100) / 100;
          const acesa = luz === i;
          return (
            <motion.div
              key={p.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${y}%` }}
              animate={{ scale: acesa ? (parou ? 1.35 : 1.18) : parou ? 0.85 : 1, opacity: parou && !acesa ? 0.35 : 1 }}
              transition={{ duration: 0.12 }}
            >
              <div className={cn("rounded-full", acesa && "shadow-[0_0_0_4px_var(--ouro-claro),0_0_40px_10px_rgb(242_207_107/0.6)]")}>
                <Avatar nome={p.nome} caminho={p.avatar} tamanho={tamanho} />
              </div>
            </motion.div>
          );
        })}
        <AnimatePresence>
          {parou && escolhida ? (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 180, damping: 14 }}
              className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
            >
              <Avatar nome={escolhida.nome} caminho={escolhida.avatar} tamanho={140} anel />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      <p className="sr-only" aria-live="assertive">
        {parou ? `${escolhida?.nome} começa a revelação.` : ""}
      </p>
      <Botao variante="vidro" onClick={aoTerminar} className="text-white">
        Continuar
      </Botao>
    </motion.div>
  );
}

/** "Fulano tirou… Beltrano!" em tela cheia, com confete e som. */
function Comemoracao({
  de,
  para,
  corrente,
  menosMovimento,
  aoFechar,
  aoProximo,
}: {
  de: { nome: string; avatar: string | null };
  para: { nome: string; avatar: string | null };
  corrente: boolean;
  menosMovimento: boolean;
  aoFechar: () => void;
  aoProximo: () => void;
}) {
  const atraso = menosMovimento ? 0 : 1.5;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center gap-8 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--t1)_55%,black),#05080a_70%)] p-6 text-center text-white"
      role="dialog"
      aria-modal
      aria-label="Revelação"
    >
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[conic-gradient(from_0deg,transparent,rgb(242_207_107/0.14),transparent_25%,rgb(242_207_107/0.1),transparent_50%,rgb(242_207_107/0.14),transparent_75%)]"
        animate={menosMovimento ? undefined : { rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      />
      <motion.p
        initial={menosMovimento ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative font-titulo text-[2.2em] font-semibold leading-tight sm:text-[2.8em]"
      >
        {de.nome} tirou…
      </motion.p>
      <div className="relative flex items-center gap-6 sm:gap-12">
        <motion.div initial={menosMovimento ? false : { x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
          <AvatarGrande nome={de.nome} avatar={de.avatar} className="size-[5.5em] sm:size-[8em]" />
        </motion.div>
        <motion.span
          initial={menosMovimento ? false : { scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: atraso * 0.6, type: "spring", stiffness: 200, damping: 12 }}
          className="inline-flex size-[3em] items-center justify-center rounded-full bg-[linear-gradient(135deg,#fff1c2,#f2cf6b,#c48c22)] text-[#3b2a06] shadow-brilho"
          aria-hidden
        >
          <Gift className="size-[1.5em]" />
        </motion.span>
        <motion.div
          initial={menosMovimento ? false : { scale: 0.2, opacity: 0, rotate: 15 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ delay: atraso, type: "spring", stiffness: 170, damping: 11 }}
        >
          <AvatarGrande nome={para.nome} avatar={para.avatar} className="size-[5.5em] sm:size-[8em]" anel />
        </motion.div>
      </div>
      <motion.p
        initial={menosMovimento ? false : { opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: atraso, type: "spring", stiffness: 160, damping: 12 }}
        className="texto-ouro relative font-titulo text-[3em] font-semibold leading-none sm:text-[4.2em]"
        aria-live="assertive"
      >
        {para.nome}!
      </motion.p>
      <motion.div
        initial={menosMovimento ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: atraso + 0.8 }}
        className="relative flex flex-col items-center gap-3"
      >
        {corrente ? <p className="text-[0.9em] text-white/80">Na corrente, {para.nome.split(" ")[0]} é a próxima pessoa a apresentar.</p> : null}
        <div className="flex flex-wrap justify-center gap-3">
          <Botao variante="ouro" tamanho="g" brilho onClick={aoProximo} autoFocus>
            <SkipForward className="size-5" aria-hidden /> Próximo
          </Botao>
          <Botao variante="vidro" tamanho="g" onClick={aoFechar} className="text-white">
            Voltar ao palco
          </Botao>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Avatar que cresce com a fonte do telão (o tamanho fica no invólucro, em `em`, e a foto preenche). */
function AvatarGrande({ nome, avatar, className, anel }: { nome: string; avatar: string | null; className?: string; anel?: boolean }) {
  return (
    <div className={cn("shrink-0", className)}>
      <Avatar nome={nome} caminho={avatar} tamanho={256} anel={anel} className="!size-full !text-[2.4em]" />
    </div>
  );
}
