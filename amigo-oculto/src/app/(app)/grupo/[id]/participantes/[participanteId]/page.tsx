import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, ExternalLink, Footprints, Gift, Heart, Palette, PencilLine, Ruler, Shirt, Sparkles, StickyNote, ThumbsDown, Vote } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { dinheiro, dataCurta } from "@/lib/formatos";
import { urlPublicaDaMidia } from "@/lib/env";
import { Avatar } from "@/components/ui/avatar";
import { Cartao, Selo, TituloCartao, Vazio } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Perfil = { display_name: string; nickname: string | null; avatar_path: string | null; bio: string | null } | null;

export default async function Participante({ params }: { params: Promise<{ id: string; participanteId: string }> }) {
  const { id, participanteId } = await params;
  if (!UUID.test(participanteId)) notFound();
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const { data: p } = await supabase
    .from("participants")
    .select("id, user_id, role, rsvp, created_at, profiles(display_name, nickname, avatar_path, bio)")
    .eq("id", participanteId)
    .eq("event_id", id)
    .eq("status", "approved")
    .maybeSingle();
  if (!p) notFound();
  const perfil = p.profiles as unknown as Perfil;
  const nome = perfil?.display_name ?? "Participante";
  const eu = p.user_id === g.usuario.id;
  const [{ data: itens }, { data: prefs }] = await Promise.all([
    supabase
      .from("wishlist_items")
      .select("id, title, notes, url, image_path, price_estimate")
      .eq("user_id", p.user_id)
      .order("position")
      .order("created_at"),
    supabase.from("gift_preferences").select("*").eq("user_id", p.user_id).maybeSingle(),
  ]);
  const primeiroNome = nome.split(" ")[0];
  const tamanhos = [
    prefs?.shirt_size ? { rotulo: "Camiseta", valor: prefs.shirt_size, icone: Shirt } : null,
    prefs?.pants_size ? { rotulo: "Calça", valor: prefs.pants_size, icone: Ruler } : null,
    prefs?.shoe_size ? { rotulo: "Calçado", valor: prefs.shoe_size, icone: Footprints } : null,
  ].filter(Boolean) as { rotulo: string; valor: string; icone: typeof Shirt }[];
  const temPrefs =
    !!prefs &&
    (prefs.hobbies.length || prefs.interests.length || prefs.favorite_colors.length || prefs.dislikes.length || tamanhos.length || prefs.notes);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={`/grupo/${id}/participantes`}
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-suave hover:text-texto"
      >
        <ArrowLeft className="size-4" aria-hidden /> Participantes
      </Link>

      <Cartao forte className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar nome={nome} caminho={perfil?.avatar_path} tamanho={96} anel />
        <div className="min-w-0 flex-1">
          <h2 className="font-titulo text-2xl font-semibold sm:text-3xl">
            {nome} {eu ? <span className="text-base font-normal text-suave">(você)</span> : null}
          </h2>
          {perfil?.nickname ? <p className="text-suave">“{perfil.nickname}”</p> : null}
          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {p.role === "admin" ? (
              <Selo cor="ouro">
                <Crown className="size-3" aria-hidden /> {p.user_id === g.evento.owner_id ? "Criador do grupo" : "Organiza"}
              </Selo>
            ) : null}
            <Selo>No grupo desde {dataCurta(p.created_at)}</Selo>
          </div>
          {perfil?.bio ? <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{perfil.bio}</p> : null}
        </div>
        {eu ? (
          <BotaoLink href="/lista-de-desejos" variante="vidro" className="shrink-0">
            <PencilLine className="size-4" aria-hidden /> Editar minha lista
          </BotaoLink>
        ) : null}
      </Cartao>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
        <Cartao className="lg:col-span-3">
          <TituloCartao
            icone={<Gift className="size-5" aria-hidden />}
            titulo={eu ? "Minha lista de desejos" : `Lista de desejos de ${primeiroNome}`}
            descricao={itens?.length ? `${itens.length} ${itens.length === 1 ? "item" : "itens"}` : undefined}
          />
          {itens?.length ? (
            <ul className="flex flex-col gap-3">
              {itens.map((i) => {
                const img = urlPublicaDaMidia(i.image_path);
                const preco = dinheiro(i.price_estimate);
                return (
                  <li key={i.id} className="flex gap-3 rounded-2xl border border-borda bg-white/40 p-3 dark:bg-white/[0.03]">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt="" loading="lazy" className="size-20 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <span className="inline-flex size-20 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--t1)_10%,transparent)] text-t1">
                        <Gift className="size-7" aria-hidden />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{i.title}</p>
                      {preco ? <p className="text-sm font-semibold text-esmeralda">cerca de {preco}</p> : null}
                      {i.notes ? <p className="mt-1 whitespace-pre-line text-sm text-suave">{i.notes}</p> : null}
                      {i.url ? (
                        <a
                          href={i.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="mt-1.5 inline-flex items-center gap-1 text-sm font-semibold text-t1 underline-offset-4 hover:underline"
                        >
                          Ver na loja <ExternalLink className="size-3.5" aria-hidden />
                          <span className="sr-only">(abre em outra aba)</span>
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vazio
              icone={<Gift className="size-8" aria-hidden />}
              titulo={eu ? "Sua lista está vazia" : `${primeiroNome} ainda não montou a lista`}
              texto={eu ? "Adicione ideias para ajudar quem tirou você." : "Que tal perguntar pelas mensagens anônimas, se for você quem tirou?"}
              acao={
                eu ? (
                  <BotaoLink href="/lista-de-desejos" tamanho="p">
                    Montar minha lista
                  </BotaoLink>
                ) : undefined
              }
            />
          )}
        </Cartao>

        <Cartao className="lg:col-span-2">
          <TituloCartao icone={<Sparkles className="size-5" aria-hidden />} titulo="Preferências" />
          {temPrefs && prefs ? (
            <div className="flex flex-col gap-4">
              <Etiquetas titulo="Hobbies" icone={<Heart className="size-4" aria-hidden />} itens={prefs.hobbies} />
              <Etiquetas titulo="Interesses" icone={<Sparkles className="size-4" aria-hidden />} itens={prefs.interests} />
              <Etiquetas titulo="Cores favoritas" icone={<Palette className="size-4" aria-hidden />} itens={prefs.favorite_colors} />
              {tamanhos.length ? (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-suave">Tamanhos</p>
                  <dl className="grid grid-cols-3 gap-2">
                    {tamanhos.map((t) => (
                      <div key={t.rotulo} className="rounded-2xl border border-borda bg-white/40 px-3 py-2 text-center dark:bg-white/[0.03]">
                        <dt className="flex items-center justify-center gap-1 text-xs text-suave">
                          <t.icone className="size-3.5" aria-hidden /> {t.rotulo}
                        </dt>
                        <dd className="font-titulo text-lg font-semibold">{t.valor}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : null}
              <Etiquetas titulo="Não curte" icone={<ThumbsDown className="size-4" aria-hidden />} itens={prefs.dislikes} perigo />
              {prefs.notes ? (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-suave">
                    <StickyNote className="size-4" aria-hidden /> Observações
                  </p>
                  <p className="whitespace-pre-line text-[15px] leading-relaxed">{prefs.notes}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-suave">{eu ? "Você ainda não preencheu suas preferências." : "Nenhuma preferência preenchida."}</p>
          )}
          {!eu && g.evento.status !== "finished" ? (
            <Link
              href={`/grupo/${id}/enquetes?categoria=presente`}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-t1 underline-offset-4 hover:underline"
            >
              <Vote className="size-4" aria-hidden /> Fazer uma enquete sobre presentes
            </Link>
          ) : null}
        </Cartao>
      </div>
    </div>
  );
}

function Etiquetas({ titulo, icone, itens, perigo }: { titulo: string; icone: React.ReactNode; itens: string[]; perigo?: boolean }) {
  if (!itens?.length) return null;
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-suave">
        {icone} {titulo}
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {itens.map((t) => (
          <li key={t}>
            <Selo cor={perigo ? "rubi" : "t1"} className="px-3 py-1 text-sm">
              {t}
            </Selo>
          </li>
        ))}
      </ul>
    </div>
  );
}
