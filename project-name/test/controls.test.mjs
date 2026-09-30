import test from "node:test";
import assert from "node:assert/strict";
import {
  KEY_LAYOUTS,
  keyboardControls,
  gamepadControls,
} from "../src/input.js";
import { RacingSimulation } from "@rmc/multiplayer-client/racing";
test("two keyboard racers receive independent simultaneous acceleration, steering and boost", () => {
  const held = new Set(["KeyW", "KeyA", "Space", "ArrowUp", "ArrowRight"]);
  const a = keyboardControls(held, KEY_LAYOUTS[0]),
    b = keyboardControls(held, KEY_LAYOUTS[1]);
  assert.equal(a.steer, -1);
  assert.equal(b.steer, 1);
  assert(a.boost);
  assert(!b.boost);
  assert.equal(a.throttle, 1);
  assert.equal(b.throttle, 1);
});
test("gamepad deadzone and separate analog triggers have bounded mappings", () => {
  const pad = {
    connected: true,
    axes: [0.1],
    buttons: Array.from({ length: 8 }, () => ({ pressed: false, value: 0 })),
  };
  pad.buttons[7].value = 0.7;
  assert.equal(gamepadControls(pad).steer, 0);
  assert.equal(gamepadControls(pad).throttle, 0.7);
  pad.axes[0] = -2;
  pad.buttons[1].pressed = true;
  assert.equal(gamepadControls(pad).steer, -1);
  assert(gamepadControls(pad).boost);
  assert.equal(gamepadControls(null).throttle, 0);
});
test("released offline simulation supports two humans, fixed grid and three-lap AI replay", () => {
  const s = new RacingSimulation();
  s.add("local-1");
  s.add("local-2");
  s.ready("local-1", true);
  s.ready("local-2", true);
  assert(s.start("local-1"));
  assert.equal(s.trucks.filter((p) => !p.bot).length, 2);
  s.trucks.forEach((p) => (p.bot = true));
  for (let i = 0; i < 3600 && s.phase !== "results"; i++) s.step(1 / 30);
  assert.equal(s.phase, "results");
  assert(s.trucks.some((p) => p.laps === 3));
});
