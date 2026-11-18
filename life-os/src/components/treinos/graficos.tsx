"use client";
// Gráficos do Fitness Center (Recharts), uma série cada: azul #3987e5 (validado no fundo #0e1424).
// Barras finas com ponta de 4 px, linha de 2 px com marcadores de 8 px, grade discreta e uma escala só;
// o título do cartão nomeia a série (sem legenda) e toda tela tem a tabela ao lado (<details>).
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COR = "#3987e5";
const GRADE = "rgb(148 163 184 / 0.12)";
const EIXO = { fill: "#94a3b8", fontSize: 11 };

function Dica({ active, payload, label, unidade, nome }: { active?: boolean; payload?: { value: number }[]; label?: string; unidade: string; nome: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-borda-forte bg-painel-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-texto">{label}</p>
      <p className="flex items-center gap-2 text-suave">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COR }} aria-hidden />
        {nome}: <span className="numero text-texto">{Number(payload[0].value).toLocaleString("pt-BR")}{unidade}</span>
      </p>
    </div>
  );
}

/** Barras de uma série (jogos por mês, minutos por semana). */
export function GraficoBarras({
  dados,
  nome,
  unidade = "",
  descricao,
  inteiro = true,
  todosRotulos,
}: {
  dados: { rotulo: string; valor: number }[];
  nome: string;
  unidade?: string;
  descricao: string;
  inteiro?: boolean;
  /** Mostra todos os rótulos do eixo (ex.: os 12 meses), com letra menor. */
  todosRotulos?: boolean;
}) {
  return (
    <div className="h-44" role="img" aria-label={descricao}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} barCategoryGap="24%" margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis
            dataKey="rotulo"
            tick={todosRotulos ? { ...EIXO, fontSize: 10 } : EIXO}
            axisLine={false}
            tickLine={false}
            interval={todosRotulos ? 0 : "preserveStartEnd"}
            minTickGap={todosRotulos ? 0 : 6}
          />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} allowDecimals={!inteiro} width={44} />
          <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.06)" }} content={<Dica unidade={unidade} nome={nome} />} />
          <Bar dataKey="valor" name={nome} fill={COR} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Evolução da maior carga de um exercício, sessão a sessão. */
export function GraficoCarga({ dados, exercicio }: { dados: { rotulo: string; carga: number }[]; exercicio: string }) {
  const max = Math.max(...dados.map((d) => d.carga), 1);
  const min = Math.min(...dados.map((d) => d.carga), max);
  const folga = Math.max(2.5, (max - min) * 0.15);
  return (
    <div className="h-48" role="img" aria-label={`Maior carga por sessão de ${exercicio}, em kg`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 10, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={10} />
          <YAxis
            tick={EIXO}
            axisLine={false}
            tickLine={false}
            width={44}
            domain={[Math.max(0, Math.floor(min - folga)), Math.ceil(max + folga)]}
            tickFormatter={(v: number) => v.toLocaleString("pt-BR")}
          />
          <Tooltip cursor={{ stroke: "rgb(148 163 184 / 0.4)", strokeWidth: 1 }} content={<Dica unidade=" kg" nome="Maior carga" />} />
          <Line
            type="monotone"
            dataKey="carga"
            name="Maior carga"
            stroke={COR}
            strokeWidth={2}
            dot={{ r: 4, fill: COR, stroke: "#0e1424", strokeWidth: 2 }}
            activeDot={{ r: 6, fill: COR, stroke: "#0e1424", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
