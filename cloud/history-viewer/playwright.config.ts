import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8097", headless: true },
  webServer: {
    command: "uv run python -m tests.history_demo_server",
    cwd: "../..",
    url: "http://127.0.0.1:8097/state",
    reuseExistingServer: false,
  },
});
