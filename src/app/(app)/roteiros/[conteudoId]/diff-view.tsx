"use client";

import { diffWords } from "diff";
import { BLOCOS_ROTEIRO } from "@/lib/constants";

type Blocos = Record<string, string>;

/** Diff lado a lado (bloco a bloco) entre duas versões. */
export function DiffView({
  a,
  b,
  versaoA,
  versaoB,
}: {
  a: Blocos;
  b: Blocos;
  versaoA: number;
  versaoB: number;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm font-semibold">
        <div>v{versaoA} (antes)</div>
        <div>v{versaoB} (depois)</div>
      </div>
      {BLOCOS_ROTEIRO.map((bloco) => {
        const textoA = a?.[bloco.key] ?? "";
        const textoB = b?.[bloco.key] ?? "";
        const partes = diffWords(textoA, textoB);
        return (
          <div key={bloco.key} className="rounded-md border">
            <div className="border-b bg-muted/50 px-3 py-1.5 text-xs font-semibold">{bloco.label}</div>
            <div className="grid grid-cols-2 divide-x">
              <div className="whitespace-pre-wrap p-3 text-sm">
                {partes.map((p, i) =>
                  p.added ? null : (
                    <span
                      key={i}
                      className={p.removed ? "rounded bg-red-100 text-red-800 line-through dark:bg-red-900/40 dark:text-red-300" : ""}
                    >
                      {p.value}
                    </span>
                  ),
                )}
                {textoA === "" && <span className="text-muted-foreground">(vazio)</span>}
              </div>
              <div className="whitespace-pre-wrap p-3 text-sm">
                {partes.map((p, i) =>
                  p.removed ? null : (
                    <span
                      key={i}
                      className={p.added ? "rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : ""}
                    >
                      {p.value}
                    </span>
                  ),
                )}
                {textoB === "" && <span className="text-muted-foreground">(vazio)</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
