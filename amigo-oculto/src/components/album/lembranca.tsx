"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Girando } from "@/components/ui/carregando";
import { useAvisos } from "@/components/ui/avisos";
import { TEMAS, type Tema } from "@/lib/temas";

export type DadosLembranca = {
  evento: string;
  data: string | null;
  tema: string;
  para: string;
  numeros: { rotulo: string; valor: number }[];
  nomes: string[];
  revelacoes: { de: string; para: string }[];
};

const L = 1080;
const A = 1350;
const TITULO = '"Fraunces Variable", Fraunces, Georgia, serif';
const TEXTO = '"Plus Jakarta Sans Variable", "Plus Jakarta Sans", system-ui, sans-serif';

function quebrar(g: CanvasRenderingContext2D, texto: string, largura: number, maxLinhas: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (g.measureText(teste).width <= largura) atual = teste;
    else {
      if (atual) linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length > maxLinhas) {
    const corte = linhas.slice(0, maxLinhas);
    let ultima = corte[maxLinhas - 1];
    while (g.measureText(`${ultima}…`).width > largura && ultima.length > 1) ultima = ultima.slice(0, -1);
    corte[maxLinhas - 1] = `${ultima}…`;
    return corte;
  }
  return linhas;
}

function cortar(g: CanvasRenderingContext2D, texto: string, largura: number) {
  if (g.measureText(texto).width <= largura) return texto;
  let t = texto;
  while (t.length > 1 && g.measureText(`${t}…`).width > largura) t = t.slice(0, -1);
  return `${t}…`;
}

function estrela(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function caixa(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

/** Desenha a lembrança (1080 × 1350) e devolve o canvas. */
async function desenhar(d: DadosLembranca): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([document.fonts.load(`600 80px ${TITULO}`), document.fonts.load(`600 30px ${TEXTO}`), document.fonts.load(`italic 600 40px ${TITULO}`)]);
  } catch {
    // sem as fontes, usa as do sistema
  }
  const c = document.createElement("canvas");
  c.width = L;
  c.height = A;
  const g = c.getContext("2d")!;
  const [c1, c2, c3] = TEMAS[(d.tema as Tema) in TEMAS ? (d.tema as Tema) : "natal"].cores;

  // fundo
  const fundo = g.createLinearGradient(0, 0, L, A);
  fundo.addColorStop(0, c1);
  fundo.addColorStop(0.55, c2);
  fundo.addColorStop(1, "#0b1210");
  g.fillStyle = fundo;
  g.fillRect(0, 0, L, A);
  const brilho = g.createRadialGradient(L * 0.8, 120, 0, L * 0.8, 120, 600);
  brilho.addColorStop(0, "rgba(255,241,194,0.35)");
  brilho.addColorStop(1, "rgba(255,241,194,0)");
  g.fillStyle = brilho;
  g.fillRect(0, 0, L, A);

  // estrelas
  g.fillStyle = "rgba(255,241,194,0.75)";
  [[90, 110, 10], [990, 90, 14], [940, 300, 7], [140, 420, 6], [60, 1180, 9], [1010, 1240, 11], [520, 70, 6]].forEach(([x, y, r]) => estrela(g, x, y, r));

  // moldura dourada
  const ouro = g.createLinearGradient(0, 0, L, A);
  ouro.addColorStop(0, "#fff1c2");
  ouro.addColorStop(0.5, c3);
  ouro.addColorStop(1, "#f2cf6b");
  g.strokeStyle = ouro;
  g.lineWidth = 4;
  caixa(g, 36, 36, L - 72, A - 72, 36);
  g.stroke();
  g.lineWidth = 1.5;
  g.globalAlpha = 0.6;
  caixa(g, 50, 50, L - 100, A - 100, 28);
  g.stroke();
  g.globalAlpha = 1;

  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  // cabeçalho
  g.fillStyle = "#f7d983";
  g.font = `700 26px ${TEXTO}`;
  g.letterSpacing = "8px";
  g.fillText("AMIGO OCULTO · LEMBRANÇA", L / 2, 140);
  g.letterSpacing = "0px";

  g.fillStyle = "#ffffff";
  g.font = `600 84px ${TITULO}`;
  const linhasTitulo = quebrar(g, d.evento, L - 200, 2);
  let y = 250;
  for (const linha of linhasTitulo) {
    g.fillText(linha, L / 2, y);
    y += 92;
  }
  if (d.data) {
    g.fillStyle = "rgba(255,255,255,0.82)";
    g.font = `500 32px ${TEXTO}`;
    g.fillText(d.data, L / 2, y);
    y += 30;
  }

  // números
  y += 40;
  const nums = d.numeros.slice(0, 4);
  const larg = (L - 200 - (nums.length - 1) * 20) / Math.max(1, nums.length);
  nums.forEach((n, k) => {
    const x = 100 + k * (larg + 20);
    g.fillStyle = "rgba(255,255,255,0.12)";
    caixa(g, x, y, larg, 150, 24);
    g.fill();
    g.fillStyle = "#ffe9a6";
    g.font = `600 64px ${TITULO}`;
    g.fillText(String(n.valor), x + larg / 2, y + 82);
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.font = `700 19px ${TEXTO}`;
    g.letterSpacing = "2px";
    g.fillText(cortar(g, n.rotulo.toUpperCase(), larg - 16), x + larg / 2, y + 122);
    g.letterSpacing = "0px";
  });
  y += 150 + 70;

  // a turma
  g.fillStyle = "#f7d983";
  g.font = `italic 600 40px ${TITULO}`;
  g.fillText("A turma", L / 2, y);
  y += 50;
  const nomes = d.nomes.slice(0, 12);
  const colunas = nomes.length > 6 ? 3 : nomes.length > 3 ? 2 : 1;
  const linhasNomes = Math.ceil(nomes.length / colunas);
  const larguraCol = (L - 200) / colunas;
  g.fillStyle = "#ffffff";
  g.font = `600 30px ${TEXTO}`;
  nomes.forEach((nome, k) => {
    const col = k % colunas;
    const lin = Math.floor(k / colunas);
    g.fillText(cortar(g, nome, larguraCol - 20), 100 + larguraCol * col + larguraCol / 2, y + lin * 46);
  });
  y += linhasNomes * 46 + 50;

  // revelações
  if (d.revelacoes.length) {
    g.fillStyle = "#f7d983";
    g.font = `italic 600 40px ${TITULO}`;
    g.fillText("As revelações", L / 2, y);
    y += 50;
    const espaco = A - 200 - y;
    const cabem = Math.max(1, Math.floor(espaco / 44));
    const lista = d.revelacoes.slice(0, Math.min(cabem, 10));
    g.font = `600 28px ${TEXTO}`;
    for (const r of lista) {
      g.fillStyle = "#ffffff";
      g.fillText(cortar(g, `${r.de}  →  ${r.para}`, L - 220), L / 2, y);
      y += 44;
    }
    if (d.revelacoes.length > lista.length) {
      g.fillStyle = "rgba(255,255,255,0.7)";
      g.font = `500 24px ${TEXTO}`;
      g.fillText(`e mais ${d.revelacoes.length - lista.length}`, L / 2, y);
    }
  }

  // rodapé
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.font = `italic 600 34px ${TITULO}`;
  g.fillText(cortar(g, `Lembrança de ${d.para}`, L - 220), L / 2, A - 128);
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.font = `500 22px ${TEXTO}`;
  g.fillText(`Gerada em ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}`, L / 2, A - 88);
  return c;
}

export function Lembranca({ dados }: { dados: DadosLembranca }) {
  const [url, setUrl] = useState<string | null>(null);
  const [gerando, setGerando] = useState(true);
  const [montado, setMontado] = useState(false);
  const urlRef = useRef<string | null>(null);
  const { avisar } = useAvisos();

  const gerar = useCallback(async () => {
    setGerando(true);
    try {
      const c = await desenhar(dados);
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
      if (!blob) throw new Error("sem imagem");
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      setUrl(urlRef.current);
    } catch {
      avisar("Não foi possível gerar a lembrança neste navegador.", "erro");
    } finally {
      setGerando(false);
    }
  }, [dados, avisar]);

  useEffect(() => {
    setMontado(true);
    void gerar();
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [gerar]);

  function imprimir() {
    document.documentElement.classList.add("imprimindo-lembranca");
    const limpar = () => {
      document.documentElement.classList.remove("imprimindo-lembranca");
      window.removeEventListener("afterprint", limpar);
    };
    window.addEventListener("afterprint", limpar);
    window.print();
    setTimeout(limpar, 1500);
  }

  const nomeArquivo = `lembranca-${dados.evento.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "amigo-oculto"}.png`;

  return (
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="mx-auto w-full max-w-sm">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-black/10 shadow-[0_24px_50px_-20px_rgb(0_0_0/0.55)] dark:bg-white/5">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Lembrança digital de ${dados.evento}`} className="h-full w-full object-cover" />
          ) : null}
          {gerando ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Girando rotulo="Gerando a lembrança" />
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-titulo text-2xl font-semibold">Sua lembrança digital</h3>
          <p className="mt-1 text-sm text-suave">
            Uma imagem com o nome do amigo oculto, a data, as cores do tema, os números da festa, a turma e as revelações. Feita no seu aparelho, só para
            você ({dados.para}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={url ?? undefined}
            download={nomeArquivo}
            aria-disabled={!url}
            onClick={(e) => {
              if (!url) e.preventDefault();
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] px-5 font-semibold text-white shadow-md transition hover:-translate-y-0.5 aria-disabled:pointer-events-none aria-disabled:opacity-55"
          >
            <Download className="size-4" aria-hidden /> Baixar PNG
          </a>
          <Botao variante="contorno" onClick={imprimir} disabled={!url}>
            <Printer className="size-4" aria-hidden /> Imprimir / PDF
          </Botao>
          <Botao variante="fantasma" onClick={() => void gerar()} disabled={gerando}>
            <RefreshCw className="size-4" aria-hidden /> Gerar de novo
          </Botao>
        </div>
        <p className="text-xs text-suave">Para PDF, escolha “Salvar como PDF” na janela de impressão.</p>
      </div>
      {montado && url
        ? createPortal(
            <div className="lembranca-impressao" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" />
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
