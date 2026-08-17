# Servidor do Hub da Família — imagem enxuta com Node 22.
FROM node:22-alpine

WORKDIR /app

# Instala dependências primeiro (cache melhor).
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copia o resto do app.
COPY . .

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "server.mjs"]
