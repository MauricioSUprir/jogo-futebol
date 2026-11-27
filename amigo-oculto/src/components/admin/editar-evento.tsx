"use client";
import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Save, Undo2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import {
  CamposBasico,
  CamposParticipacao,
  CamposPresentes,
  CamposQuando,
  CamposRegras,
  idDoCampo,
  type ErrosEvento,
} from "@/components/criar/campos-evento";
import { useAcao } from "@/components/admin/usar-acao";
import { editarEvento } from "@/lib/acoes/eventos";
import { errosDoEvento, neutralizarTravados, rascunhoParaEntrada, type RascunhoEvento } from "@/lib/validacao/evento";
import { cn } from "@/lib/cn";

function Bloco({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <Cartao>
      <TituloCartao titulo={titulo} descricao={descricao} nivel={3} />
      {children}
    </Cartao>
  );
}

export function EditarEvento({
  eventoId,
  inicial,
  original,
  ocupados,
  sorteado,
}: {
  eventoId: string;
  inicial: RascunhoEvento;
  original: { revelacaoEm: string | null; prazoEntrada: string | null; sorteioEm: string | null };
  ocupados: number;
  sorteado: boolean;
}) {
  const [base, setBase] = useState(inicial);
  const [r, setR] = useState(inicial);
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [errosServidor, setErrosServidor] = useState<ErrosEvento>({});
  const { pendente, executar } = useAcao();

  // depois do sorteio os campos travados não são gravados: não entram na validação (mesma regra do servidor)
  const relevantes: ErrosEvento = useMemo(() => {
    const entrada = rascunhoParaEntrada(r);
    return errosDoEvento(sorteado ? neutralizarTravados(entrada) : entrada, { original, ocupados: sorteado ? undefined : ocupados });
  }, [r, original, ocupados, sorteado]);
  const erros: ErrosEvento = useMemo(() => {
    const v: ErrosEvento = {};
    for (const [k, m] of Object.entries(relevantes)) if (tocados.has(k)) v[k as keyof ErrosEvento] = m;
    return { ...v, ...errosServidor };
  }, [relevantes, tocados, errosServidor]);

  const mudou = JSON.stringify(r) !== JSON.stringify(base);
  const mudar = useCallback((p: Partial<RascunhoEvento>) => {
    setR((a) => ({ ...a, ...p }));
    setErrosServidor((e) => {
      const n = { ...e };
      for (const k of Object.keys(p)) delete n[k as keyof ErrosEvento];
      return n;
    });
  }, []);
  const aoSair = useCallback((c: keyof RascunhoEvento) => setTocados((t) => (t.has(c) ? t : new Set(t).add(c))), []);

  function salvar(e?: FormEvent) {
    e?.preventDefault();
    setTocados(new Set(Object.keys(r)));
    const primeiro = Object.keys(relevantes)[0];
    if (primeiro) {
      document.getElementById(idDoCampo(primeiro as keyof RascunhoEvento))?.focus();
      return;
    }
    executar(() => editarEvento(eventoId, rascunhoParaEntrada(r)), {
      depois: () => {
        setBase(r);
        setTocados(new Set());
      },
      erro: (res) => {
        if (!res.ok && res.campos) {
          setErrosServidor(res.campos as ErrosEvento);
          const c = Object.keys(res.campos)[0];
          if (c) document.getElementById(idDoCampo(c as keyof RascunhoEvento))?.focus();
        }
      },
    });
  }

  const props = { r, mudar, erros, aoSair };
  return (
    <form data-tema={r.tema} onSubmit={salvar} noValidate className="flex flex-col gap-5">
      <Bloco titulo="O básico" descricao="Nome, descrição, capa e tema. O tema muda as cores da sala para todos.">
        <CamposBasico {...props} />
      </Bloco>
      <Bloco titulo="Quando e onde" descricao="Mudar a data da revelação ou o local avisa todo o grupo.">
        <CamposQuando {...props} />
      </Bloco>
      <Bloco titulo="Presentes">
        <CamposPresentes {...props} />
      </Bloco>
      <Bloco titulo="Participação e sorteio">
        <CamposParticipacao {...props} travado={sorteado} />
      </Bloco>
      <Bloco titulo="Regras" descricao="Mudanças nas regras também avisam o grupo.">
        <CamposRegras {...props} />
      </Bloco>

      <div
        className={cn(
          "vidro-forte sticky bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex flex-col gap-2 rounded-3xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:bottom-4",
          !mudou && "opacity-90",
        )}
      >
        <p className="text-sm font-medium" aria-live="polite">
          {mudou ? "Você tem alterações não salvas." : "Tudo salvo."}
        </p>
        <div className="flex gap-2">
          <Botao
            variante="fantasma"
            disabled={!mudou || pendente}
            onClick={() => {
              setR(base);
              setTocados(new Set());
              setErrosServidor({});
            }}
          >
            <Undo2 className="size-4" aria-hidden /> Descartar
          </Botao>
          <Botao type="submit" carregando={pendente} disabled={!mudou}>
            <Save className="size-4" aria-hidden /> Salvar alterações
          </Botao>
        </div>
      </div>
    </form>
  );
}
