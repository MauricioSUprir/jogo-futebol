"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Plus, FileText, Calendar, User, GripVertical } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Badge, ColorDot } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { PlataformaPicker } from "@/components/pickers";
import {
  COLUNAS_PIPELINE,
  FORMATOS,
  CHECKLIST_ASSETS,
  labelFormato,
  labelPlataforma,
  type ColunaPipeline,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { moverConteudo, criarConteudo, atualizarConteudo, excluirConteudo } from "./actions";

type Conteudo = typeof import("@/db/schema").conteudos.$inferSelect;
type Pilar = typeof import("@/db/schema").pilares.$inferSelect;

export function PipelineClient({
  conteudos: inicial,
  pilares,
}: {
  conteudos: Conteudo[];
  pilares: Pilar[];
}) {
  const router = useRouter();
  const [cards, setCards] = useState<Conteudo[]>(inicial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [detalhe, setDetalhe] = useState<Conteudo | null>(null);
  const [, startTransition] = useTransition();

  const pilarPorId = useMemo(() => new Map(pilares.map((p) => [p.id, p])), [pilares]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const porColuna = (col: string) => cards.filter((c) => c.statusPipeline === col);

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const col = overId.replace("col-", "") as ColunaPipeline;
    const card = cards.find((c) => c.id === id);
    if (!card || card.statusPipeline === col) return;
    // otimista
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, statusPipeline: col } : c)));
    startTransition(async () => {
      await moverConteudo(id, col);
      router.refresh();
    });
  }

  const dragCard = dragId ? cards.find((c) => c.id === dragId) : null;

  return (
    <>
      <PageHeader
        title="Pipeline de produção"
        description={`${cards.length} conteúdos`}
        action={
          <Button size="sm" onClick={() => setNovoOpen(true)}>
            <Plus className="h-4 w-4" /> Novo card
          </Button>
        }
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto p-4">
          {COLUNAS_PIPELINE.map((col) => (
            <Coluna key={col.value} id={col.value} label={col.label} count={porColuna(col.value).length}>
              {porColuna(col.value).map((c) => (
                <CardKanban
                  key={c.id}
                  conteudo={c}
                  pilar={c.pilarId ? pilarPorId.get(c.pilarId) ?? null : null}
                  onClick={() => setDetalhe(c)}
                />
              ))}
            </Coluna>
          ))}
        </div>
        <DragOverlay>
          {dragCard ? (
            <CardKanban conteudo={dragCard} pilar={dragCard.pilarId ? pilarPorId.get(dragCard.pilarId) ?? null : null} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <NovoConteudo open={novoOpen} onOpenChange={setNovoOpen} pilares={pilares} onSaved={() => { setNovoOpen(false); router.refresh(); }} />
      {detalhe && (
        <DetalheConteudo
          conteudo={detalhe}
          pilares={pilares}
          onOpenChange={(v) => !v && setDetalhe(null)}
          onSaved={() => { setDetalhe(null); router.refresh(); }}
        />
      )}
    </>
  );
}

function Coluna({
  id,
  label,
  count,
  children,
}: {
  id: string;
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col-${id}` });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{label}</span>
        <Badge className="bg-secondary">{count}</Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[60vh] flex-col gap-2 rounded-lg border border-dashed p-2 transition-colors",
          isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function CardKanban({
  conteudo,
  pilar,
  onClick,
  dragging,
}: {
  conteudo: Conteudo;
  pilar: Pilar | null;
  onClick?: () => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: conteudo.id });
  const checklist = (conteudo.checklist ?? {}) as Record<string, boolean>;
  const feitos = CHECKLIST_ASSETS.filter((a) => checklist[a.key]).length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm",
        (isDragging || dragging) && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button onClick={onClick} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium leading-snug">{conteudo.tituloFinal}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {pilar && <ColorDot cor={pilar.cor} />}
            <Badge className="bg-secondary text-[10px]">{labelFormato(conteudo.formato)}</Badge>
            {(conteudo.plataformas ?? []).map((p) => (
              <Badge key={p} className="text-[10px]">{labelPlataforma(p)}</Badge>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            {conteudo.dataPrevista && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(conteudo.dataPrevista + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              </span>
            )}
            {conteudo.responsavel && (
              <span className="flex items-center gap-1 truncate">
                <User className="h-3 w-3" /> {conteudo.responsavel}
              </span>
            )}
            <span className="ml-auto">{feitos}/{CHECKLIST_ASSETS.length}</span>
          </div>
        </button>
      </div>
    </div>
  );
}

function NovoConteudo({
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
  const [formato, setFormato] = useState<string>("short");
  const [plataformas, setPlataformas] = useState<string[]>([]);
  const [dataPrevista, setDataPrevista] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [pilarId, setPilarId] = useState("");
  const [pending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const r = await criarConteudo({
        tituloFinal: titulo,
        formato: formato as "short" | "reel" | "video_longo",
        plataformas: plataformas as ("youtube" | "instagram" | "tiktok")[],
        dataPrevista: dataPrevista || null,
        responsavel: responsavel || null,
        pilarId: pilarId || null,
      });
      if (r.ok) {
        setTitulo(""); setPlataformas([]); setDataPrevista(""); setResponsavel(""); setPilarId("");
        onSaved();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent side="bottom" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo card no pipeline</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Formato</Label>
              <Select value={formato} onValueChange={setFormato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATOS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pilar</Label>
              <Select value={pilarId} onValueChange={setPilarId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pilares.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Plataforma(s)</Label>
            <PlataformaPicker value={plataformas} onChange={setPlataformas} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data prevista</Label>
              <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
          </div>
          <Button onClick={salvar} disabled={pending || !titulo.trim()} className="w-full">
            {pending ? "Salvando..." : "Criar card"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetalheConteudo({
  conteudo,
  pilares,
  onOpenChange,
  onSaved,
}: {
  conteudo: Conteudo;
  pilares: Pilar[];
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState(conteudo.tituloFinal);
  const [formato, setFormato] = useState<string>(conteudo.formato);
  const [plataformas, setPlataformas] = useState<string[]>(conteudo.plataformas ?? []);
  const [dataPrevista, setDataPrevista] = useState(conteudo.dataPrevista ?? "");
  const [responsavel, setResponsavel] = useState(conteudo.responsavel ?? "");
  const [pilarId, setPilarId] = useState(conteudo.pilarId ?? "");
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    (conteudo.checklist ?? {}) as Record<string, boolean>,
  );
  const [pending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const r = await atualizarConteudo({
        id: conteudo.id,
        tituloFinal: titulo,
        formato: formato as "short" | "reel" | "video_longo",
        plataformas: plataformas as ("youtube" | "instagram" | "tiktok")[],
        dataPrevista: dataPrevista || null,
        responsavel: responsavel || null,
        pilarId: pilarId || null,
        checklist,
      });
      if (r.ok) onSaved();
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent side="right">
        <DialogHeader>
          <DialogTitle>Detalhe do conteúdo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Título</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Formato</Label>
              <Select value={formato} onValueChange={setFormato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATOS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Pilar</Label>
              <Select value={pilarId} onValueChange={setPilarId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {pilares.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Plataforma(s)</Label>
            <PlataformaPicker value={plataformas} onChange={setPlataformas} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Data prevista</Label>
              <Input type="date" value={dataPrevista} onChange={(e) => setDataPrevista(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Checklist de assets</Label>
            <div className="grid grid-cols-2 gap-2">
              {CHECKLIST_ASSETS.map((a) => (
                <label key={a.key} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!checklist[a.key]}
                    onChange={(e) => setChecklist((prev) => ({ ...prev, [a.key]: e.target.checked }))}
                  />
                  {a.label}
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/roteiros/${conteudo.id}`}>
                <FileText className="h-4 w-4" /> Roteiro
              </Link>
            </Button>
            <Button onClick={salvar} disabled={pending} className="flex-1">
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full text-destructive"
            onClick={() => startTransition(async () => { await excluirConteudo(conteudo.id); onSaved(); })}
          >
            Excluir card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
