import { resolve } from "node:path";
import react from "@vitejs/plugin-react-swc";
import type { UserConfig } from "vite";

function injectTheme(source: string, filename: string): string {
  const normalizedFilename = filename.replaceAll("\\", "/");

  if (
    normalizedFilename.endsWith("/src/styles/_theme.scss") ||
    normalizedFilename.endsWith("/src/styles/global.scss")
  ) {
    return source;
  }

  return `@use "@/styles/theme" as *;\n${source}`;
}

export const rendererViteConfig = {
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src"),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: injectTheme,
      },
    },
  },
} satisfies UserConfig;
