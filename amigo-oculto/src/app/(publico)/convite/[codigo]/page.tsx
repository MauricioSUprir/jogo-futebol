import type { Metadata } from "next";
import { cache } from "react";
import { CalendarHeart, Clock3, Gift, Lock, MapPin, ShieldCheck, Users } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { CONVIDADO_LIGADO, urlPublicaDaMidia } from "@/lib/env";
import { dataHora, faixaDePreco } from "@/lib/formatos";
import { normalizarCodigo } from "@/lib/validacao/evento";
import { Cartao, Selo } from "@/components/ui/cartao";
import { MarcaPresente } from "@/components/ui/logo";
import { EnfeitesTema } from "@/components/grupo/enfeites";
import { EntrarNoGrupo } from "@/components/convite/entrar-no-grupo";
import { OutroCodigo } from "@/components/convite/outro-codigo";
import { situacaoDoConvite } from "@/components/convite/situacao";
import { TEMAS, type Tema } from "@/lib/temas";

type Previa = {
  id: string;
  name: string;
  description: string | null;
  cover_path: string | null;
  theme: Tema;
  reveal_at: string | null;
  location: string | null;
  gift_min: number | null;
  gift_max: number | null;
  max_participants: number | null;
  join_deadline: string | null;
  requires_approval: boolean;
  status: "open" | "drawn" | "finished";
  archived: boolean;
  participant_count: number;
  owner_name: string | null;
  accepting: boolean;
  my_status: "approved" | "pending" | "rejected" | null;
};

function decodificar(bruto: string) {
  try {
    return decodeURIComponent(bruto);
  } catch {
    return bruto;
  }
}

const carregarPrevia = cache(async (bruto: string) => {
  const codigo = normalizarCodigo(decodificar(bruto));
  if (!codigo) return { codigo: null, previa: null };
  const supabase = await clienteServidor();
  const { data } = await supabase.rpc("event_preview", { p_code: codigo });
  return { codigo, previa: (data as unknown as Previa | null) ?? null };
});

export async function generateMetadata({ params }: { params: Promise<{ codigo: string }> }): Promise<Metadata> {
  const { codigo } = await params;
  const { previa } = await carregarPrevia(codigo);
  if (!previa) return { title: "Convite não encontrado", robots: { index: false } };
  const quando = dataHora(previa.reveal_at);
  return {
    title: `Convite: ${previa.name}`,
    description: `${previa.owner_name ?? "Alguém"} convidou você para o amigo oculto ${previa.name}${quando ? ` (${quando})` : ""}.`,
    robots: { index: false },
    openGraph: { title: `Amigo oculto: ${previa.name}`, description: "Toque para ver o grupo e participar." },
  };
}

function Invalido({ digitado }: { digitado: string }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-10">
      <Cartao forte className="flex flex-col gap-4 p-7 text-center sm:p-8">
        <MarcaPresente tamanho={56} className="mx-auto" />
        <div>
          <h1 className="font-titulo text-2xl font-semibold">Não encontramos este convite</h1>
          <p className="mt-1 text-suave">
            O código pode ter sido digitado errado ou trocado pelo organizador. Confira as letras e os números, ou peça o link de novo.
          </p>
        </div>
        <div className="text-left">
          <OutroCodigo inicial={digitado.toUpperCase().slice(0, 12)} rotulo="Digite outro código" />
        </div>
      </Cartao>
    </div>
  );
}

export default async function PaginaConvite({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo: bruto } = await params;
  const [{ codigo, previa: p }, usuario] = await Promise.all([carregarPrevia(bruto), usuarioAtual()]);
  if (!codigo || !p) return <Invalido digitado={decodificar(bruto)} />;

  const capa = urlPublicaDaMidia(p.cover_path);
  const preco = faixaDePreco(p.gift_min, p.gift_max);
  const { aceitando, motivo } = situacaoDoConvite(p);
  const tema = (p.theme in TEMAS ? p.theme : "natal") as Tema;

  return (
    <div data-tema={tema} className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:py-10">
      <article className="vidro-forte overflow-hidden rounded-[2rem]">
        <div className="relative h-40 overflow-hidden sm:h-56">
          {capa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={capa} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))]">
              <EnfeitesTema tema={tema} />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" aria-hidden />
          <div className="absolute bottom-3 left-4 right-4 flex flex-wrap gap-2 sm:left-6">
            <Selo className="bg-white/90 text-[#1d2420] dark:bg-white/90">{TEMAS[tema].nome}</Selo>
            {p.requires_approval ? (
              <Selo className="bg-white/90 text-[#1d2420] dark:bg-white/90">
                <Lock className="size-3" aria-hidden /> Precisa de aprovação
              </Selo>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-5 p-6 sm:p-8">
          <header className="flex items-start gap-3">
            <MarcaPresente tamanho={44} className="shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-suave">
                {p.owner_name ? `${p.owner_name} convidou você` : "Você foi convidado"}
              </p>
              <h1 className="font-titulo text-3xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-4xl">{p.name}</h1>
            </div>
          </header>

          {p.description ? <p className="whitespace-pre-line text-[15px] leading-relaxed [overflow-wrap:anywhere]">{p.description}</p> : null}

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Info icone={<CalendarHeart className="size-5" />} rotulo="Revelação" valor={dataHora(p.reveal_at, { weekday: "long" }) ?? "A definir"} />
            <Info icone={<MapPin className="size-5" />} rotulo="Local" valor={p.location ?? "A definir"} />
            <Info icone={<Gift className="size-5" />} rotulo="Presente" valor={preco ?? "Sem faixa de valor"} />
            <Info
              icone={<Users className="size-5" />}
              rotulo="Participantes"
              valor={`${p.participant_count} ${p.participant_count === 1 ? "pessoa já entrou" : "pessoas já entraram"}${p.max_participants ? ` · limite de ${p.max_participants}` : ""}`}
            />
            {p.join_deadline ? (
              <Info icone={<Clock3 className="size-5" />} rotulo="Prazo para entrar" valor={dataHora(p.join_deadline, { weekday: "long" }) ?? ""} />
            ) : null}
          </ul>

          {!aceitando && p.my_status !== "approved" && p.my_status !== "pending" ? (
            <p className="rounded-2xl bg-ouro/12 px-4 py-3 text-sm font-medium" role="status">
              {motivo}
            </p>
          ) : null}

          <EntrarNoGrupo
            codigo={codigo}
            eventoId={p.id}
            logado={!!usuario}
            meuStatus={p.my_status ?? null}
            aceitando={aceitando}
            precisaAprovacao={p.requires_approval}
            convidadoLigado={CONVIDADO_LIGADO}
          />
        </div>
      </article>
      <p className="flex items-center justify-center gap-2 text-center text-sm text-suave">
        <ShieldCheck className="size-4 text-esmeralda" aria-hidden /> Sorteio seguro: ninguém vê quem tirou quem, nem o organizador.
      </p>
    </div>
  );
}

function Info({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: string }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl border border-borda px-4 py-3">
      <span className="mt-0.5 text-t1" aria-hidden>
        {icone}
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold uppercase tracking-wider text-suave">{rotulo}</span>
        <span className="block font-medium [overflow-wrap:anywhere]">{valor}</span>
      </span>
    </li>
  );
}
