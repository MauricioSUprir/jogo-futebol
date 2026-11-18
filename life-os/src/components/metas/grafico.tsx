"use client";
// Evolução de uma meta numérica (uma série, azul #3987e5 validado no fundo #0e1424; linha do alvo em cinza).
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COR_1 = "#3987e5";
const GRADE = "rgb(148 163 184 / 0.12)";
const EIXO = { fill: "#94a3b8", fontSize: 11 };

function Dica({ active, payload, label, unidade }: { active?: boolean; payload?: { value: number }[]; label?: string; unidade: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-borda-forte bg-painel-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-texto">{label}</p>
      <p className="numero text-texto">
        {Number(payload[0].value).toLocaleString("pt-BR")}
        {unidade}
      </p>
    </div>
  );
}

/** Marcas do eixo em degraus redondos (1, 2, 5 × 10ⁿ), até ~5 marcas. */
function marcas(max: number): number[] {
  const bruto = Math.max(max, 1) / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto) ?? pot * 10;
  const topo = Math.ceil(max / passo) * passo;
  return Array.from({ length: Math.round(topo / passo) + 1 }, (_, i) => +(i * passo).toFixed(6));
}

export function GraficoEvolucao({ dados, alvo, unidade }: { dados: { rotulo: string; valor: number }[]; alvo: number; unidade: string | null }) {
  const u = unidade ? ` ${unidade}` : "";
  const ticks = marcas(Math.max(alvo, ...dados.map((d) => d.valor)) * 1.05);
  return (
    <div className="h-44" role="img" aria-label={`Evolução da meta até o alvo de ${alvo.toLocaleString("pt-BR")}${u}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 14, right: 10, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={10} />
          <YAxis domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tick={EIXO} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ stroke: "rgb(148 163 184 / 0.3)" }} content={<Dica unidade={u} />} />
          <ReferenceLine y={alvo} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" label={{ value: "Alvo", position: "insideTopRight", fill: "#94a3b8", fontSize: 11 }} />
          <Line type="monotone" dataKey="valor" name="Progresso" stroke={COR_1} strokeWidth={2} dot={{ r: 4, fill: COR_1, stroke: "#0e1424", strokeWidth: 2 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
