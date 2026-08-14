"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowRight, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Badge, ColorDot } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PlataformaPicker, TagsInput } from "@/components/pickers";
import { STATUS_IDEIA, labelPlataforma } from "@/lib/constants";
import { criarIdeia, atualizarStatusIdeia, excluirIdeia, promoverParaPipeline } from "./actions";

type Ideia = typeof import("@/db/schema").ideias.$inferSelect;
type Pilar = typeof import("@/db/schema").pilares.$inferSelect;

export function IdeiasClient({ ideias, pilares }: { ideias: Ideia[]; pilares: Pilar[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [busca, setBusca] = useState("");
  const [pending, startTransition] = useTransition();

  const pilarPorId = useMemo(() => new Map(pilares.map((p) => [p.id, p])), [pilares]);

  const filtradas = ideias.filter((i) => {
    if (filtroStatus !== "todos" && i.status !== filtroStatus) return false;
    if (busca && !`${i.titulo} ${i.gancho ?? ""} ${(i.tags ?? []).join(" ")}`.toLowerCase().includes(busca.toLowerCase()))
      return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Banco de ideias"
        description={`${ideias.length} ideias`}
        action={
          <Button onClick={() => setOpen(true)} size="sm">
            <Plus className="h-4 w-4" /> Nova
          </Button>
        }
      />

      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar por título, gancho ou tag..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex gap-1">
            <FiltroBtn label="Todos" active={filtroStatus === "todos"} onClick={() => setFiltroStatus("todos")} />
            {STATUS_IDEIA.map((s) => (
              <FiltroBtn
                key={s.value}
                label={s.label}
                active={filtroStatus === s.value}
                onClick={() => setFiltroStatus(s.value)}
              />
            ))}
          </div>
        </div>

        {filtradas.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma ideia. Toque em <b>Nova</b> para capturar a primeira.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtradas.map((i) => {
              const pilar = i.pilarId ? pilarPorId.get(i.pilarId) : null;
              return (
                <Card key={i.id}>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold leading-snug">{i.titulo}</h3>
                      <StatusBadge status={i.status} />
                    </div>
                    {i.gancho && (
                      <p className="text-sm italic text-muted-foreground">“{i.gancho}”</p>
                    )}
                    {i.resumo && <p className="text-sm">{i.resumo}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {pilar && (
                        <Badge className="gap-1" style={{ borderColor: pilar.cor }}>
                          <ColorDot cor={pilar.cor} /> {pilar.nome}
                        </Badge>
                      )}
                      {(i.plataformas ?? []).map((p) => (
                        <Badge key={p} className="bg-secondary">
                          {labelPlataforma(p)}
                        </Badge>
                      ))}
                      {(i.tags ?? []).map((t) => (
                        <Badge key={t} className="text-muted-foreground">#{t}</Badge>
                      ))}
                    </div>
                    {i.origem && (
                      <p className="text-xs text-muted-foreground">origem: {i.origem}</p>
                    )}
                    <div className="flex items-center gap-1 pt-2">
                      <Select
                        value={i.status}
                        onValueChange={(v) =>
                          startTransition(async () => {
                            await atualizarStatusIdeia(i.id, v as "ideia" | "aprovada" | "descartada");
                            router.refresh();
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_IDEIA.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const r = await promoverParaPipeline(i.id);
                            if (r.ok) router.push("/pipeline");
                          })
                        }
                      >
                        Pipeline <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground"
                        onClick={() =>
                          startTransition(async () => {
                            await excluirIdeia(i.id);
                            router.refresh();
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <CapturaRapida
        open={open}
        onOpenChange={setOpen}
        pilares={pilares}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function FiltroBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ideia: "bg-secondary text-secondary-foreground",
    aprovada: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    descartada: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  };
  return <Badge className={map[status]}>{STATUS_IDEIA.find((s) => s.value === status)?.label}</Badge>;
}

function CapturaRapida({
  open,
  onOpenChange,
  pilares,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pilares: Pilar[];
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [gancho, setGancho] = useState("");
  const [resumo, setResumo] = useState("");
  const [origem, setOrigem] = useState("");
  const [pilarId, setPilarId] = useState<string>("");
  const [plataformas, setPlataformas] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setTitulo("");
    setGancho("");
    setResumo("");
    setOrigem("");
    setPilarId("");
    setPlataformas([]);
    setTags([]);
    setErro(null);
  }

  function salvar() {
    setErro(null);
    startTransition(async () => {
      const r = await criarIdeia({
        titulo,
        gancho,
        resumo,
        origem,
        pilarId: pilarId || null,
        plataformas: plataformas as ("youtube" | "instagram" | "tiktok")[],
        tags,
        status: "ideia",
      });
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      reset();
      onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Captura rápida</DialogTitle>
          <DialogDescription>Só o título já basta. O resto é opcional.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input
              autoFocus
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && e.metaKey && salvar()}
              placeholder="Ex.: 3 erros que eu cometia editando"
            />
          </div>
          <div className="space-y-1">
            <Label>Gancho (0–3s)</Label>
            <Input value={gancho} onChange={(e) => setGancho(e.target.value)} placeholder="A primeira frase que prende" />
          </div>
          <div className="space-y-1">
            <Label>Resumo (1 linha)</Label>
            <Textarea value={resumo} onChange={(e) => setResumo(e.target.value)} className="min-h-[52px]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Origem</Label>
              <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="comentário, insight..." />
            </div>
            <div className="space-y-1">
              <Label>Pilar</Label>
              <Select value={pilarId} onValueChange={setPilarId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {pilares.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Plataforma-alvo</Label>
            <PlataformaPicker value={plataformas} onChange={setPlataformas} />
          </div>
          <div className="space-y-1">
            <Label>Tags</Label>
            <TagsInput value={tags} onChange={setTags} />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <Button onClick={salvar} disabled={pending || !titulo.trim()} className="w-full">
            {pending ? "Salvando..." : "Salvar ideia"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
