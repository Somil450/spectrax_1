import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

let VitePWA: any;
try {
  // dynamic import so build doesn't fail when plugin isn't installed in CI environment
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = await import("vite-plugin-pwa");
  VitePWA = mod?.VitePWA || mod?.default;
} catch (err) {
  VitePWA = () => null;
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA &&
      VitePWA({
        registerType: "autoUpdate",

        includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],

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
              src: "/pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
          ],
        },

        workbox: {
          maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
        },
      }),
  ].filter(Boolean),
});
