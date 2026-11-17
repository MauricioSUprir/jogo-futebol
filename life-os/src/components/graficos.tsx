"use client";
// Gráficos (Recharts). Paleta validada para daltonismo no fundo escuro (#0e1424):
// série 1 azul #3987e5, série 2 água #199e70 (ΔE CVD 19,6; contraste ≥ 3:1).
// Barras finas (≤ 24 px) com ponta arredondada de 4 px, grade de 1 px sólida e discreta, uma escala só.
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COR_1 = "#3987e5";
const COR_2 = "#199e70";
const GRADE = "rgb(148 163 184 / 0.12)";
const EIXO = { fill: "#94a3b8", fontSize: 11 };
const litros = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L` : `${v}`);
/** Marcas do eixo em degraus redondos (500 ml, 1 L…). */
function marcas(max: number): number[] {
  const passo = max <= 1000 ? 250 : max <= 3000 ? 500 : 1000;
  const topo = Math.max(passo, Math.ceil(max / passo) * passo);
  return Array.from({ length: topo / passo + 1 }, (_, i) => i * passo).filter((v, i, a) => a.length <= 7 || i % 2 === 0 || v === topo);
}

function CaixaDica({ active, payload, label, unidade }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; unidade: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-borda-forte bg-painel-2/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="mb-1 font-medium text-texto">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-suave">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} aria-hidden />
          <span>{p.name}:</span>
          <span className="numero text-texto">
            {Number(p.value).toLocaleString("pt-BR")}
            {unidade}
          </span>
        </p>
      ))}
    </div>
  );
}

function Legenda({ itens }: { itens: { nome: string; cor: string }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
      {itens.map((i) => (
        <li key={i.nome} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.cor }} aria-hidden />
          {i.nome}
        </li>
      ))}
    </ul>
  );
}

/** Semana: % de hábitos feitos e % da meta de água, por dia (mesma escala 0–100%). */
export function GraficoSemana({ dados }: { dados: { dia: string; habitos: number; agua: number }[] }) {
  return (
    <div>
      <div className="h-44" role="img" aria-label="Hábitos feitos e meta de água por dia, em porcentagem, nos últimos 7 dias">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} barGap={2} barCategoryGap="22%" margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid vertical={false} stroke={GRADE} />
            <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={EIXO} axisLine={false} tickLine={false} unit="%" />
            <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.06)" }} content={<CaixaDica unidade="%" />} />
            <Bar dataKey="habitos" name="Hábitos" fill={COR_1} radius={[4, 4, 0, 0]} maxBarSize={14} />
            <Bar dataKey="agua" name="Água" fill={COR_2} radius={[4, 4, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legenda itens={[{ nome: "Hábitos feitos", cor: COR_1 }, { nome: "Meta de água", cor: COR_2 }]} />
    </div>
  );
}

/** Água por dia (ml) com a linha da meta. */
export function GraficoAguaDias({ dados, meta }: { dados: { dia: string; ml: number }[]; meta: number }) {
  const ticks = marcas(Math.max(meta, ...dados.map((d) => d.ml)) * 1.08);
  return (
    <div className="h-52" role="img" aria-label={`Água por dia, em ml; meta de ${meta} ml`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} barCategoryGap="28%" margin={{ top: 14, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="dia" tick={EIXO} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
          <YAxis domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tick={EIXO} axisLine={false} tickLine={false} tickFormatter={litros} />
          <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.06)" }} content={<CaixaDica unidade=" ml" />} />
          <ReferenceLine y={meta} stroke="#94a3b8" strokeWidth={1} label={{ value: "Meta", position: "insideTopRight", fill: "#94a3b8", fontSize: 11 }} />
          <Bar dataKey="ml" name="Água" fill={COR_1} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Água por hora do dia (regularidade). */
export function GraficoHoras({ dados }: { dados: { hora: string; ml: number }[] }) {
  return (
    <div className="h-40" role="img" aria-label="Água por hora do dia nos últimos 14 dias">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} barCategoryGap="18%" margin={{ top: 6, right: 4, bottom: 0, left: -14 }}>
          <CartesianGrid vertical={false} stroke={GRADE} />
          <XAxis dataKey="hora" tick={EIXO} axisLine={false} tickLine={false} interval={2} />
          <YAxis tick={EIXO} axisLine={false} tickLine={false} tickFormatter={litros} allowDecimals={false} />
          <Tooltip cursor={{ fill: "rgb(148 163 184 / 0.06)" }} content={<CaixaDica unidade=" ml" />} />
          <Bar dataKey="ml" name="Água" fill={COR_1} radius={[4, 4, 0, 0]} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
