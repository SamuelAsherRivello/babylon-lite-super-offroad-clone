import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repositoryRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "/babylon-lite-super-offroad-clone/",
  root: "project-name",
  server: {
    host: '127.0.0.1',
    fs: {
      allow: [repositoryRoot],
    },
  },
  build: {target: 'esnext'},
});
