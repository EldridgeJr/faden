import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resolve the "@/*" alias from tsconfig.json, same as Next.js does.
    tsconfigPaths: true,
  },
  test: {
    // Core logic (chunking, RRF, citations) runs in Node, not in a browser.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
