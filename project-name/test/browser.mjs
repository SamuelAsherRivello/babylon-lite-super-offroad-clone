import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { aiInput } from "@rmc/multiplayer-client/racing";
import { mkdir, writeFile } from "node:fs/promises";
const url =
  process.env.GAME_URL ||
  "http://127.0.0.1:5188/babylon-lite-super-offroad-clone/";
const evidence = new URL("../documentation/", import.meta.url),
  prefix = process.env.EVIDENCE_PREFIX || "";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--enable-unsafe-webgpu",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
  ],
});
const errors = [],
  report = {
    url,
    started: new Date().toISOString(),
    checks: [],
    requestFailures: [],
  };
async function open() {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) =>
    report.requestFailures.push({
      url: r.url(),
      error: r.failure()?.errorText,
    }),
  );
  await page.goto(url);
  await page.waitForFunction(
    () => window.gameDiagnostics?.ready || window.gameDiagnostics?.fatal,
  );
  assert.equal(await page.evaluate(() => gameDiagnostics.fatal), "");
  assert.equal(await page.evaluate(() => gameDiagnostics.graybox), false);
  if (process.env.EXPECTED_VERSION)
    assert.equal(
      await page.locator(".bottom-right b").textContent(),
      "v" + process.env.EXPECTED_VERSION,
    );
  return page;
}
async function state(page) {
  return page.evaluate(() => gameDiagnostics.state);
}
async function start(page, mode) {
  await page.click("#" + mode);
  await page.waitForFunction(() => gameDiagnostics.state?.phase === "waiting");
  await page.click("#ready");
  await page.click("#start");
  await page.waitForFunction(() => gameDiagnostics.state.phase === "racing", {
    timeout: 10000,
  });
}
const maps = [
  ["a", "d", "w", "Space"],
  ["ArrowLeft", "ArrowRight", "ArrowUp", "Enter"],
];
async function race(pages, local = false) {
  const held = new Map(),
    started = Date.now();
  const fps = [];
  let result;
  while (Date.now() - started < 140000) {
    for (const page of pages) {
      const s = await state(page);
      const measured = await page.evaluate(() => gameDiagnostics.fps);
      if (measured > 0) fps.push(measured);
      if (s?.phase === "results") {
        result = s;
        continue;
      }
      if (s?.phase !== "racing") continue;
      const ownId = await page.evaluate(
        () => gameDiagnostics.session?.sessionId || "local-1",
      );
      const own = s.trucks
        .filter((t) => !t.bot)
        .filter((t) => local || t.id === ownId);
      for (let i = 0; i < own.length; i++) {
        const t = own[i],
          c = aiInput(t),
          keys = maps[local ? i : 0],
          want = new Set(
            t.finish === null
              ? [
                  keys[2],
                  ...(c.steer < -0.13
                    ? [keys[0]]
                    : c.steer > 0.13
                      ? [keys[1]]
                      : []),
                  ...(c.boost ? [keys[3]] : []),
                ]
              : [],
          );
        const tag = pages.indexOf(page) + "-" + i,
          old = held.get(tag) || new Set();
        for (const k of old) if (!want.has(k)) await page.keyboard.up(k);
        for (const k of want) if (!old.has(k)) await page.keyboard.down(k);
        held.set(tag, want);
      }
    }
    if (result) break;
    await new Promise((r) => setTimeout(r, 65));
  }
  assert(result, "race reached results");
  for (const page of pages)
    for (const keys of maps) for (const k of keys) await page.keyboard.up(k);
  return {
    time: result.raceTime,
    trucks: result.trucks.map((t) => ({
      number: t.number,
      bot: t.bot,
      laps: t.laps,
      finish: t.finish,
    })),
    ranking: result.ranking,
    fps: {
      min: Math.min(...fps),
      max: Math.max(...fps),
      average: fps.reduce((a, b) => a + b, 0) / fps.length,
    },
  };
}
try {
  const solo = await open();
  await start(solo, "solo");
  const camera = await solo.evaluate(() => gameDiagnostics.camera);
  await solo.keyboard.down("w");
  await solo.keyboard.down("a");
  await solo.keyboard.down("Space");
  assert.deepEqual(
    await solo.evaluate(() => [
      gameDiagnostics.input.throttle,
      gameDiagnostics.input.steer,
      gameDiagnostics.input.boost,
    ]),
    [1, -1, true],
  );
  await solo.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal(await solo.evaluate(() => gameDiagnostics.input.throttle), 0);
  await solo.click("#pause");
  const time = (await state(solo)).time;
  await solo.waitForTimeout(250);
  assert.equal((await state(solo)).time, time);
  await solo.click("#overlay-action");
  report.checks.push({ solo: await race([solo]) });
  assert.deepEqual(await solo.evaluate(() => gameDiagnostics.camera), camera);
  await solo.screenshot({
    path: new URL(prefix + "solo-results.png", evidence).pathname.slice(1),
  });
  await solo.waitForFunction(() => gameDiagnostics.state.phase === "waiting", {
    timeout: 12000,
  });
  await solo.click("#ready");
  await solo.click("#start");
  assert.equal((await state(solo)).phase, "countdown");
  await solo.context().close();
  const local = await open();
  await start(local, "local");
  await local.keyboard.down("w");
  await local.keyboard.down("ArrowUp");
  assert.equal(await local.evaluate(() => gameDiagnostics.bindings.length), 2);
  await local.keyboard.up("w");
  await local.keyboard.up("ArrowUp");
  report.checks.push({ local: await race([local], true) });
  await local.context().close();
  const a = await open(),
    b = await open();
  await a.click("#online");
  await b.click("#online");
  for (const p of [a, b])
    await p.waitForFunction(
      () => gameDiagnostics.session?.status === "connected",
      null,
      { timeout: 60000 },
    );
  await a.waitForFunction(() => gameDiagnostics.state.people.length === 2);
  await a.click("#ready");
  await b.click("#ready");
  const starter = (await a.locator("#start").isVisible()) ? a : b;
  await starter.waitForFunction(
    () => !document.querySelector("#start").disabled,
  );
  await starter.click("#start");
  await a.waitForFunction(() => gameDiagnostics.state.phase === "racing");
  report.checks.push({ online: await race([a, b]) });
  await a.screenshot({
    path: new URL(prefix + "online-results.png", evidence).pathname.slice(1),
  });
  for (const p of [a, b]) await p.context().close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const p = await mobile.newPage();
  await p.goto(url);
  await p.waitForFunction(() => window.gameDiagnostics?.ready);
  await p.click("#solo");
  await p.click("#ready");
  await p.click("#start");
  await p.waitForFunction(() => gameDiagnostics.state.phase === "racing");
  const cdp = await mobile.newCDPSession(p),
    gas = await p.locator("#touch-gas").boundingBox(),
    left = await p.locator("#touch-left").boundingBox(),
    boost = await p.locator("#touch-boost").boundingBox();
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [gas, left, boost].map((r, id) => ({
      x: r.x + r.width / 2,
      y: r.y + r.height / 2,
      id,
    })),
  });
  assert.deepEqual(
    await p.evaluate(() => [
      gameDiagnostics.input.throttle,
      gameDiagnostics.input.steer,
      gameDiagnostics.input.boost,
    ]),
    [1, -1, true],
  );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  assert.equal(await p.evaluate(() => gameDiagnostics.input.throttle), 0);
  await p.screenshot({
    path: new URL(prefix + "mobile.png", evidence).pathname.slice(1),
  });
  await p.setViewportSize({ width: 844, height: 390 });
  assert(
    Math.abs(
      (await p
        .locator("#canvas")
        .evaluate((e) => e.clientWidth / e.clientHeight)) -
        16 / 9,
    ) < 0.02,
  );
  await p.screenshot({
    path: new URL(prefix + "landscape-mobile.png", evidence).pathname.slice(1),
  });
  await mobile.close();
  report.checks.push(
    "concurrent emulated touch, cancellation, responsive 16:9, static camera, focus release, pause/replay",
  );
  assert.deepEqual(errors, []);
  report.errors = errors;
  report.finished = new Date().toISOString();
  await writeFile(
    new URL(prefix + "browser-verification.json", evidence),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  report.failure = e.stack;
  report.errors = errors;
  await writeFile(
    new URL(prefix + "browser-verification.json", evidence),
    JSON.stringify(report, null, 2),
  );
  throw e;
} finally {
  await browser.close();
}
