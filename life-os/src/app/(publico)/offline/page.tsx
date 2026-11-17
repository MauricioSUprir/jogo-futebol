import { WifiOff } from "lucide-react";

export const metadata = { title: "Sem conexão" };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <div className="painel holo grid grid-cols-1 gap-3 p-6 text-center">
      <WifiOff className="mx-auto h-8 w-8 text-eletrico-claro" aria-hidden />
      <h1 className="font-display text-xl font-semibold">Sem conexão com o servidor</h1>
      <p className="text-sm text-suave">
        O LIFE OS guarda tudo no seu servidor. Confira a internet (ou a VPN Tailscale) e tente de novo.
      </p>
    </div>
  );
}
