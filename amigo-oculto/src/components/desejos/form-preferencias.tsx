"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, Selecao } from "@/components/ui/campos";
import { useAvisos } from "@/components/ui/avisos";
import { CampoEtiquetas } from "@/components/desejos/campo-etiquetas";
import { CORES_SUGERIDAS, LIMITE_CORES, TAMANHOS_CAMISETA, amostraDaCor } from "@/components/desejos/regras";
import { salvarPreferencias } from "@/lib/acoes/desejos";

export type Preferencias = {
  hobbies: string[];
  interests: string[];
  favorite_colors: string[];
  shirt_size: string | null;
  pants_size: string | null;
  shoe_size: string | null;
  dislikes: string[];
  notes: string | null;
};

const SUGESTOES_HOBBIES = ["Leitura", "Cozinhar", "Games", "Futebol", "Música", "Viagens", "Fotografia", "Séries"].map((nome) => ({ nome }));
const SUGESTOES_INTERESSES = ["Café", "Tecnologia", "Moda", "Decoração", "Bem-estar", "Arte", "Pets", "Skincare"].map((nome) => ({ nome }));
const SUGESTOES_NAO_QUERO = ["Perfume", "Chocolate", "Bebida alcoólica", "Meias", "Enfeites", "Roupas"].map((nome) => ({ nome }));

/** Preferências de presente: hobbies, interesses, cores, tamanhos (opcionais), o que não quer e observações. */
export function FormPreferencias({ inicial }: { inicial: Preferencias }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const [hobbies, setHobbies] = useState(inicial.hobbies);
  const [interesses, setInteresses] = useState(inicial.interests);
  const [cores, setCores] = useState(inicial.favorite_colors);
  const [naoQuero, setNaoQuero] = useState(inicial.dislikes);
  const [camiseta, setCamiseta] = useState(inicial.shirt_size ?? "");
  const [calca, setCalca] = useState(inicial.pants_size ?? "");
  const [calcado, setCalcado] = useState(inicial.shoe_size ?? "");
  const [observacoes, setObservacoes] = useState(inicial.notes ?? "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [salvando, iniciar] = useTransition();
  const opcoesCamiseta = TAMANHOS_CAMISETA.includes(camiseta) || !camiseta ? TAMANHOS_CAMISETA : [camiseta, ...TAMANHOS_CAMISETA];

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        iniciar(async () => {
          const r = await salvarPreferencias({ hobbies, interesses, cores, naoQuero, camiseta, calca, calcado, observacoes });
          if (r.ok) {
            setErros({});
            avisar(r.mensagem ?? "Salvo!");
            router.refresh();
          } else {
            setErros(r.campos ?? {});
            avisar(r.erro, "erro");
          }
        });
      }}
    >
      <CampoEtiquetas
        rotulo="Hobbies"
        valores={hobbies}
        aoMudar={setHobbies}
        sugestoes={SUGESTOES_HOBBIES}
        placeholder="Ex.: tricô, trilhas, xadrez"
        dica="O que você gosta de fazer no tempo livre."
      />
      <CampoEtiquetas
        rotulo="Interesses"
        valores={interesses}
        aoMudar={setInteresses}
        sugestoes={SUGESTOES_INTERESSES}
        placeholder="Ex.: astronomia, cafés especiais"
        dica="Assuntos e coisas de que você gosta."
      />
      <CampoEtiquetas
        rotulo="Cores favoritas"
        valores={cores}
        aoMudar={setCores}
        limite={LIMITE_CORES}
        tamanho={30}
        sugestoes={CORES_SUGERIDAS.map((c) => ({ nome: c.nome, cor: c.hex }))}
        amostra={amostraDaCor}
        placeholder="Ex.: verde-água, terracota"
        dica="Toque numa cor sugerida ou escreva qualquer outra."
      />

      <fieldset>
        <legend className="mb-1 text-sm font-semibold">
          Tamanhos <span className="font-normal text-suave">(opcional)</span>
        </legend>
        <p className="mb-3 text-xs text-suave">Só se quiser ganhar roupas ou calçados. Pode deixar em branco.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Selecao rotulo="Camiseta" value={camiseta} onChange={(e) => setCamiseta(e.target.value)} erro={erros.camiseta}>
            <option value="">Não informar</option>
            {opcoesCamiseta.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Selecao>
          <Campo rotulo="Calça" value={calca} onChange={(e) => setCalca(e.target.value)} maxLength={10} placeholder="Ex.: 40 ou M" erro={erros.calca} />
          <Campo
            rotulo="Calçado"
            value={calcado}
            onChange={(e) => setCalcado(e.target.value)}
            maxLength={10}
            inputMode="numeric"
            placeholder="Ex.: 38"
            erro={erros.calcado}
          />
        </div>
      </fieldset>

      <CampoEtiquetas
        rotulo="Presentes que eu não quero"
        valores={naoQuero}
        aoMudar={setNaoQuero}
        tamanho={60}
        tom="rubi"
        sugestoes={SUGESTOES_NAO_QUERO}
        placeholder="Ex.: canecas, perfume doce"
        dica="Alergias, coisas repetidas ou o que você já tem demais."
      />

      <AreaTexto
        rotulo="Observações"
        opcional
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        maxLength={1000}
        rows={3}
        placeholder="Ex.: Prefiro algo útil para a cozinha. Sou alérgica a lã."
        dica={`${observacoes.length}/1000`}
        erro={erros.observacoes}
      />

      <Botao type="submit" variante="esmeralda" carregando={salvando} className="self-start">
        <Save className="size-4" aria-hidden /> Salvar preferências
      </Botao>
    </form>
  );
}
