import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:4400" },
  webServer: { command: "node scripts/serve.mjs", url: "http://localhost:4400/", reuseExistingServer: false },
});
