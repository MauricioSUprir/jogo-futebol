import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Brain,
  Dices,
  Feather,
  Grid3x3,
  Hourglass,
  Lightbulb,
  Mail,
  Search,
  Trophy,
  Vote,
  type LucideIcon,
} from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { conquistasDe, lerEstatisticas, posicoes } from "@/lib/conquistas";
import { Selo } from "@/components/ui/cartao";
import { AvisoSigilo } from "@/components/jogos/topo-jogo";
import { cn } from "@/lib/cn";

export const metadata = { title: "Jogos e interações" };

type CartaoJogo = {
  href: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  estado?: ReactNode;
  bloqueado?: string | null;
  destaque?: boolean;
};

export default async function CentralDeJogos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const sorteado = g.evento.status !== "open";
  const base = `/grupo/${id}`;

  const [bingo, capsulas, quiz, pendente, palpite, estat] = await Promise.all([
    supabase.from("bingo_games").select("status").eq("event_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.rpc("capsule_summary", { p_event: id }),
    supabase.rpc("quiz_list", { p_event: id }),
    supabase.from("challenge_spins").select("id").eq("participant_id", g.eu.id).eq("status", "pending").limit(1),
    sorteado ? supabase.rpc("my_guess", { p_event: id }) : Promise.resolve({ data: null }),
    supabase.rpc("participation_stats", { p_event: id }),
  ]);

  const lista = lerEstatisticas(estat.data);
  const minhaPos = lista.findIndex((e) => e.participant_id === g.eu.id);
  const eu = minhaPos >= 0 ? lista[minhaPos] : null;
  const pos = posicoes(lista);
  const medalhas = eu ? conquistasDe(eu).length : 0;

  const perguntas = (quiz.data ?? []) as { mine: boolean; my_choice: number | null }[];
  const paraResponder = perguntas.filter((q) => !q.mine && q.my_choice === null).length;
  const cap = (capsulas.data ?? {}) as { sealed?: number; opened?: number };
  const meuPalpite = (palpite.data ?? null) as { guessed_id?: string | null; correct?: boolean | null } | null;
  const estadoBingo = bingo.data?.status;

  const cartoes: CartaoJogo[] = [
    {
      href: `${base}/jogos/adivinhar`,
      titulo: "Adivinhe quem te tirou",
      descricao: "Dê o seu palpite. No fim do amigo oculto você descobre se acertou.",
      icone: Search,
      bloqueado: sorteado ? null : "Depois do sorteio",
      estado:
        g.evento.status === "finished" && meuPalpite?.correct != null
          ? meuPalpite.correct
            ? <Selo cor="esmeralda">Você acertou!</Selo>
            : <Selo>Não foi dessa vez</Selo>
          : meuPalpite?.guessed_id
            ? <Selo cor="esmeralda">Palpite dado</Selo>
            : sorteado
              ? <Selo cor="ouro">Faça o seu palpite</Selo>
              : null,
      destaque: sorteado && !meuPalpite?.guessed_id && g.evento.status === "drawn",
    },
    {
      href: `${base}/jogos/quiz`,
      titulo: "Quiz dos participantes",
      descricao: "Cada um cria perguntas sobre si. Quem conhece melhor a turma?",
      icone: Brain,
      estado: paraResponder ? <Selo cor="t1">{paraResponder} para responder</Selo> : perguntas.length ? <Selo>{perguntas.length} perguntas</Selo> : null,
      destaque: paraResponder > 0,
    },
    {
      href: `${base}/mensagens?tipo=pista`,
      titulo: "Pistas misteriosas",
      descricao: "Mande pistas anônimas para quem você tirou e deixe a curiosidade crescer.",
      icone: Lightbulb,
      bloqueado: sorteado ? null : "Depois do sorteio",
    },
    {
      href: `${base}/enquetes?categoria=presente`,
      titulo: "Enquetes de presentes",
      descricao: "Vote em ideias de presente e descubra o gosto da turma.",
      icone: Vote,
    },
    {
      href: `${base}/jogos/roleta`,
      titulo: "Roleta de desafios",
      descricao: "Desafios leves e opcionais para animar o encontro. Pule quando quiser.",
      icone: Dices,
      estado: pendente.data?.length ? <Selo cor="ouro">Desafio em aberto</Selo> : null,
    },
    {
      href: `${base}/jogos/bingo`,
      titulo: "Bingo natalino",
      descricao: "Cartelas com 24 itens festivos. Complete uma linha e grite BINGO!",
      icone: Grid3x3,
      estado:
        estadoBingo === "running" ? <Selo cor="rubi">Rodando agora</Selo> : estadoBingo === "waiting" ? <Selo cor="ouro">Pegue a cartela</Selo> : null,
      destaque: estadoBingo === "running" || estadoBingo === "waiting",
    },
    {
      href: `${base}/jogos/capsula`,
      titulo: "Cápsula do tempo",
      descricao: "Escreva uma mensagem que só abre no futuro: no próximo Natal ou daqui a um ano.",
      icone: Hourglass,
      estado: cap.sealed ? <Selo>{cap.sealed} lacrada{cap.sealed === 1 ? "" : "s"}</Selo> : cap.opened ? <Selo cor="esmeralda">{cap.opened} aberta{cap.opened === 1 ? "" : "s"}</Selo> : null,
    },
    {
      href: `${base}/mural`,
      titulo: "Mural de mensagens",
      descricao: "Recados, votos e lembranças para todo o grupo ver.",
      icone: Feather,
    },
    {
      href: `${base}/jogos/cartoes`,
      titulo: "Cartões virtuais",
      descricao: "Monte um cartão lindo e mande para alguém do grupo — até em segredo para quem você tirou.",
      icone: Mail,
    },
    {
      href: `${base}/jogos/ranking`,
      titulo: "Ranking e conquistas",
      descricao: "Pontos por participar e medalhas para colecionar.",
      icone: Trophy,
      estado: eu ? <Selo cor="ouro">{eu.points} pontos</Selo> : null,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section className="vidro-forte relative overflow-hidden rounded-cartao p-5 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-44 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--t3)_45%,transparent),transparent_70%)]" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-titulo text-2xl font-semibold sm:text-3xl">Jogos e interações</h2>
            <p className="mt-1 max-w-xl text-sm text-suave sm:text-[15px]">
              Brincadeiras para a espera ficar ainda mais divertida. Cada participação vale pontos e medalhas.
            </p>
          </div>
          {eu ? (
            <Link
              href={`${base}/jogos/ranking`}
              className="vidro flex shrink-0 items-center gap-4 rounded-2xl px-4 py-3 transition hover:-translate-y-0.5"
              aria-label={`Você está em ${pos[minhaPos]}º lugar com ${eu.points} pontos e ${medalhas} medalhas. Ver ranking.`}
            >
              <span className="text-center">
                <span className="block font-titulo text-2xl font-semibold text-t1">{pos[minhaPos]}º</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-suave">lugar</span>
              </span>
              <span className="h-10 w-px bg-borda" aria-hidden />
              <span className="text-center">
                <span className="block font-titulo text-2xl font-semibold">{eu.points}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-suave">pontos</span>
              </span>
              <span className="h-10 w-px bg-borda" aria-hidden />
              <span className="text-center">
                <span className="block font-titulo text-2xl font-semibold text-ouro">{medalhas}</span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-suave">medalhas</span>
              </span>
            </Link>
          ) : null}
        </div>
      </section>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cartoes.map((c) => {
          const Icone = c.icone;
          const conteudo = (
            <>
              <span
                className={cn(
                  "inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md",
                  c.bloqueado
                    ? "bg-black/25 dark:bg-white/15"
                    : "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_75%,black))]",
                )}
              >
                <Icone className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-titulo text-lg font-semibold leading-tight">{c.titulo}</span>
                </span>
                <span className="mt-1 block text-sm text-suave">{c.descricao}</span>
                <span className="mt-3 flex flex-wrap items-center gap-2">
                  {c.bloqueado ? <Selo>{c.bloqueado}</Selo> : c.estado}
                  {!c.bloqueado ? (
                    <span className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-t1">
                      Abrir <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  ) : null}
                </span>
              </span>
            </>
          );
          return (
            <li key={c.href}>
              {c.bloqueado ? (
                <div className="vidro flex h-full items-start gap-4 rounded-cartao p-5 opacity-75" aria-disabled>
                  {conteudo}
                </div>
              ) : (
                <Link
                  href={c.href}
                  className={cn(
                    "vidro group flex h-full items-start gap-4 rounded-cartao p-5 transition hover:-translate-y-0.5 hover:shadow-brilho",
                    c.destaque && "ring-2 ring-[color-mix(in_oklab,var(--t3)_70%,transparent)]",
                  )}
                >
                  {conteudo}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      <AvisoSigilo />
    </div>
  );
}
