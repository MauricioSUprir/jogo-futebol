import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Cartões virtuais: 8 modelos desenhados em SVG/CSS (sem imagens de fora). O cartão tem o próprio "papel",
 * então as cores dele são fixas e legíveis tanto no tema claro quanto no escuro.
 */
export const MODELOS = ["estrela", "arvore", "presente", "neve", "bolo", "balao", "classico", "brinde"] as const;
export type Modelo = (typeof MODELOS)[number];

export const NOMES_MODELOS: Record<Modelo, string> = {
  estrela: "Noite estrelada",
  arvore: "Árvore de Natal",
  presente: "Presente",
  neve: "Neve",
  bolo: "Bolo de festa",
  balao: "Balões",
  classico: "Clássico dourado",
  brinde: "Brinde",
};

const ESTILOS: Record<Modelo, { fundo: string; texto: string; suave: string; titulo: string }> = {
  estrela: { fundo: "linear-gradient(160deg,#0d1b3d 0%,#1d2f6b 55%,#3a2a74 100%)", texto: "#f5f1ff", suave: "#c9c3ee", titulo: "#f7d983" },
  arvore: { fundo: "linear-gradient(165deg,#0b5a3f 0%,#0a7a55 60%,#064d36 100%)", texto: "#f4fff9", suave: "#bfe8d6", titulo: "#f7d983" },
  presente: { fundo: "linear-gradient(160deg,#a10f25 0%,#c0182f 55%,#7a0b1c 100%)", texto: "#fff5f6", suave: "#ffcfd6", titulo: "#ffe9a6" },
  neve: { fundo: "linear-gradient(170deg,#eaf4ff 0%,#d8e9fb 55%,#f8fbff 100%)", texto: "#16304d", suave: "#4b6683", titulo: "#1d4e89" },
  bolo: { fundo: "linear-gradient(165deg,#fff0f5 0%,#ffd9e6 60%,#ffe8cc 100%)", texto: "#4a1830", suave: "#7d4a62", titulo: "#c2185b" },
  balao: { fundo: "linear-gradient(160deg,#6d3fd6 0%,#b04fc7 55%,#ec6aa0 100%)", texto: "#fff7fc", suave: "#f6d6ee", titulo: "#fff1b8" },
  classico: { fundo: "linear-gradient(165deg,#fffaf0 0%,#f6ecd6 100%)", texto: "#1f3a33", suave: "#5b6f66", titulo: "#0a6b4b" },
  brinde: { fundo: "linear-gradient(165deg,#2a0f1c 0%,#4b1630 55%,#1c0a14 100%)", texto: "#fbf1e3", suave: "#e3c9b4", titulo: "#f2cf6b" },
};

function Ornamento({ modelo }: { modelo: Modelo }) {
  switch (modelo) {
    case "estrela":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          {[[30, 30, 3], [70, 80, 2], [250, 25, 2.5], [270, 95, 3], [200, 60, 1.8], [110, 20, 1.6], [45, 115, 2], [160, 110, 1.6]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="#fff1c2" opacity={0.85} />
          ))}
          <path d="M150 18l11 24 26 3-19 18 5 26-23-13-23 13 5-26-19-18 26-3z" fill="#f7d983" />
          <path d="M150 18l11 24 26 3-19 18 5 26-23-13" fill="#fff1c2" opacity=".45" />
          <path d="M20 130 Q150 70 280 130" stroke="#f7d983" strokeOpacity=".35" strokeWidth="1.5" fill="none" strokeDasharray="2 6" />
        </svg>
      );
    case "arvore":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          <path d="M150 12l7 14 15 2-11 10 3 15-14-8-14 8 3-15-11-10 15-2z" fill="#f7d983" />
          <path d="M150 34 L112 82 h18 L100 116 h100 L170 82 h18 Z" fill="#0f9a6a" stroke="#d6f5e7" strokeOpacity=".35" />
          <rect x="140" y="116" width="20" height="16" rx="2" fill="#7a4b22" />
          {[[130, 76, "#e2394f"], [168, 72, "#f7d983"], [123, 104, "#f7d983"], [176, 100, "#e2394f"], [150, 92, "#fff"], [146, 60, "#e2394f"]].map(([x, y, c], i) => (
            <circle key={i} cx={x as number} cy={y as number} r="4.2" fill={c as string} />
          ))}
          {[[40, 40], [260, 30], [60, 100], [245, 110], [25, 75], [280, 70]].map(([x, y], i) => (
            <g key={i} stroke="#fff" strokeOpacity=".6" strokeWidth="1.2">
              <path d={`M${x - 5} ${y}h10M${x} ${y - 5}v10M${x - 3.5} ${y - 3.5}l7 7M${x + 3.5} ${y - 3.5}l-7 7`} />
            </g>
          ))}
        </svg>
      );
    case "presente":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          <rect x="105" y="58" width="90" height="70" rx="8" fill="#fff5f6" opacity=".95" />
          <rect x="98" y="44" width="104" height="22" rx="6" fill="#ffe0e5" />
          <rect x="143" y="44" width="14" height="84" fill="#f2cf6b" />
          <path d="M150 44 C130 14, 102 26, 120 42 Z M150 44 C170 14, 198 26, 180 42 Z" fill="#f2cf6b" />
          <circle cx="150" cy="44" r="7" fill="#e2b04a" />
          {[[40, 30], [260, 40], [55, 110], [250, 105]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z`} fill="#ffe9a6" opacity=".9" />
          ))}
        </svg>
      );
    case "neve":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          {[[150, 62, 34], [60, 40, 14], [240, 46, 18], [40, 110, 10], [265, 110, 12], [105, 105, 8], [200, 112, 9]].map(([x, y, s], i) => (
            <g key={i} stroke="#5b8fcf" strokeWidth={i === 0 ? 3 : 1.6} strokeLinecap="round" opacity={i === 0 ? 0.95 : 0.6}>
              {[0, 60, 120].map((a) => (
                <g key={a} transform={`rotate(${a} ${x} ${y})`}>
                  <path d={`M${x} ${y - s}V${y + s}`} />
                  <path d={`M${x - s * 0.28} ${y - s * 0.72}L${x} ${y - s * 0.48}L${x + s * 0.28} ${y - s * 0.72}`} fill="none" />
                  <path d={`M${x - s * 0.28} ${y + s * 0.72}L${x} ${y + s * 0.48}L${x + s * 0.28} ${y + s * 0.72}`} fill="none" />
                </g>
              ))}
            </g>
          ))}
        </svg>
      );
    case "bolo":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          <rect x="100" y="78" width="100" height="48" rx="10" fill="#f48fb1" />
          <rect x="112" y="52" width="76" height="32" rx="9" fill="#fce4ec" />
          <path d="M100 92 q12 10 25 0 q12 10 25 0 q12 10 25 0 q12 10 25 0" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M112 64 q9 8 19 0 q9 8 19 0 q9 8 19 0 q9 8 19 0" stroke="#f8bbd0" strokeWidth="4" fill="none" strokeLinecap="round" />
          {[130, 150, 170].map((x, i) => (
            <g key={x}>
              <rect x={x - 3} y="30" width="6" height="22" rx="2" fill={["#7b4de0", "#f2a93b", "#19b383"][i]} />
              <path d={`M${x} 18 q6 7 0 12 q-6 -5 0 -12`} fill="#ffb300" />
            </g>
          ))}
          {[[50, 40, "#7b4de0"], [250, 50, "#19b383"], [40, 105, "#f2a93b"], [262, 100, "#e2394f"], [80, 70, "#e2394f"], [225, 82, "#7b4de0"]].map(([x, y, c], i) => (
            <rect key={i} x={x as number} y={y as number} width="8" height="4" rx="1" fill={c as string} transform={`rotate(${i * 37} ${x} ${y})`} />
          ))}
        </svg>
      );
    case "balao":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          {[[110, 50, "#ffd27a", -8], [150, 38, "#ff8fb8", 0], [192, 54, "#9fe3ff", 8]].map(([x, y, c, r], i) => (
            <g key={i} transform={`rotate(${r} ${x} ${y})`}>
              <path d={`M${x} ${(y as number) + 30} q-4 26 6 44`} stroke="#fff" strokeOpacity=".7" strokeWidth="1.2" fill="none" />
              <ellipse cx={x as number} cy={y as number} rx="22" ry="27" fill={c as string} />
              <ellipse cx={(x as number) - 7} cy={(y as number) - 9} rx="5" ry="8" fill="#fff" opacity=".45" />
              <path d={`M${(x as number) - 4} ${(y as number) + 27} h8 l-4 5z`} fill={c as string} />
            </g>
          ))}
          {[[40, 35], [262, 32], [48, 108], [255, 112]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="3" fill="#fff1b8" opacity=".8" />
          ))}
        </svg>
      );
    case "classico":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          <path d="M70 70 H128 M172 70 H230" stroke="#c9962b" strokeWidth="1.5" />
          <path d="M150 40l9 20 22 2-16 15 5 22-20-12-20 12 5-22-16-15 22-2z" fill="none" stroke="#c9962b" strokeWidth="2" />
          <path d="M150 52l5 11 12 1-9 8 3 12-11-7-11 7 3-12-9-8 12-1z" fill="#e2b04a" />
          <circle cx="70" cy="70" r="3" fill="#c9962b" />
          <circle cx="230" cy="70" r="3" fill="#c9962b" />
        </svg>
      );
    case "brinde":
      return (
        <svg viewBox="0 0 300 140" className="h-full w-full" aria-hidden>
          <g transform="rotate(-14 125 70)">
            <path d="M108 26 h34 l-4 40 q-13 12 -26 0 z" fill="#f2cf6b" opacity=".9" />
            <path d="M125 72 v38 M110 112 h30" stroke="#f2cf6b" strokeWidth="3" strokeLinecap="round" />
          </g>
          <g transform="rotate(14 175 70)">
            <path d="M158 26 h34 l-4 40 q-13 12 -26 0 z" fill="#f2cf6b" opacity=".9" />
            <path d="M175 72 v38 M160 112 h30" stroke="#f2cf6b" strokeWidth="3" strokeLinecap="round" />
          </g>
          <path d="M150 12 l3 8 8 2 -8 3 -3 8 -3 -8 -8 -3 8 -2z" fill="#fff1c2" />
          {[[130, 40, 2], [140, 30, 1.6], [168, 36, 2], [178, 46, 1.4], [60, 40, 2], [240, 35, 2.4], [70, 105, 1.6], [235, 100, 2]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} fill="none" stroke="#f7d983" strokeOpacity=".8" />
          ))}
        </svg>
      );
  }
}

export function CartaoVirtual({
  modelo,
  titulo,
  texto,
  de,
  para,
  compacto,
  className,
  rodape,
}: {
  modelo: string;
  titulo?: string | null;
  texto: string;
  de?: string | null;
  para?: string | null;
  compacto?: boolean;
  className?: string;
  rodape?: ReactNode;
}) {
  const m = (MODELOS as readonly string[]).includes(modelo) ? (modelo as Modelo) : "classico";
  const e = ESTILOS[m];
  return (
    <div
      className={cn(
        "relative isolate flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[1.4rem] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.55)]",
        compacto ? "p-3" : "p-6 sm:p-7",
        className,
      )}
      style={{ background: e.fundo, color: e.texto }}
    >
      {m === "classico" ? (
        <div aria-hidden className={cn("pointer-events-none absolute rounded-[1rem] border-2 border-[#c9962b]/70", compacto ? "inset-1.5" : "inset-3")}>
          <div className={cn("absolute rounded-[0.8rem] border border-[#c9962b]/50", compacto ? "inset-1" : "inset-1.5")} />
        </div>
      ) : null}
      <div className={cn("relative shrink-0", compacto ? "h-[34%]" : "h-[36%]")}>
        <Ornamento modelo={m} />
      </div>
      <div className={cn("relative flex min-h-0 flex-1 flex-col text-center", compacto ? "gap-1" : "gap-3")}>
        {para && !compacto ? (
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: e.suave }}>
            Para {para}
          </p>
        ) : null}
        {titulo ? (
          <p className={cn("font-titulo font-semibold leading-tight", compacto ? "line-clamp-2 text-sm" : "text-2xl sm:text-3xl")} style={{ color: e.titulo }}>
            {titulo}
          </p>
        ) : null}
        <p
          className={cn(
            "min-h-0 whitespace-pre-line break-words",
            compacto ? "line-clamp-4 text-[11px] leading-snug" : "overflow-y-auto text-[15px] leading-relaxed sm:text-base",
          )}
        >
          {texto}
        </p>
        {de ? (
          <p className={cn("mt-auto font-titulo italic", compacto ? "text-[11px]" : "text-lg")} style={{ color: e.suave }}>
            — {de}
          </p>
        ) : null}
      </div>
      {rodape}
    </div>
  );
}
