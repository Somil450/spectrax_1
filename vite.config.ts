/// <reference types="vitest" />

// Node 18.x compatibility: expose the web crypto API globally so that
// workbox-build's serialize-javascript can access it during the PWA build step.
// In Node 20.x this is already available by default.
import { webcrypto } from "node:crypto";
if (typeof globalThis.crypto === "undefined") {
  // @ts-expect-error -- webcrypto is compatible with the browser Crypto interface
  globalThis.crypto = webcrypto;
}

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const sharedArrayBufferHeaders = () => ({
  name: "shared-array-buffer-headers",
  configureServer(server: any) {
    server.middlewares.use((_: any, res: any, next: any) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });
  },
  configurePreviewServer(server: any) {
    server.middlewares.use((_: any, res: any, next: any) => {
      res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
      res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
      next();
    });
  },
});

export default defineConfig({
  esbuild: {
    target: "es2020",
  },
  plugins: [
    sharedArrayBufferHeaders(),
    react(),

    VitePWA({
      registerType: "prompt",

      includeAssets: ["favicon.svg"],

      manifest: {
        name: "SpectraX",
        short_name: "SpectraX",
        description: "AI-powered gesture recognition platform",
        theme_color: "#000000",
        background_color: "#000000",
        display: "standalone",
        start_url: "/",

        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        globPatterns: ["**/*.{js,css,html,ico,svg,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "mediapipe-assets",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.glb$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "glb-models",
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],

  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "vendor-three";
          if (id.includes("node_modules/firebase")) return "vendor-firebase";
          if (id.includes("node_modules/@xenova")) return "vendor-xenova";
          if (id.includes("src/workers/depthWorker")) return "vendor-xenova";
          if (id.includes("node_modules/@mediapipe")) return "vendor-mediapipe";
          if (id.includes("node_modules/react")) return "vendor-react";
        },
      },
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    exclude: ["server/**", "node_modules/**"],
    setupFiles: ["src/setupTests.ts"],
  },
} as any);
