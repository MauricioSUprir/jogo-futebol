"use client";
import { useState, type FormEvent } from "react";
import { BellRing, CalendarCheck2, Eye, Gift, ListChecks, Megaphone, PencilLine, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Interruptor } from "@/components/ui/campos";
import { Selo, Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Confirmar } from "@/components/admin/confirmar";
import { useAcao } from "@/components/admin/usar-acao";
import { editarAviso, enviarLembrete, excluirAviso, fixarAviso, publicarAviso } from "@/lib/acoes/admin";
import { TempoRelativo } from "@/components/admin/tempo-relativo";

export type Aviso = { id: string; titulo: string; corpo: string | null; fixado: boolean; criadoEm: string; autor: string | null };

function FormAviso({
  inicial,
  aoEnviar,
  carregando,
  rotulo,
  erros,
}: {
  inicial?: { titulo: string; corpo: string; fixado: boolean };
  aoEnviar: (d: { titulo: string; corpo: string; fixado: boolean }) => void;
  carregando: boolean;
  rotulo: string;
  erros: Record<string, string>;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [corpo, setCorpo] = useState(inicial?.corpo ?? "");
  const [fixado, setFixado] = useState(inicial?.fixado ?? false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  function enviar(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) {
      setErroLocal("Dê um título ao aviso.");
      return;
    }
    setErroLocal(null);
    aoEnviar({ titulo, corpo, fixado });
  }
  return (
    <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
      <Campo
        rotulo="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value.slice(0, 120))}
        placeholder="Ex.: Mudamos o local do encontro!"
        erro={erroLocal ?? erros.titulo}
        dica={`${titulo.length}/120`}
      />
      <AreaTexto
        rotulo="Mensagem"
        opcional
        value={corpo}
        onChange={(e) => setCorpo(e.target.value.slice(0, 2000))}
        rows={3}
        erro={erros.corpo}
        dica={`${corpo.length}/2000`}
      />
      <Interruptor rotulo="Fixar no topo" descricao="Fica em destaque na sala até você desafixar." marcado={fixado} aoMudar={setFixado} />
      <Botao type="submit" carregando={carregando} className="self-start">
        <Send className="size-4" aria-hidden /> {rotulo}
      </Botao>
    </form>
  );
}

export function AvisosCliente({ eventoId, avisos }: { eventoId: string; avisos: Aviso[] }) {
  const { pendente, executar } = useAcao();
  const [chave, setChave] = useState(0); // recria o formulário de novo aviso depois de publicar
  const [erros, setErros] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<Aviso | null>(null);
  const [excluindo, setExcluindo] = useState<Aviso | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-borda p-4">
        <p className="mb-3 font-semibold">Novo aviso</p>
        <FormAviso
          key={chave}
          rotulo="Publicar e avisar o grupo"
          carregando={pendente && !editando}
          erros={erros}
          aoEnviar={(d) =>
            executar(() => publicarAviso(eventoId, d), {
              depois: () => {
                setErros({});
                setChave((c) => c + 1);
              },
              erro: (r) => !r.ok && setErros(r.campos ?? {}),
            })
          }
        />
      </div>

      <section aria-labelledby="titulo-avisos" className="flex flex-col gap-3">
        <h3 id="titulo-avisos" className="font-titulo text-lg font-semibold">
          Publicados ({avisos.length})
        </h3>
        {avisos.length === 0 ? (
          <Vazio icone={<Megaphone className="size-9" />} titulo="Nenhum aviso ainda" texto="Avisos aparecem na sala do grupo e todos recebem uma notificação." />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {avisos.map((a) => (
              <li key={a.id} className="rounded-2xl border border-borda p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold [overflow-wrap:anywhere]">
                      {a.fixado ? (
                        <Selo cor="ouro">
                          <Pin className="size-3" aria-hidden /> Fixado
                        </Selo>
                      ) : null}
                      {a.titulo}
                    </p>
                    <p className="text-xs text-suave">
                      {a.autor ? `${a.autor} · ` : ""}
                      <TempoRelativo iso={a.criadoEm} />
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Botao
                      variante="fantasma"
                      tamanho="p"
                      disabled={pendente}
                      onClick={() => executar(() => fixarAviso(eventoId, a.id, !a.fixado))}
                      aria-label={a.fixado ? `Desafixar ${a.titulo}` : `Fixar ${a.titulo}`}
                    >
                      {a.fixado ? <PinOff className="size-4" aria-hidden /> : <Pin className="size-4" aria-hidden />}
                    </Botao>
                    <Botao variante="fantasma" tamanho="p" onClick={() => setEditando(a)} aria-label={`Editar ${a.titulo}`}>
                      <PencilLine className="size-4" aria-hidden />
                    </Botao>
                    <Botao variante="fantasma" tamanho="p" onClick={() => setExcluindo(a)} aria-label={`Excluir ${a.titulo}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </Botao>
                  </div>
                </div>
                {a.corpo ? <p className="mt-2 whitespace-pre-line text-sm [overflow-wrap:anywhere]">{a.corpo}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialogo aberto={!!editando} aoFechar={() => setEditando(null)} titulo="Editar aviso" descricao="A edição não manda nova notificação.">
        {editando ? (
          <FormAviso
            inicial={{ titulo: editando.titulo, corpo: editando.corpo ?? "", fixado: editando.fixado }}
            rotulo="Salvar"
            carregando={pendente}
            erros={{}}
            aoEnviar={(d) => executar(() => editarAviso(eventoId, editando.id, d), { depois: () => setEditando(null) })}
          />
        ) : null}
      </Dialogo>
      <Confirmar
        aberto={!!excluindo}
        aoFechar={() => setExcluindo(null)}
        titulo="Excluir este aviso?"
        descricao={excluindo ? `“${excluindo.titulo}” some da sala do grupo.` : undefined}
        rotuloConfirmar="Excluir aviso"
        carregando={pendente}
        aoConfirmar={() => excluindo && executar(() => excluirAviso(eventoId, excluindo.id), { depois: () => setExcluindo(null) })}
      />
    </div>
  );
}

const LEMBRETES = [
  { tipo: "wishlist", titulo: "Montar a lista de desejos", para: "quem ainda não tem nenhum item na lista", icone: ListChecks, precisaSorteio: false, chave: "semLista" },
  { tipo: "rsvp", titulo: "Confirmar presença", para: "quem ainda não respondeu se vai", icone: CalendarCheck2, precisaSorteio: false, chave: "semResposta" },
  { tipo: "view_result", titulo: "Abrir o presente", para: "quem ainda não viu quem tirou", icone: Eye, precisaSorteio: true, chave: "naoViram" },
  { tipo: "buy_gift", titulo: "Comprar o presente", para: "quem ainda não marcou que comprou", icone: Gift, precisaSorteio: true, chave: "naoCompraram" },
] as const;

export function LembretesCliente({
  eventoId,
  sorteado,
  faltam,
}: {
  eventoId: string;
  sorteado: boolean;
  faltam: { semLista: number; semResposta: number; naoViram: number; naoCompraram: number };
}) {
  const { pendente, executar } = useAcao();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [enviados, setEnviados] = useState<Record<string, string>>({});
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {LEMBRETES.map((l) => {
        const Icone = l.icone;
        const bloqueado = l.precisaSorteio && !sorteado;
        const n = faltam[l.chave];
        return (
          <li key={l.tipo} className="flex flex-col gap-3 rounded-2xl border border-borda p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1" aria-hidden>
                <Icone className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{l.titulo}</p>
                <p className="text-sm text-suave">
                  Vai para {l.para}
                  {bloqueado ? "." : `: hoje, ${n} pessoa${n === 1 ? "" : "s"}.`}
                </p>
              </div>
            </div>
            {enviados[l.tipo] ? (
              <p role="status" className="text-sm font-medium text-esmeralda">
                {enviados[l.tipo]}
              </p>
            ) : null}
            <Botao
              variante="vidro"
              tamanho="p"
              disabled={bloqueado || pendente || n === 0}
              carregando={pendente && enviando === l.tipo}
              onClick={() => {
                setEnviando(l.tipo);
                executar(() => enviarLembrete(eventoId, l.tipo), {
                  depois: (r) => {
                    setEnviando(null);
                    if (r.ok) setEnviados((e) => ({ ...e, [l.tipo]: r.mensagem ?? "Enviado." }));
                  },
                  erro: () => setEnviando(null),
                })
              }}
              className="self-start"
            >
              <BellRing className="size-4" aria-hidden />
              {bloqueado ? "Depois do sorteio" : n === 0 ? "Todos em dia" : "Enviar lembrete"}
            </Botao>
          </li>
        );
      })}
    </ul>
  );
}
