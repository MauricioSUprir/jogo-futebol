import { Logo } from "@/components/logo";

export default function LayoutPublico({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid grid-cols-1 min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo tamanho="g" />
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-apagado">Sistema privado · seus dados ficam no seu servidor</p>
      </div>
    </main>
  );
}
