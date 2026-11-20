// Cartão de apoio do Mind Center: discreto no fim da página; no topo, com texto acolhedor, quando o humor
// registrado esteve baixo em vários dos últimos check-ins. Não é diagnóstico nem alarme.
import { HeartHandshake, Phone } from "lucide-react";
import { cn } from "@/lib/cn";

export function CartaoApoio({ destaque }: { destaque?: boolean }) {
  return (
    <aside
      aria-label="Apoio"
      className={cn(
        "rounded-2xl border p-4 text-sm",
        destaque ? "mb-4 border-violeta/40 bg-violeta/10 animate-entrar" : "mt-6 border-borda bg-fundo-2/50 text-suave",
      )}
    >
      <div className="flex gap-3">
        <HeartHandshake className={cn("mt-0.5 h-5 w-5 shrink-0", destaque ? "text-violeta-claro" : "text-apagado")} aria-hidden />
        <div className="min-w-0">
          {destaque && (
            <p className="mb-1 font-medium text-texto">Seus últimos dias parecem ter sido pesados. Você não precisa passar por isso sozinho.</p>
          )}
          <p>
            Se estiver difícil, fale com um adulto de confiança. CVV: ligue{" "}
            <a href="tel:188" className="font-semibold text-texto underline decoration-violeta-claro/60 underline-offset-2">
              188
            </a>{" "}
            (24 h, gratuito) ou acesse{" "}
            <a href="https://cvv.org.br" target="_blank" rel="noopener noreferrer" className="text-texto underline decoration-violeta-claro/60 underline-offset-2">
              cvv.org.br
            </a>
            .
          </p>
          {destaque && (
            <a href="tel:188" className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-violeta/40 px-4 font-medium text-texto hover:bg-violeta/15">
              <Phone className="h-4 w-4" aria-hidden /> Ligar para o CVV (188)
            </a>
          )}
        </div>
      </div>
    </aside>
  );
}
