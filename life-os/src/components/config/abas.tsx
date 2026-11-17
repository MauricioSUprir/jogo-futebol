import Link from "next/link";

export function AbasConfig({ atual }: { atual: "perfil" | "seguranca" | "dados" }) {
  const abas = [
    { k: "perfil", nome: "Perfil", href: "/configuracoes" },
    { k: "seguranca", nome: "Segurança", href: "/configuracoes/seguranca" },
    { k: "dados", nome: "Dados e backup", href: "/configuracoes/dados" },
  ];
  return (
    <nav aria-label="Configurações" className="mb-5 flex w-full max-w-md rounded-xl border border-borda bg-fundo-2/60 p-1">
      {abas.map((a) => (
        <Link
          key={a.k}
          href={a.href}
          aria-current={atual === a.k ? "page" : undefined}
          className="flex-1 rounded-lg py-1.5 text-center text-sm text-suave transition aria-[current=page]:bg-eletrico/20 aria-[current=page]:text-texto"
        >
          {a.nome}
        </Link>
      ))}
    </nav>
  );
}
