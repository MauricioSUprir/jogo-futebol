"use client";
// Humor e estresse por dia (escala 1–5, um eixo só). Paleta validada no fundo #0e1424:
// série 1 azul #3987e5 (humor), série 2 água #199e70 (estresse). Linhas de 2 px, marcadores de 8 px,
// cruz e dica ao passar o dedo/mouse, legenda e a tabela à parte (na página).
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ESTRESSE, HUMOR } from "@/lib/checkin";

const COR_HUMOR = "#3987e5";
const COR_ESTRESSE = "#199e70";
const GRADE = "rgb(148 163 184 / 0.12)";
const EIXO = { fill: "#94a3b8", fontSize: 11 };

function Dica({ active, payload, label }: { active?: boolean; payload?: { dataKey: string; value: number | null; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const linhas = payload.filter((p) => typeof p.value === "number");
  return (
    <div className="rounded-xl border border-borda-forte bg-painel-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-texto">{label}</p>
      {linhas.length === 0 && <p className="text-suave">Sem check-in</p>}
      {linhas.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-suave">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
          <span>{p.dataKey === "humor" ? "Humor" : "Estresse"}:</span>
          <span className="numero text-texto">
            {p.value} · {p.dataKey === "humor" ? HUMOR[p.value as number] : ESTRESSE[p.value as number]}
          </span>
        </p>
      ))}
    </div>
  );
}

export function GraficoHumor({ dados }: { dados: { dia: string; humor: number | null; estresse: number | null }[] }) {
  const ponto = (cor: string) => ({ r: 4, fill: cor, stroke: "#0e1424", strokeWidth: 2 });
  return (
    <div>
      <div className="h-52" role="img" aria-label="Humor e estresse por dia, de 1 a 5, nos últimos 30 dias">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={EIXO} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "3 3" }} content={<Dica />} />
            <Line type="monotone" dataKey="humor" stroke={COR_HUMOR} strokeWidth={2} dot={ponto(COR_HUMOR)} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="estresse" stroke={COR_ESTRESSE} strokeWidth={2} dot={ponto(COR_ESTRESSE)} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: COR_HUMOR }} aria-hidden /> Humor (1 muito mal · 5 muito bem)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded" style={{ background: COR_ESTRESSE }} aria-hidden /> Estresse (1 muito baixo · 5 muito alto)
        </li>
      </ul>
    </div>
  );
}
