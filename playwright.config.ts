import { defineConfig } from "@playwright/test";
import * as path from "path";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  workers: 1, // Electron tests must run serially (one app instance at a time)
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/html" }]],
  use: {
    // Screenshots and traces on failure
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "off",
  },
  outputDir: "test-results",
  projects: [
    {
      name: "electron",
      testMatch: "**/*.spec.ts",
    },
  ],
});
