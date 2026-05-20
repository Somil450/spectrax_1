import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('PWA: Update available');
  },
  onOfflineReady() {
    console.log('PWA: Offline ready');
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
