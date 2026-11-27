import { BotaoLink } from "@/components/ui/botao";

// Provisório: a landing completa entra na etapa de funcionalidades.
export default function Inicio() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center">
      <h1 className="font-titulo text-5xl font-semibold">Amigo Oculto</h1>
      <div className="mt-8 flex justify-center gap-3">
        <BotaoLink href="/criar">Criar amigo oculto</BotaoLink>
      </div>
    </section>
  );
}
