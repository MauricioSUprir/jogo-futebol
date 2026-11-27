"use client";
import { Relativo } from "@/components/jogos/relativo";
import { relativo } from "@/lib/formatos";
import { useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Inbox, Mail, Send, UserRound, VenetianMask } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao, Selo, Vazio } from "@/components/ui/cartao";
import { AreaTexto, Campo, Selecao } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { CartaoVirtual, MODELOS, NOMES_MODELOS, type Modelo } from "@/components/jogos/cartao-virtual";
import { enviarCartao } from "@/lib/acoes/jogos";
import { cn } from "@/lib/cn";

export type CartaoRecebido = {
  id: string;
  template: string;
  title: string | null;
  body: string;
  created_at: string;
  read_at: string | null;
  anonymous: boolean;
  sender_name: string | null;
};
export type CartaoEnviado = {
  id: string;
  template: string;
  title: string | null;
  body: string;
  created_at: string;
  anonymous: boolean;
  recipient_name: string;
};

type Visto = { modelo: string; titulo: string | null; texto: string; de: string; para: string; quando: string; rotulo?: string };

export function Cartoes({
  eventoId,
  meuNome,
  pessoas,
  meuAmigo,
  recebidos,
  enviados,
  abaInicial,
}: {
  eventoId: string;
  meuNome: string;
  pessoas: { id: string; nome: string }[];
  meuAmigo: { participantId: string; nome: string } | null;
  recebidos: CartaoRecebido[];
  enviados: CartaoEnviado[];
  abaInicial?: "criar" | "recebidos" | "enviados";
}) {
  const [aba, setAba] = useState<"criar" | "recebidos" | "enviados">(abaInicial ?? (recebidos.some((c) => !c.read_at) ? "recebidos" : "criar"));
  const [visto, setVisto] = useState<Visto | null>(null);
  const novos = recebidos.filter((c) => !c.read_at).length;
  const abas = [
    { id: "criar" as const, rotulo: "Criar cartão", icone: Send, extra: null },
    { id: "recebidos" as const, rotulo: "Recebidos", icone: Inbox, extra: novos ? `${novos} novo${novos === 1 ? "" : "s"}` : recebidos.length ? String(recebidos.length) : null },
    { id: "enviados" as const, rotulo: "Enviados", icone: Mail, extra: enviados.length ? String(enviados.length) : null },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Cartões" className="rolagem-fina -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {abas.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            id={`aba-cartao-${a.id}`}
            aria-selected={aba === a.id}
            aria-controls={`painel-cartao-${a.id}`}
            onClick={() => setAba(a.id)}
            className={cn(
              "vidro inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-suave transition hover:text-texto",
              aba === a.id && "bg-[color-mix(in_oklab,var(--t1)_16%,transparent)] text-t1",
            )}
          >
            <a.icone className="size-4" aria-hidden /> {a.rotulo}
            {a.extra ? <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{a.extra}</span> : null}
          </button>
        ))}
      </div>

      {aba === "criar" ? (
        <div role="tabpanel" id="painel-cartao-criar" aria-labelledby="aba-cartao-criar">
          <CriarCartao eventoId={eventoId} meuNome={meuNome} pessoas={pessoas} meuAmigo={meuAmigo} aoEnviar={() => setAba("enviados")} />
        </div>
      ) : null}

      {aba === "recebidos" ? (
        <div role="tabpanel" id="painel-cartao-recebidos" aria-labelledby="aba-cartao-recebidos">
          {recebidos.length ? (
            <GradeCartoes
              itens={recebidos.map((c) => ({
                id: c.id,
                modelo: c.template,
                titulo: c.title,
                texto: c.body,
                de: c.anonymous ? "Seu amigo oculto" : (c.sender_name ?? "Alguém"),
                para: meuNome,
                quando: c.created_at,
                novo: !c.read_at,
                rotulo: `Cartão de ${c.anonymous ? "seu amigo oculto" : (c.sender_name ?? "alguém")}`,
              }))}
              aoAbrir={setVisto}
            />
          ) : (
            <Vazio icone={<Inbox className="size-10" />} titulo="Nenhum cartão ainda" texto="Quando alguém te mandar um cartão, ele aparece aqui." />
          )}
        </div>
      ) : null}

      {aba === "enviados" ? (
        <div role="tabpanel" id="painel-cartao-enviados" aria-labelledby="aba-cartao-enviados">
          {enviados.length ? (
            <GradeCartoes
              itens={enviados.map((c) => ({
                id: c.id,
                modelo: c.template,
                titulo: c.title,
                texto: c.body,
                de: c.anonymous ? "Seu amigo oculto" : meuNome,
                para: c.recipient_name,
                quando: c.created_at,
                secreto: c.anonymous,
              }))}
              aoAbrir={setVisto}
            />
          ) : (
            <Vazio icone={<Mail className="size-10" />} titulo="Você ainda não mandou cartões" texto="Escolha um modelo na aba “Criar cartão”." />
          )}
        </div>
      ) : null}

      <Dialogo aberto={!!visto} aoFechar={() => setVisto(null)} titulo={visto ? (visto.rotulo ?? `Cartão para ${visto.para}`) : ""} descricao={visto ? relativo(visto.quando) : undefined} largura="max-w-md">
        {visto ? (
          <motion.div initial={{ rotateY: -70, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 120, damping: 16 }} style={{ perspective: 800 }}>
            <CartaoVirtual modelo={visto.modelo} titulo={visto.titulo} texto={visto.texto} de={visto.de} para={visto.para} />
          </motion.div>
        ) : null}
      </Dialogo>
    </div>
  );
}

function GradeCartoes({
  itens,
  aoAbrir,
}: {
  itens: (Visto & { id: string; novo?: boolean; secreto?: boolean })[];
  aoAbrir: (v: Visto) => void;
}) {
  const { menosMovimento } = usePreferencias();
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {itens.map((c, i) => (
        <motion.li key={c.id} initial={menosMovimento ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: menosMovimento ? 0 : i * 0.04 }}>
          <button
            type="button"
            onClick={() => aoAbrir(c)}
            className="group flex w-full flex-col gap-2 rounded-[1.4rem] text-left transition hover:-translate-y-1"
            aria-label={`Abrir cartão de ${c.de} para ${c.para}${c.titulo ? `: ${c.titulo}` : ""}`}
          >
            <CartaoVirtual compacto modelo={c.modelo} titulo={c.titulo} texto={c.texto} de={c.de} />
            <span className="flex flex-wrap items-center gap-1.5 px-1 text-xs text-suave">
              {c.novo ? <Selo cor="rubi">Novo</Selo> : null}
              {c.secreto ? <Selo cor="ouro">Em segredo</Selo> : null}
              <span className="truncate">Para {c.para} · <Relativo iso={c.quando} /></span>
            </span>
          </button>
        </motion.li>
      ))}
    </ul>
  );
}

function CriarCartao({
  eventoId,
  meuNome,
  pessoas,
  meuAmigo,
  aoEnviar,
}: {
  eventoId: string;
  meuNome: string;
  pessoas: { id: string; nome: string }[];
  meuAmigo: { participantId: string; nome: string } | null;
  aoEnviar: () => void;
}) {
  const [modelo, setModelo] = useState<Modelo>("estrela");
  const [titulo, setTitulo] = useState("Feliz Natal!");
  const [texto, setTexto] = useState("");
  const [destino, setDestino] = useState("");
  const [secreto, setSecreto] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();
  const confete = useRef<ConfeteHandle>(null);
  const { avisar } = useAvisos();
  const { som, menosMovimento } = usePreferencias();
  const destinoReal = secreto && meuAmigo ? meuAmigo.participantId : destino;
  const nomeDestino = secreto && meuAmigo ? meuAmigo.nome : pessoas.find((p) => p.id === destino)?.nome;

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!destinoReal) {
      setErros({ destinatario: "Escolha para quem vai o cartão." });
      return;
    }
    iniciar(async () => {
      const r = await enviarCartao(eventoId, { destinatario: destinoReal, modelo, titulo, texto, anonimo: secreto });
      if (r.ok) {
        tocar("festa", som);
        confete.current?.disparar({ quantidade: 140 });
        avisar(r.mensagem ?? "Cartão enviado!");
        setTexto("");
        setErros({});
        aoEnviar();
      } else {
        setErros(r.campos ?? {});
        avisar(r.erro, "erro");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Confete ref={confete} desligado={menosMovimento} />
      <Cartao forte>
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <fieldset className="min-w-0">
            <legend className="mb-2 text-sm font-semibold">Modelo</legend>
            <div className="rolagem-fina -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-4 sm:overflow-visible">
              {MODELOS.map((m) => (
                <label key={m} className="flex w-24 shrink-0 cursor-pointer flex-col items-center gap-1.5 sm:w-auto">
                  <input type="radio" name="modelo" value={m} checked={modelo === m} onChange={() => setModelo(m)} className="peer sr-only" />
                  <span className="block w-full rounded-[1.4rem] ring-offset-2 ring-offset-transparent transition peer-checked:ring-4 peer-checked:ring-[color-mix(in_oklab,var(--t1)_60%,transparent)] peer-focus-visible:ring-4 peer-focus-visible:ring-ouro">
                    <CartaoVirtual compacto modelo={m} texto="" />
                  </span>
                  <span className="text-center text-xs font-semibold">{NOMES_MODELOS[m]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">Assinar como</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <OpcaoAssinatura marcado={!secreto} aoEscolher={() => setSecreto(false)} icone={<UserRound className="size-5" aria-hidden />} titulo={meuNome} texto="Com o seu nome, para qualquer pessoa do grupo." />
              <OpcaoAssinatura
                marcado={secreto}
                aoEscolher={() => meuAmigo && setSecreto(true)}
                desabilitado={!meuAmigo}
                icone={<VenetianMask className="size-5" aria-hidden />}
                titulo="Seu amigo oculto"
                texto={meuAmigo ? `Em segredo, só para ${meuAmigo.nome} (quem você tirou).` : "Disponível depois do sorteio."}
              />
            </div>
          </fieldset>

          {secreto && meuAmigo ? (
            <p className="vidro rounded-2xl px-4 py-3 text-sm">
              Para: <strong>{meuAmigo.nome}</strong> <span className="text-suave">— seu nome não aparece em lugar nenhum.</span>
            </p>
          ) : (
            <Selecao rotulo="Para" value={destino} onChange={(e) => setDestino(e.target.value)} erro={erros.destinatario}>
              <option value="">Escolha uma pessoa…</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </Selecao>
          )}
          <Campo rotulo="Título" opcional value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} erro={erros.titulo} />
          <AreaTexto
            rotulo="Mensagem"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={600}
            erro={erros.texto}
            placeholder="Escreva algo carinhoso…"
            dica={`${texto.length}/600`}
            className="min-h-32"
          />
          <Botao type="submit" carregando={pendente} className="self-start" brilho={!!texto.trim() && !!destinoReal}>
            <Send className="size-4" aria-hidden /> Enviar cartão
          </Botao>
        </form>
      </Cartao>
      <div className="lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-sm font-semibold text-suave">Prévia</p>
        <div className="mx-auto max-w-sm">
          <CartaoVirtual
            modelo={modelo}
            titulo={titulo || null}
            texto={texto || "Sua mensagem aparece aqui."}
            de={secreto ? "Seu amigo oculto" : meuNome}
            para={nomeDestino ?? null}
          />
        </div>
      </div>
    </div>
  );
}

function OpcaoAssinatura({
  marcado,
  aoEscolher,
  desabilitado,
  icone,
  titulo,
  texto,
}: {
  marcado: boolean;
  aoEscolher: () => void;
  desabilitado?: boolean;
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <label
      className={cn(
        "vidro flex min-h-16 cursor-pointer items-start gap-3 rounded-2xl p-3 transition",
        marcado && "ring-2 ring-[color-mix(in_oklab,var(--t1)_55%,transparent)]",
        desabilitado && "cursor-not-allowed opacity-60",
      )}
    >
      <input type="radio" name="assinatura" className="sr-only" checked={marcado} disabled={desabilitado} onChange={aoEscolher} />
      <span className={cn("mt-0.5 text-suave", marcado && "text-t1")}>{icone}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="block text-xs text-suave">{texto}</span>
      </span>
    </label>
  );
}
