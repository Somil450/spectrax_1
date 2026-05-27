/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  // Base URL of the backend server.
  // The client derives the WebSocket URL by replacing http with ws (https with wss).
  // Defaults to http://localhost:3001 when not set.
  // Set this in .env.local for any non-local deployment (see .env.example).
  readonly VITE_BACKEND_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}