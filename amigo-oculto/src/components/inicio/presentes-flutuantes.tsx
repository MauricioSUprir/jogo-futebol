import type { CSSProperties } from "react";
import { Brilho, PresenteSvg, type CorPresente } from "@/components/inicio/presente-svg";

/**
 * Presentes, estrelas e confetes flutuando atrás do herói. Só CSS (nada de JavaScript): surgem com um esmaecer e
 * flutuam no compositor; com "reduzir movimento" (sistema ou conta) ficam parados. Os mais distantes do texto
 * só aparecem do tablet para cima, para não pesar nem poluir o celular.
 */
type Item = { x: string; y: string; t: number; cor: CorPresente; giro: number; dur: number; atraso: number; so?: "cel" | "sm" | "lg"; desfoque?: boolean };

const PRESENTES: Item[] = [
  { x: "2%", y: "2%", t: 52, cor: "rubi", giro: -12, dur: 7, atraso: 0.1, so: "sm" },
  { x: "5%", y: "1.2%", t: 42, cor: "rubi", giro: -12, dur: 7, atraso: 0.1, so: "cel" },
  { x: "84%", y: "38%", t: 40, cor: "rubi", giro: -10, dur: 7.2, atraso: 0.15, so: "lg" },
  { x: "86%", y: "4%", t: 46, cor: "esmeralda", giro: 10, dur: 8.5, atraso: 0.25 },
  { x: "90%", y: "58%", t: 62, cor: "ouro", giro: -8, dur: 9, atraso: 0.4, so: "sm" },
  { x: "1%", y: "62%", t: 44, cor: "neve", giro: 14, dur: 7.5, atraso: 0.55, so: "sm" },
  { x: "44%", y: "1%", t: 34, cor: "vinho", giro: 6, dur: 6.5, atraso: 0.7, so: "lg", desfoque: true },
  { x: "56%", y: "88%", t: 40, cor: "rubi", giro: -16, dur: 8, atraso: 0.85, so: "lg", desfoque: true },
  { x: "18%", y: "90%", t: 36, cor: "esmeralda", giro: 12, dur: 9.5, atraso: 1, so: "lg" },
  { x: "70%", y: "30%", t: 30, cor: "neve", giro: -6, dur: 7, atraso: 1.1, so: "lg", desfoque: true },
];

const BRILHOS: [string, string, number, number][] = [
  ["6%", "22%", 14, 2.4], ["30%", "3%", 10, 3.1], ["90%", "8%", 16, 2.7], ["95%", "36%", 11, 3.5],
  ["5%", "40%", 9, 2.9], ["64%", "4%", 12, 3.3], ["40%", "97%", 10, 2.6], ["88%", "90%", 14, 3],
];

const CONFETES: [string, string, string, number][] = [
  ["4%", "30%", "#e2394f", 20], ["94%", "14%", "#19b383", -30], ["95%", "52%", "#f2cf6b", 45], ["3%", "47%", "#19b383", -15],
  ["36%", "84%", "#f2cf6b", 60], ["60%", "70%", "#e2394f", -50], ["48%", "14%", "#f2cf6b", 25],
];

const visivel = (so?: Item["so"]) => (so === "cel" ? "sm:hidden" : so === "sm" ? "hidden sm:block" : so === "lg" ? "hidden lg:block" : "");

export function PresentesFlutuantes() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {PRESENTES.map((p, i) => (
        <div
          key={i}
          className={`surgir absolute ${visivel(p.so)}`}
          style={{ left: p.x, top: p.y, ["--atraso" as string]: `${p.atraso}s` } as CSSProperties}
        >
          <div
            className="flutuar drop-shadow-[0_12px_18px_rgb(60_20_10/0.22)]"
            style={{ ["--duracao" as string]: `${p.dur}s`, ["--giro" as string]: `${p.giro}deg`, filter: p.desfoque ? "blur(1.5px)" : undefined } as CSSProperties}
          >
            <PresenteSvg cor={p.cor} tamanho={p.t} />
          </div>
        </div>
      ))}
      {BRILHOS.map(([x, y, t, d], i) => (
        <div key={`b${i}`} className="cintilar absolute" style={{ left: x, top: y, ["--duracao" as string]: `${d}s` } as CSSProperties}>
          <Brilho tamanho={t} cor={i % 3 === 0 ? "#e2b04a" : "#f2cf6b"} />
        </div>
      ))}
      {CONFETES.map(([x, y, cor, giro], i) => (
        <span
          key={`c${i}`}
          className={`flutuar absolute block h-2.5 w-1.5 rounded-[2px] opacity-70 ${i > 3 ? "hidden sm:block" : ""}`}
          style={{ left: x, top: y, background: cor, ["--giro" as string]: `${giro}deg`, ["--duracao" as string]: `${5 + i}s` } as CSSProperties}
        />
      ))}
    </div>
  );
}
