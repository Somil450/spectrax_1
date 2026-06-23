# Changelog

All notable changes to **SpectraX** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- AI personalized workout plan recommendations (#740)
- Real-time audio-guided workout coaching using Web Audio API oscillator synthesis (#738, #688)
- Real-Time Concentric/Eccentric Time-Under-Tension engine (#460, #729)
- WebWorker offloading for heavy kinematic tracking computations (#695)
- Voice feedback and audio cues for exercise corrections (#694)
- Upgraded pose estimation to MediaPipe Pose Landmarker for higher accuracy (#696)
- Progressive overload analytics and charting (#697)
- Group leaderboards and social sharing (#698)
- Frame-Drop Kinetic Vector Reconstruction Layer (#461, #722)
- Background Sync API support to save workouts while offline (#693)
- Privacy policy and Terms & Conditions pages (#706, #707)
- Navbar with responsive styling (#715, #668)
- Exercise guide panel with instructions, common mistakes, and target muscles (#703)
- Height input and real-time glassmorphic BMI display (#602, #687)
- Exit navigation control with training session state reset (#717)

### Changed

- Refactored `ExerciseEngine` to use a strategy pattern for exercise-specific logic and metrics (#704)
- Added automatic cleanup for accumulated session files (#598, #725)
- Restricted health endpoint metrics to authenticated callers or localhost (#599, #724)

### Fixed

- Resolved duplicate identifier declarations in `WorkoutScreen` (#692)
- Added missing `finalizedSessions` declaration in `createSessionService` (#735)
- Always register `cleanupAutoSync` cleanup in `useWorkoutSync` (#586, #737)
- Removed duplicate `const` declarations of `SESSION_FILE_TTL_DAYS` and `CLEANUP_INTERVAL_HOURS` (#734)
- Moved `ipConnectionCount` to `createServer` instance scope (#596, #727)
- Moved `frameTimestamps` to socket handler scope for test isolation (#597, #726)
- Moved `finalizedSessions` to `createSessionService` instance scope (#595, #728)
- Resolved persistent cross-session state leak in `KinematicEngine` (#705)
- Added `lungeKnee`/`backKnee`/`kneePastToes` to `angleUtils` to unblock rep counting (#512)
- Gated guest button behind environment flag and added `ProtectedRoute` HOC (#673, #689, #691)
- Adjusted positioning and size of calibration panel for visibility (#690)
- Added error boundaries to workout flow screens (#712)

---

## [0.1.0] - Initial Tracked Release

This release establishes the project baseline. Major features and fixes from
the project's history (500+ commits) are summarized below by category.

### Added

- Core pose tracking pipeline using MediaPipe Pose with 33-landmark detection
- Real-time 3D skeleton rendering with Three.js, including dynamic joint angle vector shaders (#459)
- Rep counting and form scoring for squats, push-ups, bicep curls, shoulder press, lunges, flutter kicks, and planks
- Exercise auto-detection via activity classification, with INT8 quantization for performance (#336)
- Anomaly detection engine (Z-Score, Modified Z-Score, Isolation Forest) and GMM clustering for posture deviations (#418)
- Session replay with biomechanical stress vector shaders, neon grid ripple, bloom/cyberpunk effects, and ghost mode (#455, #458, #425)
- Multi-angle split-screen replay viewports and orbit controls locked to pelvis tracking (#477, #448)
- Badge/achievement system, XP and leveling, and workout streak tracking
- Fitness calculator (BMI/calorie estimation) with AI-based calorie estimation from pose data (#445, #389)
- Firebase authentication, Firestore storage, and App Check anti-abuse integration
- Socket.IO real-time sync with authentication, rate limiting, and CORS hardening (#488)
- PWA support with service worker caching and offline workout queue, including Background Sync (#393)
- FPS monitor and adaptive performance throttling for lower-end devices (#440, #457)
- Skeletal overlay color customization and multi-theme support (#127, #258)
- Voice Coach accessibility feature and gesture-based workout controls (#377, #434)

### Changed

- Refactored backend from a single 289-line `server/index.js` into a modular `server/src/` structure with `config/`, `middleware/`, `modules/`, and `socket/` directories
- Implemented strategy pattern in `ExerciseEngine` for exercise-specific logic
- Lazy-loaded major screens (`WorkoutScreen`, `CalibrationScreen`, `ReplayScreen`) via `React.lazy()`, reducing bundle size by 57.4% (#584)
- Migrated test suite from Jest to Vitest with comprehensive coverage for core utilities (#332)
- Pinned MediaPipe dependencies to specific versions with SRI hashes for security (#386)
- Cached IndexedDB connections and added MessagePack serialization for session archives (#384, #407)

### Fixed

- Resolved 25+ TypeScript compilation errors across the codebase (#600)
- Fixed memory leaks via WebGL geometry/material disposal and component unmount cleanup (#346, #436)
- Fixed cross-platform/timezone bugs in streak tracking and Safari private-mode crashes (#478, #521)
- Replaced window resize listeners with `ResizeObserver` for the Three.js canvas (#426)
- Fixed Firestore/IndexedDB sync ordering issues in workout sync service (#419, #420)
- Resolved double session finalization and stabilized session IDs in 3D Replay (#411, #366)
- Fixed broken CORS configuration, replacing hardcoded values with environment-based config (#564)
- Numerous accessibility fixes (aria-labels, reduced-motion support, contrast improvements)

### Removed

- Deprecated `server/src/index.js` as a direct entry point in favor of `server/src/app.js`
- Removed unused dependencies and conflicting Jest configuration after Vitest migration (#332, #333)

---

[Unreleased]: https://github.com/Somil450/spectrax_1/compare/v0.1.0...HEAD
