import type { Metadata } from "next";
import { Heroi } from "@/components/inicio/heroi";
import { ChamadaFinal, ComoFunciona, ParaQuem, Recursos, TituloSecao } from "@/components/inicio/secoes";
import { Perguntas, perguntasFrequentes } from "@/components/inicio/perguntas";
import { Demonstracao } from "@/components/inicio/demonstracao";
import { urlDoSite } from "@/lib/env";

const DESCRICAO =
  "Crie seu amigo oculto em minutos: convite por link, QR Code e WhatsApp, sorteio seguro (nem o organizador vê), lista de desejos com ideias de presente, mensagens anônimas e uma revelação de cinema no celular ou no telão.";

export const metadata: Metadata = {
  title: { absolute: "Amigo Oculto — crie, sorteie e revele com magia" },
  description: DESCRICAO,
  keywords: ["amigo oculto", "amigo secreto", "sorteio de amigo oculto", "amigo oculto online", "sorteio online", "lista de desejos", "Natal", "confraternização"],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Amigo Oculto",
    url: "/",
    title: "Amigo Oculto — crie, sorteie e revele com magia",
    description: DESCRICAO,
  },
  twitter: { card: "summary_large_image", title: "Amigo Oculto — crie, sorteie e revele com magia", description: DESCRICAO },
};

/** Dados estruturados (busca): o aplicativo e as perguntas frequentes. "<" escapado para não fechar o <script>. */
function dadosEstruturados() {
  const site = urlDoSite();
  const dados = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "Amigo Oculto",
      url: site,
      description: DESCRICAO,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      inLanguage: "pt-BR",
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: perguntasFrequentes().map((p) => ({
        "@type": "Question",
        name: p.pergunta,
        acceptedAnswer: { "@type": "Answer", text: p.resposta },
      })),
    },
  ];
  return JSON.stringify(dados).replace(/</g, "\\u003c");
}

export default function Inicio() {
  return (
    <>
      <Heroi />
      <ComoFunciona />
      <section id="demonstracao" aria-labelledby="titulo-demonstracao" className="scroll-mt-24 px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <TituloSecao
            id="titulo-demonstracao"
            sobre="Experimente agora"
            titulo={
              <>
                Faça um sorteio de <span className="texto-ouro italic">mentirinha</span>
              </>
            }
            texto="Digite de 3 a 8 nomes, sorteie aqui mesmo no seu navegador e veja como é abrir o presente. Nada é salvo."
          />
          <Demonstracao />
        </div>
      </section>
      <Recursos />
      <ParaQuem />
      <Perguntas />
      <ChamadaFinal />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: dadosEstruturados() }} />
    </>
  );
}
