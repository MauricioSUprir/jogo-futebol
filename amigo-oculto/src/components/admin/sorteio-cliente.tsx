"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, CalendarX2, CheckCircle2, EyeOff, Lock, RotateCcw, Shuffle, TriangleAlert, Users } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { Cartao, TituloCartao } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Confete, type ConfeteHandle } from "@/components/efeitos/confete";
import { usePreferencias } from "@/components/efeitos/preferencias";
import { tocar } from "@/components/efeitos/som";
import { useAcao } from "@/components/admin/usar-acao";
import { agendarSorteio, realizarSorteio, refazerSorteio } from "@/lib/acoes/sorteio";
import { MIN_PARTICIPANTES, sorteioViavel, type Restricao } from "@/lib/sorteio/algoritmo";
import { dataHora, deInputLocal, paraInputLocal } from "@/lib/formatos";

export function SorteioCliente({
  eventoId,
  status,
  arquivado,
  aprovados,
  totalAprovados,
  pendentes,
  restricoes,
  modo,
  agendadoPara,
  prazoEntrada,
  revelacao,
  sorteadoEm,
  versao,
  aoVivo,
}: {
  eventoId: string;
  status: "open" | "drawn" | "finished";
  arquivado: boolean;
  /** ids dos aprovados (só antes do sorteio, para conferir a viabilidade no aparelho) */
  aprovados: string[];
  totalAprovados: number;
  pendentes: number;
  restricoes: Restricao[];
  modo: "manual" | "scheduled";
  agendadoPara: string | null;
  prazoEntrada: string | null;
  revelacao: string | null;
  sorteadoEm: string | null;
  versao: number;
  aoVivo: boolean;
}) {
  const { pendente, executar } = useAcao();
  const prefs = usePreferencias();
  const confete = useRef<ConfeteHandle>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [refazendo, setRefazendo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [palavra, setPalavra] = useState("");
  const [errosRefazer, setErrosRefazer] = useState<Record<string, string>>({});
  const [quando, setQuando] = useState(() => paraInputLocal(agendadoPara));
  const [erroQuando, setErroQuando] = useState<string | null>(null);

  const viavel = useMemo(() => {
    const conjunto = new Set(aprovados);
    const validas = restricoes.filter((r) => conjunto.has(r.giver) && conjunto.has(r.receiver));
    try {
      return sorteioViavel(aprovados, validas);
    } catch {
      return false;
    }
  }, [aprovados, restricoes]);
  const poucos = aprovados.length < MIN_PARTICIPANTES;
  const bloqueio = arquivado
    ? "O grupo está arquivado. Desarquive para sortear."
    : poucos
      ? `São necessárias pelo menos ${MIN_PARTICIPANTES} pessoas aprovadas para sortear (hoje: ${aprovados.length}). Convide mais gente!`
      : !viavel
        ? "Com as restrições atuais não existe nenhuma combinação possível: alguém ficaria sem ter quem tirar. Remova alguma restrição."
        : null;

  function sortear() {
    executar(() => realizarSorteio(eventoId), {
      depois: () => {
        setConfirmando(false);
        confete.current?.disparar({ quantidade: 180 });
        tocar("festa", prefs.som);
      },
    });
  }

  function refazer() {
    const erros: Record<string, string> = {};
    if (palavra.trim().toUpperCase() !== "REFAZER") erros.confirmacao = "Digite REFAZER para confirmar.";
    if (motivo.trim().length < 5) erros.motivo = "Conte o motivo em poucas palavras (pelo menos 5 letras).";
    setErrosRefazer(erros);
    if (Object.keys(erros).length) return;
    executar(() => refazerSorteio(eventoId, { confirmacao: palavra, motivo }), {
      depois: () => {
        setRefazendo(false);
        setMotivo("");
        setPalavra("");
      },
      erro: (r) => {
        if (!r.ok && r.campos) setErrosRefazer(r.campos);
      },
    });
  }

  function agendar() {
    const iso = deInputLocal(quando);
    if (!iso) {
      setErroQuando("Escolha a data e o horário do sorteio.");
      return;
    }
    setErroQuando(null);
    executar(() => agendarSorteio(eventoId, iso), {
      erro: (r) => {
        if (!r.ok) setErroQuando(r.campos?.quando ?? r.erro);
      },
    });
  }

  if (status === "finished") {
    return (
      <Cartao forte>
        <TituloCartao icone={<Lock className="size-5" />} titulo="Amigo oculto encerrado" descricao="O sorteio não pode mais ser feito nem refeito." />
        {sorteadoEm ? <p className="text-sm text-suave">Último sorteio em {dataHora(sorteadoEm)} (versão {versao}).</p> : null}
      </Cartao>
    );
  }

  if (status === "drawn") {
    return (
      <div className="flex flex-col gap-5">
        <Cartao forte>
          <TituloCartao
            icone={<CheckCircle2 className="size-5" />}
            titulo="Sorteio realizado"
            descricao={`${sorteadoEm ? `Em ${dataHora(sorteadoEm)}` : "Feito"} · ${totalAprovados} pessoas${versao > 1 ? ` · refeito ${versao - 1} vez${versao > 2 ? "es" : ""}` : ""}`}
          />
          <p className="flex items-start gap-2 rounded-2xl bg-esmeralda/10 px-4 py-3 text-sm">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-esmeralda" aria-hidden />
            Cada pessoa vê só quem ela tirou, na aba “Meu amigo oculto”. Nem você, como organizador, tem acesso aos pares.
          </p>
        </Cartao>
        <Cartao>
          <TituloCartao
            icone={<RotateCcw className="size-5" />}
            titulo="Refazer o sorteio"
            descricao="Use só se for mesmo necessário (alguém entrou ou saiu, uma restrição foi esquecida)."
          />
          {aoVivo ? (
            <p className="flex items-start gap-2 rounded-2xl bg-ouro/12 px-4 py-3 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />A revelação ao vivo já começou: o sorteio não pode mais ser refeito.
            </p>
          ) : (
            <Botao variante="perigo" onClick={() => setRefazendo(true)}>
              <RotateCcw className="size-4" aria-hidden /> Refazer o sorteio
            </Botao>
          )}
        </Cartao>
        <Dialogo
          aberto={refazendo}
          aoFechar={() => setRefazendo(false)}
          titulo="Refazer o sorteio?"
          descricao="O resultado atual é invalidado na hora e cada pessoa recebe um novo amigo oculto."
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              refazer();
            }}
            noValidate
          >
            <ul className="flex flex-col gap-2 rounded-2xl bg-rubi/8 px-4 py-3 text-sm">
              <li>• Todos são avisados de que o sorteio foi refeito e precisam abrir o presente de novo.</li>
              <li>• As mensagens anônimas e os palpites do sorteio atual são apagados.</li>
              <li>• Quem já comprou presente pode ter tirado outra pessoa.</li>
            </ul>
            <AreaTexto
              rotulo="Motivo (aparece no histórico)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value.slice(0, 300))}
              placeholder="Ex.: a Júlia entrou depois do sorteio."
              erro={errosRefazer.motivo}
              rows={2}
              autoFocus
            />
            <Campo
              rotulo={
                <>
                  Para confirmar, digite <strong>REFAZER</strong>
                </>
              }
              value={palavra}
              onChange={(e) => setPalavra(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              erro={errosRefazer.confirmacao}
            />
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Botao variante="fantasma" onClick={() => setRefazendo(false)} disabled={pendente}>
                Cancelar
              </Botao>
              <Botao type="submit" variante="perigo" carregando={pendente} disabled={palavra.trim().toUpperCase() !== "REFAZER"}>
                Refazer e avisar todos
              </Botao>
            </div>
          </form>
        </Dialogo>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Confete ref={confete} desligado={prefs.menosMovimento} />
      <Cartao forte>
        <TituloCartao
          icone={<Shuffle className="size-5" />}
          titulo="Realizar o sorteio"
          descricao="O sorteio é feito no servidor, com aleatoriedade criptográfica, e respeita todas as restrições."
        />
        <ul className="mb-4 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
          <li className="vidro flex items-center gap-2 rounded-2xl px-3 py-2.5">
            <Users className="size-4 text-t1" aria-hidden /> <strong>{aprovados.length}</strong> no sorteio
          </li>
          <li className="vidro flex items-center gap-2 rounded-2xl px-3 py-2.5">
            <CalendarClock className="size-4 text-t1" aria-hidden /> <strong>{pendentes}</strong> pedido{pendentes === 1 ? "" : "s"} pendente{pendentes === 1 ? "" : "s"}
          </li>
          <li className="vidro flex items-center gap-2 rounded-2xl px-3 py-2.5">
            <Lock className="size-4 text-t1" aria-hidden /> <strong>{restricoes.length}</strong> restriç{restricoes.length === 1 ? "ão" : "ões"}
          </li>
        </ul>
        {bloqueio ? (
          <p className="mb-4 flex items-start gap-2 rounded-2xl bg-ouro/12 px-4 py-3 text-sm" role="status">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-ouro-escuro dark:text-ouro-claro" aria-hidden />
            <span>
              {bloqueio}{" "}
              {!viavel && !poucos ? (
                <Link href={`/grupo/${eventoId}/admin?aba=restricoes`} scroll={false} className="font-semibold underline underline-offset-4">
                  Ver restrições
                </Link>
              ) : null}
            </span>
          </p>
        ) : null}
        <Botao variante="ouro" tamanho="g" brilho={!bloqueio} disabled={!!bloqueio} onClick={() => setConfirmando(true)} className="w-full sm:w-auto">
          <Shuffle className="size-5" aria-hidden /> Realizar sorteio agora
        </Botao>
      </Cartao>

      <Cartao>
        <TituloCartao
          icone={<CalendarClock className="size-5" />}
          titulo="Sorteio agendado"
          descricao={
            modo === "scheduled" && agendadoPara
              ? `Marcado para ${dataHora(agendadoPara, { weekday: "long" })}. Acontece sozinho e todos são avisados.`
              : "Marque uma data e o sorteio acontece sozinho, mesmo se você não estiver online."
          }
        />
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            agendar();
          }}
          noValidate
        >
          <Campo
            type="datetime-local"
            rotulo="Data e horário"
            value={quando}
            onChange={(e) => setQuando(e.target.value)}
            erro={erroQuando}
            dica={[prazoEntrada ? `Depois do prazo de entrada (${dataHora(prazoEntrada)})` : null, revelacao ? `antes da revelação (${dataHora(revelacao)})` : null].filter(Boolean).join(" e ") || "Horário de Brasília."}
            wrapperClassName="flex-1"
            disabled={arquivado}
          />
          <div className="flex gap-2 sm:mt-[1.6rem]">
            <Botao type="submit" disabled={pendente || arquivado} className="h-12">
              <CalendarClock className="size-4" aria-hidden /> {modo === "scheduled" ? "Remarcar" : "Agendar"}
            </Botao>
            {modo === "scheduled" ? (
              <Botao
                variante="contorno"
                className="h-12"
                disabled={pendente}
                onClick={() => executar(() => agendarSorteio(eventoId, null), { depois: () => setQuando("") })}
              >
                <CalendarX2 className="size-4" aria-hidden /> Cancelar
              </Botao>
            ) : null}
          </div>
        </form>
      </Cartao>

      <Dialogo
        aberto={confirmando}
        aoFechar={() => setConfirmando(false)}
        titulo="Realizar o sorteio agora?"
        descricao="Depois do sorteio a lista de participantes e as restrições ficam fechadas."
      >
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-2 text-[15px]">
            <li className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 shrink-0 text-t1" aria-hidden />
              <span>
                <strong>{aprovados.length} pessoas</strong> entram no sorteio.
              </span>
            </li>
            {pendentes > 0 ? (
              <li className="flex items-start gap-2 text-rubi">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  <strong>
                    {pendentes} pedido{pendentes === 1 ? "" : "s"} pendente{pendentes === 1 ? "" : "s"}
                  </strong>{" "}
                  ser{pendentes === 1 ? "á recusado" : "ão recusados"} automaticamente. Aprove antes, se quiser essas pessoas no sorteio.
                </span>
              </li>
            ) : null}
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-t1" aria-hidden />
              <span>
                {restricoes.length ? `${restricoes.length} restriç${restricoes.length === 1 ? "ão será respeitada" : "ões serão respeitadas"}.` : "Nenhuma restrição configurada."}
              </span>
            </li>
            <li className="flex items-start gap-2">
              <EyeOff className="mt-0.5 size-4 shrink-0 text-t1" aria-hidden />
              <span>Ninguém vê os pares — nem você. Todos recebem um aviso para abrir o presente.</span>
            </li>
          </ul>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="fantasma" onClick={() => setConfirmando(false)} disabled={pendente}>
              Ainda não
            </Botao>
            <Botao variante="ouro" carregando={pendente} onClick={sortear}>
              <Shuffle className="size-4" aria-hidden /> Sortear agora
            </Botao>
          </div>
        </div>
      </Dialogo>
    </div>
  );
}
