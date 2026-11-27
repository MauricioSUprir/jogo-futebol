import Link from "next/link";
import {
  Archive,
  ArrowRight,
  CalendarClock,
  CalendarHeart,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Eye,
  Gamepad2,
  Gift,
  Hourglass,
  Info,
  MapPin,
  Megaphone,
  MessagesSquare,
  PartyPopper,
  Pin,
  ShoppingBag,
  Sparkles,
  Timer,
  Users,
  VenetianMask,
  Vote,
  Wallet,
} from "lucide-react";
import { carregarGrupo } from "@/lib/servidor/grupo";
import { clienteServidor } from "@/lib/supabase/servidor";
import { dataHora, faixaDePreco, relativo } from "@/lib/formatos";
import { Cartao, Selo, TituloCartao } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { Avatar } from "@/components/ui/avatar";
import { AtualizarAoVivo } from "@/components/sala/ao-vivo";
import { ConfirmarPresenca, JaComprei } from "@/components/sala/presenca";
import { BarraProgresso } from "@/components/sala/indicadores";
import { carregarMembros } from "@/components/sala/dados";

export default async function VisaoGeral({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await carregarGrupo(id);
  const supabase = await clienteServidor();
  const [membros, { data: avisos }] = await Promise.all([
    carregarMembros(id),
    supabase
      .from("announcements")
      .select("id, title, body, pinned, created_at")
      .eq("event_id", id)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  const ev = g.evento;
  const sorteado = ev.status !== "open";
  const encerrado = ev.status === "finished";
  const arquivado = !!ev.archived_at;
  const total = membros.length;
  const conta = {
    sim: membros.filter((m) => m.rsvp === "yes").length,
    talvez: membros.filter((m) => m.rsvp === "maybe").length,
    nao: membros.filter((m) => m.rsvp === "no").length,
    viram: membros.filter((m) => m.viuEm).length,
    compraram: membros.filter((m) => m.comprou).length,
  };
  const base = `/grupo/${id}`;
  const preco = faixaDePreco(ev.gift_min, ev.gift_max);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <AtualizarAoVivo
        canal={`sala-geral:${id}`}
        assinaturas={[
          { tabela: "participants", filtro: `event_id=eq.${id}` },
          { tabela: "events", filtro: `id=eq.${id}` },
          { tabela: "announcements", filtro: `event_id=eq.${id}` },
          { tabela: "announcements", evento: "DELETE", campo: "id", valores: (avisos ?? []).map((a) => a.id) },
        ]}
      />
      <div className="flex flex-col gap-5 lg:col-span-2">
        {/* ------------------------------------------------ status do sorteio */}
        <StatusDoSorteio
          base={base}
          admin={g.admin}
          status={ev.status}
          arquivado={arquivado}
          manual={ev.draw_mode === "manual"}
          drawAt={ev.draw_at}
          drawnAt={ev.drawn_at}
          revealAt={ev.reveal_at}
          viu={!!g.eu.result_viewed_at}
          total={total}
        />

        {/* ------------------------------------------------ presença e presente */}
        <Cartao>
          <TituloCartao
            icone={<CalendarHeart className="size-5" aria-hidden />}
            titulo="Você vai à confraternização?"
            descricao={
              ev.reveal_at ? `A troca de presentes é ${dataHora(ev.reveal_at, { weekday: "long" })}.` : "Confirme para o organizador se planejar."
            }
          />
          <ConfirmarPresenca
            eventoId={id}
            inicial={g.eu.rsvp}
            bloqueado={encerrado || arquivado}
            motivoBloqueio={encerrado ? "O amigo oculto já foi encerrado." : arquivado ? "O grupo está arquivado." : undefined}
          />
          {sorteado ? (
            <div className="mt-4">
              <JaComprei eventoId={id} inicial={g.eu.gift_bought} bloqueado={arquivado} />
            </div>
          ) : null}
        </Cartao>

        {/* ------------------------------------------------ indicadores */}
        <Cartao>
          <TituloCartao
            icone={<Sparkles className="size-5" aria-hidden />}
            titulo="Como está o grupo"
            descricao="Atualiza sozinho. Ninguém vê quem tirou quem — só o andamento."
          />
          <div className="flex flex-col gap-5">
            <BarraProgresso
              rotulo="Confirmaram presença"
              icone={<CheckCheck className="size-4" aria-hidden />}
              valor={conta.sim}
              total={total}
              cor="esmeralda"
              detalhe={
                conta.talvez || conta.nao
                  ? [conta.talvez ? `${conta.talvez} talvez` : null, conta.nao ? `${conta.nao} não ${conta.nao === 1 ? "vai" : "vão"}` : null]
                      .filter(Boolean)
                      .join(" · ")
                  : total - conta.sim > 0
                    ? `${total - conta.sim} ainda não ${total - conta.sim === 1 ? "respondeu" : "responderam"}`
                    : undefined
              }
            />
            {sorteado ? (
              <>
                <BarraProgresso
                  rotulo="Já viram quem tiraram"
                  icone={<Eye className="size-4" aria-hidden />}
                  valor={conta.viram}
                  total={total}
                />
                <BarraProgresso
                  rotulo="Já compraram o presente"
                  icone={<ShoppingBag className="size-4" aria-hidden />}
                  valor={conta.compraram}
                  total={total}
                  cor="ouro"
                />
              </>
            ) : (
              <p className="flex items-start gap-2 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-suave dark:bg-white/[0.04]">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
                Depois do sorteio aparecem aqui quantos já viram quem tiraram e quantos já compraram o presente.
              </p>
            )}
          </div>
        </Cartao>

        {/* ------------------------------------------------ avisos */}
        <Cartao>
          <TituloCartao
            icone={<Megaphone className="size-5" aria-hidden />}
            titulo="Últimos avisos"
            acao={
              <Link href={`${base}/mural`} className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm font-semibold text-t1 hover:underline">
                Ver mural <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
          />
          {avisos?.length ? (
            <ul className="flex flex-col gap-3">
              {avisos.map((a) => (
                <li key={a.id} className="rounded-2xl border border-borda bg-white/40 px-4 py-3 dark:bg-white/[0.03]">
                  <div className="flex items-start gap-2">
                    {a.pinned ? <Pin className="mt-1 size-4 shrink-0 text-ouro" aria-label="Fixado" /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{a.title}</p>
                      {a.body ? <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-suave">{a.body}</p> : null}
                      <p className="mt-1 text-xs text-suave">{relativo(a.created_at)}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">
              Nenhum aviso do organizador por enquanto.
              {g.admin ? (
                <>
                  {" "}
                  <Link href={`${base}/admin#avisos`} className="font-semibold text-t1 underline underline-offset-4">
                    Publicar um aviso
                  </Link>
                </>
              ) : null}
            </p>
          )}
        </Cartao>
      </div>

      <div className="flex flex-col gap-5">
        {/* ------------------------------------------------ informações e regras */}
        <Cartao>
          <TituloCartao icone={<ClipboardList className="size-5" aria-hidden />} titulo="Informações e regras" />
          {ev.description ? <p className="mb-4 whitespace-pre-line text-[15px] leading-relaxed">{ev.description}</p> : null}
          <dl className="flex flex-col gap-3 text-sm">
            <Info2 icone={<Wallet className="size-4" aria-hidden />} rotulo="Valor do presente" valor={preco ?? "Sem valor definido"} />
            {ev.location ? <Info2 icone={<MapPin className="size-4" aria-hidden />} rotulo="Local" valor={ev.location} /> : null}
            <Info2
              icone={<PartyPopper className="size-4" aria-hidden />}
              rotulo="Revelação e troca de presentes"
              valor={ev.reveal_at ? dataHora(ev.reveal_at, { weekday: "long" }) : "A combinar"}
            />
            <Info2
              icone={<CalendarClock className="size-4" aria-hidden />}
              rotulo="Sorteio"
              valor={
                ev.drawn_at
                  ? `Realizado em ${dataHora(ev.drawn_at)}`
                  : ev.draw_mode === "scheduled" && ev.draw_at
                    ? `Automático em ${dataHora(ev.draw_at)}`
                    : "Feito pelo organizador"
              }
            />
            {ev.join_deadline ? (
              <Info2
                icone={<Timer className="size-4" aria-hidden />}
                rotulo="Prazo para entrar"
                valor={`${dataHora(ev.join_deadline)}${new Date(ev.join_deadline) < new Date() ? " (encerrado)" : ""}`}
              />
            ) : null}
          </dl>
          {ev.rules ? (
            <div className="mt-4 rounded-2xl border border-borda bg-[color-mix(in_oklab,var(--t3)_8%,transparent)] px-4 py-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-suave">Regras do grupo</p>
              <p className="whitespace-pre-line text-[15px] leading-relaxed">{ev.rules}</p>
            </div>
          ) : null}
        </Cartao>

        {/* ------------------------------------------------ quem participa */}
        <Cartao>
          <TituloCartao
            icone={<Users className="size-5" aria-hidden />}
            titulo="Quem participa"
            descricao={`${total} pessoa${total === 1 ? "" : "s"} no grupo`}
          />
          <ul className="flex flex-wrap gap-2" aria-label="Participantes">
            {membros.slice(0, 15).map((m) => (
              <li key={m.participanteId}>
                <Link href={`${base}/participantes/${m.participanteId}`} className="block rounded-full" title={m.nome}>
                  <Avatar nome={m.nome} caminho={m.avatar} tamanho={40} anel={m.usuarioId === g.usuario.id} />
                </Link>
              </li>
            ))}
            {total > 15 ? (
              <li className="inline-flex size-10 items-center justify-center rounded-full bg-black/5 text-xs font-bold text-suave dark:bg-white/10">
                +{total - 15}
              </li>
            ) : null}
          </ul>
          <BotaoLink href={`${base}/participantes`} variante="vidro" tamanho="p" className="mt-4 w-full">
            Ver participantes e listas de desejos
          </BotaoLink>
        </Cartao>

        {/* ------------------------------------------------ atalhos */}
        <nav aria-label="Atalhos do grupo">
          <ul className="grid grid-cols-2 gap-3">
            <Atalho href="/lista-de-desejos" icone={<Gift className="size-5" aria-hidden />} texto="Minha lista de desejos" />
            <Atalho href={`${base}/chat`} icone={<MessagesSquare className="size-5" aria-hidden />} texto="Chat do grupo" />
            {sorteado ? (
              <Atalho href={`${base}/mensagens`} icone={<VenetianMask className="size-5" aria-hidden />} texto="Mensagens anônimas" />
            ) : (
              <Atalho href={`${base}/enquetes`} icone={<Vote className="size-5" aria-hidden />} texto="Enquetes" />
            )}
            <Atalho href={`${base}/jogos`} icone={<Gamepad2 className="size-5" aria-hidden />} texto="Jogos" />
          </ul>
        </nav>
      </div>
    </div>
  );
}

function Info2({ icone, rotulo, valor }: { icone: React.ReactNode; rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--t1)_10%,transparent)] text-t1">
        {icone}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wider text-suave">{rotulo}</dt>
        <dd className="font-medium">{valor}</dd>
      </div>
    </div>
  );
}

function Atalho({ href, icone, texto }: { href: string; icone: React.ReactNode; texto: string }) {
  return (
    <li>
      <Link
        href={href}
        className="vidro flex h-full min-h-24 flex-col justify-between gap-3 rounded-cartao p-4 text-sm font-semibold transition hover:-translate-y-0.5"
      >
        <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1">
          {icone}
        </span>
        <span className="flex items-end justify-between gap-2">
          {texto} <ArrowRight className="size-4 shrink-0 text-suave" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

function StatusDoSorteio({
  base,
  admin,
  status,
  arquivado,
  manual,
  drawAt,
  drawnAt,
  revealAt,
  viu,
  total,
}: {
  base: string;
  admin: boolean;
  status: "open" | "drawn" | "finished";
  arquivado: boolean;
  manual: boolean;
  drawAt: string | null;
  drawnAt: string | null;
  revealAt: string | null;
  viu: boolean;
  total: number;
}) {
  const faixa = "fita-ouro absolute inset-x-0 top-0 h-1";
  if (status === "open") {
    const agendado = !manual && drawAt;
    return (
      <Cartao forte className="relative overflow-hidden">
        <div aria-hidden className={faixa} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-3xl bg-[color-mix(in_oklab,var(--t3)_18%,transparent)] text-ouro-escuro dark:text-ouro-claro">
            {agendado ? <CalendarClock className="size-7" aria-hidden /> : <Hourglass className="size-7" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <Selo cor="ouro">{agendado ? "Sorteio agendado" : "Sorteio pelo organizador"}</Selo>
            <h2 className="mt-1.5 font-titulo text-xl font-semibold sm:text-2xl">
              {agendado ? `O sorteio acontece ${relativo(drawAt!)}` : "Aguardando o organizador sortear"}
            </h2>
            <p className="mt-1 text-sm text-suave">
              {agendado
                ? `Automaticamente em ${dataHora(drawAt!, { weekday: "long" })}. Você recebe uma notificação na hora.`
                : `Assim que todo mundo entrar, o organizador faz o sorteio e você recebe uma notificação. ${total} no grupo${total < 3 ? " — são precisos pelo menos 3" : ""}.`}
            </p>
            {arquivado ? <p className="mt-2 text-sm font-semibold text-rubi">Este grupo está arquivado.</p> : null}
          </div>
          {admin && !arquivado ? (
            <BotaoLink href={`${base}/admin`} variante="primario" className="shrink-0">
              {agendado ? "Organizar" : "Ir para o sorteio"} <ArrowRight className="size-4" aria-hidden />
            </BotaoLink>
          ) : null}
        </div>
      </Cartao>
    );
  }
  if (status === "finished") {
    return (
      <Cartao forte className="relative overflow-hidden">
        <div aria-hidden className={faixa} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex size-14 shrink-0 items-center justify-center rounded-3xl bg-black/5 text-suave dark:bg-white/10">
            {arquivado ? <Archive className="size-7" aria-hidden /> : <PartyPopper className="size-7" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            <Selo>{arquivado ? "Arquivado" : "Encerrado"}</Selo>
            <h2 className="mt-1.5 font-titulo text-xl font-semibold sm:text-2xl">Este amigo oculto foi encerrado</h2>
            <p className="mt-1 text-sm text-suave">Obrigado por participar! As lembranças ficam guardadas aqui.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <BotaoLink href={`${base}/revelacao`} variante="vidro">
              Quem eu tirei
            </BotaoLink>
            <BotaoLink href={`${base}/album`} variante="primario">
              Ver o álbum
            </BotaoLink>
          </div>
        </div>
      </Cartao>
    );
  }
  // sorteado
  return (
    <Cartao forte className="relative overflow-hidden">
      <div aria-hidden className={faixa} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="flutuar inline-flex size-16 shrink-0 items-center justify-center rounded-3xl bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_60%,black))] text-white shadow-brilho">
          <Gift className="size-8" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Selo cor="esmeralda">Sorteio realizado{drawnAt ? ` ${relativo(drawnAt)}` : ""}</Selo>
          <h2 className="mt-1.5 font-titulo text-xl font-semibold sm:text-2xl">
            {viu ? "Você já sabe quem tirou" : "Seu amigo oculto está esperando!"}
          </h2>
          <p className="mt-1 text-sm text-suave">
            {viu
              ? `Agora é caprichar no presente${revealAt ? ` até ${dataHora(revealAt)}` : ""}. Tire dúvidas pelas mensagens anônimas.`
              : "Só você vai ver quem tirou — nem o organizador sabe."}
          </p>
        </div>
        {viu ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            <BotaoLink href={`${base}/revelacao`} variante="vidro">
              Ver de novo
            </BotaoLink>
            <BotaoLink href={`${base}/mensagens`} variante="primario">
              <VenetianMask className="size-4" aria-hidden /> Mensagens
            </BotaoLink>
          </div>
        ) : (
          <BotaoLink href={`${base}/revelacao`} variante="ouro" tamanho="g" brilho className="shrink-0">
            <Gift className="size-5" aria-hidden /> Descobrir quem eu tirei
          </BotaoLink>
        )}
      </div>
    </Cartao>
  );
}
