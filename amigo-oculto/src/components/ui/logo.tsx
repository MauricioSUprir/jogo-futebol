import { cn } from "@/lib/cn";

/** Marca: uma caixa de presente com laço em forma de estrela e um ponto de interrogação discreto na fita. */
export function MarcaPresente({ tamanho = 40, className }: { tamanho?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={tamanho} height={tamanho} className={className} aria-hidden>
      <defs>
        <linearGradient id="mp-caixa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e2394f" />
          <stop offset="1" stopColor="#8f0f22" />
        </linearGradient>
        <linearGradient id="mp-tampa" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ef4a5f" />
          <stop offset="1" stopColor="#b3172d" />
        </linearGradient>
        <linearGradient id="mp-ouro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1c2" />
          <stop offset=".45" stopColor="#f2cf6b" />
          <stop offset="1" stopColor="#b8861f" />
        </linearGradient>
        <linearGradient id="mp-verde" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#19b383" />
          <stop offset="1" stopColor="#064d36" />
        </linearGradient>
      </defs>
      <rect x="10" y="30" width="44" height="28" rx="6" fill="url(#mp-caixa)" />
      <rect x="7" y="22" width="50" height="11" rx="5" fill="url(#mp-tampa)" />
      <rect x="28" y="22" width="8" height="36" fill="url(#mp-verde)" />
      <path d="M32 4.5l3.1 7.2 7.8.6-5.9 5.1 1.9 7.6L32 21l-6.9 4 1.9-7.6-5.9-5.1 7.8-.6z" fill="url(#mp-ouro)" />
      <circle cx="32" cy="44" r="6.2" fill="#fffdf8" opacity=".95" />
      <path
        d="M30 42.2c.2-1.4 1.2-2.2 2.4-2.2 1.4 0 2.4.9 2.4 2.1 0 1.8-2.4 1.9-2.4 3.6"
        fill="none"
        stroke="#8f0f22"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="32.4" cy="47.8" r=".95" fill="#8f0f22" />
    </svg>
  );
}

export function Logo({ className, tamanho = 36, comTexto = true }: { className?: string; tamanho?: number; comTexto?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <MarcaPresente tamanho={tamanho} />
      {comTexto ? (
        <span className="font-titulo text-[1.35rem] font-semibold leading-none tracking-tight">
          Amigo <span className="texto-ouro italic">Oculto</span>
        </span>
      ) : (
        <span className="sr-only">Amigo Oculto</span>
      )}
    </span>
  );
}
