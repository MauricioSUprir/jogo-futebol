"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Eye, Users, Share2, Film } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ColorDot } from "@/components/ui/badge";
import { formatarNumero, formatarPct, formatarDuracao } from "@/lib/utils";
import { labelPlataforma } from "@/lib/constants";
import type { DashboardData, VideoMetrica } from "@/lib/analytics";

export function DashboardClient({ data }: { data: DashboardData }) {
  if (data.totalVideos === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Ainda não há métricas. Importe um CSV ou registre manualmente em{" "}
        <b>Importar / registrar</b>.
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={Film} label="Vídeos" valor={formatarNumero(data.totalVideos)} />
        <Kpi icon={Eye} label="Views (total)" valor={formatarNumero(data.totais.views)} />
        <Kpi icon={Users} label="Seguidores ganhos" valor={formatarNumero(data.totais.seguidores)} />
        <Kpi icon={Share2} label="Compartilhamentos" valor={formatarNumero(data.totais.compart)} />
      </div>

      {/* Destaque: melhores por retenção nos últimos 90 dias */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">5 vídeos com melhor retenção (últimos 90 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.melhoresRetencao90.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum vídeo publicado nos últimos 90 dias com retenção registrada.</p>
          ) : (
            <RankingLista videos={data.melhoresRetencao90} metrica="retencao" />
          )}
        </CardContent>
      </Card>

      {/* Rankings secundários */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Mais compartilhados</CardTitle></CardHeader>
          <CardContent><RankingLista videos={data.melhoresCompart} metrica="compart" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Mais seguidores ganhos</CardTitle></CardHeader>
          <CardContent><RankingLista videos={data.melhoresSeguidores} metrica="seguidores" /></CardContent>
        </Card>
      </div>

      {/* Performance por pilar */}
      <Card>
        <CardHeader><CardTitle className="text-base">Performance por pilar de conteúdo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.porPilar}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="pilar" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatarNumero(v)} />
                  <Tooltip formatter={(v: number) => formatarNumero(v)} />
                  <Bar dataKey="views" name="Views" radius={[4, 4, 0, 0]}>
                    {data.porPilar.map((p, i) => (
                      <Cell key={i} fill={p.cor} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {data.porPilar.map((p) => (
                <div key={p.pilar} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="flex items-center gap-2">
                    <ColorDot cor={p.cor} /> {p.pilar}
                  </span>
                  <span className="flex items-center gap-4 text-muted-foreground">
                    <span>{p.videos} vídeos</span>
                    <span>ret. {formatarPct(p.retencaoMedia)}</span>
                    <span>{formatarNumero(p.views)} views</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Evolução mês a mês */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução mês a mês</CardTitle></CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.evolucao}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} tickFormatter={(v) => formatarNumero(v)} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip />
                <Line yAxisId="l" type="monotone" dataKey="views" name="Views" stroke="#6366f1" strokeWidth={2} />
                <Line yAxisId="r" type="monotone" dataKey="retencaoMedia" name="Retenção %" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, valor }: { icon: React.ElementType; label: string; valor: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-primary/10 p-2 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-xl font-bold leading-none">{valor}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function RankingLista({
  videos,
  metrica,
}: {
  videos: VideoMetrica[];
  metrica: "retencao" | "compart" | "seguidores";
}) {
  return (
    <ol className="space-y-2">
      {videos.map((v, i) => {
        const destaque =
          metrica === "retencao"
            ? formatarPct(v.retencaoMedia)
            : metrica === "compart"
              ? formatarNumero(v.compartilhamentos)
              : `+${formatarNumero(v.seguidoresGanhos)}`;
        return (
          <li key={v.publicacaoId} className="flex items-center gap-3">
            <span className="w-5 text-center text-sm font-bold text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{v.titulo}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {v.pilarCor && <ColorDot cor={v.pilarCor} />}
                <span>{v.pilarNome ?? "Sem pilar"}</span>
                <Badge className="bg-secondary text-[10px]">{labelPlataforma(v.plataforma)}</Badge>
                {v.tempoMedioSeg ? <span>· {formatarDuracao(v.tempoMedioSeg)} médio</span> : null}
              </div>
            </div>
            <span className="text-sm font-semibold">{destaque}</span>
          </li>
        );
      })}
    </ol>
  );
}
