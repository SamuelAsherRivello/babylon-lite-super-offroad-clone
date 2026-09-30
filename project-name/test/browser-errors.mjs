import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const url =
  process.env.GAME_URL ||
  "https://samuelasherrivello.github.io/babylon-lite-super-offroad-clone/";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-webgpu"],
});
const checks = [];
try {
  const unsupported = await browser.newPage();
  await unsupported.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { value: undefined }),
  );
  await unsupported.goto(url);
  await unsupported.waitForFunction(() => window.gameDiagnostics?.fatal);
  assert.match(
    await unsupported.locator("#overlay-text").textContent(),
    /WebGPU is unavailable/,
  );
  assert.equal(
    await unsupported.locator("#overlay-action").textContent(),
    "Reload",
  );
  checks.push({
    unsupportedWebGPU: await unsupported.evaluate(() => gameDiagnostics.fatal),
  });
  await unsupported.close();
  const missing = await browser.newPage();
  await missing.route("**/assets/truck-1.glb", (r) => r.abort());
  await missing.goto(url);
  await missing.waitForFunction(() => window.gameDiagnostics?.fatal);
  assert.match(
    await missing.locator("#overlay-text").textContent(),
    /Unable to load truck-1.glb/,
  );
  checks.push({
    failedAsset: await missing.evaluate(() => gameDiagnostics.fatal),
  });
  await missing.close();
  await writeFile(
    "project-name/documentation/error-verification.json",
    JSON.stringify({ url, checks, time: new Date().toISOString() }, null, 2),
  );
  console.log(JSON.stringify(checks));
} finally {
  await browser.close();
}
