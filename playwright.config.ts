import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
try {
  const env = parseEnv(readFileSync(".env", "utf8"));
  for (const [k, v] of Object.entries(env))
    if (!process.env[k]) process.env[k] = v;
} catch {}
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  outputDir: ".data/browser-results",
  use: {
    baseURL: "http://127.0.0.1:8787",
    headless: true,
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  },
  reporter: "list",
});
