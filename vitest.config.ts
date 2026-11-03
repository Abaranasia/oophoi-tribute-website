import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Mirrors the path aliases in tsconfig.json. Only pure modules are tested, so no Astro plugin is needed.
export default defineConfig({
  resolve: {
    alias: {
      "@features": fromRoot("./src/features"),
      "@assets": fromRoot("./src/assets"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
