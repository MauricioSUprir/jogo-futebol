// Indicador circular (água, conclusão do dia).
export function Anel({
  pct,
  tamanho = 120,
  espessura = 10,
  cor = "url(#grad-anel)",
  children,
  rotulo,
}: {
  pct: number;
  tamanho?: number;
  espessura?: number;
  cor?: string;
  children?: React.ReactNode;
  rotulo?: string;
}) {
  const r = (tamanho - espessura) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative shrink-0" style={{ width: tamanho, height: tamanho }} role="img" aria-label={rotulo ?? `${Math.round(v)}%`}>
      <svg width={tamanho} height={tamanho} className="-rotate-90" aria-hidden>
        <defs>
          <linearGradient id="grad-anel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="rgb(148 163 184 / 0.12)" strokeWidth={espessura} />
        <circle
          cx={tamanho / 2}
          cy={tamanho / 2}
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(.2,.8,.2,1)", filter: "drop-shadow(0 0 6px rgb(37 99 235 / 0.55))" }}
        />
      </svg>
      <div className="absolute inset-0 grid grid-cols-1 place-items-center text-center">{children}</div>
    </div>
  );
}
