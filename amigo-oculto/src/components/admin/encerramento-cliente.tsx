"use client";
import { useState } from "react";
import { Archive, ArchiveRestore, Flag, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Confirmar } from "@/components/admin/confirmar";
import { useAcao } from "@/components/admin/usar-acao";
import { arquivarEvento, encerrarEvento, excluirEvento } from "@/lib/acoes/admin";

export function BotaoEncerrar({ eventoId, podeEncerrar }: { eventoId: string; podeEncerrar: boolean }) {
  const { pendente, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante="ouro" onClick={() => setAberto(true)} disabled={!podeEncerrar}>
        <Flag className="size-4" aria-hidden /> Encerrar o amigo oculto
      </Botao>
      <Confirmar
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Encerrar o amigo oculto?"
        descricao="Todos recebem um aviso, o álbum de memórias abre para as fotos e o sorteio não pode mais ser refeito."
        rotuloConfirmar="Encerrar"
        perigo={false}
        carregando={pendente}
        aoConfirmar={() => executar(() => encerrarEvento(eventoId), { depois: () => setAberto(false) })}
      />
    </>
  );
}

export function BotaoArquivar({ eventoId, arquivado }: { eventoId: string; arquivado: boolean }) {
  const { pendente, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante="contorno" onClick={() => setAberto(true)}>
        {arquivado ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
        {arquivado ? "Desarquivar" : "Arquivar"}
      </Botao>
      <Confirmar
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={arquivado ? "Desarquivar o grupo?" : "Arquivar o grupo?"}
        descricao={
          arquivado
            ? "O grupo volta a funcionar normalmente: chat, convite e sorteio (se ainda não aconteceu)."
            : "O grupo sai de Explorar, para de aceitar gente nova, o chat fica fechado e o sorteio agendado não acontece. Dá para desarquivar depois."
        }
        rotuloConfirmar={arquivado ? "Desarquivar" : "Arquivar"}
        perigo={!arquivado}
        carregando={pendente}
        aoConfirmar={() => executar(() => arquivarEvento(eventoId, !arquivado), { depois: () => setAberto(false) })}
      />
    </>
  );
}

export function BotaoExcluir({ eventoId, nome }: { eventoId: string; nome: string }) {
  const { pendente, executar } = useAcao();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante="perigo" onClick={() => setAberto(true)}>
        <Trash2 className="size-4" aria-hidden /> Excluir o grupo
      </Botao>
      <Confirmar
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Excluir o grupo para sempre?"
        descricao="Some tudo: participantes, sorteio, mensagens, chat, mural, enquetes, jogos e o álbum. Não dá para desfazer."
        rotuloConfirmar="Excluir para sempre"
        carregando={pendente}
        digitar={{ palavra: nome, rotulo: <>Para confirmar, digite o nome do grupo: <strong>{nome}</strong></> }}
        aoConfirmar={() => executar(() => excluirEvento(eventoId, nome))}
      />
    </>
  );
}
