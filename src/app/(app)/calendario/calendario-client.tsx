"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addWeeks,
  format,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { ColorDot } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PLATAFORMAS, corPlataforma } from "@/lib/constants";
import { cn } from "@/lib/utils";

type Evento = {
  id: string;
  titulo: string;
  data: string | null;
  publicado: boolean;
  plataformas: string[];
  pilarId: string | null;
  status: string;
};
type Pilar = typeof import("@/db/schema").pilares.$inferSelect;

export function CalendarioClient({ eventos, pilares }: { eventos: Evento[]; pilares: Pilar[] }) {
  const [ref, setRef] = useState(new Date());
  const [modo, setModo] = useState<"mes" | "semana">("mes");
  const [fPlataforma, setFPlataforma] = useState("todas");
  const [fPilar, setFPilar] = useState("todos");

  const pilarPorId = useMemo(() => new Map(pilares.map((p) => [p.id, p])), [pilares]);

  const filtrados = eventos.filter((e) => {
    if (fPlataforma !== "todas" && !e.plataformas.includes(fPlataforma)) return false;
    if (fPilar !== "todos" && e.pilarId !== fPilar) return false;
    return true;
  });

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of filtrados) {
      if (!e.data) continue;
      const k = e.data.slice(0, 10);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return m;
  }, [filtrados]);

  const dias = useMemo(() => {
    if (modo === "mes") {
      const ini = startOfWeek(startOfMonth(ref), { weekStartsOn: 0 });
      const fim = endOfWeek(endOfMonth(ref), { weekStartsOn: 0 });
      const arr: Date[] = [];
      let d = ini;
      while (d <= fim) {
        arr.push(d);
        d = addDays(d, 1);
      }
      return arr;
    } else {
      const ini = startOfWeek(ref, { weekStartsOn: 0 });
      return Array.from({ length: 7 }, (_, i) => addDays(ini, i));
    }
  }, [ref, modo]);

  function navegar(dir: number) {
    setRef((r) => (modo === "mes" ? addMonths(r, dir) : addWeeks(r, dir)));
  }

  const titulo =
    modo === "mes"
      ? format(ref, "MMMM 'de' yyyy", { locale: ptBR })
      : `Semana de ${format(startOfWeek(ref, { weekStartsOn: 0 }), "d MMM", { locale: ptBR })}`;

  const hojeMes = new Date();

  return (
    <>
      <PageHeader
        title="Calendário editorial"
        description="Datas de publicação previstas e realizadas"
        action={
          <div className="flex items-center gap-1">
            <Button variant={modo === "mes" ? "default" : "outline"} size="sm" onClick={() => setModo("mes")}>Mês</Button>
            <Button variant={modo === "semana" ? "default" : "outline"} size="sm" onClick={() => setModo("semana")}>Semana</Button>
          </div>
        }
      />
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navegar(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="min-w-40 text-center text-sm font-semibold capitalize">{titulo}</div>
          <Button variant="outline" size="icon" onClick={() => navegar(1)}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setRef(new Date())}>Hoje</Button>

          <div className="ml-auto flex items-center gap-2">
            <Select value={fPlataforma} onValueChange={setFPlataforma}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas plataformas</SelectItem>
                {PLATAFORMAS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={fPilar} onValueChange={setFPilar}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos pilares</SelectItem>
                {pilares.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="bg-muted px-2 py-1.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>
          ))}
          {dias.map((dia) => {
            const k = format(dia, "yyyy-MM-dd");
            const items = porDia.get(k) ?? [];
            const foraDoMes = modo === "mes" && !isSameMonth(dia, ref);
            // dia sem publicação planejada (dentro do mês/semana, não passado)
            const vazioPlanejado = items.length === 0 && !foraDoMes && dia >= new Date(hojeMes.toDateString());
            return (
              <div
                key={k}
                className={cn(
                  "min-h-24 bg-background p-1.5",
                  foraDoMes && "opacity-40",
                  isToday(dia) && "ring-1 ring-inset ring-primary",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={cn("text-xs", isToday(dia) && "font-bold text-primary")}>{format(dia, "d")}</span>
                  {vazioPlanejado && (
                    <span className="rounded-full bg-amber-100 px-1.5 text-[9px] text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      sem post
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {items.map((e) => {
                    const pilar = e.pilarId ? pilarPorId.get(e.pilarId) : null;
                    return (
                      <Link
                        key={e.id}
                        href={`/roteiros/${e.id}`}
                        className={cn(
                          "block truncate rounded px-1.5 py-1 text-[11px] leading-tight",
                          e.publicado ? "bg-primary/10" : "bg-secondary",
                        )}
                        title={e.titulo}
                      >
                        <span className="flex items-center gap-1">
                          {pilar && <ColorDot cor={pilar.cor} className="h-1.5 w-1.5" />}
                          <span className="truncate">{e.titulo}</span>
                        </span>
                        <span className="mt-0.5 flex gap-0.5">
                          {e.plataformas.map((p) => (
                            <span key={p} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: corPlataforma(p) }} />
                          ))}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
