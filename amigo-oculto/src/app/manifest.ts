import type { MetadataRoute } from "next";

/** Instalação como aplicativo (PWA). Ícones gerados por scripts/gerar-icones.mjs a partir da marca. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Amigo Oculto",
    short_name: "Amigo Oculto",
    description: "Crie seu amigo oculto, sorteie com segurança, monte a lista de desejos e viva uma revelação inesquecível.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7ef",
    theme_color: "#b3172d",
    categories: ["entertainment", "lifestyle", "social"],
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icones/icone-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icones/icone-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Meu painel", url: "/painel", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Lista de desejos", url: "/lista-de-desejos", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
      { name: "Notificações", url: "/notificacoes", icons: [{ src: "/icones/icone-192.png", sizes: "192x192" }] },
    ],
  };
}
