"use client";
import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Gift, KeyRound, Loader2 } from "lucide-react";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { cn } from "@/lib/cn";

/** Alfabeto dos códigos de convite (o mesmo do banco: sem I, L, O, 0 e 1, para não confundir). */
const CODIGO_VALIDO = /^[A-HJKMNP-Z2-9]{8}$/;

/** "ab3d-7kq2", "https://site/convite/AB3D7KQ2" → "AB3D7KQ2" */
export function normalizarCodigo(bruto: string): string {
  const doLink = /\/convite\/([A-Za-z0-9-]+)/.exec(bruto);
  const base = doLink ? doLink[1] : bruto;
  return base.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function erroDoCodigo(codigo: string): string | null {
  if (codigo.length === 0) return "Digite o código de 8 caracteres do convite.";
  if (codigo.length < 8) return `O código tem 8 caracteres (faltam ${8 - codigo.length}).`;
  if (/[ILO01]/.test(codigo)) return "Os códigos não usam as letras I, L e O nem os números 0 e 1. Confira o convite.";
  if (!CODIGO_VALIDO.test(codigo)) return "Código inválido. Use letras de A a Z e números de 2 a 9.";
  return null;
}

/** Os dois botões do herói e o campo de código de convite ("Entrar em um grupo" leva o foco até ele). */
export function AcoesHeroi() {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [destaque, setDestaque] = useState(false);
  const [indo, iniciar] = useTransition();
  const id = useId();

  function focarCampo() {
    campo.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    campo.current?.focus({ preventScroll: true });
    setDestaque(true);
    window.setTimeout(() => setDestaque(false), 1600);
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const problema = erroDoCodigo(codigo);
    setErro(problema);
    if (problema) {
      campo.current?.focus();
      return;
    }
    iniciar(() => router.push(`/convite/${codigo}`));
  }

  return (
    <div className="mt-8 flex flex-col items-center gap-5 lg:items-start">
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <BotaoLink href="/criar" tamanho="g" brilho className="w-full sm:w-auto">
          <Gift className="size-5" aria-hidden />
          Criar amigo oculto
        </BotaoLink>
        <Botao variante="vidro" tamanho="g" onClick={focarCampo} aria-controls={`${id}-codigo`} className="w-full sm:w-auto">
          <KeyRound className="size-5" aria-hidden />
          Entrar em um grupo
        </Botao>
      </div>

      <form
        onSubmit={enviar}
        noValidate
        aria-label="Entrar com código de convite"
        className={cn(
          "vidro w-full max-w-md rounded-[1.6rem] p-3 text-left transition-shadow duration-500",
          destaque && "shadow-[0_0_0_4px_color-mix(in_oklab,var(--ouro)_45%,transparent),var(--sombra)]",
        )}
      >
        <label htmlFor={`${id}-codigo`} className="block px-2 pb-2 text-sm font-semibold">
          Tem um código de convite?
        </label>
        <div className="flex gap-2">
          <input
            ref={campo}
            id={`${id}-codigo`}
            name="codigo"
            value={codigo}
            onChange={(e) => {
              setCodigo(normalizarCodigo(e.target.value));
              if (erro) setErro(null);
            }}
            onPaste={(e) => {
              const texto = e.clipboardData.getData("text");
              if (/\/convite\//.test(texto)) {
                e.preventDefault();
                setCodigo(normalizarCodigo(texto));
                setErro(null);
              }
            }}
            placeholder="EX.: K7M2Q9XA"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={40}
            aria-invalid={erro ? true : undefined}
            aria-describedby={`${id}-ajuda`}
            className="h-12 min-w-0 flex-1 rounded-full border border-borda bg-white/75 px-5 font-mono text-lg font-semibold uppercase tracking-[0.3em] text-texto placeholder:font-sans placeholder:text-sm placeholder:font-medium placeholder:tracking-normal placeholder:text-suave/80 focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 aria-[invalid=true]:border-rubi dark:bg-white/5"
          />
          <Botao type="submit" variante="esmeralda" className="h-12 shrink-0 px-5" disabled={indo} aria-label="Entrar no grupo com este código">
            {indo ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}
            <span className="hidden sm:inline">Entrar</span>
          </Botao>
        </div>
        <p id={`${id}-ajuda`} role={erro ? "alert" : undefined} className={cn("px-2 pt-2 text-xs", erro ? "font-semibold text-rubi" : "text-suave")}>
          {erro ?? "8 letras e números, que vêm no link ou no QR Code do convite. Dá para colar o link inteiro."}
        </p>
      </form>
    </div>
  );
}
