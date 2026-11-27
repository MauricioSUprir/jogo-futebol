"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Grid3x3, Megaphone, PartyPopper, Play, Square, Ticket, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Cartao, Selo, Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar, vibrar } from "@/components/efeitos/som";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { chamarBingo, encerrarBingo, entrarBingo, gritarBingo, marcarBingo, novoBingo } from "@/lib/acoes/jogos";
import {
  LETRAS_BINGO,
  POSICAO_CENTRAL,
  chamadasNaoMarcadas,
  faltamParaBingo,
  linhasCompletas,
  LINHAS_BINGO,
  termoDoBingo,
} from "@/lib/bingo";
import { cn } from "@/lib/cn";

export type JogoBingo = { id: string; status: string; called: number[]; winners: string[]; created_at: string };
export type CartelaBingo = { cells: number[]; marked: number[]; bingo_at: string | null };
type PessoaMin = { id: string; nome: string; avatar: string | null };

export function Bingo({
  eventoId,
  admin,
  euId,
  pessoas,
  jogoInicial,
  cartelaInicial,
}: {
  eventoId: string;
  admin: boolean;
  euId: string;
  pessoas: PessoaMin[];
  jogoInicial: JogoBingo | null;
  cartelaInicial: CartelaBingo | null;
}) {
  const [jogo, setJogo] = useState<JogoBingo | null>(jogoInicial);
  const [cartela, setCartela] = useState<CartelaBingo | null>(cartelaInicial);
  const [ultimo, setUltimo] = useState<number | null>(jogoInicial?.called.at(-1) ?? null);
  const [pendente, iniciar] = useTransition();
  const [marcando, setMarcando] = useState<number | null>(null);
  const [confirmarFim, setConfirmarFim] = useState(false);
  const confete = useRef<ConfeteHandle>(null);
  const { avisar } = useAvisos();
  const { som, vibracao, menosMovimento } = usePreferencias();
  const nomes = useMemo(() => new Map(pessoas.map((p) => [p.id, p])), [pessoas]);
  const jogoRef = useRef(jogo);
  useEffect(() => {
    jogoRef.current = jogo;
  }, [jogo]);

  const recarregar = useCallback(async () => {
    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("bingo_games")
      .select("id, status, called, winners, created_at")
      .eq("event_id", eventoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const anterior = jogoRef.current;
    if (!data) return;
    if (!anterior || anterior.id !== data.id) {
      setCartela(null);
      const { data: c } = await supabase.from("bingo_cards").select("cells, marked, bingo_at").eq("game_id", data.id).maybeSingle();
      if (c) setCartela(c);
    }
    if (anterior && anterior.id === data.id && data.called.length > anterior.called.length) {
      const novo = data.called.at(-1)!;
      setUltimo(novo);
      tocar("abrir", som);
      vibrar(25, vibracao);
    } else if (!anterior || anterior.id !== data.id) {
      setUltimo(data.called.at(-1) ?? null);
    }
    if (anterior && anterior.id === data.id && data.winners.length > anterior.winners.length) {
      const quem = data.winners.at(-1)!;
      if (quem !== euId) {
        avisar(`BINGO! ${nomes.get(quem)?.nome ?? "Alguém"} completou uma linha.`, "info");
        tocar("festa", som);
      }
    }
    jogoRef.current = data;
    setJogo(data);
  }, [eventoId, euId, nomes, som, vibracao, avisar]);

  useEffect(() => {
    const supabase = clienteNavegador();
    const canal = supabase
      .channel(`bingo:${eventoId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bingo_games", filter: `event_id=eq.${eventoId}` }, () => {
        void recarregar();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [eventoId, recarregar]);

  const chamados = useMemo(() => jogo?.called ?? [], [jogo]);
  const completas = cartela ? linhasCompletas(cartela.cells, cartela.marked, chamados) : [];
  const casasDaLinha = new Set(completas.flatMap((i) => LINHAS_BINGO[i]));
  const faltam = cartela ? faltamParaBingo(cartela.cells, cartela.marked, chamados) : 5;
  const brilhar = new Set(cartela ? chamadasNaoMarcadas(cartela.cells, cartela.marked, chamados) : []);
  const ativo = jogo && jogo.status !== "finished";
  const ganhei = !!cartela?.bingo_at || (jogo?.winners.includes(euId) ?? false);

  function acao<T>(fn: () => Promise<{ ok: boolean; erro?: string; mensagem?: string; dados?: T }>, depois?: (d?: T) => void) {
    iniciar(async () => {
      const r = await fn();
      if (r.ok) {
        if (r.mensagem) avisar(r.mensagem);
        depois?.(r.dados);
        await recarregar();
      } else avisar(r.erro ?? "Algo deu errado.", "erro");
    });
  }

  function marcar(pos: number) {
    if (!jogo || !cartela || pos === POSICAO_CENTRAL || marcando !== null) return;
    const ja = cartela.marked.includes(pos);
    if (!ja && !chamados.includes(cartela.cells[pos])) {
      avisar(`“${termoDoBingo(cartela.cells[pos])}” ainda não foi chamado.`, "info");
      return;
    }
    setMarcando(pos);
    setCartela({ ...cartela, marked: ja ? cartela.marked.filter((m) => m !== pos) : [...cartela.marked, pos] });
    void marcarBingo(eventoId, jogo.id, pos).then((r) => {
      setMarcando(null);
      if (r.ok && r.dados) {
        setCartela((c) => (c ? { ...c, marked: r.dados!.marked } : c));
        if (!ja) {
          tocar("tique", som);
          vibrar(15, vibracao);
        }
      } else if (!r.ok) {
        setCartela((c) => (c ? { ...c, marked: cartela.marked } : c));
        avisar(r.erro, "erro");
      }
    });
  }

  function gritar() {
    if (!jogo) return;
    iniciar(async () => {
      const r = await gritarBingo(eventoId, jogo.id);
      if (r.ok && r.dados?.valeu) {
        confete.current?.disparar({ quantidade: 220 });
        setTimeout(() => confete.current?.disparar({ quantidade: 140, origemX: 0.2, origemY: 0.6 }), 350);
        setTimeout(() => confete.current?.disparar({ quantidade: 140, origemX: 0.8, origemY: 0.6 }), 650);
        tocar("festa", som);
        vibrar([60, 40, 60, 40, 120], vibracao);
        avisar("BINGO conferido! Parabéns!");
        setCartela((c) => (c ? { ...c, bingo_at: new Date().toISOString() } : c));
        await recarregar();
      } else if (r.ok) {
        tocar("erro", som);
        avisar("Ainda não: falta completar uma linha com itens já chamados.", "erro");
      } else avisar(r.erro, "erro");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Confete ref={confete} desligado={menosMovimento} />

      {admin ? (
        <Cartao className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="font-titulo text-lg font-semibold">Painel do organizador</p>
            <p className="text-sm text-suave">
              {!jogo || jogo.status === "finished"
                ? "Abra um bingo: todos recebem o aviso para pegar a cartela."
                : `Sorteie os itens um a um. ${chamados.length} de 75 chamados.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {ativo ? (
              <>
                <Botao
                  brilho
                  onClick={() => acao(() => chamarBingo(eventoId, jogo!.id), (d) => d && setUltimo(d.numero))}
                  carregando={pendente}
                  disabled={chamados.length >= 75}
                >
                  <Megaphone className="size-4" aria-hidden /> Sortear próximo
                </Botao>
                <Botao variante="contorno" onClick={() => setConfirmarFim(true)} disabled={pendente}>
                  <Square className="size-4" aria-hidden /> Encerrar
                </Botao>
              </>
            ) : (
              <Botao brilho onClick={() => acao(() => novoBingo(eventoId), () => setCartela(null))} carregando={pendente}>
                <Play className="size-4" aria-hidden /> {jogo ? "Novo bingo" : "Abrir bingo"}
              </Botao>
            )}
          </div>
        </Cartao>
      ) : null}

      {!jogo ? (
        <Vazio
          icone={<Grid3x3 className="size-10" />}
          titulo="Nenhum bingo por aqui ainda"
          texto={admin ? "Abra o primeiro bingo pelo painel acima." : "Quando o organizador abrir o bingo, você recebe um aviso para pegar a sua cartela."}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          {/* Chamada */}
          <div className="flex flex-col gap-4 lg:order-2">
            <section className="vidro-forte relative overflow-hidden rounded-cartao p-6 text-center" aria-labelledby="ultimo-item">
              <div className="fita-ouro absolute inset-x-0 top-0 h-1" aria-hidden />
              <p id="ultimo-item" className="text-xs font-semibold uppercase tracking-[0.2em] text-suave">
                {jogo.status === "finished" ? "Bingo encerrado" : ultimo === null ? "Aguardando o primeiro item" : "Último item chamado"}
              </p>
              <div className="mt-3 flex min-h-24 items-center justify-center" aria-live="assertive" aria-atomic>
                <AnimatePresence mode="popLayout">
                  {ultimo !== null ? (
                    <motion.p
                      key={`${jogo.id}-${ultimo}`}
                      initial={menosMovimento ? false : { scale: 0.3, rotate: -12, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={menosMovimento ? undefined : { scale: 0.6, opacity: 0, y: -20 }}
                      transition={{ type: "spring", stiffness: 260, damping: 16 }}
                      className="font-titulo text-4xl font-semibold leading-tight text-t1 sm:text-5xl"
                    >
                      {termoDoBingo(ultimo)}
                    </motion.p>
                  ) : (
                    <Ticket className="size-12 text-ouro" aria-hidden />
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-2 text-sm text-suave">{chamados.length} de 75 chamados</p>
            </section>

            {jogo.winners.length ? (
              <Cartao>
                <h3 className="mb-3 flex items-center gap-2 font-titulo text-lg font-semibold">
                  <Trophy className="size-5 text-ouro" aria-hidden /> Vencedores
                </h3>
                <ol className="flex flex-col gap-2">
                  {jogo.winners.map((w, i) => {
                    const p = nomes.get(w);
                    return (
                      <li key={w} className="flex items-center gap-3">
                        <span className="w-6 font-titulo font-semibold text-ouro">{i + 1}º</span>
                        <Avatar nome={p?.nome ?? "?"} caminho={p?.avatar} tamanho={32} />
                        <span className="font-semibold">{w === euId ? "Você" : (p?.nome ?? "Participante")}</span>
                      </li>
                    );
                  })}
                </ol>
              </Cartao>
            ) : null}

            <Cartao>
              <h3 className="mb-3 font-titulo text-lg font-semibold">Itens chamados</h3>
              {chamados.length ? (
                <ul className="flex flex-wrap gap-1.5">
                  {[...chamados].reverse().map((n, i) => (
                    <li
                      key={n}
                      className={cn(
                        "rounded-full px-3 py-1 text-sm font-medium",
                        i === 0 ? "bg-t1 text-white" : "bg-black/5 dark:bg-white/10",
                      )}
                    >
                      {termoDoBingo(n)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-suave">Nenhum ainda.</p>
              )}
            </Cartao>
          </div>

          {/* Cartela */}
          <div className="lg:order-1">
            {cartela ? (
              <section className="vidro-forte rounded-cartao p-3 sm:p-5" aria-labelledby="minha-cartela">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                  <h3 id="minha-cartela" className="font-titulo text-lg font-semibold">
                    Minha cartela
                  </h3>
                  {ganhei ? (
                    <Selo cor="esmeralda"><PartyPopper className="size-3.5" aria-hidden /> Você fez BINGO!</Selo>
                  ) : ativo ? (
                    <Selo cor={faltam === 1 ? "rubi" : "neutro"}>{faltam === 0 ? "Linha completa!" : `Falta${faltam === 1 ? "" : "m"} ${faltam}`}</Selo>
                  ) : null}
                </div>
                <div className="grid grid-cols-5 gap-1.5 sm:gap-2" role="group" aria-label="Cartela de bingo, 5 por 5">
                  {LETRAS_BINGO.map((l) => (
                    <div key={l} aria-hidden className="pb-1 text-center font-titulo text-2xl font-semibold text-t1">
                      {l}
                    </div>
                  ))}
                  {cartela.cells.map((n, pos) => {
                    const centro = pos === POSICAO_CENTRAL;
                    const marcada = centro || cartela.marked.includes(pos);
                    const naLinha = casasDaLinha.has(pos);
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => marcar(pos)}
                        disabled={centro || !ativo}
                        aria-pressed={marcada}
                        aria-label={`${termoDoBingo(n)}${marcada ? ", marcada" : ""}${brilhar.has(pos) ? ", já chamada" : ""}`}
                        className={cn(
                          "relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border p-1 text-center text-[11px] font-semibold leading-tight transition sm:text-sm",
                          "border-borda bg-white/60 dark:bg-white/5",
                          marcada && !centro && "border-transparent bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_65%,black))] text-white",
                          centro && "border-transparent bg-[linear-gradient(135deg,var(--ouro-claro),var(--ouro))] text-[#3b2a06]",
                          naLinha && "ring-2 ring-ouro ring-offset-1 ring-offset-transparent",
                          brilhar.has(pos) && "border-ouro shadow-[0_0_0_2px_color-mix(in_oklab,var(--ouro)_55%,transparent)]",
                          ativo && !centro && "active:scale-95",
                          marcando === pos && "animate-pulse",
                        )}
                      >
                        <span className="hyphens-auto break-words">{termoDoBingo(n)}</span>
                      </button>
                    );
                  })}
                </div>
                {ativo && !ganhei ? (
                  <Botao
                    tamanho="g"
                    variante={completas.length ? "ouro" : "contorno"}
                    brilho={completas.length > 0}
                    className="mt-4 w-full"
                    onClick={gritar}
                    disabled={!completas.length}
                    carregando={pendente}
                  >
                    BINGO!
                  </Botao>
                ) : null}
                <p className="mt-3 px-1 text-xs text-suave">
                  Toque nos itens que já foram chamados para marcar. As casas com borda dourada já saíram — é só marcar.
                </p>
              </section>
            ) : ativo ? (
              <Cartao forte className="flex flex-col items-center gap-3 py-10 text-center">
                <Ticket className="size-12 text-ouro" aria-hidden />
                <p className="font-titulo text-xl font-semibold">Pegue a sua cartela</p>
                <p className="max-w-sm text-sm text-suave">Cada cartela tem 24 itens festivos sorteados só para você, e a casa do meio é livre.</p>
                <Botao
                  tamanho="g"
                  brilho
                  onClick={() => acao(() => entrarBingo(eventoId, jogo.id), (d) => d && setCartela({ cells: d.cells, marked: d.marked, bingo_at: null }))}
                  carregando={pendente}
                >
                  Pegar cartela
                </Botao>
              </Cartao>
            ) : (
              <Vazio titulo="Bingo encerrado" texto={admin ? "Abra um novo bingo quando quiser." : "Espere o organizador abrir uma nova rodada."} />
            )}
          </div>
        </div>
      )}

      <Dialogo
        aberto={confirmarFim}
        aoFechar={() => setConfirmarFim(false)}
        titulo="Encerrar o bingo?"
        descricao="Ninguém mais marca nem grita BINGO nesta rodada."
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={() => setConfirmarFim(false)}>
            Continuar jogando
          </Botao>
          <Botao
            variante="perigo"
            carregando={pendente}
            onClick={() => acao(() => encerrarBingo(eventoId, jogo!.id), () => setConfirmarFim(false))}
          >
            Encerrar
          </Botao>
        </div>
      </Dialogo>
    </div>
  );
}
