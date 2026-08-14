"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PLATAFORMAS } from "@/lib/constants";
import { importarCsv, registrarMetricaManual } from "../actions";

const hoje = new Date().toISOString().slice(0, 10);

export function ImportarClient() {
  const router = useRouter();
  return (
    <Tabs defaultValue="csv" className="mx-auto max-w-2xl">
      <TabsList>
        <TabsTrigger value="csv">Importar CSV</TabsTrigger>
        <TabsTrigger value="manual">Registrar manual</TabsTrigger>
      </TabsList>
      <TabsContent value="csv">
        <CsvForm onDone={() => router.refresh()} />
      </TabsContent>
      <TabsContent value="manual">
        <ManualForm onDone={() => router.refresh()} />
      </TabsContent>
    </Tabs>
  );
}

function CsvForm({ onDone }: { onDone: () => void }) {
  const [plataforma, setPlataforma] = useState("youtube");
  const [coletadoEm, setColetadoEm] = useState(hoje);
  const [csv, setCsv] = useState("");
  const [pending, startTransition] = useTransition();
  const [resultado, setResultado] = useState<
    | { ok: true; resumo: { linhas: number; inseridos: number; atualizados: number; publicacoesCriadas: number; erros: string[] } }
    | { ok: false; erro: string }
    | null
  >(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsv(await file.text());
  }

  function importar() {
    setResultado(null);
    startTransition(async () => {
      const r = await importarCsv({ plataforma: plataforma as "youtube" | "instagram" | "tiktok", csv, coletadoEm });
      if (r.ok) {
        setResultado({ ok: true, resumo: r.resumo });
        onDone();
      } else {
        setResultado({ ok: false, erro: r.erro });
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Plataforma</Label>
            <Select value={plataforma} onValueChange={setPlataforma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATAFORMAS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Coletado em</Label>
            <Input type="date" value={coletadoEm} onChange={(e) => setColetadoEm(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1">
          <Label>Arquivo CSV</Label>
          <Input type="file" accept=".csv,text/csv" onChange={onFile} />
        </div>

        <div className="space-y-1">
          <Label>...ou cole o conteúdo do CSV</Label>
          <Textarea value={csv} onChange={(e) => setCsv(e.target.value)} className="min-h-[120px] font-mono text-xs" placeholder="Content,Video title,Views,..." />
        </div>

        <p className="text-xs text-muted-foreground">
          Snapshots datados: reimportar a mesma data não duplica (atualiza). Datas diferentes preservam a curva de crescimento.
          Colunas esperadas por plataforma estão no README.
        </p>

        {resultado?.ok && (
          <div className="flex items-start gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-900/30 dark:text-green-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              {resultado.resumo.linhas} linhas · {resultado.resumo.inseridos} inseridas ·{" "}
              {resultado.resumo.atualizados} atualizadas · {resultado.resumo.publicacoesCriadas} vídeos novos.
            </div>
          </div>
        )}
        {resultado && !resultado.ok && (
          <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-900/30 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {resultado.erro}
          </div>
        )}

        <Button onClick={importar} disabled={pending || !csv.trim()} className="w-full">
          {pending ? "Importando..." : "Importar CSV"}
        </Button>
      </CardContent>
    </Card>
  );
}

const CAMPOS: { key: string; label: string; pct?: boolean }[] = [
  { key: "views", label: "Views" },
  { key: "retencaoMedia", label: "Retenção média (%)", pct: true },
  { key: "tempoMedioSeg", label: "Tempo médio (seg)" },
  { key: "likes", label: "Likes" },
  { key: "comentarios", label: "Comentários" },
  { key: "compartilhamentos", label: "Compartilhamentos" },
  { key: "salvamentos", label: "Salvamentos" },
  { key: "seguidoresGanhos", label: "Seguidores ganhos" },
];

function ManualForm({ onDone }: { onDone: () => void }) {
  const [plataforma, setPlataforma] = useState("youtube");
  const [titulo, setTitulo] = useState("");
  const [url, setUrl] = useState("");
  const [publicadoEm, setPublicadoEm] = useState("");
  const [coletadoEm, setColetadoEm] = useState(hoje);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const r = await registrarMetricaManual({
        plataforma: plataforma as "youtube" | "instagram" | "tiktok",
        titulo,
        url: url || null,
        publicadoEm: publicadoEm || null,
        coletadoEm,
        views: Number(valores.views || 0),
        retencaoMedia: valores.retencaoMedia === undefined || valores.retencaoMedia === "" ? "" : Number(valores.retencaoMedia),
        tempoMedioSeg: valores.tempoMedioSeg === undefined || valores.tempoMedioSeg === "" ? "" : Number(valores.tempoMedioSeg),
        likes: Number(valores.likes || 0),
        comentarios: Number(valores.comentarios || 0),
        compartilhamentos: Number(valores.compartilhamentos || 0),
        salvamentos: Number(valores.salvamentos || 0),
        seguidoresGanhos: Number(valores.seguidoresGanhos || 0),
      });
      if (r.ok) {
        setMsg(r.foiInsert ? "Métrica registrada." : "Snapshot atualizado (mesma data).");
        setTitulo(""); setUrl(""); setPublicadoEm(""); setValores({});
        onDone();
      } else {
        setMsg(r.erro);
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Plataforma</Label>
            <Select value={plataforma} onValueChange={setPlataforma}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATAFORMAS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Coletado em</Label>
            <Input type="date" value={coletadoEm} onChange={(e) => setColetadoEm(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Título do vídeo *</Label>
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Casa com um vídeo existente pelo título" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>URL</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Publicado em</Label>
            <Input type="date" value={publicadoEm} onChange={(e) => setPublicadoEm(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {CAMPOS.map((c) => (
            <div key={c.key} className="space-y-1">
              <Label>{c.label}</Label>
              <Input
                type="number"
                step={c.pct ? "0.1" : "1"}
                value={valores[c.key] ?? ""}
                onChange={(e) => setValores((v) => ({ ...v, [c.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <Button onClick={salvar} disabled={pending || !titulo.trim()} className="w-full">
          {pending ? "Salvando..." : "Registrar métrica"}
        </Button>
      </CardContent>
    </Card>
  );
}
