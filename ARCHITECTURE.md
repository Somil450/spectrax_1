# SpectraX — Architecture Overview

> This document gives any new contributor a clear mental model of the entire SpectraX system. Reading time: ~10 minutes.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Repository Structure](#2-repository-structure)
3. [Component Responsibilities](#3-component-responsibilities)
4. [Communication & Data Flow](#4-communication--data-flow)
5. [Full Workout Session — End-to-End Flow](#5-full-workout-session--end-to-end-flow)
6. [Key Technology Choices](#6-key-technology-choices)
7. [Where to Contribute](#7-where-to-contribute)

---

## 1. System Overview

SpectraX is an AI-powered fitness tracker that combines real-time computer-vision pose detection, multi-threaded angle computation, 3D skeleton visualisation, and persistent session analytics.

Three runtime processes cooperate at runtime:

```
┌──────────────────────────────────────────────────────────────────┐
│                     Browser (User's Device)                       │
│                                                                    │
│  React SPA (src/)                                                  │
│  ├── Main Thread                                                   │
│  │   ├── MediaPipe Pose WASM  ──→  cameraService / poseService    │
│  │   ├── useCameraPose hook   (orchestrates camera + pose)        │
│  │   ├── WorkoutScreen        (exercise engine, rep counting)      │
│  │   ├── CalibrationScreen    (body-type detection, alignment)     │
│  │   └── Firebase SDK         (Auth + Firestore reads/writes)      │
│  │                                                                  │
│  └── poseWorker.ts  (Web Worker — off main thread)                 │
│      ├── Receives landmarks via SharedArrayBuffer + Atomics        │
│      ├── Draws skeleton on OffscreenCanvas                         │
│      ├── Computes joint angles                                     │
│      ├── Detects exercise type (heuristic classifier)              │
│      └── OcclusionPredictor — extrapolates missing landmarks       │
│                                                                    │
│  activityWorker.ts  (separate Web Worker)                          │
│      └── activityClassificationService — heavier ML classification │
└──────────────────┬───────────────────────────────────────────────┘
                   │  WebSocket (Socket.io, websocket-only transport)
                   │  REST (Express routes)
┌──────────────────▼───────────────────────────────────────────────┐
│               Node.js / Express Backend  (server/)                │
│  ├── Socket.io server  — pose frame relay, session events         │
│  ├── Pose module       — server-side angle utils & feedback       │
│  ├── Session module    — in-memory store → disk (sessions/)       │
│  └── Health route      — liveness check                           │
└──────────────────┬───────────────────────────────────────────────┘
                   │  Firebase Admin SDK
┌──────────────────▼───────────────────────────────────────────────┐
│               Firebase (Google Cloud)                             │
│  ├── Authentication  (email/password + Google OAuth)              │
│  └── Firestore       (user profiles, session history, leaderboard)│
└───────────────────────────────────────────────────────────────────┘
```

The `spectrax_anomaly/` module is a self-contained TypeScript library (no Python) that runs post-session analysis using Z-score, MAD, or Isolation Forest algorithms on the recorded landmark frames.

---

## 2. Repository Structure

```
spectrax_1/
│
├── index.html                    # Vite entry point — mounts <div id="root">
├── vite.config.ts                # Build, PWA (vite-plugin-pwa), SharedArrayBuffer
│                                 # COOP/COEP headers for dev + preview servers
├── package.json                  # Frontend deps: React 18, Three.js, MediaPipe,
│                                 # Firebase, @xenova/transformers, Socket.io-client
├── tsconfig.json / tsconfig.node.json
├── jest.config.cjs               # Jest config for unit tests
├── firebase.json                 # Firebase Hosting + Firestore deploy config
├── firestore.rules               # Firestore security rules
├── vercel.json                   # Vercel deployment config
│
├── src/                          # ◀ ALL frontend source code
│   ├── main.tsx                  # React root — renders <App> into #root
│   ├── App.tsx                   # ★ Central router & state machine
│   │                             #   Manages Screen enum, navigateTo(),
│   │                             #   WorkoutStats, crash recovery, PWA toast
│   ├── HistoryPage.tsx           # Workout history list page
│   ├── SessionCard.tsx           # Single session card component
│   ├── useWorkoutHistory.ts      # Hook: loads session history from Firestore
│   │
│   ├── components/               # Screen-level & reusable UI components
│   │   ├── WorkoutScreen.tsx     # Live workout — camera, HUD, rep counter
│   │   ├── CalibrationScreen.tsx # Pre-workout camera alignment + body-type scan
│   │   ├── SummaryScreen.tsx     # Post-workout stats, calories, XP
│   │   ├── ReplayScreen.tsx      # Session replay using stored landmark frames
│   │   ├── Replay3DModel.tsx     # Three.js 3D skeleton replay renderer
│   │   ├── WelcomeScreen.tsx     # Landing / exercise selection
│   │   ├── LoginScreen.tsx       # Firebase email/Google auth
│   │   ├── SignUpScreen.tsx
│   │   ├── ForgotPasswordScreen.tsx
│   │   ├── TrophyRoom.tsx        # Badge & achievement showcase
│   │   ├── UserProfileScreen.tsx
│   │   ├── GroupLeaderboard.tsx  # Firestore-backed leaderboard
│   │   ├── ProgressChart.tsx     # Recharts-based progress visualisation
│   │   ├── AIRecommendations.tsx # Recommendation engine UI
│   │   ├── FitnessCalculator.tsx # BMI / calorie calculator tool
│   │   ├── WorkoutPanels.tsx     # Floating stats panels during workout
│   │   ├── WorkoutPlansScreen.tsx
│   │   ├── FpsMonitor.tsx / FpsOverlay.tsx  # Dev perf overlays
│   │   ├── NavBar.tsx            # Top navigation bar
│   │   ├── BadgeNotification.tsx # Global badge unlock toast
│   │   ├── PageErrorBoundary.tsx # Per-screen error boundaries
│   │   ├── CameraErrorBoundary.tsx
│   │   └── ...skeletons, empty states, scroll button, cursor glow
│   │
│   ├── config/
│   │   ├── exercises.ts          # ExerciseConfig registry — all supported
│   │   │                         # exercises with thresholds & primary joints
│   │   ├── badges.ts             # Badge definitions & unlock conditions
│   │   ├── firebase.ts           # initializeApp(); exports auth, db
│   │   └── poseLandmarks.ts      # MediaPipe landmark index constants
│   │
│   ├── context/
│   │   ├── AuthContext.tsx       # Firebase auth state — provides useAuth()
│   │   ├── ThemeContext.tsx      # cyber-dark / retro / light theme switcher
│   │   └── SettingsContext.tsx
│   │
│   ├── hooks/
│   │   ├── useCameraPose.ts      # ★ Orchestrates cameraService + poseService
│   │   │                         #   Manages frame loop, FPS throttle,
│   │   │                         #   interpolation toggle, error handling
│   │   ├── useWorkoutWebSocket.ts # Socket.io connection to backend
│   │   ├── useWorkoutSync.ts     # Syncs completed sessions to Firestore
│   │   ├── useAuth.ts            # Thin wrapper around AuthContext
│   │   ├── useBadges.ts          # Badge state + checkAndAwardBadges()
│   │   ├── useLeveling.ts        # XP / level progression system
│   │   ├── useOffscreenCanvas.ts # Manages OffscreenCanvas transfer to worker
│   │   ├── useFpsCounter.ts      # Rolling FPS measurement
│   │   ├── useNetworkStatus.ts   # Online/offline detection
│   │   ├── useDisplayConfig.ts
│   │   └── usePrefersReducedMotion.ts
│   │
│   ├── engine/
│   │   ├── feedbackEngine.ts     # Rule-based real-time form feedback generator
│   │   └── recommendationEngine.ts # Post-session AI recommendations
│   │
│   ├── services/                 # Pure logic, no React — used by hooks/components
│   │   ├── cameraService.ts      # getUserMedia, frame loop with FPS throttle
│   │   ├── poseService.ts        # MediaPipe Pose wrapper, sends frames to WASM
│   │   ├── overlayRenderer.ts    # Draws 2D landmark overlay on canvas
│   │   ├── exerciseEngine.ts     # Rep state machine — counts reps per exercise
│   │   ├── angleUtils.ts         # 2D joint angle calculation (CPU path)
│   │   ├── gpuAngleUtils.ts      # WebGL-accelerated angle computation
│   │   ├── calibrationLogic.ts   # Landmark visibility checks pre-workout
│   │   ├── calibrationStateEngine.ts  # FSM for calibration phases
│   │   ├── calibrationVisualRenderer.ts # Canvas drawing for calibration UI
│   │   ├── sessionRecorder.ts    # Records landmark frames during workout
│   │   ├── activityClassificationService.ts  # Feeds activityWorker
│   │   ├── kinematicEngine.ts    # Multi-joint kinematic chain analysis
│   │   ├── bodyTypeEngine.ts     # Classifies user body proportions
│   │   ├── gestureService.ts     # Hand gesture detection (e.g. start/stop)
│   │   ├── ghostService.ts       # Ghost skeleton overlay (compare to ideal)
│   │   ├── skeletalSense.ts      # Higher-level skeletal state reasoning
│   │   ├── occlusionPredictor.ts # Predicts/fills occluded landmarks
│   │   ├── frameInterpolationEngine.ts  # Smooths between pose frames
│   │   ├── performanceThrottleService.ts # Auto-reduces FPS under CPU pressure
│   │   ├── poseLockService.ts    # Locks pose detection during transitions
│   │   ├── clipEngine.ts         # Clips landmark coords to [0,1]
│   │   ├── audioService.ts / audioAlertService.ts  # Rep audio cues
│   │   ├── syncQueue.ts          # Offline-safe queue for Firestore writes
│   │   ├── workoutSyncService.ts # Batches and persists workout data
│   │   ├── volumetricFogEngine.ts / volumetricFogShaders.ts  # WebGL fog FX
│   │   ├── wristRotationDetector.ts
│   │   ├── Squat_depth_classifier.ts   # Squat-specific depth scoring
│   │   ├── Pushup_depth_classifier.ts  # Pushup-specific depth scoring
│   │   │
│   │   └── strategies/           # Strategy pattern — one class per exercise
│   │       ├── ExerciseStrategy.ts      # Interface / base class
│   │       ├── StrategyFactory.ts       # Returns correct strategy for exercise key
│   │       ├── SquatStrategy.ts
│   │       ├── PushupStrategy.ts
│   │       ├── BicepCurlStrategy.ts
│   │       ├── JumpingJackStrategy.ts
│   │       └── DefaultStrategy.ts
│   │
│   ├── workers/
│   │   ├── poseWorker.ts         # ★ Off-thread: skeleton drawing, angle calc,
│   │   │                         #   exercise detection, occlusion prediction
│   │   │                         #   Reads from SharedArrayBuffer via Atomics
│   │   └── activityWorker.ts     # Off-thread: heavier activity classification
│   │
│   ├── types/
│   │   ├── pose.ts               # PoseLandmark, PoseResult types
│   │   └── badge.ts              # Badge interface
│   │
│   ├── utils/
│   │   ├── calorieEstimator.ts   # MET-based calorie calculation
│   │   ├── streakUtils.ts        # Workout streak tracking
│   │   ├── fitnessCalculations.ts # BMI, VO2max helpers
│   │   ├── offlineQueue.ts       # IndexedDB-backed offline write queue
│   │   ├── avatarSkins.ts        # 3D model skin configs
│   │   ├── badgeIcons.ts         # Badge icon mappings
│   │   └── debounce.ts
│   │
│   ├── routes/
│   │   └── ProtectedRoute.tsx    # Redirects unauthenticated users to /login
│   │
│   └── styles/                   # Per-component CSS files
│
├── spectrax_anomaly/             # ◀ Self-contained anomaly detection library (TypeScript)
│   ├── INTEGRATION.md            # How to integrate with the main app
│   └── src/
│       ├── lib/
│       │   └── anomalyDetection.ts  # Core: extractFeatures(), detectAnomalies(),
│       │                            # findSimilarFrames(), smoothLandmarks()
│       │                            # Algorithms: Z-score, MAD, Isolation Forest
│       ├── hooks/
│       │   └── useAnomalyDetection.ts  # React hook wrapper for the library
│       ├── components/
│       │   └── AnomalyDetectionPanel.tsx  # UI panel for anomaly visualisation
│       └── types/
│           └── anomaly.ts           # PoseFrame, EnrichedFrame, AnomalyResult types
│
├── server/                       # ◀ Node.js / Express backend
│   ├── index.js                  # Entry point (imports server/src/app.js)
│   ├── package.json              # Server deps: express, socket.io, cors, fs
│   └── src/
│       ├── app.js                # ★ Creates Express app, HTTP server, Socket.io
│       │                         #   Configures CORS, JSON limit (100kb),
│       │                         #   socket auth token middleware,
│       │                         #   in-memory session Map, graceful shutdown
│       ├── app/
│       │   ├── createApp.js      # Express app factory
│       │   └── createServer.js   # HTTP + Socket.io server factory
│       ├── config/
│       │   ├── constants.js      # PORT (3001), SESSIONS_DIR, SOCKET_AUTH_TOKEN (server-only)
│       │   ├── cors.js           # CORS options builder
│       │   ├── env.js            # Env var validation
│       │   └── socket.js         # Socket.io config (websocket-only, ping tuning)
│       ├── middleware/
│       │   └── errorHandler.js   # Global Express error handler
│       ├── modules/
│       │   ├── pose/
│       │   │   ├── pose.socket.js      # Socket events: "pose_frame", "pose_result"
│       │   │   ├── pose.service.js     # Server-side pose processing logic
│       │   │   ├── feedback.service.js # Form feedback generation (server path)
│       │   │   ├── angle.utils.js      # Joint angle helpers (mirrors frontend)
│       │   │   └── pose.validator.js   # Validates incoming pose payloads
│       │   ├── session/
│       │   │   ├── session.socket.js   # Socket events: "session_start/end"
│       │   │   ├── session.service.js  # Session lifecycle logic
│       │   │   ├── session.store.js    # In-memory Map + disk persistence (sessions/)
│       │   │   └── session.validator.js
│       │   └── health/
│       │       ├── health.controller.js
│       │       └── health.routes.js    # GET /health
│       ├── shared/
│       │   ├── constants/
│       │   │   └── exercises.js        # Exercise keys shared with frontend
│       │   └── utils/
│       │       ├── logger.js
│       │       └── paths.js
│       └── socket/
│           └── handlers.js             # Registers all socket module handlers
│
├── scripts/
│   ├── setup_labels.sh           # GitHub label setup for GSSoC
│   └── verify-theme-security.js  # Checks theme CSS vars for security issues
│
└── public/
    ├── favicon.svg
    ├── icons.svg
    ├── model.glb                 # 3D avatar model for Replay3DModel.tsx
    └── assets/demos/             # Exercise demo videos (mp4) shown in UI
```

---

## 3. Component Responsibilities

### 3.1 App.tsx — Central Router

`App.tsx` is the single source of truth for navigation. It does **not** use React Router. Instead it manages a `Screen` enum and a `SCREEN_TRANSITIONS` map that defines which transitions are legal from each screen. Calling `navigateTo("summary")` from `"workout"` is allowed; calling it from `"history"` is blocked and logged.

Key state held in `App.tsx`:

- `currentScreen` — the active screen
- `selectedExercise` — the `ExerciseConfig` chosen in calibration
- `stats` — the `WorkoutStats` object passed to SummaryScreen and ReplayScreen
- `bodyType` / `adaptiveFactor` — body-proportion data from CalibrationScreen
- `pendingRecovery` — crash-recovery snapshot read from `localStorage` on mount

### 3.2 Camera & Pose Pipeline (`useCameraPose` → `cameraService` → `poseService`)

```
useCameraPose hook
  └── cameraService.startCamera()    getUserMedia → <video> element
  └── cameraService.startFrameLoop() rAF loop with adaptive FPS throttle
        └── poseService.send(frame)  sends each frame to MediaPipe WASM
  └── poseService.onResults(cb)      fires after WASM processes each frame
        └── cb(results)              → onResults prop → WorkoutScreen
```

`performanceThrottleService` monitors CPU pressure and reduces FPS from `initialFpsLimit` (default 20) down to `minFpsLimit` (default 10) in `fpsDecrementStep` increments.

### 3.3 poseWorker.ts — Off-Thread Processing

The pose worker receives landmark data and handles all work that would otherwise block the main thread:

- **Skeleton rendering** on an `OffscreenCanvas` (transferred via `initCanvas` message)
- **Joint angle computation** (`computeAngles`) — picks the best visible side (left vs right) and computes knee, elbow, shoulder, bodyLine, hipDepth angles
- **Exercise auto-detection** — heuristic classifier using angle thresholds (`detectExercise`)
- **Occlusion prediction** — `OcclusionPredictor` fills in missing landmarks; up to 5 consecutive dropout frames are extrapolated using linear velocity from the previous two observed frames
- **Ghost skeleton** rendering when `ghostLandmarks` are provided (shows ideal form side-by-side)

Communication modes (in priority order):

1. `SharedArrayBuffer` + `Atomics` (zero-copy, lowest latency) — used when COOP/COEP headers are present
2. Transferable `ArrayBuffer` (`buf`) — zero-copy but one-shot
3. Raw landmark array in message payload (fallback)

### 3.4 Exercise Strategy Pattern (`src/services/strategies/`)

Each exercise has a dedicated strategy class that encodes its rep-counting logic:

```
StrategyFactory.getStrategy("squat")  →  SquatStrategy
                              "pushup" →  PushupStrategy
                              "bicepCurl" → BicepCurlStrategy
                              "jumpingJack" → JumpingJackStrategy
                              * → DefaultStrategy
```

Each strategy implements `ExerciseStrategy` and receives the current joint angles on every frame. It manages its own phase FSM (e.g. `up → down → up` for a squat) and returns the updated rep count and any form feedback.

### 3.5 Anomaly Detection (`spectrax_anomaly/`)

Post-session analysis — not part of the live workout hot path. Operates on the array of `PoseFrame` objects recorded by `sessionRecorder.ts`.

**Pipeline:**

```
rawFrames[]
  → smoothLandmarks()        moving-average jitter reduction (window=5)
  → enrichFrames()           computes PoseFeatures per frame:
                               kneeLeft/Right, elbowLeft/Right,
                               hipFlexion, trunkLean,
                               shoulderSymmetry, wristHeight
  → detectAnomalies(options)  algorithm: 'zscore' | 'mad' | 'isoforest'
  → DetectionSummary          anomalyCount, worstFrame, summaryText,
                               per-frame AnomalyResult[]
```

**Algorithms:**

- **Z-score** (default) — flags frames where a feature deviates more than `threshold` (default 2.0) standard deviations from the session mean
- **MAD** (Modified Z-score) — uses median absolute deviation; robust when the session contains many bad-form frames
- **Isolation Forest** — pure TypeScript implementation; no per-feature breakdown but catches multivariate anomalies that Z-score misses

`findSimilarFrames()` uses cosine similarity on feature vectors to find the frames most similar to any given frame — useful for replay navigation.

### 3.6 Backend (`server/src/app.js`)

The backend is intentionally thin. Its responsibilities are:

- **Socket.io relay** — receives `pose_frame` events from the client, processes them server-side via `pose.service.js`, and can broadcast results to other sockets in the same room
- **Session persistence** — accumulates frames in an in-memory `Map<socketId, frame[]>` and flushes to disk (`sessions/`) on `session_end` or graceful shutdown
- **Auth middleware** — validates `SOCKET_AUTH_TOKEN` on every WebSocket connection (bypassed in development if unset). Browser clients authenticate via Firebase ID tokens instead of the shared secret. The server rejects `socket.handshake.query.token` (URL-sent tokens) to prevent token leakage via logs and referer headers.
- **Health check** — `GET /health` for uptime monitoring

The backend does **not** run MediaPipe. All pose inference happens client-side. The server receives already-processed angle data, not raw video.

### 3.7 Firebase

| Service            | How it's used                                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Authentication** | Email/password and Google OAuth. The Firebase UID is the Firestore document key for all user data. `AuthContext.tsx` exposes `user` and `loading` to the entire app. |
| **Firestore**      | Stores user profiles, per-session workout records, badge state, and leaderboard entries. `syncQueue.ts` + `offlineQueue.ts` buffer writes when the user is offline.  |

---

## 4. Communication & Data Flow

```
Webcam
  │ MediaStream (getUserMedia)
  ▼
cameraService.startFrameLoop()  — adaptive FPS, ~10–20fps
  │ video frame
  ▼
poseService.send(frame)
  │ processed by MediaPipe WASM
  ▼
poseService.onResults(results)
  │ 33 × {x,y,z,visibility} landmarks
  ├──────────────────────────────────────────────── write to SharedArrayBuffer
  │                                                        │
  │ (main thread)                                  poseWorker (Worker thread)
  │                                                        │
  ├── overlayRenderer (2D canvas overlay)          reads SharedArrayBuffer
  │                                                computes angles
  ├── exerciseEngine / Strategy                    detects exercise
  │   │ rep count, form score                      fills occluded landmarks
  │   ▼                                            draws skeleton on OffscreenCanvas
  │  WorkoutScreen state update                           │
  │   │                                            postMessage({ angles, detectedExercise,
  │   ├── HUD re-render (reps, accuracy, FPS)               confidence, ipcMs })
  │   │                                                      │
  │   └── feedbackEngine → audio cue              ◄─────────┘
  │
  ├── sessionRecorder.recordFrame(landmarks)  ← stores every frame in memory
  │
  └── useWorkoutWebSocket → Socket.io emit("pose_frame", { angles, timestamp })
                                   │
                             Express/Socket.io server
                             pose.service.js processes → can broadcast to room
                             session.store.js accumulates frames

On workout end:
  WorkoutStats  →  App.tsx (setStats)  →  navigateTo("summary")
  sessionRecorder.getFrames()  →  stored in SummaryScreen / passed to ReplayScreen
  workoutSyncService  →  Firestore  (via syncQueue, offline-safe)
  addWorkout()  →  useWorkoutSync hook  →  Firestore session document
```

---

## 5. Full Workout Session — End-to-End Flow

**Step 1 — Authentication**
`App.tsx` reads `AuthContext`. If Firebase is configured and no user is cached, it forces navigation to `LoginScreen`. On success, `navigateTo("welcome", true)` is called.

**Step 2 — Welcome Screen**
The user sees their XP/level (from `useLeveling`), existing badges, and a pending crash-recovery banner if a previous session was interrupted. They select an exercise or land on the default (squat). Tapping "Start" calls `navigateTo("calibration")`.

**Step 3 — Calibration (`CalibrationScreen`)**
`calibrationStateEngine.ts` runs a multi-phase FSM: camera check → landmark visibility check → body-type scan (`bodyTypeEngine.ts`) → ready. The detected `BodyType` and `adaptiveFactor` are lifted up to `App.tsx` and later passed to `WorkoutScreen` to adjust exercise thresholds.

**Step 4 — Live Workout (`WorkoutScreen`)**
This is the performance-critical hot path:

- `useCameraPose` starts the camera and frame loop
- Each frame goes to MediaPipe WASM → landmarks → written to `SharedArrayBuffer`
- `poseWorker` reads the buffer, draws the skeleton on `OffscreenCanvas`, computes angles, and posts results back
- The main thread uses returned angles to drive the exercise `Strategy` (rep counting) and `feedbackEngine` (form cues)
- `sessionRecorder` stores every landmark frame in memory for later replay
- Every rep fires a Socket.io `pose_frame` event to the backend
- `performanceThrottleService` reduces FPS if the device is struggling
- A `localStorage` snapshot is written on every rep update as crash recovery

**Step 5 — Summary (`SummaryScreen`)**
When the user ends the workout, `handleWorkoutEnd` in `App.tsx`:

1. Removes the crash-recovery snapshot from `localStorage`
2. Calls `leveling.addXpFromReps()` for XP
3. Calls `estimateCalories()` using exercise type, rep count, duration, and user weight
4. Calls `checkAndAwardBadges()` — new badges trigger `BadgeNotification`
5. Calls `addWorkout()` → Firestore via `syncQueue`
6. Sets `stats` and navigates to `"summary"`

**Step 6 — Replay (`ReplayScreen` + `Replay3DModel`)**
The stored landmark frames from `sessionRecorder` are played back through `Replay3DModel.tsx`, which maps them to the `model.glb` Three.js skeleton. The anomaly detection module can be run on these frames to highlight bad-form moments in the timeline.

---

## 6. Key Technology Choices

### SharedArrayBuffer + Atomics for Zero-Copy IPC

Pose landmark data (33 landmarks × 4 floats = 528 bytes) must travel from the main thread to `poseWorker` at up to 20fps. Using `postMessage` with a plain object copies the data on every frame. A `SharedArrayBuffer` lets both threads access the same memory; `Atomics.load` with a sequence-lock protocol ensures the worker never reads a half-written frame. This requires the server to set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` — configured in `vite.config.ts` for dev and in `vercel.json` / `firebase.json` for production.

### Strategy Pattern for Exercise Logic

Each exercise (squat, pushup, bicep curl, jumping jack) has meaningfully different rep-counting logic. A strategy class per exercise keeps each implementation isolated and independently testable. Adding a new exercise means adding one file to `src/services/strategies/` and registering it in `StrategyFactory.ts` and `src/config/exercises.ts`.

### MediaPipe Pose (Client-Side WASM)

All pose inference runs in the browser. No video is ever sent to any server. This protects user privacy, eliminates bandwidth costs, and removes server GPU requirements. The trade-off is that the first load must download the WASM binary, which is pre-cached by the PWA Workbox config.

### Three Anomaly Algorithms (Z-score, MAD, Isolation Forest)

A single algorithm would not suit all use cases. Z-score is fast and interpretable for normal sessions. MAD is preferred when many frames contain bad form (the mean gets skewed, making Z-score unreliable). Isolation Forest catches correlated multi-joint anomalies that single-feature methods miss, at higher compute cost. All three are pure TypeScript with no native dependencies, so they run in the browser without a server round-trip.

### Screen State Machine (No React Router)

The app uses a `SCREEN_TRANSITIONS` adjacency map instead of URL-based routing because the workout flow is modal and stateful — the browser back button should not be able to navigate away mid-workout. Illegal transitions are blocked and logged, preventing hard-to-reproduce bugs from out-of-order events.

### PWA (vite-plugin-pwa + Workbox)

SpectraX is packaged as a Progressive Web App. MediaPipe WASM, Three.js, and Firebase are split into named chunks and pre-cached by Workbox. This allows the full app to run offline after the first load, which matters for users in gyms with poor connectivity. The `offlineQueue` / `syncQueue` services buffer Firestore writes until the connection is restored.

### Adaptive FPS Throttling

`performanceThrottleService` monitors actual frame delivery and automatically reduces the target FPS on low-powered devices. This prevents the UI from freezing mid-workout. The range is configurable per use site (`initialFpsLimit`, `minFpsLimit`, `fpsDecrementStep` in `useCameraPose`).

---

## 7. Where to Contribute

Use this table to find the right file before opening a PR:

| Change type                       | Where to look                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| New exercise (rep counting logic) | Add `src/services/strategies/YourExercise.ts`, register in `StrategyFactory.ts` and `src/config/exercises.ts` |
| Exercise angle thresholds         | `src/config/exercises.ts` + the relevant Strategy file                                                        |
| Form feedback messages            | `src/engine/feedbackEngine.ts` + `server/src/modules/pose/feedback.service.js`                                |
| Skeleton / 3D visualisation       | `src/workers/poseWorker.ts` (live), `src/components/Replay3DModel.tsx` (replay)                               |
| Camera / frame loop behaviour     | `src/services/cameraService.ts`, `src/hooks/useCameraPose.ts`                                                 |
| Pose landmark processing          | `src/services/poseService.ts`, `src/workers/poseWorker.ts`                                                    |
| Anomaly detection algorithms      | `spectrax_anomaly/src/lib/anomalyDetection.ts`                                                                |
| Post-session analytics UI         | `src/components/SummaryScreen.tsx`, `src/components/ProgressChart.tsx`                                        |
| Auth / user profiles              | `src/context/AuthContext.tsx`, `src/components/LoginScreen.tsx`                                               |
| Firestore data model              | `src/config/firebase.ts`, `src/services/workoutSyncService.ts`                                                |
| Offline / sync behaviour          | `src/utils/offlineQueue.ts`, `src/services/syncQueue.ts`                                                      |
| Backend socket events             | `server/src/modules/pose/pose.socket.js`, `server/src/socket/handlers.js`                                     |
| Backend session storage           | `server/src/modules/session/`                                                                                 |
| PWA / caching behaviour           | `vite.config.ts` (Workbox config)                                                                             |
| CI / GitHub Actions               | `.github/workflows/ci.yml`                                                                                    |

> **Rule of thumb:** If it runs in the browser, touch `src/`. If it runs on the server process, touch `server/src/`. If it's post-session analysis that could run in either environment, touch `spectrax_anomaly/src/`.

---

_Please update this document when adding new modules, changing data-flow boundaries, or introducing new technology choices._
