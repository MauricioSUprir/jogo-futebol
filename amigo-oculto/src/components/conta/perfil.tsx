"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Save, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { useAvisos } from "@/components/ui/avisos";
import { MensagemResultado, erroDoCampo } from "@/components/contas/partes";
import { enviarMidia } from "@/lib/imagem";
import { atualizarPerfil, definirFotoPerfil } from "@/lib/acoes/perfil";
import { useAcaoFormulario } from "@/components/conta/usar-acao";

/** Foto de perfil: enviada já reduzida (512 px, WebP) para a pasta da pessoa; a antiga é apagada no servidor. */
export function FotoPerfil({ nome, caminho }: { nome: string; caminho: string | null }) {
  const router = useRouter();
  const { avisar } = useAvisos();
  const entrada = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState<"enviando" | "removendo" | null>(null);

  async function trocar(arquivo: File | undefined) {
    if (!arquivo) return;
    setOcupado("enviando");
    try {
      const novo = await enviarMidia(arquivo, "avatar", 512);
      const r = await definirFotoPerfil(novo);
      if (r.ok) {
        avisar(r.mensagem ?? "Foto atualizada!");
        router.refresh();
      } else avisar(r.erro, "erro");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível enviar a foto.", "erro");
    } finally {
      setOcupado(null);
    }
  }

  async function remover() {
    setOcupado("removendo");
    const r = await definirFotoPerfil(null);
    setOcupado(null);
    if (r.ok) {
      avisar(r.mensagem ?? "Foto removida.");
      router.refresh();
    } else avisar(r.erro, "erro");
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div className="relative">
        <Avatar nome={nome} caminho={caminho} tamanho={112} anel />
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={!!ocupado}
          aria-label="Trocar foto de perfil"
          className="absolute -bottom-1 -right-1 inline-flex size-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--t1),color-mix(in_oklab,var(--t1)_70%,black))] text-white shadow-lg ring-4 ring-[var(--fundo)] transition hover:scale-105 disabled:opacity-60"
        >
          <Camera className="size-5" aria-hidden />
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 sm:items-start">
        <input
          ref={entrada}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void trocar(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <Botao variante="contorno" tamanho="p" onClick={() => entrada.current?.click()} carregando={ocupado === "enviando"}>
            <Camera className="size-4" aria-hidden /> {caminho ? "Trocar foto" : "Enviar foto"}
          </Botao>
          {caminho ? (
            <Botao variante="fantasma" tamanho="p" onClick={remover} carregando={ocupado === "removendo"} className="text-rubi">
              <Trash2 className="size-4" aria-hidden /> Remover
            </Botao>
          ) : null}
        </div>
        <p className="text-center text-xs text-suave sm:text-left">JPG, PNG ou WebP. Ela aparece para as pessoas dos seus grupos.</p>
      </div>
    </div>
  );
}

/** Nome, apelido e bio. */
export function FormPerfil({ nome, apelido, bio }: { nome: string; apelido: string | null; bio: string | null }) {
  const router = useRouter();
  const [tamanhoBio, setTamanhoBio] = useState((bio ?? "").length);
  const { estado, enviando, aoEnviar } = useAcaoFormulario(atualizarPerfil, (r) => r.ok && router.refresh());
  return (
    <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo name="nome" rotulo="Nome" defaultValue={nome} maxLength={60} required autoComplete="name" erro={erroDoCampo(estado, "nome")} />
        <Campo
          name="apelido"
          rotulo="Apelido"
          opcional
          defaultValue={apelido ?? ""}
          maxLength={40}
          autoComplete="nickname"
          placeholder="Como gostam de te chamar"
          erro={erroDoCampo(estado, "apelido")}
        />
      </div>
      <AreaTexto
        name="bio"
        rotulo="Sobre você"
        opcional
        defaultValue={bio ?? ""}
        maxLength={280}
        rows={3}
        onChange={(e) => setTamanhoBio(e.target.value.length)}
        placeholder="Uma frase sobre você — ajuda quem te tirar a acertar no presente."
        dica={`${tamanhoBio}/280`}
        erro={erroDoCampo(estado, "bio")}
      />
      <MensagemResultado estado={estado} />
      <Botao type="submit" carregando={enviando} className="self-start">
        <Save className="size-4" aria-hidden /> Salvar perfil
      </Botao>
    </form>
  );
}
