"use client";
import { useState } from "react";
import { Download, ShieldAlert, Trash2 } from "lucide-react";
import { Botao, classesBotao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { Dialogo } from "@/components/ui/dialogo";
import { MensagemResultado, erroDoCampo } from "@/components/contas/partes";
import { excluirMinhaConta } from "@/lib/acoes/perfil";
import { useAcaoFormulario } from "@/components/conta/usar-acao";

/** LGPD: baixar os próprios dados (JSON) e excluir a conta. */
export function PrivacidadeDados({ convidado }: { convidado: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const { estado, enviando, aoEnviar, limpar } = useAcaoFormulario(excluirMinhaConta);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">Exportar meus dados</p>
          <p className="text-sm text-suave">Um arquivo JSON com seu perfil, configurações, lista de desejos, grupos e mensagens que você escreveu.</p>
        </div>
        <a href="/api/meus-dados" download className={classesBotao("contorno", "p", "shrink-0 self-start sm:self-auto")}>
          <Download className="size-4" aria-hidden /> Baixar meus dados
        </a>
      </div>
      <div className="h-px bg-borda" />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-rubi">Excluir conta</p>
          <p className="text-sm text-suave">Apaga sua conta e seus dados de vez. Não dá para desfazer.</p>
        </div>
        <Botao variante="perigo" tamanho="p" className="shrink-0 self-start sm:self-auto" onClick={() => setAberto(true)}>
          <Trash2 className="size-4" aria-hidden /> Excluir conta
        </Botao>
      </div>

      <Dialogo
        aberto={aberto}
        aoFechar={() => {
          setAberto(false);
          setTexto("");
          limpar();
        }}
        titulo="Excluir sua conta?"
        descricao="Leia com atenção: a exclusão é permanente."
      >
        <form onSubmit={aoEnviar} noValidate className="flex flex-col gap-4">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
            <li>
              Apagamos seu perfil, foto, {convidado ? "" : "e-mail de acesso, "}lista de desejos, preferências, notificações e sua participação
              nos grupos (com as mensagens e os recados que você escreveu).
            </li>
            <li>
              <strong>Não dá para excluir</strong> enquanto você estiver num sorteio em andamento: espere o amigo oculto terminar (assim
              ninguém fica sem presente).
            </li>
            <li>
              Se você <strong>organiza</strong> um grupo ativo, arquive ou exclua o grupo antes.
            </li>
            <li>Os grupos que você criou e já terminaram continuam para os outros participantes, sem o seu nome como criador.</li>
            <li>Quer guardar uma cópia? Baixe seus dados antes.</li>
          </ul>
          <Campo
            name="confirmacao"
            rotulo={
              <>
                Digite <strong>EXCLUIR</strong> para confirmar
              </>
            }
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            erro={erroDoCampo(estado, "confirmacao")}
          />
          <MensagemResultado estado={estado} />
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Botao variante="fantasma" onClick={() => setAberto(false)} disabled={enviando}>
              Cancelar
            </Botao>
            <Botao type="submit" variante="perigo" carregando={enviando} disabled={texto !== "EXCLUIR"}>
              <ShieldAlert className="size-4" aria-hidden /> Excluir minha conta
            </Botao>
          </div>
        </form>
      </Dialogo>
    </div>
  );
}
