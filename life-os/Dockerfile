# LIFE OS — imagem do servidor (Next.js standalone) e do migrador do banco.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1

# Dependências (o postinstall gera o cliente do Prisma a partir do schema).
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build

# Migrador enxuto: só o CLI do Prisma (mesma versão do package-lock) + as migrações.
# Serviço "migrar" do docker-compose; no Railway roda como comando de pré-deploy (railway.json).
FROM base AS migrador
WORKDIR /migrar
RUN npm install --no-audit --no-fund --no-save prisma@7.10.1 dotenv@17.4.2 && npm cache clean --force
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/migrar.sh ./migrar.sh
CMD ["sh", "/migrar/migrar.sh"]

# O app: o servidor standalone (sem o código-fonte nem as dependências de desenvolvimento)
# + o migrador, para plataformas de um serviço só (Railway) aplicarem as migrações antes de subir.
FROM base AS app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system lifeos && useradd --system --gid lifeos lifeos
COPY --from=migrador --chown=lifeos:lifeos /migrar /migrar
COPY --from=build --chown=lifeos:lifeos /app/.next/standalone ./
USER lifeos
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
