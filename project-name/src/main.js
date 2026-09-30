import { MultiplayerClient } from "@rmc/multiplayer-client";
import {
  RacingSimulation,
  NEUTRAL,
  driveTruck,
  makeTruck,
  aiInput,
} from "@rmc/multiplayer-client/racing";
import { COLORS } from "@rmc/multiplayer-client/racing-track";
import versionText from "../../version.txt?raw";
import { RacingInput, KEY_LAYOUTS } from "./input.js";
import { RallySound } from "./sound.js";
import { createRacingView } from "./view.js";
import "./style.css";
const base = import.meta.env.BASE_URL,
  graybox = new URLSearchParams(location.search).has("graybox");
document.querySelector("#ui_layer").innerHTML = `
<header class="corner top-left"><span class="eyebrow">RIVELLO · ARCADE RACING</span><h1>DUST <em>CIRCUIT</em> <span>RALLY</span></h1></header>
<nav class="corner top-right"><a href="https://github.com/SamuelAsherRivello/babylon-lite-super-offroad-clone" target="_blank" rel="noreferrer">SOURCE ↗</a><button id="help">HOW TO PLAY</button></nav>
<main id="game"><div class="course-header"><div><span class="eyebrow">QUARRY CIRCUIT / 01</span><h2>Copper Basin</h2></div><div class="race-metrics"><span id="lap">3 LAPS</span><span id="clock">00:00.0</span><span id="connection">PREPARING</span></div></div>
<div id="viewport"><canvas id="canvas" aria-label="Copper Basin landscape racing circuit" tabindex="0"></canvas><div id="labels"></div><div id="race-call" aria-live="polite"></div><span id="graybox" ${graybox ? "" : "hidden"}>DEVELOPMENT GRAYBOX · BLENDER ASSETS PENDING</span>
<div id="overlay"><span class="eyebrow" id="overlay-kicker">FOUR TRUCKS. ONE DIRT CIRCUIT.</span><h2 id="overlay-title">Make some dust.</h2><p id="overlay-text">Three laps. Tight turns. A little nitro.<br>Race your friends or challenge the quarry crew.</p><div id="mode-buttons"><button class="primary" id="online">Race online <span>1–4 PLAYERS ↗</span></button><button id="local">Local race <span>2–4 PLAYERS</span></button><button id="solo">Solo practice <span>YOU + 3 AI</span></button></div><button id="overlay-action" hidden></button></div></div>
<div id="race-panel"><div id="roster"></div><div class="race-actions"><button id="join-keyboard" hidden>+ Keyboard P2</button><button id="join-pad" hidden>+ Gamepad</button><button id="ready" hidden>Ready up</button><button id="start" class="primary" hidden>Start race</button><button id="retry" hidden>Retry connection</button><button id="menu" hidden>Leave race</button></div></div>
<div id="notice" role="status">Loading the circuit…</div>
<div class="touch-controls"><div><button id="touch-left" aria-label="Steer left">◀</button><button id="touch-right" aria-label="Steer right">▶</button></div><div><button id="touch-recover" aria-label="Recover truck">↺</button><button id="touch-brake" aria-label="Brake and reverse">BRAKE</button><button id="touch-boost" aria-label="Nitro boost">NITRO</button><button id="touch-gas" aria-label="Accelerate">GAS</button></div></div>
<div class="track-notes"><span>TABLETOP JUMP</span><span>WASHBOARD</span><span>MUD PATCH</span><span>RISK / REWARD SHORTCUT</span></div></main>
<footer class="corner bottom-left"><button id="pause">Ⅱ Pause</button><button id="mute" aria-pressed="false">♫ Sound</button><label>VOLUME <input id="volume" type="range" min="0" max="1" step=".05" value=".25" aria-label="Sound volume"></label><button id="fullscreen">⛶</button></footer>
<div class="corner bottom-right"><span>ORIGINAL OFF-ROAD ARCADE</span><b>v${versionText.trim().split("=")[1]}</b></div>
<dialog id="instructions"><button id="close-help" aria-label="Close instructions">×</button><span class="eyebrow">WELCOME TO COPPER BASIN</span><h2>Find your line.</h2><p>Race three laps around the dirt circuit. Cross every checkpoint in order; the marked narrow shortcut is legal. Nitro cans refill boost. Green pickups improve traction for five seconds.</p><div class="control-guide"><b>KEYBOARD P1</b><span>W accelerate · A/D steer · S brake/reverse<br>Space nitro · R recover</span><b>KEYBOARD P2</b><span>↑ accelerate · ←/→ steer · ↓ brake/reverse<br>Enter nitro · Backspace recover</span><b>GAMEPAD</b><span>Left stick steer · RT or A accelerate<br>LT brake/reverse · B nitro · Y recover</span></div><p>Steering is relative to your truck. Recovery returns you to your last validated checkpoint and costs time. Stay on the dirt and watch the landings.</p><p>Online: ready up, then the lowest connected player number starts when everyone is ready. Late arrivals enter the next race. Reconnect creates a fresh player; interrupted sessions can reset.</p><p>Local: add keyboard P2 and gamepads before starting. Three/four local racers need gamepads. Pause stops a local race; online pause only stops your controls.</p></dialog>`;
const $ = (id) => document.getElementById(id),
  input = new RacingInput(),
  sound = new RallySound();
let view,
  loaded = false,
  fatal = "",
  mode = null,
  sim = null,
  session = null,
  unsubscribe = null,
  me = null,
  state = null,
  paused = false,
  seq = 0,
  pending = [],
  predicted = null,
  localCorrection = null,
  lastPhase = "",
  rosterSignature = "",
  lastSend = 0,
  accumulator = 0,
  lastFrame = performance.now(),
  noticeSerial = -1;
function neutral() {
  input.clear();
  if (session?.state.status === "connected")
    session.send("input", { ...NEUTRAL, seq: seq++ });
  pending = [];
}
function overlay(title, text, action) {
  $("overlay").hidden = false;
  $("overlay-title").textContent = title;
  $("overlay-text").textContent = text;
  $("mode-buttons").hidden = !!mode || !!fatal;
  $("overlay-action").hidden = !action;
  if (action) {
    $("overlay-action").textContent = action.text;
    $("overlay-action").onclick = action.run;
  }
}
function resetMode() {
  neutral();
  sound.update(null, null, true);
  unsubscribe?.();
  unsubscribe = null;
  session?.disconnect();
  session = null;
  sim = null;
  mode = null;
  state = null;
  me = null;
  predicted = null;
  localCorrection = null;
  paused = false;
  input.paused = false;
  input.bindings = [{ kind: "keyboard", index: 0 }];
  rosterSignature = "";
  lastPhase = "";
  $("pause").textContent = "Ⅱ Pause";
  update();
}
async function chooseMode(next) {
  await sound.unlock().catch(() => {});
  resetMode();
  mode = next;
  if (next === "online") {
    session = new MultiplayerClient(
      import.meta.env.VITE_SERVER_URL ||
        "https://rmc-colyseus-multiplayer-server.vercel.app",
      "dust-circuit-rally",
    );
    unsubscribe = session.subscribe((network, event) => {
      const previousId = me;
      me = network.sessionId;
      state = network.gameState;
      if (event === "gameState" || event === "snapshot") {
        const truck = state?.trucks.find((p) => p.id === me);
        if (truck) {
          const previousPrediction = predicted;
          pending = pending.filter((a) => a.seq > truck.ack);
          predicted = { ...truck };
          for (const a of pending) driveTruck(predicted, a, 1 / 20);
          reconcileLocalCorrection(
            previousPrediction,
            predicted,
            previousId !== me || state.phase !== "racing",
          );
        } else {
          predicted = null;
          localCorrection = null;
        }
      } else if (network.status !== "connected") {
        predicted = null;
        pending = [];
        localCorrection = null;
      }
      update();
    });
    void session.connect();
  } else {
    sim = new RacingSimulation();
    sim.add("local-1");
    me = "local-1";
    if (next === "local") {
      sim.add("local-2");
      input.bindings.push({ kind: "keyboard", index: 1 });
    }
    state = sim.snapshot();
    update();
  }
}
function readyToggle() {
  if (!state || state.phase !== "waiting") return;
  const own = state.people.find((p) => p.id === me);
  if (mode === "online") session.send("ready", !own?.ready);
  else {
    for (const person of sim.people.values()) sim.ready(person.id, !own?.ready);
    state = sim.snapshot();
    update();
  }
}
function start() {
  neutral();
  if (mode === "online") session.send("start");
  else if (sim) {
    sim.start(me);
    state = sim.snapshot();
    update();
  }
}
function addLocal(binding) {
  if (
    !sim ||
    mode !== "local" ||
    sim.phase !== "waiting" ||
    sim.people.size >= 4
  )
    return;
  const id = "local-" + (sim.people.size + 1);
  if (sim.add(id)) {
    input.bindings.push(binding);
    state = sim.snapshot();
    update();
  }
}
function pause(value) {
  paused = value;
  input.paused = value;
  neutral();
  $("pause").textContent = value ? "▶ Resume" : "Ⅱ Pause";
  update();
}
$("online").onclick = () => chooseMode("online");
$("local").onclick = () => chooseMode("local");
$("solo").onclick = () => chooseMode("solo");
$("ready").onclick = readyToggle;
$("start").onclick = start;
$("menu").onclick = resetMode;
$("retry").onclick = () => session?.connect();
$("pause").onclick = () => {
  if (mode) pause(!paused);
};
$("join-keyboard").onclick = () => {
  if (!input.bindings.some((b) => b.kind === "keyboard" && b.index === 1))
    addLocal({ kind: "keyboard", index: 1 });
};
$("join-pad").onclick = () => {
  const pads = navigator.getGamepads?.() || [];
  const pad = [...pads].find(
    (p) =>
      p?.connected &&
      !input.bindings.some((b) => b.kind === "pad" && b.index === p.index),
  );
  if (pad) addLocal({ kind: "pad", index: pad.index });
  else
    $("notice").textContent =
      "Connect a gamepad and press a button, then add it.";
};
window.addEventListener("gamepadconnected", (e) => {
  if (mode === "solo" || mode === "online") {
    input.bindings[0] = { kind: "pad", index: e.gamepad.index };
    $("notice").textContent = "Gamepad connected — RT/A gas, B nitro.";
  }
});
$("mute").onclick = () => {
  sound.mute(!sound.muted);
  $("mute").textContent = sound.muted ? "♪ Muted" : "♫ Sound";
  $("mute").setAttribute("aria-pressed", String(sound.muted));
};
$("volume").oninput = (e) => sound.setVolume(Number(e.target.value));
$("help").onclick = () => {
  $("instructions").showModal();
  if (mode) pause(true);
};
$("close-help").onclick = () => {
  $("instructions").close();
  if (mode) pause(false);
};
$("instructions").addEventListener("cancel", () => {
  if (mode) pause(false);
});
$("fullscreen").onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $("notice").textContent = "Fullscreen is unavailable here.";
  }
};
for (const [id, key, value] of [
  ["touch-left", "steer", -1],
  ["touch-right", "steer", 1],
  ["touch-gas", "throttle", 1],
  ["touch-brake", "brake", true],
  ["touch-boost", "boost", true],
  ["touch-recover", "recover", true],
])
  input.bindTouch($(id), key, value);
window.addEventListener("blur", neutral);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) neutral();
});
function update() {
  $("menu").hidden = !mode;
  $("retry").hidden =
    mode !== "online" || session?.state.status === "connected";
  $("join-keyboard").hidden =
    mode !== "local" ||
    state?.phase !== "waiting" ||
    input.bindings.some((b) => b.kind === "keyboard" && b.index === 1) ||
    state?.people.length >= 4;
  $("join-pad").hidden =
    mode !== "local" || state?.phase !== "waiting" || state?.people.length >= 4;
  $("connection").textContent =
    mode === "online"
      ? session?.state.status.toUpperCase() || "CONNECTING"
      : mode
        ? mode.toUpperCase()
        : "CHOOSE MODE";
  $("connection").dataset.status = session?.state.status || "offline";
  $("ready").hidden = !state || state.phase !== "waiting";
  $("start").hidden = true;
  if (fatal) {
    overlay("Circuit unavailable", fatal, {
      text: "Reload",
      run: () => location.reload(),
    });
    return;
  }
  if (!loaded) {
    overlay("Preparing Copper Basin", "Loading the original racing assets…");
    return;
  }
  if (!mode) {
    overlay(
      "Make some dust.",
      "Three laps. Tight turns. A little nitro. Race your friends or challenge the quarry crew.",
    );
    $("roster").innerHTML =
      '<span class="idle-note">ONE CIRCUIT · FOUR TRUCKS · NO SECOND CHANCES ON THE HAIRPIN</span>';
    $("notice").textContent = graybox
      ? "Development view. Final Blender art is pending."
      : "WASD or arrows to drive · Space for nitro · Gamepads and touch supported";
    view?.setState(
      { trucks: [], pickups: [], phase: "waiting", time: 0 },
      null,
    );
    return;
  }
  if (mode === "online" && session.state.status !== "connected") {
    overlay(
      session.state.status === "full"
        ? "Race room full"
        : "Connecting to the circuit",
      session.state.error || "Joining the shared racing server…",
    );
    $("roster").replaceChildren();
    return;
  }
  if (!state) return;
  const p = state.trucks.find((t) => t.id === me),
    own = state.people.find((t) => t.id === me),
    leader = [...state.people].sort((a, b) => a.number - b.number)[0];
  $("clock").textContent = formatTime(state.raceTime);
  $("lap").textContent = p ? `LAP ${Math.min(3, p.laps + 1)} / 3` : "3 LAPS";
  const signature = JSON.stringify({
    people: state.people,
    trucks: state.trucks.map((t) => ({
      id: t.id,
      n: t.number,
      bot: t.bot,
      laps: t.laps,
      nitro: Math.ceil(t.nitro * 10) / 10,
      finish: t.finish,
      traction: Math.ceil(t.traction),
    })),
    ranking: state.ranking,
  });
  if (signature !== rosterSignature) {
    rosterSignature = signature;
    $("roster").replaceChildren();
    for (let number = 1; number <= 4; number++) {
      const person = state.people.find((t) => t.number === number),
        truck = state.trucks.find((t) => t.number === number),
        row = document.createElement("div");
      row.className = "racer-card";
      row.style.setProperty("--racer", COLORS[number - 1]);
      const name = truck?.name || person?.name || "QUARRY AI",
        position = truck ? state.ranking.indexOf(truck.id) + 1 : number;
      row.innerHTML = `<b class="racer-number">${number}</b><div><strong>${name}${(truck?.id || person?.id) === me ? " · YOU" : ""}</strong><small>${truck ? (truck.finish !== null ? "FINISHED" : `${position}${position === 1 ? "ST" : position === 2 ? "ND" : position === 3 ? "RD" : "TH"} · LAP ${Math.min(3, truck.laps + 1)}${truck.traction > 0 ? " · GRIP" : ""}`) : person ? (person.ready ? "READY ✓" : "WAITING") : "AI FILLS GRID"}</small><div class="nitro-bar"><i style="width:${((truck?.nitro || 0) / 5) * 100}%"></i></div></div>`;
      $("roster").append(row);
    }
  }
  if (state.event.serial !== noticeSerial) {
    noticeSerial = state.event.serial;
    $("notice").textContent = state.event.text;
  }
  $("ready").textContent = own?.ready ? "Unready" : "Ready up";
  $("ready").classList.toggle("selected", !!own?.ready);
  if (paused) {
    overlay(
      "Take a breather.",
      mode === "online"
        ? "Your controls are paused. The race continues for everyone."
        : "The local race is paused.",
      { text: "Resume race", run: () => pause(false) },
    );
  } else if (state.phase === "waiting") {
    overlay(
      "Grid is open.",
      mode === "local"
        ? "Add players, ready up, then start the race."
        : mode === "solo"
          ? "Ready up to challenge three quarry AI trucks."
          : "Ready up. The lowest player number starts when everyone is ready.",
    );
    $("start").hidden = leader?.id !== me;
    $("start").disabled = state.people.some((p) => !p.ready);
  } else if (state.phase === "results") {
    const winner = state.trucks.find((t) => t.id === state.ranking[0]);
    overlay(
      `${winner?.name || "The crew"} takes it.`,
      state.ranking
        .map((id, i) => {
          const t = state.trucks.find((t) => t.id === id);
          return `${i + 1}. ${t.name} — ${t.finish !== null ? formatTime(t.finish) : "DNF / " + t.laps + " laps"}`;
        })
        .join("\n") + `\nNext grid in ${Math.ceil(state.countdown)} seconds.`,
    );
  } else {
    $("overlay").hidden = true;
    if (!p && mode === "online")
      $("notice").textContent =
        "You joined after the grid was formed. Watching this race; you enter the next grid.";
  }
  $("race-call").textContent =
    state.phase === "countdown"
      ? String(Math.ceil(state.countdown))
      : state.phase === "racing" && state.raceTime < 0.8
        ? "GO!"
        : "";
  if (lastPhase !== state.phase) {
    neutral();
    lastPhase = state.phase;
  }
}
function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}
function angleDifference(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
function reconcileLocalCorrection(previous, next, forceSnap) {
  const reset =
    forceSnap ||
    !previous ||
    !localCorrection ||
    localCorrection.id !== next.id ||
    (next.recovery > 0 && localCorrection.recovery <= 0);
  if (reset) {
    localCorrection = {
      id: next.id,
      x: 0,
      y: 0,
      z: 0,
      angle: 0,
      recovery: next.recovery || 0,
    };
    return;
  }
  const correction = {
      x: localCorrection.x + previous.x - next.x,
      y: localCorrection.y + previous.y - next.y,
      z: localCorrection.z + previous.z - next.z,
      angle:
        localCorrection.angle + angleDifference(previous.angle, next.angle),
    },
    distance = Math.hypot(correction.x, correction.y, correction.z);
  if (distance > 3.5 || Math.abs(correction.angle) > Math.PI * 0.6) {
    localCorrection.x = 0;
    localCorrection.y = 0;
    localCorrection.z = 0;
    localCorrection.angle = 0;
  } else Object.assign(localCorrection, correction);
  localCorrection.recovery = next.recovery || 0;
}
function presentLocalPrediction(dt) {
  if (!predicted || !localCorrection) return predicted;
  const decay = Math.exp(-dt * 18);
  localCorrection.x *= decay;
  localCorrection.y *= decay;
  localCorrection.z *= decay;
  localCorrection.angle *= decay;
  return {
    ...predicted,
    x: predicted.x + localCorrection.x,
    y: predicted.y + localCorrection.y,
    z: predicted.z + localCorrection.z,
    angle: predicted.angle + localCorrection.angle,
  };
}
function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.08);
  lastFrame = now;
  if (mode && loaded && !fatal) {
    if (sim) {
      if (!paused) {
        accumulator += dt;
        while (accumulator >= 1 / 30) {
          for (let i = 0; i < input.bindings.length; i++) {
            const id = "local-" + (i + 1);
            sim.input(id, { ...input.read(i), seq: seq++ });
          }
          sim.step(1 / 30);
          accumulator -= 1 / 30;
        }
        state = sim.snapshot();
      }
    } else if (state?.phase === "racing") {
      if (now - lastSend >= 50) {
        const controls = { ...input.read(), seq: seq++ };
        session.send("input", controls);
        if (!paused) {
          pending.push(controls);
          if (pending.length > 40) pending.shift();
        }
        lastSend = now;
      }
      if (predicted && !paused) driveTruck(predicted, input.read(), dt);
    }
    if (state) {
      const renderState =
        predicted && mode === "online" && state.phase === "racing"
          ? {
              ...state,
              trucks: state.trucks.map((t) =>
                t.id === me
                  ? { ...presentLocalPrediction(dt), steer: input.read().steer }
                  : t,
              ),
            }
          : state;
      view.setState(
        {
          ...renderState,
          trucks: renderState.trucks.map((t) => ({
            ...t,
            steer:
              t.steer ??
              (t.bot
                ? aiInput(t).steer
                : sim
                  ? input.read(Number(t.id.split("-")[1]) - 1).steer
                  : 0),
          })),
          animationPaused: paused && mode !== "online",
        },
        me,
      );
      sound.update(
        state,
        state.trucks.find((t) => t.id === me),
        paused,
      );
      update();
    }
  }
  requestAnimationFrame(frame);
}
try {
  view = await createRacingView($("canvas"), $("labels"), base, graybox);
  loaded = true;
  update();
} catch (error) {
  console.error(error);
  fatal = error.message || "The circuit could not initialize.";
  loaded = true;
  update();
}
requestAnimationFrame(frame);
window.addEventListener(
  "pagehide",
  () => {
    neutral();
    unsubscribe?.();
    session?.disconnect();
    input.dispose();
    sound.dispose();
    view?.dispose();
  },
  { once: true },
);
window.gameDiagnostics = {
  get ready() {
    return loaded && !fatal;
  },
  get fatal() {
    return fatal;
  },
  get state() {
    return state;
  },
  get mode() {
    return mode;
  },
  get input() {
    return input.read();
  },
  get bindings() {
    return input.bindings;
  },
  get session() {
    return session?.state;
  },
  get camera() {
    return view?.camera;
  },
  get fps() {
    return view?.fps;
  },
  get localCorrection() {
    return localCorrection && { ...localCorrection };
  },
  get graybox() {
    return graybox;
  },
};
