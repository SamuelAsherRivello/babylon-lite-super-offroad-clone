import { NEUTRAL } from "@rmc/multiplayer-client/racing";
export const KEY_LAYOUTS = [
  {
    left: "KeyA",
    right: "KeyD",
    throttle: "KeyW",
    brake: "KeyS",
    boost: "Space",
    recover: "KeyR",
  },
  {
    left: "ArrowLeft",
    right: "ArrowRight",
    throttle: "ArrowUp",
    brake: "ArrowDown",
    boost: "Enter",
    recover: "Backspace",
  },
];
export function keyboardControls(held, layout) {
  return {
    steer: Number(held.has(layout.right)) - Number(held.has(layout.left)),
    throttle: Number(held.has(layout.throttle)),
    brake: held.has(layout.brake),
    boost: held.has(layout.boost),
    recover: held.has(layout.recover),
  };
}
export function gamepadControls(pad) {
  if (!pad?.connected) return { ...NEUTRAL };
  const x = pad.axes[0] || 0;
  return {
    steer: Math.abs(x) < 0.15 ? 0 : Math.max(-1, Math.min(1, x)),
    throttle: Math.max(
      pad.buttons[7]?.value || 0,
      Number(pad.buttons[0]?.pressed || false),
    ),
    brake: !!pad.buttons[6]?.pressed,
    boost: !!pad.buttons[1]?.pressed,
    recover: !!pad.buttons[3]?.pressed,
  };
}
export class RacingInput {
  constructor() {
    this.held = new Set();
    this.touch = { ...NEUTRAL };
    this.paused = false;
    this.bindings = [{ kind: "keyboard", index: 0 }];
    this.handlers = [];
    if (typeof window !== "undefined") {
      this.listen(window, "keydown", (e) => {
        if (
          e.target?.matches("input,select,textarea") ||
          e.ctrlKey ||
          e.metaKey ||
          e.altKey
        )
          return;
        if (KEY_LAYOUTS.some((l) => Object.values(l).includes(e.code))) {
          e.preventDefault();
          this.held.add(e.code);
        }
      });
      this.listen(window, "keyup", (e) => this.held.delete(e.code));
      this.listen(window, "blur", () => this.clear());
      this.listen(document, "visibilitychange", () => {
        if (document.hidden) this.clear();
      });
      this.listen(window, "gamepaddisconnected", () => this.clear());
    }
  }
  listen(target, event, fn) {
    target.addEventListener(event, fn);
    this.handlers.push(() => target.removeEventListener(event, fn));
  }
  clear() {
    this.held.clear();
    for (const reset of this.touchResetters || []) reset();
    this.touch = { ...NEUTRAL };
    if (typeof document !== "undefined")
      document
        .querySelectorAll(".held")
        .forEach((e) => e.classList.remove("held"));
  }
  read(
    index = 0,
    pads = typeof navigator !== "undefined"
      ? navigator.getGamepads?.() || []
      : [],
  ) {
    if (this.paused) return { ...NEUTRAL };
    const binding = this.bindings[index];
    if (!binding) return { ...NEUTRAL };
    const primary =
      binding.kind === "pad"
        ? gamepadControls(pads[binding.index])
        : keyboardControls(this.held, KEY_LAYOUTS[binding.index]);
    if (index === 0) {
      primary.steer = this.touch.steer || primary.steer;
      primary.throttle = Math.max(primary.throttle, this.touch.throttle);
      for (const key of ["brake", "boost", "recover"])
        primary[key] ||= this.touch[key];
    }
    return primary;
  }
  bindTouch(element, key, value) {
    const active = new Set();
    this.touchSources ??= [];
    this.touchResetters ??= [];
    const source = { key, value, active };
    this.touchSources.push(source);
    this.touchResetters.push(() => active.clear());
    const sync = () => {
      const held = this.touchSources.filter(
        (s) => s.key === key && s.active.size,
      );
      this.touch[key] =
        key === "steer"
          ? held.reduce((sum, s) => sum + s.value, 0)
          : held.length
            ? value
            : key === "throttle"
              ? 0
              : false;
      element.classList.toggle("held", active.size > 0);
    };
    this.listen(element, "pointerdown", (e) => {
      e.preventDefault();
      element.setPointerCapture(e.pointerId);
      active.add(e.pointerId);
      sync();
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      this.listen(element, event, (e) => {
        active.delete(e.pointerId);
        sync();
      });
  }
  dispose() {
    this.clear();
    this.handlers.forEach((fn) => fn());
  }
}
