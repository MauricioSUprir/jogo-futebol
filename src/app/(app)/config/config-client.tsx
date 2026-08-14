"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { salvarConfig } from "./actions";

export function ConfigClient({
  palavrasPorMin,
  apiConfigurada,
  modelo,
}: {
  palavrasPorMin: number;
  apiConfigurada: boolean;
  modelo: string;
}) {
  const router = useRouter();
  const [ppm, setPpm] = useState(String(palavrasPorMin));
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function salvar() {
    setMsg(null);
    startTransition(async () => {
      const r = await salvarConfig({ palavrasPorMin: Number(ppm) });
      setMsg(r.ok ? "Salvo." : r.erro);
      if (r.ok) router.refresh();
    });
  }

  return (
    <>
      <PageHeader title="Configurações" description="Ajustes gerais (admin)" />
      <div className="mx-auto max-w-xl space-y-4 p-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Estimativa de duração</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Palavras por minuto (ritmo de fala)</Label>
              <div className="flex gap-2">
                <Input type="number" min={60} max={400} value={ppm} onChange={(e) => setPpm(e.target.value)} className="max-w-32" />
                <Button onClick={salvar} disabled={pending}>{pending ? "..." : "Salvar"}</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Usado para estimar a duração falada de cada bloco do roteiro. Padrão: 150.
              </p>
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><KeyRound className="h-4 w-4" /> Claude API</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {apiConfigurada ? (
                <><CheckCircle2 className="h-4 w-4 text-green-600" /> Chave configurada no servidor.</>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /> Chave <b>não</b> configurada — sugestões de IA indisponíveis.</>
              )}
            </div>
            <p className="text-muted-foreground">Modelo: <code className="rounded bg-muted px-1">{modelo}</code></p>
            <p className="text-xs text-muted-foreground">
              A chave (<code>ANTHROPIC_API_KEY</code>) vive apenas como variável de ambiente do servidor e nunca é
              exposta ao navegador. Para alterá-la, edite o <code>.env</code> e reinicie a aplicação.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
