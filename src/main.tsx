import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { HashRouter } from "react-router-dom";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for offline support
registerSW({
  onNeedRefresh() {
  },
  onOfflineReady() {
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);
