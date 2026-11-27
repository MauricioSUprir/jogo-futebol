import { cn } from "@/lib/cn";
import { urlPublicaDaMidia } from "@/lib/env";

const CORES = ["#c0182f", "#0a7a55", "#c9962b", "#7b4de0", "#d63c7a", "#1d4ed8", "#0f766e", "#b45309"];

function corDoNome(nome: string) {
  let h = 0;
  for (const c of nome) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CORES[h % CORES.length];
}

export function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return ((partes[0][0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/** Foto de perfil (Storage público ou Google) ou as iniciais numa cor estável. */
export function Avatar({
  nome,
  caminho,
  tamanho = 40,
  className,
  anel,
}: {
  nome: string;
  caminho?: string | null;
  tamanho?: number;
  className?: string;
  anel?: boolean;
}) {
  const url = urlPublicaDaMidia(caminho);
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.max(11, tamanho * 0.38) };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Foto de ${nome}`}
      width={tamanho}
      height={tamanho}
      loading="lazy"
      referrerPolicy="no-referrer"
      className={cn("shrink-0 rounded-full object-cover", anel && "ring-2 ring-ouro-claro ring-offset-2 ring-offset-transparent", className)}
      style={estilo}
    />
  ) : (
    <span
      role="img"
      aria-label={nome}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white",
        anel && "ring-2 ring-ouro-claro ring-offset-2 ring-offset-transparent",
        className,
      )}
      style={{ ...estilo, background: `linear-gradient(135deg, ${corDoNome(nome)}, color-mix(in oklab, ${corDoNome(nome)} 65%, black))` }}
    >
      {iniciais(nome)}
    </span>
  );
}
