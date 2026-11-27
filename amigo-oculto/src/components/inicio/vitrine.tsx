import type { CSSProperties } from "react";
import { CheckCircle2, Heart, Lock, MessageCircleHeart, Palette, Ruler } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

/**
 * Ilustração do herói: um celular mostrando a revelação, com dois cartões flutuando (sorteio feito e mensagem anônima).
 * Só decoração (aria-hidden) — a experiência de verdade está na demonstração logo abaixo.
 */
export function Vitrine() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[22rem] select-none sm:max-w-[24rem]">
      <div className="surgir relative" style={{ ["--atraso" as string]: "0.35s" } as CSSProperties}>
        <div className="flutuar" style={{ ["--duracao" as string]: "8s", ["--giro" as string]: "-2deg" } as CSSProperties}>
          {/* celular */}
          <div className="relative rounded-[2.6rem] bg-[linear-gradient(145deg,#2a1d1f,#0d0f0e)] p-2.5 shadow-[0_40px_80px_-30px_rgb(60_10_20/0.65),0_0_0_1px_rgb(255_255_255/0.08)_inset]">
            <div className="palco-revelacao relative overflow-hidden rounded-[2.1rem] px-5 pb-12 pt-14">
              <div className="absolute left-1/2 top-2.5 h-5 w-24 -translate-x-1/2 rounded-full bg-black/70" />
              <div className="raios-luz girar-lento absolute left-1/2 top-[38%] size-[30rem] -translate-x-1/2 -translate-y-1/2 opacity-80" style={{ ["--duracao" as string]: "60s" } as CSSProperties} />
              <div className="relative flex flex-col items-center text-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold text-white/80 ring-1 ring-white/15">
                  <Lock className="size-3" /> Só você vê isto
                </span>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.3em] text-[#f7d983]">Você tirou</p>
                <div
                  className="mt-3 rounded-full p-[4px] shadow-[0_0_50px_-6px_rgb(242_207_107/0.8)]"
                  style={{ background: "conic-gradient(from 210deg, #f7d983, #b8861f, #fff3c9, #c9962b, #f7d983)" }}
                >
                  <div className="rounded-full bg-[#1d0a12] p-1">
                    <Avatar nome="Marina Costa" tamanho={84} />
                  </div>
                </div>
                <p className="ouro-palco mt-3 font-titulo text-3xl font-semibold">Marina Costa</p>
                <div className="mt-4 w-full rounded-2xl bg-white/95 p-3 text-left text-[#1d2420] shadow-lg">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#55625a]">Lista de desejos</p>
                  <ul className="mt-1.5 flex flex-col gap-1.5 text-[13px] font-semibold">
                    <li className="flex items-center justify-between gap-2">
                      Livro de suspense <span className="text-[12px] font-bold text-[#8c6516]">R$ 60</span>
                    </li>
                    <li className="flex items-center justify-between gap-2">
                      Kit de cafés especiais <span className="text-[12px] font-bold text-[#8c6516]">R$ 90</span>
                    </li>
                  </ul>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#c0182f]/10 px-2 py-0.5 text-[11px] font-semibold text-[#8f0f22]">
                      <Heart className="size-3" /> café
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0a7a55]/10 px-2 py-0.5 text-[11px] font-semibold text-[#064d36]">
                      <Palette className="size-3" /> verde
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#c9962b]/15 px-2 py-0.5 text-[11px] font-semibold text-[#6b4c0f]">
                      <Ruler className="size-3" /> M
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* cartões flutuando */}
      <div className="surgir absolute -left-2 -top-6 sm:-left-14 sm:-top-5" style={{ ["--atraso" as string]: "0.8s" } as CSSProperties}>
        <div className="flutuar vidro-forte flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ ["--duracao" as string]: "6.5s", ["--giro" as string]: "-3deg" } as CSSProperties}>
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-esmeralda/15 text-esmeralda">
            <CheckCircle2 className="size-4.5" />
          </span>
          <span className="text-left text-xs leading-tight">
            <strong className="block text-[13px]">Sorteio feito!</strong>
            <span className="text-suave">12 pessoas, ninguém se tirou</span>
          </span>
        </div>
      </div>
      <div className="surgir absolute -bottom-7 -right-2 sm:-right-12 sm:-bottom-6" style={{ ["--atraso" as string]: "1.1s" } as CSSProperties}>
        <div className="flutuar vidro-forte flex max-w-[13rem] items-start gap-2.5 rounded-2xl px-3.5 py-2.5" style={{ ["--duracao" as string]: "7.5s", ["--giro" as string]: "3deg" } as CSSProperties}>
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-rubi/12 text-rubi">
            <MessageCircleHeart className="size-4.5" />
          </span>
          <span className="text-left text-xs leading-tight">
            <strong className="block text-[13px]">Mensagem anônima</strong>
            <span className="text-suave">“Você prefere livro ou café?”</span>
          </span>
        </div>
      </div>
    </div>
  );
}
