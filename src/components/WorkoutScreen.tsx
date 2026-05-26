import React, { useState, useEffect, useRef, useCallback } from "react";
import Draggable, { type DraggableData, type DraggableEvent } from 'react-draggable';
import { StopCircle, ArrowUpCircle, ArrowDownCircle, Lock, Unlock, Activity } from 'lucide-react';
import { useCameraPose } from '../hooks/useCameraPose';
import { overlayRenderer } from '../services/overlayRenderer';
import { getJointAngles, getJointVisibility } from '../services/angleUtils';
import { exerciseEngine, EngineState } from '../services/exerciseEngine';
import { ExerciseConfig } from '../config/exercises';
import { sessionRecorder } from '../services/sessionRecorder';
import { skeletalSense } from '../services/skeletalSense'; // Kept on main thread for reliable auto-detect
import { poseLockService } from '../services/poseLockService';
import { clipEngine } from '../services/clipEngine';
import { BodyType } from '../services/bodyTypeEngine';
import { initialSquatDepthStats } from '../services/Squat_depth_classifier';
import { useWorkoutSync } from '../hooks/useWorkoutSync';
import { useDisplayConfig } from '../hooks/useDisplayConfig';
import { FocusPanel, TimerPanel, RepsPanel, EnginePanel, SensePanel } from './WorkoutPanels';
import { ghostService } from '../services/ghostService';
import type { FrameData } from '../services/sessionRecorder';
import { FpsMonitor } from './FpsMonitor';
import { gestureService, GestureCommand } from '../services/gestureService';

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
    repDeviations: number[];
    duration: number;
    accuracy: number;
    mistakes: Record<string, number>;
    bestStreak: number;
    jumpingJackSync?: EngineState["jumpingJackSync"];
    tags?: string[];
  }) => void;
  onAutoDetect?: (key: string) => void;
  bodyType?: BodyType;
}

type WorkoutPanelId = "focus" | "timer" | "reps" | "engine" | "sense";

type PanelPosition = {
  x: number;
  y: number;
};

type PanelPositions = Record<WorkoutPanelId, PanelPosition>;

const PANEL_POSITION_STORAGE_KEY = "spectrax.workoutPanelPositions.v1";

const getViewportSize = () => ({
  width: typeof window === "undefined" ? 1280 : window.innerWidth,
  height: typeof window === "undefined" ? 720 : window.innerHeight,
});

const getDefaultPanelPositions = (): PanelPositions => {
  const { width, height } = getViewportSize();

  return {
    focus: { x: 30, y: 30 },
    timer: { x: Math.max(width - 230, 30), y: 30 },
    reps: { x: Math.max(width / 2 - 110, 30), y: Math.max(height - 250, 30) },
    engine: { x: 40, y: Math.max(height - 110, 30) },
    sense: { x: 280, y: Math.max(height - 110, 30) },
  };
};

const getStoredPanelPositions = (): PanelPositions => {
  const defaults = getDefaultPanelPositions();

  if (typeof window === "undefined") {
    return defaults;
  }

  try {
    const storedPositions = JSON.parse(
      window.localStorage.getItem(PANEL_POSITION_STORAGE_KEY) || "{}",
    ) as Partial<Record<WorkoutPanelId, Partial<PanelPosition>>>;

    return (Object.keys(defaults) as WorkoutPanelId[]).reduce((positions, panelId) => {
      const storedPosition = storedPositions[panelId];

      positions[panelId] = {
        x: typeof storedPosition?.x === "number" ? storedPosition.x : defaults[panelId].x,
        y: typeof storedPosition?.y === "number" ? storedPosition.y : defaults[panelId].y,
      };

      return positions;
    }, {} as PanelPositions);
  } catch {
    return defaults;
  }
};

const srOnly: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: "0",
};

const MAX_EXTRAPOLATED_FRAMES = 5;

type PoseLandmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

const cloneLandmarks = (landmarks: PoseLandmark[]) =>
  landmarks.map((landmark) => ({ ...landmark }));

const extrapolateLandmarks = (
  latest: PoseLandmark[] | null,
  previous: PoseLandmark[] | null,
  dropoutFrames: number,
): PoseLandmark[] | null => {
  if (!latest || !previous) return null;

  const step = dropoutFrames + 1;
  if (step > MAX_EXTRAPOLATED_FRAMES) return null;

  return latest.map((landmark, index) => {
    const prior = previous[index] ?? landmark;
    const dx = landmark.x - prior.x;
    const dy = landmark.y - prior.y;
    const dz = landmark.z - prior.z;

    return {
      x: Math.min(Math.max(landmark.x + dx * step, 0), 1),
      y: Math.min(Math.max(landmark.y + dy * step, 0), 1),
      z: landmark.z + dz * step,
      visibility: Math.max(0.5, Math.min(landmark.visibility, 1)),
    };
  });
};

export const WorkoutScreen: React.FC<WorkoutScreenProps> = ({ exercise, onEnd, onAutoDetect, bodyType }) => {
  const bodyTypeRef = useRef(bodyType);
  bodyTypeRef.current = bodyType;
  const onAutoDetectRef = useRef(onAutoDetect);
  onAutoDetectRef.current = onAutoDetect;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMountedRef = useRef<boolean>(true);
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
  const [panelPositions, setPanelPositions] = useState<PanelPositions>(() => getStoredPanelPositions());
  const [panelsLocked, setPanelsLocked] = useState(true);
  const { config: displayConfig, updateConfig: updateDisplayConfig } = useDisplayConfig();
  const [seconds, setSeconds] = useState(0);
  const [vlmProgress, setVlmProgress] = useState(0);
  const [clipResult, setClipResult] = useState<any>(null);
  const { isOnline } = useWorkoutSync();
 fix-workout-screen-memory-leaks
  
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);

  // ── Gesture workout controls ──────────────────────────────────────────────
  /** 'idle' = not yet started, 'running' = active, 'paused' = gesture-paused */
  type WorkoutControlState = 'idle' | 'running' | 'paused';
  const [workoutControlState, setWorkoutControlState] = useState<WorkoutControlState>('idle');
  const workoutControlRef = useRef<WorkoutControlState>('idle');
  const [lastGestureCommand, setLastGestureCommand] = useState<GestureCommand | null>(null);
  const [gestureHudVisible, setGestureHudVisible] = useState(false);
  const gestureHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gestureConfidences, setGestureConfidences] = useState<Record<GestureCommand, number>>({ START: 0, PAUSE: 0, STOP: 0 });

  const ghostFramesRef = useRef<FrameData[]>([]);
  const ghostStatsRef = useRef<{reps: number, accuracy: number, totalReps: number} | null>(null);
  const [hasGhost, setHasGhost] = useState(false);
 main

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
    repDeviations: [],
    accuracy: 100,
    lastDepthResult: null,
    depthStats: initialSquatDepthStats(),
    liveDepthFeedback: '',
    jumpingJackSyncSamples: [],
    jumpingJackSync: { score: null, lagMs: null, confidence: 0, samples: 0 },
  });

  const startTimeRef = useRef<number>(Date.now());
  const frameSkipRef = useRef<number>(0); // frame-skip counter
  const workerRef = useRef<Worker | null>(null); // pose worker
  const pendingLandmarksRef = useRef<any>(null); // latest landmarks for worker
  const lastObservedLandmarksRef = useRef<PoseLandmark[] | null>(null);
  const previousObservedLandmarksRef = useRef<PoseLandmark[] | null>(null);
  const dropoutFrameCountRef = useRef(0);
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);


  const clampPanelPositions = useCallback((positions: PanelPositions) => {
    const { width, height } = getViewportSize();

    return (Object.keys(positions) as WorkoutPanelId[]).reduce((nextPositions, panelId) => {
      const panel = panelRefsById[panelId].current;
      const maxX = Math.max(width - (panel?.offsetWidth || 0), 0);
      const maxY = Math.max(height - (panel?.offsetHeight || 0), 0);

        return nextPositions;
      },
      {} as PanelPositions,
    );
  }, [panelRefsById]);


  useEffect(() => {
    bodyTypeRef.current = bodyType;
  }, [bodyType]);

  useEffect(() => {
    onAutoDetectRef.current = onAutoDetect;
  }, [onAutoDetect]);

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
    repDeviations: [],
    accuracy: 100,
    lastDepthResult: null,
    depthStats: initialSquatDepthStats(),
    liveDepthFeedback: '',
    jumpingJackSyncSamples: [],
    jumpingJackSync: { score: null, lagMs: null, confidence: 0, samples: 0 },
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
      // Announce the number for screen readers
      setRepAnnouncement(engineState.reps.toString());
      
      // Voice Coach feature: Physically speak the rep count out loud
      if ('speechSynthesis' in window) {
        // Cancel any ongoing speech to prioritize the current rep count
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(engineState.reps.toString());
        // Optional: you can tune rate and pitch here
        utterance.rate = 1.1; 
        window.speechSynthesis.speak(utterance);
      }
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


  const workerAnglesRef = useRef<Record<string, number>>({});
  const wsSocketRef = useRef<WebSocket | null>(null);
  const offscreenEnabledRef = useRef<boolean>(false);

  const handlePoseResults = useCallback(async (results: any) => {
    // ── SINGLE USER LOCK: Filter out erratic detections or second people ──
    const filteredResults = poseLockService.filter(results);
    if (!filteredResults || !filteredResults.poseLandmarks) return;

    // ── GESTURE COMMAND PARSING ─────────────────────────────────────────────
    const gestureResult = gestureService.analyze(results.poseLandmarks);

    // Keep HUD confidences updated every processed frame
    setGestureConfidences({ ...gestureResult.gestureConfidences });

    if (gestureResult.command) {
      const cmd = gestureResult.command;
      setLastGestureCommand(cmd);

      // Show HUD flash for 3 seconds
      setGestureHudVisible(true);
      if (gestureHudTimerRef.current) clearTimeout(gestureHudTimerRef.current);
      gestureHudTimerRef.current = setTimeout(() => setGestureHudVisible(false), 3000);

      if (cmd === 'STOP') {
        // Trigger the existing end-session flow
        handleEnd();
        return;
      } else if (cmd === 'PAUSE' && workoutControlRef.current === 'running') {
        workoutControlRef.current = 'paused';
        setWorkoutControlState('paused');
      } else if (cmd === 'START' && workoutControlRef.current !== 'running') {
        workoutControlRef.current = 'running';
        setWorkoutControlState('running');
      }
    }

    // Skip exercise engine processing while paused
    if (workoutControlRef.current === 'paused') {
      if (!offscreenEnabledRef.current) {
        overlayRenderer.draw(results, 'yellow', exercise.joints?.flat() || []);
      }
      return;
    }

    // Mark workout as running once the first valid frame is processed
    if (workoutControlRef.current === 'idle') {
      workoutControlRef.current = 'running';
      setWorkoutControlState('running');
    }

    // ── Frame skipping: process every other frame ─────────────────────
    frameSkipRef.current++;
    if (frameSkipRef.current % 2 !== 0) {
      // Still render overlay on skipped frames for smooth display
      if (!offscreenEnabledRef.current) {
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
        onAutoDetectRef.current?.(detectedKey);
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

    workerRef.current?.postMessage({
      landmarks: results.poseLandmarks,
      exercise: exercise.key,
      frameId: frameSkipRef.current,
      status: mutableState.current.status,
      primaryJoints: primaryJoints,
    });

    // Use last worker result for angles (may be 1 frame stale — acceptable)
    const angles =
      Object.keys(workerAnglesRef.current).length > 0
        ? workerAnglesRef.current
        : getJointAngles(results.poseLandmarks); // Fallback if worker not ready yet

    const visibility = getJointVisibility(results.poseLandmarks);

    // Adjust structural thresholds dynamically based on active detected body type
    const activeConfig = { ...exercise };
    if (bodyTypeRef.current === "endo" && activeConfig.key === "squat") {
      activeConfig.downThreshold += 5; // Softer extension limit due to compacted torso proportions
    } else if (bodyTypeRef.current === "ecto" && activeConfig.key === "squat") {
      activeConfig.downThreshold -= 5; // Stricter requirement for longer limbs to reach true parallel
    } else if (bodyTypeRef.current === "endo" && activeConfig.key === "pushup") {
      activeConfig.downThreshold -= 5; // Wider torsos reach absolute down plane sooner
    }

    // 2. Process through multi-exercise engine (stays on main thread — manages state)
    const nextState = await exerciseEngine.process(
      activeConfig,
      angles,
      visibility,
      mutableState.current,
      bodyTypeRef.current,
      filteredResults.poseLandmarks,
      performance.now()
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
    if (!offscreenEnabledRef.current) {
      overlayRenderer.draw(results, nextState.status, primaryJoints);
    }
  }, [exercise]);

  const handleFrameTick = useCallback((count: number) => {
    setVlmProgress(clipEngine.getProgress());
    if (count % 15 === 0 && videoRef.current) {
      clipEngine.analyzeFrame(videoRef.current).then((res) => {
        if (res && isMountedRef.current) {
          setClipResult(res);
        }
      });
    }
  }, [videoRef]);

  const {
    startSystem,
    stopSystem,
  } = useCameraPose({
    videoRef,
    canvasRef,
    initialFpsLimit: 20,
    minFpsLimit: 10,
    fpsDecrementStep: 5,
    setupContext: false, // We manually handle canvas context and worker setup
    onResults: handlePoseResults,
    onFrame: handleFrameTick,
  });

  useEffect(() => {
    isMountedRef.current = true;
    startTimeRef.current = Date.now();

    // Load Ghost Data
    const ghostData = ghostService.loadGhost(exercise.key);
    if (ghostData && ghostData.frames && ghostData.frames.length > 0) {
      ghostFramesRef.current = ghostData.frames;
      ghostStatsRef.current = ghostData.stats;
      setHasGhost(true);
    } else {
      ghostFramesRef.current = [];
      ghostStatsRef.current = null;
      setHasGhost(false);
    }

    // ── Spawn Web Worker ──────────────────────────────────────────────────────
    const worker = createPoseWorker();
    workerRef.current = worker;

    // Worker posts back computed angles — exercise detection stays on main thread
    worker.onmessage = (evt: MessageEvent) => {
      const { angles } = evt.data;
      workerAnglesRef.current = angles;
    };

    // ── WebSocket connection to backend (optional, non-blocking) ─────────────
    let wsSocket: WebSocket | null = null;
    try {
      const backendUrl = (import.meta.env.VITE_BACKEND_URL ?? "http://localhost:3001").replace(/\/+$/, "");
      const wsUrl = backendUrl.replace(/^http/, "ws") + "/socket.io/?EIO=4&transport=websocket";
      wsSocket = new WebSocket(wsUrl);
      wsSocketRef.current = wsSocket;
      wsSocket.onopen = () => console.log("[SpectraX WS] connected to backend");
      wsSocket.onerror = () => {
        wsSocketRef.current = null;
      }; // Silently degrade if backend offline
    } catch (_) {
      wsSocketRef.current = null;
    }

    
  
    const startWorkout = async () => {
      if (!videoRef.current || !canvasRef.current) return;

      try {
        const canvasEl = canvasRef.current as any;
        if (canvasEl.__offscreenTransferred) {
          offscreenEnabledRef.current = true;
          console.log("[WorkoutScreen] Canvas already has Offscreen control transferred.");
        } else {
          const isOffscreenSupported = !!canvasEl.transferControlToOffscreen;
          offscreenEnabledRef.current = false;

          if (isOffscreenSupported) {
            try {
              const offscreen = canvasEl.transferControlToOffscreen();
              worker.postMessage({ type: "initCanvas", canvas: offscreen }, [
                offscreen,
              ]);
              offscreenEnabledRef.current = true;
              canvasEl.__offscreenTransferred = true;
              console.log("[WorkoutScreen] OffscreenCanvas enabled.");
            } catch (e) {
              console.warn(
                "[WorkoutScreen] Failed to transfer canvas control:",
                e,
              );
            }
          }
        }

        const ctx = !offscreenEnabledRef.current
          ? canvasRef.current.getContext("2d")
          : null;
        if (ctx) overlayRenderer.setContext(ctx);

        sessionRecorder.start();
        await clipEngine.init();
        await startSystem();
      } catch (err: any) {
        console.error("Workout camera error:", err);
        if (err.message === 'PERMISSION_DENIED') {
          setCameraError('CAMERA_PERMISSION_DENIED');
        } else {
          setCameraError('UNKNOWN_ERROR');
        }
      }
    };

    startWorkout();

    const timerRef = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);

      setSeconds(elapsed);
    }, 1000);

    return () => {
      isMountedRef.current = false;
      stopSystem();
      worker.terminate();
      if (wsSocketRef.current) {
        try {
          wsSocketRef.current.close();
        } catch (err) {
          console.warn("WS close failed:", err);
        }
      }
      clearInterval(timer);
      gestureService.reset();
      if (gestureHudTimerRef.current) clearTimeout(gestureHudTimerRef.current);
    };
  }, [exercise, startSystem, stopSystem]);

  useEffect(() => {
    setPanelPositions((currentPositions) => clampPanelPositions(currentPositions));

    const handleResize = () => {
      setPanelPositions((currentPositions) => clampPanelPositions(currentPositions));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [clampPanelPositions]);

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

    const archive = sessionRecorder.getArchive();
    ghostService.saveBestGhost(exercise.key, {
      reps: mutableState.current.reps,
      accuracy: accuracy,
      totalReps: mutableState.current.totalReps
    }, archive);

    sessionRecorder.download();

    onEnd({
      reps: mutableState.current.reps,
      totalReps: mutableState.current.totalReps,
      correctReps: mutableState.current.correctReps,
      repScores: mutableState.current.repScores,
      repDeviations: mutableState.current.repDeviations,
      duration: seconds,
      accuracy: accuracy,
      mistakes: mutableState.current.mistakes,
      bestStreak: mutableState.current.bestStreak,
      jumpingJackSync: mutableState.current.jumpingJackSync,
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
      {cameraError === 'CAMERA_PERMISSION_DENIED' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 1000, background: 'rgba(8,12,20,0.95)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', padding: '20px', textAlign: 'center', backdropFilter: 'blur(10px)' }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📷</div>
          <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#ef4444', fontFamily: 'var(--font-heading)' }}>Camera Access Required</h2>
          <p style={{ maxWidth: '400px', color: '#94a3b8', lineHeight: 1.6 }}>
            You have denied camera permissions. SpectraX requires camera access to track your body movements. Please enable permissions in your browser settings and refresh the page.
          </p>
        </div>
      )}
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

      {/* Target Overlays for IndexedDB State logic */}
      {displayConfig.fpsDisplay && (
        <div style={{ position: "absolute", top: 10, left: 10, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "5px 10px", borderRadius: "5px", fontFamily: "monospace", fontSize: "12px", zIndex: 100 }}>
          FPS: 30 / ACTIVE
        </div>
      )}

      {displayConfig.graphFeeds && (
        <div style={{ position: "absolute", bottom: 10, right: 10, width: "150px", height: "80px", color: "var(--neon-green)", background: "rgba(0,0,0,0.5)", border: "1px solid var(--neon-green)", padding: "5px", borderRadius: "5px", fontFamily: "monospace", fontSize: "10px", zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <span>Telemetry Graph Feed</span>
          <div style={{ height: "40px", borderBottom: "1px solid var(--neon-green)", position: "relative" }}>
            <div style={{ position: "absolute", bottom: 0, left: "10%", width: "10%", height: "20%", background: "var(--neon-green)" }}></div>
            <div style={{ position: "absolute", bottom: 0, left: "30%", width: "10%", height: "60%", background: "var(--neon-green)" }}></div>
            <div style={{ position: "absolute", bottom: 0, left: "50%", width: "10%", height: "40%", background: "var(--neon-green)" }}></div>
            <div style={{ position: "absolute", bottom: 0, left: "70%", width: "10%", height: "90%", background: "var(--neon-green)" }}></div>
          </div>
        </div>
      )}

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
      {!navigator.onLine && (
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
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >
            {exercise.name.toUpperCase()}
            {hasGhost && (
              <span style={{
                fontSize: "0.6rem",
                background: "rgba(0, 255, 255, 0.15)",
                color: "#00ffff",
                padding: "2px 6px",
                borderRadius: "4px",
                border: "1px solid rgba(0, 255, 255, 0.3)",
                letterSpacing: "1px"
              }}>
                GHOST ACTIVE
              </span>
            )}
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
      <div className="workout-layout-controls" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`workout-lock-toggle ${panelsLocked ? 'is-locked' : 'is-unlocked'}`}
          onClick={() => setPanelsLocked((isLocked) => !isLocked)}
        >
          {panelsLocked ? <Lock size={16} /> : <Unlock size={16} />}
          {panelsLocked ? 'Unlock Layout' : 'Lock Layout'}
        </button>
        <button
          type="button"
          className={`workout-lock-toggle is-unlocked`}
          onClick={() => updateDisplayConfig({ skeletonWires: !displayConfig.skeletonWires })}
        >
          {displayConfig.skeletonWires ? 'Hide Skeleton' : 'Show Skeleton'}
        </button>
        <button
          type="button"
          className={`workout-lock-toggle is-unlocked`}
          onClick={() => updateDisplayConfig({ graphFeeds: !displayConfig.graphFeeds })}
        >
          {displayConfig.graphFeeds ? 'Hide Graph' : 'Show Graph'}
        </button>
        <button
          type="button"
          className={`workout-lock-toggle is-unlocked`}
          onClick={() => updateDisplayConfig({ fpsDisplay: !displayConfig.fpsDisplay })}
        >
          {displayConfig.fpsDisplay ? 'Hide FPS' : 'Show FPS'}
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

      {/* ── GESTURE PAUSED OVERLAY ─────────────────────────────────────────── */}
      {workoutControlState === 'paused' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 200,
            background: 'rgba(8,12,20,0.82)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            pointerEvents: 'none',
          }}
          role="status"
          aria-live="polite"
          aria-label="Workout paused"
        >
          <div style={{ fontSize: '4rem', lineHeight: 1 }}>⏸️</div>
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '2.4rem',
            fontWeight: 900,
            color: 'var(--neon-yellow)',
            letterSpacing: '4px',
            textShadow: '0 0 30px rgba(255,200,0,0.5)',
          }}>
            PAUSED
          </div>
          <div style={{
            fontSize: '0.85rem',
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '2px',
            textAlign: 'center',
            maxWidth: '300px',
            lineHeight: 1.6,
          }}>
            Raise <strong>both palms</strong> above your shoulders<br />
            or give a <strong>thumbs-up</strong> to resume
          </div>
        </div>
      )}

      {/* ── GESTURE COMMAND HUD ────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: '24px',
          transform: 'translateY(-50%)',
          zIndex: 150,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          opacity: gestureHudVisible ? 1 : 0.35,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }}
        aria-label="Gesture command panel"
      >
        {/* Flashing command label */}
        {gestureHudVisible && lastGestureCommand && (
          <div style={{
            background: lastGestureCommand === 'STOP'
              ? 'rgba(239,68,68,0.9)'
              : lastGestureCommand === 'PAUSE'
                ? 'rgba(234,179,8,0.9)'
                : 'rgba(34,197,94,0.9)',
            color: '#fff',
            fontFamily: 'var(--font-heading)',
            fontWeight: 900,
            fontSize: '0.75rem',
            letterSpacing: '3px',
            padding: '6px 14px',
            borderRadius: '20px',
            textAlign: 'center',
            boxShadow: '0 0 20px currentColor',
            animation: 'gesture-flash 0.3s ease',
          }}>
            ✋ {lastGestureCommand}
          </div>
        )}

        {/* Confidence bars for each gesture */}
        {(['START', 'PAUSE', 'STOP'] as GestureCommand[]).map((cmd) => {
          const pct = Math.round((gestureConfidences[cmd] ?? 0) * 100);
          const barColor = cmd === 'STOP'
            ? '#ef4444'
            : cmd === 'PAUSE'
              ? '#eab308'
              : '#22c55e';
          const icon = cmd === 'STOP' ? '🤞' : cmd === 'PAUSE' ? '✋' : '🙌';
          return (
            <div key={cmd} style={{
              background: 'rgba(8,12,20,0.75)',
              border: `1px solid ${barColor}44`,
              borderRadius: '10px',
              padding: '6px 10px',
              minWidth: '100px',
              backdropFilter: 'blur(8px)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
              }}>
                <span style={{ fontSize: '0.6rem', color: barColor, fontWeight: 700, letterSpacing: '1px' }}>
                  {icon} {cmd}
                </span>
                <span style={{ fontSize: '0.6rem', color: barColor, fontWeight: 700 }}>{pct}%</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: barColor,
                  transition: 'width 0.15s linear',
                  borderRadius: '2px',
                }} />
              </div>
            </div>
          );
        })}

        <div style={{
          fontSize: '0.55rem',
          color: 'rgba(255,255,255,0.4)',
          textAlign: 'center',
          letterSpacing: '1px',
          marginTop: '2px',
        }}>
          GESTURE CTRL
        </div>
      </div>

      {/* Gesture animation keyframe */}
      <style>{`
        @keyframes gesture-flash {
          0%   { transform: scale(0.85); opacity: 0; }
          60%  { transform: scale(1.08); opacity: 1; }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>

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
      </div>      <style>{`
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

      {showExitModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 999,
            backdropFilter: 'blur(8px)'
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '20px',
              padding: '30px',
              width: '320px',
              textAlign: 'center',
              color: 'white',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
            }}
          >
            <h2>Confirm Exit</h2>
            <p>Are you sure you want to end your workout session?</p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '20px',
                marginTop: '20px'
              }}
            >
              <button
                className="btn-neon"
                onClick={() => setShowExitModal(false)}
              >
                Stay
              </button>
              <button
                className="btn-neon"
                style={{ background: 'var(--neon-red)' }}
                onClick={handleEnd}
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
