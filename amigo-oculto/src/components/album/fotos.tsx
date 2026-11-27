"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, CloudUpload, Flag, ImagePlus, Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/cartao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { enviarFotoAlbum } from "@/lib/imagem";
import { clienteNavegador } from "@/lib/supabase/navegador";
import { denunciarFoto, editarLegendaFoto, excluirFotoAlbum, registrarFotoAlbum } from "@/lib/acoes/album";
import { dataHora } from "@/lib/formatos";
import { cn } from "@/lib/cn";

export type FotoAlbum = {
  id: string;
  url: string | null;
  legenda: string | null;
  largura: number | null;
  altura: number | null;
  autor: string;
  autorAvatar: string | null;
  minha: boolean;
  criadaEm: string;
};

const MAX_POR_VEZ = 20;

export function FotosAlbum({ eventoId, fotos, admin }: { eventoId: string; fotos: FotoAlbum[]; admin: boolean }) {
  const router = useRouter();
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const { avisar } = useAvisos();
  const { menosMovimento } = usePreferencias();

  // fotos novas (e apagadas) de outras pessoas aparecem sozinhas. O tempo real não filtra exclusões por coluna:
  // a escuta de DELETE recebe só o id e confere se é uma foto desta tela.
  const ids = useRef(new Set<string>());
  useEffect(() => {
    ids.current = new Set(fotos.map((f) => f.id));
  }, [fotos]);
  useEffect(() => {
    const supabase = clienteNavegador();
    let espera: ReturnType<typeof setTimeout> | null = null;
    const atualizar = () => {
      if (espera) clearTimeout(espera);
      espera = setTimeout(() => router.refresh(), 800);
    };
    const canal = supabase
      .channel(`album:${eventoId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "album_photos", filter: `event_id=eq.${eventoId}` }, atualizar)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "album_photos", filter: `event_id=eq.${eventoId}` }, atualizar)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "album_photos" }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id && ids.current.has(id)) atualizar();
      })
      .subscribe();
    return () => {
      if (espera) clearTimeout(espera);
      void supabase.removeChannel(canal);
    };
  }, [eventoId, router]);

  const enviar = useCallback(
    async (lista: FileList | File[]) => {
      const arquivos = Array.from(lista).filter((f) => f.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name));
      if (!arquivos.length) {
        avisar("Escolha fotos (JPG, PNG ou WebP).", "erro");
        return;
      }
      if (arquivos.length > MAX_POR_VEZ) avisar(`Enviando as primeiras ${MAX_POR_VEZ} fotos. Depois mande o resto.`, "info");
      const fila = arquivos.slice(0, MAX_POR_VEZ);
      let enviadas = 0;
      let ultimoErro = "";
      for (let i = 0; i < fila.length; i++) {
        setProgresso({ atual: i + 1, total: fila.length });
        try {
          const f = await enviarFotoAlbum(fila[i], eventoId);
          const r = await registrarFotoAlbum(eventoId, { caminho: f.caminho, largura: f.largura, altura: f.altura });
          if (r.ok) enviadas++;
          else ultimoErro = r.erro;
        } catch (e) {
          ultimoErro = e instanceof Error ? e.message : "Não foi possível enviar uma das fotos.";
        }
      }
      setProgresso(null);
      if (entrada.current) entrada.current.value = "";
      if (enviadas) avisar(enviadas === 1 ? "Foto adicionada ao álbum!" : `${enviadas} fotos adicionadas ao álbum!`);
      if (ultimoErro) avisar(ultimoErro, "erro");
      router.refresh();
    },
    [eventoId, avisar, router],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          if (!progresso && e.dataTransfer.files.length) void enviar(e.dataTransfer.files);
        }}
        className={cn(
          "vidro flex flex-col items-center gap-3 rounded-cartao border-2 border-dashed border-transparent p-5 text-center transition sm:flex-row sm:text-left",
          arrastando && "border-ouro bg-[color-mix(in_oklab,var(--ouro)_10%,transparent)]",
        )}
      >
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1">
          <CloudUpload className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{progresso ? `Enviando ${progresso.atual} de ${progresso.total}…` : "Mande as fotos do encontro"}</p>
          <p className="text-sm text-suave">
            {progresso ? "As fotos são reduzidas no seu aparelho antes de subir." : "Só quem é do grupo vê. Arraste para cá ou escolha até 20 por vez."}
          </p>
          {progresso ? (
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={progresso.total} aria-valuenow={progresso.atual} aria-label="Progresso do envio">
              <div className="h-full rounded-full bg-t1 transition-all" style={{ width: `${(progresso.atual / progresso.total) * 100}%` }} />
            </div>
          ) : null}
        </div>
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          id="enviar-fotos-album"
          onChange={(e) => e.target.files && void enviar(e.target.files)}
          disabled={!!progresso}
        />
        <Botao onClick={() => entrada.current?.click()} carregando={!!progresso} brilho={!progresso}>
          <ImagePlus className="size-4" aria-hidden /> Adicionar fotos
        </Botao>
      </div>

      {fotos.length ? (
        <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4" aria-label={`${fotos.length} fotos`}>
          {fotos.map((f, i) => (
            <motion.li
              key={f.id}
              className="mb-3 break-inside-avoid"
              initial={menosMovimento ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: menosMovimento ? 0 : Math.min(i, 12) * 0.03 }}
            >
              <button
                type="button"
                onClick={() => setAberta(i)}
                className="group relative block w-full overflow-hidden rounded-2xl bg-black/5 shadow-[var(--sombra)] dark:bg-white/5"
                style={{ aspectRatio: f.largura && f.altura ? `${f.largura} / ${f.altura}` : "4 / 3" }}
                aria-label={`Abrir foto de ${f.autor}${f.legenda ? `: ${f.legenda}` : ""}`}
              >
                {f.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={f.url} alt={f.legenda ?? `Foto de ${f.autor}`} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                ) : null}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8 text-left text-xs text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Avatar nome={f.autor} caminho={f.autorAvatar} tamanho={22} />
                  <span className="line-clamp-1">{f.legenda ?? f.autor}</span>
                </span>
              </button>
            </motion.li>
          ))}
        </ul>
      ) : (
        <Vazio icone={<ImagePlus className="size-10" />} titulo="O álbum está esperando as primeiras fotos" texto="Mande as melhores lembranças do encontro: só o grupo vê." />
      )}

      <Visualizador eventoId={eventoId} fotos={fotos} indice={aberta} admin={admin} aoMudar={setAberta} />
    </div>
  );
}

function Visualizador({
  eventoId,
  fotos,
  indice,
  admin,
  aoMudar,
}: {
  eventoId: string;
  fotos: FotoAlbum[];
  indice: number | null;
  admin: boolean;
  aoMudar: (i: number | null) => void;
}) {
  const f = indice !== null ? fotos[indice] : null;
  const [editando, setEditando] = useState(false);
  const [legenda, setLegenda] = useState("");
  const [confirmarExcluir, setConfirmarExcluir] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [pendente, iniciar] = useTransition();
  const { avisar } = useAvisos();
  const router = useRouter();

  const anterior = useCallback(() => indice !== null && fotos.length && aoMudar((indice - 1 + fotos.length) % fotos.length), [indice, fotos.length, aoMudar]);
  const proxima = useCallback(() => indice !== null && fotos.length && aoMudar((indice + 1) % fotos.length), [indice, fotos.length, aoMudar]);

  useEffect(() => {
    setEditando(false);
    setConfirmarExcluir(false);
    setDenunciando(false);
    setLegenda(f?.legenda ?? "");
  }, [f?.id, f?.legenda]);

  useEffect(() => {
    if (indice === null) return;
    function tecla(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement | null;
      if (alvo?.closest("input, textarea")) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        anterior();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        proxima();
      }
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [indice, anterior, proxima]);

  // se a foto aberta sumir (apagada), fecha
  useEffect(() => {
    if (indice !== null && indice >= fotos.length) aoMudar(fotos.length ? fotos.length - 1 : null);
  }, [indice, fotos.length, aoMudar]);

  return (
    <Dialogo
      aberto={!!f}
      aoFechar={() => aoMudar(null)}
      titulo={f ? (f.legenda ?? `Foto de ${f.minha ? "você" : f.autor}`) : ""}
      descricao={f ? `${f.minha ? "Você" : f.autor} · ${dataHora(f.criadaEm)} · ${indice! + 1} de ${fotos.length}` : undefined}
      largura="max-w-5xl"
      className="p-4 sm:p-6"
    >
      {f ? (
        <div className="flex flex-col gap-4">
          <div className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-black/80">
            {f.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={f.url} alt={f.legenda ?? `Foto de ${f.autor}`} className="max-h-[62dvh] w-auto max-w-full object-contain" />
            ) : null}
            {fotos.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={anterior}
                  className="absolute left-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
                  aria-label="Foto anterior (seta para a esquerda)"
                >
                  <ChevronLeft className="size-6" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={proxima}
                  className="absolute right-2 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
                  aria-label="Próxima foto (seta para a direita)"
                >
                  <ChevronRight className="size-6" aria-hidden />
                </button>
              </>
            ) : null}
          </div>

          {editando ? (
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                iniciar(async () => {
                  const r = await editarLegendaFoto(eventoId, f.id, legenda);
                  avisar(r.ok ? (r.mensagem ?? "Salvo.") : r.erro, r.ok ? "ok" : "erro");
                  if (r.ok) {
                    setEditando(false);
                    router.refresh();
                  }
                });
              }}
            >
              <Campo wrapperClassName="flex-1" rotulo="Legenda" value={legenda} maxLength={200} onChange={(e) => setLegenda(e.target.value)} autoFocus />
              <div className="flex gap-2">
                <Botao variante="contorno" onClick={() => setEditando(false)}>
                  Cancelar
                </Botao>
                <Botao type="submit" carregando={pendente}>
                  Salvar
                </Botao>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Avatar nome={f.autor} caminho={f.autorAvatar} tamanho={32} />
              <p className="mr-auto text-sm text-suave">
                Enviada por <strong className="text-texto">{f.minha ? "você" : f.autor}</strong>
              </p>
              {f.minha ? (
                <Botao variante="fantasma" tamanho="p" onClick={() => setEditando(true)}>
                  <Pencil className="size-4" aria-hidden /> {f.legenda ? "Editar legenda" : "Pôr legenda"}
                </Botao>
              ) : (
                <Botao variante="fantasma" tamanho="p" onClick={() => setDenunciando(true)}>
                  <Flag className="size-4" aria-hidden /> Denunciar
                </Botao>
              )}
              {f.minha || admin ? (
                <Botao variante="fantasma" tamanho="p" className="text-rubi" onClick={() => setConfirmarExcluir(true)}>
                  <Trash2 className="size-4" aria-hidden /> Excluir
                </Botao>
              ) : null}
            </div>
          )}

          {confirmarExcluir ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-rubi/30 bg-rubi/5 p-4 sm:flex-row sm:items-center" role="alert">
              <p className="flex-1 text-sm">Excluir esta foto do álbum? Ela some para todo o grupo.</p>
              <div className="flex gap-2">
                <Botao variante="contorno" tamanho="p" onClick={() => setConfirmarExcluir(false)}>
                  Cancelar
                </Botao>
                <Botao
                  variante="perigo"
                  tamanho="p"
                  carregando={pendente}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await excluirFotoAlbum(eventoId, f.id);
                      avisar(r.ok ? (r.mensagem ?? "Excluída.") : r.erro, r.ok ? "ok" : "erro");
                      if (r.ok) {
                        aoMudar(null);
                        router.refresh();
                      }
                    })
                  }
                >
                  Excluir
                </Botao>
              </div>
            </div>
          ) : null}

          {denunciando ? (
            <form
              className="flex flex-col gap-3 rounded-2xl border border-borda p-4"
              onSubmit={(e) => {
                e.preventDefault();
                iniciar(async () => {
                  const r = await denunciarFoto(eventoId, f.id, motivo);
                  avisar(r.ok ? (r.mensagem ?? "Denúncia enviada.") : r.erro, r.ok ? "ok" : "erro");
                  if (r.ok) {
                    setDenunciando(false);
                    setMotivo("");
                  }
                });
              }}
            >
              <AreaTexto rotulo="O que há de errado com esta foto?" opcional value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} className="min-h-20" />
              <div className="flex justify-end gap-2">
                <Botao variante="contorno" tamanho="p" onClick={() => setDenunciando(false)}>
                  Cancelar
                </Botao>
                <Botao type="submit" tamanho="p" carregando={pendente}>
                  Enviar denúncia
                </Botao>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </Dialogo>
  );
}
