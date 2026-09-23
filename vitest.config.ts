import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * F25 is the first phase to add Console tests (see docs/f25-report.md
 * "UI tests" section for why Vitest + React Testing Library was chosen
 * over Playwright: component-level tests with a mocked API client are
 * enough to cover brief §39's scenarios without needing the real
 * backend/Supabase running, and this stays the project's standing
 * convention going forward — do not introduce a second test runner
 * without a documented reason).
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: false,
    css: false,
  },
});
