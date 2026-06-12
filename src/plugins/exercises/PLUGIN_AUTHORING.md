# How to Create a New Exercise Plugin

## Overview

Each exercise is a standalone plugin file. Adding a new exercise requires **zero changes** to the core engine — just drop a new file in this directory.

## Step-by-step

### 1. Create the plugin file

Create `src/plugins/exercises/YourExercisePlugin.ts`:

```typescript
import { ExerciseContext, RepCompletionResult } from './IExercisePlugin';
import { BaseExercisePlugin } from './BaseExercisePlugin';
import { exercisePluginRegistry } from './ExercisePluginRegistry';

export class YourExercisePlugin extends BaseExercisePlugin {
  readonly id = 'yourExerciseKey';
  readonly name = 'Display Name';
  readonly description = 'Short description of what this exercise tracks';
  readonly configKey = 'yourExerciseKey';

  constructor() {
    super(24); // MediaPipe landmark index for kinematic tracking
  }

  // (Optional) Provide live feedback during the DOWN phase
  getLiveFeedback(context: ExerciseContext): string | undefined {
    // Return a feedback string, or undefined
    return undefined;
  }

  // (Optional) Run logic when a rep is completed
  onRepComplete(context: ExerciseContext): RepCompletionResult | undefined {
    // Return depth/modifier data, or undefined
    return undefined;
  }

  // (Optional) Update custom state fields each frame
  updateCustomState(context: ExerciseContext, nextState: Partial<EngineState>): void {
    // Mutate nextState with any custom fields
  }

  // (Optional) Provide wrist supination scoring
  getWristSupinationScore(landmarks?: any[]): number {
    return NaN;
  }
}

// Self-register — this runs at module import time
exercisePluginRegistry.register(new YourExercisePlugin());
```

### 2. Add the exercise config

In `src/config/exercises.ts`, add your exercise configuration:

```typescript
yourExerciseKey: {
  key: "yourExerciseKey",
  name: "Display Name",
  primaryJoint: "elbow",
  joints: [...],
  downThreshold: 140,
  upThreshold: 160,
  feedbackRules: [...],
}
```

### 3. Import the plugin

Open `src/plugins/exercises/index.ts` and add:

```typescript
export { YourExercisePlugin } from './YourExercisePlugin';
import './YourExercisePlugin';
```

### Plugin is now live — no engine changes needed.

## Available Hooks

| Hook | When it runs | Return |
|------|-------------|--------|
| `getPrimaryJointIndex()` | Every frame (kinematic engine) | MediaPipe landmark index |
| `getLiveFeedback(context)` | During DOWN phase | Feedback string or `undefined` |
| `onRepComplete(context)` | After each rep | `RepCompletionResult` or `undefined` |
| `updateCustomState(context, nextState)` | Every frame | Mutates `nextState` |
| `getWristSupinationScore()` | Every frame (bicep curls) | Score or `NaN` |

## `ExerciseContext` Fields

| Field | Type | Description |
|-------|------|-------------|
| `currentState` | `EngineState` | Current engine state |
| `activeAngles` | `Record<string, number>` | Current joint angles |
| `landmarks` | `any[]` | Raw MediaPipe landmarks |
| `config` | `ExerciseConfig` | Exercise config object |
| `now` | `number` | Timestamp |
| `downAngleReached` | `number` | Minimum angle during this rep |
| `isInExercisePosture` | `boolean` | Whether user is in valid posture |
| `nextStage` | `string` | Current stage (`up`/`down`) |
| `feedbackResult` | `FeedbackResult` | Current feedback evaluation |
