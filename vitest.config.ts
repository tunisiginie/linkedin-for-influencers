import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mirrors tsconfig.json's "@/*" -> "./src/*" path alias for Vitest, which
// (unlike Next.js's own build) doesn't read tsconfig paths on its own.
// Needed the moment any test imports a real (non-type-only) value through
// "@/..." — type-only imports are erased at compile time and never hit
// this, which is why no test needed it until src/lib/nolan/pricing.ts.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
