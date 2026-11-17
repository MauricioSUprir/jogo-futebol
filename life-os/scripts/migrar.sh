#!/bin/sh
# Aplica as migrações pendentes do banco (DATABASE_URL) e sai. Usado pelo serviço "migrar" do
# docker-compose e pelo pré-deploy do Railway (railway.json).
set -e
cd /migrar
exec node node_modules/prisma/build/index.js migrate deploy
