# 🎓 GSSoC 2026 Professional Master Plan: SpectraX

This document serves as the comprehensive strategic roadmap and governance framework for SpectraX during the GirlScript Summer of Code 2026.

---

## 🛡️ 1. Repository Governance & Anti-Spam Policies

To maintain the highest code quality and project integrity, the following rules are strictly enforced:

### 🚫 Spam PR Prevention
*   **Definition**: PRs that only fix typos in non-visible files, add extra whitespace, change variable names without functional improvement, or submit "empty" documentation updates.
*   **Penalty**: Such PRs will be labeled as `spam` and closed immediately. Repeated offenses will lead to disqualification from the project.
*   **Requirement**: Every PR must link to an assigned issue. Unsolicited PRs will be evaluated strictly.

### 🤖 AI-Generated PR Policy
*   **Verification**: All AI-assisted code must be manually reviewed and tested by the contributor.
*   **Rejection**: PRs that exhibit obvious AI hallucinations (calling non-existent APIs, logical loops, or incorrect MediaPipe usage) will be rejected without a second review.

### 📅 Issue Assignment & Inactivity
*   **Claiming**: Comment on an issue to claim it. Provide a 1-sentence technical plan.
*   **Limit**: Max **one** active assignment per contributor.
*   **72-Hour Rule**: If no Progress Update or Draft PR is submitted within 72 hours of assignment, the issue will be unassigned automatically.

### 🔍 PR Review Standards
*   **Mandatory Media**: Any UI/UX or 3D visualization change MUST include a screenshot or video recording.
*   **CI/CD**: PRs must pass all automated Lint and Build checks.
*   **Self-Review**: Contributors must perform a self-review using the provided checklist before marking a PR as "Ready for Review".

---

## 🛠️ 2. Professional GitHub Issue Roadmap

### 🟢 Level 1: Beginner / Documentation / UI

#### Issue 1: [UI/UX] Implement Dark/Light Mode Theme Switcher
*   **Level**: `level1`
*   **Description**: Add a global theme toggle to allow users to switch between a high-contrast dark mode and a clean light mode.
*   **Expected Outcome**: Smooth CSS transition between themes affecting the dashboard and control panels.
*   **Expected Skills**: CSS Variables, React State, LocalStorage.
*   **Acceptance Criteria**: Theme preference must persist across browser restarts.
*   **Estimated Effort**: 4-6 Hours.
*   **Files**: `src/App.tsx`, `src/index.css`.
*   **Labels**: `gssoc-26`, `level1`, `ui/ux`, `good first issue`

#### Issue 2: [A11y] ARIA Live Regions for Real-Time Feedback
*   **Level**: `level1`
*   **Description**: Implement ARIA live regions so screen readers announce "Rep Count" and "Form Feedback" as they update.
*   **Expected Outcome**: Improved accessibility for visually impaired users.
*   **Expected Skills**: Semantic HTML, ARIA.
*   **Acceptance Criteria**: Screen readers (VoiceOver/NVDA) must trigger announcements on rep increments.
*   **Files**: `src/components/WorkoutScreen.tsx`.
*   **Labels**: `gssoc-26`, `level1`, `accessibility`

---

### 🟡 Level 2: Intermediate / Feature / Performance

#### Issue 3: [Performance] Offload MediaPipe to Web Workers
*   **Level**: `level2`
*   **Description**: Move the MediaPipe pose detection loop to a Web Worker to prevent UI blocking on lower-end devices.
*   **Expected Outcome**: UI remains responsive (60 FPS) while AI processing runs in the background.
*   **Expected Skills**: Web Workers, TypeScript, PostMessage API.
*   **Acceptance Criteria**: Landmarks are streamed via Worker; Main thread performance increases by >20%.
*   **Estimated Effort**: 12-15 Hours.
*   **Files**: `src/services/poseService.ts`, `src/workers/pose.worker.ts`.
*   **Labels**: `gssoc-26`, `level2`, `performance`

#### Issue 4: [Feature] "Ghost Mode" Skeleton Replay Overlay
*   **Level**: `level2`
*   **Description**: Draw a translucent "Ghost" skeleton from the user's previous personal record on top of the live workout feed.
*   **Expected Outcome**: Users can compare their current form to their best-ever performance in real-time.
*   **Expected Skills**: Three.js, JSON handling, Linear Interpolation.
*   **Acceptance Criteria**: Ghost skeleton must be scaled to the current user's body size.
*   **Files**: `src/components/Visualization3D.tsx`, `src/services/sessionRecorder.ts`.
*   **Labels**: `gssoc-26`, `level2`, `feature`

---

### 🔴 Level 3: Advanced / AI / Architecture

#### Issue 5: [AI/ML] Kalman Filter Implementation for Keypoint Stability
*   **Level**: `level3`
*   **Description**: Implement a signal processing filter (Kalman or EMA) to remove detection jitter from MediaPipe landmarks.
*   **Expected Outcome**: Silky-smooth 3D skeleton movement with zero visual "shaking".
*   **Expected Skills**: Math, Signal Processing, TypeScript.
*   **Acceptance Criteria**: Filter parameters must be tunable via the settings panel.
*   **Estimated Effort**: 20+ Hours.
*   **Files**: `src/services/poseService.ts`, `src/services/mathUtils.ts`.
*   **Labels**: `gssoc-26`, `level3`, `ai-ml`

#### Issue 6: [Architecture] Modular Exercise Engine (Strategy Pattern)
*   **Level**: `level3`
*   **Description**: Refactor the monolithic `exerciseEngine.ts` into a strategy-based plugin architecture.
*   **Expected Outcome**: Adding a new exercise requires zero changes to the core engine; just a new class implementation.
*   **Expected Skills**: OOP, Design Patterns, TypeScript Generics.
*   **Acceptance Criteria**: Existing Squat/Pushup logic must be migrated to separate files.
*   **Files**: `src/services/exerciseEngine.ts`, `src/engines/plugins/`.
*   **Labels**: `gssoc-26`, `level3`, `architecture`

---

## 📈 3. Long-Term Project Roadmap

### Phase 1: Stability & UX (June)
*   Full Unit Test coverage for core math utilities.
*   Mobile responsive layout optimization.
*   Multilingual support (i18n).

### Phase 2: AI & Performance (July)
*   Web Worker transition completion.
*   Custom gesture detection (Hand signals to start/stop).
*   Personalized form correction based on body type.

### Phase 3: Cloud & Social (August)
*   Global Leaderboard with MongoDB backend.
*   Multi-user "Live Workout Rooms" using Socket.io.
*   Cloud deployment via Docker and AWS.

---

## 🏗️ 4. GitHub Workflow & Organization

### Labels System
*   **GSSoC**: `gssoc-26`
*   **Difficulty**: `level1`, `level2`, `level3`
*   **Category**: `ai-ml`, `performance`, `ui/ux`, `backend`, `frontend`
*   **Status**: `status:assigned`, `status:review-needed`, `status:ready-to-merge`

### Project Boards
We will maintain a "SpectraX GSSoC Kanban" board with columns: `Backlog`, `Assigned`, `In Progress`, `Review`, `Merged`.

---

## 📋 5. PR Template & Review Checklist

### Contributor Self-Review
- [ ] My code follows the project's TypeScript style guide.
- [ ] I have added comments to complex logic (especially in AI/3D sections).
- [ ] I have tested this change on at least two different browsers.
- [ ] (If UI) I have attached a screenshot/video.

### Maintainer Review Checklist
- [ ] Does this change impact the FPS performance?
- [ ] Are landmarks handled efficiently to prevent memory leaks?
- [ ] Is the code modular and reusable?
- [ ] Are there any security risks in socket communication?
