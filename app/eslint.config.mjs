import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Standalone CommonJS Node scripts — not part of the Next app bundle.
    // They legitimately use require() and aren't subject to app lint rules.
    "scripts/**",
    "fix-campaign-status.js",
    "refresh-all-tokens.js",
    "trigger-email-queue.js",
    // Playwright artifacts — regenerated on every run.
    "playwright-report/**",
    "test-results/**",
  ]),
  // tailwind.config.ts legitimately uses require() for the tailwindcss-animate
  // plugin (Tailwind's own docs recommend this pattern for ESM/CJS interop).
  {
    files: ["tailwind.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
]);

export default eslintConfig;
