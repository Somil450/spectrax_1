import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { NotFound } from "./components/NotFound.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Register PWA Service Worker for offline support
const updateSW = registerSW({
  onNeedRefresh() {
  },
  onOfflineReady() {
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="*" element={<NotFound onGoHome={() => window.location.href = "/"} />} />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  </React.StrictMode>,
);
