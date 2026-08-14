import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * Chamada à Claude API — SOMENTE no servidor. A chave nunca vai para o client.
 * Saída forçada em JSON estruturado via tool_choice (compatível com claude-sonnet-4-6),
 * validada com Zod. Guardrail: a IA nunca inventa métricas.
 */

const MODELO = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

const itemZ = z.object({ texto: z.string(), justificativa: z.string() });
const blocoZ = z.object({ conteudo: z.string(), justificativa: z.string() });

export const sugestaoRespostaSchema = z.object({
  temSuficiente: z.boolean(),
  aviso: z.string().nullable().optional(),
  ganchos: z.array(itemZ).min(1),
  estrutura: z.object({
    gancho: blocoZ,
    contexto: blocoZ,
    desenvolvimento: blocoZ,
    climax: blocoZ,
    cta: blocoZ,
  }),
  titulos: z.array(itemZ).min(1),
  cta: itemZ,
});

export type SugestaoResposta = z.infer<typeof sugestaoRespostaSchema>;

// JSON Schema da tool (força a estrutura de saída).
const toolInputSchema = {
  type: "object" as const,
  properties: {
    temSuficiente: {
      type: "boolean",
      description: "true se havia >= 5 vídeos com métricas nos dados fornecidos.",
    },
    aviso: {
      type: "string",
      description: "Quando os dados são insuficientes, texto curto avisando que as sugestões se baseiam apenas no tema.",
    },
    ganchos: {
      type: "array",
      description: "Exatamente 5 ganchos (hooks) alternativos.",
      items: {
        type: "object",
        properties: { texto: { type: "string" }, justificativa: { type: "string" } },
        required: ["texto", "justificativa"],
      },
    },
    estrutura: {
      type: "object",
      description: "Uma estrutura de roteiro sugerida, bloco a bloco.",
      properties: {
        gancho: bloco(),
        contexto: bloco(),
        desenvolvimento: bloco(),
        climax: bloco(),
        cta: bloco(),
      },
      required: ["gancho", "contexto", "desenvolvimento", "climax", "cta"],
    },
    titulos: {
      type: "array",
      description: "Exatamente 3 títulos.",
      items: {
        type: "object",
        properties: { texto: { type: "string" }, justificativa: { type: "string" } },
        required: ["texto", "justificativa"],
      },
    },
    cta: {
      type: "object",
      description: "1 sugestão de CTA.",
      properties: { texto: { type: "string" }, justificativa: { type: "string" } },
      required: ["texto", "justificativa"],
    },
  },
  required: ["temSuficiente", "ganchos", "estrutura", "titulos", "cta"],
};

function bloco() {
  return {
    type: "object",
    properties: { conteudo: { type: "string" }, justificativa: { type: "string" } },
    required: ["conteudo", "justificativa"],
  };
}

export interface VideoReferencia {
  titulo: string;
  gancho: string | null;
  pilar: string | null;
  formato: string;
  plataforma: string;
  metricas: {
    views: number;
    retencaoMedia: number | null;
    tempoMedioSeg: number | null;
    likes: number;
    comentarios: number;
    compartilhamentos: number;
    salvamentos: number;
    seguidoresGanhos: number;
  };
}

const SYSTEM = `Você é um estrategista de conteúdo em vídeo para uma criadora que publica em YouTube, Instagram (Reels) e TikTok. Idioma: pt-BR.

Regras invioláveis:
- NUNCA invente números de performance. Use APENAS as métricas fornecidas nos dados de referência.
- Cada justificativa deve estar ancorada nos dados dos vídeos de referência (ex.: "o vídeo X teve retenção de 82%, então..."). Se não houver dados suficientes, diga isso explicitamente na justificativa e baseie-se em boas práticas gerais + o tema.
- Se houver MENOS de 5 vídeos com métricas, defina temSuficiente=false, preencha o campo "aviso" avisando que as sugestões se baseiam apenas no tema, e não finja que existem dados robustos.
- Produza exatamente 5 ganchos, 3 títulos, 1 estrutura de roteiro (gancho, contexto, desenvolvimento, clímax/entrega, CTA) e 1 CTA.
- Ganchos curtos e fortes (0–3s). Títulos otimizados para clique honesto.

Responda SOMENTE chamando a ferramenta "registrar_sugestoes".`;

export async function gerarSugestoes(params: {
  tema: string;
  temSuficiente: boolean;
  videos: VideoReferencia[];
}): Promise<{ resposta: SugestaoResposta; payloadEntrada: unknown }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");

  const client = new Anthropic({ apiKey });

  const contexto = params.videos.length
    ? params.videos
        .map(
          (v, i) =>
            `${i + 1}. "${v.titulo}" [${v.plataforma}/${v.formato}] pilar=${v.pilar ?? "—"} | gancho: ${v.gancho ?? "—"} | views=${v.metricas.views} retenção=${v.metricas.retencaoMedia ?? "—"}% tempoMédio=${v.metricas.tempoMedioSeg ?? "—"}s likes=${v.metricas.likes} comentários=${v.metricas.comentarios} compart=${v.metricas.compartilhamentos} salvos=${v.metricas.salvamentos} seguidores=${v.metricas.seguidoresGanhos}`,
        )
        .join("\n")
    : "(nenhum vídeo com métricas disponível)";

  const userMsg = `TEMA A EXPLORAR: ${params.tema}

DADOS: ${params.temSuficiente ? "há dados suficientes (>=5 vídeos com métricas)." : "DADOS INSUFICIENTES (menos de 5 vídeos com métricas) — baseie-se no tema e avise."}

VÍDEOS DE MELHOR PERFORMANCE (referência, use apenas estes números):
${contexto}

Gere as sugestões ancoradas nesses dados.`;

  const payloadEntrada = { tema: params.tema, temSuficiente: params.temSuficiente, videos: params.videos };

  const msg = await client.messages.create({
    model: MODELO,
    max_tokens: 4000,
    system: SYSTEM,
    tools: [
      {
        name: "registrar_sugestoes",
        description: "Registra as sugestões de roteiro em formato estruturado.",
        input_schema: toolInputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "registrar_sugestoes" },
    messages: [{ role: "user", content: userMsg }],
  });

  const toolUse = msg.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("A IA não retornou dados estruturados.");
  }

  const validado = sugestaoRespostaSchema.safeParse(toolUse.input);
  if (!validado.success) {
    throw new Error("Resposta da IA em formato inesperado: " + validado.error.issues[0]?.message);
  }

  // Reforça o gate server-side (a IA não decide sozinha).
  const resposta: SugestaoResposta = { ...validado.data, temSuficiente: params.temSuficiente };
  if (!params.temSuficiente && !resposta.aviso) {
    resposta.aviso = "Menos de 5 vídeos com métricas — sugestões baseadas apenas no tema.";
  }

  return { resposta, payloadEntrada };
}
