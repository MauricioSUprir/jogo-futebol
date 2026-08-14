"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { ColorDot } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { criarPilar, atualizarPilar, excluirPilar } from "./actions";

type Pilar = typeof import("@/db/schema").pilares.$inferSelect;

const CORES = ["#6366f1", "#f59e0b", "#ef4444", "#10b981", "#ec4899", "#0ea5e9", "#8b5cf6", "#64748b"];

export function PilaresClient({ pilares }: { pilares: Pilar[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<Pilar | null>(null);
  const [novoOpen, setNovoOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <>
      <PageHeader
        title="Pilares de conteúdo"
        description={`${pilares.length} pilares`}
        action={<Button size="sm" onClick={() => setNovoOpen(true)}><Plus className="h-4 w-4" /> Novo</Button>}
      />
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {pilares.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-start justify-between gap-2 p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ColorDot cor={p.cor} />
                  <span className="font-semibold">{p.nome}</span>
                </div>
                {p.descricao && <p className="mt-1 text-sm text-muted-foreground">{p.descricao}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditando(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => startTransition(async () => { await excluirPilar(p.id); router.refresh(); })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PilarForm
        open={novoOpen || !!editando}
        pilar={editando}
        onOpenChange={(v) => { if (!v) { setNovoOpen(false); setEditando(null); } }}
        onSaved={() => { setNovoOpen(false); setEditando(null); router.refresh(); }}
      />
    </>
  );
}

function PilarForm({
  open,
  pilar,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  pilar: Pilar | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(pilar?.nome ?? "");
  const [descricao, setDescricao] = useState(pilar?.descricao ?? "");
  const [cor, setCor] = useState(pilar?.cor ?? CORES[0]);
  const [pending, startTransition] = useTransition();

  // sincroniza quando muda o pilar em edição
  const chave = pilar?.id ?? "novo";
  const [ultimaChave, setUltimaChave] = useState(chave);
  if (chave !== ultimaChave) {
    setUltimaChave(chave);
    setNome(pilar?.nome ?? "");
    setDescricao(pilar?.descricao ?? "");
    setCor(pilar?.cor ?? CORES[0]);
  }

  function salvar() {
    startTransition(async () => {
      const payload = { nome, descricao: descricao || null, cor };
      const r = pilar ? await atualizarPilar(pilar.id, payload) : await criarPilar(payload);
      if (r.ok) onSaved();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{pilar ? "Editar pilar" : "Novo pilar"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} className="min-h-[60px]" />
          </div>
          <div className="space-y-1">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CORES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className={`h-7 w-7 rounded-full ring-offset-2 ${cor === c ? "ring-2 ring-primary" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button onClick={salvar} disabled={pending || !nome.trim()} className="w-full">
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
