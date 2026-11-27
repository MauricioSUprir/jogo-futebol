/** Presentinho em SVG para decoração (caixa, tampa, fita e laço). Sempre decorativo (aria-hidden). */
export const CORES_PRESENTE = {
  rubi: { caixa: "#c0182f", tampa: "#e2394f", fita: "#f2cf6b", contorno: "#8f0f22" },
  esmeralda: { caixa: "#0a7a55", tampa: "#19b383", fita: "#f2cf6b", contorno: "#064d36" },
  ouro: { caixa: "#d9a63c", tampa: "#f2cf6b", fita: "#c0182f", contorno: "#8c6516" },
  neve: { caixa: "#fffdf8", tampa: "#ffffff", fita: "#c0182f", contorno: "#d9ccb1" },
  vinho: { caixa: "#8f0f22", tampa: "#b3172d", fita: "#19b383", contorno: "#5c0816" },
} as const;

export type CorPresente = keyof typeof CORES_PRESENTE;

export function PresenteSvg({ cor = "rubi", tamanho = 56, className }: { cor?: CorPresente; tamanho?: number; className?: string }) {
  const c = CORES_PRESENTE[cor];
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} className={className} aria-hidden>
      <rect x="10" y="28" width="44" height="30" rx="5" fill={c.caixa} stroke={c.contorno} strokeWidth="1" />
      <rect x="12.5" y="34" width="5" height="20" rx="2.5" fill="#fff" opacity=".2" />
      <rect x="10" y="30.5" width="44" height="3.5" fill="#000" opacity=".12" />
      <rect x="6" y="20" width="52" height="11" rx="4" fill={c.tampa} stroke={c.contorno} strokeWidth="1" />
      <rect x="28" y="20" width="8" height="38" fill={c.fita} />
      <rect x="29.5" y="21" width="2" height="36" fill="#fff" opacity=".35" />
      <path d="M32 20 C 24 12, 14 10, 16 4.5 C 18 0, 27 4, 32 18 Z" fill={c.fita} stroke={c.contorno} strokeWidth=".8" />
      <path d="M32 20 C 40 12, 50 10, 48 4.5 C 46 0, 37 4, 32 18 Z" fill={c.fita} stroke={c.contorno} strokeWidth=".8" opacity=".92" />
      <circle cx="32" cy="19" r="3.6" fill={c.fita} stroke={c.contorno} strokeWidth=".8" />
    </svg>
  );
}

/** Estrelinha de quatro pontas (brilho). */
export function Brilho({ tamanho = 16, cor = "#f2cf6b", className }: { tamanho?: number; cor?: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={tamanho} height={tamanho} className={className} aria-hidden>
      <path d="M12 0 C 13 8, 16 11, 24 12 C 16 13, 13 16, 12 24 C 11 16, 8 13, 0 12 C 8 11, 11 8, 12 0 Z" fill={cor} />
    </svg>
  );
}
