"use client";
import { useId, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2 } from "lucide-react";
import { enviarMidia } from "@/lib/imagem";
import { urlPublicaDaMidia } from "@/lib/env";
import { Botao } from "@/components/ui/botao";
import { Girando } from "@/components/ui/carregando";
import { EnfeitesTema } from "@/components/grupo/enfeites";
import type { Tema } from "@/lib/temas";
import { cn } from "@/lib/cn";

/**
 * Foto de capa: escolhe, reduz no aparelho (WebP), envia para o Storage e mostra a prévia. Sem foto, a capa usa as
 * cores do tema.
 */
export function SeletorCapa({
  caminho,
  aoMudar,
  tema,
  desabilitado,
  erro,
}: {
  caminho: string | null;
  aoMudar: (c: string | null) => void;
  tema: Tema;
  desabilitado?: boolean;
  erro?: string | null;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [problema, setProblema] = useState<string | null>(null);
  const url = urlPublicaDaMidia(caminho);

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return;
    setProblema(null);
    setEnviando(true);
    try {
      const novo = await enviarMidia(arquivo, "capa", 1800);
      aoMudar(novo);
    } catch (e) {
      setProblema(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  const mensagem = problema ?? erro;
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-rotulo`} className="text-sm font-semibold">
        Foto de capa <span className="font-normal text-suave">(opcional)</span>
      </span>
      <div
        data-tema={tema}
        className={cn(
          "relative flex h-40 items-center justify-center overflow-hidden rounded-2xl border border-borda sm:h-48",
          !url && "bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t2)_80%,black))]",
        )}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Prévia da foto de capa" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <EnfeitesTema tema={tema} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" aria-hidden />
        {enviando ? (
          <div className="vidro-forte relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold">
            <Girando rotulo="Enviando a foto" /> Enviando…
          </div>
        ) : (
          <div className="relative flex flex-wrap items-center justify-center gap-2 px-3">
            <input
              ref={entrada}
              id={id}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              className="sr-only"
              aria-labelledby={`${id}-rotulo`}
              disabled={desabilitado}
              onChange={(e) => escolher(e.target.files?.[0])}
            />
            <Botao variante="vidro" tamanho="p" onClick={() => entrada.current?.click()} disabled={desabilitado}>
              {url ? <RefreshCw className="size-4" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
              {url ? "Trocar foto" : "Escolher foto"}
            </Botao>
            {url ? (
              <Botao variante="vidro" tamanho="p" onClick={() => aoMudar(null)} disabled={desabilitado}>
                <Trash2 className="size-4" aria-hidden /> Remover
              </Botao>
            ) : null}
          </div>
        )}
      </div>
      {mensagem ? (
        <p className="text-sm font-medium text-rubi" role="alert">
          {mensagem}
        </p>
      ) : (
        <p className="text-xs text-suave">JPG, PNG ou WebP. A foto é reduzida no seu aparelho antes de enviar. Sem foto, usamos as cores do tema.</p>
      )}
    </div>
  );
}
