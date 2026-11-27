"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { normalizarCodigo } from "@/lib/validacao/evento";

/** Campo para digitar um código de convite (8 letras e números) e abrir o convite. */
export function OutroCodigo({ inicial = "", rotulo = "Código do convite" }: { inicial?: string; rotulo?: string }) {
  const router = useRouter();
  const [valor, setValor] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, setIndo] = useState(false);

  function enviar(e: FormEvent) {
    e.preventDefault();
    const c = normalizarCodigo(valor);
    if (!c) {
      setErro("O código tem 8 letras e números, como RW7V3X2H.");
      return;
    }
    setErro(null);
    setIndo(true);
    router.push(`/convite/${c}`);
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 sm:flex-row sm:items-start" noValidate>
      <Campo
        rotulo={rotulo}
        placeholder="Ex.: RW7V3X2H"
        value={valor}
        onChange={(e) => setValor(e.target.value.toUpperCase().replace(/[^A-Z0-9-\s]/g, "").slice(0, 12))}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        erro={erro}
        wrapperClassName="flex-1"
        className="font-mono text-lg tracking-[0.2em]"
        maxLength={12}
      />
      <Botao type="submit" tamanho="m" carregando={indo} className="h-12 sm:mt-[1.6rem]">
        Abrir convite <ArrowRight className="size-4" aria-hidden />
      </Botao>
    </form>
  );
}
