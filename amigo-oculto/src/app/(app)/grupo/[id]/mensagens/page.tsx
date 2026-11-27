import { Flag, Gift, HelpCircle, Lightbulb, LockKeyhole, ShieldCheck, VenetianMask } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { carregarConversas } from "@/lib/acoes/mensagens";
import { dataHora } from "@/lib/formatos";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { CaixaAnonima } from "@/components/mensagens/caixa";
import { naoLidas, type LadoConversa } from "@/components/mensagens/tipos";

export const metadata = { title: "Mensagens anônimas" };

const COMO_FUNCIONA = [
  { icone: HelpCircle, titulo: "Perguntas anônimas", texto: "Descubra tamanho, cor preferida e gostos de quem você tirou sem se entregar." },
  { icone: Lightbulb, titulo: "Pistas", texto: "Mande dicas sobre quem você é para animar a revelação." },
  { icone: Gift, titulo: "Sobre o presente", texto: "Peça ideias e confirme o que a pessoa mais quer da lista." },
  { icone: Flag, titulo: "Seguro", texto: "Quem recebe pode bloquear e denunciar. O organizador vê só o texto, nunca o remetente." },
];

export default async function MensagensAnonimas({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conversa?: string }>;
}) {
  const { id } = await params;
  const { conversa } = await searchParams;
  const g = await carregarGrupo(id);

  if (g.evento.status === "open") {
    return (
      <div className="flex flex-col gap-5">
        <Cartao forte className="relative overflow-hidden text-center">
          <div aria-hidden className="fita-ouro absolute inset-x-0 top-0 h-1" />
          <span className="mx-auto inline-flex size-16 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,#2a2f3a,#0f1218)] text-ouro-claro">
            <VenetianMask className="size-8" aria-hidden />
          </span>
          <h2 className="mt-3 font-titulo text-2xl font-semibold">As mensagens anônimas abrem depois do sorteio</h2>
          <p className="mx-auto mt-2 max-w-lg text-suave">
            {g.evento.draw_mode === "scheduled" && g.evento.draw_at
              ? `O sorteio está marcado para ${dataHora(g.evento.draw_at, { weekday: "long" })}.`
              : "Assim que o organizador fizer o sorteio,"}{" "}
            você vai poder conversar em segredo com quem tirou — e responder a quem tirou você.
          </p>
        </Cartao>
        <ComoFunciona />
      </div>
    );
  }

  const r = await carregarConversas(id);
  if (!r.ok || !r.dados) {
    return (
      <Cartao className="text-center">
        <p className="font-semibold">Não foi possível abrir as mensagens agora.</p>
        <p className="mt-1 text-sm text-suave">{r.ok ? "Tente de novo em instantes." : r.erro}</p>
      </Cartao>
    );
  }
  if (!r.dados.disponivel) {
    return (
      <div className="flex flex-col gap-5">
        <Cartao forte className="text-center">
          <LockKeyhole className="mx-auto size-10 text-ouro" aria-hidden />
          <h2 className="mt-3 font-titulo text-2xl font-semibold">Você não está neste sorteio</h2>
          <p className="mx-auto mt-2 max-w-lg text-suave">
            Você entrou no grupo depois do sorteio, então não tirou ninguém e ninguém tirou você. Se o organizador refizer o sorteio
            com você, as conversas aparecem aqui.
          </p>
          <BotaoLink href={`/grupo/${id}`} variante="vidro" className="mt-4">
            Voltar à visão geral
          </BotaoLink>
        </Cartao>
      </div>
    );
  }

  const c = r.dados;
  const pedida: LadoConversa | null = conversa === "santa" ? "santa" : conversa === "receiver" ? "receiver" : null;
  const aba: LadoConversa =
    pedida ?? (naoLidas(c.deQuemMeTirou?.mensagens) > 0 && naoLidas(c.paraQuemTirei.mensagens) === 0 ? "santa" : "receiver");

  return (
    <section aria-labelledby="titulo-anonimas" className="flex flex-col gap-4">
      <div>
        <h2 id="titulo-anonimas" className="flex items-center gap-2 font-titulo text-2xl font-semibold">
          <VenetianMask className="size-6 text-t1" aria-hidden /> Mensagens anônimas
        </h2>
        <p className="text-sm text-suave">Converse em segredo com quem você tirou e responda a quem tirou você.</p>
      </div>
      <CaixaAnonima eventoId={id} usuarioId={g.usuario.id} inicial={c} abaInicial={aba} />
    </section>
  );
}

function ComoFunciona() {
  return (
    <Cartao>
      <TituloCartao icone={<ShieldCheck className="size-5" aria-hidden />} titulo="Como funciona" descricao="Ninguém — nem o organizador — sabe quem é você." />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COMO_FUNCIONA.map((i) => (
          <li key={i.titulo} className="flex gap-3 rounded-2xl border border-borda bg-white/40 p-4 dark:bg-white/[0.03]">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1">
              <i.icone className="size-5" aria-hidden />
            </span>
            <span>
              <span className="block font-semibold">{i.titulo}</span>
              <span className="block text-sm text-suave">{i.texto}</span>
            </span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
