"use client";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Clock3, MailPlus, RefreshCw, Send, Undo2, XCircle } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto } from "@/components/ui/campos";
import { Selo, Vazio } from "@/components/ui/cartao";
import { Confirmar } from "@/components/admin/confirmar";
import { useAcao } from "@/components/admin/usar-acao";
import { convidarPorEmail, gerarNovoCodigo, revogarConvite } from "@/lib/acoes/admin";
import { dataCurta } from "@/lib/formatos";

export type Convite = { id: string; email: string; criadoEm: string; aceitoEm: string | null; revogadoEm: string | null };

export function NovoCodigo({ eventoId, aberto }: { eventoId: string; aberto: boolean }) {
  const { pendente, executar } = useAcao();
  const [confirmando, setConfirmando] = useState(false);
  return (
    <>
      <Botao variante="contorno" tamanho="p" onClick={() => setConfirmando(true)} disabled={!aberto}>
        <RefreshCw className="size-4" aria-hidden /> Gerar código novo
      </Botao>
      <Confirmar
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Gerar um código novo?"
        descricao="O código, o link e o QR Code atuais param de funcionar na hora. Quem já está no grupo continua dentro. Use se o convite vazou para quem não devia."
        rotuloConfirmar="Gerar código novo"
        carregando={pendente}
        aoConfirmar={() => executar(() => gerarNovoCodigo(eventoId), { depois: () => setConfirmando(false) })}
      />
    </>
  );
}

export function ConvitesEmail({ eventoId, convites, aberto, emailLigado }: { eventoId: string; convites: Convite[]; aberto: boolean; emailLigado: boolean }) {
  const { pendente, executar } = useAcao();
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [retorno, setRetorno] = useState<string | null>(null);
  const [revogando, setRevogando] = useState<Convite | null>(null);

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setRetorno(null);
    if (!texto.trim()) {
      setErro("Digite pelo menos um e-mail.");
      return;
    }
    executar(() => convidarPorEmail(eventoId, texto), {
      depois: (r) => {
        if (!r.ok) return;
        setTexto("");
        const invalidos = r.dados?.invalidos ?? [];
        setRetorno(`${r.mensagem ?? ""}${invalidos.length ? ` Ignorados (inválidos): ${invalidos.slice(0, 5).join(", ")}${invalidos.length > 5 ? "…" : ""}.` : ""}`);
      },
      erro: (r) => {
        if (!r.ok) setErro(r.campos?.emails ?? r.erro);
      },
    });
  }

  const ativos = convites.filter((c) => !c.revogadoEm);
  const revogados = convites.filter((c) => c.revogadoEm);

  return (
    <div className="flex flex-col gap-5">
      {aberto ? (
        <form onSubmit={enviar} className="flex flex-col gap-3" noValidate>
          <AreaTexto
            rotulo="Convidar por e-mail"
            placeholder={"ana@exemplo.com, bruno@exemplo.com\ncarla@exemplo.com"}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            erro={erro}
            dica="Separe por vírgula, espaço ou uma linha para cada. Até 50 por vez. Quem for convidado por e-mail entra direto, mesmo com aprovação ligada."
            rows={3}
            inputMode="email"
            autoComplete="off"
          />
          <p className="text-xs text-suave">
            {emailLigado
              ? "O envio de e-mails está ligado: cada pessoa recebe o convite com o link. Quem já tem conta também é avisado no app."
              : "O envio de e-mails não está configurado neste site: os convites ficam registrados e quem já tem conta com o e-mail é avisado no app. Para os outros, mande o link pelo WhatsApp."}
          </p>
          <Botao type="submit" carregando={pendente} className="self-start">
            <Send className="size-4" aria-hidden /> Convidar
          </Botao>
          {retorno ? (
            <p role="status" className="flex items-start gap-2 rounded-2xl bg-esmeralda/10 px-4 py-3 text-sm font-medium text-esmeralda">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> {retorno}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="rounded-2xl bg-ouro/12 px-4 py-3 text-sm">O grupo não aceita mais participantes, então não dá para convidar por e-mail.</p>
      )}

      <section aria-labelledby="titulo-convites" className="flex flex-col gap-3">
        <h3 id="titulo-convites" className="font-titulo text-lg font-semibold">
          Convites enviados ({ativos.length})
        </h3>
        {ativos.length === 0 ? (
          <Vazio icone={<MailPlus className="size-9" />} titulo="Nenhum convite por e-mail" texto="Os convites por e-mail aparecem aqui, com quem já aceitou." />
        ) : (
          <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda">
            {ativos.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" title={c.email}>
                    {c.email}
                  </p>
                  <p className="text-xs text-suave">Convidado em {dataCurta(c.criadoEm)}</p>
                </div>
                {c.aceitoEm ? (
                  <Selo cor="esmeralda">
                    <CheckCircle2 className="size-3" aria-hidden /> Aceito
                  </Selo>
                ) : (
                  <Selo cor="ouro">
                    <Clock3 className="size-3" aria-hidden /> Pendente
                  </Selo>
                )}
                {!c.aceitoEm ? (
                  <Botao variante="fantasma" tamanho="p" onClick={() => setRevogando(c)} aria-label={`Revogar o convite de ${c.email}`}>
                    <Undo2 className="size-4" aria-hidden /> <span className="hidden sm:inline">Revogar</span>
                  </Botao>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {revogados.length ? (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-suave">Revogados ({revogados.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {revogados.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-suave">
                  <XCircle className="size-4 shrink-0" aria-hidden /> <span className="truncate">{c.email}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <Confirmar
        aberto={!!revogando}
        aoFechar={() => setRevogando(null)}
        titulo="Revogar este convite?"
        descricao={revogando ? `${revogando.email} deixa de entrar direto. Se o grupo pede aprovação, a pessoa vai precisar pedir para entrar.` : undefined}
        rotuloConfirmar="Revogar convite"
        carregando={pendente}
        aoConfirmar={() => revogando && executar(() => revogarConvite(eventoId, revogando.id), { depois: () => setRevogando(null) })}
      />
    </div>
  );
}
