"use client";
// Gráfico do Sleep Lab (Recharts), no mesmo estilo de components/graficos.tsx: uma série só (horas por noite),
// azul #3987e5 validado no fundo #0e1424, barras ≤ 24 px com ponta de 4 px, grade discreta e a linha da meta.
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COR = "#3987e5";
const GRADE = "rgb(148 163 184 / 0.12)";
const EIXO = { fill: "#94a3b8", fontSize: 11 };

function horasTexto(h: number) {
  const min = Math.round(h * 60);
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return mm ? `${hh} h ${mm} min` : `${hh} h`;
}

function Dica({ active, payload, label }: { active?: boolean; payload?: { value: number | null }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-xl border border-borda-forte bg-painel-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-texto">{label}</p>
      <p className="flex items-center gap-2 text-suave">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: COR }} aria-hidden />
        Sono: <span className="numero text-texto">{v == null ? "sem registro" : horasTexto(v)}</span>
      </p>
    </div>
  );
}

/** Horas de sono por noite, com a linha da meta. */
export function GraficoSono({ dados, metaHoras }: { dados: { dia: string; horas: number | null }[]; metaHoras: number }) {
  const topo = Math.max(10, Math.ceil(Math.max(metaHoras, ...dados.map((d) => d.horas ?? 0)) + 0.5));
  const ticks = Array.from({ length: Math.floor(topo / 2) + 1 }, (_, i) => i * 2);
  return (
    <div className="h-52" role="img" aria-label={`Horas de sono por noite; meta de ${horasTexto(metaHoras)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} barCategoryGap="28%" margin={{ top: 14, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tick={EIXO} axisLine={false} tickLine={false} tickFormatter={(v) => `${v} h`} />
          <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.06)" }} content={<Dica />} />
          <ReferenceLine y={metaHoras} stroke="#94a3b8" strokeWidth={1} label={{ value: "Meta", position: "insideTopRight", fill: "#94a3b8", fontSize: 11 }} />
          <Bar dataKey="horas" name="Sono" fill={COR} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
