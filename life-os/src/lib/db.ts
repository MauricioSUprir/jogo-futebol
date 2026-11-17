// Cliente do banco (Prisma 7 com o driver "pg"). Um só por processo (o modo dev recarrega módulos).
// Criado no PRIMEIRO USO, não na importação: o "next build" importa as rotas sem banco nenhum.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const global = globalThis as unknown as { prismaLifeOs?: PrismaClient };

function obter(): PrismaClient {
  if (!global.prismaLifeOs) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não definida — veja o .env.exemplo.");
    global.prismaLifeOs = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  return global.prismaLifeOs;
}

export const db = new Proxy({} as PrismaClient, {
  get(_alvo, prop) {
    const cliente = obter();
    const valor = Reflect.get(cliente, prop, cliente);
    return typeof valor === "function" ? valor.bind(cliente) : valor;
  },
});
