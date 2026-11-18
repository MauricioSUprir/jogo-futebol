// Um registro de saúde na lista: dados, documentos anexados e ações (editar, encerrar/reativar, apagar).
import { CalendarCheck, Download, FileText, Pencil, Trash2 } from "lucide-react";
import { alternarStatusSaude, excluirDocumento, excluirRegistroSaude } from "@/acoes/saude";
import { DEF_TIPOS, tamanhoLegivel } from "@/lib/saude";
import type { RegistroSaude } from "@/lib/servidor/saude";
import { Selo, classesBotao } from "../ui";
import { BotaoEnvio, Dialogo } from "../cliente";
import { FormRegistroSaude } from "./formularios";
import { EnviarDocumento } from "./documentos";
import { cn } from "@/lib/cn";

const dataBr = (k: string) => k.split("-").reverse().join("/");

export function ItemRegistro({ r, hoje }: { r: RegistroSaude; hoje: string }) {
  const def = DEF_TIPOS[r.tipo];
  const c = def.campos;
  const encerrado = def.status && r.status !== "ativo";
  const linhas: [string, string][] = [];
  if (c.dose && r.dose) linhas.push([c.dose.split(" (")[0], r.dose]);
  if (c.parteCorpo && r.parteCorpo) linhas.push([c.parteCorpo, r.parteCorpo]);
  if (c.intensidade && r.intensidade !== null) linhas.push(["Intensidade", `${r.intensidade}/10`]);
  if (c.profissional && r.profissional) linhas.push([c.profissional, r.profissional]);
  if (c.diaFim && r.diaFim) linhas.push([c.diaFim, dataBr(r.diaFim)]);
  if (c.proximo && r.proximo) linhas.push([c.proximo, dataBr(r.proximo)]);
  const futura = r.tipo === "consulta" && r.dia >= hoje;
  return (
    <li className={cn("rounded-xl border border-borda bg-fundo-2/50 p-3", encerrado && "opacity-75")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-medium [overflow-wrap:anywhere]">{r.titulo}</span>
            {def.status && <Selo cor={encerrado ? "#94a3b8" : "#34d399"}>{encerrado ? def.status[1] : def.status[0]}</Selo>}
            {futura && <Selo cor="#22d3ee">Marcada</Selo>}
            {r.temEvento && (
              <span className="inline-flex items-center gap-1 text-[0.7rem] text-suave" title="Está na agenda">
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden /> na agenda
              </span>
            )}
          </p>
          <p className="numero mt-0.5 text-xs text-suave">
            {c.dia}: {dataBr(r.dia)}
            {r.hora ? ` · ${r.hora}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <Dialogo
            gatilho={<Pencil className="h-4 w-4" />}
            rotuloGatilho={`Editar ${r.titulo}`}
            classeGatilho="rounded-lg p-1.5 text-apagado hover:bg-white/5 hover:text-texto"
            titulo={`Editar ${def.nome.toLowerCase()}`}
          >
            <FormRegistroSaude tipo={r.tipo} hoje={hoje} registro={r} />
          </Dialogo>
          <Dialogo
            gatilho={<Trash2 className="h-4 w-4" />}
            rotuloGatilho={`Apagar ${r.titulo}`}
            classeGatilho="rounded-lg p-1.5 text-apagado hover:bg-perigo/10 hover:text-perigo"
            titulo="Apagar registro?"
            descricao={`"${r.titulo}"${r.documentos.length ? ` e ${r.documentos.length} documento(s) anexado(s)` : ""}${r.temEvento ? ", e o evento na agenda" : ""} serão apagados.`}
          >
            <form action={excluirRegistroSaude}>
              <input type="hidden" name="id" value={r.id} />
              <BotaoEnvio variante="perigo" className="w-full" pendente="Apagando…">
                <Trash2 className="h-4 w-4" /> Apagar
              </BotaoEnvio>
            </form>
          </Dialogo>
        </div>
      </div>
      {linhas.length > 0 && (
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-2">
          {linhas.map(([k, v]) => (
            <div key={k} className="flex min-w-0 gap-1.5">
              <dt className="shrink-0 text-suave">{k}:</dt>
              <dd className="min-w-0 [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.detalhes && (
        <p className="mt-2 whitespace-pre-line text-sm text-suave [overflow-wrap:anywhere]">
          <span className="text-apagado">{c.detalhes}: </span>
          {r.detalhes}
        </p>
      )}
      {r.documentos.length > 0 && (
        <ul className="mt-2 grid grid-cols-1 gap-1">
          {r.documentos.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-lg border border-borda bg-painel/60 px-2 py-1.5 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-eletrico-claro" aria-hidden />
              <a href={`/api/documentos/${d.id}`} download className="min-w-0 flex-1 truncate hover:underline" title={`Baixar ${d.nome}`}>
                {d.nome}
              </a>
              <span className="numero shrink-0 text-xs text-apagado">{tamanhoLegivel(d.tamanho)}</span>
              <a href={`/api/documentos/${d.id}`} download className="rounded p-1 text-apagado hover:text-texto" aria-label={`Baixar ${d.nome}`}>
                <Download className="h-4 w-4" />
              </a>
              <form action={excluirDocumento}>
                <input type="hidden" name="id" value={d.id} />
                <button className="rounded p-1 text-apagado hover:text-perigo" aria-label={`Remover o documento ${d.nome}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <EnviarDocumento registroId={r.id} titulo={r.titulo} />
        {def.status && (
          <form action={alternarStatusSaude}>
            <input type="hidden" name="id" value={r.id} />
            <button className={classesBotao("fantasma", "p", "px-2")}>{encerrado ? `Marcar como ${def.status[0].toLowerCase()}` : `Marcar como ${def.status[1].toLowerCase()}`}</button>
          </form>
        )}
      </div>
    </li>
  );
}
