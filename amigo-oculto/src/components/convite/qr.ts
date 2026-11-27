import "server-only";
import QRCode from "qrcode";
import { urlDoSite } from "@/lib/env";

/** Link público do convite. */
export function linkDoConvite(codigo: string) {
  return `${urlDoSite()}/convite/${encodeURIComponent(codigo)}`;
}

/**
 * QR Code do convite em SVG, gerado no servidor (sem serviço externo). Escuro sobre branco, com margem, para ler bem
 * em qualquer câmera — também no modo escuro (o fundo branco faz parte do desenho).
 */
export async function qrDoConvite(link: string): Promise<string> {
  const svg = await QRCode.toString(link, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#14201bff", light: "#ffffffff" },
  });
  // o SVG ocupa a caixa que o contém
  return svg.replace("<svg ", '<svg role="img" aria-label="QR Code do convite" preserveAspectRatio="xMidYMid meet" ');
}
