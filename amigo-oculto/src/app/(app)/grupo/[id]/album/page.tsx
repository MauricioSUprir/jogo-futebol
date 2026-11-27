import { Gift, Images, Lock, Mail, MessageSquareQuote } from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { lerEstatisticas } from "@/lib/conquistas";
import { dataCurta, dataHora, relativo } from "@/lib/formatos";
import { pessoasDoGrupo } from "@/components/jogos/dados";
import { AbasAlbum } from "@/components/album/abas-album";
import { FotosAlbum, type FotoAlbum } from "@/components/album/fotos";
import { LinhaDoTempo, type Registro } from "@/components/album/linha-do-tempo";
import { Retrospectiva } from "@/components/album/retrospectiva";
import { Lembranca } from "@/components/album/lembranca";
import { CartoesDoAlbum } from "@/components/album/cartoes-album";
import { ParRevelado } from "@/components/aovivo/partes";
import { Avatar } from "@/components/ui/avatar";
import { BotaoLink } from "@/components/ui/botao";
import { Cartao, Selo, Vazio } from "@/components/ui/cartao";
import { cn } from "@/lib/cn";

export const metadata = { title: "Álbum de memórias" };

type Perfil = { display_name: string; avatar_path: string | null } | null;
const perfil = (p: unknown): Perfil => (Array.isArray(p) ? (p[0] ?? null) : (p as Perfil));

const CORES_RECADO: Record<string, string> = {
  ouro: "bg-[color-mix(in_oklab,var(--ouro)_22%,var(--vidro-forte))]",
  vermelho: "bg-[color-mix(in_oklab,var(--rubi)_16%,var(--vidro-forte))]",
  verde: "bg-[color-mix(in_oklab,var(--esmeralda)_16%,var(--vidro-forte))]",
  neve: "bg-[var(--vidro-forte)]",
  rosa: "bg-[color-mix(in_oklab,#ec6aa0_18%,var(--vidro-forte))]",
  azul: "bg-[color-mix(in_oklab,#3b82f6_16%,var(--vidro-forte))]",
};

export default async function PaginaAlbum({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ secao?: string }>;
}) {
  const { id } = await params;
  const { secao } = await searchParams;
  const g = await carregarGrupo(id);
  const aberto = g.evento.status === "finished" || !!g.aoVivo;
  if (!aberto) {
    return (
      <Vazio
        icone={<Lock className="size-10" />}
        titulo="O álbum ainda está guardado"
        texto="Ele abre quando a revelação ao vivo começar ou quando o amigo oculto for encerrado. Aí todo mundo pode mandar fotos e recados — só para o grupo."
        acao={<BotaoLink href={`/grupo/${id}/jogos`} variante="vidro">Enquanto isso, jogos</BotaoLink>}
      />
    );
  }

  const supabase = await clienteServidor();
  const agoraIso = new Date().toISOString();
  const [pessoas, fotosQ, revQ, muralQ, capsQ, logQ, cartoesQ, estatQ] = await Promise.all([
    pessoasDoGrupo(supabase, id),
    supabase
      .from("album_photos")
      .select("id, storage_path, caption, width, height, created_at, uploader_id, profiles(display_name, avatar_path)")
      .eq("event_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("live_reveals").select("id, giver_id, receiver_id, method, revealed_at").eq("event_id", id).order("revealed_at"),
    supabase
      .from("wall_posts")
      .select("id, body, color, created_at, user_id, profiles(display_name, avatar_path)")
      .eq("event_id", id)
      .order("created_at", { ascending: false })
      .limit(80),
    supabase
      .from("time_capsules")
      .select("id, body, open_at, created_at, profiles(display_name, avatar_path)")
      .eq("event_id", id)
      .lte("open_at", agoraIso)
      .order("open_at", { ascending: false }),
    supabase.from("event_log").select("id, kind, data, created_at").eq("event_id", id).order("created_at").limit(400),
    supabase.rpc("my_cards", { p_event: id }),
    supabase.rpc("participation_stats", { p_event: id }),
  ]);

  // URLs assinadas em lote (1 hora), geradas no servidor com a sessão de quem está vendo
  const linhasFotos = fotosQ.data ?? [];
  const assinadas = new Map<string, string>();
  if (linhasFotos.length) {
    const { data } = await supabase.storage.from("album").createSignedUrls(linhasFotos.map((f) => f.storage_path), 3600);
    for (const s of data ?? []) if (s.signedUrl && s.path) assinadas.set(s.path, s.signedUrl);
  }
  const fotos: FotoAlbum[] = linhasFotos.map((f) => {
    const p = perfil(f.profiles);
    return {
      id: f.id,
      url: assinadas.get(f.storage_path) ?? null,
      legenda: f.caption,
      largura: f.width,
      altura: f.height,
      autor: p?.display_name ?? "Participante",
      autorAvatar: p?.avatar_path ?? null,
      minha: f.uploader_id === g.usuario.id,
      criadaEm: f.created_at,
    };
  });

  const mapa = new Map(pessoas.map((p) => [p.id, p]));
  const revelacoes = (revQ.data ?? []).map((r) => ({
    ...r,
    de: mapa.get(r.giver_id) ?? { nome: "Participante", avatar: null },
    para: mapa.get(r.receiver_id) ?? { nome: "Participante", avatar: null },
  }));
  const recados = (muralQ.data ?? []).map((w) => ({ ...w, autor: perfil(w.profiles) }));
  const capsulas = (capsQ.data ?? []).map((c) => ({ ...c, autor: perfil(c.profiles) }));
  const registros = (logQ.data ?? []) as Registro[];
  const cartoes = ((cartoesQ.data ?? { received: [] }) as {
    received: { id: string; template: string; title: string | null; body: string; created_at: string; anonymous: boolean; sender_name: string | null }[];
  }).received;
  const estat = lerEstatisticas(estatQ.data);
  const soma = (k: "cards" | "wall" | "challenges" | "chat") => estat.reduce((s, e) => s + e[k], 0);
  const eu = pessoas.find((p) => p.id === g.eu.id);
  const dataEvento = g.evento.reveal_at ?? g.evento.finished_at;

  const numeros = [
    { rotulo: "participantes", valor: pessoas.length },
    { rotulo: "revelações", valor: revelacoes.length },
    { rotulo: "fotos", valor: fotos.length },
    { rotulo: "recados", valor: recados.length },
    { rotulo: "cartões", valor: soma("cards") },
    { rotulo: "desafios", valor: soma("challenges") },
  ];

  const abas = [
    {
      id: "fotos",
      rotulo: "Fotos",
      extra: fotos.length ? String(fotos.length) : null,
      conteudo: <FotosAlbum eventoId={id} fotos={fotos} admin={g.admin} />,
    },
    {
      id: "revelacoes",
      rotulo: "Revelações",
      extra: revelacoes.length ? String(revelacoes.length) : null,
      conteudo: revelacoes.length ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-suave">Só aparecem os pares revelados ao vivo — por quem tirou, ou pelo organizador com a autorização da pessoa.</p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {revelacoes.map((r) => (
              <li key={r.id} className="vidro rounded-cartao p-4">
                <ParRevelado de={r.de} para={r.para} tamanho={56} />
                <p className="mt-3 text-center text-xs text-suave">
                  {dataHora(r.revealed_at)} · {r.method === "presenter" ? "pelo organizador, com autorização" : "revelado pela própria pessoa"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <Vazio icone={<Gift className="size-10" />} titulo="Nenhuma revelação ao vivo" texto="Quando os participantes revelam no telão, os pares ficam guardados aqui." />
      ),
    },
    {
      id: "mensagens",
      rotulo: "Mensagens",
      extra: recados.length + capsulas.length ? String(recados.length + capsulas.length) : null,
      conteudo: (
        <div className="flex flex-col gap-6">
          {capsulas.length ? (
            <section aria-labelledby="titulo-capsulas">
              <h3 id="titulo-capsulas" className="mb-3 font-titulo text-xl font-semibold">
                Cápsulas do tempo abertas
              </h3>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {capsulas.map((c) => (
                  <li key={c.id} className="vidro-forte rounded-cartao p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Avatar nome={c.autor?.display_name ?? "?"} caminho={c.autor?.avatar_path} tamanho={32} />
                      <p className="text-sm font-semibold">{c.autor?.display_name ?? "Participante"}</p>
                      <Selo cor="esmeralda" className="ml-auto">
                        aberta
                      </Selo>
                    </div>
                    <p className="whitespace-pre-line text-[15px]">{c.body}</p>
                    <p className="mt-2 text-xs text-suave">
                      Escrita em {dataCurta(c.created_at)} · aberta em {dataCurta(c.open_at)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section aria-labelledby="titulo-mural">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 id="titulo-mural" className="font-titulo text-xl font-semibold">
                Recados do mural
              </h3>
              <BotaoLink href={`/grupo/${id}/mural`} variante="vidro" tamanho="p">
                <MessageSquareQuote className="size-4" aria-hidden /> Deixar um recado
              </BotaoLink>
            </div>
            {recados.length ? (
              <ul className="columns-1 gap-3 sm:columns-2 lg:columns-3">
                {recados.map((w, k) => (
                  <li
                    key={w.id}
                    className={cn("mb-3 break-inside-avoid rounded-2xl border border-[var(--vidro-borda)] p-4 shadow-[var(--sombra)]", CORES_RECADO[w.color] ?? CORES_RECADO.neve)}
                    style={{ transform: `rotate(${((k % 5) - 2) * 0.5}deg)` }}
                  >
                    <p className="whitespace-pre-line text-[15px]">{w.body}</p>
                    <p className="mt-2 flex items-center gap-2 text-xs text-suave">
                      <Avatar nome={w.autor?.display_name ?? "?"} caminho={w.autor?.avatar_path} tamanho={20} />
                      {w.autor?.display_name ?? "Participante"} · {relativo(w.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio titulo="Nenhum recado ainda" texto="Que tal deixar o primeiro?" />
            )}
          </section>
        </div>
      ),
    },
    {
      id: "linha",
      rotulo: "Linha do tempo",
      conteudo: (
        <Cartao>
          <LinhaDoTempo registros={registros} />
        </Cartao>
      ),
    },
    {
      id: "cartoes",
      rotulo: "Cartões",
      extra: cartoes.length ? String(cartoes.length) : null,
      conteudo: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-suave">Os cartões que você recebeu. Só você vê os seus.</p>
            <BotaoLink href={`/grupo/${id}/jogos/cartoes`} variante="vidro" tamanho="p">
              <Mail className="size-4" aria-hidden /> Mandar um cartão
            </BotaoLink>
          </div>
          {cartoes.length ? (
            <CartoesDoAlbum
              para={eu?.nome ?? "você"}
              cartoes={cartoes.map((c) => ({
                id: c.id,
                modelo: c.template,
                titulo: c.title,
                texto: c.body,
                de: c.anonymous ? "Seu amigo oculto" : (c.sender_name ?? "Alguém"),
                quando: c.created_at,
              }))}
            />
          ) : (
            <Vazio icone={<Mail className="size-10" />} titulo="Nenhum cartão recebido" texto="Os cartões que chegarem para você ficam guardados aqui." />
          )}
        </div>
      ),
    },
    {
      id: "retrospectiva",
      rotulo: "Retrospectiva",
      conteudo: (
        <Retrospectiva
          dados={{
            evento: { nome: g.evento.name, data: dataEvento },
            pessoas: pessoas.map((p) => ({ id: p.id, nome: p.nome, avatar: p.avatar })),
            numeros,
            recados: recados.slice(0, 3).map((w) => ({ texto: w.body, autor: w.autor?.display_name ?? "Participante" })),
            fotos: fotos.filter((f) => f.url).slice(0, 6).map((f) => f.url!),
            revelacoes: revelacoes.map((r) => ({ de: { nome: r.de.nome, avatar: r.de.avatar }, para: { nome: r.para.nome, avatar: r.para.avatar } })),
            destaques: estat.slice(0, 3).map((e) => ({ nome: e.display_name, avatar: e.avatar_path, pontos: e.points })),
          }}
        />
      ),
    },
    {
      id: "lembranca",
      rotulo: "Lembrança",
      conteudo: (
        <Lembranca
          dados={{
            evento: g.evento.name,
            data: dataEvento ? new Date(dataEvento).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" }) : null,
            tema: g.evento.theme,
            para: eu?.nome ?? "você",
            numeros: numeros.slice(0, 4),
            nomes: pessoas.map((p) => p.nome),
            revelacoes: revelacoes.map((r) => ({ de: r.de.nome, para: r.para.nome })),
          }}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="vidro-forte relative overflow-hidden rounded-cartao p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 size-44 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--t3)_45%,transparent),transparent_70%)]" />
        <div className="relative flex items-start gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_75%,black))] text-white shadow-md">
            <Images className="size-6" aria-hidden />
          </span>
          <div>
            <h2 className="font-titulo text-2xl font-semibold sm:text-3xl">Álbum de memórias</h2>
            <p className="mt-1 max-w-2xl text-sm text-suave sm:text-[15px]">
              Fotos, revelações, recados e a história de {g.evento.name}. Privado: só quem participa vê.
            </p>
          </div>
        </div>
      </section>
      <AbasAlbum abas={abas} inicial={secao} />
    </div>
  );
}
