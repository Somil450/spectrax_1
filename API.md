# SpectraX Backend API Reference

> **Base URL:** Configured via the `VITE_BACKEND_URL` environment variable in your frontend `.env` file.
> The backend server runs on port **3001** by default (`http://localhost:3001` for local development).

This document covers every HTTP endpoint and every WebSocket event exposed by the `server/` backend.

---

## Table of Contents

1. [Authentication](#authentication)
2. [HTTP Endpoints](#http-endpoints)
   - [GET /health](#get-health)
3. [WebSocket API](#websocket-api)
   - [Connection](#connection)
   - [Client → Server Events](#client--server-events)
   - [Server → Client Events](#server--client-events)
4. [Supported Exercises](#supported-exercises)
5. [Data Types](#data-types)
6. [Error Reference](#error-reference)
7. [Environment Variables](#environment-variables)

---

## Authentication

### HTTP Endpoints
The HTTP endpoints currently have **no authentication requirements**. They are open to any request from an allowed CORS origin.

### WebSocket Connections
WebSocket connections are authenticated via a **token in the Socket.IO handshake**:

```js
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  auth: { token: import.meta.env.VITE_SOCKET_TOKEN },
  transports: ["websocket"],
});
```

| Behaviour | Condition |
|-----------|-----------|
| Connection accepted | `auth.token` matches the server's `SOCKET_AUTH_TOKEN` env var |
| Connection accepted (with warning) | `SOCKET_AUTH_TOKEN` is unset **and** `NODE_ENV !== "production"` |
| Connection rejected with `Unauthorized` | Token mismatch |
| Connection rejected with `Server misconfiguration` | `SOCKET_AUTH_TOKEN` is unset in production |

---

## HTTP Endpoints

### GET /health

Returns the current health status of the server.

**Request**

```
GET /health
```

No request body or query parameters required.

**Response — 200 OK**

```json
{
  "status": "ok",
  "activeSessions": 3,
  "uptime": 142
}
```

| Field | Type | Description |
|-------|------|-------------|
| `status` | `string` | Always `"ok"` when the server is running |
| `activeSessions` | `number` | Number of currently connected WebSocket clients with active sessions |
| `uptime` | `number` | Server uptime in **seconds** (rounded) |

**Example**

```bash
curl http://localhost:3001/health
```

---

## WebSocket API

SpectraX uses **Socket.IO** (WebSocket transport only — polling is disabled) for real-time pose processing. Connect once per user session; the server maintains per-socket state.

### Connection

```js
import { io } from "socket.io-client";

const socket = io(import.meta.env.VITE_BACKEND_URL, {
  auth: { token: "<SOCKET_AUTH_TOKEN>" },
  transports: ["websocket"],
});
```

On successful connection the server logs `[SpectraX] Client connected: <socketId>` and initialises an empty frame buffer for that socket.

---

### Client → Server Events

#### `frame`

Send a single video frame's pose landmarks for real-time analysis.

**Payload**

```ts
{
  landmarks: Landmark[];   // Required — 29–33 MediaPipe landmarks
  timestamp: number;       // Required — milliseconds since epoch (Date.now())
  exercise?: string;       // Optional — one of the supported exercise IDs (defaults to "squat")
}
```

**`Landmark` object**

```ts
{
  x: number;               // Normalised x coordinate (0–1)
  y: number;               // Normalised y coordinate (0–1)
  z?: number;              // Optional depth
  visibility?: number;     // Optional confidence (0–1)
}
```

**Validation rules**

| Rule | Behaviour on failure |
|------|----------------------|
| `landmarks` must be an array of 29–33 objects each with numeric `x` and `y` | Server emits `feedback` with `status: "yellow"` and `feedback: "Acquiring pose..."` |
| `timestamp` must be a finite number | Same as above |
| `exercise` not in supported list | Silently falls back to `"squat"` |
| More than **60 frames/second** | Excess frames are silently dropped (rate limiter) |

**Example**

```js
socket.emit("frame", {
  landmarks: mediapipePoseLandmarks, // Array from MediaPipe Pose
  timestamp: Date.now(),
  exercise: "squat",
});
```

---

#### `session:end`

Signal that the workout session is finished. The server finalises and persists the accumulated frame buffer to disk, then clears the in-memory buffer for this socket.

**Payload**

None.

**Example**

```js
socket.emit("session:end");
```

---

### Server → Client Events

#### `feedback`

Emitted by the server after every successfully processed `frame` event.

**Payload**

```ts
{
  angles: Record<string, number | null>;  // Computed joint angles for the frame
  corrections: string[];                  // List of real-time corrective cues (may be empty)
  status: "green" | "yellow" | "red";    // Form quality indicator
  feedback: string;                       // Human-readable summary message
  timestamp: number | null;              // Echoed timestamp from the client frame
}
```

**`angles` keys by exercise**

| Exercise | Angle keys present |
|----------|--------------------|
| `squat` | `knee`, `bodyLine` |
| `bicepCurl` | `elbow`, `shoulder` |
| `pushup` | `elbow`, `bodyLine` |
| `plank` | `bodyLine`, `shoulder` |
| `jumpingJack` | `shoulder` |

**`status` values**

| Value | Meaning |
|-------|---------|
| `"green"` | Form is correct |
| `"yellow"` | Pose not yet detected / landmark data insufficient |
| `"red"` | Processing error |

**`corrections` examples by exercise**

| Exercise | Possible correction messages |
|----------|------------------------------|
| `squat` | `"Lower your squat depth"`, `"Keep your back straight"`, `"Avoid over-bending knees"` |
| `bicepCurl` | `"Curl higher — squeeze at top"`, `"Extend arm fully at bottom"`, `"Keep elbows tucked at sides"` |
| `pushup` | `"Lower your chest to the ground"`, `"Keep your body in a straight line"` |
| `plank` | `"Raise your hips — stay rigid"`, `"Align shoulders over wrists"` |
| `jumpingJack` | `"Raise arms fully overhead"` |

**Example — good form**

```json
{
  "angles": { "knee": 95, "bodyLine": 172 },
  "corrections": [],
  "status": "green",
  "feedback": "Good squat form!",
  "timestamp": 1718000000000
}
```

**Example — acquiring pose**

```json
{
  "angles": {},
  "corrections": [],
  "status": "yellow",
  "feedback": "Acquiring pose...",
  "timestamp": null
}
```

**Example — processing error**

```json
{
  "angles": {},
  "corrections": [],
  "status": "red",
  "feedback": "Error processing pose",
  "timestamp": 1718000000000
}
```

---

## Supported Exercises

| ID | Display Name | Tracked Angles |
|----|-------------|----------------|
| `squat` | Squat *(default)* | `knee`, `bodyLine` |
| `bicepCurl` | Bicep Curl | `elbow`, `shoulder` |
| `pushup` | Push-up | `elbow`, `bodyLine` |
| `plank` | Plank | `bodyLine`, `shoulder` |
| `jumpingJack` | Jumping Jack | `shoulder` |

If an unrecognised exercise ID is sent, the server silently falls back to `"squat"`.

---

## Data Types

### Landmark

```ts
interface Landmark {
  x: number;           // Normalised horizontal position (0.0 – 1.0)
  y: number;           // Normalised vertical position (0.0 – 1.0)
  z?: number;          // Depth relative to hips (optional)
  visibility?: number; // Detection confidence 0.0 – 1.0 (optional)
}
```

Landmarks map to [MediaPipe Pose landmark indices](https://developers.google.com/mediapipe/solutions/vision/pose_landmarker). The backend requires indices 0–28 to be present (minimum 29, maximum 33).

### FeedbackPayload

```ts
interface FeedbackPayload {
  angles: Record<string, number | null>;
  corrections: string[];
  status: "green" | "yellow" | "red";
  feedback: string;
  timestamp: number | null;
}
```

---

## Error Reference

### WebSocket Connection Errors

| Error message | Cause | Resolution |
|---------------|-------|-----------|
| `Unauthorized` | `auth.token` does not match `SOCKET_AUTH_TOKEN` | Verify `VITE_SOCKET_TOKEN` in your frontend `.env` matches `SOCKET_AUTH_TOKEN` in `server/.env` |
| `Server misconfiguration: SOCKET_AUTH_TOKEN is not set` | `SOCKET_AUTH_TOKEN` is missing in production | Set `SOCKET_AUTH_TOKEN` in the server's production environment |

### Frame Processing Errors

Errors during pose processing do not throw to the client. The server catches them and emits a `feedback` event with `status: "red"` and `feedback: "Error processing pose"`.

### Rate Limiting

The server enforces a maximum of **60 `frame` events per second** per connection. Frames exceeding this limit are silently discarded — no error event is emitted.

---

## Environment Variables

### Frontend (`.env` / `.env.development` / `.env.production`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_BACKEND_URL` | Full URL of the SpectraX backend server | `http://localhost:3001` |
| `VITE_SOCKET_TOKEN` | Token sent in WebSocket handshake to authenticate with the server | `my-secret-token` |

### Backend (`server/.env`)

See `server/.env.example` for the complete list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the server listens on | `3001` |
| `SOCKET_AUTH_TOKEN` | Secret token clients must send in `socket.handshake.auth.token` | *(none — disables auth in dev, blocks all in prod)* |
| `ALLOWED_ORIGIN` / `CORS_ORIGIN` | Comma-separated list of allowed CORS origins | *(none)* |
| `MAX_FRAMES_PER_SEC` | Maximum `frame` events processed per second per socket | `60` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `development` |

---

## Quick-Start: Testing the API Locally

1. **Start the backend**

   ```bash
   cd server
   cp .env.example .env   # edit SOCKET_AUTH_TOKEN if desired
   npm install
   npm start
   ```

2. **Check health**

   ```bash
   curl http://localhost:3001/health
   # → {"status":"ok","activeSessions":0,"uptime":2}
   ```

3. **Test WebSocket connection** (Node.js snippet)

   ```js
   import { io } from "socket.io-client";

   const socket = io("http://localhost:3001", {
     auth: { token: process.env.SOCKET_TOKEN ?? "" },
     transports: ["websocket"],
   });

   socket.on("connect", () => console.log("Connected:", socket.id));
   socket.on("feedback", (data) => console.log("Feedback:", data));

   // Send a dummy frame (all landmarks at centre)
   socket.emit("frame", {
     landmarks: Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
     timestamp: Date.now(),
     exercise: "squat",
   });
   ```
