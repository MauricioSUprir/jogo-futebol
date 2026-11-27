"use client";
import { useMemo, useState } from "react";
import { Check, Crown, Eye, EyeOff, Gift, MessageSquareOff, Search, Settings2, ShieldCheck, UserMinus, X } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { Selo, Vazio } from "@/components/ui/cartao";
import { Dialogo } from "@/components/ui/dialogo";
import { Confirmar } from "@/components/admin/confirmar";
import { useAcao } from "@/components/admin/usar-acao";
import { aprovarTodosPedidos, definirPapel, removerParticipante, responderPedido, silenciarParticipante } from "@/lib/acoes/admin";
import { dataHora } from "@/lib/formatos";
import { TempoRelativo } from "@/components/admin/tempo-relativo";

export type Pessoa = {
  id: string;
  userId: string;
  nome: string;
  avatar: string | null;
  convidado: boolean;
  papel: "admin" | "member";
  dono: boolean;
  eu: boolean;
  rsvp: "yes" | "no" | "maybe" | null;
  comprou: boolean;
  viu: boolean;
  silenciadoAte: string | null;
  mensagem: string | null;
  criadoEm: string;
};

export function PedidosPendentes({ eventoId, pedidos }: { eventoId: string; pedidos: Pessoa[] }) {
  const { pendente, executar } = useAcao();
  const [emAndamento, setEmAndamento] = useState<string | null>(null);
  function responder(p: Pessoa, aprovar: boolean) {
    setEmAndamento(p.id + (aprovar ? ":s" : ":n"));
    executar(() => responderPedido(eventoId, p.id, aprovar), { depois: () => setEmAndamento(null), erro: () => setEmAndamento(null) });
  }
  if (pedidos.length === 0) return null;
  return (
    <section aria-labelledby="titulo-pedidos" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="titulo-pedidos" className="font-titulo text-lg font-semibold">
          Pedidos para entrar <Selo cor="ouro">{pedidos.length}</Selo>
        </h3>
        {pedidos.length > 1 ? (
          <Botao variante="esmeralda" tamanho="p" carregando={pendente && emAndamento === "todos"} disabled={pendente} onClick={() => {
            setEmAndamento("todos");
            executar(() => aprovarTodosPedidos(eventoId), { depois: () => setEmAndamento(null), erro: () => setEmAndamento(null) });
          }}>
            <Check className="size-4" aria-hidden /> Aprovar todos
          </Botao>
        ) : null}
      </div>
      <ul className="flex flex-col gap-2.5">
        {pedidos.map((p) => (
          <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-ouro/40 bg-ouro/[0.06] p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <Avatar nome={p.nome} caminho={p.avatar} tamanho={44} />
              <div className="min-w-0">
                <p className="font-semibold [overflow-wrap:anywhere]">
                  {p.nome} {p.convidado ? <Selo>sem cadastro</Selo> : null}
                </p>
                <p className="text-xs text-suave"><TempoRelativo iso={p.criadoEm} prefixo="Pediu" /></p>
                {p.mensagem ? <p className="mt-1.5 rounded-xl bg-white/60 px-3 py-2 text-sm italic [overflow-wrap:anywhere] dark:bg-white/5">“{p.mensagem}”</p> : null}
              </div>
            </div>
            <div className="flex gap-2 sm:shrink-0">
              <Botao
                variante="esmeralda"
                className="flex-1 sm:flex-none"
                carregando={pendente && emAndamento === p.id + ":s"}
                disabled={pendente}
                onClick={() => responder(p, true)}
                aria-label={`Aprovar ${p.nome}`}
              >
                <Check className="size-4" aria-hidden /> Aprovar
              </Botao>
              <Botao
                variante="contorno"
                className="flex-1 sm:flex-none"
                carregando={pendente && emAndamento === p.id + ":n"}
                disabled={pendente}
                onClick={() => responder(p, false)}
                aria-label={`Recusar ${p.nome}`}
              >
                <X className="size-4" aria-hidden /> Recusar
              </Botao>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const PRESENCA: Record<string, { texto: string; cor: "esmeralda" | "ouro" | "rubi" | "neutro" }> = {
  yes: { texto: "Vai", cor: "esmeralda" },
  maybe: { texto: "Talvez", cor: "ouro" },
  no: { texto: "Não vai", cor: "rubi" },
};

const SILENCIOS = [
  { minutos: 60, rotulo: "1 hora" },
  { minutos: 60 * 24, rotulo: "24 horas" },
  { minutos: 60 * 24 * 7, rotulo: "7 dias" },
  { minutos: 60 * 24 * 30, rotulo: "30 dias" },
];

export function ListaParticipantes({ eventoId, pessoas, sorteado }: { eventoId: string; pessoas: Pessoa[]; sorteado: boolean }) {
  const [busca, setBusca] = useState("");
  const [gerenciando, setGerenciando] = useState<Pessoa | null>(null);
  const [removendo, setRemovendo] = useState<Pessoa | null>(null);
  const { pendente, executar } = useAcao();
  const [agora] = useState(() => Date.now());

  const filtradas = useMemo(() => {
    const t = busca.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (!t) return pessoas;
    return pessoas.filter((p) => p.nome.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[̀-ͯ]/g, "").includes(t));
  }, [busca, pessoas]);

  const silenciado = (p: Pessoa) => !!p.silenciadoAte && new Date(p.silenciadoAte).getTime() > agora;

  return (
    <section aria-labelledby="titulo-lista" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="titulo-lista" className="font-titulo text-lg font-semibold">
          No grupo <Selo>{pessoas.length}</Selo>
        </h3>
        {pessoas.length > 8 ? (
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-suave" aria-hidden />
            <label htmlFor="busca-participante" className="sr-only">
              Buscar participante
            </label>
            <input
              id="busca-participante"
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar pelo nome"
              className="h-11 w-full rounded-full border border-borda bg-white/70 pl-10 pr-4 text-sm focus:border-ouro focus:outline-none focus:ring-4 focus:ring-ouro/25 dark:bg-white/5"
            />
          </div>
        ) : null}
      </div>
      <p className="text-xs text-suave">
        {sorteado
          ? "Você vê quem já abriu o presente e quem já comprou — nunca quem tirou quem."
          : "Depois do sorteio aparece também quem já abriu o presente e quem já comprou."}
      </p>
      {filtradas.length === 0 ? (
        <Vazio titulo="Ninguém com esse nome" />
      ) : (
        <ul className="flex flex-col divide-y divide-borda rounded-2xl border border-borda">
          {filtradas.map((p) => {
            const presenca = p.rsvp ? PRESENCA[p.rsvp] : null;
            return (
              <li key={p.id} className="flex items-center gap-3 px-3 py-3 sm:px-4">
                <Avatar nome={p.nome} caminho={p.avatar} tamanho={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                    <span className="[overflow-wrap:anywhere]">{p.nome}</span>
                    {p.eu ? <span className="text-sm font-normal text-suave">(você)</span> : null}
                    {p.dono ? (
                      <Selo cor="ouro">
                        <Crown className="size-3" aria-hidden /> Criador
                      </Selo>
                    ) : p.papel === "admin" ? (
                      <Selo cor="t1">
                        <ShieldCheck className="size-3" aria-hidden /> Organiza
                      </Selo>
                    ) : null}
                    {p.convidado ? <Selo>sem cadastro</Selo> : null}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5 text-xs" aria-label={`Situação de ${p.nome}`}>
                    {sorteado ? (
                      <li>
                        <Selo cor={p.viu ? "esmeralda" : "neutro"}>
                          {p.viu ? <Eye className="size-3" aria-hidden /> : <EyeOff className="size-3" aria-hidden />}
                          {p.viu ? "Abriu o presente" : "Ainda não abriu"}
                        </Selo>
                      </li>
                    ) : null}
                    {sorteado ? (
                      <li>
                        <Selo cor={p.comprou ? "esmeralda" : "neutro"}>
                          <Gift className="size-3" aria-hidden /> {p.comprou ? "Comprou" : "Não comprou"}
                        </Selo>
                      </li>
                    ) : null}
                    <li>
                      <Selo cor={presenca?.cor ?? "neutro"}>Presença: {presenca?.texto ?? "sem resposta"}</Selo>
                    </li>
                    {silenciado(p) ? (
                      <li>
                        <Selo cor="rubi">
                          <MessageSquareOff className="size-3" aria-hidden /> Silenciado até {dataHora(p.silenciadoAte)}
                        </Selo>
                      </li>
                    ) : null}
                  </ul>
                </div>
                {!p.eu ? (
                  <Botao variante="fantasma" tamanho="p" onClick={() => setGerenciando(p)} aria-label={`Gerenciar ${p.nome}`} className="shrink-0">
                    <Settings2 className="size-4" aria-hidden /> <span className="hidden sm:inline">Gerenciar</span>
                  </Botao>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Dialogo aberto={!!gerenciando} aoFechar={() => setGerenciando(null)} titulo={gerenciando ? `Gerenciar ${gerenciando.nome}` : ""}>
        {gerenciando ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Papel no grupo</p>
              {gerenciando.dono ? (
                <p className="text-sm text-suave">Quem criou o grupo continua sempre como organizador.</p>
              ) : gerenciando.papel === "admin" ? (
                <Botao
                  variante="contorno"
                  disabled={pendente}
                  onClick={() => executar(() => definirPapel(eventoId, gerenciando.id, "member"), { depois: () => setGerenciando(null) })}
                >
                  Tirar de organizador
                </Botao>
              ) : (
                <Botao
                  variante="contorno"
                  disabled={pendente}
                  onClick={() => executar(() => definirPapel(eventoId, gerenciando.id, "admin"), { depois: () => setGerenciando(null) })}
                >
                  <ShieldCheck className="size-4" aria-hidden /> Tornar organizador
                </Botao>
              )}
              {!gerenciando.dono && gerenciando.papel !== "admin" ? (
                <p className="text-xs text-suave">Organizadores acessam este painel, mas também não veem quem tirou quem.</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Chat do grupo</p>
              {gerenciando.papel === "admin" ? (
                <p className="text-sm text-suave">Organizadores não podem ser silenciados.</p>
              ) : (
                <>
                  {silenciado(gerenciando) ? (
                    <Botao
                      variante="contorno"
                      disabled={pendente}
                      onClick={() => executar(() => silenciarParticipante(eventoId, gerenciando.id, 0), { depois: () => setGerenciando(null) })}
                    >
                      Liberar o chat agora
                    </Botao>
                  ) : null}
                  <div className="grid grid-cols-2 gap-2">
                    {SILENCIOS.map((s) => (
                      <Botao
                        key={s.minutos}
                        variante="vidro"
                        tamanho="p"
                        disabled={pendente}
                        onClick={() => executar(() => silenciarParticipante(eventoId, gerenciando.id, s.minutos), { depois: () => setGerenciando(null) })}
                      >
                        <MessageSquareOff className="size-4" aria-hidden /> Silenciar {s.rotulo}
                      </Botao>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-borda pt-4">
              <p className="text-sm font-semibold">Remover do grupo</p>
              {gerenciando.dono ? (
                <p className="text-sm text-suave">O criador do grupo não pode ser removido.</p>
              ) : sorteado ? (
                <p className="text-sm text-suave">Depois do sorteio ninguém pode ser removido: cada pessoa já tem o seu par.</p>
              ) : (
                <Botao variante="perigo" disabled={pendente} onClick={() => setRemovendo(gerenciando)}>
                  <UserMinus className="size-4" aria-hidden /> Remover {gerenciando.nome.split(" ")[0]}
                </Botao>
              )}
            </div>
          </div>
        ) : null}
      </Dialogo>

      <Confirmar
        aberto={!!removendo}
        aoFechar={() => setRemovendo(null)}
        titulo={removendo ? `Remover ${removendo.nome}?` : ""}
        descricao="A pessoa sai do grupo e recebe um aviso. As restrições que a envolvem também são apagadas. Ela pode entrar de novo pelo convite enquanto ele estiver aberto."
        rotuloConfirmar="Remover do grupo"
        carregando={pendente}
        aoConfirmar={() =>
          removendo &&
          executar(() => removerParticipante(eventoId, removendo.id), {
            depois: () => {
              setRemovendo(null);
              setGerenciando(null);
            },
          })
        }
      />
    </section>
  );
}
