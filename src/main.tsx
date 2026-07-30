import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { SettingsProvider } from "./context/SettingsContext.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';
import { SmoothScroller } from "./components/SmoothScroller";

// Register PWA Service Worker for offline support
registerSW({
  onNeedRefresh() {
  },
  onOfflineReady() {
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <SmoothScroller>
              <App />
            </SmoothScroller>
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// TODO: Consider adding more comprehensive JSDoc comments
