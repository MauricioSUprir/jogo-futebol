"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, TicketCheck } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { cn } from "@/lib/cn";
import { codigoDoConvite } from "@/components/painel/dados";

/** Campo "Entrar com código": aceita o código de 8 letras ou o link do convite e leva para /convite/<CÓDIGO>. */
export function EntrarComCodigo({ className, compacto }: { className?: string; compacto?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [valor, setValor] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();
  return (
    <form
      className={cn("flex flex-col gap-1.5", className)}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const codigo = codigoDoConvite(valor);
        if (!codigo) {
          setErro("O código tem 8 letras e números (está no convite que você recebeu).");
          return;
        }
        setErro(null);
        iniciar(() => router.push(`/convite/${codigo}`));
      }}
    >
      <label htmlFor={id} className={cn("text-sm font-semibold", compacto && "sr-only")}>
        Entrar com código
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <TicketCheck className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-suave" aria-hidden />
          <input
            id={id}
            value={valor}
            onChange={(e) => {
              setValor(e.target.value);
              if (erro) setErro(null);
            }}
            placeholder="Ex.: RW7V3X2H"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={300}
            aria-invalid={erro ? true : undefined}
            aria-describedby={erro ? `${id}-erro` : undefined}
            className="h-12 w-full rounded-full border border-borda bg-white/70 pl-11 pr-4 font-mono text-[15px] uppercase tracking-[0.18em] text-texto placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-suave/70 focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 aria-[invalid=true]:border-rubi dark:bg-white/5"
          />
        </div>
        <Botao type="submit" variante="ouro" className="h-12 shrink-0" carregando={indo} aria-label="Entrar no grupo com este código">
          <span className="hidden sm:inline">Entrar</span>
          <ArrowRight className="size-5" aria-hidden />
        </Botao>
      </div>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="text-sm font-medium text-rubi">
          {erro}
        </p>
      ) : null}
    </form>
  );
}
