import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--enable-unsafe-webgpu"],
});
const url =
    process.env.GAME_URL ||
    "http://127.0.0.1:5189/babylon-lite-super-offroad-clone/",
  checks = [],
  errors = [];
try {
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    }),
    p = await mobile.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(url);
  await p.waitForFunction(() => window.gameDiagnostics?.ready);
  await p.click("#solo");
  await p.click("#ready");
  await p.click("#start");
  await p.waitForFunction(() => gameDiagnostics.state.phase === "racing");
  const camera = await p.evaluate(() => gameDiagnostics.camera),
    cdp = await mobile.newCDPSession(p),
    rects = await Promise.all(
      ["#touch-gas", "#touch-left", "#touch-boost"].map((s) =>
        p.locator(s).boundingBox(),
      ),
    );
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: rects.map((r, id) => ({
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
  await p.screenshot({ path: "project-name/documentation/mobile.png" });
  await p.setViewportSize({ width: 844, height: 390 });
  await p.waitForTimeout(200);
  assert(
    Math.abs(
      (await p
        .locator("#canvas")
        .evaluate((e) => e.clientWidth / e.clientHeight)) -
        16 / 9,
    ) < 0.02,
  );
  assert.deepEqual(await p.evaluate(() => gameDiagnostics.camera), camera);
  await p.screenshot({
    path: "project-name/documentation/landscape-mobile.png",
  });
  checks.push({
    emulatedTouch:
      "concurrent gas/steer/boost, release, unchanged camera after resize",
    layout: await p.evaluate(() => ({
      height: innerHeight,
      scroll: document.documentElement.scrollHeight,
      canvas: document.querySelector("canvas").getBoundingClientRect().toJSON(),
    })),
    fps: await p.evaluate(() => gameDiagnostics.fps),
  });
  await mobile.close();

  const padsContext = await browser.newContext(),
    padsPage = await padsContext.newPage();
  padsPage.on("pageerror", (e) => errors.push(e.message));
  await padsPage.addInitScript(() => {
    window.testPads = [0, 1].map((index) => ({
      index,
      connected: true,
      axes: [index === 0 ? -0.8 : 0.8],
      buttons: Array.from({ length: 16 }, (_, i) => ({
        value: i === 7 ? 1 : 0,
        pressed: i === 7,
      })),
    }));
    Object.defineProperty(navigator, "getGamepads", {
      value: () => window.testPads,
    });
  });
  await padsPage.goto(url);
  await padsPage.waitForFunction(() => window.gameDiagnostics?.ready);
  await padsPage.click("#local");
  await padsPage.click("#join-pad");
  await padsPage.click("#join-pad");
  assert.equal(
    await padsPage.evaluate(() => gameDiagnostics.bindings.length),
    4,
  );
  await padsPage.click("#ready");
  await padsPage.click("#start");
  await padsPage.waitForFunction(
    () => gameDiagnostics.state.phase === "racing",
  );
  await padsPage.keyboard.down("w");
  await padsPage.keyboard.down("ArrowUp");
  await padsPage.waitForTimeout(750);
  assert.equal(
    await padsPage.evaluate(
      () => gameDiagnostics.state.trucks.filter((t) => !t.bot).length,
    ),
    4,
  );
  const motion = await padsPage.evaluate(() =>
    gameDiagnostics.state.trucks.map((t) => Math.hypot(t.vx, t.vz)),
  );
  assert(motion.every((speed) => speed > 0));
  await padsPage.evaluate(() => {
    testPads.forEach((p) => (p.connected = false));
    window.dispatchEvent(new Event("gamepaddisconnected"));
  });
  assert.equal(
    await padsPage.evaluate(() => gameDiagnostics.input.throttle),
    0,
  );
  await padsPage.waitForTimeout(500);
  checks.push({
    emulatedGamepads:
      "Two keyboard racers plus two independent virtual controllers fill the four-human local grid; simultaneous motion and disconnect input release verified",
    motion,
  });
  await padsContext.close();

  const context = await browser.newContext(),
    page = await context.newPage();
  await page.addInitScript(() => {
    const Native = window.WebSocket;
    window.networkTest = { impaired: false, sent: 0, dropped: 0, sockets: [] };
    window.WebSocket = class extends Native {
      constructor(...args) {
        super(...args);
        window.networkTest.sockets.push(this);
      }
      send(message) {
        const n = window.networkTest;
        if (!n.impaired) {
          super.send(message);
          return;
        }
        if (++n.sent % 7 === 0) {
          n.dropped++;
          return;
        }
        setTimeout(() => {
          if (this.readyState === Native.OPEN) super.send(message);
        }, 150);
      }
      set onmessage(fn) {
        this.handler = fn;
        super.onmessage = (e) => {
          if (window.networkTest.impaired)
            setTimeout(() => fn?.call(this, e), 150);
          else fn?.call(this, e);
        };
      }
      get onmessage() {
        return this.handler;
      }
    };
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.gameDiagnostics?.ready);
  await page.click("#online");
  await page.waitForFunction(
    () => gameDiagnostics.session?.status === "connected",
    null,
    { timeout: 60000 },
  );
  const initial = await page.evaluate(() => gameDiagnostics.session.sessionId);
  await page.click("#ready");
  await page.click("#start");
  await page.waitForFunction(() => gameDiagnostics.state.phase === "racing");
  await page.evaluate(() => (networkTest.impaired = true));
  const before = await page.evaluate(
    () => gameDiagnostics.state.trucks.find((t) => !t.bot).x,
  );
  await page.keyboard.down("w");
  await page.waitForTimeout(2500);
  await page.keyboard.up("w");
  assert.notEqual(
    await page.evaluate(
      () => gameDiagnostics.state.trucks.find((t) => !t.bot).x,
    ),
    before,
  );
  const dropped = await page.evaluate(() => networkTest.dropped);
  assert(dropped > 0);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal(await page.evaluate(() => gameDiagnostics.input.throttle), 0);
  await page.evaluate(() => {
    networkTest.impaired = false;
    networkTest.sockets.forEach((s) =>
      s.close(3001, "test connection interruption"),
    );
  });
  await page.waitForFunction(
    () => gameDiagnostics.session.status !== "connected",
  );
  await page.click("#retry");
  await page.waitForFunction(
    () => gameDiagnostics.session.status === "connected",
    null,
    { timeout: 60000 },
  );
  const fresh = await page.evaluate(() => gameDiagnostics.session.sessionId);
  assert.notEqual(fresh, initial);
  checks.push({
    network:
      "Client-side WebSocket shim delays input and onmessage by 150 ms each direction and drops every seventh outbound frame; continued authoritative motion and neutral focus release; closed transport and rejoined with fresh identity",
    dropped,
  });
  await context.close();
  assert.deepEqual(errors, []);
  await writeFile(
    "project-name/documentation/input-network-verification.json",
    JSON.stringify(
      { url, checks, errors, time: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(checks, null, 2));
} finally {
  await browser.close();
}
