import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const assets = new URL("../public/assets/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", assets), "utf8"),
);
assert.equal(
  manifest.reviewedInEngine,
  true,
  "Blender exports need gameplay-camera review in Babylon Lite",
);
for (const name of [
  "course",
  "truck-1",
  "truck-2",
  "truck-3",
  "truck-4",
  "wheel",
  "nitro",
  "traction",
  "prop-kit",
]) {
  const data = await readFile(new URL(name + ".glb", assets));
  assert.equal(data.toString("utf8", 0, 4), "glTF", name + " has GLB header");
  assert.equal(data.readUInt32LE(4), 2);
  assert.equal(data.readUInt32LE(8), data.length);
  const jsonLength = data.readUInt32LE(12),
    gltf = JSON.parse(data.toString("utf8", 20, 20 + jsonLength));
  assert(gltf.meshes?.length, name + " contains meshes");
  assert(
    !gltf.images?.some((image) => image.uri?.startsWith("/")),
    name + " uses portable textures",
  );
}
console.log("Reviewed Blender GLBs are present and structurally valid.");
