"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Ban, LockKeyhole, ShieldCheck, Unlock, VenetianMask } from "lucide-react";
import {
  bloquearAmigoOculto,
  carregarConversas,
  denunciarMensagemAnonima,
  enviarMensagemAnonima,
  marcarConversaLida,
} from "@/lib/acoes/mensagens";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { DialogoDenuncia } from "@/components/sala/denuncia";
import { IndicadorAoVivo, useTempoReal } from "@/components/sala/ao-vivo";
import { Conversa } from "@/components/mensagens/conversa";
import { naoLidas, type Conversas, type LadoConversa, type MensagemAnonima } from "@/components/mensagens/tipos";
import { cn } from "@/lib/cn";

type Disponivel = Extract<Conversas, { disponivel: true }>;

function MascaraAvatar({ tamanho = 40 }: { tamanho?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#2a2f3a,#0f1218)] text-ouro-claro ring-2 ring-ouro/50"
      style={{ width: tamanho, height: tamanho }}
    >
      <VenetianMask className="size-[55%]" />
    </span>
  );
}

/**
 * As duas conversas anônimas do grupo. Não há tempo real em secret_messages (de propósito): a tela escuta as
 * NOTIFICAÇÕES da própria pessoa e, quando chega uma de mensagem anônima deste grupo, relê as conversas pelo servidor.
 */
export function CaixaAnonima({
  eventoId,
  usuarioId,
  inicial,
  abaInicial,
}: {
  eventoId: string;
  usuarioId: string;
  inicial: Disponivel;
  abaInicial: LadoConversa;
}) {
  const [conversas, setConversas] = useState<Disponivel>(inicial);
  const [aba, setAba] = useState<LadoConversa>(abaInicial);
  const [desktop, setDesktop] = useState(false);
  const [denunciar, setDenunciar] = useState<MensagemAnonima | null>(null);
  const [confirmarBloqueio, setConfirmarBloqueio] = useState(false);
  const [anuncio, setAnuncio] = useState("");
  const [bloqueando, iniciar] = useTransition();
  const marcando = useRef(new Set<LadoConversa>());
  const { avisar } = useAvisos();

  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    setDesktop(m.matches);
    const f = () => setDesktop(m.matches);
    m.addEventListener("change", f);
    return () => m.removeEventListener("change", f);
  }, []);

  const aplicar = useCallback((c: Conversas | undefined) => {
    if (c && c.disponivel) setConversas(c);
  }, []);

  const recarregar = useCallback(async () => {
    const r = await carregarConversas(eventoId);
    if (r.ok) aplicar(r.dados);
  }, [eventoId, aplicar]);

  const estado = useTempoReal(
    `anonimas:${eventoId}`,
    [{ tabela: "notifications", evento: "INSERT", filtro: `user_id=eq.${usuarioId}` }],
    (mud) => {
      if (mud.nova.kind !== "secret_message" || mud.nova.event_id !== eventoId) return;
      setAnuncio(String(mud.nova.title ?? "Nova mensagem anônima"));
      void recarregar();
    },
  );

  const estadoAnterior = useRef(estado);
  useEffect(() => {
    if (estadoAnterior.current === "caiu" && estado === "ao-vivo") void recarregar();
    estadoAnterior.current = estado;
  }, [estado, recarregar]);

  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    return () => document.removeEventListener("visibilitychange", aoVoltar);
  }, [recarregar]);

  // marca como lida a conversa que está à vista (as duas no PC)
  const pendentesReceiver = naoLidas(conversas.paraQuemTirei.mensagens);
  const pendentesSanta = naoLidas(conversas.deQuemMeTirou?.mensagens);
  useEffect(() => {
    const visiveis: LadoConversa[] = desktop ? ["receiver", "santa"] : [aba];
    for (const lado of visiveis) {
      const n = lado === "receiver" ? pendentesReceiver : pendentesSanta;
      if (!n || marcando.current.has(lado)) continue;
      marcando.current.add(lado);
      void marcarConversaLida(eventoId, lado).then((r) => {
        marcando.current.delete(lado);
        if (!r.ok) return;
        const agora = new Date().toISOString();
        setConversas((c) => {
          const lerTudo = (l: MensagemAnonima[]) => l.map((m) => (!m.minha && !m.lidaEm ? { ...m, lidaEm: agora } : m));
          return lado === "receiver"
            ? { ...c, paraQuemTirei: { ...c.paraQuemTirei, mensagens: lerTudo(c.paraQuemTirei.mensagens) } }
            : c.deQuemMeTirou
              ? { ...c, deQuemMeTirou: { ...c.deQuemMeTirou, mensagens: lerTudo(c.deQuemMeTirou.mensagens) } }
              : c;
        });
      });
    }
  }, [aba, desktop, eventoId, pendentesReceiver, pendentesSanta]);

  const nome = conversas.paraQuemTirei.nome;
  const primeiroNome = nome.split(" ")[0];
  const santa = conversas.deQuemMeTirou;

  const abas: { lado: LadoConversa; rotulo: string; n: number }[] = [
    { lado: "receiver", rotulo: "Para quem eu tirei", n: pendentesReceiver },
    { lado: "santa", rotulo: "De quem me tirou", n: pendentesSanta },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="vidro flex items-start gap-3 rounded-cartao px-4 py-3.5 sm:px-5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-esmeralda" aria-hidden />
        <p className="text-sm leading-relaxed">
          <strong>Ninguém — nem o organizador — sabe quem é você.</strong> Para quem você tirou, suas mensagens chegam como “seu amigo
          oculto”, inclusive nas notificações. Se alguém denunciar, o organizador vê só o texto, nunca o remetente.
        </p>
      </div>

      <div role="tablist" aria-label="Conversas" className="vidro grid grid-cols-2 gap-1 rounded-full p-1 lg:hidden">
        {abas.map((a) => (
          <button
            key={a.lado}
            id={`aba-${a.lado}`}
            type="button"
            role="tab"
            aria-selected={aba === a.lado}
            aria-controls={`painel-${a.lado}`}
            onClick={() => setAba(a.lado)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-sm font-semibold transition",
              aba === a.lado ? "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white shadow" : "text-suave",
            )}
          >
            {a.rotulo}
            {a.n ? (
              <span className={cn("rounded-full px-1.5 text-xs font-bold leading-5", aba === a.lado ? "bg-white text-t1" : "bg-rubi text-white")}>
                {a.n}
                <span className="sr-only"> não lida{a.n === 1 ? "" : "s"}</span>
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {anuncio}
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* ------------------------------------------- eu tirei essa pessoa: eu sou anônimo */}
        <section
          id="painel-receiver"
          role="tabpanel"
          aria-labelledby="aba-receiver"
          aria-label={desktop ? "Para quem eu tirei" : undefined}
          className={cn("vidro-forte flex-col overflow-hidden rounded-cartao", aba === "receiver" ? "flex" : "hidden lg:flex")}
        >
          <Conversa
            id="receiver"
            nomeOutro={nome}
            cabecalho={
              <>
                <Avatar nome={nome} tamanho={40} />
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-titulo text-lg font-semibold leading-tight">{nome}</h2>
                  <p className="flex items-center gap-1 text-xs text-suave">
                    <LockKeyhole className="size-3" aria-hidden /> Você tirou essa pessoa. Para ela, você é anônimo.
                  </p>
                </div>
                <IndicadorAoVivo estado={estado} className="hidden sm:inline-flex" />
              </>
            }
            mensagens={conversas.paraQuemTirei.mensagens}
            vazio={
              <>
                Puxe conversa! Pergunte o tamanho, a cor preferida ou o que {primeiroNome} mais quer — {primeiroNome} não vai saber que é
                você.
              </>
            }
            bloqueio={conversas.paraQuemTirei.bloqueada ? `${primeiroNome} não está recebendo mensagens anônimas no momento.` : null}
            comTipos
            rotuloCampo={`Mensagem anônima para ${nome}`}
            placeholder={`Escreva para ${primeiroNome}…`}
            dica="Cuidado para não se entregar nas pistas."
            aoEnviar={async (tipo, texto) => {
              const r = await enviarMensagemAnonima(eventoId, "receiver", tipo, texto);
              if (r.ok) {
                aplicar(r.dados);
                avisar(r.mensagem ?? "Mensagem enviada em segredo.");
              }
              return r;
            }}
            aoDenunciar={setDenunciar}
          />
        </section>

        {/* ------------------------------------------- essa pessoa me tirou: anônima para mim */}
        <section
          id="painel-santa"
          role="tabpanel"
          aria-labelledby="aba-santa"
          aria-label={desktop ? "De quem me tirou" : undefined}
          className={cn("vidro-forte flex-col overflow-hidden rounded-cartao", aba === "santa" ? "flex" : "hidden lg:flex")}
        >
          {santa ? (
            <Conversa
              id="santa"
              nomeOutro="Seu amigo oculto"
              cabecalho={
                <>
                  <MascaraAvatar />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-titulo text-lg font-semibold leading-tight">Seu amigo oculto</h2>
                    <p className="text-xs text-suave">Quem te tirou. A identidade só aparece na revelação.</p>
                  </div>
                  {santa.bloqueada ? (
                    <Botao
                      tamanho="p"
                      variante="contorno"
                      carregando={bloqueando}
                      onClick={() =>
                        iniciar(async () => {
                          const r = await bloquearAmigoOculto(eventoId, false);
                          if (r.ok) aplicar(r.dados);
                          avisar(r.ok ? (r.mensagem ?? "Desbloqueado.") : r.erro, r.ok ? "ok" : "erro");
                        })
                      }
                    >
                      <Unlock className="size-4" aria-hidden /> Desbloquear
                    </Botao>
                  ) : (
                    <Botao tamanho="p" variante="fantasma" onClick={() => setConfirmarBloqueio(true)} className="text-suave">
                      <Ban className="size-4" aria-hidden /> Bloquear
                    </Botao>
                  )}
                </>
              }
              mensagens={santa.mensagens}
              vazio="Seu amigo oculto ainda não mandou nada. Quando mandar, aparece aqui — e você recebe uma notificação."
              bloqueio={
                santa.bloqueada
                  ? "Você bloqueou as mensagens do seu amigo oculto. Desbloqueie para voltar a conversar."
                  : null
              }
              comTipos={false}
              rotuloCampo="Resposta para o seu amigo oculto"
              placeholder="Responder ao seu amigo oculto…"
              dica="Sua resposta chega só para quem te tirou."
              aoEnviar={async (tipo, texto) => {
                const r = await enviarMensagemAnonima(eventoId, "santa", tipo, texto);
                if (r.ok) {
                  aplicar(r.dados);
                  avisar("Resposta enviada.");
                }
                return r;
              }}
              aoDenunciar={setDenunciar}
            />
          ) : (
            <div className="m-auto max-w-sm px-6 py-12 text-center text-sm text-suave">
              <MascaraAvatar tamanho={56} />
              <p className="mt-3">Ninguém tirou você neste sorteio, então esta conversa não existe.</p>
            </div>
          )}
        </section>
      </div>

      <Dialogo
        aberto={confirmarBloqueio}
        aoFechar={() => setConfirmarBloqueio(false)}
        titulo="Bloquear as mensagens anônimas?"
        descricao="Seu amigo oculto não vai conseguir te mandar mensagens (e você não responde enquanto estiver bloqueado). Dá para desbloquear quando quiser. Se alguma mensagem foi ofensiva, denuncie também: o organizador pode agir sem saber quem é."
      >
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setConfirmarBloqueio(false)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            carregando={bloqueando}
            onClick={() =>
              iniciar(async () => {
                const r = await bloquearAmigoOculto(eventoId, true);
                setConfirmarBloqueio(false);
                if (r.ok) aplicar(r.dados);
                avisar(r.ok ? (r.mensagem ?? "Bloqueado.") : r.erro, r.ok ? "ok" : "erro");
              })
            }
          >
            <Ban className="size-4" aria-hidden /> Bloquear
          </Botao>
        </div>
      </Dialogo>

      <DialogoDenuncia
        aberto={!!denunciar}
        aoFechar={() => setDenunciar(null)}
        trecho={denunciar?.texto}
        explicacao="A mensagem some para você e o organizador recebe só o texto — nunca quem mandou. Ele pode silenciar o remetente sem saber quem é."
        aoConfirmar={async (motivo) => {
          const r = await denunciarMensagemAnonima(eventoId, denunciar!.id, motivo);
          if (r.ok) aplicar(r.dados);
          return r;
        }}
      />
    </div>
  );
}
