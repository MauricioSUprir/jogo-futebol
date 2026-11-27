import type { CSSProperties } from "react";
import { Moon, ShieldCheck, Smartphone } from "lucide-react";
import { AcoesHeroi } from "@/components/inicio/acoes-heroi";
import { MarcaAnimada } from "@/components/inicio/marca-animada";
import { PresentesFlutuantes } from "@/components/inicio/presentes-flutuantes";
import { Vitrine } from "@/components/inicio/vitrine";

const atraso = (s: number) => ({ ["--atraso" as string]: `${s}s` }) as CSSProperties;

export function Heroi() {
  return (
    <section aria-labelledby="titulo-inicio" className="relative isolate overflow-hidden px-4 pb-16 pt-8 sm:pb-24 sm:pt-14">
      <PresentesFlutuantes />
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.12fr_0.88fr] lg:gap-8">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="surgir" style={atraso(0)}>
            <MarcaAnimada tamanho={84} />
          </div>
          <p
            className="surgir vidro mt-2 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full px-4 py-1.5 text-xs font-semibold text-suave sm:text-sm"
            style={atraso(0.08)}
          >
            <span className="text-rubi">Sorteio seguro</span>
            <span aria-hidden>·</span>
            <span className="text-esmeralda">Lista de desejos</span>
            <span aria-hidden>·</span>
            <span className="text-ouro-escuro dark:text-ouro-claro">Revelação inesquecível</span>
          </p>
          <h1
            id="titulo-inicio"
            className="surgir mt-5 max-w-2xl font-titulo text-[2.55rem] font-semibold leading-[1.04] tracking-tight [text-wrap:balance] sm:text-6xl lg:text-[4.4rem]"
            style={atraso(0.15)}
          >
            Amigo oculto com <span className="texto-ouro italic">magia</span>, do convite à revelação
          </h1>
          <p className="surgir mt-5 max-w-xl text-base leading-relaxed text-suave [text-wrap:pretty] sm:text-lg" style={atraso(0.25)}>
            Crie o grupo em minutos, convide por link, QR Code ou WhatsApp, deixe o sorteio com a gente e viva uma revelação de cinema — no
            celular de cada um ou todos juntos no telão.
          </p>
          <div className="surgir w-full" style={atraso(0.35)}>
            <AcoesHeroi />
          </div>
          <ul className="surgir mt-7 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-suave lg:justify-start" style={atraso(0.45)}>
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-esmeralda" aria-hidden /> Nem o organizador vê o resultado
            </li>
            <li className="flex items-center gap-1.5">
              <Smartphone className="size-4 text-rubi" aria-hidden /> Feito para o celular
            </li>
            <li className="flex items-center gap-1.5">
              <Moon className="size-4 text-ouro" aria-hidden /> Modo claro e escuro
            </li>
          </ul>
        </div>
        <Vitrine />
      </div>
    </section>
  );
}
