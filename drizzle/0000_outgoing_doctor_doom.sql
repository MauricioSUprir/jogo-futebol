CREATE TYPE "public"."fonte_metrica" AS ENUM('csv', 'manual', 'api');--> statement-breakpoint
CREATE TYPE "public"."formato" AS ENUM('short', 'reel', 'video_longo');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TYPE "public"."plataforma" AS ENUM('youtube', 'instagram', 'tiktok');--> statement-breakpoint
CREATE TYPE "public"."status_ideia" AS ENUM('ideia', 'aprovada', 'descartada');--> statement-breakpoint
CREATE TYPE "public"."status_pipeline" AS ENUM('ideia', 'roteiro', 'gravar', 'editar', 'agendado', 'publicado');--> statement-breakpoint
CREATE TABLE "config" (
	"id" serial PRIMARY KEY NOT NULL,
	"palavras_por_min" integer DEFAULT 150 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conteudos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ideia_id" uuid,
	"titulo_final" text NOT NULL,
	"formato" "formato" DEFAULT 'short' NOT NULL,
	"status_pipeline" "status_pipeline" DEFAULT 'ideia' NOT NULL,
	"plataformas" "plataforma"[] DEFAULT '{}' NOT NULL,
	"data_prevista" date,
	"data_publicacao" date,
	"responsavel" text,
	"checklist" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"pilar_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" text NOT NULL,
	"gancho" text,
	"resumo" text,
	"origem" text,
	"pilar_id" uuid,
	"plataformas" "plataforma"[] DEFAULT '{}' NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"status" "status_ideia" DEFAULT 'ideia' NOT NULL,
	"sugestao_ia_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metricas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publicacao_id" uuid NOT NULL,
	"coletado_em" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"retencao_media" numeric(5, 2),
	"tempo_medio_seg" integer,
	"likes" integer DEFAULT 0 NOT NULL,
	"comentarios" integer DEFAULT 0 NOT NULL,
	"compartilhamentos" integer DEFAULT 0 NOT NULL,
	"salvamentos" integer DEFAULT 0 NOT NULL,
	"seguidores_ganhos" integer DEFAULT 0 NOT NULL,
	"fonte" "fonte_metrica" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metricas_snapshot_unq" UNIQUE("publicacao_id","coletado_em","fonte")
);
--> statement-breakpoint
CREATE TABLE "pilares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"cor" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "publicacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conteudo_id" uuid NOT NULL,
	"plataforma" "plataforma" NOT NULL,
	"url" text,
	"id_externo" text,
	"publicado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "roteiros" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conteudo_id" uuid NOT NULL,
	"versao" integer NOT NULL,
	"blocos" jsonb NOT NULL,
	"legenda" text,
	"hashtags" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roteiros_conteudo_versao_unq" UNIQUE("conteudo_id","versao")
);
--> statement-breakpoint
CREATE TABLE "sugestoes_ia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tema" text NOT NULL,
	"payload_entrada" jsonb NOT NULL,
	"resposta" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"papel" "papel" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "conteudos" ADD CONSTRAINT "conteudos_ideia_id_ideias_id_fk" FOREIGN KEY ("ideia_id") REFERENCES "public"."ideias"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conteudos" ADD CONSTRAINT "conteudos_pilar_id_pilares_id_fk" FOREIGN KEY ("pilar_id") REFERENCES "public"."pilares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideias" ADD CONSTRAINT "ideias_pilar_id_pilares_id_fk" FOREIGN KEY ("pilar_id") REFERENCES "public"."pilares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideias" ADD CONSTRAINT "ideias_sugestao_ia_id_sugestoes_ia_id_fk" FOREIGN KEY ("sugestao_ia_id") REFERENCES "public"."sugestoes_ia"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metricas" ADD CONSTRAINT "metricas_publicacao_id_publicacoes_id_fk" FOREIGN KEY ("publicacao_id") REFERENCES "public"."publicacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicacoes" ADD CONSTRAINT "publicacoes_conteudo_id_conteudos_id_fk" FOREIGN KEY ("conteudo_id") REFERENCES "public"."conteudos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roteiros" ADD CONSTRAINT "roteiros_conteudo_id_conteudos_id_fk" FOREIGN KEY ("conteudo_id") REFERENCES "public"."conteudos"("id") ON DELETE cascade ON UPDATE no action;