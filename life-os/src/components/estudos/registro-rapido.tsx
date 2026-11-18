"use client";
// Registro rápido de estudo (botão central "Registrar"): matéria, minutos e tipo. Os dados vêm de dadosRegistroRapidoEstudos.
import { FormSessao, type MateriaOpcao } from "./formularios";

export function RegistroRapidoEstudo({ hoje, materias }: { hoje: string; materias: MateriaOpcao[] }) {
  return <FormSessao materias={materias} hoje={hoje} compacto />;
}
