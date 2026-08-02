import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { rendererViteConfig } from "./vite.renderer.config";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, "electron/main/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: ".",
    ...rendererViteConfig,
    build: {
      rollupOptions: {
        input: {
          index: resolve(import.meta.dirname, "index.html"),
        },
      },
    },
  },
});
