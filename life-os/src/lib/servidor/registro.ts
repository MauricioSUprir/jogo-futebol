// Registro de acessos (Security → "Registro de acessos").
import { db } from "@/lib/db";
import { dadosDaRequisicao } from "./requisicao";

export const EVENTOS_ACESSO: Record<string, string> = {
  conta_criada: "Conta criada",
  entrou: "Entrou",
  entrou_codigo_recuperacao: "Entrou com código de recuperação",
  senha_errada: "Senha errada",
  codigo_errado: "Código do autenticador errado",
  bloqueado: "Tentativa bloqueada (muitas tentativas)",
  saiu: "Saiu",
  sessao_encerrada: "Sessão encerrada",
  outras_sessoes_encerradas: "Outras sessões encerradas",
  senha_trocada: "Senha trocada",
  dois_fatores_ligado: "Verificação em duas etapas ligada",
  dois_fatores_desligado: "Verificação em duas etapas desligada",
  codigos_recuperacao_novos: "Novos códigos de recuperação",
  dados_exportados: "Dados exportados",
  perfil_alterado: "Perfil alterado",
  diario_senha_ligada: "Senha extra do diário ligada",
  diario_senha_trocada: "Senha do diário trocada",
  diario_senha_desligada: "Senha extra do diário desligada",
  diario_destrancado: "Diário destrancado",
  diario_senha_errada: "Senha do diário errada",
  diario_bloqueado: "Diário: muitas tentativas",
  diario_apagado: "Diário apagado",
  documento_enviado: "Documento de saúde enviado",
  documento_baixado: "Documento de saúde baixado",
};

export async function registrarAcesso(userId: string | null, event: string, detail?: string) {
  const { ip, userAgent } = await dadosDaRequisicao();
  await db.accessLog.create({ data: { userId, event, detail: detail?.slice(0, 300), ip, userAgent } });
}
