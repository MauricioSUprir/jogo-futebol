"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { CalendarHeart, Gift, Hourglass, Lock, LockOpen, Sparkles, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Cartao, Selo, Vazio } from "@/components/ui/cartao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { Contagem } from "@/components/ui/contagem";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { excluirCapsula, lacrarCapsula } from "@/lib/acoes/jogos";
import { dataHora, deInputLocal, paraInputLocal } from "@/lib/formatos";
import { cn } from "@/lib/cn";

export type Capsula = {
  id: string;
  body: string;
  open_at: string;
  created_at: string;
  mine: boolean;
  autor: string;
  avatar: string | null;
};

const HORA = 3600_000;

/** 25/12 às 10h (São Paulo) do próximo Natal que ainda está a mais de 1 hora. */
function proximoNatal(agora = Date.now()) {
  const ano = Number(new Intl.DateTimeFormat("en", { timeZone: "America/Sao_Paulo", year: "numeric" }).format(agora));
  for (const a of [ano, ano + 1]) {
    const iso = deInputLocal(`${a}-12-25T10:00`)!;
    if (new Date(iso).getTime() > agora + 2 * HORA) return iso;
  }
  return deInputLocal(`${ano + 1}-12-25T10:00`)!;
}

function arredondarHora(ms: number) {
  return new Date(Math.ceil(ms / HORA) * HORA).toISOString();
}

export function CapsulaDoTempo({
  eventoId,
  minhas,
  abertas,
  resumo,
  encontro,
}: {
  eventoId: string;
  minhas: Capsula[];
  abertas: Capsula[];
  resumo: { sealed: number; opened: number; next_open_at: string | null };
  encontro: string | null;
}) {
  const [texto, setTexto] = useState("");
  const [quando, setQuando] = useState("");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();
  const [paraExcluir, setParaExcluir] = useState<Capsula | null>(null);
  const [aberta, setAberta] = useState<Capsula | null>(null);
  const { avisar } = useAvisos();
  const { som, menosMovimento } = usePreferencias();

  const atalhos = useMemo(() => {
    const agora = Date.now();
    const lista = [
      { rotulo: "No próximo Natal", icone: Gift, iso: proximoNatal(agora) },
      { rotulo: "Daqui a 1 ano", icone: CalendarHeart, iso: arredondarHora(agora + 365 * 86400_000) },
      { rotulo: "Daqui a 1 mês", icone: Hourglass, iso: arredondarHora(agora + 30 * 86400_000) },
    ];
    if (encontro && new Date(encontro).getTime() > agora + 2 * HORA) lista.unshift({ rotulo: "No dia do encontro", icone: Sparkles, iso: encontro });
    return lista;
  }, [encontro]);

  // limites calculados só no navegador (o relógio do servidor e o do aparelho não precisam bater na hidratação)
  const [limites, setLimites] = useState<{ minimo?: string; maximo?: string }>({});
  useEffect(() => {
    setLimites({
      minimo: paraInputLocal(new Date(Date.now() + 2 * HORA).toISOString()),
      maximo: paraInputLocal(new Date(Date.now() + 5 * 365 * 86400_000 - 2 * 86400_000).toISOString()),
    });
  }, []);
  const limite = minhas.length >= 5;

  function lacrar(e: React.FormEvent) {
    e.preventDefault();
    const iso = deInputLocal(quando);
    if (!iso) {
      setErros({ abreEm: "Escolha quando a cápsula abre." });
      return;
    }
    iniciar(async () => {
      const r = await lacrarCapsula(eventoId, texto, iso);
      if (r.ok) {
        tocar("sino", som);
        avisar(r.mensagem ?? "Cápsula lacrada!");
        setTexto("");
        setQuando("");
        setErros({});
      } else {
        setErros(r.campos ?? {});
        avisar(r.erro, "erro");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <Cartao forte>
          <form onSubmit={lacrar} className="flex flex-col gap-4" noValidate>
            <h3 className="font-titulo text-xl font-semibold">Escrever para o futuro</h3>
            {limite ? (
              <p className="text-sm text-suave">Você já guardou 5 cápsulas neste grupo — o máximo. Desfaça uma para escrever outra.</p>
            ) : null}
            <AreaTexto
              rotulo="Sua mensagem"
              placeholder="Um recado para o grupo, uma previsão, um desejo… só será lido na data escolhida."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={2000}
              erro={erros.texto}
              disabled={limite}
              className="min-h-36"
              dica={`${texto.length}/2000`}
            />
            <fieldset className="flex min-w-0 flex-col gap-2" disabled={limite}>
              <legend className="mb-1 text-sm font-semibold">Abre em</legend>
              <div className="flex flex-wrap gap-2">
                {atalhos.map((a) => {
                  const ativo = quando === paraInputLocal(a.iso);
                  return (
                    <button
                      key={a.rotulo}
                      type="button"
                      onClick={() => setQuando(paraInputLocal(a.iso))}
                      aria-pressed={ativo}
                      className={cn(
                        "vidro inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-suave transition hover:text-texto",
                        ativo && "bg-[color-mix(in_oklab,var(--t1)_16%,transparent)] text-t1",
                      )}
                    >
                      <a.icone className="size-4" aria-hidden /> {a.rotulo}
                    </button>
                  );
                })}
              </div>
              <Campo
                type="datetime-local"
                aria-label="Data e hora de abertura"
                value={quando}
                min={limites.minimo}
                max={limites.maximo}
                onChange={(e) => setQuando(e.target.value)}
                erro={erros.abreEm}
                dica={quando ? `Abre em ${dataHora(deInputLocal(quando), { year: "numeric" })} (horário de Brasília).` : "Entre 1 hora e 5 anos a partir de agora."}
              />
            </fieldset>
            <Botao type="submit" carregando={pendente} disabled={limite} className="self-start" brilho={!!texto && !!quando}>
              <Lock className="size-4" aria-hidden /> Lacrar cápsula
            </Botao>
            <p className="text-xs text-suave">Depois de lacrada, ninguém lê antes da data — nem você. Dá para desfazer enquanto estiver lacrada.</p>
          </form>
        </Cartao>

        <Cartao>
          <h3 className="mb-3 font-titulo text-lg font-semibold">Minhas cápsulas lacradas</h3>
          {minhas.length ? (
            <ul className="flex flex-col gap-3">
              {minhas.map((c) => (
                <li key={c.id} className="vidro flex flex-col gap-3 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1">
                      <Lock className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">Abre em {dataHora(c.open_at, { year: "numeric" })}</p>
                      <p className="text-xs text-suave">Lacrada em {dataHora(c.created_at)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setParaExcluir(c)}
                      className="inline-flex size-10 items-center justify-center rounded-full text-suave hover:bg-black/5 hover:text-rubi dark:hover:bg-white/10"
                      aria-label="Desfazer esta cápsula"
                      title="Desfazer"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                  <Contagem alvo={c.open_at} compacta />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-suave">Nenhuma ainda. Que tal mandar um recado para o Natal que vem?</p>
          )}
        </Cartao>
      </div>

      <div className="flex flex-col gap-5">
        <Cartao className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="vidro rounded-2xl px-4 py-3 text-center">
            <p className="font-titulo text-3xl font-semibold text-t1">{resumo.sealed}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-suave">lacradas no grupo</p>
          </div>
          <div className="vidro rounded-2xl px-4 py-3 text-center">
            <p className="font-titulo text-3xl font-semibold text-esmeralda">{resumo.opened}</p>
            <p className="text-xs font-semibold uppercase tracking-wider text-suave">já abertas</p>
          </div>
          {resumo.next_open_at ? (
            <p className="text-center text-sm text-suave sm:col-span-2">
              A próxima abre em <strong className="text-texto">{dataHora(resumo.next_open_at, { year: "numeric" })}</strong>.
            </p>
          ) : null}
        </Cartao>

        <section aria-labelledby="titulo-abertas">
          <h3 id="titulo-abertas" className="mb-3 font-titulo text-xl font-semibold">
            Cápsulas abertas
          </h3>
          {abertas.length ? (
            <ul className="grid grid-cols-1 gap-3">
              {abertas.map((c, i) => (
                <motion.li
                  key={c.id}
                  initial={menosMovimento ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: menosMovimento ? 0 : i * 0.05 }}
                >
                  <button
                    type="button"
                    onClick={() => setAberta(c)}
                    className="vidro flex w-full items-start gap-3 rounded-cartao p-4 text-left transition hover:-translate-y-0.5"
                  >
                    <Avatar nome={c.autor} caminho={c.avatar} tamanho={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <strong>{c.mine ? "Você" : c.autor}</strong>
                        <Selo cor="esmeralda">
                          <LockOpen className="size-3" aria-hidden /> aberta
                        </Selo>
                      </span>
                      <span className="mt-1 line-clamp-3 block whitespace-pre-line text-[15px]">{c.body}</span>
                      <span className="mt-1 block text-xs text-suave">
                        Escrita em {dataHora(c.created_at, { year: "numeric" })} · aberta em {dataHora(c.open_at, { year: "numeric" })}
                      </span>
                    </span>
                  </button>
                </motion.li>
              ))}
            </ul>
          ) : (
            <Vazio icone={<Hourglass className="size-10" />} titulo="Nenhuma aberta ainda" texto="Quando chegar a data, as mensagens aparecem aqui para todo o grupo." />
          )}
        </section>
      </div>

      <Dialogo aberto={!!paraExcluir} aoFechar={() => setParaExcluir(null)} titulo="Desfazer esta cápsula?" descricao="A mensagem é apagada e não poderá ser recuperada.">
        <div className="flex flex-wrap justify-end gap-2">
          <Botao variante="contorno" onClick={() => setParaExcluir(null)}>
            Manter lacrada
          </Botao>
          <Botao
            variante="perigo"
            carregando={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await excluirCapsula(eventoId, paraExcluir!.id);
                setParaExcluir(null);
                avisar(r.ok ? (r.mensagem ?? "Desfeita.") : r.erro, r.ok ? "ok" : "erro");
              })
            }
          >
            Desfazer
          </Botao>
        </div>
      </Dialogo>

      <Dialogo
        aberto={!!aberta}
        aoFechar={() => setAberta(null)}
        titulo={aberta ? `Cápsula de ${aberta.mine ? "você" : aberta.autor}` : ""}
        descricao={aberta ? `Escrita em ${dataHora(aberta.created_at, { year: "numeric" })}` : undefined}
      >
        {aberta ? <p className="whitespace-pre-line text-[16px] leading-relaxed">{aberta.body}</p> : null}
      </Dialogo>
    </div>
  );
}
