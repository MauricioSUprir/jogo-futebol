// HEALTH CENTER — central de saúde: consultas, vacinas, exames, medicamentos, alergias, lesões, sintomas,
// diário de saúde e informações para emergências. Organiza registros; não faz diagnóstico.
import Link from "next/link";
import {
  AlertTriangle, CalendarClock, ClipboardList, HeartPulse, Info, Phone, Pill, Plus, Shield, ShieldPlus, Sparkles, Stethoscope, Syringe,
} from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { diasDoDiario, emergencia, registrosSaude, type RegistroSaude } from "@/lib/servidor/saude";
import { configSono, noitesDoPeriodo } from "@/lib/servidor/sono";
import { checkinsDoPeriodo } from "@/lib/servidor/checkin";
import { diaRelativo, diasEntre, hoje, somaDias, validaChave } from "@/lib/datas";
import {
  ABAS_SAUDE, AVISO_SAUDE, DEF_TIPOS, energiaEAtividade, linhaDiario, linkTelefone, proximasDoses, proximosRetornos, type AbaSaude, type TipoSaude,
} from "@/lib/saude";
import { formatarDuracao, sonoEEnergia } from "@/lib/sono";
import { umaCasa } from "@/lib/checkin";
import { CabecalhoPagina, Cartao, Vazio, classesBotao } from "@/components/ui";
import { Dialogo } from "@/components/cliente";
import { FormCheckin } from "@/components/checkin/form";
import { FormEmergencia, FormRegistroSaude } from "@/components/saude/formularios";
import { ItemRegistro } from "@/components/saude/item";
import { cn } from "@/lib/cn";

export const metadata = { title: "Health Center" };

const dataBr = (k: string) => k.split("-").reverse().join("/");

export default async function PaginaHealthCenter({ searchParams }: { searchParams: Promise<{ aba?: string; dia?: string }> }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const sp = await searchParams;
  const aba: AbaSaude = ABAS_SAUDE.find((a) => a.aba === sp.aba)?.aba ?? "resumo";
  const def = ABAS_SAUDE.find((a) => a.aba === aba)!;

  return (
    <>
      <CabecalhoPagina
        rotulo="Health Center"
        titulo={
          <span className="flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-eletrico-claro" aria-hidden /> Central de saúde
          </span>
        }
        descricao="Consultas, vacinas, exames, medicamentos, lesões e o seu diário de saúde, num lugar privado."
        acao={
          <Link href="/saude/central?aba=emergencia" className={classesBotao("perigo")}>
            <ShieldPlus className="h-4 w-4" /> Emergência
          </Link>
        }
      />
      <nav aria-label="Seções do Health Center" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
        <ul className="flex w-max gap-1.5 pb-1 sm:w-auto sm:flex-wrap">
          {ABAS_SAUDE.map((a) => (
            <li key={a.aba}>
              <Link
                href={`/saude/central?aba=${a.aba}`}
                aria-current={aba === a.aba ? "page" : undefined}
                className="block whitespace-nowrap rounded-full border border-borda px-3 py-1.5 text-sm text-suave transition hover:text-texto aria-[current=page]:border-eletrico/60 aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto"
              >
                {a.nome}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {aba === "resumo" && <Resumo userId={user.id} user={user} hojeK={hojeK} />}
      {def.tipos.length > 0 && <ListaTipos user={user} hojeK={hojeK} tipos={def.tipos} />}
      {aba === "diario" && <Diario user={user} hojeK={hojeK} dia={sp.dia} />}
      {aba === "emergencia" && <Emergencia userId={user.id} />}

      <p className="mt-6 flex items-start gap-2 text-xs text-apagado">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {AVISO_SAUDE}
      </p>
    </>
  );
}

type U = Awaited<ReturnType<typeof exigirUsuario>>;

function Lista({ itens, hojeK, vazio }: { itens: RegistroSaude[]; hojeK: string; vazio: string }) {
  if (!itens.length) return <p className="py-3 text-sm text-suave">{vazio}</p>;
  return (
    <ul className="grid grid-cols-1 gap-2">
      {itens.map((r) => (
        <ItemRegistro key={r.id} r={r} hoje={hojeK} />
      ))}
    </ul>
  );
}

async function ListaTipos({ user, hojeK, tipos }: { user: U; hojeK: string; tipos: readonly TipoSaude[] }) {
  const regs = await registrosSaude(user, [...tipos]);
  return (
    <div className={cn("grid grid-cols-1 gap-4", tipos.length > 1 && "lg:grid-cols-2")}>
      {tipos.map((t) => {
        const d = DEF_TIPOS[t];
        const doTipo = regs.filter((r) => r.tipo === t);
        const novo = (
          <Dialogo gatilho={<><Plus className="h-4 w-4" /> Novo</>} classeGatilho={classesBotao("contorno", "p")} titulo={`Novo registro: ${d.nome.toLowerCase()}`}>
            <FormRegistroSaude tipo={t} hoje={hojeK} />
          </Dialogo>
        );
        if (t === "consulta") {
          const marcadas = doTipo.filter((r) => r.dia >= hojeK).sort((a, b) => (a.dia + (a.hora ?? "")).localeCompare(b.dia + (b.hora ?? "")));
          const passadas = doTipo.filter((r) => r.dia < hojeK);
          return (
            <div key={t} className="grid grid-cols-1 gap-4">
              <Cartao titulo="Consultas marcadas" icone={CalendarClock} acao={novo}>
                <Lista itens={marcadas} hojeK={hojeK} vazio="Nenhuma consulta marcada. Ao marcar uma, ela entra na agenda." />
              </Cartao>
              <Cartao titulo="Histórico de consultas" icone={ClipboardList}>
                <Lista itens={passadas} hojeK={hojeK} vazio="Nenhuma consulta registrada ainda." />
              </Cartao>
            </div>
          );
        }
        const ativos = d.status ? doTipo.filter((r) => r.status === "ativo") : doTipo;
        const encerrados = d.status ? doTipo.filter((r) => r.status !== "ativo") : [];
        return (
          <Cartao key={t} titulo={d.plural} icone={t === "vacina" ? Syringe : t === "medicamento" ? Pill : HeartPulse} acao={novo}>
            <Lista itens={ativos} hojeK={hojeK} vazio={`Nenhum registro de ${d.plural.toLowerCase()}.`} />
            {encerrados.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-suave hover:text-texto">
                  {d.status![1]}s ({encerrados.length})
                </summary>
                <div className="mt-2">
                  <Lista itens={encerrados} hojeK={hojeK} vazio="" />
                </div>
              </details>
            )}
          </Cartao>
        );
      })}
    </div>
  );
}

async function Resumo({ user, hojeK }: { userId: string; user: U; hojeK: string }) {
  const [regs, emerg, dias] = await Promise.all([registrosSaude(user), emergencia(user.id), diasDoDiario(user, somaDias(hojeK, -6), hojeK)]);
  const consultas = regs
    .filter((r) => r.tipo === "consulta" && r.dia >= hojeK)
    .sort((a, b) => (a.dia + (a.hora ?? "")).localeCompare(b.dia + (b.hora ?? "")));
  const doses = proximasDoses(regs, hojeK);
  const retornos = proximosRetornos(regs, hojeK);
  const meds = regs.filter((r) => r.tipo === "medicamento" && r.status === "ativo");
  const orientacoes = regs.filter((r) => r.tipo === "orientacao" && r.status === "ativo");
  const alergias = regs.filter((r) => r.tipo === "alergia" && r.status === "ativo");
  const lesoes = regs.filter((r) => r.tipo === "lesao" && r.status === "ativo");
  const checkins = dias.filter((d) => d.checkin);

  const bloco = (titulo: string, Icone: typeof Pill, aba: string, itens: { k: string; t: string; d?: string }[], vazio: string) => (
    <Cartao
      titulo={titulo}
      icone={Icone}
      acao={
        <Link href={`/saude/central?aba=${aba}`} className={classesBotao("fantasma", "p")}>
          Ver
        </Link>
      }
    >
      {itens.length === 0 ? (
        <p className="text-sm text-suave">{vazio}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-1.5">
          {itens.slice(0, 5).map((i) => (
            <li key={i.k} className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{i.t}</span>
              {i.d && <span className="numero max-w-[50%] shrink-0 truncate text-xs text-suave">{i.d}</span>}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {bloco(
        "Próximas consultas",
        CalendarClock,
        "consultas",
        [
          ...consultas.map((c) => ({ k: c.id, t: c.titulo, d: `${diaRelativo(c.dia, hojeK)}${c.hora ? ` · ${c.hora}` : ""}` })),
          ...retornos.map((c) => ({ k: c.id + "r", t: `Retorno: ${c.titulo}`, d: dataBr(c.proximo!) })),
        ],
        "Nenhuma consulta marcada.",
      )}
      {bloco(
        "Próximas doses",
        Syringe,
        "vacinas",
        doses.map((v) => ({ k: v.id, t: v.titulo, d: `${dataBr(v.proximo!)}${diasEntre(hojeK, v.proximo!) <= 30 ? ` · em ${diasEntre(hojeK, v.proximo!)} dia(s)` : ""}` })),
        "Nenhuma próxima dose registrada.",
      )}
      {bloco(
        "Medicamentos e orientações",
        Pill,
        "medicamentos",
        [...meds.map((m) => ({ k: m.id, t: m.titulo, d: m.dose ?? undefined })), ...orientacoes.map((o) => ({ k: o.id, t: o.titulo, d: "orientação" }))],
        "Nenhum medicamento em uso registrado.",
      )}
      {bloco("Alergias conhecidas", AlertTriangle, "alergias", alergias.map((a) => ({ k: a.id, t: a.titulo })), "Nenhuma alergia registrada.")}
      {bloco(
        "Lesões em recuperação",
        HeartPulse,
        "lesoes",
        lesoes.map((l) => ({ k: l.id, t: l.titulo, d: l.parteCorpo ?? undefined })),
        "Nenhuma lesão em recuperação.",
      )}
      <Cartao
        titulo="Últimos check-ins"
        icone={Sparkles}
        acao={
          <Link href="/saude/central?aba=diario" className={classesBotao("fantasma", "p")}>
            Diário
          </Link>
        }
      >
        {checkins.length === 0 ? (
          <p className="text-sm text-suave">Nenhum check-in nos últimos 7 dias.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1.5">
            {checkins.slice(0, 5).map((d) => (
              <li key={d.dia} className="flex min-w-0 items-baseline justify-between gap-3 text-sm">
                <span className="shrink-0 whitespace-nowrap first-letter:uppercase">{diaRelativo(d.dia, hojeK)}</span>
                <span className="numero min-w-0 truncate text-xs text-suave">
                  Energia {d.checkin?.energia ?? "—"}/10 · Sono {formatarDuracao(d.sonoMin)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
      <Cartao titulo="Emergência" icone={Shield} className="md:col-span-2 xl:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-suave">
            {emerg.existe
              ? `Tipo sanguíneo ${emerg.sangue ?? "não informado"} · ${emerg.contatos.length} contato(s) de emergência.`
              : "Preencha tipo sanguíneo, alergias e contatos para mostrar a alguém numa emergência."}
          </p>
          <Link href="/saude/central?aba=emergencia" className={classesBotao("secundario", "p")}>
            <ShieldPlus className="h-4 w-4" /> {emerg.existe ? "Abrir" : "Preencher"}
          </Link>
        </div>
      </Cartao>
    </div>
  );
}

async function Diario({ user, hojeK, dia: diaPedido }: { user: U; hojeK: string; dia?: string }) {
  const dia = diaPedido && validaChave(diaPedido) && diaPedido <= hojeK && diasEntre(diaPedido, hojeK) <= 60 ? diaPedido : hojeK;
  const de = somaDias(hojeK, -27);
  const [dias, doDia, cfgSono, noites, checkins] = await Promise.all([
    diasDoDiario(user, de, hojeK),
    diasDoDiario(user, dia, dia),
    configSono(user.id),
    noitesDoPeriodo(user.id, de, hojeK),
    checkinsDoPeriodo(user.id, de, hojeK),
  ]);
  const atual = doDia[0];
  const ativ = energiaEAtividade(dias);
  const sono = sonoEEnergia(noites, checkins, cfgSono.targetMin);
  const recentes = dias.slice(0, 14);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <Cartao titulo={dia === hojeK ? "Como você está hoje?" : `Diário de ${diaRelativo(dia, hojeK).toLowerCase()}`} icone={HeartPulse} holo className="lg:col-span-2">
        <FormCheckin key={dia} dia={dia} atual={atual.checkin} modo="saude" rotuloBotao="Salvar no diário" />
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-borda pt-3 text-sm">
          <div>
            <dt className="rotulo">Sono da noite</dt>
            <dd className="numero mt-1">{atual.sonoMin !== null ? formatarDuracao(atual.sonoMin) : <Link href="/sono" className="text-eletrico-claro hover:underline">Registrar</Link>}</dd>
          </div>
          <div>
            <dt className="rotulo">Atividade física</dt>
            <dd className="mt-1">{atual.atividades.length ? atual.atividades.join(", ") : "—"}</dd>
          </div>
        </dl>
        {dia !== hojeK && (
          <Link href="/saude/central?aba=diario" className={classesBotao("fantasma", "p", "mt-3")}>
            Voltar para hoje
          </Link>
        )}
      </Cartao>
      <div className="grid grid-cols-1 gap-4 lg:col-span-3">
        <Cartao titulo="Padrões (4 semanas)" icone={Sparkles}>
          <ul className="grid grid-cols-1 gap-2 text-sm">
            <li>
              {ativ
                ? `Energia média em dias com atividade física: ${umaCasa(ativ.a)} (${ativ.na} dias); nos outros dias: ${umaCasa(ativ.b)} (${ativ.nb} dias).`
                : "Energia × atividade física: aparece com pelo menos 3 dias de cada tipo com o check-in de energia."}
            </li>
            <li>
              {sono
                ? `Energia depois de noites com ${formatarDuracao(cfgSono.targetMin)} ou mais: ${umaCasa(sono.a)}; depois das outras: ${umaCasa(sono.b)}.`
                : "Energia × sono: aparece com pelo menos 3 noites com a meta de sono e 3 sem, com o check-in de energia."}
            </li>
          </ul>
          <p className="mt-3 text-xs text-apagado">{AVISO_SAUDE}</p>
        </Cartao>
        <Cartao titulo="Últimos 14 dias" icone={ClipboardList}>
          {recentes.every((d) => !d.checkin && d.sonoMin === null && !d.atividades.length) ? (
            <Vazio icone={HeartPulse} titulo="Diário vazio">Faça o check-in de hoje ao lado.</Vazio>
          ) : (
            <ul className="grid grid-cols-1 gap-2">
              {recentes
                .filter((d) => d.checkin || d.sonoMin !== null || d.atividades.length)
                .map((d) => (
                  <li key={d.dia} className="rounded-xl border border-borda bg-fundo-2/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium first-letter:uppercase">{diaRelativo(d.dia, hojeK)}</p>
                      <Link href={`/saude/central?aba=diario&dia=${d.dia}`} className="text-xs text-eletrico-claro hover:underline" aria-label={`Editar o diário de ${dataBr(d.dia)}`}>
                        Editar
                      </Link>
                    </div>
                    <p className="mt-0.5 text-xs text-suave [overflow-wrap:anywhere]">{linhaDiario(d, formatarDuracao).join(" · ")}</p>
                  </li>
                ))}
            </ul>
          )}
        </Cartao>
      </div>
    </div>
  );
}

async function Emergencia({ userId }: { userId: string }) {
  const e = await emergencia(userId);
  const campos: [string, string | null][] = [
    ["Alergias", e.alergias],
    ["Condições de saúde", e.condicoes],
    ["Medicamentos em uso", e.medicamentos],
    ["Plano de saúde", e.plano],
    ["Observações", e.observacoes],
  ];
  return (
    <div className="grid grid-cols-1 gap-4">
      <section aria-labelledby="em-titulo" className="painel border-perigo/40 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="em-titulo" className="flex items-center gap-2 font-display text-xl font-bold">
            <ShieldPlus className="h-6 w-6 text-perigo" aria-hidden /> Informações para emergências
          </h2>
          <Dialogo gatilho={e.existe ? "Editar" : "Preencher"} classeGatilho={classesBotao("secundario", "p")} titulo="Informações para emergências" larga>
            <FormEmergencia dados={e} />
          </Dialogo>
        </div>
        {!e.existe ? (
          <p className="text-suave">Nada preenchido ainda. Toque em Preencher.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="rotulo">Tipo sanguíneo</p>
                <p className="mt-1 font-display text-4xl font-bold">{e.sangue ?? "—"}</p>
              </div>
              {campos
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <p className="rotulo">{k}</p>
                    <p className="mt-1 whitespace-pre-line text-lg [overflow-wrap:anywhere]">{v}</p>
                  </div>
                ))}
            </div>
            <div>
              <p className="rotulo mb-2">Contatos</p>
              {e.contatos.length === 0 ? (
                <p className="text-suave">Nenhum contato.</p>
              ) : (
                <ul className="grid grid-cols-1 gap-2">
                  {e.contatos.map((c, i) => {
                    const tel = linkTelefone(c.telefone);
                    return (
                      <li key={i} className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-fundo-2/60 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold">{c.nome}</p>
                          <p className="truncate text-sm text-suave">
                            {c.relacao ? `${c.relacao} · ` : ""}
                            <span className="numero">{c.telefone}</span>
                          </p>
                        </div>
                        {tel && (
                          <a href={tel} className={classesBotao("primario", "m", "shrink-0")} aria-label={`Ligar para ${c.nome}`}>
                            <Phone className="h-4 w-4" /> Ligar
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
