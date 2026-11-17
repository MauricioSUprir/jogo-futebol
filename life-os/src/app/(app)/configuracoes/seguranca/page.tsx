import { History, KeyRound, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { exigirUsuario, idDaSessaoAtual } from "@/lib/servidor/sessao";
import { db } from "@/lib/db";
import { descreverNavegador } from "@/lib/servidor/requisicao";
import { EVENTOS_ACESSO } from "@/lib/servidor/registro";
import { encerrarOutrasSessoes, encerrarSessao } from "@/acoes/conta";
import { CabecalhoPagina, Cartao, Selo, classesBotao } from "@/components/ui";
import { AbasConfig } from "@/components/config/abas";
import { DoisFatores, FormSenha } from "@/components/config/formularios";
import { cn } from "@/lib/cn";

export const metadata = { title: "Segurança" };

export default async function PaginaSeguranca() {
  const user = await exigirUsuario();
  const atual = await idDaSessaoAtual();
  const [sessoes, registros, codigos] = await Promise.all([
    db.session.findMany({ where: { userId: user.id, mfaPending: false, expiresAt: { gt: new Date() } }, orderBy: { lastSeenAt: "desc" } }),
    db.accessLog.findMany({ where: { userId: user.id }, orderBy: { at: "desc" }, take: 40 }),
    db.recoveryCode.count({ where: { userId: user.id, usedAt: null } }),
  ]);
  const quando = (d: Date) =>
    new Intl.DateTimeFormat("pt-BR", { timeZone: user.timezone, dateStyle: "short", timeStyle: "short" }).format(d);
  const ruins = new Set(["senha_errada", "codigo_errado", "bloqueado"]);

  return (
    <>
      <CabecalhoPagina rotulo="Configurações" titulo="Segurança" descricao="Login privado, sessões e registro de acessos." />
      <AbasConfig atual="seguranca" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Cartao titulo="Verificação em duas etapas" icone={ShieldCheck} holo className="lg:col-span-2">
          <DoisFatores ligado={user.totpEnabled} codigosRestantes={codigos} />
        </Cartao>
        <Cartao titulo="Trocar senha" icone={KeyRound}>
          <FormSenha />
        </Cartao>
        <Cartao
          titulo="Sessões ativas"
          icone={MonitorSmartphone}
          acao={
            sessoes.length > 1 && (
              <form action={encerrarOutrasSessoes}>
                <button className={classesBotao("fantasma", "p")}>Encerrar as outras</button>
              </form>
            )
          }
        >
          <ul className="grid grid-cols-1 gap-2">
            {sessoes.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-xl border border-borda bg-fundo-2/60 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {descreverNavegador(s.userAgent)}
                    {s.id === atual && <Selo cor="#34d399">Esta</Selo>}
                  </p>
                  <p className="text-xs text-suave">
                    Último uso {quando(s.lastSeenAt)}
                    {s.ip && ` · ${s.ip}`}
                  </p>
                </div>
                <form action={encerrarSessao}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className={classesBotao("fantasma", "p")}>{s.id === atual ? "Sair" : "Encerrar"}</button>
                </form>
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao titulo="Registro de acessos" icone={History} className="lg:col-span-2">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-painel text-xs text-suave">
                <tr>
                  <th className="py-2 pr-3 font-medium">Quando</th>
                  <th className="py-2 pr-3 font-medium">Evento</th>
                  <th className="hidden py-2 pr-3 font-medium sm:table-cell">Navegador</th>
                  <th className="hidden py-2 font-medium md:table-cell">IP</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-t border-borda">
                    <td className="numero py-2 pr-3 text-xs text-suave">{quando(r.at)}</td>
                    <td className={cn("py-2 pr-3", ruins.has(r.event) && "text-[#fda4af]")}>
                      {EVENTOS_ACESSO[r.event] ?? r.event}
                      {r.detail && <span className="text-xs text-apagado"> · {r.detail}</span>}
                    </td>
                    <td className="hidden py-2 pr-3 text-xs text-suave sm:table-cell">{descreverNavegador(r.userAgent)}</td>
                    <td className="hidden py-2 text-xs text-suave md:table-cell">{r.ip ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Cartao>
      </div>
    </>
  );
}
