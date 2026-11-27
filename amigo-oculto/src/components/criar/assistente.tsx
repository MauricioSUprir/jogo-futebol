"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CalendarHeart,
  Check,
  ClipboardList,
  Gift,
  PartyPopper,
  PencilLine,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { useAvisos } from "@/components/ui/avisos";
import { usePreferencias } from "@/components/efeitos/preferencias";
import {
  CamposBasico,
  CamposParticipacao,
  CamposPresentes,
  CamposQuando,
  CamposRegras,
  idDoCampo,
  type ErrosEvento,
} from "@/components/criar/campos-evento";
import { PreviaEvento } from "@/components/criar/previa-evento";
import { criarEvento } from "@/lib/acoes/eventos";
import {
  CAMPOS_POR_ETAPA,
  RASCUNHO_VAZIO,
  errosDoEvento,
  etapaDoCampo,
  lerValor,
  rascunhoParaEntrada,
  type EtapaComCampos,
  type RascunhoEvento,
} from "@/lib/validacao/evento";
import { dataHora, deInputLocal, faixaDePreco } from "@/lib/formatos";
import { TEMAS } from "@/lib/temas";
import { cn } from "@/lib/cn";

type IdEtapa = EtapaComCampos | "revisao";

const ETAPAS: { id: IdEtapa; titulo: string; curto: string; descricao: string; icone: ReactNode }[] = [
  { id: "basico", titulo: "O básico", curto: "Básico", descricao: "Nome, uma descrição, a capa e o tema visual.", icone: <Sparkles className="size-5" /> },
  { id: "quando", titulo: "Quando e onde", curto: "Quando", descricao: "O dia da revelação e o local do encontro.", icone: <CalendarHeart className="size-5" /> },
  { id: "presentes", titulo: "Presentes", curto: "Presentes", descricao: "A faixa de valor combinada para o presente.", icone: <Gift className="size-5" /> },
  {
    id: "participacao",
    titulo: "Participação e sorteio",
    curto: "Sorteio",
    descricao: "Como as pessoas entram e quando acontece o sorteio.",
    icone: <Users className="size-5" />,
  },
  { id: "regras", titulo: "Regras", curto: "Regras", descricao: "As combinações do grupo, do seu jeito.", icone: <ScrollText className="size-5" /> },
  { id: "revisao", titulo: "Revisão", curto: "Revisão", descricao: "Confira tudo antes de criar.", icone: <ClipboardList className="size-5" /> },
];

const CHAVE_RASCUNHO = "ao:rascunho-evento:v1";

function lerRascunhoGuardado(): { r: RascunhoEvento; etapa: number } | null {
  try {
    const bruto = localStorage.getItem(CHAVE_RASCUNHO);
    if (!bruto) return null;
    const salvo = JSON.parse(bruto) as { r?: Partial<RascunhoEvento>; etapa?: number };
    if (!salvo?.r) return null;
    const r = { ...RASCUNHO_VAZIO, ...salvo.r };
    if (!(r.tema in TEMAS)) r.tema = "natal";
    const temConteudo = Object.entries(r).some(([k, v]) => v !== RASCUNHO_VAZIO[k as keyof RascunhoEvento]);
    if (!temConteudo) return null;
    return { r, etapa: Math.min(Math.max(0, Number(salvo.etapa) || 0), ETAPAS.length - 1) };
  } catch {
    return null;
  }
}

export function AssistenteCriar() {
  const router = useRouter();
  const { avisar } = useAvisos();
  const { menosMovimento } = usePreferencias();
  const [r, setR] = useState<RascunhoEvento>(RASCUNHO_VAZIO);
  const [etapa, setEtapa] = useState(0);
  const [direcao, setDirecao] = useState(1);
  const [tocados, setTocados] = useState<Set<string>>(new Set());
  const [errosServidor, setErrosServidor] = useState<ErrosEvento>({});
  const [recuperado, setRecuperado] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [enviando, iniciar] = useTransition();
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const primeiraRenderizacao = useRef(true);

  // rascunho guardado no aparelho (sobrevive a recarregar a página)
  useEffect(() => {
    const salvo = lerRascunhoGuardado();
    if (salvo) {
      setR(salvo.r);
      setEtapa(salvo.etapa);
      setRecuperado(true);
    }
    setCarregado(true);
  }, []);
  useEffect(() => {
    if (!carregado) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(CHAVE_RASCUNHO, JSON.stringify({ r, etapa }));
      } catch {
        // armazenamento cheio ou bloqueado: o rascunho continua na memória
      }
    }, 300);
    return () => clearTimeout(t);
  }, [r, etapa, carregado]);

  // foco no título a cada etapa (leitores de tela anunciam onde a pessoa está)
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    tituloRef.current?.focus({ preventScroll: true });
    tituloRef.current?.scrollIntoView({ block: "nearest", behavior: menosMovimento ? "auto" : "smooth" });
  }, [etapa, menosMovimento]);

  const todosErros = useMemo(() => errosDoEvento(rascunhoParaEntrada(r)), [r]);
  const erros: ErrosEvento = useMemo(() => {
    const visiveis: ErrosEvento = {};
    for (const [campo, msg] of Object.entries(todosErros)) if (tocados.has(campo)) visiveis[campo as keyof ErrosEvento] = msg;
    for (const [campo, msg] of Object.entries(errosServidor)) if (!visiveis[campo as keyof ErrosEvento]) visiveis[campo as keyof ErrosEvento] = msg;
    return visiveis;
  }, [todosErros, tocados, errosServidor]);

  const mudar = useCallback((parcial: Partial<RascunhoEvento>) => {
    setR((atual) => ({ ...atual, ...parcial }));
    setErrosServidor((e) => {
      const n = { ...e };
      for (const k of Object.keys(parcial)) delete n[k as keyof ErrosEvento];
      return n;
    });
  }, []);
  const aoSair = useCallback((campo: keyof RascunhoEvento) => setTocados((t) => (t.has(campo) ? t : new Set(t).add(campo))), []);

  const atual = ETAPAS[etapa];

  function irPara(indice: number) {
    setDirecao(indice > etapa ? 1 : -1);
    setEtapa(indice);
  }

  function focarPrimeiroErro(campos: readonly string[]) {
    const campo = campos.find((c) => todosErros[c as keyof ErrosEvento]);
    if (!campo) return;
    requestAnimationFrame(() => {
      const el = document.getElementById(idDoCampo(campo as keyof RascunhoEvento));
      el?.focus();
    });
  }

  function avancar(e?: FormEvent) {
    e?.preventDefault();
    if (atual.id === "revisao") return criar();
    const campos = CAMPOS_POR_ETAPA[atual.id];
    setTocados((t) => new Set([...t, ...campos]));
    if (campos.some((c) => todosErros[c])) {
      focarPrimeiroErro(campos);
      return;
    }
    irPara(etapa + 1);
  }

  function criar() {
    const todos = Object.values(CAMPOS_POR_ETAPA).flat();
    setTocados(new Set(todos));
    const comErro = todos.find((c) => todosErros[c]);
    if (comErro) {
      const destino = etapaDoCampo(comErro);
      if (destino) irPara(ETAPAS.findIndex((x) => x.id === destino));
      avisar("Falta ajustar um campo antes de criar.", "erro");
      return;
    }
    iniciar(async () => {
      const resultado = await criarEvento(rascunhoParaEntrada(r));
      if (resultado.ok && resultado.dados) {
        try {
          localStorage.removeItem(CHAVE_RASCUNHO);
        } catch {
          // nada
        }
        router.push(`/grupo/${resultado.dados.id}/compartilhar?novo=1`);
        return;
      }
      if (!resultado.ok) {
        avisar(resultado.erro, "erro");
        if (resultado.campos) {
          setErrosServidor(resultado.campos as ErrosEvento);
          const primeiro = Object.keys(resultado.campos)[0];
          const destino = primeiro ? etapaDoCampo(primeiro) : null;
          if (destino) irPara(ETAPAS.findIndex((x) => x.id === destino));
        }
      }
    });
  }

  function recomecar() {
    setR(RASCUNHO_VAZIO);
    setTocados(new Set());
    setErrosServidor({});
    setRecuperado(false);
    irPara(0);
    try {
      localStorage.removeItem(CHAVE_RASCUNHO);
    } catch {
      // nada
    }
  }

  const progresso = ((etapa + 1) / ETAPAS.length) * 100;
  const props = { r, mudar, erros, aoSair };
  const deslocamento = menosMovimento ? 0 : 28;

  return (
    <div data-tema={r.tema} className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-t1">Novo amigo oculto</p>
        <h1 className="font-titulo text-3xl font-semibold leading-tight sm:text-4xl">Vamos montar o seu grupo</h1>
        <p className="text-suave">Leva menos de dois minutos. Dá para mudar quase tudo depois, no painel do organizador.</p>
      </header>

      {recuperado ? (
        <div className="vidro flex flex-col gap-2 rounded-2xl px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between" role="status">
          <span>Recuperamos o rascunho que você começou neste aparelho.</span>
          <Botao variante="fantasma" tamanho="p" onClick={recomecar} className="self-start sm:self-auto">
            Começar do zero
          </Botao>
        </div>
      ) : null}

      {/* progresso */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold">
            Etapa {etapa + 1} de {ETAPAS.length}
            <span className="text-suave"> · {atual.titulo}</span>
          </span>
          <span className="tabular-nums text-suave">{Math.round(progresso)}%</span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-black/8 dark:bg-white/10"
          role="progressbar"
          aria-label="Progresso da criação"
          aria-valuemin={1}
          aria-valuemax={ETAPAS.length}
          aria-valuenow={etapa + 1}
          aria-valuetext={`Etapa ${etapa + 1} de ${ETAPAS.length}: ${atual.titulo}`}
        >
          <motion.div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--t1),var(--t3))]"
            initial={false}
            animate={{ width: `${progresso}%` }}
            transition={{ duration: menosMovimento ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <ol className="hidden grid-cols-6 gap-2 md:grid" aria-label="Etapas">
          {ETAPAS.map((x, i) => {
            const feita = i < etapa;
            const agora = i === etapa;
            return (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => (i < etapa ? irPara(i) : undefined)}
                  disabled={i > etapa}
                  aria-current={agora ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-full px-2 py-1.5 text-left text-xs font-semibold transition",
                    agora ? "text-t1" : feita ? "text-texto hover:bg-black/5 dark:hover:bg-white/5" : "text-suave/70",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px]",
                      agora ? "bg-t1 text-white" : feita ? "bg-esmeralda text-white" : "bg-black/8 dark:bg-white/10",
                    )}
                    aria-hidden
                  >
                    {feita ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="truncate">{x.curto}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Cartao forte className="overflow-hidden p-0 sm:p-0">
          <form onSubmit={avancar} noValidate className="flex flex-col">
            <div className="flex items-start gap-3 border-b border-borda px-5 py-4 sm:px-6">
              <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_14%,transparent)] text-t1" aria-hidden>
                {atual.icone}
              </span>
              <div className="min-w-0">
                <h2 ref={tituloRef} tabIndex={-1} className="font-titulo text-xl font-semibold leading-tight outline-none sm:text-2xl">
                  {atual.titulo}
                </h2>
                <p className="text-sm text-suave">{atual.descricao}</p>
              </div>
            </div>
            <div className="relative px-5 py-5 sm:px-6 sm:py-6">
              <AnimatePresence mode="wait" initial={false} custom={direcao}>
                <motion.div
                  key={atual.id}
                  custom={direcao}
                  initial={{ opacity: 0, x: direcao * deslocamento }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -direcao * deslocamento }}
                  transition={{ duration: menosMovimento ? 0 : 0.22, ease: "easeOut" }}
                >
                  {atual.id === "basico" ? <CamposBasico {...props} /> : null}
                  {atual.id === "quando" ? <CamposQuando {...props} /> : null}
                  {atual.id === "presentes" ? <CamposPresentes {...props} /> : null}
                  {atual.id === "participacao" ? <CamposParticipacao {...props} /> : null}
                  {atual.id === "regras" ? <CamposRegras {...props} /> : null}
                  {atual.id === "revisao" ? <Revisao r={r} irPara={(id) => irPara(ETAPAS.findIndex((x) => x.id === id))} erros={todosErros} /> : null}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-borda px-5 py-4 sm:px-6">
              {etapa > 0 ? (
                <Botao variante="contorno" onClick={() => irPara(etapa - 1)} disabled={enviando}>
                  <ArrowLeft className="size-4" aria-hidden /> Voltar
                </Botao>
              ) : (
                <span />
              )}
              {atual.id === "revisao" ? (
                <Botao type="submit" variante="ouro" tamanho="g" carregando={enviando} brilho>
                  {enviando ? null : <PartyPopper className="size-5" aria-hidden />}
                  {enviando ? "Criando…" : "Criar amigo oculto"}
                </Botao>
              ) : (
                <Botao type="submit" tamanho="m">
                  {etapa === ETAPAS.length - 2 ? "Revisar" : "Avançar"} <ArrowRight className="size-4" aria-hidden />
                </Botao>
              )}
            </div>
          </form>
        </Cartao>

        <aside className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-2" aria-label="Prévia">
          <p className="px-1 text-xs font-semibold uppercase tracking-[0.16em] text-suave">Prévia do convite</p>
          <PreviaEvento r={r} />
        </aside>
      </div>
    </div>
  );
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
      <dt className="text-sm text-suave sm:w-48 sm:shrink-0">{rotulo}</dt>
      <dd className="min-w-0 text-[15px] font-medium [overflow-wrap:anywhere]">{valor}</dd>
    </div>
  );
}

function BlocoResumo({ titulo, aoEditar, children, comErro }: { titulo: string; aoEditar: () => void; children: ReactNode; comErro?: boolean }) {
  return (
    <section className={cn("rounded-2xl border px-4 py-3", comErro ? "border-rubi/60 bg-rubi/5" : "border-borda")}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{titulo}</h3>
        <Botao variante="fantasma" tamanho="p" onClick={aoEditar} aria-label={`Alterar: ${titulo}`}>
          <PencilLine className="size-4" aria-hidden /> Alterar
        </Botao>
      </div>
      {comErro ? <p className="text-sm font-medium text-rubi">Há um campo para ajustar aqui.</p> : null}
      <dl className="divide-y divide-borda">{children}</dl>
    </section>
  );
}

function Revisao({ r, irPara, erros }: { r: RascunhoEvento; irPara: (id: EtapaComCampos) => void; erros: ErrosEvento }) {
  const quando = (v: string) => dataHora(deInputLocal(v), { weekday: "long", year: "numeric" }) ?? "—";
  const valor = (v: string) => {
    const n = lerValor(v);
    return n === null || Number.isNaN(n) ? null : n;
  };
  const temErro = (etapa: EtapaComCampos) => CAMPOS_POR_ETAPA[etapa].some((c) => erros[c]);
  return (
    <div className="flex flex-col gap-4">
      <div className="lg:hidden">
        <PreviaEvento r={r} />
      </div>
      <BlocoResumo titulo="O básico" aoEditar={() => irPara("basico")} comErro={temErro("basico")}>
        <LinhaResumo rotulo="Nome" valor={r.nome.trim() || "—"} />
        <LinhaResumo rotulo="Descrição" valor={r.descricao.trim() ? <span className="whitespace-pre-line">{r.descricao.trim()}</span> : "Sem descrição"} />
        <LinhaResumo rotulo="Capa" valor={r.capa ? "Foto escolhida" : "Cores do tema"} />
        <LinhaResumo rotulo="Tema" valor={TEMAS[r.tema].nome} />
      </BlocoResumo>
      <BlocoResumo titulo="Quando e onde" aoEditar={() => irPara("quando")} comErro={temErro("quando")}>
        <LinhaResumo rotulo="Revelação" valor={r.revelacaoEm ? quando(r.revelacaoEm) : "A definir"} />
        <LinhaResumo rotulo="Local" valor={r.local.trim() || "A definir"} />
      </BlocoResumo>
      <BlocoResumo titulo="Presentes" aoEditar={() => irPara("presentes")} comErro={temErro("presentes")}>
        <LinhaResumo rotulo="Faixa de valor" valor={faixaDePreco(valor(r.valorMinimo), valor(r.valorMaximo)) ?? "Sem faixa de valor"} />
      </BlocoResumo>
      <BlocoResumo titulo="Participação e sorteio" aoEditar={() => irPara("participacao")} comErro={temErro("participacao")}>
        <LinhaResumo
          rotulo="Sorteio"
          valor={
            r.modoSorteio === "scheduled"
              ? `Agendado para ${r.sorteioEm ? quando(r.sorteioEm) : "—"}`
              : r.sorteioEm
                ? `Feito por você (previsto para ${quando(r.sorteioEm)})`
                : "Feito por você, quando quiser"
          }
        />
        <LinhaResumo rotulo="Prazo para entrar" valor={r.prazoEntrada ? quando(r.prazoEntrada) : "Sem prazo"} />
        <LinhaResumo rotulo="Limite" valor={r.limite ? `${r.limite} pessoas` : "Sem limite"} />
        <LinhaResumo rotulo="Visibilidade" valor={r.visibilidade === "public" ? "Público (aparece em Explorar)" : "Privado (só com convite)"} />
        <LinhaResumo rotulo="Novos participantes" valor={r.aprovacao ? "Precisam da sua aprovação" : "Entram direto pelo convite"} />
      </BlocoResumo>
      <BlocoResumo titulo="Regras" aoEditar={() => irPara("regras")} comErro={temErro("regras")}>
        <LinhaResumo rotulo="Regras" valor={r.regras.trim() ? <span className="whitespace-pre-line">{r.regras.trim()}</span> : "Sem regras extras"} />
      </BlocoResumo>
      <p className="flex items-start gap-2 rounded-2xl bg-esmeralda/10 px-4 py-3 text-sm">
        <Check className="mt-0.5 size-4 shrink-0 text-esmeralda" aria-hidden />
        Ao criar, você recebe na hora um código exclusivo, um QR Code e o link para mandar pelo WhatsApp.
      </p>
    </div>
  );
}
