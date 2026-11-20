"use client";
// Gráfico do Study Center (Recharts), no mesmo estilo de components/graficos.tsx.
// Uma série só (azul #3987e5, validado no fundo #0e1424): o título nomeia a série, sem legenda.
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COR_1 = "#3987e5";
const GRADE = "rgb(148 163 184 / 0.12)";
const EIXO = { fill: "#94a3b8", fontSize: 11 };

function Dica({ active, payload }: { active?: boolean; payload?: { payload: { rotulo: string; titulo: string; pct: number; acertos: string } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-borda-forte bg-painel-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-texto">{d.titulo}</p>
      <p className="text-suave">
        {d.rotulo}: <span className="numero text-texto">{d.pct}%</span> ({d.acertos})
      </p>
    </div>
  );
}

/** Desempenho por simulado (% de acertos), do mais antigo ao mais recente. */
export function GraficoSimulados({ dados }: { dados: { rotulo: string; titulo: string; pct: number; acertos: string }[] }) {
  return (
    <div className="h-48" role="img" aria-label="Porcentagem de acertos por simulado, do mais antigo ao mais recente">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} barCategoryGap="28%" margin={{ top: 8, right: 6, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="rotulo" tick={EIXO} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={EIXO} axisLine={false} tickLine={false} unit="%" />
          <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.06)" }} content={<Dica />} />
          <Bar dataKey="pct" name="Acertos" fill={COR_1} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
