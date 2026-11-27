import type { Metadata, Viewport } from "next";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { ProvedorAvisos } from "@/components/ui/avisos";
import { ProvedorPreferencias } from "@/components/efeitos/preferencias";
import { RegistrarServiceWorker } from "@/components/pwa/registrar-sw";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { clienteServidor } from "@/lib/supabase/servidor";
import { urlDoSite } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: new URL(urlDoSite()),
  title: { default: "Amigo Oculto — sorteio, revelação e diversão", template: "%s · Amigo Oculto" },
  description:
    "Crie seu amigo oculto em minutos: convite por link, QR Code e WhatsApp, sorteio seguro, lista de desejos, mensagens anônimas e uma revelação inesquecível.",
  applicationName: "Amigo Oculto",
  appleWebApp: { capable: true, title: "Amigo Oculto", statusBarStyle: "black-translucent" },
  openGraph: { type: "website", locale: "pt_BR", siteName: "Amigo Oculto" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1210" },
  ],
};

// Aplica claro/escuro antes da primeira pintura (sem piscar). A preferência fica no aparelho e na conta.
const scriptModo = `(function(){try{var m=localStorage.getItem('ao-modo')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const usuario = await usuarioAtual();
  let prefs = { som: true, vibracao: true, menosMovimento: false };
  if (usuario) {
    const supabase = await clienteServidor();
    const { data } = await supabase.from("user_settings").select("sound_effects, vibration, reduce_motion").maybeSingle();
    if (data) prefs = { som: data.sound_effects, vibracao: data.vibration, menosMovimento: data.reduce_motion };
  }
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptModo }} />
      </head>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-black"
        >
          Pular para o conteúdo
        </a>
        <ProvedorPreferencias inicial={prefs}>
          <ProvedorAvisos>{children}</ProvedorAvisos>
        </ProvedorPreferencias>
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
