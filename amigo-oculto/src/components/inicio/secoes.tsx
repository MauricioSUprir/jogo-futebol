import type { ReactNode } from "react";
import {
  Briefcase,
  Building2,
  Dices,
  GraduationCap,
  House,
  Images,
  Lightbulb,
  MessageCircleHeart,
  MonitorPlay,
  PartyPopper,
  QrCode,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Users,
  Gift,
} from "lucide-react";
import { BotaoLink } from "@/components/ui/botao";
import { Brilho, PresenteSvg } from "@/components/inicio/presente-svg";
import { cn } from "@/lib/cn";

/** Título de seção (sobretítulo + título + texto). */
export function TituloSecao({ id, sobre, titulo, texto, centro = true }: { id: string; sobre: string; titulo: ReactNode; texto?: ReactNode; centro?: boolean }) {
  return (
    <div className={cn("mb-10 flex flex-col gap-3", centro && "items-center text-center")}>
      <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-t1">
        <Brilho tamanho={12} /> {sobre}
      </p>
      <h2 id={id} className="max-w-3xl font-titulo text-3xl font-semibold leading-tight tracking-tight [text-wrap:balance] sm:text-5xl">
        {titulo}
      </h2>
      {texto ? <p className="max-w-2xl text-base leading-relaxed text-suave [text-wrap:pretty] sm:text-lg">{texto}</p> : null}
    </div>
  );
}

const PASSOS = [
  {
    icone: Gift,
    titulo: "Crie o grupo",
    texto: "Nome, data, valor do presente e um tema (Natal, aniversário, clássico ou corporativo). Leva um minuto.",
    cor: "rubi",
  },
  {
    icone: QrCode,
    titulo: "Convide a turma",
    texto: "Mande o link pelo WhatsApp, mostre o QR Code ou passe o código de 8 letras. Cada um entra pelo celular.",
    cor: "esmeralda",
  },
  {
    icone: Shuffle,
    titulo: "Sorteio seguro",
    texto: "Feito no servidor, na hora ou na data marcada. Ninguém tira a si mesmo, as restrições são respeitadas e nem o organizador vê.",
    cor: "ouro",
  },
  {
    icone: Sparkles,
    titulo: "A revelação",
    texto: "Cada pessoa abre o próprio presente numa animação de cinema, com a lista de desejos de quem tirou — ou todos juntos no telão.",
    cor: "rubi",
  },
] as const;

const COR_ICONE = {
  rubi: "bg-rubi/12 text-rubi",
  esmeralda: "bg-esmeralda/12 text-esmeralda",
  ouro: "bg-ouro/15 text-ouro-escuro dark:text-ouro-claro",
} as const;

export function ComoFunciona() {
  return (
    <section id="como-funciona" aria-labelledby="titulo-como-funciona" className="scroll-mt-24 px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <TituloSecao
          id="titulo-como-funciona"
          sobre="Como funciona"
          titulo={
            <>
              Quatro passos até o <span className="texto-ouro italic">grande momento</span>
            </>
          }
          texto="Sem planilha, sem papelzinho no pote e sem ninguém descobrindo antes da hora."
        />
        <ol className="relative grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <span aria-hidden className="fita-ouro absolute left-[12%] right-[12%] top-[2.6rem] hidden h-px opacity-70 lg:block" />
          {PASSOS.map((p, i) => (
            <li key={p.titulo} className="vidro relative flex flex-col rounded-cartao p-6">
              <div className="flex items-center gap-3">
                <span className={cn("relative inline-flex size-12 items-center justify-center rounded-2xl", COR_ICONE[p.cor])}>
                  <p.icone className="size-6" aria-hidden />
                </span>
                <span className="font-titulo text-4xl font-semibold text-ouro/60" aria-hidden>
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-titulo text-xl font-semibold">
                <span className="sr-only">Passo {i + 1}: </span>
                {p.titulo}
              </h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-suave">{p.texto}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

const RECURSOS = [
  {
    icone: ShieldCheck,
    titulo: "Sorteio seguro no servidor",
    texto: "Aleatoriedade criptográfica, conferência de todas as regras e restrições (casais não se tiram). O resultado fica trancado: cada um só vê o seu.",
    cor: "esmeralda",
  },
  {
    icone: MessageCircleHeart,
    titulo: "Mensagens anônimas",
    texto: "Pergunte o tamanho, a cor ou dê uma dica sem se entregar. Quem recebe responde sem saber quem é — e pode denunciar abusos.",
    cor: "rubi",
  },
  {
    icone: Lightbulb,
    titulo: "Lista de desejos e ideias",
    texto: "Cada pessoa monta a lista e conta os gostos. Na hora de comprar, você vê ideias que combinam com ela e cabem no valor do grupo.",
    cor: "ouro",
  },
  {
    icone: Dices,
    titulo: "Jogos e brincadeiras",
    texto: "Palpites de quem tirou quem, quiz, bingo, roleta de desafios, enquetes e mural para animar a espera.",
    cor: "esmeralda",
  },
  {
    icone: MonitorPlay,
    titulo: "Revelação ao vivo no telão",
    texto: "No dia da festa, abra o telão na TV e revele um por um, com contagem regressiva e confete para todo mundo ver.",
    cor: "rubi",
  },
  {
    icone: Images,
    titulo: "Álbum de memórias",
    texto: "Depois da troca, todo mundo sobe as fotos num álbum privado do grupo. A lembrança fica guardada.",
    cor: "ouro",
  },
] as const;

export function Recursos() {
  return (
    <section aria-labelledby="titulo-recursos" className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <TituloSecao
          id="titulo-recursos"
          sobre="Tudo num lugar só"
          titulo="Muito mais que um sorteio"
          texto="Da organização à festa, tudo o que um amigo oculto precisa — com cuidado em cada detalhe."
        />
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RECURSOS.map((r) => (
            <li key={r.titulo} className="vidro group relative flex gap-4 overflow-hidden rounded-cartao p-5 transition hover:-translate-y-1 sm:block sm:p-6">
              <span className={cn("inline-flex size-12 shrink-0 items-center justify-center rounded-2xl transition group-hover:scale-110", COR_ICONE[r.cor])}>
                <r.icone className="size-6" aria-hidden />
              </span>
              <div className="min-w-0">
                <h3 className="font-titulo text-lg font-semibold sm:mt-4 sm:text-xl">{r.titulo}</h3>
                <p className="mt-1 text-[15px] leading-relaxed text-suave sm:mt-1.5">{r.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PUBLICOS = [
  { icone: Users, titulo: "Amigos", texto: "A turma da escola, da faculdade ou do futebol, mesmo morando longe." },
  { icone: House, titulo: "Famílias", texto: "Da vó ao primo mais novo, com tema de Natal e telão na sala." },
  { icone: Building2, titulo: "Condomínios", texto: "Grupos grandes com aprovação de quem entra e prazo para inscrição." },
  { icone: GraduationCap, titulo: "Escolas", texto: "Turmas e professores, com valor combinado e regras claras." },
  { icone: Briefcase, titulo: "Empresas", texto: "Tema corporativo, restrições entre equipes e revelação na confraternização." },
] as const;

export function ParaQuem() {
  return (
    <section aria-labelledby="titulo-para-quem" className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <TituloSecao id="titulo-para-quem" sobre="Para quem" titulo="Para qualquer turma, de 3 a 1.000 pessoas" />
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {PUBLICOS.map((p, i) => (
            <li key={p.titulo} className="vidro flex items-start gap-3 rounded-cartao p-5 lg:flex-col">
              <span
                className={cn(
                  "inline-flex size-11 shrink-0 items-center justify-center rounded-2xl",
                  COR_ICONE[(["rubi", "esmeralda", "ouro"] as const)[i % 3]],
                )}
              >
                <p.icone className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="font-titulo text-lg font-semibold">{p.titulo}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-suave">{p.texto}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ChamadaFinal() {
  return (
    <section aria-labelledby="titulo-chamada" className="px-4 pb-10 pt-16 sm:pt-20">
      <div
        className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2.2rem] px-6 py-12 text-center text-white shadow-vidro sm:px-12 sm:py-16"
        style={{
          background:
            "radial-gradient(34rem 22rem at 108% 118%, #0a7a55 0%, rgb(10 122 85 / 0.55) 35%, transparent 62%), radial-gradient(30rem 18rem at -10% -20%, #e2394f 0%, transparent 60%), linear-gradient(135deg, #8f0f22, #b3172d 55%, #7d0d1e)",
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-6 top-6 rotate-[-14deg] opacity-90">
            <PresenteSvg cor="ouro" tamanho={74} />
          </div>
          <div className="absolute -right-4 bottom-4 hidden rotate-[12deg] opacity-90 sm:block">
            <PresenteSvg cor="neve" tamanho={86} />
          </div>
          <div className="absolute inset-0" style={{ background: "radial-gradient(40rem 20rem at 50% 0%, rgb(255 230 160 / 0.28), transparent 70%)" }} />
          <div className="fita-ouro absolute inset-x-0 top-0 h-1" />
        </div>
        <PartyPopper className="mx-auto size-10 text-[#f7d983]" aria-hidden />
        <h2 id="titulo-chamada" className="mt-4 font-titulo text-3xl font-semibold leading-tight [text-wrap:balance] sm:text-5xl">
          Pronto para o melhor amigo oculto de todos?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/85 sm:text-lg">Crie o grupo agora e mande o convite antes que alguém sugira o papelzinho no pote.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <BotaoLink href="/criar" variante="ouro" tamanho="g" brilho>
            <Gift className="size-5" aria-hidden />
            Criar amigo oculto
          </BotaoLink>
          <BotaoLink href="#demonstracao" variante="fantasma" tamanho="g" className="text-white ring-1 ring-white/40 hover:bg-white/10">
            <Sparkles className="size-5" aria-hidden />
            Ver a demonstração
          </BotaoLink>
        </div>
      </div>
    </section>
  );
}
