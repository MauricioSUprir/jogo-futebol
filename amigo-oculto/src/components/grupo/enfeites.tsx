import type { Tema } from "@/lib/temas";

/** Enfeites decorativos (SVG) do tema, para capas sem foto. Puramente visuais (aria-hidden). */
export function EnfeitesTema({ tema }: { tema: Tema | string }) {
  const estrelas = [
    [32, 26, 14], [88, 72, 9], [152, 22, 11], [224, 50, 7], [288, 19, 13], [352, 62, 10], [256, 89, 8], [56, 94, 7], [376, 29, 6],
  ];
  return (
    <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox="0 0 400 120" preserveAspectRatio="xMidYMid slice">
      {estrelas.map(([x, y, s], i) => (
        <g key={i} className="cintilar" style={{ ["--duracao" as string]: `${2 + (i % 4) * 0.7}s`, transformOrigin: `${x}px ${y}px` }}>
          <path
            d={`M${x} ${y - s / 2} L${x + s / 7} ${y - s / 7} L${x + s / 2} ${y} L${x + s / 7} ${y + s / 7} L${x} ${y + s / 2} L${x - s / 7} ${y + s / 7} L${x - s / 2} ${y} L${x - s / 7} ${y - s / 7} Z`}
            fill="#f7d983"
            opacity=".8"
          />
        </g>
      ))}
      {tema === "aniversario"
        ? [[72, 48, "#ff8fb8"], [328, 43, "#c8a6ff"], [200, 77, "#ffd27a"]].map(([x, y, c], i) => (
            <g key={`b${i}`} className="flutuar" style={{ ["--duracao" as string]: `${5 + i}s` }}>
              <ellipse cx={x as number} cy={y as number} rx="6" ry="7.5" fill={c as string} opacity=".9" />
              <path d={`M${x} ${(y as number) + 7.5} q -2 6 1 12`} stroke="#fff" strokeWidth=".4" fill="none" />
            </g>
          ))
        : null}
      {tema === "natal"
        ? [[120, 41], [280, 79], [344, 96], [40, 70]].map(([x, y], i) => (
            <g key={`f${i}`} stroke="#ffffff" strokeWidth=".6" opacity=".7" className="flutuar" style={{ ["--duracao" as string]: `${6 + i}s` }}>
              <path d={`M${x - 3} ${y} H${x + 3} M${x} ${y - 3} V${y + 3} M${x - 2} ${y - 2} L${x + 2} ${y + 2} M${x + 2} ${y - 2} L${x - 2} ${y + 2}`} />
            </g>
          ))
        : null}
    </svg>
  );
}
