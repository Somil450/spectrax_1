import React, { useState, useEffect, useRef } from 'react';
import Draggable, { type DraggableData, type DraggableEvent } from 'react-draggable';
import { StopCircle, ArrowUpCircle, ArrowDownCircle, Lock, Unlock } from 'lucide-react';
import { cameraService } from '../services/cameraService';
import { poseService } from '../services/poseService';
import { overlayRenderer } from '../services/overlayRenderer';
import { getJointAngles, getJointVisibility } from '../services/angleUtils';
import { exerciseEngine, EngineState } from '../services/exerciseEngine';
import { ExerciseConfig } from '../config/exercises';
import { sessionRecorder } from '../services/sessionRecorder';
import { skeletalSense } from '../services/skeletalSense'; // Kept on main thread for reliable auto-detect
import { poseLockService } from '../services/poseLockService';
import { clipEngine } from '../services/clipEngine';
import { BodyType } from '../services/bodyTypeEngine';
import { useWorkoutSync } from '../hooks/useWorkoutSync';
import { FocusPanel, TimerPanel, RepsPanel, EnginePanel, SensePanel } from './WorkoutPanels';

// ── Web Worker (Vite native worker bundling) ──────────────────────────────────
const createPoseWorker = () =>
  new Worker(new URL("../workers/poseWorker.ts", import.meta.url), {
    type: "module",
  });

interface WorkoutScreenProps {
  exercise: ExerciseConfig;
  onEnd: (stats: {
    reps: number;
    totalReps: number;
    correctReps: number;
    repScores: number[];
    duration: number;
    accuracy: number;
    mistakes: Record<string, number>;
    bestStreak: number;
    tags?: string[];
  }) => void;
  onAutoDetect?: (key: string) => void;
  bodyType?: BodyType;
}
type WorkoutPanelId = 'focus' | 'timer' | 'reps' | 'engine' | 'sense';

type PanelPosition = {
  x: number;
  y: number;
};

type PanelPositions = Record<WorkoutPanelId, PanelPosition>;

const PANEL_POSITION_STORAGE_KEY = 'spectrax.workoutPanelPositions.v1';

const getViewportSize = () => ({
  width: typeof window === 'undefined' ? 1280 : window.innerWidth,
  height: typeof window === 'undefined' ? 720 : window.innerHeight
});

const getDefaultPanelPositions = (): PanelPositions => {
  const { width, height } = getViewportSize();

  return {
    focus: { x: 30, y: 30 },
    timer: { x: Math.max(width - 230, 30), y: 30 },
    reps: { x: Math.max(width / 2 - 110, 30), y: Math.max(height - 250, 30) },
    engine: { x: 40, y: Math.max(height - 110, 30) },
    sense: { x: 280, y: Math.max(height - 110, 30) }
  };
};

const getStoredPanelPositions = (): PanelPositions => {
  const defaults = getDefaultPanelPositions();

  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const storedPositions = JSON.parse(
      window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY) || '{}'
    ) as Partial<Record<WorkoutPanelId, Partial<PanelPosition>>>;

    return (Object.keys(defaults) as WorkoutPanelId[]).reduce((positions, panelId) => {
      const storedPosition = storedPositions[panelId];

      positions[panelId] = {
        x: typeof storedPosition?.x === 'number' ? storedPosition.x : defaults[panelId].x,
        y: typeof storedPosition?.y === 'number' ? storedPosition.y : defaults[panelId].y
      };

      return positions;
    }, {} as PanelPositions);
  } catch {
    return defaults;
  }
};

export const WorkoutScreen: React.FC<WorkoutScreenProps> = ({ exercise, onEnd, onAutoDetect, bodyType }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const panelRefs = useRef<Record<WorkoutPanelId, React.RefObject<HTMLDivElement>> | null>(null);

  if (!panelRefs.current) {
    panelRefs.current = {
      focus: React.createRef<HTMLDivElement>(),
      timer: React.createRef<HTMLDivElement>(),
      reps: React.createRef<HTMLDivElement>(),
      engine: React.createRef<HTMLDivElement>(),
      sense: React.createRef<HTMLDivElement>()
    };
  }

  const panelRefsById = panelRefs.current;
  const [seconds, setSeconds] = useState(0);
  const [vlmProgress, setVlmProgress] = useState(0);
  const [clipResult, setClipResult] = useState<any>(null);
  const { isOnline } = useWorkoutSync();
  const [panelsLocked, setPanelsLocked] = useState(true);
  const [panelPositions, setPanelPositions] = useState<PanelPositions>(() => getStoredPanelPositions())

  const [engineState, setEngineState] = useState<EngineState>({
    reps: 0,
    stage: "up",
    feedback: "ESTABLISHING POSTURE...",
    status: "yellow",
    lastRepTime: 0,
    isCalibrated: false,
    history: [],
    stageStartTime: 0,
    frameScore: 0,
    totalScore: 0,
    totalFrames: 0,
    allowRep: false,
    mistakes: {},
    currentStreak: 0,
    bestStreak: 0,
    isInExercisePosture: false,
    downAngleReached: 999,
    totalReps: 0,
    correctReps: 0,
    minScoreInRep: 100,
    repScores: [],
    accuracy: 100,
  });

  const frameId = useRef<number>(0);
  const lastProcessTime = useRef<number>(0);
  const countRef = useRef<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const frameSkipRef = useRef<number>(0); // frame-skip counter
  const workerRef = useRef<Worker | null>(null); // pose worker
  const pendingLandmarksRef = useRef<any>(null); // latest landmarks for worker
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const FPS_LIMIT = 20; // ↑ Raised from 15 → 20 for smoother tracking

  const clampPanelPositions = (positions: PanelPositions) => {
    const { width, height } = getViewportSize();

    return (Object.keys(positions) as WorkoutPanelId[]).reduce((nextPositions, panelId) => {
      const panel = panelRefsById[panelId].current;
      const maxX = Math.max(width - (panel?.offsetWidth || 0), 0);
      const maxY = Math.max(height - (panel?.offsetHeight || 0), 0);

      nextPositions[panelId] = {
        x: Math.min(Math.max(positions[panelId].x, 0), maxX),
        y: Math.min(Math.max(positions[panelId].y, 0), maxY)
      };

      return nextPositions;
    }, {} as PanelPositions);
  };

  // Use refs for real-time logic to avoid state lags in the pose callback
  const mutableState = useRef<EngineState>({
    reps: 0,
    stage: "up",
    feedback: "ESTABLISHING POSTURE...",
    status: "yellow",
    lastRepTime: 0,
    isCalibrated: false,
    history: [],
    stageStartTime: 0,
    frameScore: 0,
    totalScore: 0,
    totalFrames: 0,
    allowRep: false,
    mistakes: {},
    currentStreak: 0,
    bestStreak: 0,
    isInExercisePosture: false,
    downAngleReached: 999,
    totalReps: 0,
    correctReps: 0,
    minScoreInRep: 100,
    repScores: [],
    accuracy: 100,
  });

  // ── ARIA Live Region State ────────────────────────────────────────────────────
  // We use THREE separate state variables for announcements.
  // Why separate? If reps and feedback shared one string, every rep would
  // re-read the feedback, and every feedback change would re-read the rep count.
  // Keeping them separate means each is announced only when IT changes.
  const [feedbackAnnouncement, setFeedbackAnnouncement] = useState('');
  const [repAnnouncement, setRepAnnouncement] = useState('');
  const [alertAnnouncement, setAlertAnnouncement] = useState('');

  // We use a ref (not state) for the previous rep count because we only need it
  // for comparison — it doesn't need to cause a re-render on its own.
  const prevRepsRef = useRef(0);

  // ── Announce pose correction feedback ─────────────────────────────────────────
  // useEffect runs ONLY when engineState.feedback changes to a different string.
  // React's dependency comparison handles deduplication automatically — the same
  // message repeated across frames will NOT re-trigger this effect.
  useEffect(() => {
    setFeedbackAnnouncement(engineState.feedback);
  }, [engineState.feedback]);

  // ── Announce rep count on each increment ─────────────────────────────────────
  // We check prevRepsRef so we only announce when reps actually go up.
  // This prevents announcing "Rep 0" on first render.
  useEffect(() => {
    if (engineState.reps > 0 && engineState.reps > prevRepsRef.current) {
      setRepAnnouncement(`Rep ${engineState.reps} complete`);
    }
    prevRepsRef.current = engineState.reps;
  }, [engineState.reps]);

  // ── Announce exercise mismatch errors ─────────────────────────────────────────
  // role="alert" with aria-live="assertive" will interrupt the screen reader
  // immediately. We only use this for genuinely urgent errors like a mismatch.
  useEffect(() => {
    if (mismatchError) {
      setAlertAnnouncement(`Exercise mismatch detected. You appear to be doing ${mismatchError}. Switching is disabled mid-set.`);
    }
  }, [mismatchError]);


  useEffect(() => {
    let isMounted = true;

    startTimeRef.current = Date.now();

    // ── Spawn Web Worker ──────────────────────────────────────────────────────
    const worker = createPoseWorker();
    workerRef.current = worker;
    let workerAngles: Record<string, number> = {};

    // Worker posts back computed angles — exercise detection stays on main thread
    worker.onmessage = (evt: MessageEvent) => {
      const { angles } = evt.data;
      workerAngles = angles;
    };

    // ── WebSocket connection to backend (optional, non-blocking) ─────────────
    let wsSocket: WebSocket | null = null;
    try {
      wsSocket = new WebSocket(
        "ws://localhost:3001/socket.io/?EIO=4&transport=websocket",
      );
      wsSocket.onopen = () => console.log("[SpectraX WS] connected to backend");
      wsSocket.onerror = () => {
        wsSocket = null;
      }; // Silently degrade if backend offline
    } catch (_) {
      wsSocket = null;
    }

    const startWorkout = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        const isOffscreenSupported = !!(canvasRef.current as any)
          .transferControlToOffscreen;
        let offscreenEnabled = false;

        if (isOffscreenSupported) {
          try {
            const offscreen = (
              canvasRef.current as any
            ).transferControlToOffscreen();
            worker.postMessage({ type: "initCanvas", canvas: offscreen }, [
              offscreen,
            ]);
            offscreenEnabled = true;
            console.log("[WorkoutScreen] OffscreenCanvas enabled.");
          } catch (e) {
            console.warn(
              "[WorkoutScreen] Failed to transfer canvas control:",
              e,
            );
          }
        }

        const ctx = !offscreenEnabled
          ? canvasRef.current.getContext("2d")
          : null;
        if (ctx) overlayRenderer.setContext(ctx);

        sessionRecorder.start();
        await clipEngine.init();
        await cameraService.startCamera(videoRef.current);

        poseService.onResults(async (results) => {
          if (!isMounted) return;

          // ── SINGLE USER LOCK: Filter out erratic detections or second people ──
          const filteredResults = poseLockService.filter(results);
          if (!filteredResults || !filteredResults.poseLandmarks) return;

          // ── Frame skipping: process every other frame ─────────────────────
          frameSkipRef.current++;
          if (frameSkipRef.current % 2 !== 0) {
            // Still render overlay on skipped frames for smooth display
            if (!offscreenEnabled) {
              const primaryJoints = exercise.joints?.flat() || [];
              overlayRenderer.draw(
                results,
                mutableState.current.status,
                primaryJoints,
              );
            }
            return;
          }

          // ── SKELETAL SENSE: auto-detect & mismatch (main thread, lightweight) ──
          const skeletalResult = skeletalSense.analyze(results.poseLandmarks);
          if (skeletalResult && skeletalResult.confidence > 0.85) {
            const label = skeletalResult.label.toLowerCase();
            const detectedKey = label.includes("squat")
              ? "squat"
              : label.includes("pushup")
                ? "pushup"
                : label.includes("plank")
                  ? "plank"
                  : label.includes("jumping jack")
                    ? "jumpingJack"
                    : label.includes("bicep curl")
                      ? "bicepCurl"
                      : "";

            if (
              detectedKey &&
              detectedKey !== exercise.key &&
              mutableState.current.reps < 2
            ) {
              onAutoDetect?.(detectedKey);
            }
            if (
              detectedKey &&
              detectedKey !== exercise.key &&
              mutableState.current.reps >= 2
            ) {
              setMismatchError(detectedKey.toUpperCase());
            } else {
              setMismatchError(null);
            }
          }

          // ── Offload angle computation to Web Worker ────────────────────────
          pendingLandmarksRef.current = results.poseLandmarks;
          const primaryJoints = exercise.joints?.flat() || [];

          worker.postMessage({
            landmarks: results.poseLandmarks,
            exercise: exercise.key,
            frameId: frameSkipRef.current,
            status: mutableState.current.status,
            primaryJoints: primaryJoints,
          });

          // Use last worker result for angles (may be 1 frame stale — acceptable)
          const angles =
            Object.keys(workerAngles).length > 0
              ? workerAngles
              : getJointAngles(results.poseLandmarks); // Fallback if worker not ready yet

          const visibility = getJointVisibility(results.poseLandmarks);

          // Adjust structural thresholds dynamically based on active detected body type
          const activeConfig = { ...exercise };
          if (bodyType === "endo" && activeConfig.key === "squat") {
            activeConfig.downThreshold += 5; // Softer extension limit due to compacted torso proportions
          } else if (bodyType === "ecto" && activeConfig.key === "squat") {
            activeConfig.downThreshold -= 5; // Stricter requirement for longer limbs to reach true parallel
          } else if (bodyType === "endo" && activeConfig.key === "pushup") {
            activeConfig.downThreshold -= 5; // Wider torsos reach absolute down plane sooner
          }

          // 2. Process through multi-exercise engine (stays on main thread — manages state)
          const nextState = await exerciseEngine.process(
            activeConfig,
            angles,
            visibility,
            mutableState.current,
          );

          mutableState.current = nextState;
          setEngineState(nextState);

          sessionRecorder.recordFrame({
            timestamp: Date.now(),
            landmarks: results.poseLandmarks,
            angles,
            feedback: nextState.feedback,
            exercise: exercise.key,
          });

          // 5. Rendering (Main thread fallback if OffscreenCanvas disabled)
          if (!offscreenEnabled) {
            overlayRenderer.draw(results, nextState.status, primaryJoints);
          }
        });

        const loop = (timestamp: number) => {
          if (!isMounted) return;
          const elapsed = timestamp - lastProcessTime.current;
          if (elapsed > 1000 / FPS_LIMIT) {
            if (
              videoRef.current &&
              videoRef.current.readyState >= 2 &&
              !videoRef.current.paused
            ) {
              poseService.send(videoRef.current);

              countRef.current++;
              if (countRef.current % 5 === 0)
                setVlmProgress(clipEngine.getProgress());

              if (countRef.current % 15 === 0 && canvasRef.current) {
                clipEngine.analyzeFrame(canvasRef.current).then((res) => {
                  if (res && isMounted) {
                    setClipResult(res);
                  }
                });
              }
            }
            lastProcessTime.current = timestamp;
          }
          frameId.current = requestAnimationFrame(loop);
        };
        frameId.current = requestAnimationFrame(loop);
      } catch (err) {
        console.error("Workout camera error:", err);
      }
    };

    startWorkout();

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);

      setSeconds(elapsed);
    }, 1000);

    return () => {
      isMounted = false;
      cancelAnimationFrame(frameId.current);
      worker.terminate();
      if (wsSocket) {
        try {
          wsSocket.close();
        } catch (_) {}
      }
      cameraService.stopCamera();
      clearInterval(timer);
    };
  }, [exercise]);

  useEffect(() => {
    setPanelPositions((currentPositions) => clampPanelPositions(currentPositions));

    const handleResize = () => {
      setPanelPositions((currentPositions) => clampPanelPositions(currentPositions));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(PANEL_POSITION_STORAGE_KEY, JSON.stringify(panelPositions));
  }, [panelPositions]);

  const handleEnd = () => {
    const accuracy =
      mutableState.current.totalReps > 0
        ? Math.round(
            (mutableState.current.correctReps /
              mutableState.current.totalReps) *
              100,
          )
        : 100;

    sessionRecorder.download();

    onEnd({
      reps: mutableState.current.reps,
      totalReps: mutableState.current.totalReps,
      correctReps: mutableState.current.correctReps,
      repScores: mutableState.current.repScores,
      duration: seconds,
      accuracy: accuracy,
      mistakes: mutableState.current.mistakes,
      bestStreak: mutableState.current.bestStreak,
      tags: clipEngine.generateSessionTags({
        accuracy: accuracy,
        avgConfidence: clipResult?.confidence || 0.8,
        mistakes: Object.keys(mutableState.current.mistakes),
        duration: seconds,
      }),
    });
  };

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const statusColor =
    engineState.status === "green"
      ? "var(--neon-green)"
      : engineState.status === "yellow"
        ? "var(--neon-yellow)"
        : "var(--neon-red)";

  const handleDrag = (panelId: WorkoutPanelId, data: DraggableData) => {
    setPanelPositions((currentPositions) => ({
      ...currentPositions,
      [panelId]: {
        x: data.x,
        y: data.y
      }
    }));
  };

  const handlePanelStop = (panelId: WorkoutPanelId, data: DraggableData) => {
    setPanelPositions((currentPositions) => clampPanelPositions({
      ...currentPositions,
      [panelId]: {
        x: data.x,
        y: data.y
      }
    }));
  };

  const renderDraggablePanel = (
    panelId: WorkoutPanelId,
    className: string,
    content: React.ReactNode
  ) => (
    <Draggable
      nodeRef={panelRefsById[panelId]}
      position={panelPositions[panelId]}
      disabled={panelsLocked}
      bounds="parent"
      onDrag={(_: DraggableEvent, data) => handleDrag(panelId, data)}
      onStop={(_: DraggableEvent, data) => handlePanelStop(panelId, data)}
    >
      <div
        ref={panelRefsById[panelId]}
        className={`workout-draggable-panel ${className} ${panelsLocked ? 'is-locked' : 'is-unlocked'}`}
      >
        {content}
      </div>
    </Draggable>
  );

  return (
    <div
      className="screen-container"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Background Video Layer */}
      <div
        className="camera-viewport"
        style={{ position: "absolute", inset: 0 }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.4,
            transform: "scaleX(-1)",
          }}
        />
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: "scaleX(-1)",
          }}
        />
      </div>

      {/* Model Loading Status Overlay */}
      {clipEngine.isBusy() && (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.8)",
            padding: "10px 20px",
            borderRadius: "30px",
            zIndex: 100,
            color: "var(--neon-cyan)",
            border: "1px solid var(--neon-cyan)",
            fontSize: "0.65rem",
            fontWeight: 800,
            letterSpacing: "2px",
          }}
        >
          VLM INTELLIGENCE LOADING... {vlmProgress}% (151MB)
        </div>
      )}
      {/* Offline Indicator */}
      {!isOnline && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            background: "rgba(239, 68, 68, 0.2)",
            border: "1px solid rgba(239, 68, 68, 0.5)",
            color: "#fca5a5",
            padding: "12px 16px",
            borderRadius: "12px",
            zIndex: 100,
            fontSize: "0.85rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            backdropFilter: "blur(8px)",
          }}
        >
          <span style={{ fontSize: "1.2em" }}>⚠️</span>
          <span>Offline - Data will sync</span>
        </div>
      )}

      {/* Top Header Controls */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          justifyContent: "space-between",
          padding: "30px",
          pointerEvents: "none",
        }}
      >
        <div className="glass animate-in" style={{ padding: "16px 24px" }}>
          <div
            style={{
              fontSize: "0.65rem",
              color: "var(--text-dim)",
              letterSpacing: "2px",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Session Focus
          </div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              color: "var(--neon-cyan)",
              fontSize: "1.2rem",
            }}
          >
            {exercise.name.toUpperCase()}
          </div>
        </div>

        <div
          className="glass animate-in"
          style={{ padding: "16px 24px", textAlign: "right" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              justifyContent: "flex-end",
              marginBottom: "4px",
            }}
          >
            <span
              style={{
                fontSize: "0.65rem",
                color: "var(--text-dim)",
                letterSpacing: "2px",
                textTransform: "uppercase",
              }}
            >
              Time
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              color: "#fff",
              fontSize: "1.5rem",
            }}
          >
            {formatTime(seconds)}
          </div>
        </div>
      </div>
      <div className="workout-layout-controls">
        <button
          type="button"
          className={`workout-lock-toggle ${panelsLocked ? 'is-locked' : 'is-unlocked'}`}
          onClick={() => setPanelsLocked((isLocked) => !isLocked)}
        >
          {panelsLocked ? <Lock size={16} /> : <Unlock size={16} />}
          {panelsLocked ? 'Unlock Layout' : 'Lock Layout'}
        </button>
      </div>

      <div className="workout-panel-layer">
        {renderDraggablePanel('focus', '', <FocusPanel exerciseName={exercise.name} />)}
        {renderDraggablePanel('timer', '', <TimerPanel seconds={seconds} />)}
        {renderDraggablePanel('reps', '', <RepsPanel reps={engineState.reps} statusColor={statusColor} />)}
        {renderDraggablePanel('engine', '', <EnginePanel status={engineState.status} statusColor={statusColor} />)}
        {renderDraggablePanel('sense', '', <SensePanel clipEngine={clipEngine} clipResult={clipResult} />)}
      </div>

      {/* MID-SET MISMATCH ALERT */}
      {mismatchError && (
        <div
          style={{
            position: "absolute",
            top: 200,
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(255, 34, 85, 0.95)",
            color: "#fff",
            padding: "15px 40px",
            borderRadius: "40px",
            boxShadow: "0 0 50px rgba(255, 34, 85, 0.6)",
            zIndex: 100,
            border: "2px solid #fff",
            textAlign: "center",
            animation: "shake-alert 0.4s ease-in-out",
          }}
        >
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 800,
              letterSpacing: "3px",
              opacity: 0.8,
              marginBottom: "5px",
            }}
          >
            EXERCISE MISMATCH
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 900 }}>
            YOU ARE DOING {mismatchError}!
          </div>
          <div style={{ fontSize: "0.6rem", marginTop: "5px" }}>
            SWITCHING DISABLED MID-SET
          </div>
        </div>
      )}

      {/* Center Focus Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          pointerEvents: "none",
        }}
      >
        <div
          className="glass animate-in"
          style={{
            padding: "24px 40px",
            borderBottom: `4px solid ${statusColor}`,
            textAlign: "center",
            background: "rgba(10, 10, 26, 0.8)",
            minWidth: "320px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              marginBottom: "8px",
            }}
          >
            {engineState.stage === "down" ? (
              <ArrowDownCircle color={statusColor} size={20} />
            ) : (
              <ArrowUpCircle color={statusColor} size={20} />
            )}
            <span
              style={{
                color: statusColor,
                fontWeight: 700,
                letterSpacing: "2px",
                fontSize: "1.1rem",
              }}
            >
              {engineState.stage.toUpperCase()}
            </span>
          </div>
          <p
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "1.8rem",
              color: "#fff",
              letterSpacing: "2px",
              margin: "10px 0",
            }}
            aria-live="assertive"
            aria-atomic="true"
          >
            {engineState.feedback.toUpperCase()}
          </p>
          <div
            style={{
              marginTop: "15px",
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: "10px",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                color: "var(--text-dim)",
                textTransform: "uppercase",
                letterSpacing: "2px",
                marginBottom: "5px",
              }}
            >
              Form Performance
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: "4px",
                  background: "rgba(255,255,255,0.1)",
                  borderRadius: "2px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${engineState.frameScore}%`,
                    height: "100%",
                    background: statusColor,
                    transition: "width 0.2s ease",
                  }}
                />
              </div>
              <span
                style={{
                  color: statusColor,
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                {engineState.frameScore}%
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Metrics Bar */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <div className="rep-counter" style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "7rem",
              fontWeight: 900,
              lineHeight: 1,
              color: "#fff",
              textShadow: `0 0 40px ${statusColor}44`,
            }}
          >
            {engineState.reps}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-dim)",
              letterSpacing: "4px",
              textTransform: "uppercase",
            }}
          >
            Repetitions
          </div>
        </div>

        <div
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            pointerEvents: "all",
          }}
        >
          <div style={{ display: "flex", gap: "20px" }}>
            <div
              className="glass animate-in"
              style={{
                padding: "12px 20px",
                borderLeft: `3px solid ${statusColor}`,
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  color: statusColor,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontWeight: 700,
                }}
              >
                <Activity size={14} /> AI ENGINE:{" "}
                {engineState.status === "green"
                  ? "STABLE"
                  : "CORRECTION REQUIRED"}
              </div>
            </div>

            {clipEngine.isReady() || clipEngine.getMode() === "cloud" ? (
              <div
                className="glass animate-in"
                style={{
                  padding: "12px 20px",
                  borderLeft: "3px solid #9D4EDD",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <div
                  className="radar-ping"
                  style={{
                    width: "8px",
                    height: "8px",
                    background: "#9D4EDD",
                    borderRadius: "50%",
                  }}
                ></div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#9D4EDD",
                    fontWeight: 700,
                  }}
                >
                  VLM SENSE:{" "}
                  {clipEngine.getMode() === "cloud"
                    ? clipResult
                      ? `CLOUD: ${clipResult.label.toUpperCase()}`
                      : "CLOUD ACTIVATING..."
                    : clipResult
                      ? clipResult.label.toUpperCase()
                      : "SCANNING..."}{" "}
                  ({clipResult ? Math.round(clipResult.confidence * 100) : 0}%)
                </div>
              </div>
            ) : (
              <div
                className="glass animate-in"
                style={{
                  padding: "12px 20px",
                  borderLeft: "3px solid var(--neon-cyan)",
                }}
              >
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--neon-cyan)",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    className="radar-ping loading"
                    style={{
                      width: "8px",
                      height: "8px",
                      background: "var(--neon-cyan)",
                      borderRadius: "50%",
                    }}
                  ></div>
                  OFFLINE AI SENSE: READY
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleEnd}
            className="btn-neon"
            style={{ background: "var(--neon-red)", color: "#fff" }}
          >
            FINISH SESSION <StopCircle size={18} />
          </button>
        </div>
      </div>

      {/*
        ══════════════════════════════════════════════════════════
        ARIA LIVE REGIONS — Screen Reader Announcements
        ══════════════════════════════════════════════════════════

        HOW THIS WORKS:
        - These <div>s are invisible to sighted users (srOnly style hides them).
        - Screen readers watch them. When the text content changes, the screen
          reader automatically reads the new text aloud — no focus change needed.
        - We use THREE separate divs so announcements don't overwrite each other.

        WHY NOT ONE DIV?
        - If reps and feedback shared one string, every rep would re-announce
          the full feedback sentence, making it repetitive and confusing.

        IMPORTANT — These divs must ALWAYS be in the DOM (never inside an
        `{condition && <div>}` block). If a live region is removed and re-added,
        screen readers lose track of it and stop announcing.

        aria-live="polite"   → waits for the user to finish reading, then speaks.
        aria-live="assertive"→ interrupts immediately. Use only for urgent errors.
        role="status"        → pairs with polite; improves NVDA/JAWS compatibility.
        role="alert"         → pairs with assertive; for urgent alerts.
        aria-atomic="true"   → reads the whole div content, not just the changed part.
      */}

      {/* Live region 1: Pose correction feedback */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={srOnly}
      >
        {feedbackAnnouncement}
      </div>

      {/* Live region 2: Rep count — announced separately so it's clean and distinct */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={srOnly}
      >
        {repAnnouncement}
      </div>

      {/* Live region 3: Urgent alerts (exercise mismatch) — interrupts screen reader */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={srOnly}
      >
        {alertAnnouncement}
      </div>

      <style>{`
        @keyframes radar-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.5); opacity: 0.3; }
          100% { transform: scale(2); opacity: 0; }
        }
        .radar-ping::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          background: inherit;
          border-radius: 50%;
          animation: radar-pulse 2s infinite;
        }
        .radar-ping.loading {
          animation: radar-pulse 1s infinite;
        }
        @keyframes shake-alert {
          0%, 100% { transform: translateX(-50%); }
          25% { transform: translateX(-52%); }
          75% { transform: translateX(-48%); }
        }
      `}</style>
    </div>
  );
};