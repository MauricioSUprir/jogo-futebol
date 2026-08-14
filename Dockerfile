# ---- Base ----
FROM node:22-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# ---- Dependências ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# Compila os scripts de migração/seed para JS standalone (tsx não vai na imagem final)
RUN npx --yes esbuild src/db/migrate.ts src/db/seed.ts \
      --bundle --platform=node --format=esm --packages=external \
      --outdir=dist-scripts

# ---- Runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=America/Sao_Paulo

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Saída standalone do Next
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migrations + scripts compilados (rodados manualmente: node dist-scripts/migrate.js)
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/dist-scripts ./dist-scripts
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres
COPY --from=builder /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
