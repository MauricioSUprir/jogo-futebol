/**
 * Logo do CreateFlow (câmera + play + checklist, com arcos rosa e amarelo).
 * SVG inline: nítido em qualquer tamanho e funciona nos dois temas.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="CreateFlow"
      className={className}
    >
      <defs>
        <linearGradient id="cfPk" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f5348b" />
          <stop offset="1" stopColor="#ff86bd" />
        </linearGradient>
        <linearGradient id="cfLens" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd3e6" />
          <stop offset="1" stopColor="#ff9dcb" />
        </linearGradient>
      </defs>
      <path d="M40 30 A34 32 0 0 1 86 33" fill="none" stroke="#ffc21f" strokeWidth="4" strokeLinecap="round" />
      <circle cx="88" cy="34" r="4" fill="#ffc21f" />
      <path d="M34 90 A34 32 0 0 0 80 94" fill="none" stroke="#f5348b" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="89" r="4" fill="#f5348b" />
      <rect x="26" y="42" width="56" height="40" rx="13" fill="#ffffff" stroke="#efe1ea" strokeWidth="2" />
      <path d="M84 51 L99 44 L99 80 L84 73 Z" fill="url(#cfLens)" />
      <path d="M37 53 L52 62 L37 71 Z" fill="url(#cfPk)" />
      <circle cx="63" cy="52" r="3.8" fill="#ffc21f" />
      <rect x="59.5" y="58.5" width="7" height="7" rx="1.6" fill="url(#cfPk)" />
      <path d="M59.5 73 L66.5 73 L63 67 Z" fill="#ffc21f" />
      <rect x="70" y="50.5" width="8" height="3" rx="1.5" fill="#ece0e8" />
      <rect x="70" y="60.5" width="8" height="3" rx="1.5" fill="#ece0e8" />
      <rect x="70" y="70" width="8" height="3" rx="1.5" fill="#ece0e8" />
    </svg>
  );
}
