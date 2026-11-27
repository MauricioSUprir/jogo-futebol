import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "server-only": fileURLToPath(new URL("./tests/apoio/server-only.ts", import.meta.url)),
};

export default defineConfig({
  test: {
    fileParallelism: false,
    projects: [
      { resolve: { alias }, test: { name: "unidade", include: ["tests/unidade/**/*.test.ts"], environment: "node" } },
      {
        resolve: { alias },
        test: {
          name: "integracao",
          include: ["tests/integracao/**/*.test.ts"],
          environment: "node",
          testTimeout: 60_000,
          hookTimeout: 120_000,
          setupFiles: ["tests/integracao/ambiente.ts"],
        },
      },
    ],
  },
});
