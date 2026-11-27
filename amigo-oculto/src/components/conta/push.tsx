"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellOff, BellRing, MonitorSmartphone, Send, Smartphone } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Selo } from "@/components/ui/cartao";
import { useAvisos } from "@/components/ui/avisos";
import { chaveVapidEmBytes, inscricaoAtual, registrarServiceWorker, suportePush } from "@/components/pwa/sw";
import { enviarNotificacaoTeste, removerInscricaoPush, removerTodasInscricoesPush, salvarInscricaoPush } from "@/lib/acoes/push";

type Estado = "carregando" | "sem-servidor" | "sem-suporte" | "ios-instalar" | "bloqueado" | "ativo" | "inativo";

function mesmaChave(sub: PushSubscription, chave: Uint8Array) {
  const atual = sub.options?.applicationServerKey;
  if (!atual) return true; // navegador não informa: confia
  const a = new Uint8Array(atual);
  return a.length === chave.length && a.every((v, i) => v === chave[i]);
}

async function enviarParaServidor(sub: PushSubscription) {
  const json = sub.toJSON();
  return salvarInscricaoPush({
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    userAgent: navigator.userAgent.slice(0, 300),
  });
}

/**
 * Push de verdade (Web Push): pede a permissão do navegador, registra o service worker, cria a inscrição com a chave
 * VAPID do servidor e grava em push_subscriptions. Desativar cancela a inscrição neste aparelho e apaga no servidor.
 */
export function PushNesteAparelho({
  chavePublica,
  servidorPronto,
  endpointsDaConta,
}: {
  chavePublica: string;
  servidorPronto: boolean;
  endpointsDaConta: string[];
}) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [estado, setEstado] = useState<Estado>("carregando");
  const [ocupado, iniciar] = useTransition();
  const aparelhos = endpointsDaConta.length;

  const conferir = useCallback(async () => {
    if (!servidorPronto || !chavePublica) return setEstado("sem-servidor");
    const suporte = suportePush();
    if (suporte === "nao") return setEstado("sem-suporte");
    if (suporte === "ios-instalar") return setEstado("ios-instalar");
    if (Notification.permission === "denied") return setEstado("bloqueado");
    const sub = await inscricaoAtual().catch(() => null);
    if (sub && Notification.permission === "granted") {
      if (!endpointsDaConta.includes(sub.endpoint)) {
        // o navegador está inscrito, mas o servidor não sabe (outra conta, ou a inscrição foi trocada): sincroniza
        const r = await enviarParaServidor(sub);
        if (!r.ok) return setEstado("inativo");
      }
      return setEstado("ativo");
    }
    setEstado("inativo");
  }, [servidorPronto, chavePublica, endpointsDaConta]);

  useEffect(() => {
    void conferir();
  }, [conferir]);

  function ativar() {
    iniciar(async () => {
      try {
        const permissao = await Notification.requestPermission();
        if (permissao !== "granted") {
          setEstado(permissao === "denied" ? "bloqueado" : "inativo");
          avisar(permissao === "denied" ? "As notificações estão bloqueadas neste navegador." : "Permissão não concedida.", "erro");
          return;
        }
        const registro = await registrarServiceWorker();
        const chave = chaveVapidEmBytes(chavePublica);
        let sub = await registro.pushManager.getSubscription();
        if (sub && !mesmaChave(sub, chave)) {
          await sub.unsubscribe(); // as chaves do servidor mudaram
          sub = null;
        }
        sub ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
        const r = await enviarParaServidor(sub);
        if (!r.ok) {
          avisar(r.erro, "erro");
          return;
        }
        setEstado("ativo");
        avisar(r.mensagem ?? "Notificações push ativadas.");
        router.refresh();
      } catch (e) {
        avisar(e instanceof Error && e.name === "NotAllowedError" ? "O navegador não deixou ativar as notificações." : "Não foi possível ativar as notificações neste aparelho.", "erro");
        void conferir();
      }
    });
  }

  function desativar() {
    iniciar(async () => {
      const sub = await inscricaoAtual().catch(() => null);
      if (!sub) {
        setEstado("inativo");
        return;
      }
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => false);
      const r = await removerInscricaoPush(endpoint);
      if (r.ok) {
        setEstado("inativo");
        avisar(r.mensagem ?? "Desativado.");
        router.refresh();
      } else avisar(r.erro, "erro");
    });
  }

  function desativarTodos() {
    iniciar(async () => {
      const sub = await inscricaoAtual().catch(() => null);
      await sub?.unsubscribe().catch(() => false);
      const r = await removerTodasInscricoesPush();
      if (r.ok) {
        setEstado((e) => (e === "ativo" ? "inativo" : e));
        avisar(r.mensagem ?? "Desativado.");
        router.refresh();
      } else avisar(r.erro, "erro");
    });
  }

  const textos: Record<Estado, { selo: string; cor: "neutro" | "esmeralda" | "ouro" | "rubi"; texto: string }> = {
    carregando: { selo: "Verificando…", cor: "neutro", texto: "Conferindo este aparelho." },
    "sem-servidor": {
      selo: "Indisponível",
      cor: "neutro",
      texto: "Push não configurado neste servidor. As notificações continuam aparecendo aqui no app (no sino) e por e-mail, se estiver ligado.",
    },
    "sem-suporte": { selo: "Sem suporte", cor: "neutro", texto: "Este navegador não aceita notificações push. Tente o Chrome, o Edge, o Firefox ou o Safari atualizado." },
    "ios-instalar": {
      selo: "Instale o app",
      cor: "ouro",
      texto: "No iPhone e no iPad, o push só funciona com o app instalado: toque em Compartilhar → “Adicionar à Tela de Início” e abra por lá.",
    },
    bloqueado: {
      selo: "Bloqueado",
      cor: "rubi",
      texto: "Você bloqueou as notificações deste site. Libere nas configurações do navegador (ícone do cadeado ao lado do endereço) e volte aqui.",
    },
    ativo: { selo: "Ativo neste aparelho", cor: "esmeralda", texto: "Você recebe aqui os avisos do sorteio, das mensagens anônimas e dos lembretes, mesmo com o app fechado." },
    inativo: { selo: "Desativado neste aparelho", cor: "neutro", texto: "Ative para receber os avisos importantes mesmo com o app fechado. O navegador vai pedir sua permissão." },
  };
  const t = textos[estado];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[color-mix(in_oklab,var(--t1)_12%,transparent)] text-t1">
          <Smartphone className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">Notificações push</p>
            <Selo cor={t.cor}>{t.selo}</Selo>
          </div>
          <p className="mt-0.5 text-sm text-suave" aria-live="polite">
            {t.texto}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-0 sm:pl-[52px]">
        {estado === "inativo" ? (
          <Botao onClick={ativar} carregando={ocupado} variante="esmeralda" tamanho="p">
            <BellRing className="size-4" aria-hidden /> Ativar neste aparelho
          </Botao>
        ) : null}
        {estado === "ativo" ? (
          <Botao onClick={desativar} carregando={ocupado} variante="contorno" tamanho="p">
            <BellOff className="size-4" aria-hidden /> Desativar neste aparelho
          </Botao>
        ) : null}
        {aparelhos > 0 && servidorPronto ? (
          <Botao onClick={desativarTodos} disabled={ocupado} variante="fantasma" tamanho="p">
            <MonitorSmartphone className="size-4" aria-hidden /> Desativar em todos ({aparelhos} {aparelhos === 1 ? "aparelho" : "aparelhos"})
          </Botao>
        ) : null}
      </div>
    </div>
  );
}

/** Notificação de teste só para a própria pessoa: chega no sino e sai pelos canais ativos. */
export function TesteNotificacao() {
  const { avisar } = useAvisos();
  const [resultado, setResultado] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-3xl border border-dashed border-borda p-4">
      <p className="font-semibold">Testar as notificações</p>
      <p className="text-sm text-suave">Mandamos uma notificação só para você e dizemos por quais canais ela saiu.</p>
      <Botao
        variante="vidro"
        tamanho="p"
        className="self-start"
        carregando={enviando}
        onClick={() =>
          iniciar(async () => {
            const r = await enviarNotificacaoTeste();
            if (r.ok) {
              setResultado(r.mensagem ?? "Enviada.");
              avisar("Notificação de teste enviada.");
            } else {
              setResultado(null);
              avisar(r.erro, "erro");
            }
          })
        }
      >
        <Send className="size-4" aria-hidden /> Enviar notificação de teste
      </Botao>
      {resultado ? (
        <p role="status" className="rounded-2xl bg-esmeralda/10 px-3 py-2 text-sm text-esmeralda">
          {resultado}
        </p>
      ) : null}
    </div>
  );
}
