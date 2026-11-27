"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MotionConfig, Reorder, useDragControls } from "framer-motion";
import { ArrowDown, ArrowUp, ExternalLink, Gift, GripVertical, ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { Botao, BotaoIcone } from "@/components/ui/botao";
import { Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { urlPublicaDaMidia } from "@/lib/env";
import { dinheiro } from "@/lib/formatos";
import { cn } from "@/lib/cn";
import { excluirDesejo, reordenarDesejos } from "@/lib/acoes/desejos";
import { FormularioDesejo } from "@/components/desejos/formulario-desejo";
import { LIMITE_DESEJOS, dominioDoLink, mover } from "@/components/desejos/regras";

export type ItemDesejo = {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  image_path: string | null;
  price_estimate: number | null;
  position: number;
};

function ordinal(n: number) {
  return `${n}º`;
}

/** A lista de desejos: adicionar, editar, excluir e a ordem de preferência (botões subir/descer ou arrastar). */
export function ListaDesejos({ itens: iniciais }: { itens: ItemDesejo[] }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [itens, setItens] = useState(iniciais);
  const [editando, setEditando] = useState<ItemDesejo | null | "novo">(null);
  const [excluindo, setExcluindo] = useState<ItemDesejo | null>(null);
  const [anuncio, setAnuncio] = useState("");
  const [salvandoOrdem, iniciarOrdem] = useTransition();
  const [apagando, iniciarApagar] = useTransition();
  const ordemSalva = useRef(iniciais.map((i) => i.id).join(","));
  const atual = useRef(itens);
  atual.current = itens;
  const { menosMovimento } = usePreferencias();

  // quando o servidor manda a lista nova (depois de salvar), ela manda
  useEffect(() => {
    setItens(iniciais);
    ordemSalva.current = iniciais.map((i) => i.id).join(",");
  }, [iniciais]);

  function salvarOrdem(lista: ItemDesejo[]) {
    const ids = lista.map((i) => i.id);
    if (ids.join(",") === ordemSalva.current) return;
    iniciarOrdem(async () => {
      const r = await reordenarDesejos(ids);
      if (r.ok) {
        ordemSalva.current = ids.join(",");
        router.refresh();
      } else {
        avisar(r.erro, "erro");
        router.refresh();
      }
    });
  }

  function moverPara(de: number, para: number, focoEm?: string) {
    const nova = mover(itens, de, para);
    setItens(nova);
    const item = itens[de];
    setAnuncio(`${item.title} agora é o ${ordinal(Math.max(0, Math.min(nova.length - 1, para)) + 1)} da lista.`);
    salvarOrdem(nova);
    if (focoEm) requestAnimationFrame(() => document.getElementById(focoEm)?.focus());
  }

  const cheia = itens.length >= LIMITE_DESEJOS;

  return (
    <MotionConfig reducedMotion={menosMovimento ? "always" : "user"}>
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-suave">
          <strong className="text-texto">{itens.length}</strong> de {LIMITE_DESEJOS} itens · o 1º é o mais desejado
          {salvandoOrdem ? <span className="ml-2 text-xs">(salvando a ordem…)</span> : null}
        </p>
        <Botao onClick={() => setEditando("novo")} disabled={cheia} variante="ouro" brilho={!itens.length}>
          <Plus className="size-5" aria-hidden /> Adicionar presente
        </Botao>
      </div>
      {cheia ? <p className="text-sm font-medium text-rubi">Sua lista chegou a {LIMITE_DESEJOS} itens. Remova algum para adicionar outro.</p> : null}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>

      {itens.length === 0 ? (
        <Vazio
          icone={<Gift className="size-10" />}
          titulo="Sua lista está vazia"
          texto="Adicione ideias de presente com foto, link e preço aproximado. Quem tirar você vai agradecer!"
          acao={
            <Botao onClick={() => setEditando("novo")} variante="primario">
              <Plus className="size-5" aria-hidden /> Adicionar o primeiro
            </Botao>
          }
        />
      ) : (
        <Reorder.Group axis="y" values={itens} onReorder={setItens} className="flex flex-col gap-3" as="ol">
          {itens.map((item, i) => (
            <LinhaDesejo
              key={item.id}
              item={item}
              indice={i}
              total={itens.length}
              aoSubir={() => moverPara(i, i - 1, i - 1 === 0 ? `desce-${item.id}` : `sobe-${item.id}`)}
              aoDescer={() => moverPara(i, i + 1, i + 1 === itens.length - 1 ? `sobe-${item.id}` : `desce-${item.id}`)}
              aoSoltar={() => salvarOrdem(atual.current)}
              aoEditar={() => setEditando(item)}
              aoExcluir={() => setExcluindo(item)}
            />
          ))}
        </Reorder.Group>
      )}

      <Dialogo
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo={editando === "novo" ? "Novo presente na lista" : "Editar presente"}
        descricao="Quanto mais detalhes, mais fácil para quem te tirar."
      >
        {editando !== null ? (
          <FormularioDesejo
            key={editando === "novo" ? "novo" : editando.id}
            item={editando === "novo" ? null : editando}
            aoCancelar={() => setEditando(null)}
            aoSalvar={(m) => {
              setEditando(null);
              avisar(m);
              router.refresh();
            }}
          />
        ) : null}
      </Dialogo>

      <Dialogo
        aberto={!!excluindo}
        aoFechar={() => setExcluindo(null)}
        titulo="Remover da lista?"
        descricao={excluindo ? `“${excluindo.title}” sai da sua lista de desejos.` : undefined}
      >
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Botao variante="fantasma" onClick={() => setExcluindo(null)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            carregando={apagando}
            onClick={() =>
              excluindo &&
              iniciarApagar(async () => {
                const alvo = excluindo;
                const r = await excluirDesejo(alvo.id);
                if (r.ok) {
                  setItens((l) => l.filter((x) => x.id !== alvo.id));
                  setExcluindo(null);
                  avisar(r.mensagem ?? "Removido.");
                  router.refresh();
                } else avisar(r.erro, "erro");
              })
            }
          >
            <Trash2 className="size-4" aria-hidden /> Remover
          </Botao>
        </div>
      </Dialogo>
    </div>
    </MotionConfig>
  );
}

function LinhaDesejo({
  item,
  indice,
  total,
  aoSubir,
  aoDescer,
  aoSoltar,
  aoEditar,
  aoExcluir,
}: {
  item: ItemDesejo;
  indice: number;
  total: number;
  aoSubir: () => void;
  aoDescer: () => void;
  aoSoltar: () => void;
  aoEditar: () => void;
  aoExcluir: () => void;
}) {
  const controles = useDragControls();
  const foto = urlPublicaDaMidia(item.image_path);
  const dominio = dominioDoLink(item.url);
  const preco = dinheiro(item.price_estimate);
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controles}
      onDragEnd={aoSoltar}
      className="vidro relative flex gap-3 rounded-cartao p-3 sm:p-4"
      aria-label={`${ordinal(indice + 1)}: ${item.title}`}
    >
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span
          className={cn(
            "inline-flex size-8 items-center justify-center rounded-full text-sm font-bold",
            indice === 0 ? "bg-[linear-gradient(135deg,#f7dc8e,#e2b04a_55%,#c48c22)] text-[#3b2a06]" : "bg-black/5 text-suave dark:bg-white/10",
          )}
          aria-hidden
        >
          {indice + 1}
        </span>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            controles.start(e);
          }}
          aria-hidden
          tabIndex={-1}
          title="Arraste para mudar a ordem"
          className="hidden h-10 w-8 cursor-grab touch-none items-center justify-center rounded-xl text-suave hover:bg-black/5 active:cursor-grabbing sm:inline-flex dark:hover:bg-white/10"
        >
          <GripVertical className="size-5" />
        </button>
      </div>

      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/5 sm:size-20 dark:bg-white/5">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={`Foto de ${item.title}`} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="size-6 text-suave/60" aria-hidden />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="break-words font-semibold leading-snug">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {preco ? <span className="font-semibold text-esmeralda">≈ {preco}</span> : null}
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex min-h-8 items-center gap-1 font-medium text-t1 underline-offset-4 hover:underline"
            >
              {dominio ?? "Ver produto"} <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(abre em outra aba)</span>
            </a>
          ) : null}
        </div>
        {item.notes ? <p className="whitespace-pre-line break-words text-sm text-suave">{item.notes}</p> : null}
        <div className="mt-1 flex flex-wrap gap-1">
          <Botao variante="fantasma" tamanho="p" className="h-10 px-3" onClick={aoEditar} aria-label={`Editar ${item.title}`}>
            <Pencil className="size-4" aria-hidden /> Editar
          </Botao>
          <Botao variante="fantasma" tamanho="p" className="h-10 px-3 text-rubi" onClick={aoExcluir} aria-label={`Remover ${item.title}`}>
            <Trash2 className="size-4" aria-hidden /> Remover
          </Botao>
        </div>
      </div>

      <div className="flex shrink-0 flex-col justify-center gap-1">
        <BotaoIcone
          id={`sobe-${item.id}`}
          rotulo={`Subir ${item.title} na preferência`}
          onClick={aoSubir}
          disabled={indice === 0}
          className="size-11 border border-borda"
        >
          <ArrowUp className="size-4" aria-hidden />
        </BotaoIcone>
        <BotaoIcone
          id={`desce-${item.id}`}
          rotulo={`Descer ${item.title} na preferência`}
          onClick={aoDescer}
          disabled={indice === total - 1}
          className="size-11 border border-borda"
        >
          <ArrowDown className="size-4" aria-hidden />
        </BotaoIcone>
      </div>
    </Reorder.Item>
  );
}
