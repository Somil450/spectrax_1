# SpectraX — Anomaly Detection Module (Issue #85)
## Integration Guide

### Files added
```
src/
  types/anomaly.ts                — TypeScript interfaces
  lib/anomalyDetection.ts         — Core ML algorithms (Z-Score, Modified Z-Score, Isolation Forest)
  hooks/useAnomalyDetection.ts    — React hook
  components/AnomalyDetectionPanel.tsx  — Drop-in UI panel
```

---

### 1. Wire the hook into your pose loop

Find wherever you call `onResults` on your MediaPipe Pose instance (likely in a component that handles the camera feed) and add `recordFrame`:

```tsx
// e.g. WorkoutView.tsx (wherever you have your pose callback)
import { useAnomalyDetection } from '../hooks/useAnomalyDetection';

function WorkoutView() {
  const { recordFrame, runDetection, summary, searchSimilar, reset, frameCount } =
    useAnomalyDetection({
      algorithm: 'zscore',   // swap to 'mad' or 'isoforest' as needed
      threshold: 2.0,
      bufferSize: 300,       // ~10 seconds at 30fps
      smoothing: true,
    });

  // Call reset() when a new workout session starts
  useEffect(() => { reset(); }, []);

  // Inside your MediaPipe pose callback
  function handlePoseResults(results) {
    if (results.poseLandmarks) {
      recordFrame(results.poseLandmarks);
    }
    // ... rest of your existing pose logic
  }

  // After workout ends, or on demand (e.g. a "Analyse Form" button)
  function handleWorkoutEnd() {
    const analysis = runDetection();
    if (analysis) {
      console.log(analysis.summaryText);
    }
  }

  return (
    <div>
      {/* your existing workout UI */}
      <p>{frameCount} frames recorded</p>
      <button onClick={handleWorkoutEnd}>Analyse Form</button>
    </div>
  );
}
```

---

### 2. Show the panel in WorkoutSummary

```tsx
// e.g. WorkoutSummary.tsx
import { AnomalyDetectionPanel } from '../components/AnomalyDetectionPanel';
import type { AnomalyAlgorithm } from '../types/anomaly';

function WorkoutSummary({ summary, searchSimilar, onAlgorithmChange }) {
  if (!summary) return null;

  return (
    <section>
      <h2>Form Analysis</h2>
      <AnomalyDetectionPanel
        summary={summary}
        onSimilarSearch={(frameId) => searchSimilar(frameId, 5)}
        onAlgorithmChange={onAlgorithmChange}
        onThresholdChange={(t) => { /* re-run detection with new threshold */ }}
      />
    </section>
  );
}
```

---

### 3. Choosing an algorithm

| Algorithm | When to use | Speed |
|---|---|---|
| `zscore` | Default. Clean, stable sessions. | Fast |
| `mad` | Noisy data or quick warm-up frames. More robust. | Fast |
| `isoforest` | Long sessions, subtle patterns, best accuracy. | Moderate |

For real-time highlighting (mid-workout), use `zscore` or `mad`. Run `isoforest` post-session.

---

### 4. Threshold tuning

The default threshold of `2.0` (standard deviations) works well for most exercises. You can adjust it:

- **Lower (1.5)** — catches more borderline frames; expect more false positives
- **Higher (2.5–3.0)** — only the most extreme deviations flagged

---

### 5. Optional: noise filtering

`smoothLandmarks()` applies a moving-average to raw MediaPipe landmarks before feature extraction. It's on by default (`smoothing: true`). If MediaPipe is already stable (good lighting, close camera), set `smoothing: false` to skip it.

---

### 6. No external ML dependencies

All three algorithms are pure TypeScript — no `@tensorflow`, no Python backend, no WASM. The module runs entirely in the browser alongside your existing MediaPipe setup.
