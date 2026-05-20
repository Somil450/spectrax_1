import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

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
            purpose: "any"
          },
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "maskable"
          }
        ]
      },

      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024
      }
    })
  ]
});