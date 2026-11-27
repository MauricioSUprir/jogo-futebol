import { Megaphone, Pin, Plus } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { dataHora, relativo } from "@/lib/formatos";
import { Cartao, Selo, TituloCartao } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { Avatar } from "@/components/ui/avatar";
import { AtualizarAoVivo } from "@/components/sala/ao-vivo";
import { carregarMembros } from "@/components/sala/dados";
import { MuralDeBilhetes, type Bilhete } from "@/components/sala/mural";

export const metadata = { title: "Mural" };

export default async function Mural({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [membros, { data: avisos }, { data: bilhetes }] = await Promise.all([
    carregarMembros(id),
    supabase
      .from("announcements")
      .select("id, title, body, pinned, created_at, author_id")
      .eq("event_id", id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("wall_posts").select("id, user_id, body, color, created_at").eq("event_id", id).order("created_at", { ascending: false }).limit(150),
  ]);
  const perfis = Object.fromEntries(membros.map((m) => [m.usuarioId, { nome: m.nome, avatar: m.avatar }]));
  const silenciado = g.eu.muted_until && new Date(g.eu.muted_until) > new Date() ? g.eu.muted_until : null;
  const bloqueio = g.evento.archived_at
    ? "Este grupo está arquivado: o mural fica só para leitura."
    : silenciado
      ? `O organizador silenciou você até ${dataHora(silenciado)}. Você ainda pode ler o mural.`
      : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <AtualizarAoVivo
        canal={`sala-mural:${id}`}
        assinaturas={[
          { tabela: "wall_posts", filtro: `event_id=eq.${id}` },
          { tabela: "wall_posts", evento: "DELETE", campo: "id", valores: (bilhetes ?? []).map((b) => b.id) },
          { tabela: "announcements", filtro: `event_id=eq.${id}` },
          { tabela: "announcements", evento: "DELETE", campo: "id", valores: (avisos ?? []).map((a) => a.id) },
          { tabela: "participants", evento: "UPDATE", filtro: `id=eq.${g.eu.id}` },
        ]}
      />

      <section aria-labelledby="titulo-avisos" className="lg:order-2">
        <Cartao forte className="lg:sticky lg:top-24">
          <TituloCartao
            icone={<Megaphone className="size-5" aria-hidden />}
            titulo={<span id="titulo-avisos">Avisos do organizador</span>}
            acao={
              g.admin ? (
                <BotaoLink href={`/grupo/${id}/admin#avisos`} tamanho="p" variante="vidro">
                  <Plus className="size-4" aria-hidden /> Publicar aviso
                </BotaoLink>
              ) : undefined
            }
          />
          {avisos?.length ? (
            <ol className="flex flex-col gap-3">
              {avisos.map((a) => {
                const autor = membros.find((m) => m.usuarioId === a.author_id);
                return (
                  <li
                    key={a.id}
                    className={
                      a.pinned
                        ? "rounded-2xl border border-ouro/50 bg-[color-mix(in_oklab,var(--ouro)_10%,transparent)] px-4 py-3"
                        : "rounded-2xl border border-borda bg-white/40 px-4 py-3 dark:bg-white/[0.03]"
                    }
                  >
                    {a.pinned ? (
                      <Selo cor="ouro" className="mb-1.5">
                        <Pin className="size-3" aria-hidden /> Fixado
                      </Selo>
                    ) : null}
                    <h3 className="font-semibold">{a.title}</h3>
                    {a.body ? <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">{a.body}</p> : null}
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-suave">
                      {autor ? <Avatar nome={autor.nome} caminho={autor.avatar} tamanho={20} /> : null}
                      {autor ? `${autor.nome} · ` : ""}
                      <time dateTime={a.created_at} title={dataHora(a.created_at) ?? undefined}>
                        {relativo(a.created_at)}
                      </time>
                    </p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-suave">
              {g.admin ? "Você ainda não publicou avisos. Eles aparecem aqui e na visão geral, e todos são notificados." : "Nenhum aviso por enquanto."}
            </p>
          )}
        </Cartao>
      </section>

      <section aria-labelledby="titulo-bilhetes" className="lg:order-1 lg:col-span-2">
        <h2 id="titulo-bilhetes" className="mb-1 font-titulo text-2xl font-semibold">
          Mural de mensagens
        </h2>
        <p className="mb-4 text-sm text-suave">Bilhetes coloridos de todo mundo do grupo. Aparecem na hora para todos.</p>
        <MuralDeBilhetes
          eventoId={id}
          eu={g.usuario.id}
          admin={g.admin}
          bloqueio={bloqueio}
          bilhetes={(bilhetes ?? []) as Bilhete[]}
          perfis={perfis}
        />
      </section>
    </div>
  );
}
