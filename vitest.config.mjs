import { defineConfig } from "vitest/config";
import path from "node:path";

/* Minimal Vitest config. The app uses the `@/*` path alias (tsconfig
 * paths) — point Vitest at it. JSX automatic runtime is provided by Vite's
 * Oxc transform (react is a dependency), so no explicit JSX config needed. */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/lib/test-setup.ts"],
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: { enabled: false },
  },
});
