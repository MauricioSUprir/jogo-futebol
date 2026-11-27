"use client";
import { useId, useRef, useState, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { chaveDeTexto, normalizarEtiquetas } from "@/components/desejos/regras";

/**
 * Campo de etiquetas: digite e aperte Enter (ou vírgula) para adicionar; cada etiqueta tem o botão de remover.
 * Backspace com o campo vazio remove a última. As sugestões viram etiquetas com um toque.
 */
export function CampoEtiquetas({
  rotulo,
  dica,
  valores,
  aoMudar,
  limite = 20,
  tamanho = 40,
  sugestoes = [],
  placeholder = "Digite e aperte Enter",
  amostra,
  erro,
  tom = "neutro",
}: {
  rotulo: string;
  dica?: ReactNode;
  valores: string[];
  aoMudar: (v: string[]) => void;
  limite?: number;
  tamanho?: number;
  sugestoes?: { nome: string; cor?: string }[];
  placeholder?: string;
  amostra?: (valor: string) => string | null;
  erro?: string;
  tom?: "neutro" | "rubi";
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const cheio = valores.length >= limite;

  function adicionar(bruto: string) {
    const partes = bruto.split(/[,;\n]/).map((p) => p.trim()).filter(Boolean);
    if (!partes.length) return;
    if (cheio) {
      setAviso(`No máximo ${limite}.`);
      return;
    }
    const nova = normalizarEtiquetas([...valores, ...partes], limite, tamanho);
    if (nova.length === valores.length) setAviso("Essa já está na lista.");
    else setAviso(null);
    aoMudar(nova);
    setTexto("");
  }

  const existentes = new Set(valores.map(chaveDeTexto));
  const sugestoesLivres = sugestoes.filter((s) => !existentes.has(chaveDeTexto(s.nome)));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-sm font-semibold">{rotulo}</legend>
      {valores.length ? (
        <ul className="flex flex-wrap gap-2" aria-label={`${rotulo}: ${valores.length} de ${limite}`}>
          {valores.map((v) => {
            const cor = amostra?.(v) ?? null;
            return (
              <li
                key={v}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-full border py-1 pl-3 pr-1 text-sm font-medium",
                  tom === "rubi" ? "border-rubi/25 bg-rubi/8 text-rubi" : "border-borda bg-white/60 dark:bg-white/8",
                )}
              >
                {cor ? <span aria-hidden className="size-4 rounded-full border border-black/15 dark:border-white/25" style={{ background: cor }} /> : null}
                {v}
                <button
                  type="button"
                  onClick={() => {
                    aoMudar(valores.filter((x) => x !== v));
                    campo.current?.focus();
                  }}
                  aria-label={`Remover ${v}`}
                  className="inline-flex size-7 items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/15"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <label htmlFor={id} className="sr-only">
          Adicionar em {rotulo}
        </label>
        <input
          ref={campo}
          id={id}
          value={texto}
          disabled={cheio}
          maxLength={tamanho + 5}
          onChange={(e) => {
            const v = e.target.value;
            if (/[,;]/.test(v)) adicionar(v);
            else setTexto(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar(texto);
            } else if (e.key === "Backspace" && !texto && valores.length) {
              aoMudar(valores.slice(0, -1));
            }
          }}
          onBlur={() => texto.trim() && adicionar(texto)}
          placeholder={cheio ? `Limite de ${limite} atingido` : placeholder}
          aria-invalid={erro ? true : undefined}
          aria-describedby={`${id}-dica`}
          className="h-11 min-w-0 flex-1 rounded-2xl border border-borda bg-white/70 px-4 text-[15px] placeholder:text-suave/70 focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 disabled:opacity-60 dark:bg-white/5"
        />
        <button
          type="button"
          onClick={() => adicionar(texto)}
          disabled={!texto.trim() || cheio}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full border border-borda px-4 text-sm font-semibold transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
        >
          <Plus className="size-4" aria-hidden /> Adicionar
        </button>
      </div>
      <p id={`${id}-dica`} className={cn("text-xs", erro || aviso ? "font-medium text-rubi" : "text-suave")} aria-live="polite">
        {erro ?? aviso ?? dica}
      </p>
      {sugestoesLivres.length && !cheio ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Sugestões para ${rotulo}`}>
          {sugestoesLivres.map((s) => (
            <button
              key={s.nome}
              type="button"
              onClick={() => adicionar(s.nome)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-dashed border-borda px-3 text-[13px] font-medium text-suave transition hover:border-ouro hover:text-texto"
            >
              {s.cor ? <span aria-hidden className="size-3.5 rounded-full border border-black/15 dark:border-white/25" style={{ background: s.cor }} /> : <Plus className="size-3.5" aria-hidden />}
              {s.nome}
            </button>
          ))}
        </div>
      ) : null}
    </fieldset>
  );
}
