import { test as base, _electron as electron } from "@playwright/test";
import type { ElectronApplication, Page } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

/**
 * Electron-aware test fixture.
 * Launches a fresh app instance per test and tears it down afterwards.
 */

export interface ElectronFixtures {
  electronApp: ElectronApplication;
  mainPage: Page;
}

/** Resolve the Electron executable path from the local node_modules. */
function resolveElectronBin(): string {
  const root = path.resolve(__dirname, "..");
  // On Windows electron installs to node_modules/electron/dist/electron.exe
  const winBin = path.join(root, "node_modules", "electron", "dist", "electron.exe");
  if (process.platform === "win32" && fs.existsSync(winBin)) return winBin;

  // macOS / Linux: read path.txt written by the electron postinstall script
  const pathTxt = path.join(root, "node_modules", "electron", "path.txt");
  if (fs.existsSync(pathTxt)) {
    const rel = fs.readFileSync(pathTxt, "utf8").trim();
    return path.join(root, "node_modules", "electron", rel);
  }

  throw new Error("Cannot locate Electron binary. Run `npm install` first.");
}

export const test = base.extend<ElectronFixtures>({
  electronApp: async ({}, use) => {
    const mainEntry = path.resolve(__dirname, "..", "dist", "main.js");
    const executablePath = resolveElectronBin();

    const app = await electron.launch({
      executablePath,
      args: [mainEntry],
      env: {
        ...process.env,
        NODE_ENV: "test",
        ELECTRON_DISABLE_GPU: "1",
      },
    });

    await use(app);

    await app.close();
  },

  mainPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await use(page);
  },
});

export { expect } from "@playwright/test";
