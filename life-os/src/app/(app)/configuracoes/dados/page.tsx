import { Database, Download, HardDriveDownload, Lock } from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { db } from "@/lib/db";
import { CabecalhoPagina, Cartao, classesBotao } from "@/components/ui";
import { AbasConfig } from "@/components/config/abas";

export const metadata = { title: "Dados e backup" };

export default async function PaginaDados() {
  const user = await exigirUsuario();
  const [agua, habitos, registros, eventos, tarefas] = await Promise.all([
    db.waterEntry.count({ where: { userId: user.id } }),
    db.habit.count({ where: { userId: user.id } }),
    db.habitLog.count({ where: { habit: { userId: user.id } } }),
    db.calendarEvent.count({ where: { userId: user.id } }),
    db.task.count({ where: { userId: user.id } }),
  ]);
  return (
    <>
      <CabecalhoPagina rotulo="Configurações" titulo="Dados e backup" descricao="Tudo o que você registra é seu: exporte quando quiser." />
      <AbasConfig atual="dados" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Cartao titulo="Exportar" icone={Download}>
          <dl className="mb-4 grid grid-cols-3 gap-2 text-sm sm:grid-cols-5">
            {[
              ["Água", agua],
              ["Hábitos", habitos],
              ["Marcações", registros],
              ["Eventos", eventos],
              ["Tarefas", tarefas],
            ].map(([n, v]) => (
              <div key={n as string} className="rounded-xl border border-borda bg-fundo-2/60 p-2 text-center">
                <dt className="text-xs text-suave">{n}</dt>
                <dd className="numero font-display text-lg font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a href="/api/exportar" download className={classesBotao("primario")}>
              <Database className="h-4 w-4" /> Tudo (JSON)
            </a>
            <a href="/api/exportar/agua" download className={classesBotao("secundario")}>
              Água (CSV)
            </a>
            <a href="/api/exportar/agenda" download className={classesBotao("secundario")}>
              Agenda (.ics)
            </a>
          </div>
          <p className="mt-3 text-xs text-apagado">O .ics abre no Calendário do iPhone, no Google Agenda e no Outlook.</p>
        </Cartao>
        <Cartao titulo="Backup do servidor" icone={HardDriveDownload}>
          <ul className="grid grid-cols-1 gap-2 text-sm text-suave">
            <li>O Docker Compose do LIFE OS faz um backup do banco por dia (pg_dump compactado) e guarda os últimos 14.</li>
            <li>
              Para restaurar, veja <span className="font-mono text-xs text-texto">life-os/README.md</span> → “Backup e restauração”.
            </li>
            <li>Guarde uma cópia fora do servidor (HD externo ou outro computador).</li>
          </ul>
        </Cartao>
        <Cartao titulo="Privacidade" icone={Lock} className="lg:col-span-2">
          <ul className="grid grid-cols-1 gap-2 text-sm text-suave sm:grid-cols-2">
            <li>Nenhum dado sai do seu servidor: sem rastreadores, sem CDN e sem serviços externos.</li>
            <li>Senha com scrypt; segredo do autenticador cifrado com AES-256-GCM; sessões revogáveis.</li>
            <li>Nada de IA externa: o assistente (Fase 3) só lerá o que você autorizar, módulo por módulo.</li>
            <li>Os insights do painel são regras simples sobre os seus registros, calculadas no servidor.</li>
          </ul>
        </Cartao>
      </div>
    </>
  );
}
