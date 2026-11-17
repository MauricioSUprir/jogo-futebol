# LIFE OS — imagem do servidor (Next.js standalone) e do migrador do banco.
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# Dependências (o postinstall gera o cliente do Prisma a partir do schema).
FROM base AS deps
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
RUN npm run build

# Roda as migrações pendentes e sai (serviço "migrar" do docker-compose).
FROM deps AS migrador
CMD ["npx", "prisma", "migrate", "deploy"]

# O app: só o servidor standalone, sem o código-fonte nem as dependências de desenvolvimento.
FROM base AS app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system lifeos && useradd --system --gid lifeos lifeos
COPY --from=build --chown=lifeos:lifeos /app/.next/standalone ./
USER lifeos
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
