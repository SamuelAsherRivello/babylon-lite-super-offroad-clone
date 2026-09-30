import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const url =
  "https://samuelasherrivello.github.io/babylon-lite-super-offroad-clone/";
const version = process.env.EXPECTED_VERSION || "0.0.3";
const response = await fetch(url + "version.txt");
assert(response.ok);
assert.equal((await response.text()).trim(), "version=" + version);
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-webgpu"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
  errors = [],
  assets = [];
try {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && /\.glb$/.test(r.url()))
      assets.push({ url: r.url(), status: r.status() });
  });
  await page.goto(url);
  await page.waitForFunction(
    () => window.gameDiagnostics?.ready || window.gameDiagnostics?.fatal,
  );
  assert.equal(await page.evaluate(() => gameDiagnostics.fatal), "");
  assert.equal(
    await page.locator(".bottom-right b").textContent(),
    "v" + version,
  );
  assert.equal(assets.length, 8);
  assert(assets.every((a) => a.status === 200));
  await page.click("#solo");
  await page.click("#ready");
  await page.click("#start");
  await page.waitForFunction(() => gameDiagnostics.state.phase === "racing");
  await page.keyboard.down("w");
  await page.waitForTimeout(2500);
  await page.keyboard.up("w");
  await page.screenshot({ path: "project-name/documentation/gameplay.png" });
  assert.deepEqual(errors, []);
  const report = {
    url,
    version,
    assets,
    errors,
    time: new Date().toISOString(),
  };
  await writeFile(
    "project-name/documentation/public-assets-verification.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
