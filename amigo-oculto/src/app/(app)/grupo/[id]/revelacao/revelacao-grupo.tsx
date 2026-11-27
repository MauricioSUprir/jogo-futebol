"use client";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";
import { RevelacaoCinematografica, type PessoaRevelada } from "@/components/revelacao/revelacao-cinematografica";
import { ResultadoProtegido } from "@/components/revelacao/resultado-protegido";
import { AtalhosRevelacao } from "@/components/revelacao/atalhos-revelacao";
import { useAvisos } from "@/components/ui/avisos";
import { marcarResultadoVisto } from "@/lib/acoes/revelacao";

/**
 * Revelação do grupo: na primeira vez, a animação completa (e grava "visto" no fim); depois, o resultado protegido
 * ("Toque para mostrar"), com a opção de ver a animação de novo. O estado fica aqui, então um refresh do servidor
 * (por exemplo, depois de marcar "visto") não interrompe a animação.
 */
export function RevelacaoDoGrupo({
  eventoId,
  pessoa,
  jaVisto,
  presenteComprado,
  detalhes,
}: {
  eventoId: string;
  pessoa: PessoaRevelada;
  jaVisto: boolean;
  presenteComprado: boolean;
  detalhes: ReactNode;
}) {
  const [modo, setModo] = useState<"animacao" | "protegido">(jaVisto ? "protegido" : "animacao");
  const [rodada, setRodada] = useState(0);
  const [revelou, setRevelou] = useState(jaVisto);
  const gravado = useRef(jaVisto);
  const { avisar } = useAvisos();

  const aoRevelar = useCallback(() => {
    setRevelou(true);
    if (gravado.current) return;
    gravado.current = true;
    void marcarResultadoVisto(eventoId).then((r) => {
      if (!r.ok) {
        gravado.current = false;
        avisar(r.erro, "erro");
      }
    });
  }, [eventoId, avisar]);

  return (
    <div className="flex flex-col gap-5">
      {modo === "animacao" ? (
        <RevelacaoCinematografica
          key={rodada}
          pessoa={pessoa}
          aoRevelar={aoRevelar}
          aoEsconder={() => setModo("protegido")}
          selo={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/85 ring-1 ring-white/15">
              <Lock className="size-3.5" aria-hidden /> Só você vê isto
            </span>
          }
        >
          {detalhes}
        </RevelacaoCinematografica>
      ) : (
        <ResultadoProtegido
          pessoa={pessoa}
          aoVerAnimacao={() => {
            setRodada((r) => r + 1);
            setModo("animacao");
          }}
        >
          {detalhes}
        </ResultadoProtegido>
      )}
      {revelou ? <AtalhosRevelacao eventoId={eventoId} comprado={presenteComprado} /> : null}
    </div>
  );
}
