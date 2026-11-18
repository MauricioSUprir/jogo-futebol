"use client";
// Formulário do check-in do dia. "saude" = diário de saúde (energia, disposição, observações);
// "mente" = humor, energia, estresse e emoções; "completo" = tudo (Registrar).
import { useActionState, useEffect, useId } from "react";
import { Annoyed, Frown, Laugh, Meh, Smile, type LucideIcon } from "lucide-react";
import { salvarCheckin } from "@/acoes/checkin";
import { DISPOSICAO, EMOCOES, ESTRESSE, HUMOR, type Checkin } from "@/lib/checkin";
import { AreaTexto, Campo, Mensagem } from "../ui";
import { BotaoEnvio, manterValores, useFecharDialogo } from "../cliente";
import { cn } from "@/lib/cn";

const ICONES_HUMOR: Record<number, LucideIcon> = { 1: Frown, 2: Annoyed, 3: Meh, 4: Smile, 5: Laugh };

/** Escala de botões (rádio): acessível pelo teclado e pelo leitor de tela. */
export function Escala({
  nome,
  rotulo,
  opcoes,
  valor,
  icones,
  compacta,
}: {
  nome: string;
  rotulo: string;
  opcoes: { v: number; t: string }[];
  valor: number | null;
  icones?: Record<number, LucideIcon>;
  compacta?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="grid grid-cols-1 gap-1.5">
      <legend id={id} className="mb-1.5 text-xs font-medium text-suave">
        {rotulo}
      </legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={id}>
        {opcoes.map((o) => {
          const Icone = icones?.[o.v];
          return (
            <label key={o.v} className="relative">
              <input type="radio" name={nome} value={o.v} defaultChecked={valor === o.v} className="peer sr-only" />
              <span
                className={cn(
                  "flex cursor-pointer select-none items-center justify-center gap-1 rounded-lg border border-borda bg-fundo-2/70 text-sm text-suave transition",
                  "peer-checked:border-eletrico peer-checked:bg-eletrico/20 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro",
                  compacta ? "h-9 min-w-9 px-2" : "h-10 px-3",
                )}
                title={o.t}
              >
                {Icone ? <Icone className="h-4 w-4" aria-hidden /> : null}
                <span className={cn(Icone && compacta && "sr-only")}>{compacta && !Icone ? o.v : o.t}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function FormCheckin({
  dia,
  atual,
  modo = "completo",
  rotuloBotao = "Salvar check-in",
}: {
  dia: string;
  atual?: Checkin | null;
  modo?: "saude" | "mente" | "completo";
  rotuloBotao?: string;
}) {
  const [estado, acao] = useActionState(salvarCheckin, undefined);
  const fechar = useFecharDialogo();
  useEffect(() => {
    if (estado?.ok) fechar();
  }, [estado?.ok, fechar]);
  const energia = Array.from({ length: 10 }, (_, i) => ({ v: i + 1, t: `${i + 1} de 10` }));
  const lista = (o: Record<number, string>) => Object.entries(o).map(([v, t]) => ({ v: Number(v), t }));
  return (
    <form action={acao} onReset={manterValores} className="grid grid-cols-1 gap-4">
      <input type="hidden" name="dia" value={dia} />
      {modo !== "saude" && <Escala nome="humor" rotulo="Humor" opcoes={lista(HUMOR)} valor={atual?.humor ?? null} icones={ICONES_HUMOR} compacta />}
      <Escala nome="energia" rotulo="Energia (1 a 10)" opcoes={energia} valor={atual?.energia ?? null} compacta />
      {modo !== "mente" && <Escala nome="disposicao" rotulo="Disposição" opcoes={lista(DISPOSICAO)} valor={atual?.disposicao ?? null} />}
      {modo !== "saude" && <Escala nome="estresse" rotulo="Estresse" opcoes={lista(ESTRESSE)} valor={atual?.estresse ?? null} />}
      {modo !== "saude" && (
        <fieldset>
          <legend className="mb-1.5 text-xs font-medium text-suave">Emoções do dia (opcional)</legend>
          <input type="hidden" name="emocoes-enviadas" value="1" />
          <div className="flex flex-wrap gap-1.5">
            {EMOCOES.map((e) => (
              <label key={e}>
                <input type="checkbox" name="emocoes" value={e} defaultChecked={atual?.emocoes.includes(e)} className="peer sr-only" />
                <span className="inline-flex h-8 cursor-pointer select-none items-center rounded-full border border-borda px-3 text-xs text-suave transition peer-checked:border-violeta peer-checked:bg-violeta/20 peer-checked:text-texto peer-focus-visible:ring-2 peer-focus-visible:ring-eletrico-claro">
                  {e}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {modo !== "mente" && (
        <Campo rotulo="Como está se sentindo (opcional)" htmlFor="ck-notas" dica="Ex.: dia tranquilo, dor leve no joelho depois do futebol.">
          <AreaTexto id="ck-notas" name="notas" maxLength={2000} defaultValue={atual?.notas ?? ""} className="min-h-20" />
        </Campo>
      )}
      {estado?.erro && <Mensagem tipo="erro">{estado.erro}</Mensagem>}
      {estado?.ok && <Mensagem tipo="ok">{estado.ok}</Mensagem>}
      <BotaoEnvio pendente="Salvando…">{rotuloBotao}</BotaoEnvio>
    </form>
  );
}
