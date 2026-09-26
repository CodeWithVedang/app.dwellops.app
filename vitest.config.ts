import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/support/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts", "tests/security/**/*.test.ts"],
    // Integration tests share one database; run files serially.
    fileParallelism: false,
    env: {
      // Integration/security tests always hit the dedicated test DB, never dev.
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      NODE_ENV: "test",
    },
  },
});
