// MIND CENTER — bem-estar emocional: check-in, diário privado (cifrado, senha extra opcional), padrões e respiração.
import Link from "next/link";
import {
  BarChart3, BookLock, BookOpen, Feather, KeyRound, Lock, LockOpen, PenLine, ShieldCheck, Sparkles, Trash2, Wind,
} from "lucide-react";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { checkinsDoPeriodo } from "@/lib/servidor/checkin";
import { acessoAoDiario, lerEntradas, padroesDeEstresse, type EntradaDiario } from "@/lib/servidor/mente";
import { diaCurto, diaPorExtenso, diaRelativo, hoje, horaNoFuso, intervaloDeDias, nomeDiaCurto, somaDias } from "@/lib/datas";
import { ESTRESSE, mediaDe, umaCasa } from "@/lib/checkin";
import { NOS_DIAS, TIPOS_DIARIO, apoioNoTopo, emocoesFrequentes, estressePorDiaDaSemana, tipoValido, type TipoDiario } from "@/lib/mente";
import { excluirEntrada, trancarDiario } from "@/acoes/mente";
import { Barra, CabecalhoPagina, Cartao, Selo, Vazio, classesBotao } from "@/components/ui";
import { BotaoEnvio, Dialogo } from "@/components/cliente";
import { FormCheckin } from "@/components/checkin/form";
import {
  FormApagarDiario, FormCoisasBoas, FormDestrancar, FormEntrada, FormLigarSenha, FormTirarSenha, FormTrocarSenha,
} from "@/components/mente/formularios";
import { Respiracao } from "@/components/mente/respiracao";
import { GraficoHumor } from "@/components/mente/graficos";
import { CartaoApoio } from "@/components/mente/apoio";
import { SeloHumor } from "@/components/mente/humor";
import { cn } from "@/lib/cn";

export const metadata = { title: "Mind Center" };

type Aba = "hoje" | "diario" | "padroes" | "respirar";
const ABAS: { v: Aba; nome: string }[] = [
  { v: "hoje", nome: "Hoje" },
  { v: "diario", nome: "Diário" },
  { v: "padroes", nome: "Padrões" },
  { v: "respirar", nome: "Respirar" },
];

type Usuario = Awaited<ReturnType<typeof exigirUsuario>>;

export default async function PaginaMente({ searchParams }: { searchParams: Promise<{ aba?: string; tipo?: string }> }) {
  const user = await exigirUsuario();
  const hojeK = hoje(user.timezone);
  const sp = await searchParams;
  const aba: Aba = ABAS.find((a) => a.v === sp.aba)?.v ?? "hoje";
  const checkins = await checkinsDoPeriodo(user.id, somaDias(hojeK, -29), hojeK);
  const destaque = apoioNoTopo([...checkins.values()]);

  return (
    <>
      <CabecalhoPagina
        rotulo="Mind Center"
        titulo="Bem-estar emocional"
        descricao="Seus registros ficam só com você. Aqui é para acompanhar, não para diagnosticar."
      />
      {destaque && <CartaoApoio destaque />}
      <nav aria-label="Seções do Mind Center" className="mb-4 flex w-full max-w-md rounded-xl border border-borda bg-fundo-2/60 p-1">
        {ABAS.map((a) => (
          <Link
            key={a.v}
            href={a.v === "hoje" ? "/mente" : `/mente?aba=${a.v}`}
            aria-current={aba === a.v ? "page" : undefined}
            className="flex-1 rounded-lg py-1.5 text-center text-sm text-suave transition aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto aria-[current=page]:shadow-[inset_0_0_0_1px_rgb(37_99_235/0.4)]"
          >
            {a.nome}
          </Link>
        ))}
      </nav>
      {aba === "hoje" && <AbaHoje user={user} hojeK={hojeK} checkins={checkins} />}
      {aba === "diario" && <AbaDiario user={user} hojeK={hojeK} tipo={sp.tipo && tipoValido(sp.tipo) ? sp.tipo : undefined} />}
      {aba === "padroes" && <AbaPadroes user={user} hojeK={hojeK} checkins={checkins} />}
      {aba === "respirar" && (
        <Cartao titulo="Exercícios de respiração" icone={Wind}>
          <p className="mb-4 text-sm text-suave">Respirar devagar ajuda a acalmar o corpo. Sente-se confortável e acompanhe o círculo.</p>
          <Respiracao />
        </Cartao>
      )}
      <CartaoApoio />
    </>
  );
}

// ───────────── Hoje ─────────────

async function AbaHoje({ user, hojeK, checkins }: { user: Usuario; hojeK: string; checkins: Map<string, import("@/lib/checkin").Checkin> }) {
  const hojeC = checkins.get(hojeK) ?? null;
  const acesso = await acessoAoDiario(user.id);
  const positivasHoje = acesso.aberto ? await lerEntradas(user.id, acesso, { tipo: "positivo", de: hojeK }) : [];
  const temCheckin = !!hojeC && (hojeC.humor !== null || hojeC.energia !== null || hojeC.estresse !== null);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Cartao
        titulo="Check-in de hoje"
        icone={Feather}
        holo
        acao={
          temCheckin ? (
            <Dialogo gatilho="Editar" classeGatilho={classesBotao("fantasma", "p")} titulo="Check-in de hoje" descricao="Humor, energia, estresse e emoções.">
              <FormCheckin dia={hojeK} atual={hojeC} modo="mente" />
            </Dialogo>
          ) : undefined
        }
      >
        {temCheckin && hojeC ? (
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {hojeC.humor !== null && <SeloHumor humor={hojeC.humor} grande />}
              <dl className="flex gap-5">
                {hojeC.energia !== null && (
                  <div>
                    <dt className="rotulo">Energia</dt>
                    <dd className="numero font-display text-lg font-semibold">{hojeC.energia}/10</dd>
                  </div>
                )}
                {hojeC.estresse !== null && (
                  <div>
                    <dt className="rotulo">Estresse</dt>
                    <dd className="font-display text-lg font-semibold">{ESTRESSE[hojeC.estresse]}</dd>
                  </div>
                )}
              </dl>
            </div>
            {hojeC.emocoes.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Emoções de hoje">
                {hojeC.emocoes.map((e) => (
                  <li key={e}>
                    <Selo cor="#a78bfa">{e}</Selo>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <FormCheckin dia={hojeK} atual={hojeC} modo="mente" />
        )}
      </Cartao>

      <div className="grid grid-cols-1 gap-4">
        <Cartao titulo="3 coisas boas de hoje" icone={Sparkles}>
          {acesso.aberto ? (
            <>
              {positivasHoje.length > 0 && (
                <ul className="mb-3 grid grid-cols-1 gap-1.5" aria-label="Coisas boas já registradas hoje">
                  {positivasHoje
                    .flatMap((e) => e.texto.split("\n"))
                    .filter(Boolean)
                    .map((c, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-alerta" aria-hidden />
                        <span className="min-w-0 break-words">{c}</span>
                      </li>
                    ))}
                </ul>
              )}
              <FormCoisasBoas hoje={hojeK} />
            </>
          ) : (
            <DiarioTrancadoAviso />
          )}
        </Cartao>
        <Cartao titulo="Respirar agora" icone={Wind}>
          <p className="text-sm text-suave">Um minuto de respiração em caixa (4 · 4 · 4 · 4) ajuda a desacelerar.</p>
          <Link href="/mente?aba=respirar" className={classesBotao("secundario", "m", "mt-3")}>
            <Wind className="h-4 w-4" /> Começar
          </Link>
        </Cartao>
      </div>

      <Cartao titulo="Espaço para reflexões" icone={PenLine} className="lg:col-span-2">
        {acesso.aberto ? <FormEntrada hoje={hojeK} tipoInicial="reflexao" comPerguntas idPrefixo="rf" /> : <DiarioTrancadoAviso />}
      </Cartao>
    </div>
  );
}

function DiarioTrancadoAviso() {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-suave">
      <Lock className="h-4 w-4" aria-hidden /> O diário está trancado.
      <Link href="/mente?aba=diario" className="text-eletrico-claro hover:underline">
        Destrancar
      </Link>
    </p>
  );
}

// ───────────── Diário ─────────────

async function AbaDiario({ user, hojeK, tipo }: { user: Usuario; hojeK: string; tipo?: TipoDiario }) {
  const acesso = await acessoAoDiario(user.id);
  if (!acesso.aberto) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Cartao titulo="Diário trancado" icone={BookLock} holo>
          <p className="mb-4 text-sm text-suave">Digite a senha do diário. Ele fica aberto por 15 minutos e depois tranca sozinho.</p>
          <FormDestrancar />
        </Cartao>
        <Cartao titulo="Esqueceu a senha?" icone={KeyRound}>
          <p className="mb-3 text-sm text-suave">
            Sem a senha, as entradas não podem ser abertas por ninguém. Dá para apagar o diário e começar de novo (os check-ins ficam).
          </p>
          <Dialogo gatilho={<><Trash2 className="h-4 w-4" /> Apagar o diário</>} classeGatilho={classesBotao("perigo", "m")} titulo="Apagar o diário">
            <FormApagarDiario />
          </Dialogo>
        </Cartao>
      </div>
    );
  }
  const entradas = await lerEntradas(user.id, acesso, { tipo, limite: 100 });
  const porDia = new Map<string, EntradaDiario[]>();
  for (const e of entradas) porDia.set(e.dia, [...(porDia.get(e.dia) ?? []), e]);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="grid grid-cols-1 gap-4 lg:col-span-2">
        <div className="flex flex-wrap items-center gap-2">
          <Dialogo gatilho={<><PenLine className="h-4 w-4" /> Nova entrada</>} classeGatilho={classesBotao("primario")} titulo="Nova entrada" larga>
            <FormEntrada hoje={hojeK} comPerguntas />
          </Dialogo>
          {acesso.temSenha && (
            <form action={trancarDiario}>
              <button className={classesBotao("secundario")}>
                <Lock className="h-4 w-4" /> Trancar agora
              </button>
            </form>
          )}
        </div>
        <nav aria-label="Filtrar por tipo" className="flex flex-wrap gap-1.5">
          {[{ k: "", nome: "Todas" }, ...Object.entries(TIPOS_DIARIO).map(([k, v]) => ({ k, nome: v.nome }))].map((t) => (
            <Link
              key={t.k}
              href={t.k ? `/mente?aba=diario&tipo=${t.k}` : "/mente?aba=diario"}
              aria-current={(tipo ?? "") === t.k ? "page" : undefined}
              className="rounded-full border border-borda px-3 py-1 text-xs text-suave transition aria-[current=page]:border-eletrico aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto"
            >
              {t.nome}
            </Link>
          ))}
        </nav>
        {entradas.length === 0 ? (
          <Cartao>
            <Vazio icone={BookOpen} titulo={tipo ? "Nada deste tipo ainda" : "O diário está vazio"}>
              Escreva como foi o dia, um acontecimento ou uma reflexão.
            </Vazio>
          </Cartao>
        ) : (
          [...porDia.entries()].map(([dia, lista]) => (
            <section key={dia} aria-label={diaPorExtenso(dia)}>
              <h3 className="rotulo mb-2 first-letter:uppercase">{diaRelativo(dia, hojeK) === "Hoje" ? "Hoje" : diaPorExtenso(dia, true)}</h3>
              <ul className="grid grid-cols-1 gap-2">
                {lista.map((e) => (
                  <li key={e.id} className="painel p-4" data-testid="entrada-diario">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Selo cor={e.tipo === "positivo" ? "#fbbf24" : "#a78bfa"}>{TIPOS_DIARIO[e.tipo].nome}</Selo>
                      <span className="numero text-xs text-apagado">{horaNoFuso(e.criadaEm, user.timezone)}</span>
                      <span className="ml-auto flex items-center gap-1">
                        <Dialogo gatilho="Editar" classeGatilho={classesBotao("fantasma", "p")} titulo="Editar entrada" larga>
                          <FormEntrada hoje={hojeK} inicial={{ id: e.id, dia: e.dia, tipo: e.tipo, titulo: e.titulo, texto: e.texto }} idPrefixo={`ed${e.id}`} />
                        </Dialogo>
                        <Dialogo
                          gatilho={<Trash2 className="h-4 w-4" />}
                          rotuloGatilho="Apagar entrada"
                          classeGatilho={classesBotao("fantasma", "p", "px-2 hover:text-perigo")}
                          titulo="Apagar esta entrada?"
                          descricao="Não dá para desfazer."
                        >
                          <form action={excluirEntrada}>
                            <input type="hidden" name="id" value={e.id} />
                            <BotaoEnvio variante="perigo" className="w-full" pendente="Apagando…">
                              Apagar
                            </BotaoEnvio>
                          </form>
                        </Dialogo>
                      </span>
                    </div>
                    {e.titulo && <p className="mb-1 font-medium">{e.titulo}</p>}
                    {e.tipo === "positivo" ? (
                      <ul className="grid grid-cols-1 gap-1 text-sm">
                        {e.texto.split("\n").map((c, i) => (
                          <li key={i} className="flex gap-2">
                            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-alerta" aria-hidden />
                            <span className="min-w-0 break-words">{c}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="whitespace-pre-wrap break-words text-sm text-texto/90">{e.texto}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <Cartao titulo="Privacidade do diário" icone={ShieldCheck} className="h-fit">
        {acesso.temSenha ? (
          <div className="grid grid-cols-1 gap-3 text-sm">
            <p className="flex items-center gap-2 text-ok">
              <LockOpen className="h-4 w-4" aria-hidden /> Senha extra ligada · aberto agora
            </p>
            <p className="text-suave">O texto é cifrado com uma chave que sai da sua senha. Ele tranca sozinho 15 minutos depois de aberto.</p>
            <div className="flex flex-wrap gap-2">
              <Dialogo gatilho="Trocar senha" classeGatilho={classesBotao("secundario", "p")} titulo="Trocar a senha do diário">
                <FormTrocarSenha />
              </Dialogo>
              <Dialogo gatilho="Tirar senha" classeGatilho={classesBotao("fantasma", "p")} titulo="Tirar a senha extra">
                <FormTirarSenha />
              </Dialogo>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 text-sm">
            <p className="text-suave">
              As entradas já ficam cifradas no servidor (AES-256-GCM). Com a senha extra, nem quem tiver acesso ao banco e ao servidor consegue lê-las.
            </p>
            <Dialogo gatilho={<><KeyRound className="h-4 w-4" /> Ligar senha extra</>} classeGatilho={classesBotao("contorno", "m")} titulo="Senha extra do diário">
              <FormLigarSenha />
            </Dialogo>
          </div>
        )}
        <div className="mt-4 border-t border-borda pt-3">
          <Dialogo gatilho={<><Trash2 className="h-4 w-4" /> Apagar o diário</>} classeGatilho={classesBotao("fantasma", "p", "hover:text-perigo")} titulo="Apagar o diário">
            <FormApagarDiario />
          </Dialogo>
        </div>
      </Cartao>
    </div>
  );
}

// ───────────── Padrões ─────────────

async function AbaPadroes({ user, hojeK, checkins }: { user: Usuario; hojeK: string; checkins: Map<string, import("@/lib/checkin").Checkin> }) {
  const dias = intervaloDeDias(somaDias(hojeK, -29), hojeK);
  const lista = [...checkins.values()];
  const p = await padroesDeEstresse(user, hojeK);
  const grafico = dias.map((d) => ({ dia: diaCurto(d), humor: checkins.get(d)?.humor ?? null, estresse: checkins.get(d)?.estresse ?? null }));
  const emocoes = emocoesFrequentes(lista);
  const maxEmocao = Math.max(1, ...emocoes.map((e) => e.vezes));
  const porDow = estressePorDiaDaSemana(p.checkins);
  const comDados = lista.filter((c) => c.humor !== null || c.estresse !== null || c.energia !== null);
  const kpis = [
    { r: "Check-ins", v: String(comDados.length), d: "nos últimos 30 dias" },
    { r: "Humor médio", v: umaCasa(mediaDe(lista.map((c) => c.humor))), d: "de 5" },
    { r: "Energia média", v: umaCasa(mediaDe(lista.map((c) => c.energia))), d: "de 10" },
    { r: "Estresse médio", v: umaCasa(mediaDe(lista.map((c) => c.estresse))), d: "de 5" },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <section aria-label="Resumo de 30 dias" className="grid grid-cols-2 gap-3 lg:col-span-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.r} className="painel p-4">
            <p className="rotulo">{k.r}</p>
            <p className="numero mt-1 font-display text-xl font-bold">{k.v}</p>
            <p className="text-[0.7rem] text-apagado">{k.d}</p>
          </div>
        ))}
      </section>

      <Cartao titulo="Humor e estresse · 30 dias" icone={BarChart3} className="lg:col-span-2">
        {comDados.length === 0 ? (
          <Vazio icone={Feather} titulo="Sem check-ins ainda">Faça o check-in na aba Hoje e o histórico aparece aqui.</Vazio>
        ) : (
          <>
            <GraficoHumor dados={grafico} />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs text-suave hover:text-texto">Ver em tabela</summary>
              <table className="mt-2 w-full text-left text-xs">
                <thead className="text-suave">
                  <tr>
                    <th className="py-1 font-medium">Dia</th>
                    <th className="py-1 font-medium">Humor</th>
                    <th className="py-1 font-medium">Energia</th>
                    <th className="py-1 font-medium">Estresse</th>
                  </tr>
                </thead>
                <tbody className="numero">
                  {[...dias].reverse().filter((d) => checkins.has(d)).map((d) => {
                    const c = checkins.get(d)!;
                    return (
                      <tr key={d} className="border-t border-borda">
                        <td className="py-1">{diaCurto(d)}</td>
                        <td className="py-1">{c.humor ?? "—"}</td>
                        <td className="py-1">{c.energia ?? "—"}</td>
                        <td className="py-1">{c.estresse ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          </>
        )}
      </Cartao>

      <Cartao titulo="Emoções mais frequentes" icone={Sparkles}>
        {emocoes.length === 0 ? (
          <p className="py-4 text-sm text-suave">Marque as emoções no check-in para ver as mais frequentes.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2.5">
            {emocoes.map((e) => (
              <li key={e.emocao}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{e.emocao}</span>
                  <span className="numero text-suave">{e.vezes}×</span>
                </div>
                <Barra pct={(e.vezes / maxEmocao) * 100} cor="#3987e5" rotulo={`${e.emocao}: ${e.vezes} vezes`} />
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <Cartao titulo="Padrões de estresse · 60 dias" icone={BarChart3} className="lg:col-span-3">
        <p className="mb-3 text-xs text-apagado">
          Padrões dos seus próprios registros, para você se conhecer melhor. Não é diagnóstico. As comparações só aparecem com pelo menos 3 dias em cada lado.
        </p>
        {p.frases.length === 0 ? (
          <p className="mb-4 text-sm text-suave">Ainda não há registros suficientes para ver um padrão. Continue fazendo o check-in.</p>
        ) : (
          <ul className="mb-4 grid grid-cols-1 gap-2">
            {p.frases.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <Sparkles className={cn("mt-0.5 h-4 w-4 shrink-0", f.tom === "atencao" ? "text-alerta" : f.tom === "positivo" ? "text-ok" : "text-eletrico-claro")} aria-hidden />
                <span>{f.texto}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <caption className="mb-1 text-left text-xs text-suave">Estresse médio por dia da semana</caption>
            <thead className="text-suave">
              <tr>
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <th key={d} className="py-1 font-medium" title={NOS_DIAS[d]}>
                    {nomeDiaCurto(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="numero">
              <tr className="border-t border-borda">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const x = porDow[d];
                  return (
                    <td key={d} className="py-1.5">
                      {x.media === null ? "—" : umaCasa(x.media)}
                      {x.n > 0 && <span className="block text-[0.65rem] text-apagado">{x.n === 1 ? "1 dia" : `${x.n} dias`}</span>}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        {p.sonoCmp && (
          <p className="mt-3 text-xs text-suave">
            Noites abaixo da meta: {p.sonoCmp.na} · meta batida: {p.sonoCmp.nb} (Sleep Lab).
          </p>
        )}
      </Cartao>
    </div>
  );
}
