"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, Plus, Check, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BLOCOS_ROTEIRO } from "@/lib/constants";
import type { SugestaoResposta } from "@/lib/ai";
import { gerarSugestoesAction, criarIdeiasDaSugestao } from "./actions";

type Sugestao = typeof import("@/db/schema").sugestoesIa.$inferSelect;

export function SugestoesClient({
  historico,
  videosComMetricas,
}: {
  historico: Sugestao[];
  videosComMetricas: number;
}) {
  const router = useRouter();
  const [tema, setTema] = useState("");
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sugestaoId, setSugestaoId] = useState<string | null>(null);
  const [resp, setResp] = useState<SugestaoResposta | null>(null);
  const [criados, setCriados] = useState<Set<string>>(new Set());

  const insuficiente = videosComMetricas < 5;

  function gerar() {
    setErro(null);
    setResp(null);
    setCriados(new Set());
    startTransition(async () => {
      const r = await gerarSugestoesAction(tema);
      if (r.ok) {
        setResp(r.resposta);
        setSugestaoId(r.id);
      } else {
        setErro(r.erro);
      }
    });
  }

  function virarIdeia(chave: string, titulo: string, gancho?: string, resumo?: string) {
    if (!sugestaoId) return;
    startTransition(async () => {
      const r = await criarIdeiasDaSugestao({
        sugestaoId,
        itens: [{ titulo, gancho: gancho ?? null, resumo: resumo ?? null }],
      });
      if (r.ok) {
        setCriados((prev) => new Set(prev).add(chave));
        router.refresh();
      }
    });
  }

  return (
    <>
      <PageHeader
        title="Sugestões de roteiro (IA)"
        description="Baseadas nos seus vídeos de melhor performance + o tema"
      />
      <div className="space-y-5 p-4">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && tema.trim() && gerar()}
                placeholder="Tema que você quer explorar (ex.: retenção em shorts)"
              />
              <Button onClick={gerar} disabled={pending || !tema.trim()}>
                <Sparkles className="h-4 w-4" /> {pending ? "Gerando..." : "Gerar sugestões"}
              </Button>
            </div>
            {insuficiente && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Você tem {videosComMetricas} vídeo(s) com métricas (mín. 5). As sugestões se basearão apenas no tema — a IA não vai inventar dados.
              </div>
            )}
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </CardContent>
        </Card>

        {resp && (
          <div className="space-y-5">
            {resp.aviso && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {resp.aviso}
              </div>
            )}

            {/* Ganchos */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">5 ganchos alternativos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {resp.ganchos.map((g, i) => {
                  const chave = `gancho-${i}`;
                  return (
                    <ItemSugestao
                      key={chave}
                      texto={g.texto}
                      justificativa={g.justificativa}
                      feito={criados.has(chave)}
                      onVirarIdeia={() => virarIdeia(chave, g.texto, g.texto, "Ideia a partir de gancho sugerido pela IA.")}
                    />
                  );
                })}
              </CardContent>
            </Card>

            {/* Estrutura */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Estrutura de roteiro sugerida
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={criados.has("estrutura")}
                    onClick={() =>
                      virarIdeia(
                        "estrutura",
                        resp.ganchos[0]?.texto ?? tema,
                        resp.estrutura.gancho.conteudo,
                        BLOCOS_ROTEIRO.map((b) => `${b.label}: ${resp.estrutura[b.key as keyof typeof resp.estrutura].conteudo}`).join(" | "),
                      )
                    }
                  >
                    {criados.has("estrutura") ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    Virar ideia
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {BLOCOS_ROTEIRO.map((b) => {
                  const bloco = resp.estrutura[b.key as keyof typeof resp.estrutura];
                  return (
                    <div key={b.key} className="rounded-md border p-3">
                      <div className="text-xs font-semibold text-muted-foreground">{b.label}</div>
                      <p className="text-sm">{bloco.conteudo}</p>
                      <p className="mt-1 text-xs italic text-muted-foreground">↳ {bloco.justificativa}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Títulos */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">3 títulos</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {resp.titulos.map((t, i) => {
                  const chave = `titulo-${i}`;
                  return (
                    <ItemSugestao
                      key={chave}
                      texto={t.texto}
                      justificativa={t.justificativa}
                      feito={criados.has(chave)}
                      onVirarIdeia={() => virarIdeia(chave, t.texto, resp.ganchos[0]?.texto, "Ideia a partir de título sugerido pela IA.")}
                    />
                  );
                })}
              </CardContent>
            </Card>

            {/* CTA */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Sugestão de CTA</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{resp.cta.texto}</p>
                <p className="mt-1 text-xs italic text-muted-foreground">↳ {resp.cta.justificativa}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Histórico */}
        {historico.length > 0 && (
          <details className="rounded-md border">
            <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium">
              <ChevronDown className="h-4 w-4" /> Histórico de gerações ({historico.length})
            </summary>
            <div className="divide-y">
              {historico.map((h) => (
                <div key={h.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="truncate">{h.tema}</span>
                  <Badge className="bg-secondary text-xs">
                    {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                  </Badge>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </>
  );
}

function ItemSugestao({
  texto,
  justificativa,
  feito,
  onVirarIdeia,
}: {
  texto: string;
  justificativa: string;
  feito: boolean;
  onVirarIdeia: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{texto}</p>
        <p className="mt-1 text-xs italic text-muted-foreground">↳ {justificativa}</p>
      </div>
      <Button size="sm" variant={feito ? "secondary" : "outline"} disabled={feito} onClick={onVirarIdeia}>
        {feito ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {feito ? "Criada" : "Virar ideia"}
      </Button>
    </div>
  );
}
