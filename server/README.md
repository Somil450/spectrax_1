# SpectraX Backend

Real-time backend for SpectraX pose processing, live feedback, and session persistence.

## Overview

This backend uses:

- `Express` for HTTP endpoints
- `Socket.IO` for real-time frame processing
- `Vitest` for unit and integration tests

The current codebase is organized in a module-first structure so related backend files stay together.

## Folder Structure

```text
server/
  src/
    app/
      createApp.js
      createServer.js
    config/
      cors.js
      env.js
      socket.js
    modules/
      health/
        health.controller.js
        health.routes.js
      pose/
        angle.utils.js
        feedback.service.js
        pose.service.js
        pose.socket.js
        pose.validator.js
      session/
        session.service.js
        session.socket.js
        session.store.js
        session.validator.js
    shared/
      constants/
        exercises.js
      utils/
        logger.js
        paths.js
    index.js
  tests/
    integration/
    unit/
  .env.example
  index.js
  package.json
  vitest.config.js
```

## Default Runtime

- HTTP server: `http://localhost:3001`
- Socket.IO endpoint: `ws://localhost:3001/socket.io`- Health route: `GET /health`

## Setup

```bash
cd server
npm install
```

## Scripts

```bash
npm run dev
npm start
npm test
npm run test:watch
```

## Environment Variables

Create a `.env` file inside `server/` if needed.

Example:

```env
PORT=3001
CORS_ORIGIN=*
SESSION_PATH=./session.json
MAX_SESSION_FRAMES=300
SOCKET_PATH=/socket.io
```

## Socket Events

### Client to Server

`frame`

```json
{
  "landmarks": [],
  "timestamp": 1710000000000,
  "exercise": "squat"
}
```

`session:end`

Ends the active socket session and persists the buffered frames.

### Server to Client

`feedback`

```json
{
  "angles": {
    "knee": 90,
    "elbow": 90,
    "shoulder": 90,
    "bodyLine": 45,
    "hipDepth": 100
  },
  "corrections": ["Keep your back straight"],
  "status": "yellow",
  "feedback": "Keep your back straight",
  "timestamp": 1710000000000
}
```

## Health Check

Request:

```http
GET /health
```

Example response:

```json
{
  "status": "ok",
  "activeSessions": 0,
  "uptime": 12
}
```

## Testing

The backend includes:

- unit tests for pose utilities, feedback logic, validators, and session logic
- integration tests for health and socket flow

Run:

```bash
cd server
npm test
```

## Notes

- this refactor keeps the existing backend logic intact while improving structure
- stricter runtime validation can be added in a future pass
- `server/index.js` is kept as a compatibility entry that forwards to `src/index.js`
