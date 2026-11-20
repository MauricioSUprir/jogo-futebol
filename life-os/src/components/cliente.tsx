"use client";
// Peças de interface que precisam do navegador: diálogo, botão de envio com "carregando", relógio e
// atualização automática do painel.
import { createContext, useContext, useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { classesBotao } from "./ui";
import { cn } from "@/lib/cn";

const FecharCtx = createContext<() => void>(() => {});
/** Dentro de um diálogo: fecha o diálogo (ex.: depois de salvar). */
export function useFecharDialogo() {
  return useContext(FecharCtx);
}

export function DialogoBase({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  larga,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  larga?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (aberto && !d.open) d.showModal();
    if (!aberto && d.open) d.close();
  }, [aberto]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onClose={aoFechar}
      onClick={(e) => {
        if (e.target === ref.current) aoFechar();
      }}
      className={cn(
        "painel m-auto w-[min(100%-2rem,32rem)] max-h-[88dvh] overflow-y-auto overscroll-contain border-borda-forte p-0 text-texto",
        "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[env(safe-area-inset-bottom)]",
        larga && "sm:w-[min(100%-2rem,44rem)]",
      )}
    >
      {aberto && (
        <div className="p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 id={id} className="font-display text-lg font-semibold">
                {titulo}
              </h2>
              {descricao && <p className="mt-0.5 text-sm text-suave">{descricao}</p>}
            </div>
            <button type="button" onClick={aoFechar} className={classesBotao("fantasma", "icone", "-mr-2 -mt-1")} aria-label="Fechar">
              <X className="h-5 w-5" />
            </button>
          </div>
          <FecharCtx.Provider value={aoFechar}>{children}</FecharCtx.Provider>
        </div>
      )}
    </dialog>
  );
}

/** Botão que abre um diálogo. O conteúdo só monta aberto (formulário limpo a cada vez). */
export function Dialogo({
  gatilho,
  classeGatilho,
  rotuloGatilho,
  ...resto
}: {
  gatilho: ReactNode;
  classeGatilho?: string;
  rotuloGatilho?: string;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  larga?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={rotuloGatilho}
        className={classeGatilho ?? classesBotao("secundario", "m")}
        onClick={() => setAberto(true)}
      >
        {gatilho}
      </button>
      <DialogoBase aberto={aberto} aoFechar={() => setAberto(false)} {...resto} />
    </>
  );
}

export function BotaoEnvio({
  children,
  pendente,
  variante = "primario",
  tamanho = "m",
  className,
  ...props
}: ComponentProps<"button"> & {
  pendente?: ReactNode;
  variante?: Parameters<typeof classesBotao>[0];
  tamanho?: Parameters<typeof classesBotao>[1];
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props} className={classesBotao(variante, tamanho, className)}>
      {pending && pendente ? pendente : children}
    </button>
  );
}

/** Atualiza os dados da página a cada minuto e quando o app volta para a frente. */
export function Atualizador({ segundos = 60 }: { segundos?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), segundos * 1000);
    const vis = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [router, segundos]);
  return null;
}

export function Relogio({ fuso, className }: { fuso: string; className?: string }) {
  const [agora, setAgora] = useState<string | null>(null);
  useEffect(() => {
    const f = new Intl.DateTimeFormat("pt-BR", { timeZone: fuso, hour: "2-digit", minute: "2-digit" });
    const tique = () => setAgora(f.format(new Date()));
    tique();
    const t = setInterval(tique, 10_000);
    return () => clearInterval(t);
  }, [fuso]);
  return (
    <time suppressHydrationWarning className={cn("numero", className)}>
      {agora ?? "--:--"}
    </time>
  );
}

/**
 * Mantém o que foi digitado depois de enviar (o React 19 limpa o formulário ao fim de toda ação;
 * com erro de validação a pessoa perderia tudo). Uso: <form action={acao} onReset={manterValores}>.
 */
export function manterValores(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
}
