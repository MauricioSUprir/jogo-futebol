"use client";
import { useMemo } from "react";
import { FlaskConical, Gift, Users } from "lucide-react";
import { RevelacaoCinematografica } from "@/components/revelacao/revelacao-cinematografica";
import { DetalhesDaPessoa, type ItemDesejo, type PreferenciasPessoa } from "@/components/revelacao/detalhes-pessoa";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { Cartao } from "@/components/ui/cartao";
import { perfilDoBanco, sugerirPresentes } from "@/lib/sugestoes";

/**
 * O "palco" da demonstração (carregado só quando alguém pede a revelação): a mesma revelação cinematográfica da
 * página real, com uma lista de desejos e preferências DE EXEMPLO e as ideias calculadas pelo mesmo motor.
 */
const ORCAMENTO_DEMO = { min: 50, max: 100 };

type Exemplo = { bio: string; desejos: Omit<ItemDesejo, "id">[]; prefs: NonNullable<PreferenciasPessoa> };

const EXEMPLOS: Exemplo[] = [
  {
    bio: "Viciada em café e em livros de suspense.",
    desejos: [
      { title: "Livro de suspense", notes: "De preferência um lançamento.", price_estimate: 60 },
      { title: "Caneca térmica", notes: "Verde, se tiver.", price_estimate: 80 },
    ],
    prefs: { hobbies: ["leitura", "café"], interests: ["séries"], favorite_colors: ["verde"], shirt_size: "M", dislikes: ["perfume"] },
  },
  {
    bio: "Joga no fim de semana e maratona séries de madrugada.",
    desejos: [
      { title: "Mousepad grande", price_estimate: 70 },
      { title: "Cartão-presente da loja de jogos", notes: "Qualquer valor ajuda!", price_estimate: 100 },
    ],
    prefs: { hobbies: ["games", "séries"], interests: ["anime"], favorite_colors: ["preto", "roxo"], shirt_size: "G", shoe_size: "42" },
  },
  {
    bio: "Mãe de planta, faz yoga todo dia de manhã.",
    desejos: [
      { title: "Vaso autoirrigável", price_estimate: 70 },
      { title: "Tapete de yoga", notes: "O meu está gasto.", price_estimate: 150 },
    ],
    prefs: { hobbies: ["plantas", "yoga"], interests: ["chá"], favorite_colors: ["lilás"], dislikes: ["chocolate"], notes: "Não bebe álcool." },
  },
  {
    bio: "Churrasqueiro oficial da família e torcedor fanático.",
    desejos: [
      { title: "Kit churrasco", price_estimate: 120 },
      { title: "Camisa do time", notes: "Tamanho G.", price_estimate: 300 },
    ],
    prefs: { hobbies: ["churrasco", "futebol"], interests: ["cerveja artesanal"], favorite_colors: ["vermelho"], shirt_size: "G" },
  },
  {
    bio: "Sempre com a mala pronta e a câmera na mão.",
    desejos: [
      { title: "Filmes para câmera instantânea", price_estimate: 90 },
      { title: "Mapa-múndi de raspar", price_estimate: 80 },
    ],
    prefs: { hobbies: ["viagem", "fotografia"], interests: ["praia"], favorite_colors: ["azul"] },
  },
  {
    bio: "Ama um dia de spa em casa e um chocolate bom.",
    desejos: [
      { title: "Kit de banho relaxante", price_estimate: 90 },
      { title: "Pijama confortável", notes: "Tamanho P.", price_estimate: 130 },
    ],
    prefs: { hobbies: ["autocuidado", "chocolate"], interests: ["cinema"], favorite_colors: ["rosa"], shirt_size: "P", dislikes: ["perfume"] },
  },
];

export function PalcoDemonstracao({
  sorteado,
  indice,
  aoTrocar,
}: {
  sorteado: string;
  /** escolhe o exemplo de lista e de preferências (estável para a mesma pessoa) */
  indice: number;
  aoTrocar: () => void;
}) {
  const exemplo = EXEMPLOS[indice % EXEMPLOS.length];
  const desejos = useMemo(() => exemplo.desejos.map((d, i) => ({ ...d, id: `exemplo-${indice}-${i}` })), [exemplo, indice]);
  const sugestoes = useMemo(
    () => sugerirPresentes(perfilDoBanco(exemplo.prefs, desejos), ORCAMENTO_DEMO, { quantidade: 6 }),
    [exemplo, desejos],
  );

  return (
    <RevelacaoCinematografica
      pessoa={{ nome: sorteado, bio: exemplo.bio }}
      selo={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2cf6b] px-3 py-1 text-xs font-bold text-[#3b2a06]">
          <FlaskConical className="size-3.5" aria-hidden /> Demonstração: nada é salvo
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="vidro rounded-2xl px-4 py-3 text-sm">
          A lista de desejos e as preferências abaixo são <strong>de exemplo</strong>. No amigo oculto de verdade, aparecem as que {sorteado}{" "}
          preencheu, e as ideias são calculadas para o valor que o grupo combinou (aqui: R$ 50 a R$ 100).
        </p>
        <DetalhesDaPessoa
          nome={sorteado}
          desejos={desejos}
          prefs={exemplo.prefs}
          sugestoes={sugestoes}
          orcamento="R$ 50 a R$ 100"
          orcamentoMax={ORCAMENTO_DEMO.max}
        />
        <Cartao forte className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
          <Gift className="size-10 shrink-0 text-t1" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-titulo text-xl font-semibold">Gostou? Faça o seu de verdade</p>
            <p className="text-sm text-suave">Convite por link, QR Code e WhatsApp, e o sorteio guardado em segredo para cada um.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto">
            <BotaoLink href="/criar" brilho>
              Criar amigo oculto
            </BotaoLink>
            <Botao variante="vidro" onClick={aoTrocar}>
              <Users className="size-4" aria-hidden />
              Ver de outra pessoa
            </Botao>
          </div>
        </Cartao>
      </div>
    </RevelacaoCinematografica>
  );
}
