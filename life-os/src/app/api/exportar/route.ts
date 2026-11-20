// Exportação completa (JSON) de tudo o que é do usuário. Sem senha, segredos nem sessões.
// O diário com senha extra sai cifrado (só a senha abre); dos documentos de saúde, só nome, tipo e tamanho.
import { db } from "@/lib/db";
import { arquivo, naoAutenticado, usuarioDaRota } from "@/lib/servidor/rota";
import { registrarAcesso } from "@/lib/servidor/registro";
import { hoje } from "@/lib/datas";
import { exportarTreinos } from "@/lib/servidor/treinos";
import { exportarSaude } from "@/lib/servidor/saude";
import { exportarSono } from "@/lib/servidor/sono";
import { exportarMente } from "@/lib/servidor/mente";
import { exportarAlimentacao } from "@/lib/servidor/alimentacao";
import { exportarEstudos } from "@/lib/servidor/estudos";
import { exportarMetas } from "@/lib/servidor/metas";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await usuarioDaRota();
  if (!user) return naoAutenticado();
  const [agua, configAgua, diasAgua, habitos, eventos, tarefas, treinos, saudeCompleta, sono, mente, alimentacao, estudos, metas] = await Promise.all([
    db.waterEntry.findMany({ where: { userId: user.id }, orderBy: { at: "asc" } }),
    db.waterSettings.findUnique({ where: { userId: user.id } }),
    db.waterDay.findMany({ where: { userId: user.id }, orderBy: { day: "asc" } }),
    db.habit.findMany({ where: { userId: user.id }, include: { logs: { orderBy: { day: "asc" } } }, orderBy: { position: "asc" } }),
    db.calendarEvent.findMany({ where: { userId: user.id }, orderBy: { start: "asc" } }),
    db.task.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    exportarTreinos(user.id),
    exportarSaude(user.id),
    exportarSono(user.id),
    exportarMente(user.id),
    exportarAlimentacao(user.id),
    exportarEstudos(user.id),
    exportarMetas(user.id),
  ]);
  // Os check-ins do dia saem uma vez só (na Mente, com humor e estresse), não repetidos na Saúde.
  const { checkins: _checkinsRepetidos, ...saude } = saudeCompleta;
  const dados = {
    formato: "life-os/v2",
    exportadoEm: new Date().toISOString(),
    perfil: { usuario: user.username, nome: user.displayName, fuso: user.timezone, inicioDia: user.dayStart, fimDia: user.dayEnd },
    agua: { config: configAgua && { meta: configAgua.goalMl, copo: configAgua.glassMl, garrafa: configAgua.bottleMl, rapidos: configAgua.quickAmounts }, dias: diasAgua, registros: agua },
    habitos,
    eventos,
    tarefas,
    treinos,
    saude,
    sono,
    mente,
    alimentacao,
    estudos,
    metas,
  };
  await registrarAcesso(user.id, "dados_exportados", "JSON");
  return arquivo(JSON.stringify(dados, null, 2), `life-os-${hoje(user.timezone)}.json`, "application/json; charset=utf-8");
}
