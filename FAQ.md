# ❓ SpectraX FAQ

> Quick answers to the most common setup, runtime, and contribution questions for **SpectraX** — the AI-powered fitness tracker built for GSSoC'26.
>
> If your question isn't covered here, please open a [Discussion](https://github.com/Somil450/spectrax_1/discussions) or check the [Issues](https://github.com/Somil450/spectrax_1/issues) tab before filing a new one.

---

## 📑 Table of Contents

- [🧭 General](#-general)
- [⚙️ Prerequisites & Environment Setup](#%EF%B8%8F-prerequisites--environment-setup)
- [🚀 Installation & Running Locally](#-installation--running-locally)
- [🎥 Camera Permissions & Browser Access](#-camera-permissions--browser-access)
- [🧠 WASM, MediaPipe & ML Model Loading](#-wasm-mediapipe--ml-model-loading)
- [🐛 Common Runtime & Development Errors](#-common-runtime--development-errors)
- [🏗️ How SpectraX Works (For New Contributors)](#%EF%B8%8F-how-spectrax-works-for-new-contributors)
- [🤝 Contributing & GSSoC'26](#-contributing--gssoc26)
- [📚 Related Documentation](#-related-documentation)

---

## 🧭 General

### Q1. What is SpectraX and what does it do?

**SpectraX** is an AI-powered fitness companion that uses **MediaPipe Pose Detection** and **Three.js** to:

- Track exercises in real time through your webcam
- Count reps automatically (squats, pushups, and more)
- Score your form and give live posture feedback
- Render a 3D skeleton of your movement using WebGL
- Sync session data between frontend and backend over WebSockets

It is a full-stack web app: a **React + TypeScript + Vite** frontend and a small **Express + Socket.io** backend.

### Q2. Which browsers and devices are supported?

Any modern desktop browser with support for:

- The [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream) (`getUserMedia`)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) (required by Three.js)

Tested combinations: latest **Chrome**, **Edge**, **Firefox**, and **Safari** on desktop. Older browsers (Internet Explorer, very old Safari versions) are not supported.

### Q3. Can I use SpectraX on mobile?

Mobile browsers can run the app, but performance varies:

- **Android Chrome** generally works well.
- **iOS Safari** works but has stricter camera-permission rules (see [Q10](#q10-why-does-my-camera-work-on-chrome-but-not-on-safariios)).
- Pose detection is CPU/GPU-intensive — on low-end phones you may see reduced frame rates. Future optimization issues are tracked under the `enhancement` label.

---

## ⚙️ Prerequisites & Environment Setup

### Q4. What software do I need before I clone the repo?

| Requirement | Version | Notes |
|---|---|---|
| [Node.js](https://nodejs.org/) | **18.x or higher** | LTS recommended |
| npm or yarn | npm 9+ | Ships with Node 18 |
| Git | any recent version | |
| A modern browser | latest Chrome/Edge/Firefox/Safari | See [Q2](#q2-which-browsers-and-devices-are-supported) |
| Webcam | any USB or built-in | Required for pose features |
| A Firebase project | optional for local dev | Needed only for auth/storage features — see [Q6](#q6-do-i-need-a-firebase-account-just-to-run-spectrax-locally) |

### Q5. What environment variables do I need to configure?

The frontend reads its Firebase configuration from `.env.local` at the repo root. Start from the template:

```bash
cp .env.example .env.local
```

Then fill in the values from your Firebase project ([Firebase Console](https://console.firebase.google.com/) → Project settings → General → Your apps):

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

After editing `.env.local`, **restart the dev server** so Vite picks up the new values.

> ⚠️ Never commit `.env.local`. It's already covered by `.gitignore`.

### Q6. Do I need a Firebase account just to run SpectraX locally?

Not strictly — the **pose-detection and 3D visualization features run without Firebase**. You can leave the env values blank and still use the camera + rep-counting flow.

You **do** need Firebase if you want to:

- Sign in / sign up
- Save workout history
- Test features that read or write to Firestore

---

## 🚀 Installation & Running Locally

### Q7. How do I run both the frontend and backend?

SpectraX needs **two terminals** running side by side.

**Terminal 1 — backend (port 3001):**

```bash
cd server
npm install   # first time only
npm run dev   # or: npm start
```

**Terminal 2 — frontend (port 5173):**

```bash
npm install   # first time only
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

> 📝 The backend port defaults to **3001** and can be overridden via `PORT` in `server/.env`. The frontend reads `VITE_BACKEND_URL` from the root `.env` (defaults to `http://localhost:3001`), so you set the port in one place and both sides agree.

### Q8. How do I verify everything started correctly?

A healthy first run looks like this:

1. The **backend terminal** logs that Socket.IO is listening on port `3001`.
2. The **frontend terminal** shows the Vite ready banner with `Local: http://localhost:5173/`.
3. The browser opens to the SpectraX welcome screen with no red errors in the DevTools Console (`F12`).
4. After granting camera permission, the camera preview appears within ~1–2 seconds.

If any of these fail, jump to the relevant section below.

---

## 🎥 Camera Permissions & Browser Access

### Q9. The app says "Camera access denied or unavailable" — how do I fix it?

This error comes from [src/services/cameraService.ts](src/services/cameraService.ts) when `getUserMedia` is rejected. Re-enable camera access for `http://localhost:5173`:

| Browser | Steps |
|---|---|
| **Chrome** | Click the 🔒/ℹ️ icon left of the URL → Site settings → Camera → **Allow**. Or visit `chrome://settings/content/camera`. |
| **Edge** | 🔒 icon → Permissions for this site → Camera → **Allow**. Or `edge://settings/content/camera`. |
| **Firefox** | 🔒 icon → Connection secure → More information → Permissions → Camera → uncheck **Block**. Or `about:preferences#privacy`. |
| **Safari** | Safari → Settings → Websites → Camera → set localhost to **Allow**. |

After changing the setting, **reload the page** (`Ctrl/Cmd + R`).

### Q10. Why does my camera work on Chrome but not on Safari/iOS?

Safari and iOS have stricter rules than Chromium-based browsers:

- The page **must be served over HTTPS** — or be exactly `http://localhost` / `http://127.0.0.1`. Custom hostnames over HTTP will be silently blocked.
- iOS Safari requires the camera request to happen **inside a user gesture** (a click or tap). If you reload via JS or navigate programmatically, the prompt may not appear.
- Installed PWA contexts sometimes restrict camera access further.

If you're testing on a phone against your dev machine, see [Q11](#q11-camera-works-locally-but-not-when-i-deploy--what-changed).

### Q11. Camera works locally but not when I deploy — what changed?

All major browsers **require HTTPS for `getUserMedia` outside `localhost`**. For deployed environments:

- Use a host with TLS (Vercel, Netlify, Render, etc. — they default to HTTPS).
- For quick external testing, tunnel your local dev server with **ngrok**, **cloudflared**, or **localtunnel** — they expose your `localhost:5173` over HTTPS.

### Q12. The camera light is on but I see a black video frame.

Common causes:

- Another tab or app (Zoom, Meet, OBS, virtual-camera drivers) is holding the device.
- OS-level camera privacy is disabled. Check:
  - **Windows:** Settings → Privacy & security → Camera → ensure browser access is on.
  - **macOS:** System Settings → Privacy & Security → Camera → tick your browser.
- A virtual-camera driver (Snap Camera, OBS Virtual Camera) is selected as default — disable it and reload.

---

## 🧠 WASM, MediaPipe & ML Model Loading

### Q13. What is MediaPipe loading from a CDN, and why does the first load take time?

MediaPipe Pose is loaded from **jsDelivr** at runtime — see [index.html](index.html) and [src/services/poseService.ts](src/services/poseService.ts). On the first visit it downloads:

- `pose.js` (the JS wrapper)
- `pose_solution_simd_wasm_bin.wasm` / `.js` (the WebAssembly runtime)
- `pose_landmark_*.tflite` / `.data` (the model weights)

Combined, these are roughly **5–15 MB**. After the first load they sit in the browser's HTTP cache, so subsequent reloads are near-instant.

### Q14. The page loads but pose detection never starts — how do I debug?

Open **DevTools → Network** and filter by `mediapipe`. You should see several requests to `cdn.jsdelivr.net/npm/@mediapipe/pose/...` returning HTTP 200, including `.wasm` and `.data` files.

If those requests are blocked or 4xx/5xx:

- **Ad blockers / privacy extensions** (uBlock Origin, Brave Shields) sometimes block CDN requests — pause them for `localhost:5173`.
- **Corporate proxies** may block jsDelivr — try a different network.
- **Content-Security-Policy** headers added by a browser extension can block WASM evaluation. Disable extensions and reload.

### Q15. I see "PoseService: too many errors, attempting reset…" in the console.

This is **expected auto-recovery** wired into [src/services/poseService.ts](src/services/poseService.ts). After ~10 consecutive bad frames, the service reinitializes MediaPipe instead of staying stuck.

If you see it persistently:

- Lower the camera resolution (some integrated webcams struggle at 1280×720).
- Make sure **hardware acceleration** is on in your browser (`chrome://settings/system` → "Use graphics acceleration").
- Close other tabs that are also using the camera or heavy GPU.

### Q16. Transformers.js / Xenova model fails to load.

The activity classifier ([src/workers/activityWorker.ts](src/workers/activityWorker.ts)) lazy-loads the `Xenova/clip-vit-base-patch32` model from **Hugging Face**. Because `env.allowLocalModels = false`, the worker must reach `huggingface.co` over the network.

Common causes of failure:

- Corporate firewalls that block `huggingface.co`.
- Browser cache corruption — open DevTools → Application → Clear storage and reload.
- Slow first download (model is ~150 MB) — give it a minute before assuming failure.

### Q17. Can I run SpectraX fully offline?

Not today — both MediaPipe and Transformers.js are loaded from public CDNs by default. Self-hosting the WASM and model files is technically possible (MediaPipe accepts a custom `locateFile` callback) but is out of scope for the default setup. If you want to help add an offline mode, open a Discussion or issue under the `enhancement` label.

---

## 🐛 Common Runtime & Development Errors

### Q18. `npm run lint` fails with warnings — what's expected?

The lint script runs with `--max-warnings 0`, so **every warning blocks the build**. Before committing:

```bash
npm run lint -- --fix
npm run lint
```

The first command auto-fixes anything it can; the second confirms a clean exit. CI runs the same command, so a passing local lint should pass CI.

### Q19. Vite says "Port 5173 is already in use."

Either another Vite session is still alive, or another app is using the port. Two options:

```bash
# free the port (Windows / macOS / Linux)
npx kill-port 5173

# or start on a different port
npm run dev -- --port 5174
```

If you pick a new port, the camera permission still works because both are on `localhost`.

### Q20. Frontend can't connect to the backend ("xhr poll error" / Socket.io disconnect).

Checklist:

1. Confirm the backend terminal is still running on `:3001`.
2. The backend has `cors: { origin: '*' }` and `transports: ['websocket']` ([server/index.js](server/index.js)) — make sure no corporate proxy is stripping WebSocket upgrades.
3. Reload the frontend tab after the backend starts.
4. If you changed the backend port, update the Socket.io client URL in the frontend code to match.

### Q21. Build fails with a TypeScript error after I pulled `main`.

A new dependency or type change is likely. From the repo root:

```bash
npm install
cd server && npm install && cd ..
```

Then restart your editor's TypeScript server (in VS Code: `Ctrl/Cmd + Shift + P` → "TypeScript: Restart TS Server"). Run `npm run build` again.

### Q22. White/blank screen after `npm run build && npm run preview`.

Open DevTools Console. Typical culprits:

- **Missing env vars in production build** — Vite inlines `VITE_*` vars at build time, so make sure `.env.local` (or `.env.production`) is populated **before** running `npm run build`.
- **Sub-path deployment** — if you're serving under `/spectrax/` instead of `/`, set `base` in [vite.config.ts](vite.config.ts) accordingly and rebuild.
- **Service worker** caching an older build — unregister it from DevTools → Application → Service Workers.

---

## 🏗️ How SpectraX Works (For New Contributors)

### Q23. How does the pose detection / rep counting pipeline work end-to-end?

The full path from your webcam to a rep count, in five steps:

1. **Camera capture** — [src/services/cameraService.ts](src/services/cameraService.ts) calls `navigator.mediaDevices.getUserMedia` and attaches the stream to a hidden `<video>` element at 1280×720 / 30 fps.
2. **Pose inference** — [src/services/poseService.ts](src/services/poseService.ts) hands each frame to MediaPipe Pose, which returns 33 body landmarks (x, y, z, visibility).
3. **Angle computation** — [src/workers/poseWorker.ts](src/workers/poseWorker.ts) runs in a Web Worker so the math doesn't block the UI thread; it computes joint angles (knee, elbow, hip) from the landmarks.
4. **Activity classification** — [src/workers/activityWorker.ts](src/workers/activityWorker.ts) uses Transformers.js with a CLIP vision model to detect which exercise is being performed.
5. **Server sync** — the backend ([server/index.js](server/index.js)) mirrors the same angle math so reps stay consistent across devices that join the same Socket.io session.

This separation (camera → pose → worker → classifier → server) makes it easy to swap any single piece without touching the others — perfect for first contributions.

---

## 🤝 Contributing & GSSoC'26

### Q24. How do I contribute as a GSSoC'26 participant?

The full process lives in [CONTRIBUTING.md](CONTRIBUTING.md). In short:

1. Browse open issues labeled `gssoc-26`, `good first issue`, `level1`, `level2`, or `level3`.
2. Comment on the issue you want, using the standard template:
   > I would like to work on this issue under GSSoC'26. Please assign it to me.
3. **Wait for a maintainer to assign the issue to you** before writing any code.
4. Fork the repo, branch with the right prefix (`feature/`, `bugfix/`, `docs/`, `refactor/`, or `test/`), and commit with the right prefix (`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`).
5. Open a PR that references the issue (e.g. `Fixes #37`) and fills in the PR template.

### Q25. How do I report a bug or request a feature?

Open a new issue using the appropriate template in [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/). Include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser, OS, and any console errors
- For features: the user-facing problem you're trying to solve, not just the implementation idea

Do **not** start coding until a maintainer assigns the issue to you — unassigned PRs may be closed per the contribution rules.

### Q26. Where should I ask if I'm stuck during setup?

In order of preference:

1. Re-read this FAQ and [CONTRIBUTING.md](CONTRIBUTING.md) — most setup issues are covered.
2. Search the [Issues](https://github.com/Somil450/spectrax_1/issues) tab — someone may have already hit it.
3. Open a [Discussion](https://github.com/Somil450/spectrax_1/discussions) describing your environment and what you've tried.
4. Comment on the issue assigned to you so the maintainer sees context.

Be specific: paste the exact error message, your Node version (`node -v`), your OS, and a screenshot of the DevTools console if it's a runtime problem. Vague "it doesn't work" reports are hard to help with.

---

## 📚 Related Documentation

- [README.md](README.md) — overview, installation, usage
- [CONTRIBUTING.md](CONTRIBUTING.md) — branch naming, commit format, PR process
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — community standards

---

<div align="center">

**SpectraX** — built for GSSoC'26 contributors. Happy hacking! 🚀

</div>
