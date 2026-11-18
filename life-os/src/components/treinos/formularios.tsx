"use client";
// Formulários do Fitness Center: cardio, futebol, recuperação e o escolhedor do "Registrar atividade".
import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Dumbbell, Footprints, PersonStanding, Plus, Trophy } from "lucide-react";
import { registrarAtividade, salvarRecuperacao } from "@/acoes/treinos";
import { AreaTexto, Campo, Entrada, Mensagem, Selecao, classesBotao } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { ESFORCO, POSICOES, TIPOS_CARDIO, TIPOS_FUTEBOL, ritmo } from "@/lib/treinos";
import { cn } from "@/lib/cn";

function useFecharNoSucesso(ok?: string) {
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (ok) fechar();
  }, [ok, fechar]);
}

/** Esforço percebido 0–10 (CR-10) com a legenda curta. */
export function CampoEsforco({ id, valor, obrigatorio }: { id: string; valor?: number | null; obrigatorio?: boolean }) {
  return (
    <Campo rotulo="Esforço percebido (0 a 10)" htmlFor={id} dica="0 repouso · 3 moderado · 5 forte · 7 muito forte · 10 máximo">
      <Selecao id={id} name="esforco" defaultValue={valor ?? ""} required={obrigatorio}>
        <option value="">Não informar</option>
        {Object.entries(ESFORCO).map(([k, v]) => (
          <option key={k} value={k}>
            {k} · {v}
          </option>
        ))}
      </Selecao>
    </Campo>
  );
}

function CamposDiaHora({ prefixo, hoje, dia, hora }: { prefixo: string; hoje: string; dia?: string; hora?: string }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Campo rotulo="Data" htmlFor={`${prefixo}-dia`}>
        <Entrada id={`${prefixo}-dia`} name="dia" type="date" required max={hoje} defaultValue={dia ?? hoje} />
      </Campo>
      <Campo rotulo="Horário (opcional)" htmlFor={`${prefixo}-hora`}>
        <Entrada id={`${prefixo}-hora`} name="hora" type="time" defaultValue={hora} />
      </Campo>
    </div>
  );
}

// ───────────── Cardio ─────────────

export interface CardioInicial {
  id: string;
  subtipo: string;
  dia: string;
  hora?: string;
  duracao: number;
  distancia: number | null;
  esforco: number | null;
  notas: string | null;
}

export function FormCardio({ hoje, inicial }: { hoje: string; inicial?: CardioInicial }) {
  const [estado, acao] = useActionState(registrarAtividade, undefined);
  const [dur, setDur] = useState(String(inicial?.duracao ?? 30));
  const [km, setKm] = useState(inicial?.distancia != null ? String(inicial.distancia) : "");
  const [sub, setSub] = useState(inicial?.subtipo ?? "corrida");
  useFecharNoSucesso(estado?.ok);
  const r = ritmo(Number(dur), Number(km.replace(",", ".")));
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="tipo" value="cardio" />
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <Campo rotulo="Atividade" htmlFor="cd-sub">
        <Selecao id="cd-sub" name="subtipo" value={sub} onChange={(e) => setSub(e.target.value)}>
          {Object.entries(TIPOS_CARDIO).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Selecao>
      </Campo>
      <CamposDiaHora prefixo="cd" hoje={hoje} dia={inicial?.dia} hora={inicial?.hora} />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Duração (min)" htmlFor="cd-dur">
          <Entrada id="cd-dur" name="duracao" type="number" inputMode="numeric" min={1} max={600} required value={dur} onChange={(e) => setDur(e.target.value)} />
        </Campo>
        <Campo rotulo="Distância (km, opcional)" htmlFor="cd-km">
          <Entrada id="cd-km" name="distancia" inputMode="decimal" placeholder="Ex.: 5,2" value={km} onChange={(e) => setKm(e.target.value)} />
        </Campo>
      </div>
      {r && ["corrida", "caminhada", "esteira"].includes(sub) && (
        <p className="text-xs text-suave" aria-live="polite">
          Ritmo: <span className="numero text-texto">{r}</span>
        </p>
      )}
      <CampoEsforco id="cd-esf" valor={inicial?.esforco} />
      <Campo rotulo="Observações (opcional)" htmlFor="cd-notas">
        <AreaTexto id="cd-notas" name="notas" maxLength={2000} defaultValue={inicial?.notas ?? ""} className="min-h-16" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar" : "Registrar cardio"}</BotaoEnvio>
    </form>
  );
}

// ───────────── Futebol ─────────────

export interface FutebolInicial {
  id: string;
  subtipo: string;
  dia: string;
  hora?: string;
  duracao: number;
  esforco: number | null;
  minutos: number | null;
  gols: number | null;
  assistencias: number | null;
  posicao: string | null;
  time: string | null;
  adversario: string | null;
  competicao: string | null;
  placarPro: number | null;
  placarContra: number | null;
  nota: number | null;
  notas: string | null;
}

export function FormFutebol({ hoje, inicial, subtipoInicial }: { hoje: string; inicial?: FutebolInicial; subtipoInicial?: string }) {
  const [estado, acao] = useActionState(registrarAtividade, undefined);
  const [sub, setSub] = useState(inicial?.subtipo ?? subtipoInicial ?? "partida");
  useFecharNoSucesso(estado?.ok);
  const jogo = sub !== "treino";
  const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-3">
      <input type="hidden" name="tipo" value="futebol" />
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <fieldset>
        <legend className="mb-1.5 text-xs font-medium text-suave">Tipo</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(TIPOS_FUTEBOL).map(([k, v]) => (
            <label key={k}>
              <input type="radio" name="subtipo" value={k} checked={sub === k} onChange={() => setSub(k)} className="peer sr-only" />
              <span className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-borda bg-fundo-2/70 px-2 text-center text-xs leading-tight text-suave transition peer-checked:border-eletrico peer-checked:bg-eletrico/20 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
                {v}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <CamposDiaHora prefixo="fb" hoje={hoje} dia={inicial?.dia} hora={inicial?.hora} />
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Duração total (min)" htmlFor="fb-dur">
          <Entrada id="fb-dur" name="duracao" type="number" inputMode="numeric" min={1} max={600} required defaultValue={inicial?.duracao ?? (jogo ? 90 : 60)} />
        </Campo>
        {jogo ? (
          <Campo rotulo="Minutos jogados" htmlFor="fb-min">
            <Entrada id="fb-min" name="minutos" type="number" inputMode="numeric" min={0} max={200} defaultValue={n(inicial?.minutos)} placeholder="Ex.: 70" />
          </Campo>
        ) : (
          <Campo rotulo="Time (opcional)" htmlFor="fb-time">
            <Entrada id="fb-time" name="time" maxLength={60} defaultValue={inicial?.time ?? ""} />
          </Campo>
        )}
      </div>
      {jogo && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Gols" htmlFor="fb-gols">
              <Entrada id="fb-gols" name="gols" type="number" inputMode="numeric" min={0} max={50} defaultValue={n(inicial?.gols ?? 0)} />
            </Campo>
            <Campo rotulo="Assistências" htmlFor="fb-ast">
              <Entrada id="fb-ast" name="assistencias" type="number" inputMode="numeric" min={0} max={50} defaultValue={n(inicial?.assistencias ?? 0)} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Posição" htmlFor="fb-pos">
              <Selecao id="fb-pos" name="posicao" defaultValue={inicial?.posicao ?? ""}>
                <option value="">—</option>
                {Object.entries(POSICOES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Selecao>
            </Campo>
            <Campo rotulo="Adversário" htmlFor="fb-adv">
              <Entrada id="fb-adv" name="adversario" maxLength={60} defaultValue={inicial?.adversario ?? ""} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo rotulo="Seu time" htmlFor="fb-time">
              <Entrada id="fb-time" name="time" maxLength={60} defaultValue={inicial?.time ?? ""} />
            </Campo>
            <Campo rotulo="Competição" htmlFor="fb-comp">
              <Entrada id="fb-comp" name="competicao" maxLength={60} defaultValue={inicial?.competicao ?? ""} placeholder="Ex.: Interclasse" />
            </Campo>
          </div>
          <fieldset className="grid grid-cols-1 gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-suave">Placar (opcional)</legend>
            <div className="flex items-center gap-2">
              <Entrada aria-label="Gols do seu time" name="placarPro" type="number" inputMode="numeric" min={0} max={99} defaultValue={n(inicial?.placarPro)} className="w-20 text-center" />
              <span className="text-suave">×</span>
              <Entrada aria-label="Gols do adversário" name="placarContra" type="number" inputMode="numeric" min={0} max={99} defaultValue={n(inicial?.placarContra)} className="w-20 text-center" />
            </div>
          </fieldset>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Desempenho percebido" htmlFor="fb-nota">
          <Selecao id="fb-nota" name="nota" defaultValue={n(inicial?.nota)}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => (
              <option key={v} value={v}>
                {v} de 10
              </option>
            ))}
          </Selecao>
        </Campo>
        <CampoEsforco id="fb-esf" valor={inicial?.esforco} />
      </div>
      <Campo rotulo={jogo ? "Observações (opcional)" : "Foco do treino"} htmlFor="fb-notas">
        <AreaTexto
          id="fb-notas"
          name="notas"
          maxLength={2000}
          defaultValue={inicial?.notas ?? ""}
          className="min-h-16"
          placeholder={jogo ? "Ex.: joguei bem na marcação, errei passes no 2º tempo." : "Ex.: finalização de perna esquerda, passe longo."}
        />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{inicial ? "Salvar" : jogo ? "Registrar jogo" : "Registrar treino"}</BotaoEnvio>
    </form>
  );
}

// ───────────── Recuperação ─────────────

export interface RecuperacaoInicial {
  descanso: boolean;
  cansaco: number | null;
  recuperacao: number | null;
  dor: number | null;
  desconforto: string | null;
  local: string | null;
  notas: string | null;
}

function Escala5({ nome, rotulo, valor, baixo, alto }: { nome: string; rotulo: string; valor: number | null; baixo: string; alto: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-xs font-medium text-suave">
        {rotulo} <span className="text-apagado">(1 {baixo} · 5 {alto})</span>
      </legend>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => (
          <label key={v} className="flex-1">
            <input type="radio" name={nome} value={v} defaultChecked={valor === v} className="peer sr-only" />
            <span className="flex h-10 cursor-pointer items-center justify-center rounded-lg border border-borda bg-fundo-2/70 text-sm text-suave transition peer-checked:border-eletrico peer-checked:bg-eletrico/20 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
              {v}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FormRecuperacao({ dia, hoje, inicial }: { dia: string; hoje: string; inicial?: RecuperacaoInicial | null }) {
  const [estado, acao] = useActionState(salvarRecuperacao, undefined);
  const [diaSel, setDiaSel] = useState(dia);
  const futuro = diaSel > hoje;
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Dia" htmlFor="rc-dia">
          <Entrada id="rc-dia" name="dia" type="date" required value={diaSel} onChange={(e) => setDiaSel(e.target.value)} />
        </Campo>
        <label className="mt-6 flex items-center gap-2 text-sm text-suave">
          <input type="checkbox" name="descanso" defaultChecked={inicial?.descanso} className="h-4 w-4 accent-[#2563eb]" />
          Dia de descanso
        </label>
      </div>
      {futuro ? (
        <p className="text-xs text-suave">Dia que ainda não chegou: dá para planejar o descanso.</p>
      ) : (
        <>
          <Escala5 nome="cansaco" rotulo="Cansaço" valor={inicial?.cansaco ?? null} baixo="nenhum" alto="muito" />
          <Escala5 nome="recuperacao" rotulo="Recuperação percebida" valor={inicial?.recuperacao ?? null} baixo="pouca" alto="total" />
          <Escala5 nome="dor" rotulo="Dor muscular" valor={inicial?.dor ?? null} baixo="nenhuma" alto="forte" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo rotulo="Desconforto (opcional)" htmlFor="rc-desc" dica="Só registra; não é diagnóstico.">
              <Entrada id="rc-desc" name="desconforto" maxLength={200} defaultValue={inicial?.desconforto ?? ""} placeholder="Ex.: incômodo ao correr" />
            </Campo>
            <Campo rotulo="Onde" htmlFor="rc-local">
              <Entrada id="rc-local" name="local" maxLength={60} defaultValue={inicial?.local ?? ""} placeholder="Ex.: joelho direito" />
            </Campo>
          </div>
        </>
      )}
      <Campo rotulo="Observações (opcional)" htmlFor="rc-notas">
        <AreaTexto id="rc-notas" name="notas" maxLength={1000} defaultValue={inicial?.notas ?? ""} className="min-h-16" />
      </Campo>
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado?.ok && <Mensagem tipo="ok">{estado.ok}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">Salvar recuperação</BotaoEnvio>
    </form>
  );
}

// ───────────── Registrar atividade (3 opções) ─────────────

export function EscolherAtividade({ hoje, fichas }: { hoje: string; fichas: { id: string; nome: string }[] }) {
  const [modo, setModo] = useState<"inicio" | "musculacao" | "cardio" | "futebol">("inicio");
  const fechar = useFecharDialogo();
  if (modo === "cardio") return <FormCardio hoje={hoje} />;
  if (modo === "futebol") return <FormFutebol hoje={hoje} />;
  if (modo === "musculacao")
    return (
      <div className="grid grid-cols-1 gap-2">
        <p className="text-sm text-suave">Registrar pela ficha (as séries já vêm preenchidas com a carga da última vez):</p>
        {fichas.length === 0 && <p className="text-sm text-apagado">Nenhuma ficha ainda. Crie uma na aba Musculação.</p>}
        <ul className="grid grid-cols-1 gap-1.5">
          {fichas.map((f) => (
            <li key={f.id}>
              <Link href={`/treinos/sessao?ficha=${f.id}`} onClick={fechar} className={classesBotao("secundario", "m", "w-full justify-start")}>
                <Dumbbell className="h-4 w-4 text-eletrico-claro" aria-hidden /> <span className="truncate">{f.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/treinos/sessao" onClick={fechar} className={classesBotao("contorno", "m")}>
          <Plus className="h-4 w-4" /> Sessão livre
        </Link>
      </div>
    );
  const opcoes = [
    { m: "musculacao" as const, nome: "Musculação", d: "Por ficha ou livre", icone: Dumbbell },
    { m: "cardio" as const, nome: "Cardio", d: "Corrida, bike, caminhada…", icone: Footprints },
    { m: "futebol" as const, nome: "Futebol", d: "Jogo, treino ou pelada", icone: Trophy },
  ];
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {opcoes.map((o) => (
        <button
          key={o.m}
          type="button"
          onClick={() => setModo(o.m)}
          className={cn(classesBotao("secundario", "g", "h-auto flex-col gap-1 py-4"))}
        >
          <o.icone className="h-5 w-5 text-eletrico-claro" aria-hidden />
          <span className="font-semibold">{o.nome}</span>
          <span className="text-xs font-normal text-suave">{o.d}</span>
        </button>
      ))}
      <p className="text-xs text-apagado sm:col-span-3">
        <PersonStanding className="mr-1 inline h-3.5 w-3.5" aria-hidden />
        Registrar também marca o dia como dia de treino no Hydro Track.
      </p>
    </div>
  );
}
