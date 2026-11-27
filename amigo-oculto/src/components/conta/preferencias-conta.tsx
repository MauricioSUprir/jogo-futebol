"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Monitor, Moon, Sun, Volume2, Vibrate } from "lucide-react";
import { Interruptor } from "@/components/ui/campos";
import { Selo } from "@/components/ui/cartao";
import { Botao } from "@/components/ui/botao";
import { useAvisos } from "@/components/ui/avisos";
import { aplicarModo } from "@/components/casca/sincronizar-modo";
import { tocar, vibrar } from "@/components/efeitos/som";
import { cn } from "@/lib/cn";
import { salvarAparencia, salvarEfeitos, salvarEmailNotificacoes } from "@/lib/acoes/perfil";

/** E-mail das notificações: a preferência da pessoa e, com honestidade, se o servidor tem como mandar e-mail. */
export function EmailNotificacoes({ inicial, servidorPronto, email }: { inicial: boolean; servidorPronto: boolean; email: string | null }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [ligado, setLigado] = useState(inicial);
  const [salvando, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <span className="mt-2 inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1">
          <Mail className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <Interruptor
            rotulo="Notificações por e-mail"
            descricao={
              email
                ? `Sorteio, lembretes, avisos do grupo e convites em ${email}.`
                : "Disponível depois de salvar sua conta com um e-mail."
            }
            marcado={ligado && !!email}
            desabilitado={salvando || !email}
            aoMudar={(v) => {
              setLigado(v);
              iniciar(async () => {
                const r = await salvarEmailNotificacoes(v);
                if (!r.ok) {
                  setLigado(!v);
                  avisar(r.erro, "erro");
                } else {
                  avisar(v ? "E-mails ligados." : "E-mails desligados.");
                  router.refresh();
                }
              });
            }}
          />
        </div>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm sm:pl-[52px]">
        {servidorPronto ? (
          <Selo cor="esmeralda">Envio de e-mail ativo neste servidor</Selo>
        ) : (
          <>
            <Selo cor="ouro">E-mail não configurado neste servidor</Selo>
            <span className="text-suave">Por enquanto os avisos chegam só aqui no app{" "}(e por push, se você ativar).</span>
          </>
        )}
      </p>
    </div>
  );
}

const MODOS = [
  { valor: "system", rotulo: "Sistema", texto: "Segue o aparelho", icone: Monitor },
  { valor: "light", rotulo: "Claro", texto: "Sempre claro", icone: Sun },
  { valor: "dark", rotulo: "Escuro", texto: "Sempre escuro", icone: Moon },
] as const;

/** Claro, escuro ou o do sistema (aplica na hora e guarda na conta). */
export function Aparencia({ inicial }: { inicial: "system" | "light" | "dark" }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [modo, setModo] = useState(inicial);
  const [, iniciar] = useTransition();
  return (
    <fieldset>
      <legend className="sr-only">Modo de cor</legend>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {MODOS.map((m) => {
          const ativo = modo === m.valor;
          return (
            <label
              key={m.valor}
              className={cn(
                "flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-3xl border-2 p-3 text-center transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-ouro/40",
                ativo ? "border-t1 bg-[color-mix(in_oklab,var(--t1)_10%,transparent)]" : "border-borda hover:bg-black/5 dark:hover:bg-white/5",
              )}
            >
              <input
                type="radio"
                name="modo"
                value={m.valor}
                checked={ativo}
                className="sr-only"
                onChange={() => {
                  const anterior = modo;
                  setModo(m.valor);
                  aplicarModo(m.valor);
                  iniciar(async () => {
                    const r = await salvarAparencia(m.valor);
                    if (!r.ok) {
                      setModo(anterior);
                      aplicarModo(anterior);
                      avisar(r.erro, "erro");
                    } else router.refresh();
                  });
                }}
              />
              <m.icone className={cn("size-6", ativo ? "text-t1" : "text-suave")} aria-hidden />
              <span className="text-sm font-semibold">{m.rotulo}</span>
              <span className="hidden text-xs text-suave sm:block">{m.texto}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Som, vibração e menos animações (salva na hora; o app inteiro passa a respeitar depois do refresh). */
export function Efeitos({ inicial }: { inicial: { som: boolean; vibracao: boolean; menosMovimento: boolean } }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [valores, setValores] = useState(inicial);
  const [salvando, iniciar] = useTransition();

  function mudar(campo: keyof typeof valores, v: boolean) {
    const anterior = valores;
    const novos = { ...valores, [campo]: v };
    setValores(novos);
    if (campo === "menosMovimento") document.documentElement.classList.toggle("menos-movimento", v);
    iniciar(async () => {
      const r = await salvarEfeitos(novos);
      if (!r.ok) {
        setValores(anterior);
        avisar(r.erro, "erro");
      } else router.refresh();
    });
  }

  return (
    <div className="flex flex-col divide-y divide-borda">
      <div className="pb-2">
        <Interruptor
          rotulo="Efeitos sonoros"
          descricao="Sons curtos na revelação, no sorteio e nas notificações."
          marcado={valores.som}
          desabilitado={salvando}
          aoMudar={(v) => mudar("som", v)}
        />
        <Botao variante="fantasma" tamanho="p" className="-ml-3" onClick={() => tocar("revelar", true)}>
          <Volume2 className="size-4" aria-hidden /> Ouvir um exemplo
        </Botao>
      </div>
      <div className="py-2">
        <Interruptor
          rotulo="Vibração"
          descricao="No celular, uma vibração curta nos momentos especiais."
          marcado={valores.vibracao}
          desabilitado={salvando}
          aoMudar={(v) => mudar("vibracao", v)}
        />
        <Botao variante="fantasma" tamanho="p" className="-ml-3" onClick={() => vibrar([80, 60, 120], true)}>
          <Vibrate className="size-4" aria-hidden /> Testar vibração
        </Botao>
      </div>
      <div className="pt-2">
        <Interruptor
          rotulo="Reduzir animações"
          descricao="Menos movimento: sem confete, brilhos e transições. O “reduzir movimento” do aparelho também vale."
          marcado={valores.menosMovimento}
          desabilitado={salvando}
          aoMudar={(v) => mudar("menosMovimento", v)}
        />
      </div>
    </div>
  );
}
