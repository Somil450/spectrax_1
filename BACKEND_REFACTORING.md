# Backend Folder Refactoring Summary

## Overview

The backend code has been refactored from a single `server/index.js` file into a clean, modular folder structure within `server/src/`.

## New Folder Structure

```
server/
├── index.js                    # Main entry point (now minimal - just delegates)
├── src/
│   ├── index.js               # Main server initialization
│   ├── config/
│   │   ├── constants.js       # Configuration constants (PORT, SESSIONS_DIR, etc.)
│   │   └── cors.js            # CORS configuration and setup
│   ├── middleware/
│   │   └── errorHandler.js    # Global error handling middleware
│   ├── modules/
│   │   ├── angleUtils.js      # Pose angle calculations
│   │   ├── feedbackEngine.js  # Exercise form feedback logic
│   │   ├── healthRoute.js     # Health check endpoint
│   │   ├── poseProcessor.js   # Core pose processing logic
│   │   └── sessionStorage.js  # Session persistence (file I/O)
│   └── socket/
│       └── handlers.js        # Socket.IO event handlers
└── sessions/                   # Session data storage (created at runtime)
```

## Module Descriptions

### config/

- **constants.js**: Exports PORT, SESSIONS_DIR, MAX_FRAMES_PER_SEC, MAX_SESSION_FRAMES, SOCKET_AUTH_TOKEN, PAYLOAD_LIMIT
- **cors.js**: CORS configuration with allowed origins validation

### middleware/

- **errorHandler.js**: Express error handling middleware

### modules/

- **angleUtils.js**: Calculates joint angles from pose landmarks (knee, elbow, shoulder, body line, hip depth)
- **feedbackEngine.js**: Generates real-time form corrections based on exercise type (squat, bicep curl, pushup, plank, jumping jack)
- **poseProcessor.js**: Orchestrates angle calculation and feedback generation
- **sessionStorage.js**: Saves pose session data to JSON files
- **healthRoute.js**: Health check endpoint handler

### socket/

- **handlers.js**: Socket.IO event handlers for real-time frame processing and session management

### src/index.js

The main server entry point that:

1. Imports all configuration and modules
2. Creates Express app and Socket.IO server
3. Registers middleware, routes, and socket handlers
4. Manages graceful shutdown

### server/index.js

Now a minimal entry point that simply requires `./src/index.js`

## Benefits

✅ **Better Organization**: Code is logically separated by responsibility
✅ **Improved Maintainability**: Easier to find and modify specific functionality
✅ **Reusability**: Modules can be easily imported and reused elsewhere
✅ **Scalability**: New features can be added to appropriate folders without cluttering the codebase
✅ **Testing**: Individual modules are easier to test in isolation
✅ **Reduced Cognitive Load**: Smaller files are easier to understand and modify

## Backwards Compatibility

✅ The refactored backend maintains 100% feature parity with the original code
✅ All configuration environment variables work the same way
✅ API endpoints and Socket.IO events remain unchanged
✅ Session persistence behavior is identical

## How to Use

The backend is started the same way:

```bash
node server/index.js
# OR
npm run dev  # if configured in package.json
```

The new structure handles all routing and logic internally through modular imports.
