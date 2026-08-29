import React, { useState, useEffect, useRef, useCallback } from "react";
import Draggable, { type DraggableData, type DraggableEvent } from 'react-draggable';
import { StopCircle, ArrowUpCircle, ArrowDownCircle, Lock, Unlock, Activity, Volume2, VolumeX, ShieldAlert } from 'lucide-react';
import { CameraPermissionRecovery } from './CameraPermissionRecovery';
import { useCameraPose } from '../hooks/useCameraPose';
import { poseService } from '../services/poseService';
import { overlayRenderer } from '../services/overlayRenderer';
import { getJointAngles, getJointVisibility } from '../utils/poseMath';
import { getPostureErrorCategories } from '../engine/feedbackEngine';
import { exerciseEngine, EngineState } from '../services/exerciseEngine';
import { CameraView } from './CameraView/CameraView';
import { ExerciseConfig } from '../config/exercises';
import { sessionRecorder, type FrameData } from '../services/sessionRecorder';
import { skeletalSense } from '../services/skeletalSense'; // Kept on main thread for reliable auto-detect
import { poseLockService } from '../services/poseLockService';
import { clipEngine } from '../services/clipEngine';
import { BodyType} from '../services/bodyTypeEngine';
import { initialSquatDepthStats } from '../services/Squat_depth_classifier';
import { useWorkoutSync } from '../hooks/useWorkoutSync';
import { useDisplayConfig } from '../hooks/useDisplayConfig';
import { audioFeedbackService } from '../services/audioFeedbackService';
import { ExitConfirmModal } from './ExitConfirmModal';
import { useWorkoutWebSocket } from '../hooks/useWorkoutWebSocket';
import { useOffscreenCanvas } from '../hooks/useOffscreenCanvas';
import { injuryRiskEngine } from '../services/injuryRiskEngine';
import { FocusPanel, TimerPanel, RepsPanel, EnginePanel, SensePanel, AngleDialPanel, RiskPanel, TutPanel } from './WorkoutPanels';
import { ghostService } from '../services/ghostService';
import type { GhostStats } from '../services/ghostService';
import { DepthEstimationEngine } from '../services/depthEstimationEngine';
import { reconstruct3DMesh } from '../services/mesh3DEngine';
import { gestureService, GestureCommand } from '../services/gestureService';
import { useVoiceControl } from '../hooks/useVoiceControl';

import { CameraErrorBoundary } from './CameraErrorBoundary';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import { neuralFormEngine } from '../services/neuralFormEngine';

// ── Web Worker (Vite native worker bundling) ──────────────────────────────────
const createPoseWorker = () =>
  new Worker(new URL("../workers/poseWorker.ts", import.meta.url), {
    type: "module",
  });

interface WorkoutScreenProps {
  exercise: ExerciseConfig;
  onCancel?: () => void;
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
    jumpingJackSync?: { score: number | null, lagMs: number | null, confidence: number, samples: number };
    tags?: string[];
    tutMetrics?: any;
  }) => void;
  onAutoDetect?: (key: string) => void;
  bodyType?: BodyType;
  adaptiveFactor?: number;
}

type WorkoutPanelId = "focus" | "timer" | "reps" | "engine" | "sense" | "dial" | "risk" | "tut";

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
    dial: { x: Math.max(width - 230, 30), y: 150 },
    risk: { x: Math.max(width - 230, 30), y: 290 },
    tut: { x: Math.max(width - 230, 30), y: 300 },
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

const getProgressiveSpeech = (rawMsg: string, durationMs: number): string => {
  const cleanMsg = rawMsg.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, "").trim();
  const lowerMsg = cleanMsg.toLowerCase();
  
  let errorType: "depth" | "back" | "knee" | "elbow" | "generic" = "generic";
  if (lowerMsg.includes("lower") || lowerMsg.includes("deeper") || lowerMsg.includes("depth") || lowerMsg.includes("deep")) {
    errorType = "depth";
  } else if (lowerMsg.includes("back") || lowerMsg.includes("spine") || lowerMsg.includes("sag")) {
    errorType = "back";
  } else if (lowerMsg.includes("toe") || lowerMsg.includes("knee past")) {
    errorType = "knee";
  } else if (lowerMsg.includes("elbow")) {
    errorType = "elbow";
  }

  if (durationMs < 15000) {
    switch (errorType) {
      case "depth": return "Go lower.";
      case "back": return "Keep your back straight.";
      case "knee": return "Knee past toes. Shift weight back.";
      case "elbow": return "Keep elbows at side.";
      default: return cleanMsg;
    }
  } else if (durationMs < 30000) {
    switch (errorType) {
      case "depth": return "Go a little deeper.";
      case "back": return "Keep a neutral spine.";
      case "knee": return "Watch your front knee alignment.";
      case "elbow": return "Tuck your elbows in.";
      default: return `${cleanMsg}, focus on technique.`;
    }
  } else if (durationMs < 60000) {
    switch (errorType) {
      case "depth": return "You're close. Keep pushing.";
      case "back": return "Back straight. Keep pushing.";
      case "knee": return "Keep weight back. Stay strong.";
      case "elbow": return "Keep elbows locked in place.";
      default: return `${cleanMsg}. Keep pushing.`;
    }
  } else if (durationMs < 90000) {
    switch (errorType) {
      case "depth": return "Still not reaching full depth.";
      case "back": return "Still sagging your back. Core tight.";
      case "knee": return "Knee is still past toes.";
      case "elbow": return "Elbows flaring. Focus on form.";
      default: return `Still committing form error. Focus up.`;
    }
  } else {
    return "Take a short reset and focus on form.";
  }
};

export const WorkoutScreen: React.FC<WorkoutScreenProps> = ({ exercise, onEnd, onAutoDetect, bodyType }) => {
  const { settings, updateSetting } = useSettings();
  const { user } = useAuth();
  useEffect(() => {
  if (!user?.uid) return; // Guard clause 
}, [user?.uid]);
  const voiceFeedbackEnabled = settings.voiceFeedback;
  const voiceCommandsEnabled = settings.voiceCommands;
  const lastSpokenFeedbackRef = useRef<string>("");
  const lastSpokenTimeRef = useRef<number>(0);
  const lastMotivationTimeRef = useRef<number>(0);
  const consecutiveMistakeStartRef = useRef<number>(0);
  const lastDownStruggleSpokenRef = useRef<boolean>(false);
  const lastUpPauseSpokenRef = useRef<boolean>(false);
  const lastErrorCategoryRef = useRef<string>("none");

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
      sense: React.createRef<HTMLDivElement>(),
      dial: React.createRef<HTMLDivElement>(),
      risk: React.createRef<HTMLDivElement>(),
      tut: React.createRef<HTMLDivElement>()
    };
  }

  const panelRefsById = panelRefs.current;
  const [panelsLocked, setPanelsLocked] = useState(true);
  const [currentAngle, setCurrentAngle] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [riskMetrics, setRiskMetrics] = useState({
    riskIndex: 0,
    fatigueIndex: 0,
    asymmetryScore: 0,
    recommendedStopRep: null as number | null,
  });
  const [panelPositions, setPanelPositions] = useState<PanelPositions>(() => getStoredPanelPositions());
  const [showExitModal, setShowExitModal] = useState(false);
  const [depth3DEnabled, setDepth3DEnabled] = useState(false);
  const { config: displayConfig, updateConfig: updateDisplayConfig } = useDisplayConfig();
  const [seconds, setSeconds] = useState(0);
  const [vlmProgress, setVlmProgress] = useState(0);
  const [clipResult, setClipResult] = useState<any>(null);
  const srOnly: React.CSSProperties = {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    whiteSpace: 'nowrap',
    borderWidth: 0,
  };

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
  const workerInFlightRef = useRef<boolean>(false); // a frame is awaiting a worker reply
  const workerSkipCountRef = useRef<number>(0); // consecutive frames skipped under backpressure
  const [mismatchError, setMismatchError] = useState<string | null>(null);

  const [gestureConfidences, setGestureConfidences] = useState<Record<string, number>>({});
  const [lastGestureCommand, setLastGestureCommand] = useState<GestureCommand | null>(null);
  const [gestureHudVisible, setGestureHudVisible] = useState(false);
  const gestureHudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workoutControlRef = useRef<'idle' | 'running' | 'paused'>('idle');
  const [workoutControlState, setWorkoutControlState] = useState<'idle' | 'running' | 'paused'>('idle');
  const ghostFramesRef = useRef<FrameData[]>([]);
  const ghostStatsRef = useRef<GhostStats | null>(null);
  const [hasGhost, setHasGhost] = useState(false);

  const clampPanelPositions = useCallback((positions: PanelPositions) => {
    const { width, height } = getViewportSize();

    return (Object.keys(positions) as WorkoutPanelId[]).reduce((nextPositions, panelId) => {
      const panel = panelRefsById[panelId].current;
      const maxX = Math.max(width - (panel?.offsetWidth || 0), 0);
      const maxY = Math.max(height - (panel?.offsetHeight || 0), 0);

      nextPositions[panelId] = {
        x: Math.min(Math.max(positions[panelId].x, 0), maxX),
        y: Math.min(Math.max(positions[panelId].y, 0), maxY),
      };
      return nextPositions;
    }, {} as PanelPositions);
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

  // ── Unified Virtual Trainer Voice Coaching System ──────────────────────────────
  useEffect(() => {
    // 1. Maintain ARIA accessibility announcements first
    setFeedbackAnnouncement(engineState.feedback);
    
    const repCompleted = engineState.reps > prevRepsRef.current && engineState.reps > 0;
    if (repCompleted) {
      setRepAnnouncement(engineState.reps.toString());
    }
    
    // Update the ref so we don't double-trigger rep announcements
    prevRepsRef.current = engineState.reps;

    // Reset struggle/pause triggers on stage transitions
    if (engineState.stage === "up") {
      lastDownStruggleSpokenRef.current = false;
    } else if (engineState.stage === "down") {
      lastUpPauseSpokenRef.current = false;
    }

    // 2. Guard for voice output settings (Immediate Mute Guard)
    if (!voiceFeedbackEnabled) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return;
    }

    if (!('speechSynthesis' in window)) {
      return;
    }

    const msg = engineState.feedback.trim();
    const cleanMsg = msg.replace(/[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]/g, "").trim();

    // Setup / non-coaching messages ignore list
    const ignoreList = [
      "establishing posture...",
      "get into position...",
      "ready 🟢",
      "sensors blurred — position body",
      "good form ✅"
    ];
    const isSetupOrNeutral = ignoreList.some(item => msg.toLowerCase().includes(item)) || !msg;

    // Completed rep praise depth outcomes (these are spoken on rep complete, not mid-rep)
    const praiseList = [
      "deep squat ✅",
      "parallel depth ✅",
      "deep pushup ✅",
      "good depth ✅"
    ];
    const isRepPraiseMessage = praiseList.some(item => msg.toLowerCase().includes(item));

    // Active correction/guidance cue (not setup/neutral, not rep praise)
    const isCoachingCue = !isSetupOrNeutral && !isRepPraiseMessage;

    // Update mistake start ref by tracking correction categories
    const lowerMsg = cleanMsg.toLowerCase();
    let currentCategory: "depth" | "back" | "knee" | "elbow" | "generic" | "none" = "none";
    if (isCoachingCue) {
      if (lowerMsg.includes("lower") || lowerMsg.includes("deeper") || lowerMsg.includes("depth") || lowerMsg.includes("deep")) {
        currentCategory = "depth";
      } else if (lowerMsg.includes("back") || lowerMsg.includes("spine") || lowerMsg.includes("sag")) {
        currentCategory = "back";
      } else if (lowerMsg.includes("toe") || lowerMsg.includes("knee past")) {
        currentCategory = "knee";
      } else if (lowerMsg.includes("elbow")) {
        currentCategory = "elbow";
      } else {
        currentCategory = "generic";
      }
    }

    if (currentCategory !== "none") {
      if (consecutiveMistakeStartRef.current === 0 || currentCategory !== lastErrorCategoryRef.current) {
        consecutiveMistakeStartRef.current = Date.now();
      }
      lastErrorCategoryRef.current = currentCategory;
    } else {
      consecutiveMistakeStartRef.current = 0;
      lastErrorCategoryRef.current = "none";
    }

    const now = Date.now();
    const MISTAKE_COOLDOWN = 8000;       // 8.0s persistent mistake rate limiter (target: 10-15 prompts / 2 mins)
    const MOTIVATION_COOLDOWN = 8000;   // 8.0s between motivational speech events

    const isSafetyWarning = !!mismatchError || (isCoachingCue && (engineState.status === "red" || cleanMsg.toLowerCase().includes("back straight") || cleanMsg.toLowerCase().includes("knee past toes")));

    // Decide what the trainer should say
    let speechCandidate = "";
    let shouldSpeak = false;
    let isMotivationalPhraseUsed = false;

    // A list of encouragement phrases
    const motivations = ["You've got this!", "Keep pushing!", "Stay strong!", "Almost there!", "Stay with it!"];
    const getRandomMotivation = () => motivations[Math.floor(Math.random() * motivations.length)];

    if (mismatchError) {
      const candidate = `Exercise mismatch. You appear to be doing ${mismatchError.toLowerCase()}`;
      const isNewMessage = candidate !== lastSpokenFeedbackRef.current;
      const cooldownElapsed = now - lastSpokenTimeRef.current > MISTAKE_COOLDOWN;
      if (isNewMessage || cooldownElapsed) {
        speechCandidate = candidate;
        shouldSpeak = true;
      }
    } else if (repCompleted) {
      // Prioritize correction message if the completed rep was faulty
      if (isCoachingCue) {
        speechCandidate = getProgressiveSpeech(msg, now - consecutiveMistakeStartRef.current);
        shouldSpeak = true;
      } else {
        // Correct rep completed with green form: speak rep count + positive praise
        const praises = [
          "Great rep!",
          "Excellent posture!",
          "Good form!",
          "Nice job!"
        ];
        const randomPraise = praises[Math.floor(Math.random() * praises.length)];
        speechCandidate = `${engineState.reps}. ${randomPraise}`;
        shouldSpeak = true;
      }
    } else {
      // 1. Struggle Trigger: holding the load phase (down stage) for too long (> 3.0s) and NO active mistakes
      if (engineState.stage === "down" && (now - engineState.stageStartTime > 3000) && !lastDownStruggleSpokenRef.current && !isCoachingCue) {
        if (now - lastMotivationTimeRef.current > MOTIVATION_COOLDOWN) {
          const strugglePraises = ["Almost there, stay strong!", "Stay strong, you've got this!", "Keep holding!"];
          speechCandidate = strugglePraises[Math.floor(Math.random() * strugglePraises.length)];
          shouldSpeak = true;
          lastDownStruggleSpokenRef.current = true;
          isMotivationalPhraseUsed = true;
        }
      }
      
      // 2. Inactivity Trigger: paused at the top (up stage) for too long (> 10.0s) and NO active mistakes
      else if (engineState.stage === "up" && engineState.reps > 0 && (now - engineState.lastRepTime > 10000) && !lastUpPauseSpokenRef.current && !isCoachingCue) {
        if (now - lastMotivationTimeRef.current > MOTIVATION_COOLDOWN) {
          speechCandidate = `Let's go, ${getRandomMotivation().toLowerCase()}`;
          shouldSpeak = true;
          lastUpPauseSpokenRef.current = true;
          isMotivationalPhraseUsed = true;
        }
      }

      // 3. Standard Coaching Cues (Escalating & Progressive)
      else if (isCoachingCue) {
        const candidate = getProgressiveSpeech(msg, now - consecutiveMistakeStartRef.current);
        const isNewMessage = candidate !== lastSpokenFeedbackRef.current;
        const cooldownElapsed = now - lastSpokenTimeRef.current > MISTAKE_COOLDOWN;

        if (isSafetyWarning) {
          if (isNewMessage || cooldownElapsed) {
            speechCandidate = candidate;
            shouldSpeak = true;
          }
        } else if (isNewMessage && cooldownElapsed) {
          speechCandidate = candidate;
          shouldSpeak = true;
        }
      }
    }

    // Execute speech
    if (shouldSpeak && speechCandidate) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechCandidate);
      utterance.rate = 1.05; // Slightly faster for responsiveness
      window.speechSynthesis.speak(utterance);

      lastSpokenFeedbackRef.current = speechCandidate; // Store actual spoken candidate
      lastSpokenTimeRef.current = now;

      if (isMotivationalPhraseUsed) {
        lastMotivationTimeRef.current = now;
      }
    }
  }, [engineState.feedback, engineState.reps, engineState.stage, engineState.lastRepTime, engineState.stageStartTime, engineState.status, voiceFeedbackEnabled, mismatchError]);

  // ── Announce exercise mismatch errors ─────────────────────────────────────────
  // role="alert" with aria-live="assertive" will interrupt the screen reader
  // immediately. We only use this for genuinely urgent errors like a mismatch.
  useEffect(() => {
    if (mismatchError) {
      setAlertAnnouncement(`Exercise mismatch detected. You appear to be doing ${mismatchError}. Switching is disabled mid-set.`);
    }
  }, [mismatchError]);


  const workerAnglesRef = useRef<Record<string, number>>({});
  const offscreenEnabledRef = useRef<boolean>(false);
  const { initOffscreenCanvas } = useOffscreenCanvas();
  useWorkoutWebSocket();


  const depthEngineRef = useRef<DepthEstimationEngine | null>(null);
  const lastDepthMapRef = useRef<any>(null);
  const endSessionRef = useRef<() => Promise<number | null>>();

  const handleEnd = useCallback(async () => {
    await endSessionRef.current?.();

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

    const gmmCategories = getPostureErrorCategories();
    const finalMistakes = { ...mutableState.current.mistakes };
    for (const [cat, count] of Object.entries(gmmCategories)) {
      if (count > 0) {
        finalMistakes[cat] = (finalMistakes[cat] || 0) + count;
      }
    }

    onEnd({
      reps: mutableState.current.reps,
      totalReps: mutableState.current.totalReps,
      correctReps: mutableState.current.correctReps,
      repScores: mutableState.current.repScores,
      repDeviations: mutableState.current.repDeviations,
      duration: seconds,
      accuracy: accuracy,
      mistakes: finalMistakes,
      bestStreak: mutableState.current.bestStreak,
      jumpingJackSync: mutableState.current.jumpingJackSync,
      tutMetrics: mutableState.current.tutMetrics,
      tags: clipEngine.generateSessionTags({
        accuracy: accuracy,
        avgConfidence: clipResult?.confidence || 0.8,
        mistakes: Object.keys(finalMistakes),
        duration: seconds,
      }),
    });
  }, [exercise.key, onEnd, seconds, clipResult]);

  const handleVoiceCommand = useCallback((cmd: 'START' | 'PAUSE' | 'STOP') => {
    if (cmd === 'STOP') {
      handleEnd();
    } else if (cmd === 'PAUSE' && workoutControlRef.current === 'running') {
      workoutControlRef.current = 'paused';
      setWorkoutControlState('paused');
    } else if (cmd === 'START' && workoutControlRef.current !== 'running') {
      workoutControlRef.current = 'running';
      setWorkoutControlState('running');
    }
  }, [handleEnd]);

  const { isListening: isVoiceListening } = useVoiceControl({
    enabled: voiceCommandsEnabled && workoutControlState !== 'idle',
    onCommand: handleVoiceCommand,
  });

  const handlePoseResults = useCallback(async (results: any) => {
    // ── SINGLE USER LOCK: Filter out erratic detections or second people ──
    const filteredResults = poseLockService.filter(results);
    if (!filteredResults || !filteredResults.poseLandmarks) return;

    if (depth3DEnabled && videoRef.current && depthEngineRef.current) {
      const video = videoRef.current;
      depthEngineRef.current.processFrame(video, (depthResult) => {
        if (depthResult) {
          lastDepthMapRef.current = depthResult;
        }
      });
    }

    // Calculate primary joint angle on every frame for real-time dial updates
    const currentFrameAngles = getJointAngles(results.poseLandmarks);
    const primaryJoint = exercise.primaryJoint || 'knee';
    setCurrentAngle(currentFrameAngles[primaryJoint] || 0);

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
                : label.includes("chest press")
                  ? "chestPressPunches"
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

    // Backpressure: skip while the worker is busy; cap skips so a dropped reply can't freeze angles
    if (workerInFlightRef.current && workerSkipCountRef.current < 5) {
      workerSkipCountRef.current++;
    } else {
      workerInFlightRef.current = true;
      workerSkipCountRef.current = 0;
      workerRef.current?.postMessage({
        landmarks: results.poseLandmarks,
        exercise: exercise.key,
        frameId: frameSkipRef.current,
        status: mutableState.current.status,
        primaryJoints: primaryJoints,
      });
    }

    // Use last worker result for angles (may be 1 frame stale — acceptable)
    const angles =
      Object.keys(workerAnglesRef.current).length > 0
        ? workerAnglesRef.current
        : getJointAngles(results.poseLandmarks); // Fallback if worker not ready yet

    const visibility = getJointVisibility(results.poseLandmarks);

    // Adjust structural thresholds dynamically based on active detected body type or calibrated profile
    const activeConfig = { ...exercise };
    const calib = settings.calibrationProfile?.[exercise.key];
    if (calib && calib.calibratedThreshold) {
      activeConfig.downThreshold = calib.calibratedThreshold;
    } else {
      if (bodyTypeRef.current === "endo" && activeConfig.key === "squat") {
        activeConfig.downThreshold += 5; // Softer extension limit due to compacted torso proportions
      } else if (bodyTypeRef.current === "ecto" && activeConfig.key === "squat") {
        activeConfig.downThreshold -= 5; // Stricter requirement for longer limbs to reach true parallel
      } else if (bodyTypeRef.current === "endo" && activeConfig.key === "pushup") {
        activeConfig.downThreshold -= 5; // Wider torsos reach absolute down plane sooner
      }
    }

    // 2. Process through multi-exercise engine (stays on main thread — manages state)
    const nextState = await exerciseEngine.process(
      activeConfig,
      angles,
      visibility,
      mutableState.current,
      bodyTypeRef.current,
      results.poseLandmarks
    );
    
    // Trigger Audio Feedback
    if (nextState.correctReps > mutableState.current.correctReps) {
      audioFeedbackService.playSuccessChime();
    } else if (nextState.status === "red" && mutableState.current.status !== "red") {
      audioFeedbackService.playErrorBuzz();
    }

    mutableState.current = nextState;
    setEngineState(nextState);

    let riskSnapshot: ReturnType<typeof injuryRiskEngine.computeRisk> | undefined;
    if (nextState.vbtMetrics) {
      riskSnapshot = injuryRiskEngine.computeRisk(nextState.vbtMetrics, nextState.reps);
      setRiskMetrics({
        riskIndex: riskSnapshot.riskIndex,
        fatigueIndex: riskSnapshot.fatigueIndex,
        asymmetryScore: riskSnapshot.asymmetryScore,
        recommendedStopRep: riskSnapshot.recommendedStopRep,
      });
      sessionRecorder.recordRisk({
        timestamp: Date.now(),
        riskIndex: riskSnapshot.riskIndex,
        fatigueIndex: riskSnapshot.fatigueIndex,
        asymmetryScore: riskSnapshot.asymmetryScore,
      });
    }

    sessionRecorder.recordFrame({
      timestamp: Date.now(),
      landmarks: results.poseLandmarks,
      angles,
      feedback: nextState.feedback,
      exercise: exercise.key,
      riskScore: riskSnapshot?.riskIndex,
      fatigueIndex: riskSnapshot?.fatigueIndex,
      asymmetryScore: riskSnapshot?.asymmetryScore,
    });

    // 5. Rendering (Main thread fallback if OffscreenCanvas disabled)
    if (!offscreenEnabledRef.current) {
      if (depth3DEnabled && lastDepthMapRef.current && videoRef.current) {
        const video = videoRef.current;
        const { meshVertices } = reconstruct3DMesh(
          results.poseLandmarks,
          lastDepthMapRef.current,
          video.videoWidth || 1280,
          video.videoHeight || 720
        );
        overlayRenderer.setMeshVertices(meshVertices);
        overlayRenderer.set3DEnabled(true);
      } else {
        overlayRenderer.set3DEnabled(false);
        overlayRenderer.setMeshVertices(null);
      }
      
      const errorJoints: number[] = [];
      if (nextState.mistakes["knee"]) errorJoints.push(25, 26);
      if (nextState.mistakes["back"]) errorJoints.push(11, 12, 23, 24);
      if (nextState.mistakes["elbow"]) errorJoints.push(13, 14);
      if (nextState.mistakes["depth"]) errorJoints.push(23, 24);
      
      overlayRenderer.draw(results, nextState.status, primaryJoints, errorJoints);
    }
  }, [exercise, depth3DEnabled, handleEnd, settings]);

  const handleFrameTick = useCallback((count: number) => {
    setVlmProgress(clipEngine.getProgress());
    if (count % 15 === 0 && videoRef.current) {
      clipEngine.analyzeFrame(videoRef.current).then((res) => {
      .catch(err => console.error(err))