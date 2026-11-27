import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CONVIDADO_LIGADO } from "@/lib/env";
import { TituloSecao } from "@/components/inicio/secoes";

/** Perguntas frequentes: texto puro (para o acordeão e para os dados estruturados da busca). */
export function perguntasFrequentes(): { pergunta: string; resposta: string; link?: { href: string; texto: string } }[] {
  return [
    {
      pergunta: "Alguém consegue descobrir quem eu tirei?",
      resposta:
        "Não. O sorteio é feito no servidor e o resultado fica guardado num lugar que ninguém consegue ler direto — nem o organizador. Cada pessoa só recebe o próprio resultado, depois de entrar na conta.",
    },
    {
      pergunta: "Preciso instalar algum aplicativo?",
      resposta:
        "Não. Funciona no navegador do celular ou do computador. Se quiser, dá para adicionar à tela inicial e abrir como um aplicativo.",
    },
    {
      pergunta: "Os participantes precisam criar conta?",
      resposta: CONVIDADO_LIGADO
        ? "Quem é convidado pode entrar só com o nome, como convidado. Criar a conta (e-mail e senha) guarda os seus grupos para usar em qualquer aparelho. Para criar um grupo, é preciso ter conta."
        : "Sim, cada pessoa entra com a própria conta (é rápido). Assim o resultado fica protegido e os seus grupos ficam guardados em qualquer aparelho.",
    },
    {
      pergunta: "Dá para impedir que casais (ou irmãos) se tirem?",
      resposta:
        "Dá. O organizador cria restrições do tipo “fulano não tira beltrano” (em uma direção ou nas duas). O sorteio confere antes se existe uma combinação possível e respeita todas.",
    },
    {
      pergunta: "E se alguém entrar depois do sorteio?",
      resposta:
        "O organizador pode refazer o sorteio para incluir a pessoa, enquanto a revelação ao vivo não tiver começado. Todo mundo é avisado e abre o presente de novo.",
    },
    {
      pergunta: "Como funcionam as mensagens anônimas?",
      resposta:
        "Depois do sorteio, você conversa com quem você tirou sem se identificar (e quem te tirou conversa com você do mesmo jeito). Dá para bloquear e denunciar; o organizador vê só o texto denunciado, nunca quem escreveu.",
    },
    {
      pergunta: "Posso definir um valor para os presentes?",
      resposta:
        "Pode: mínimo, máximo ou os dois. As ideias de presente que aparecem para quem vai comprar respeitam esse valor e os gostos da pessoa sorteada.",
    },
    {
      pergunta: "Meus dados ficam seguros?",
      resposta:
        "Pedimos só o necessário para o amigo oculto funcionar, sem anúncios e sem rastreadores. Você pode baixar os seus dados ou excluir a conta quando quiser.",
      link: { href: "/privacidade", texto: "Leia a política de privacidade" },
    },
  ];
}

export function Perguntas() {
  const lista = perguntasFrequentes();
  return (
    <section aria-labelledby="titulo-perguntas" className="px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <TituloSecao id="titulo-perguntas" sobre="Perguntas frequentes" titulo="Ficou alguma dúvida?" />
        <div className="flex flex-col gap-3">
          {lista.map((p, i) => (
            <details key={p.pergunta} className="pergunta vidro group rounded-3xl" name="perguntas" open={i === 0}>
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-3xl px-5 py-4 text-left font-semibold sm:text-lg">
                <span>{p.pergunta}</span>
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1">
                  <ChevronDown className="seta-pergunta size-4" aria-hidden />
                </span>
              </summary>
              <div className="px-5 pb-5 text-[15px] leading-relaxed text-suave">
                <p>{p.resposta}</p>
                {p.link ? (
                  <Link href={p.link.href} className="mt-2 inline-block font-semibold text-t1 underline underline-offset-4">
                    {p.link.texto}
                  </Link>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
