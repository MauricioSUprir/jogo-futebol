import { NextResponse, type NextRequest } from "next/server";
import { executarSorteiosVencidos } from "@/lib/sorteio/servico";
import { entregarNotificacoes } from "@/lib/servidor/entrega";
import { clienteAdmin } from "@/lib/supabase/admin";
import { cronAutorizado } from "./autorizar";

/**
 * Tarefas automáticas (a Vercel chama pelo vercel.json; qualquer agendador serve, com o mesmo cabeçalho):
 *   1. sorteios agendados cuja hora chegou;
 *   2. lembretes automáticos (presente não comprado, encontro em menos de 24 h, resultado ainda não visto);
 *   3. encerramento automático dos grupos 2 dias depois da revelação;
 *   4. entrega por e-mail e push das notificações pendentes, em lotes, até esvaziar (no máximo 5 lotes por chamada).
 * Exige `Authorization: Bearer ${CRON_SECRET}`. Cada etapa roda mesmo se outra falhar; o resumo diz o que aconteceu.
 */
// Agenda (vercel.json, que não aceita comentários): "0 12 * * *" = todo dia às 12:00 UTC (9h em Brasília), o máximo
// do plano Hobby da Vercel (1 vez por dia). No plano Pro dá para rodar a cada 5 a 15 minutos (ex.: "*/10 * * * *").
// As ações do app já entregam as notificações na hora (entregarEmSegundoPlano) e a sala do grupo sorteia ao abrir se a
// hora passou: o cron é a rede de segurança.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LOTE = 50;
const MAX_LOTES = 5;

async function executar(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, erro: "CRON_SECRET não configurado no servidor." }, { status: 503 });
  }
  if (!cronAutorizado(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }

  const inicio = Date.now();
  const erros: string[] = [];
  const resumo = {
    sorteios: { feitos: 0, falharam: 0, detalhes: [] as { eventoId: string; ok: boolean; erro?: string }[] },
    lembretes: 0,
    encerrados: 0,
    entrega: { lotes: 0, emails: 0, pushes: 0, falhas: 0 },
  };

  try {
    const r = await executarSorteiosVencidos();
    resumo.sorteios.detalhes = r;
    resumo.sorteios.feitos = r.filter((x) => x.ok).length;
    resumo.sorteios.falharam = r.length - resumo.sorteios.feitos;
  } catch (e) {
    erros.push(`sorteios: ${mensagem(e)}`);
  }

  const admin = clienteAdmin();
  try {
    const { data, error } = await admin.rpc("cron_reminders");
    if (error) throw error;
    resumo.lembretes = (data as number | null) ?? 0;
  } catch (e) {
    erros.push(`lembretes: ${mensagem(e)}`);
  }

  try {
    const { data, error } = await admin.rpc("cron_auto_finish");
    if (error) throw error;
    resumo.encerrados = (data as number | null) ?? 0;
  } catch (e) {
    erros.push(`encerramento: ${mensagem(e)}`);
  }

  try {
    for (let i = 0; i < MAX_LOTES; i++) {
      const { count } = await admin
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .or("email_status.eq.pending,push_status.eq.pending")
        .gt("created_at", new Date(Date.now() - 2 * 86400e3).toISOString());
      if (!count) break;
      const r = await entregarNotificacoes(LOTE);
      resumo.entrega.lotes++;
      resumo.entrega.emails += r.emails;
      resumo.entrega.pushes += r.pushes;
      resumo.entrega.falhas += r.falhas;
    }
  } catch (e) {
    erros.push(`entrega: ${mensagem(e)}`);
  }

  return NextResponse.json(
    { ok: erros.length === 0, duracaoMs: Date.now() - inicio, ...resumo, erros },
    { status: erros.length ? 500 : 200, headers: { "Cache-Control": "no-store" } },
  );
}

function mensagem(e: unknown) {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}

export async function GET(request: NextRequest) {
  return executar(request);
}

export async function POST(request: NextRequest) {
  return executar(request);
}
