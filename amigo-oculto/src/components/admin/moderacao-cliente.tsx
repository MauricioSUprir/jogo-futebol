"use client";
import { useState } from "react";
import { CheckCircle2, EyeOff, MessageSquareOff, ShieldCheck, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Selo, Vazio } from "@/components/ui/cartao";
import { Confirmar } from "@/components/admin/confirmar";
import { useAcao } from "@/components/admin/usar-acao";
import { apagarMensagemChat, resolverDenuncia, silenciarParticipante } from "@/lib/acoes/admin";
import { dataHora } from "@/lib/formatos";
import { TempoRelativo } from "@/components/admin/tempo-relativo";

export type Denuncia = {
  id: string;
  tipo: "chat" | "secret" | "wall" | "photo";
  texto: string | null;
  motivo: string | null;
  criadoEm: string;
  denunciante: string | null;
  autor: string | null;
  resolvidaEm: string | null;
  resolucao: "dismissed" | "deleted" | "muted" | null;
};

const TIPOS: Record<Denuncia["tipo"], string> = {
  chat: "Mensagem no chat",
  secret: "Mensagem anônima",
  wall: "Recado no mural",
  photo: "Foto do álbum",
};

const RESOLUCAO: Record<string, string> = {
  dismissed: "Mantido",
  deleted: "Conteúdo apagado",
  muted: "Apagado e remetente silenciado",
};

type Acao = { denuncia: Denuncia; acao: "dismissed" | "deleted" | "muted" };

export function Denuncias({ eventoId, denuncias }: { eventoId: string; denuncias: Denuncia[] }) {
  const { pendente, executar } = useAcao();
  const [confirmando, setConfirmando] = useState<Acao | null>(null);
  const abertas = denuncias.filter((d) => !d.resolvidaEm);
  const resolvidas = denuncias.filter((d) => d.resolvidaEm);

  const descricao = (a: Acao) => {
    if (a.acao === "dismissed") return "A denúncia é arquivada e o conteúdo continua visível.";
    if (a.acao === "deleted") return "O conteúdo some para todos. Isso não pode ser desfeito.";
    return a.denuncia.tipo === "secret"
      ? "A mensagem some e o remetente anônimo fica bloqueado de mandar novas mensagens anônimas nesta conversa. Você continua sem saber quem é."
      : "O conteúdo some para todos e o autor fica 7 dias sem poder falar no chat.";
  };
  const rotulo = (a: Acao) =>
    a.acao === "dismissed" ? "Manter o conteúdo" : a.acao === "deleted" ? "Apagar o conteúdo" : a.denuncia.tipo === "secret" ? "Apagar e bloquear" : "Apagar e silenciar";

  return (
    <div className="flex flex-col gap-5">
      {abertas.length === 0 ? (
        <Vazio icone={<ShieldCheck className="size-9" />} titulo="Nenhuma denúncia aberta" texto="Quando alguém denunciar uma mensagem, uma foto ou um recado, ela aparece aqui." />
      ) : (
        <ul className="flex flex-col gap-3">
          {abertas.map((d) => (
            <li key={d.id} className="flex flex-col gap-3 rounded-2xl border border-rubi/35 bg-rubi/[0.04] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Selo cor="rubi">{TIPOS[d.tipo]}</Selo>
                <span className="text-xs text-suave"><TempoRelativo iso={d.criadoEm} prefixo="denunciada" /></span>
              </div>
              <blockquote className="rounded-xl bg-white/70 px-4 py-3 text-[15px] [overflow-wrap:anywhere] dark:bg-white/5">
                {d.texto?.trim() ? <span className="whitespace-pre-line">{d.texto}</span> : <span className="italic text-suave">{d.tipo === "photo" ? "Foto sem legenda" : "Sem texto"}</span>}
              </blockquote>
              <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                <div>
                  <dt className="inline text-suave">Remetente: </dt>
                  <dd className="inline font-medium">
                    {d.tipo === "secret" ? (
                      <span className="inline-flex items-center gap-1">
                        <EyeOff className="size-3.5" aria-hidden /> remetente protegido
                      </span>
                    ) : (
                      (d.autor ?? "conteúdo já removido")
                    )}
                  </dd>
                </div>
                {d.tipo !== "secret" ? (
                  <div>
                    <dt className="inline text-suave">Denunciado por: </dt>
                    <dd className="inline font-medium">{d.denunciante ?? "participante"}</dd>
                  </div>
                ) : null}
                {d.motivo ? (
                  <div className="sm:col-span-2">
                    <dt className="inline text-suave">Motivo: </dt>
                    <dd className="inline [overflow-wrap:anywhere]">{d.motivo}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Botao variante="contorno" tamanho="p" disabled={pendente} onClick={() => setConfirmando({ denuncia: d, acao: "dismissed" })}>
                  <CheckCircle2 className="size-4" aria-hidden /> Manter
                </Botao>
                <Botao variante="contorno" tamanho="p" disabled={pendente} onClick={() => setConfirmando({ denuncia: d, acao: "deleted" })}>
                  <Trash2 className="size-4" aria-hidden /> Apagar conteúdo
                </Botao>
                <Botao variante="perigo" tamanho="p" disabled={pendente} onClick={() => setConfirmando({ denuncia: d, acao: "muted" })}>
                  <MessageSquareOff className="size-4" aria-hidden /> {d.tipo === "secret" ? "Apagar e bloquear remetente" : "Apagar e silenciar autor"}
                </Botao>
              </div>
            </li>
          ))}
        </ul>
      )}
      {resolvidas.length ? (
        <details className="rounded-2xl border border-borda px-4 py-3">
          <summary className="cursor-pointer font-semibold">Resolvidas ({resolvidas.length})</summary>
          <ul className="mt-3 flex flex-col divide-y divide-borda">
            {resolvidas.map((d) => (
              <li key={d.id} className="flex flex-col gap-0.5 py-2 text-sm">
                <span>
                  <strong>{TIPOS[d.tipo]}</strong> · {d.resolucao ? RESOLUCAO[d.resolucao] : "Resolvida"} · {dataHora(d.resolvidaEm)}
                </span>
                {d.texto ? <span className="truncate text-suave">{d.texto}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <Confirmar
        aberto={!!confirmando}
        aoFechar={() => setConfirmando(null)}
        titulo={confirmando ? `${rotulo(confirmando)}?` : ""}
        descricao={confirmando ? descricao(confirmando) : undefined}
        rotuloConfirmar={confirmando ? rotulo(confirmando) : ""}
        perigo={confirmando?.acao !== "dismissed"}
        carregando={pendente}
        aoConfirmar={() =>
          confirmando && executar(() => resolverDenuncia(eventoId, confirmando.denuncia.id, confirmando.acao), { depois: () => setConfirmando(null) })
        }
      />
    </div>
  );
}

export type MensagemChat = { id: string; texto: string; autor: string; avatar: string | null; criadoEm: string };
export type Silenciado = { participanteId: string; nome: string; ate: string };

export function ModeracaoChat({ eventoId, mensagens, silenciados }: { eventoId: string; mensagens: MensagemChat[]; silenciados: Silenciado[] }) {
  const { pendente, executar } = useAcao();
  const [apagando, setApagando] = useState<MensagemChat | null>(null);
  return (
    <div className="flex flex-col gap-5">
      {silenciados.length ? (
        <section aria-labelledby="titulo-silenciados" className="flex flex-col gap-2">
          <h3 id="titulo-silenciados" className="font-semibold">
            Silenciados agora
          </h3>
          <ul className="flex flex-col gap-2">
            {silenciados.map((s) => (
              <li key={s.participanteId} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-borda px-4 py-2.5">
                <span className="text-sm">
                  <strong>{s.nome}</strong> <span className="text-suave">até {dataHora(s.ate)}</span>
                </span>
                <Botao variante="fantasma" tamanho="p" disabled={pendente} onClick={() => executar(() => silenciarParticipante(eventoId, s.participanteId, 0))}>
                  Liberar
                </Botao>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section aria-labelledby="titulo-ultimas" className="flex flex-col gap-2">
        <h3 id="titulo-ultimas" className="font-semibold">
          Últimas mensagens do chat
        </h3>
        {mensagens.length === 0 ? (
          <p className="text-sm text-suave">O chat ainda está vazio.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda">
            {mensagens.map((m) => (
              <li key={m.id} className="flex items-start gap-3 px-3 py-2.5 sm:px-4">
                <Avatar nome={m.autor} caminho={m.avatar} tamanho={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <strong>{m.autor}</strong> <span className="text-xs text-suave"><TempoRelativo iso={m.criadoEm} /></span>
                  </p>
                  <p className="text-sm [overflow-wrap:anywhere]">{m.texto}</p>
                </div>
                <Botao variante="fantasma" tamanho="p" onClick={() => setApagando(m)} aria-label={`Apagar a mensagem de ${m.autor}`}>
                  <Trash2 className="size-4" aria-hidden />
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Confirmar
        aberto={!!apagando}
        aoFechar={() => setApagando(null)}
        titulo="Apagar esta mensagem do chat?"
        descricao={apagando ? `“${apagando.texto.slice(0, 120)}${apagando.texto.length > 120 ? "…" : ""}” some para todos.` : undefined}
        rotuloConfirmar="Apagar mensagem"
        carregando={pendente}
        aoConfirmar={() => apagando && executar(() => apagarMensagemChat(eventoId, apagando.id), { depois: () => setApagando(null) })}
      />
    </div>
  );
}
