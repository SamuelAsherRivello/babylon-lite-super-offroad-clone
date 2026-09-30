import {
  createEngine,
  createSceneContext,
  createArcRotateCamera,
  enableOrthographicCamera,
  createHemisphericLight,
  createDirectionalLight,
  createPcfDirectionalShadowGenerator,
  enableMirroredMeshes,
  setShadowTaskCasterMeshes,
  loadGltf,
  addToScene,
  registerScene,
  registerSceneWithShadowSupport,
  startEngine,
  createHierarchyInstancePool,
  setHierarchyInstanceCount,
  setHierarchyInstanceMatrix,
  createTorus,
  createSphere,
  createBox,
  createStandardMaterial,
  createTransformNode,
  onBeforeRender,
  resizeEngine,
  disposeScene,
  getViewMatrix,
  getViewProjectionMatrix,
  projectWorldToScreen,
} from "@babylonjs/lite";
import {
  route,
  COLORS,
  terrainAt,
  gates,
} from "@rmc/multiplayer-client/racing-track";
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
export function matrix(x, y, z, a = 0, sx = 1, sy = sx, sz = sx) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return new Float32Array([
    c * sx,
    0,
    -s * sx,
    0,
    0,
    sy,
    0,
    0,
    s * sz,
    0,
    c * sz,
    0,
    x,
    y,
    z,
    1,
  ]);
}
function chassisMatrix(x, y, z, yaw, pitch, lean) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw),
    cp = Math.cos(pitch),
    sp = Math.sin(pitch),
    cl = Math.cos(lean),
    sl = Math.sin(lean),
    right = [c * cl, sl, -s * cl],
    up = [-c * sl, cl, s * sl],
    forward = [s, 0, c];
  const tiltedUp = up.map((v, i) => v * cp + forward[i] * sp),
    tiltedForward = forward.map((v, i) => v * cp - up[i] * sp);
  return new Float32Array([
    ...right,
    0,
    ...tiltedUp,
    0,
    ...tiltedForward,
    0,
    x,
    y,
    z,
    1,
  ]);
}
function wheelMatrix(x, y, z, a, roll) {
  const m = matrix(x, y, z, a),
    c = Math.cos(roll),
    s = Math.sin(roll);
  return new Float32Array([
    m[0],
    0,
    m[2],
    0,
    m[8] * s,
    c,
    m[10] * s,
    0,
    m[8] * c,
    -s,
    m[10] * c,
    0,
    x,
    y,
    z,
    1,
  ]);
}
export async function createRacingView(canvas, labels, base, graybox = false) {
  if (!navigator.gpu)
    throw Error(
      "WebGPU is unavailable. Use current Chrome or Edge with hardware acceleration enabled.",
    );
  const engine = await createEngine(canvas, { msaaSamples: 4 }),
    scene = createSceneContext(engine);
  scene.clearColor = { r: 0.11, g: 0.14, b: 0.15, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, 0.63, 140, {
    x: 0,
    y: 0,
    z: 1,
  });
  scene.camera = camera;
  const ortho = enableOrthographicCamera(camera, { halfHeight: 30 });
  const ambient = createHemisphericLight([0, 1, 0], 0.55);
  ambient.groundColor = [0.3, 0.32, 0.38];
  addToScene(scene, ambient);
  const sun = createDirectionalLight([-0.6, -1, 0.45], graybox ? 0.85 : 2.2);
  sun.diffuse = [1, 0.85, 0.65];
  addToScene(scene, sun);
  let shadowGenerator;
  if (!graybox) {
    shadowGenerator = createPcfDirectionalShadowGenerator(engine, sun, {
      mapSize: 1024,
      bias: 0.0005,
      darkness: 0.25,
    });
    sun.shadowGenerator = shadowGenerator;
    addToScene(scene, shadowGenerator);
  }
  const pools = {};
  function shape(mesh, color, capacity = 1) {
    const mat = createStandardMaterial();
    mat.diffuseColor = rgb(color);
    mat.specularColor = [0.04, 0.04, 0.04];
    mesh.material = mat;
    const root = createTransformNode("effect");
    root.children.push(mesh);
    mesh.parent = root;
    const pool = createHierarchyInstancePool(root, capacity);
    addToScene(scene, root);
    return pool;
  }
  function put(pool, list) {
    setHierarchyInstanceCount(pool, Math.min(list.length, pool.capacity));
    list
      .slice(0, pool.capacity)
      .forEach((m, i) => setHierarchyInstanceMatrix(pool, i, m));
  }
  if (graybox) {
    const basePool = shape(createBox(engine), "#c59d65");
    put(basePool, [matrix(0, -1, 1, 0, 85, 2, 66)]);
    const road = shape(createBox(engine), "#a77945", 200);
    put(
      road,
      route.map((p, i) => {
        const n = route[(i + 1) % 200];
        return matrix(
          (p.x + n.x) / 2,
          terrainAt(p.x, p.z).height + 0.03,
          (p.z + n.z) / 2,
          Math.atan2(n.x - p.x, n.z - p.z),
          9,
          0.12,
          Math.hypot(n.x - p.x, n.z - p.z) + 0.25,
        );
      }),
    );
    for (let i = 1; i <= 4; i++)
      pools["truck-" + i] = shape(createBox(engine), COLORS[i - 1]);
    pools.wheel = shape(
      createSphere(engine, { diameter: 0.85, segments: 8 }),
      "#242a30",
      16,
    );
    pools.nitro = shape(createBox(engine), "#44cce8", 5);
    pools.traction = shape(createBox(engine), "#a2df64", 5);
  } else {
    await Promise.all(
      [
        "course",
        "truck-1",
        "truck-2",
        "truck-3",
        "truck-4",
        "wheel",
        "nitro",
        "traction",
      ].map(async (name) => {
        let asset;
        try {
          asset = await loadGltf(engine, base + "assets/" + name + ".glb");
        } catch {
          throw Error(
            `Unable to load ${name}.glb. Check the asset export and reload.`,
          );
        }
        // The Blender export root cancels Lite's default X reflection while
        // retaining the loader's authored winding/normal convention.
        pools[name] = createHierarchyInstancePool(
          asset.entities[0],
          name === "wheel"
            ? 16
            : name === "nitro" || name === "traction"
              ? 5
              : 1,
        );
        for (const mesh of pools[name].meshes) {
          mesh.receiveShadows = true;
        }
        addToScene(scene, asset);
      }),
    );
    put(pools.course, [matrix(0, 0, 0)]);
    if (shadowGenerator)
      setShadowTaskCasterMeshes(
        shadowGenerator,
        Object.values(pools)
          .flatMap((pool) => pool.meshes)
          .filter(
            (mesh) =>
              !/Quarry ground|track edge|racing dirt|Damp clay/.test(
                mesh.material.name,
              ),
          ),
      );
  }
  const shadows = shape(
      createSphere(engine, { diameter: 2, segments: 8 }),
      "#59482f",
      4,
    ),
    dust = shape(
      createSphere(engine, { diameter: 1, segments: 5 }),
      "#c8a574",
      80,
    ),
    skids = shape(createBox(engine), "#71512f", 120),
    rings = COLORS.map((c) =>
      shape(
        createTorus(engine, {
          diameter: 2.5,
          thickness: 0.075,
          tessellation: 20,
        }),
        c,
        1,
      ),
    );
  let state = null,
    me = null,
    disposed = false,
    frames = 0,
    fps = 0,
    lastFps = performance.now();
  const smooth = new Map(),
    pickupAvailability = new Map(),
    particles = [],
    marks = [];
  const labelNodes = COLORS.map((c, i) => {
    const el = document.createElement("span");
    el.className = "world-label";
    el.style.setProperty("--racer", c);
    labels.append(el);
    return el;
  });
  await enableMirroredMeshes(scene);
  if (shadowGenerator) await registerSceneWithShadowSupport(scene);
  else await registerScene(scene);
  onBeforeRender(scene, (delta) => {
    if (!state || disposed) return;
    const dt = state.animationPaused ? 0 : Math.min(delta / 1000, 0.06),
      now = performance.now();
    frames++;
    if (now - lastFps >= 1000) {
      fps = (frames * 1000) / (now - lastFps);
      frames = 0;
      lastFps = now;
    }
    const wheels = [],
      contact = [];
    for (const p of state.pickups) {
      const available = p.respawn <= 0;
      if (
        pickupAvailability.get(p.id) === true &&
        !available &&
        state.phase === "racing"
      ) {
        for (let j = 0; j < 8; j++)
          particles.push({
            x: p.x + Math.sin((j * Math.PI) / 4) * 0.5,
            y: terrainAt(p.x, p.z).height + 0.4,
            z: p.z + Math.cos((j * Math.PI) / 4) * 0.5,
            life: 0.6,
            scale: 0.2,
          });
      }
      pickupAvailability.set(p.id, available);
    }
    for (let i = 0; i < 4; i++) {
      const p = state.trucks.find((t) => t.number === i + 1),
        el = labelNodes[i];
      el.hidden = !p;
      if (!p) {
        put(pools["truck-" + (i + 1)], []);
        put(rings[i], []);
        continue;
      }
      if (p.id !== me) put(rings[i], []);
      let old = smooth.get(p.id) || {
        x: p.x,
        z: p.z,
        y: p.y,
        angle: p.angle,
        roll: 0,
      };
      const factor = p.id === me ? 1 : Math.min(1, dt * 14);
      old.x += (p.x - old.x) * factor;
      old.z += (p.z - old.z) * factor;
      old.y += (p.y - old.y) * factor;
      old.angle +=
        Math.atan2(
          Math.sin(p.angle - old.angle),
          Math.cos(p.angle - old.angle),
        ) * factor;
      old.roll += (Math.hypot(p.vx, p.vz) * dt) / 0.48;
      smooth.set(p.id, old);
      const speed = Math.hypot(p.vx, p.vz),
        bounce = p.grounded
          ? Math.sin(state.time * 17 + i) * Math.min(0.05, speed * 0.004)
          : 0,
        bodyY = old.y + bounce;
      const slip = p.vx * Math.cos(p.angle) - p.vz * Math.sin(p.angle),
        lean = Math.max(-0.1, Math.min(0.1, slip * 0.015)),
        pitch = p.grounded
          ? Math.sin(state.time * 17 + i) * Math.min(0.025, speed * 0.002)
          : Math.max(-0.16, Math.min(0.16, -p.vy * 0.025));
      put(pools["truck-" + (i + 1)], [
        graybox
          ? matrix(old.x, bodyY + 0.8, old.z, old.angle, 1.8, 0.8, 3.2)
          : chassisMatrix(old.x, bodyY, old.z, old.angle, pitch, lean),
      ]);
      for (const x of [-1, 1])
        for (const z of [-1.05, 1.05]) {
          const wx = old.x + x * Math.cos(old.angle) + z * Math.sin(old.angle),
            wz = old.z - x * Math.sin(old.angle) + z * Math.cos(old.angle);
          wheels.push(
            wheelMatrix(
              wx,
              old.y + 0.48,
              wz,
              old.angle + (z > 0 ? (p.steer || 0) * 0.35 : 0),
              old.roll,
            ),
          );
        }
      contact.push(
        matrix(
          old.x,
          terrainAt(old.x, old.z).height + 0.035,
          old.z,
          old.angle,
          1.1,
          0.025,
          1.7,
        ),
      );
      if (p.id === me)
        put(rings[i], [
          matrix(old.x, terrainAt(old.x, old.z).height + 0.06, old.z),
        ]);
      if (
        state.phase === "racing" &&
        !state.animationPaused &&
        ((old.grounded === false && p.grounded) || old.speed - speed > 3)
      ) {
        for (let j = 0; j < 8; j++)
          particles.push({
            x: old.x + Math.sin((j * Math.PI) / 4),
            y: old.y + 0.1,
            z: old.z + Math.cos((j * Math.PI) / 4),
            life: 0.45,
            scale: 0.22,
          });
      }
      old.grounded = p.grounded;
      old.speed = speed;
      if (
        state.phase === "racing" &&
        !state.animationPaused &&
        speed > 3 &&
        p.grounded &&
        Math.random() < 0.4
      ) {
        particles.push({
          x: old.x - Math.sin(old.angle) * 1.7,
          y: old.y + 0.12,
          z: old.z - Math.cos(old.angle) * 1.7,
          life: 0.6,
          scale: 0.25,
        });
        if (
          Math.abs(p.vx * Math.cos(p.angle) - p.vz * Math.sin(p.angle)) > 2 ||
          p.boosting
        )
          marks.push({
            x: old.x,
            z: old.z,
            y: old.y + 0.05,
            angle: old.angle,
            life: 4,
          });
      }
      const pos = projectWorldToScreen(
        { x: old.x, y: old.y + 2.5, z: old.z },
        getViewMatrix(camera),
        getViewProjectionMatrix(
          camera,
          canvas.clientWidth / canvas.clientHeight,
        ),
        {
          viewport: { x: 0, y: 0, width: canvas.width, height: canvas.height },
          backingWidth: canvas.width,
          backingHeight: canvas.height,
          cssWidth: canvas.clientWidth,
          cssHeight: canvas.clientHeight,
        },
      );
      el.hidden = pos.offscreen;
      el.style.transform = `translate(${pos.cssX}px,${pos.cssY}px) translate(-50%,-50%)`;
      el.textContent = `${i + 1}${p.id === me ? " · YOU" : p.bot ? " · AI" : ""}`;
    }
    put(pools.wheel, wheels);
    put(shadows, contact);
    particles.splice(0, Math.max(0, particles.length - 80));
    marks.splice(0, Math.max(0, marks.length - 120));
    for (const p of particles) {
      p.life -= dt;
      p.y += dt * 0.55;
      p.scale += dt * 0.4;
    }
    for (const m of marks) m.life -= dt;
    put(
      dust,
      particles
        .filter((p) => p.life > 0)
        .map((p) => matrix(p.x, p.y, p.z, 0, p.scale)),
    );
    put(
      skids,
      marks
        .filter((p) => p.life > 0)
        .map((p) => matrix(p.x, p.y, p.z, p.angle, 0.15, 0.015, 0.7)),
    );
    while (particles[0]?.life <= 0) particles.shift();
    while (marks[0]?.life <= 0) marks.shift();
    for (const kind of ["nitro", "traction"])
      put(
        pools[kind],
        state.pickups
          .filter((p) => p.kind === kind && p.respawn <= 0)
          .map((p) =>
            matrix(
              p.x,
              terrainAt(p.x, p.z).height +
                0.15 +
                Math.sin(state.time * 3) * 0.1,
              p.z,
              state.time,
              graybox ? 0.7 : 1,
            ),
          ),
      );
  });
  await startEngine(engine);
  const observer = new ResizeObserver(() => resizeEngine(engine));
  observer.observe(canvas);
  return {
    setState(g, id) {
      state = g;
      me = id;
    },
    get fps() {
      return fps;
    },
    get camera() {
      return {
        alpha: camera.alpha,
        beta: camera.beta,
        target: { ...camera.target },
        halfHeight: ortho.halfHeight,
      };
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      disposeScene(scene);
      labels.replaceChildren();
    },
  };
}
