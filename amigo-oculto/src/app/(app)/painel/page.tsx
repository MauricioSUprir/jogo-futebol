import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronRight, PartyPopper } from "lucide-react";
import { exigirUsuario, perfilAtual } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Cartao } from "@/components/ui/cartao";
import { CartaoGrupo, LinhaGrupo } from "@/components/painel/cartao-grupo";
import {
  BoasVindas,
  CartaoConta,
  CartaoDesejos,
  CartaoMensagens,
  CartaoNotificacoes,
  Saudacao,
  SecaoConvites,
  SecaoProximos,
  TituloSecao,
  type ConvitePendente,
  type NotificacaoResumo,
} from "@/components/painel/secoes";
import {
  alertasDaParticipacao,
  classificarParticipacoes,
  primeiroNome,
  saudacao,
  type Participacao,
} from "@/components/painel/dados";
import { TIPOS_MENSAGEM } from "@/components/notificacoes/tipos";

export const metadata: Metadata = { title: "Meu painel" };

export default async function Painel() {
  const usuario = await exigirUsuario("/painel");
  const perfil = await perfilAtual();
  const supabase = await clienteServidor();
  const colunasNotificacao = "id, kind, title, body, link, created_at, read_at";

  const [participacoes, convites, desejos, preferencias, mensagens, naoLidas] = await Promise.all([
    supabase.from("participants").select("*, evento:events(*)").eq("user_id", usuario.id).order("created_at", { ascending: false }),
    usuario.is_anonymous ? Promise.resolve({ data: [] }) : supabase.rpc("my_pending_invites"),
    supabase.from("wishlist_items").select("id", { count: "exact", head: true }).eq("user_id", usuario.id),
    supabase.from("gift_preferences").select("hobbies, interests, favorite_colors, shirt_size, dislikes, notes").eq("user_id", usuario.id).maybeSingle(),
    supabase
      .from("notifications")
      .select(colunasNotificacao)
      .eq("user_id", usuario.id)
      .in("kind", [...TIPOS_MENSAGEM])
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("notifications")
      .select(colunasNotificacao, { count: "exact" })
      .eq("user_id", usuario.id)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const agora = Date.now();
  const lista = (participacoes.data ?? []).filter((p): p is Participacao => !!p.evento);
  const { ativos, proximos, concluidos, pendentes } = classificarParticipacoes(lista, agora);

  // quantas pessoas em cada grupo ativo e quais estão com a revelação ao vivo agora
  const idsAtivos = ativos.map((p) => p.evento.id);
  const [{ data: aprovados }, { data: aoVivo }] = idsAtivos.length
    ? await Promise.all([
        supabase.from("participants").select("event_id").in("event_id", idsAtivos).eq("status", "approved"),
        supabase.from("live_sessions").select("event_id").in("event_id", idsAtivos).eq("status", "running"),
      ])
    : [{ data: [] as { event_id: string }[] }, { data: [] as { event_id: string }[] }];
  const contagem = new Map<string, number>();
  for (const a of aprovados ?? []) contagem.set(a.event_id, (contagem.get(a.event_id) ?? 0) + 1);
  const aoVivoAgora = new Set((aoVivo ?? []).map((l) => l.event_id));

  const listaConvites = (Array.isArray(convites.data) ? convites.data : []) as unknown as ConvitePendente[];
  const prefs = preferencias.data;
  const preferenciasVazias =
    !prefs || (!prefs.hobbies.length && !prefs.interests.length && !prefs.favorite_colors.length && !prefs.shirt_size && !prefs.dislikes.length && !prefs.notes);
  const totalDesejos = desejos.count ?? 0;
  const naoLidasLista = (naoLidas.data ?? []) as NotificacaoResumo[];
  const totalNaoLidas = naoLidas.count ?? naoLidasLista.length;

  const pendenciasVer = ativos.filter((p) => alertasDaParticipacao(p, agora).some((a) => a.tipo === "ver")).length;
  const resumo = !lista.length
    ? "Que bom ter você aqui. Vamos começar a sua primeira troca de presentes?"
    : [
        ativos.length ? `Você está em ${ativos.length} amigo${ativos.length === 1 ? "" : "s"} oculto${ativos.length === 1 ? "" : "s"} em andamento.` : "Nenhum amigo oculto em andamento agora.",
        pendenciasVer ? `${pendenciasVer === 1 ? "Um presente espera" : `${pendenciasVer} presentes esperam`} você abrir!` : "",
      ]
        .filter(Boolean)
        .join(" ");
  const novato = !lista.length && !listaConvites.length;

  return (
    <div className="flex flex-col gap-6">
      <Saudacao
        saudacao={saudacao(new Date(agora))}
        nome={primeiroNome(perfil?.display_name, perfil?.nickname)}
        convidado={!!usuario.is_anonymous}
        resumo={resumo}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-7 lg:col-span-2">
          <SecaoConvites convites={listaConvites} pedidos={pendentes} />

          {novato ? <BoasVindas convidado={!!usuario.is_anonymous} /> : null}

          <SecaoProximos proximos={proximos} agora={agora} />

          {ativos.length ? (
            <section aria-labelledby="sec-ativos">
              <TituloSecao id="sec-ativos" icone={<PartyPopper className="size-5" />}>
                Meus amigos ocultos
              </TituloSecao>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {ativos.map((p) => (
                  <CartaoGrupo
                    key={p.id}
                    p={p}
                    usuarioId={usuario.id}
                    participantes={contagem.get(p.evento.id)}
                    aoVivo={aoVivoAgora.has(p.evento.id)}
                    agora={agora}
                  />
                ))}
              </div>
            </section>
          ) : lista.length ? (
            <Cartao className="text-sm text-suave">
              Nenhum amigo oculto em andamento. Crie um novo grupo ou entre com o código de um convite.
            </Cartao>
          ) : null}

          {concluidos.length ? (
            <section aria-labelledby="sec-concluidos">
              <TituloSecao
                id="sec-concluidos"
                icone={<Archive className="size-5" />}
                acao={
                  <Link href="/painel/historico" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-t1">
                    Histórico completo <ChevronRight className="size-4" aria-hidden />
                  </Link>
                }
              >
                Concluídos e arquivados
              </TituloSecao>
              <Cartao className="p-2 sm:p-3">
                <ul className="flex flex-col">
                  {concluidos.slice(0, 4).map((p) => (
                    <LinhaGrupo key={p.id} p={p} usuarioId={usuario.id} />
                  ))}
                </ul>
              </Cartao>
            </section>
          ) : null}
        </div>

        <aside className="flex min-w-0 flex-col gap-4" aria-label="Resumo da conta">
          <CartaoDesejos quantidade={totalDesejos} preferenciasVazias={preferenciasVazias} />
          <CartaoMensagens mensagens={(mensagens.data ?? []) as NotificacaoResumo[]} />
          <CartaoNotificacoes notificacoes={naoLidasLista} total={totalNaoLidas} />
          <CartaoConta />
        </aside>
      </div>
    </div>
  );
}
