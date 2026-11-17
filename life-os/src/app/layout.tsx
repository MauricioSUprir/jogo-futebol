import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import { RegistrarSW } from "@/components/registrar-sw";

export const metadata: Metadata = {
  title: { default: "LIFE OS", template: "%s · LIFE OS" },
  description: "Sistema operacional pessoal: saúde, hábitos, agenda e evolução, num servidor só seu.",
  applicationName: "LIFE OS",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "LIFE OS", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/favicon.png", sizes: "64x64", type: "image/png" }, { url: "/icones/icone-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#080b12",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="fundo-holo">
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
