# SpectraX Backend — API Reference

> Complete reference for every HTTP endpoint and WebSocket event exposed by the SpectraX backend server.
> Any contributor should be able to read this document and call the API without reading any source code.

---

## Table of Contents

1. [Base URL & Configuration](#1-base-url--configuration)
2. [Authentication](#2-authentication)
3. [HTTP Endpoints](#3-http-endpoints)
   - [GET /health](#get-health)
4. [WebSocket Connection](#4-websocket-connection)
   - [Connecting](#connecting)
   - [Socket Authentication](#socket-authentication)
5. [WebSocket Events — Client → Server](#5-websocket-events--client--server)
   - [frame](#frame)
   - [session:end](#sessionend)
6. [WebSocket Events — Server → Client](#6-websocket-events--server--client)
   - [feedback](#feedback)
7. [Data Schemas](#7-data-schemas)
   - [PoseLandmark](#poseblandmark)
   - [AnglesMap](#anglesmap)
   - [FeedbackPayload](#feedbackpayload)
   - [SessionFrame](#sessionframe)
8. [Error Handling](#8-error-handling)
9. [Rate Limiting](#9-rate-limiting)
10. [Session Lifecycle](#10-session-lifecycle)
11. [Environment Variables](#11-environment-variables)

---

## 1. Base URL & Configuration

The backend runs on **port 3001** by default.

| Environment       | Base URL                                               |
| ----------------- | ------------------------------------------------------ |
| Local development | `http://localhost:3001`                                |
| Production        | Set via `VITE_BACKEND_URL` in the frontend `.env` file |

**Frontend `.env` example:**

```
VITE_BACKEND_URL=http://localhost:3001
```

**Backend `.env` example** (see `server/.env.example`):

```
PORT=3001
ALLOWED_ORIGIN=http://localhost:5173
SOCKET_AUTH_TOKEN=your-secret-token
HEALTH_SECRET_TOKEN=your-health-token
MAX_FRAMES_PER_SEC=60
SESSION_FILE_TTL_DAYS=7
CLEANUP_INTERVAL_HOURS=24
```

---

## 2. Authentication

### HTTP Requests

The `/health` endpoint is publicly accessible but returns limited data. Pass a Bearer token to receive full metrics:

```
Authorization: Bearer <HEALTH_SECRET_TOKEN>
```

All other HTTP requests require no authentication.

### WebSocket Connections

Browser clients authenticate via **Firebase Auth ID tokens**. The token is passed as a
`firebaseToken` query parameter in the raw WebSocket URL. The built-in `useWorkoutWebSocket`
hook obtains the Firebase ID token automatically via `auth.currentUser.getIdToken()`.

A `SOCKET_AUTH_TOKEN` env var is available for **machine-to-machine / proxy authentication**
only. It is validated via `socket.handshake.auth.token` and is **not** used by browser clients.

- The `VITE_SOCKET_AUTH_TOKEN` client env var has been **removed** — shared secrets
  must never be embedded in client bundles where they are publicly visible.
- The server does **not** accept tokens via `socket.handshake.query.token` (URL query
  parameters) because they leak in logs, browser history, and referer headers.

---

## 3. HTTP Endpoints

### GET /health

Returns the server liveness status. Used by uptime monitors and deployment health checks.

**Request**

```
GET /health
```

No request body. No required headers for the basic response.

**Response — unauthenticated (or non-localhost)**

```json
{
  "status": "ok"
}
```

**Response — authenticated (`Authorization: Bearer <HEALTH_SECRET_TOKEN>`) or localhost**

```json
{
  "status": "ok",
  "activeSessions": 3,
  "uptime": 4821
}
```

| Field            | Type     | Description                                                                    |
| ---------------- | -------- | ------------------------------------------------------------------------------ |
| `status`         | `string` | Always `"ok"` when the server is running                                       |
| `activeSessions` | `number` | Number of currently connected Socket.io clients (authenticated/localhost only) |
| `uptime`         | `number` | Server process uptime in seconds (authenticated/localhost only)                |

**Status Codes**

| Code  | Meaning           |
| ----- | ----------------- |
| `200` | Server is healthy |

---

## 4. WebSocket Connection

SpectraX uses **Socket.io** over a **WebSocket-only transport** (HTTP long-polling is disabled for latency reasons).

### Connecting

```javascript
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  transports: ["websocket"], // Required — polling is disabled server-side
  auth: { token: "your-token" }, // Required — see Authentication section
});

socket.on("connect", () => {
  console.log("Connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("Connection failed:", err.message);
  // err.message === "Unauthorized" if token is wrong
});
```

### Socket Authentication

The auth token is checked in the Socket.io middleware before the `connection` event fires. A rejected connection will emit `connect_error` on the client side and never proceed to sending events.

---

## 5. WebSocket Events — Client → Server

### `frame`

Sends a single pose frame from the client for server-side processing. The server computes joint angles, generates form feedback, stores the frame in the rolling session buffer, and immediately emits a [`feedback`](#feedback) event back.

**Emit:**

```javascript
socket.emit("frame", {
  landmarks: [...],    // Array of PoseLandmark objects — see schema below
  timestamp: 1718100000000,
  exercise: "squat"   // Optional — defaults to DEFAULT_EXERCISE if omitted or unsupported
});
```

**Payload fields:**

| Field       | Type             | Required | Description                                                                                                                          |
| ----------- | ---------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `landmarks` | `PoseLandmark[]` | Yes      | Array of 29–33 MediaPipe pose landmark objects                                                                                       |
| `timestamp` | `number`         | Yes      | Frame timestamp — any finite number (typically `Date.now()` or `performance.now()`)                                                  |
| `exercise`  | `string`         | No       | Exercise key (e.g. `"squat"`, `"pushup"`, `"bicepCurl"`). Falls back to the default exercise if the value is unsupported or missing. |

**Validation rules** (frames failing any rule are dropped or return a degraded feedback response):

| Rule                                                 | Behaviour on failure                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `landmarks` must be an array                         | Emits `feedback` with `status: "yellow"`, `feedback: "Acquiring pose..."` |
| `landmarks.length` must be between 29 and 33         | Same as above                                                             |
| Every landmark must have numeric `x` and `y`         | Same as above                                                             |
| `timestamp` must be a finite number                  | Same as above                                                             |
| Frame rate exceeds `MAX_FRAMES_PER_SEC` (default 60) | Frame is silently dropped; no `feedback` emitted                          |

**Rate limiting:** The server uses a sliding 1-second window. Frames beyond `MAX_FRAMES_PER_SEC` in any 1-second window are discarded. The default limit is 60 fps but is configurable via the `MAX_FRAMES_PER_SEC` environment variable.

**Session buffer:** Each frame is appended to an in-memory rolling buffer (max 300 frames per socket). When the buffer is full, the oldest frame is evicted. This buffer is persisted to disk on `session:end` or disconnect.

---

### `session:end`

Signals that the user has intentionally ended their workout session. The server finalises and persists the in-memory frame buffer to disk, then clears it.

**Emit:**

```javascript
socket.emit("session:end");
```

No payload required.

**Behaviour:**

- All buffered frames for the socket are written to a JSON file in the `sessions/` directory on the server.
- The in-memory buffer for this socket is cleared.
- Duplicate calls for the same socket within the same session are ignored (idempotent via `finalizedSessions` guard).
- If the client disconnects without sending `session:end`, the server auto-saves on the `disconnect` event.

---

## 6. WebSocket Events — Server → Client

### `feedback`

Emitted by the server in direct response to each valid `frame` event. Contains the processed angles, form corrections, and status colour for the live workout HUD.

**Listen:**

```javascript
socket.on("feedback", (data) => {
  console.log(data.status); // "green" | "yellow" | "red"
  console.log(data.feedback); // "Good form!" or a correction message
  console.log(data.angles); // { knee: 145, elbow: 78, ... }
  console.log(data.corrections); // ["Keep your back straight"]
});
```

**Payload fields:**

| Field         | Type             | Description                                                                                   |
| ------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `angles`      | `AnglesMap`      | Computed joint angles for the frame. Empty object `{}` on error.                              |
| `corrections` | `string[]`       | List of specific form corrections to display. Empty array if form is good.                    |
| `status`      | `string`         | `"green"` (good form) · `"yellow"` (acquiring / minor issue) · `"red"` (bad form or error)    |
| `feedback`    | `string`         | Human-readable summary feedback message                                                       |
| `timestamp`   | `number \| null` | Echoed back from the original `frame` payload. `null` if the original had no valid timestamp. |

**`status` values explained:**

| Value      | Meaning                                                 |
| ---------- | ------------------------------------------------------- |
| `"green"`  | Pose is valid and form is acceptable                    |
| `"yellow"` | Pose landmarks are not yet visible or confidence is low |
| `"red"`    | Form is incorrect or a processing error occurred        |

**Error case** — emitted when `processPose` throws:

```json
{
  "angles": {},
  "corrections": [],
  "status": "red",
  "feedback": "Error processing pose",
  "timestamp": 1718100000000
}
```

---

## 7. Data Schemas

### PoseLandmark

A single body keypoint from MediaPipe Pose. The array sent in `frame` contains 29–33 of these objects, ordered by MediaPipe landmark index (0 = nose, 11 = left shoulder, 23 = left hip, etc.).

```typescript
interface PoseLandmark {
  x: number; // Normalised horizontal position [0.0 – 1.0]
  y: number; // Normalised vertical position [0.0 – 1.0]
  z?: number; // Depth estimate (optional, relative to hip midpoint)
  visibility?: number; // Landmark confidence [0.0 – 1.0]
}
```

**Key landmark indices** (matches MediaPipe Pose model):

| Index | Landmark       |
| ----- | -------------- |
| 0     | Nose           |
| 11    | Left shoulder  |
| 12    | Right shoulder |
| 13    | Left elbow     |
| 14    | Right elbow    |
| 15    | Left wrist     |
| 16    | Right wrist    |
| 23    | Left hip       |
| 24    | Right hip      |
| 25    | Left knee      |
| 26    | Right knee     |
| 27    | Left ankle     |
| 28    | Right ankle    |

---

### AnglesMap

Object returned in the `feedback` event. Fields present depend on which joints are visible and which exercise is active.

```typescript
interface AnglesMap {
  knee?: number; // Active-side knee angle (degrees)
  elbow?: number; // Active-side elbow angle (degrees)
  shoulder?: number; // Active-side shoulder angle (degrees)
  bodyLine?: number; // Shoulder–hip–ankle alignment angle (degrees)
  hipDepth?: number; // Hip depth as % of total body height
  pushupDepthZ?: number; // Shoulder–wrist Z-axis distance × 100
  jumpingJackArmOpen?: number; // Average arm opening angle for jumping jacks
  jumpingJackLegSpread?: number; // Ankle gap as % of hip width (capped at 300)
  lungeKnee?: number; // Active-knee angle for lunge exercises
  kneePastToes?: number; // 1 if knee tracks past toes, 0 otherwise
  backKnee?: number; // Rear-leg knee angle during lunge
}
```

All angle values are in **degrees**, rounded to the nearest integer.

---

### FeedbackPayload

The complete object emitted on the `feedback` event.

```typescript
interface FeedbackPayload {
  angles: AnglesMap;
  corrections: string[];
  status: "green" | "yellow" | "red";
  feedback: string;
  timestamp: number | null;
}
```

---

### SessionFrame

The shape of each frame stored in the server's session buffer and written to disk.

```typescript
interface SessionFrame {
  timestamp: number;
  landmarks: PoseLandmark[];
  angles: AnglesMap;
  feedback: string;
  exercise: string;
}
```

**Persisted session file format** (written to `server/sessions/<socketId>-<timestamp>.json`):

```json
{
  "savedAt": "2026-06-11T10:30:00.000Z",
  "socketId": "abc123XYZ",
  "frameCount": 247,
  "frames": [
    {
      "timestamp": 1718100000000,
      "landmarks": [...],
      "angles": { "knee": 145, "elbow": 78 },
      "feedback": "Good squat depth!",
      "exercise": "squat"
    }
  ]
}
```

Session files are automatically deleted after `SESSION_FILE_TTL_DAYS` days (default 7). Cleanup runs every `CLEANUP_INTERVAL_HOURS` hours (default 24).

---

## 8. Error Handling

### Connection Errors

| Error message                                             | Cause                                                                     | Fix                                               |
| --------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `"Unauthorized"`                                          | `auth.token` in the Socket.io handshake doesn't match `SOCKET_AUTH_TOKEN` | Set the env var on the server or use a non-browser client |
| `"Server misconfiguration: SOCKET_AUTH_TOKEN is not set"` | `SOCKET_AUTH_TOKEN` env var is missing in production                      | Set the env var on the server                     |
| `"Authentication failed: invalid or missing token"`       | Browser client connected without a valid Firebase ID token                | Ensure the user is signed in via Firebase Auth    |

### Frame Processing Errors

If `processPose` throws for any reason, the server emits `feedback` with `status: "red"` and `feedback: "Error processing pose"` rather than crashing. The session buffer is unaffected — the errored frame is not stored.

### Session Save Errors

If writing a session file fails (e.g. disk full, permissions), the error is logged server-side. The socket session is still cleaned up. No error is emitted to the client.

---

## 9. Rate Limiting

The server enforces a per-socket frame rate limit using a **sliding 1-second window**.

| Parameter                    | Default | Override                                           |
| ---------------------------- | ------- | -------------------------------------------------- |
| Max frames per second        | `60`    | `MAX_FRAMES_PER_SEC` env var                       |
| Max frames in session buffer | `300`   | Hardcoded (`MAX_SESSION_FRAMES` in `constants.js`) |
| HTTP request body limit      | `100kb` | Hardcoded (`PAYLOAD_LIMIT` in `constants.js`)      |

Frames exceeding the rate limit are silently dropped — no `feedback` event is emitted and no error is returned. The client's workout continues unaffected.

---

## 10. Session Lifecycle

```
Client connects
  └── Server creates empty frame buffer for socket.id
        │
        │  socket.emit("frame", ...) × N
        ▼
      Server processes each frame → emits "feedback"
      Server appends frame to rolling buffer (max 300)
        │
        ├── Client sends socket.emit("session:end")
        │     └── Server saves buffer to disk → clears buffer
        │
        └── Client disconnects without "session:end"
              └── Server auto-saves buffer to disk → clears buffer
```

**Important:** `session:end` and `disconnect` are both handled idempotently. If both fire in quick succession (e.g. page close), the session is only saved once.

---

## 11. Environment Variables

Full reference for all environment variables consumed by the backend.

| Variable                 | Default | Required         | Description                                                     |
| ------------------------ | ------- | ---------------- | --------------------------------------------------------------- |
| `PORT`                   | `3001`  | No               | Port the HTTP server listens on                                 |
| `ALLOWED_ORIGIN`         | —       | Yes (production) | CORS allowed origin — set to your frontend URL                  |
| `CORS_ORIGIN`            | —       | No               | Alias for `ALLOWED_ORIGIN` (legacy)                             |
| `SOCKET_AUTH_TOKEN`      | `null`  | Server-only      | Shared secret for machine-to-machine/proxy auth via `socket.handshake.auth.token`. **Do not** expose in client bundles — use Firebase Auth tokens for browser clients instead |
| `HEALTH_SECRET_TOKEN`    | —       | No               | Bearer token that grants full metrics on `GET /health`          |
| `MAX_FRAMES_PER_SEC`     | `60`    | No               | Per-socket frame rate ceiling                                   |
| `SESSION_FILE_TTL_DAYS`  | `7`     | No               | How many days before session files are auto-deleted             |
| `CLEANUP_INTERVAL_HOURS` | `24`    | No               | How often the session cleanup job runs                          |
| `NODE_ENV`               | —       | No               | Set to `production` to enforce `SOCKET_AUTH_TOKEN` requirement  |

---

## Quick Reference

### HTTP

| Method | Path      | Auth            | Description           |
| ------ | --------- | --------------- | --------------------- |
| `GET`  | `/health` | Optional Bearer | Server liveness check |

### WebSocket Events

| Direction       | Event         | Payload                                                | Description                           |
| --------------- | ------------- | ------------------------------------------------------ | ------------------------------------- |
| Client → Server | `frame`       | `{ landmarks, timestamp, exercise? }`                  | Send a pose frame for processing      |
| Client → Server | `session:end` | _(none)_                                               | End session and persist frame buffer  |
| Server → Client | `feedback`    | `{ angles, corrections, status, feedback, timestamp }` | Real-time form feedback for the frame |

---

_Last updated: 2026. Update this document whenever a new endpoint or socket event is added to the server._
