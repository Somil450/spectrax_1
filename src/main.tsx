import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import "./index.css";
import { registerSW } from "./shims/registerSW";

// Register PWA Service Worker (no-op shim used when virtual module unavailable)
const updateSW = registerSW({
  onNeedRefresh() {
    console.log("PWA: Update available");
  },
  onOfflineReady() {
    console.log("PWA: Offline ready");
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);
