"use client";
import { useEffect, useRef, useState } from "react";
import { ImagePlus, Link2, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { urlPublicaDaMidia } from "@/lib/env";
import { enviarMidia, prepararImagem } from "@/lib/imagem";
import { salvarDesejo } from "@/lib/acoes/desejos";
import { normalizarLink, precoDeTexto, precoParaCampo } from "@/components/desejos/regras";
import type { ItemDesejo } from "@/components/desejos/lista-desejos";

/** Adicionar ou editar um item: nome, foto, link (https), preço aproximado e observação. */
export function FormularioDesejo({
  item,
  aoSalvar,
  aoCancelar,
}: {
  item?: ItemDesejo | null;
  aoSalvar: (mensagem: string) => void;
  aoCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(item?.title ?? "");
  const [link, setLink] = useState(item?.url ?? "");
  const [preco, setPreco] = useState(precoParaCampo(item?.price_estimate));
  const [observacao, setObservacao] = useState(item?.notes ?? "");
  const [imagem, setImagem] = useState<string | null>(item?.image_path ?? null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<"livre" | "enviando" | "salvando">("livre");
  const entradaArquivo = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa);
  }, [previa]);

  const mostrar = previa ?? urlPublicaDaMidia(imagem);

  async function escolherFoto(f: File | undefined) {
    if (!f) return;
    setErros((e) => ({ ...e, foto: "" }));
    try {
      await prepararImagem(f, 64); // confere se a imagem abre (formato e tamanho) antes de aceitar
      setArquivo(f);
      setPrevia(URL.createObjectURL(f));
    } catch (e) {
      setErros((x) => ({ ...x, foto: e instanceof Error ? e.message : "Imagem inválida." }));
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const novosErros: Record<string, string> = {};
    if (!titulo.trim()) novosErros.titulo = "Dê um nome ao presente.";
    if (link.trim() && !normalizarLink(link)) novosErros.link = "Use um link que comece com https://.";
    const p = precoDeTexto(preco);
    if (p !== null && Number.isNaN(p)) novosErros.preco = "Informe um valor em reais, por exemplo 89,90.";
    setErros(novosErros);
    if (Object.keys(novosErros).length) return;
    setErroGeral(null);
    try {
      let caminho = imagem;
      if (arquivo) {
        setEtapa("enviando");
        caminho = await enviarMidia(arquivo, "desejo", 1200);
      }
      setEtapa("salvando");
      const r = await salvarDesejo({ id: item?.id, titulo, link, preco, observacao, imagem: caminho });
      if (!r.ok) {
        setErros(r.campos ?? {});
        setErroGeral(r.erro);
        return;
      }
      aoSalvar(r.mensagem ?? "Salvo!");
    } catch (erro) {
      setErroGeral(erro instanceof Error ? erro.message : "Não foi possível salvar.");
    } finally {
      setEtapa("livre");
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <Campo
        rotulo="O que você quer ganhar?"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={120}
        required
        autoFocus
        placeholder="Ex.: Fone de ouvido sem fio"
        erro={erros.titulo}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">
          Foto <span className="font-normal text-suave">(opcional)</span>
        </span>
        <div className="flex items-center gap-3">
          <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-borda bg-white/50 dark:bg-white/5">
            {mostrar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mostrar} alt="Prévia da foto do presente" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus className="size-7 text-suave" aria-hidden />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={entradaArquivo}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
              className="sr-only"
              id="foto-desejo"
              onChange={(e) => {
                void escolherFoto(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Botao variante="contorno" tamanho="p" onClick={() => entradaArquivo.current?.click()} aria-describedby="foto-desejo-dica">
              <ImagePlus className="size-4" aria-hidden /> {mostrar ? "Trocar foto" : "Escolher foto"}
            </Botao>
            {mostrar ? (
              <Botao
                variante="fantasma"
                tamanho="p"
                onClick={() => {
                  setArquivo(null);
                  setPrevia(null);
                  setImagem(null);
                }}
              >
                <Trash2 className="size-4" aria-hidden /> Tirar
              </Botao>
            ) : null}
          </div>
        </div>
        <p id="foto-desejo-dica" className={erros.foto ? "text-sm font-medium text-rubi" : "text-xs text-suave"} role={erros.foto ? "alert" : undefined}>
          {erros.foto || "JPG, PNG ou WebP. A foto é reduzida no seu aparelho antes de enviar."}
        </p>
      </div>

      <Campo
        rotulo={
          <span className="inline-flex items-center gap-1.5">
            <Link2 className="size-4" aria-hidden /> Link do produto
          </span>
        }
        opcional
        value={link}
        onChange={(e) => setLink(e.target.value)}
        inputMode="url"
        type="url"
        maxLength={1000}
        placeholder="https://loja.com.br/produto"
        dica="Só links seguros (https)."
        erro={erros.link}
      />
      <Campo
        rotulo="Preço aproximado (R$)"
        opcional
        value={preco}
        onChange={(e) => setPreco(e.target.value)}
        inputMode="decimal"
        maxLength={20}
        placeholder="Ex.: 89,90"
        erro={erros.preco}
      />
      <AreaTexto
        rotulo="Observação"
        opcional
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        maxLength={500}
        rows={3}
        placeholder="Ex.: Pode ser de qualquer cor, menos rosa."
        dica={`${observacao.length}/500`}
        erro={erros.observacao}
      />
      {erroGeral ? (
        <p role="alert" className="rounded-2xl bg-rubi/10 px-4 py-3 text-sm font-medium text-rubi">
          {erroGeral}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Botao variante="fantasma" onClick={aoCancelar} disabled={etapa !== "livre"}>
          Cancelar
        </Botao>
        <Botao type="submit" variante="esmeralda" carregando={etapa !== "livre"}>
          {etapa === "enviando" ? "Enviando a foto…" : etapa === "salvando" ? "Salvando…" : item ? "Salvar alterações" : "Adicionar à lista"}
        </Botao>
      </div>
    </form>
  );
}
