import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  timestamp,
  date,
  jsonb,
  pgEnum,
  unique,
  serial,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ---------- Enums ----------
export const papelEnum = pgEnum("papel", ["admin", "editor"]);
export const statusIdeiaEnum = pgEnum("status_ideia", ["ideia", "aprovada", "descartada"]);
export const formatoEnum = pgEnum("formato", ["short", "reel", "video_longo"]);
export const statusPipelineEnum = pgEnum("status_pipeline", [
  "ideia",
  "roteiro",
  "gravar",
  "editar",
  "agendado",
  "publicado",
]);
export const plataformaEnum = pgEnum("plataforma", ["youtube", "instagram", "tiktok"]);
export const fonteMetricaEnum = pgEnum("fonte_metrica", ["csv", "manual", "api"]);

// ---------- Tabelas ----------
export const usuarios = pgTable("usuarios", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  papel: papelEnum("papel").notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pilares = pgTable("pilares", {
  id: uuid("id").defaultRandom().primaryKey(),
  nome: text("nome").notNull(),
  descricao: text("descricao"),
  cor: text("cor").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sugestoesIa = pgTable("sugestoes_ia", {
  id: uuid("id").defaultRandom().primaryKey(),
  tema: text("tema").notNull(),
  payloadEntrada: jsonb("payload_entrada").notNull(),
  resposta: jsonb("resposta").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ideias = pgTable("ideias", {
  id: uuid("id").defaultRandom().primaryKey(),
  titulo: text("titulo").notNull(),
  gancho: text("gancho"),
  resumo: text("resumo"),
  origem: text("origem"),
  pilarId: uuid("pilar_id").references(() => pilares.id, { onDelete: "set null" }),
  plataformas: plataformaEnum("plataformas").array().notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  status: statusIdeiaEnum("status").notNull().default("ideia"),
  sugestaoIaId: uuid("sugestao_ia_id").references(() => sugestoesIa.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const conteudos = pgTable("conteudos", {
  id: uuid("id").defaultRandom().primaryKey(),
  ideiaId: uuid("ideia_id").references(() => ideias.id, { onDelete: "set null" }),
  tituloFinal: text("titulo_final").notNull(),
  formato: formatoEnum("formato").notNull().default("short"),
  statusPipeline: statusPipelineEnum("status_pipeline").notNull().default("ideia"),
  plataformas: plataformaEnum("plataformas").array().notNull().default([]),
  dataPrevista: date("data_prevista"),
  dataPublicacao: date("data_publicacao"),
  responsavel: text("responsavel"),
  // { thumbnail: bool, legenda: bool, trilha: bool, cta: bool }
  checklist: jsonb("checklist").notNull().default({}),
  ordem: integer("ordem").notNull().default(0),
  pilarId: uuid("pilar_id").references(() => pilares.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roteiros = pgTable(
  "roteiros",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    conteudoId: uuid("conteudo_id")
      .notNull()
      .references(() => conteudos.id, { onDelete: "cascade" }),
    versao: integer("versao").notNull(),
    // { gancho, contexto, desenvolvimento, climax, cta }
    blocos: jsonb("blocos").notNull(),
    legenda: text("legenda"),
    hashtags: text("hashtags").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    versaoUnica: unique("roteiros_conteudo_versao_unq").on(t.conteudoId, t.versao),
  }),
);

export const publicacoes = pgTable("publicacoes", {
  id: uuid("id").defaultRandom().primaryKey(),
  conteudoId: uuid("conteudo_id")
    .notNull()
    .references(() => conteudos.id, { onDelete: "cascade" }),
  plataforma: plataformaEnum("plataforma").notNull(),
  url: text("url"),
  idExterno: text("id_externo"),
  publicadoEm: timestamp("publicado_em", { withTimezone: true }),
});

export const metricas = pgTable(
  "metricas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicacaoId: uuid("publicacao_id")
      .notNull()
      .references(() => publicacoes.id, { onDelete: "cascade" }),
    // Snapshot datado — nunca sobrescreve; permite curva de crescimento.
    coletadoEm: date("coletado_em").notNull(),
    views: integer("views").notNull().default(0),
    retencaoMedia: numeric("retencao_media", { precision: 5, scale: 2 }), // %
    tempoMedioSeg: integer("tempo_medio_seg"),
    likes: integer("likes").notNull().default(0),
    comentarios: integer("comentarios").notNull().default(0),
    compartilhamentos: integer("compartilhamentos").notNull().default(0),
    salvamentos: integer("salvamentos").notNull().default(0),
    seguidoresGanhos: integer("seguidores_ganhos").notNull().default(0),
    fonte: fonteMetricaEnum("fonte").notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Idempotência de importação: o mesmo vídeo/dia/fonte não duplica.
    snapshotUnico: unique("metricas_snapshot_unq").on(t.publicacaoId, t.coletadoEm, t.fonte),
  }),
);

export const config = pgTable("config", {
  id: serial("id").primaryKey(),
  palavrasPorMin: integer("palavras_por_min").notNull().default(150),
});

// ---------- Relations ----------
export const pilaresRelations = relations(pilares, ({ many }) => ({
  ideias: many(ideias),
  conteudos: many(conteudos),
}));

export const ideiasRelations = relations(ideias, ({ one, many }) => ({
  pilar: one(pilares, { fields: [ideias.pilarId], references: [pilares.id] }),
  conteudos: many(conteudos),
  sugestao: one(sugestoesIa, { fields: [ideias.sugestaoIaId], references: [sugestoesIa.id] }),
}));

export const conteudosRelations = relations(conteudos, ({ one, many }) => ({
  ideia: one(ideias, { fields: [conteudos.ideiaId], references: [ideias.id] }),
  pilar: one(pilares, { fields: [conteudos.pilarId], references: [pilares.id] }),
  roteiros: many(roteiros),
  publicacoes: many(publicacoes),
}));

export const roteirosRelations = relations(roteiros, ({ one }) => ({
  conteudo: one(conteudos, { fields: [roteiros.conteudoId], references: [conteudos.id] }),
}));

export const publicacoesRelations = relations(publicacoes, ({ one, many }) => ({
  conteudo: one(conteudos, { fields: [publicacoes.conteudoId], references: [conteudos.id] }),
  metricas: many(metricas),
}));

export const metricasRelations = relations(metricas, ({ one }) => ({
  publicacao: one(publicacoes, { fields: [metricas.publicacaoId], references: [publicacoes.id] }),
}));
