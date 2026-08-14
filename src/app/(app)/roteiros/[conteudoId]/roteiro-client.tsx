"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Presentation, GitCompare, History } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea, Input, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TagsInput } from "@/components/pickers";
import { BLOCOS_ROTEIRO } from "@/lib/constants";
import { contarPalavras, estimarDuracaoSeg, formatarDuracao } from "@/lib/utils";
import { Teleprompter } from "./teleprompter";
import { DiffView } from "./diff-view";
import { salvarNovaVersao } from "./actions";

type Conteudo = typeof import("@/db/schema").conteudos.$inferSelect;
type Roteiro = typeof import("@/db/schema").roteiros.$inferSelect;
type Blocos = Record<string, string>;

const VAZIO: Blocos = { gancho: "", contexto: "", desenvolvimento: "", climax: "", cta: "" };

export function RoteiroClient({
  conteudo,
  versoes,
  palavrasPorMin,
}: {
  conteudo: Conteudo;
  versoes: Roteiro[];
  palavrasPorMin: number;
}) {
  const router = useRouter();
  const ultima = versoes[versoes.length - 1];

  const [blocos, setBlocos] = useState<Blocos>({ ...VAZIO, ...((ultima?.blocos as Blocos) ?? {}) });
  const [legenda, setLegenda] = useState(ultima?.legenda ?? "");
  const [hashtags, setHashtags] = useState<string[]>(ultima?.hashtags ?? []);
  const [modo, setModo] = useState<"editar" | "comparar">("editar");
  const [teleOn, setTeleOn] = useState(false);
  const [pending, startTransition] = useTransition();

  // comparação
  const [verA, setVerA] = useState<number | undefined>(versoes[versoes.length - 2]?.versao);
  const [verB, setVerB] = useState<number | undefined>(ultima?.versao);

  const textoCompleto = useMemo(
    () => BLOCOS_ROTEIRO.map((b) => blocos[b.key]).filter(Boolean).join("\n\n"),
    [blocos],
  );
  const palavrasTotais = contarPalavras(textoCompleto);
  const duracaoTotal = estimarDuracaoSeg(textoCompleto, palavrasPorMin);

  function set(key: string, v: string) {
    setBlocos((prev) => ({ ...prev, [key]: v }));
  }

  function salvar() {
    startTransition(async () => {
      const r = await salvarNovaVersao({
        conteudoId: conteudo.id,
        blocos: blocos as never,
        legenda,
        hashtags,
      });
      if (r.ok) router.refresh();
    });
  }

  const versaoAObj = versoes.find((v) => v.versao === verA);
  const versaoBObj = versoes.find((v) => v.versao === verB);

  return (
    <>
      <PageHeader
        title={conteudo.tituloFinal}
        description={`Roteiro · ${palavrasTotais} palavras · ~${formatarDuracao(duracaoTotal)} · ${versoes.length} versões`}
        action={
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link href="/pipeline"><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTeleOn(true)}>
              <Presentation className="h-4 w-4" /> Teleprompter
            </Button>
            <Button size="sm" onClick={salvar} disabled={pending}>
              <Save className="h-4 w-4" /> {pending ? "..." : "Salvar versão"}
            </Button>
          </div>
        }
      />

      <div className="p-4">
        <div className="mb-4 flex items-center gap-2">
          <Button variant={modo === "editar" ? "default" : "outline"} size="sm" onClick={() => setModo("editar")}>
            <History className="h-4 w-4" /> Editar
          </Button>
          <Button
            variant={modo === "comparar" ? "default" : "outline"}
            size="sm"
            onClick={() => setModo("comparar")}
            disabled={versoes.length < 2}
          >
            <GitCompare className="h-4 w-4" /> Comparar versões
          </Button>
          {ultima && (
            <Badge className="ml-auto bg-secondary">Última salva: v{ultima.versao}</Badge>
          )}
        </div>

        {modo === "editar" ? (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-3 lg:col-span-2">
              {BLOCOS_ROTEIRO.map((b) => {
                const texto = blocos[b.key] ?? "";
                const chars = texto.length;
                const dur = estimarDuracaoSeg(texto, palavrasPorMin);
                return (
                  <Card key={b.key}>
                    <CardContent className="space-y-1.5 p-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-foreground">
                          {b.label} <span className="font-normal text-muted-foreground">· {b.hint}</span>
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          {chars} car · ~{formatarDuracao(dur)}
                        </span>
                      </div>
                      <Textarea
                        value={texto}
                        onChange={(e) => set(b.key, e.target.value)}
                        placeholder={`Escreva o bloco "${b.label}"...`}
                        className="min-h-[90px]"
                      />
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <div className="space-y-3">
              <Card>
                <CardContent className="space-y-3 p-3">
                  <div className="space-y-1">
                    <Label className="text-foreground">Descrição / legenda</Label>
                    <Textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} className="min-h-[120px]" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-foreground">Hashtags</Label>
                    <TagsInput value={hashtags} onChange={setHashtags} placeholder="hashtag + Enter" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium">{palavrasTotais} palavras</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Duração falada (~{palavrasPorMin} ppm)</span>
                    <span className="font-medium">{formatarDuracao(duracaoTotal)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-foreground">De</Label>
                <Select value={verA?.toString()} onValueChange={(v) => setVerA(Number(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {versoes.map((v) => <SelectItem key={v.id} value={v.versao.toString()}>v{v.versao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-foreground">Para</Label>
                <Select value={verB?.toString()} onValueChange={(v) => setVerB(Number(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {versoes.map((v) => <SelectItem key={v.id} value={v.versao.toString()}>v{v.versao}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {versaoAObj && versaoBObj ? (
              <DiffView
                a={(versaoAObj.blocos as Blocos) ?? {}}
                b={(versaoBObj.blocos as Blocos) ?? {}}
                versaoA={versaoAObj.versao}
                versaoB={versaoBObj.versao}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Selecione duas versões para comparar.</p>
            )}
          </div>
        )}
      </div>

      {teleOn && <Teleprompter texto={textoCompleto} onClose={() => setTeleOn(false)} />}
    </>
  );
}
