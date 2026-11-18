"use client";
// O botão central "Registrar": água, hábitos de hoje, os registros rápidos dos módulos (treino, sono, refeição,
// estudo, como estou), evento e tarefa num lugar só.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarPlus, Check, Droplets, ListPlus, Minus } from "lucide-react";
import { DialogoBase, BotaoEnvio } from "../cliente";
import { EVENTO_REGISTRAR } from "./barras";
import { adicionarAgua } from "@/acoes/agua";
import { marcarHabito } from "@/acoes/habitos";
import { FormEvento, FormTarefa } from "../agenda/formularios";
import { IconeHabito } from "../icone-habito";
import { Barra, classesBotao } from "../ui";
import { formatarMl } from "@/lib/agua";
import { cn } from "@/lib/cn";

export interface HabitoRapido {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  feito: boolean;
  agua: boolean;
  programado: boolean;
}

/** Registro rápido de um módulo: o formulário já vem montado pelo servidor (layout). */
export interface ExtraRegistro {
  chave: string;
  rotulo: string;
  titulo: string;
  icone: ReactNode;
  conteudo: ReactNode;
}

export function RegistroRapido({
  hoje,
  copo,
  garrafa,
  rapidos,
  aguaMl,
  metaMl,
  habitos,
  extras = [],
}: {
  hoje: string;
  copo: number;
  garrafa: number;
  rapidos: number[];
  aguaMl: number;
  metaMl: number;
  habitos: HabitoRapido[];
  extras?: ExtraRegistro[];
}) {
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<string>("inicio");
  const extra = extras.find((e) => e.chave === modo);
  useEffect(() => {
    const abrir = () => {
      setModo("inicio");
      setAberto(true);
    };
    window.addEventListener(EVENTO_REGISTRAR, abrir);
    return () => window.removeEventListener(EVENTO_REGISTRAR, abrir);
  }, []);
  const botoesAgua = [
    { ml: copo, rotulo: `Copo · ${copo} ml`, tipo: "copo" },
    { ml: garrafa, rotulo: `Garrafa · ${garrafa} ml`, tipo: "garrafa" },
    ...rapidos.map((ml) => ({ ml, rotulo: `+${ml} ml`, tipo: "rapido" })),
  ];
  const visiveis = habitos.filter((h) => h.programado || h.feito);

  return (
    <DialogoBase
      aberto={aberto}
      aoFechar={() => setAberto(false)}
      titulo={modo === "evento" ? "Novo evento" : modo === "tarefa" ? "Nova tarefa" : extra ? extra.titulo : "Registrar"}
      descricao={modo === "inicio" ? "O que você quer registrar agora?" : undefined}
    >
      {modo !== "inicio" && (
        <button type="button" onClick={() => setModo("inicio")} className={classesBotao("fantasma", "p", "-mt-2 mb-3 -ml-2")}>
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
      )}
      {modo === "evento" && <FormEvento dia={hoje} />}
      {modo === "tarefa" && <FormTarefa dia={hoje} />}
      {extra && <div key={extra.chave}>{extra.conteudo}</div>}
      {modo === "inicio" && (
        <div className="grid grid-cols-1 gap-5">
          <section aria-labelledby="rr-agua">
            <div className="mb-2 flex items-center justify-between">
              <h3 id="rr-agua" className="flex items-center gap-2 text-sm font-semibold">
                <Droplets className="h-4 w-4 text-ciano" aria-hidden /> Água
              </h3>
              <span className="numero text-xs text-suave">
                {formatarMl(aguaMl)} de {formatarMl(metaMl)}
              </span>
            </div>
            <Barra pct={metaMl ? (aguaMl / metaMl) * 100 : 0} cor="linear-gradient(90deg,#22d3ee,#2563eb)" className="mb-3" rotulo="Água de hoje" />
            <div className="grid grid-cols-2 gap-2">
              {botoesAgua.map((b, i) => (
                <form key={i} action={adicionarAgua}>
                  <input type="hidden" name="ml" value={b.ml} />
                  <input type="hidden" name="tipo" value={b.tipo} />
                  <BotaoEnvio variante="secundario" className="w-full" pendente="Registrando…">
                    {b.rotulo}
                  </BotaoEnvio>
                </form>
              ))}
            </div>
          </section>

          <section aria-labelledby="rr-hab">
            <h3 id="rr-hab" className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Check className="h-4 w-4 text-eletrico-claro" aria-hidden /> Hábitos de hoje
            </h3>
            {visiveis.length === 0 ? (
              <p className="text-sm text-suave">
                Nenhum hábito para hoje.{" "}
                <Link href="/habitos" onClick={() => setAberto(false)} className="text-eletrico-claro hover:underline">
                  Criar hábitos
                </Link>
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-1.5">
                {visiveis.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/60 px-3 py-2">
                    <IconeHabito icone={h.icone} cor={h.cor} tamanho="p" />
                    <span className={cn("min-w-0 flex-1 truncate text-sm", h.feito && "text-suave line-through decoration-suave/50")}>{h.nome}</span>
                    {h.agua ? (
                      <span className="text-xs text-suave">{h.feito ? "Meta batida" : "pela água"}</span>
                    ) : (
                      <form action={marcarHabito}>
                        <input type="hidden" name="id" value={h.id} />
                        <input type="hidden" name="acao" value="alternar" />
                        <button
                          className={cn(
                            "grid grid-cols-1 h-8 w-8 place-items-center rounded-lg border transition",
                            h.feito ? "border-ok/40 bg-ok/15 text-ok" : "border-borda text-suave hover:border-eletrico hover:text-texto",
                          )}
                          aria-label={h.feito ? `Desmarcar ${h.nome}` : `Marcar ${h.nome} como feito`}
                          aria-pressed={h.feito}
                        >
                          {h.feito ? <Check className="h-4 w-4" /> : <Minus className="h-4 w-4 opacity-40" />}
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {extras.length > 0 && (
            <section aria-label="Registrar nos módulos" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {extras.map((e) => (
                <button key={e.chave} type="button" onClick={() => setModo(e.chave)} className={classesBotao("secundario", "g", "justify-start px-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0")}>
                  {e.icone}
                  <span className="truncate">{e.rotulo}</span>
                </button>
              ))}
            </section>
          )}

          <section className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setModo("evento")} className={classesBotao("secundario", "g")}>
              <CalendarPlus className="h-4 w-4 text-eletrico-claro" /> Evento
            </button>
            <button type="button" onClick={() => setModo("tarefa")} className={classesBotao("secundario", "g")}>
              <ListPlus className="h-4 w-4 text-violeta-claro" /> Tarefa
            </button>
          </section>
        </div>
      )}
    </DialogoBase>
  );
}
