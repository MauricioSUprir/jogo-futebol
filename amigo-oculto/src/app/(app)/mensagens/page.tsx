import Link from "next/link";
import { ChevronRight, Hourglass, Inbox, LockKeyhole, ShieldCheck, VenetianMask } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { carregarConversas } from "@/lib/acoes/mensagens";
import { relativo } from "@/lib/formatos";
import { Selo, Vazio } from "@/components/ui/cartao";
import { BotaoLink } from "@/components/ui/botao";
import { AtualizarAoVivo } from "@/components/sala/ao-vivo";
import { naoLidas, type MensagemAnonima } from "@/components/mensagens/tipos";
import { cn } from "@/lib/cn";

export const metadata = { title: "Mensagens anônimas" };

type Ev = { id: string; name: string; status: "open" | "drawn" | "finished"; theme: string; archived_at: string | null; draw_at: string | null; draw_mode: string };

function ultima(l: MensagemAnonima[] | undefined) {
  return l?.length ? l[l.length - 1] : null;
}

export default async function CaixaGeral() {
  const usuario = await exigirUsuario("/mensagens");
  const supabase = await clienteServidor();
  const { data: minhas } = await supabase.from("participants").select("event_id").eq("user_id", usuario.id).eq("status", "approved");
  const ids = (minhas ?? []).map((p) => p.event_id);
  const { data } = ids.length
    ? await supabase.from("events").select("id, name, status, theme, archived_at, draw_at, draw_mode").in("id", ids)
    : { data: [] as Ev[] };
  const eventos = (data ?? []) as Ev[];
  const sorteados = eventos.filter((e) => e.status !== "open");
  const abertos = eventos.filter((e) => e.status === "open" && !e.archived_at);

  const conversas = await Promise.all(
    sorteados.map(async (e) => {
      const r = await carregarConversas(e.id);
      const c = r.ok && r.dados?.disponivel ? r.dados : null;
      const novasDele = c ? naoLidas(c.paraQuemTirei.mensagens) : 0;
      const novasDoSanta = c ? naoLidas(c.deQuemMeTirou?.mensagens) : 0;
      const ultimas = [
        c ? ultima(c.paraQuemTirei.mensagens) : null,
        c ? ultima(c.deQuemMeTirou?.mensagens) : null,
      ].filter(Boolean) as MensagemAnonima[];
      const recente = ultimas.sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))[0] ?? null;
      return { e, c, novasDele, novasDoSanta, recente, total: (c?.paraQuemTirei.mensagens.length ?? 0) + (c?.deQuemMeTirou?.mensagens.length ?? 0) };
    }),
  );
  conversas.sort(
    (a, b) =>
      b.novasDele + b.novasDoSanta - (a.novasDele + a.novasDoSanta) ||
      (b.recente?.criadaEm ?? "").localeCompare(a.recente?.criadaEm ?? "") ||
      a.e.name.localeCompare(b.e.name, "pt-BR"),
  );
  const totalNovas = conversas.reduce((s, x) => s + x.novasDele + x.novasDoSanta, 0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <AtualizarAoVivo canal={`caixa-anonima:${usuario.id}`} assinaturas={[{ tabela: "notifications", evento: "INSERT", filtro: `user_id=eq.${usuario.id}` }]} />
      <header>
        <h1 className="flex items-center gap-2 font-titulo text-3xl font-semibold">
          <VenetianMask className="size-7 text-t1" aria-hidden /> Mensagens anônimas
        </h1>
        <p className="mt-1 text-suave">
          {totalNovas
            ? `Você tem ${totalNovas} mensage${totalNovas === 1 ? "m nova" : "ns novas"}.`
            : "Converse em segredo com quem você tirou e responda a quem tirou você."}
        </p>
      </header>

      <p className="vidro flex items-start gap-3 rounded-cartao px-4 py-3 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-esmeralda" aria-hidden />
        Ninguém — nem o organizador — sabe quem manda as mensagens anônimas.
      </p>

      {conversas.length === 0 ? (
        <Vazio
          icone={<Inbox className="size-9" aria-hidden />}
          titulo="Nenhuma conversa ainda"
          texto="As mensagens anônimas abrem em cada grupo depois do sorteio."
          acao={
            <BotaoLink href="/painel" variante="vidro">
              Ir para os meus grupos
            </BotaoLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {conversas.map(({ e, c, novasDele, novasDoSanta, recente, total }) => {
            const novas = novasDele + novasDoSanta;
            return (
              <li key={e.id} data-tema={e.theme}>
                <Link
                  href={`/grupo/${e.id}/mensagens${novasDoSanta && !novasDele ? "?conversa=santa" : ""}`}
                  className={cn(
                    "vidro group relative flex items-center gap-4 overflow-hidden rounded-cartao p-4 pl-5 transition hover:-translate-y-0.5 sm:p-5 sm:pl-6",
                    novas && "ring-2 ring-[color-mix(in_oklab,var(--t1)_40%,transparent)]",
                  )}
                >
                  <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[linear-gradient(180deg,var(--t1),var(--t2))]" />
                  <span className="relative inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1">
                    <VenetianMask className="size-6" aria-hidden />
                    {novas ? (
                      <span className="absolute -right-1.5 -top-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-rubi px-1 text-[11px] font-bold leading-5 text-white">
                        {novas}
                      </span>
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-titulo text-lg font-semibold">{e.name}</span>
                      {e.status === "finished" ? <Selo>Encerrado</Selo> : null}
                    </p>
                    {c ? (
                      <>
                        <p className="mt-0.5 text-sm text-suave">
                          {novas ? (
                            <strong className="text-texto">
                              {[
                                novasDele ? `${novasDele} de ${c.paraQuemTirei.nome.split(" ")[0]}` : null,
                                novasDoSanta ? `${novasDoSanta} do seu amigo oculto` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </strong>
                          ) : total ? (
                            `${total} mensage${total === 1 ? "m" : "ns"}`
                          ) : (
                            "Nenhuma mensagem ainda — puxe conversa!"
                          )}
                        </p>
                        {recente ? (
                          <p className="mt-0.5 truncate text-sm text-suave">
                            {recente.minha ? "Você: " : ""}
                            {recente.oculta ? "mensagem escondida" : recente.texto} · {relativo(recente.criadaEm)}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-suave">
                        <LockKeyhole className="size-3.5" aria-hidden /> Você não participou deste sorteio.
                      </p>
                    )}
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-suave transition group-hover:translate-x-0.5" aria-hidden />
                  <span className="sr-only">{novas ? `, ${novas} não lida${novas === 1 ? "" : "s"}` : ""}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {abertos.length ? (
        <section aria-labelledby="titulo-abertos" className="mt-2">
          <h2 id="titulo-abertos" className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-suave">
            <Hourglass className="size-4" aria-hidden /> Abrem depois do sorteio
          </h2>
          <ul className="flex flex-col gap-2">
            {abertos.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/grupo/${e.id}`}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-borda px-4 py-2.5 text-sm transition hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                >
                  <span className="truncate font-semibold">{e.name}</span>
                  <span className="shrink-0 text-suave">
                    {e.draw_mode === "scheduled" && e.draw_at ? `sorteio ${relativo(e.draw_at)}` : "aguardando o sorteio"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
