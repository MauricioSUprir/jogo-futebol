"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, Link2, Share2 } from "lucide-react";
import { Botao, classesBotao } from "@/components/ui/botao";
import { useAvisos } from "@/components/ui/avisos";
import { cn } from "@/lib/cn";

/** Ícone do WhatsApp (marca; SVG simples, sem dependência). */
export function IconeWhatsApp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.8h-.01a9.77 9.77 0 0 1-4.98-1.36l-.36-.21-3.7.97.99-3.6-.23-.37A9.74 9.74 0 0 1 2.27 12C2.27 6.6 6.66 2.2 12.06 2.2a9.72 9.72 0 0 1 6.92 2.87 9.7 9.7 0 0 1 2.86 6.92c0 5.4-4.39 9.8-9.79 9.8m8.33-18.13A11.7 11.7 0 0 0 12.05.2C5.55.2.27 5.48.26 11.98c0 2.08.54 4.1 1.58 5.89L.16 24l6.27-1.64a11.8 11.8 0 0 0 5.62 1.43h.01c6.5 0 11.78-5.28 11.79-11.78 0-3.15-1.23-6.1-3.47-8.34" />
    </svg>
  );
}

async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // navegadores antigos ou sem permissão: cópia pelo campo de texto
    const t = document.createElement("textarea");
    t.value = texto;
    t.setAttribute("readonly", "");
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    t.remove();
    return ok;
  }
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** SVG do QR → PNG grande (para imprimir ou mandar como imagem), com o código embaixo. */
async function svgParaPng(svg: string, codigo: string): Promise<Blob> {
  const lado = 1024;
  const rodape = 150;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error("svg"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = lado;
    canvas.height = lado + rodape;
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    g.drawImage(img, 0, 0, lado, lado);
    g.fillStyle = "#14201b";
    g.textAlign = "center";
    g.font = "600 34px system-ui, sans-serif";
    g.fillText("Código do convite", lado / 2, lado + 50);
    g.font = "800 64px ui-monospace, SFMono-Regular, Menlo, monospace";
    g.fillText(codigo.split("").join(" "), lado / 2, lado + 120);
    return await new Promise<Blob>((ok, erro) => canvas.toBlob((b) => (b ? ok(b) : erro(new Error("png"))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Código grande, QR Code, link com copiar, WhatsApp, compartilhar do celular (só quando o aparelho oferece) e baixar o
 * QR (PNG/SVG).
 */
export function PainelCompartilhar({
  codigo,
  link,
  qrSvg,
  nome,
  mensagem,
  compacto,
}: {
  codigo: string;
  link: string;
  qrSvg: string;
  nome: string;
  mensagem: string;
  compacto?: boolean;
}) {
  const { avisar } = useAvisos();
  const [podeCompartilhar, setPodeCompartilhar] = useState(false);
  const [copiado, setCopiado] = useState<"link" | "codigo" | null>(null);
  const tempo = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPodeCompartilhar(typeof navigator !== "undefined" && typeof navigator.share === "function");
    return () => {
      if (tempo.current) clearTimeout(tempo.current);
    };
  }, []);

  async function copiar(oque: "link" | "codigo") {
    const ok = await copiarTexto(oque === "link" ? link : codigo);
    if (!ok) {
      avisar("Não deu para copiar automaticamente. Selecione e copie manualmente.", "erro");
      return;
    }
    setCopiado(oque);
    avisar(oque === "link" ? "Link copiado!" : "Código copiado!");
    if (tempo.current) clearTimeout(tempo.current);
    tempo.current = setTimeout(() => setCopiado(null), 2200);
  }

  async function compartilhar() {
    try {
      await navigator.share({ title: `Amigo oculto: ${nome}`, text: mensagem.replace(link, "").trim(), url: link });
    } catch (e) {
      if ((e as { name?: string }).name !== "AbortError") avisar("Não foi possível abrir o compartilhamento.", "erro");
    }
  }

  async function baixarPng() {
    try {
      baixar(await svgParaPng(qrSvg, codigo), `convite-${codigo}.png`);
    } catch {
      avisar("Não foi possível gerar a imagem. Tente baixar em SVG.", "erro");
    }
  }

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

  return (
    <div className={cn("grid grid-cols-1 gap-5", !compacto && "md:grid-cols-[minmax(0,1fr)_17rem] md:items-start")}>
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-suave">
            Código do convite
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="font-mono text-4xl font-extrabold tracking-[0.18em] text-texto sm:text-5xl">{codigo}</p>
            <Botao variante="vidro" tamanho="p" onClick={() => copiar("codigo")} aria-label="Copiar o código do convite">
              {copiado === "codigo" ? <Check className="size-4 text-esmeralda" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copiado === "codigo" ? "Copiado" : "Copiar"}
            </Botao>
          </div>
          <p className="mt-1 text-sm text-suave">Quem tiver o código entra pela página inicial, em “Entrar em um grupo”.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`link-${codigo}`} className="text-sm font-semibold">
            Link do convite
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Link2 className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-suave" aria-hidden />
              <input
                id={`link-${codigo}`}
                readOnly
                value={link}
                onFocus={(e) => e.currentTarget.select()}
                className="h-12 w-full rounded-2xl border border-borda bg-white/70 pl-10 pr-4 font-mono text-sm text-texto focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 dark:bg-white/5"
              />
            </div>
            <Botao onClick={() => copiar("link")} className="h-12 shrink-0">
              {copiado === "link" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copiado === "link" ? "Link copiado" : "Copiar link"}
            </Botao>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className={classesBotao(
              "primario",
              "g",
              "bg-[linear-gradient(135deg,#25d366,#128c7e)] shadow-[0_10px_24px_-10px_rgb(18_140_126/0.8)] hover:-translate-y-0.5",
            )}
          >
            <IconeWhatsApp className="size-5" /> Enviar pelo WhatsApp
          </a>
          {podeCompartilhar ? (
            <Botao variante="contorno" tamanho="g" onClick={compartilhar}>
              <Share2 className="size-5" aria-hidden /> Compartilhar
            </Botao>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="w-full max-w-[17rem] rounded-3xl bg-white p-3 shadow-[0_18px_40px_-22px_rgb(0_0_0/0.5)] ring-1 ring-black/5">
          <div className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>
        <p className="text-center text-sm text-suave">Aponte a câmera do celular para entrar no grupo.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Botao variante="vidro" tamanho="p" onClick={baixarPng}>
            <Download className="size-4" aria-hidden /> Baixar PNG
          </Botao>
          <Botao variante="vidro" tamanho="p" onClick={() => baixar(new Blob([qrSvg], { type: "image/svg+xml" }), `convite-${codigo}.svg`)}>
            <Download className="size-4" aria-hidden /> SVG
          </Botao>
        </div>
      </div>
    </div>
  );
}
