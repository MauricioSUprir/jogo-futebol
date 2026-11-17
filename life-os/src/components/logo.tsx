import { cn } from "@/lib/cn";

/** Marca do LIFE OS: um anel com núcleo (o "reator") + o nome. */
export function MarcaLifeOs({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <linearGradient id="lo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22d3ee" />
          <stop offset=".5" stopColor="#2563eb" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="19" fill="none" stroke="url(#lo-g)" strokeWidth="3.2" />
      <circle cx="24" cy="24" r="12.5" fill="none" stroke="url(#lo-g)" strokeWidth="1.6" strokeDasharray="4 3.2" opacity=".85" />
      <circle cx="24" cy="24" r="5.5" fill="url(#lo-g)" />
    </svg>
  );
}

export function Logo({ tamanho = "m", soMarca }: { tamanho?: "m" | "g"; soMarca?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <MarcaLifeOs className={cn(tamanho === "g" ? "h-10 w-10" : "h-8 w-8", "drop-shadow-[0_0_10px_rgb(37_99_235/0.6)]")} />
      {!soMarca && (
        <span className={cn("font-display font-bold tracking-[0.18em]", tamanho === "g" ? "text-2xl" : "text-lg")}>
          LIFE <span className="texto-holo">OS</span>
        </span>
      )}
    </span>
  );
}
