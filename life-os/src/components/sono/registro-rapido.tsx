"use client";
// Registro rápido da noite (botão central "Registrar"): horário de dormir, de acordar e a qualidade.
// Os dados vêm de dadosRegistroRapidoSono (lib/servidor/sono.ts).
import Link from "next/link";
import { FormNoite } from "./formularios";

export function RegistroRapidoSono({
  hoje,
  deitou,
  acordou,
  qualidade,
  jaRegistrada,
}: {
  hoje: string;
  deitou: string;
  acordou: string;
  qualidade: number | null;
  jaRegistrada: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      <p className="text-xs text-suave">
        {jaRegistrada ? "A noite de hoje já está registrada; salvar atualiza os horários e a qualidade." : "A noite que terminou hoje."}{" "}
        <Link href="/sono" className="text-eletrico-claro hover:underline">
          Mais detalhes no Sleep Lab
        </Link>
      </p>
      <FormNoite hoje={hoje} compacto noite={{ dia: hoje, deitou, acordou, latenciaMin: null, despertares: null, qualidade, notas: null }} />
    </div>
  );
}
