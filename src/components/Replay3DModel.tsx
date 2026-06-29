import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {
  GLTFLoader,
  type GLTF,
} from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { createBaseMaterialForSkin } from "../utils/avatarSkins";

// ─── Scene builder helpers (extracted from this file) ─────────────────────────
import {
  buildJointMeshes,
  buildSkeletonLines,
  buildAxesHelpers,
  buildSkyboxEnvironment,
  buildRippleGridPlane,
  buildStressVectors,
  MUSCLE_JOINT_GROUPS,
  type BoneEntry,
  type StressVectorRig,
} from "./sceneBuilders";

// ─── Module-Level GLTF Cache ──────────────────────────────────────────────────

const gltfCache = new Map<string, GLTF>();

export function clearGLTFCache(): void {
  gltfCache.clear();
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearGLTFCache();
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayFrame {
  timestamp: number;
  landmarks: { x: number; y: number; z: number; visibility?: number }[];
  angles?: Record<string, number>;
  feedback: string;
  exercise?: string;
  repCount?: number;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

function getInterpolatedLandmarks(
  frames: ReplayFrame[],
  floatIdx: number,
): { x: number; y: number; z: number; visibility?: number }[] | null {
  const n = frames.length;
  if (n === 0) return null;
  const idx = Math.floor(floatIdx);
  const frac = floatIdx - idx;
  if (idx < 0 || idx >= n) return frames[idx]?.landmarks ?? null;
  if (frac < 0.001) return frames[idx].landmarks;
  const i0 = Math.max(0, idx - 1);
  const i1 = idx;
  const i2 = Math.min(n - 1, idx + 1);
  const i3 = Math.min(n - 1, idx + 2);
  const f0 = frames[i0].landmarks;
  const f1 = frames[i1].landmarks;
  const f2 = frames[i2].landmarks;
  const f3 = frames[i3].landmarks;
  const count = Math.min(f1.length, f2.length, 33);
  const result: { x: number; y: number; z: number; visibility?: number }[] = [];
  for (let i = 0; i < count; i++) {
    const lm1 = f1[i];
    const lm2 = f2[i];
    if (!lm1 || !lm2) { result.push(lm1 || lm2 || { x: 0, y: 0, z: 0 }); continue; }
    const lm0 = f0[i] || lm1;
    const lm3 = f3[i] || lm2;
    result.push({
      x: catmullRom(lm0.x, lm1.x, lm2.x, lm3.x, frac),
      y: catmullRom(lm0.y, lm1.y, lm2.y, lm3.y, frac),
      z: catmullRom(lm0.z, lm1.z, lm2.z, lm3.z, frac),
      visibility: lm1.visibility ?? lm2.visibility,
    });
  }
  return result;
}

export interface Replay3DModelProps {
  frames: ReplayFrame[];
  modelUrl?: string;
  currentFrameIdx?: number;
  isPlaying?: boolean;
  onFrameChange?: (idx: number) => void;
  onPlayToggle?: () => void;
  hideControls?: boolean;
  skin?: string;
  exerciseName?: string;
}

const HUD_JOINTS: { idx: number; boneKey: string; label: string; p1: number; p2: number; p3: number }[] = [
  { idx: 13, boneKey: "leftElbow",  label: "L ELBOW", p1: 11, p2: 13, p3: 15 },
  { idx: 14, boneKey: "rightElbow", label: "R ELBOW", p1: 12, p2: 14, p3: 16 },
  { idx: 25, boneKey: "leftKnee",   label: "L KNEE",  p1: 23, p2: 25, p3: 27 },
  { idx: 26, boneKey: "rightKnee",  label: "R KNEE",  p1: 24, p2: 26, p3: 28 },
  { idx: 23, boneKey: "leftHip",    label: "L HIP",   p1: 11, p2: 23, p3: 25 },
  { idx: 24, boneKey: "rightHip",   label: "R HIP",   p1: 12, p2: 24, p3: 26 },
];

type RippleEvent = {
  origin: THREE.Vector2;
  startTime: number;
  speed: number;
  strength: number;
};

// ─── Graphic Quality Presets ──────────────────────────────────────────────────

export type GraphicsPreset = "ultra" | "high" | "medium" | "low" | "potato";

interface GraphicsConfig {
  label: string;
  targetFPS: number;
  pixelRatio: number;
  smaa: boolean;
  ssao: boolean;
  ssaoRadius: number;
  ssaoMinDistance: number;
  ssaoMaxDistance: number;
  bloom: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  shadowMapEnabled: boolean;
  shadowMapType: THREE.ShadowMapType;
  shadowMapSize: number;
  antialias: boolean;
}

const GRAPHICS_PRESETS: Record<GraphicsPreset, GraphicsConfig> = {
  ultra: {
    label: "Ultra", targetFPS: 60, pixelRatio: 2.0, smaa: true, ssao: true,
    ssaoRadius: 8, ssaoMinDistance: 0.005, ssaoMaxDistance: 0.1, bloom: true,
    bloomStrength: 0.6, bloomRadius: 0.5, bloomThreshold: 0.4,
    shadowMapEnabled: true, shadowMapType: THREE.PCFSoftShadowMap,
    shadowMapSize: 2048, antialias: true,
  },
  high: {
    label: "High", targetFPS: 60, pixelRatio: 1.5, smaa: true, ssao: true,
    ssaoRadius: 6, ssaoMinDistance: 0.005, ssaoMaxDistance: 0.1, bloom: true,
    bloomStrength: 0.5, bloomRadius: 0.4, bloomThreshold: 0.4,
    shadowMapEnabled: true, shadowMapType: THREE.PCFShadowMap,
    shadowMapSize: 1024, antialias: true,
  },
  medium: {
    label: "Medium", targetFPS: 30, pixelRatio: 1.0, smaa: true, ssao: false,
    ssaoRadius: 4, ssaoMinDistance: 0.005, ssaoMaxDistance: 0.1, bloom: true,
    bloomStrength: 0.4, bloomRadius: 0.3, bloomThreshold: 0.5,
    shadowMapEnabled: true, shadowMapType: THREE.PCFShadowMap,
    shadowMapSize: 512, antialias: false,
  },
  low: {
    label: "Low", targetFPS: 30, pixelRatio: 0.75, smaa: false, ssao: false,
    ssaoRadius: 0, ssaoMinDistance: 0, ssaoMaxDistance: 0, bloom: false,
    bloomStrength: 0, bloomRadius: 0, bloomThreshold: 1,
    shadowMapEnabled: false, shadowMapType: THREE.BasicShadowMap,
    shadowMapSize: 256, antialias: false,
  },
  potato: {
    label: "Potato", targetFPS: 24, pixelRatio: 0.5, smaa: false, ssao: false,
    ssaoRadius: 0, ssaoMinDistance: 0, ssaoMaxDistance: 0, bloom: false,
    bloomStrength: 0, bloomRadius: 0, bloomThreshold: 1,
    shadowMapEnabled: false, shadowMapType: THREE.BasicShadowMap,
    shadowMapSize: 128, antialias: false,
  },
};

const PRESET_ORDER: GraphicsPreset[] = ["potato", "low", "medium", "high", "ultra"];

// ─── Adaptive FPS Monitor ─────────────────────────────────────────────────────

class AdaptiveFPSMonitor {
  private samples: number[] = [];
  private maxSamples = 60;
  private lastTime = 0;
  private consecutiveLow = 0;
  private consecutiveHigh = 0;
  private readonly upgradeCooldownMs = 8000;
  private lastUpgradeTime = 0;
  private readonly downgradeCooldownMs = 3000;
  private lastDowngradeTime = 0;

  record(now: number) {
    if (this.lastTime > 0) {
      const delta = now - this.lastTime;
      if (delta > 0 && delta < 2000) {
        const fps = 1000 / delta;
        this.samples.push(fps);
        if (this.samples.length > this.maxSamples) this.samples.shift();
      }
    }
    this.lastTime = now;
  }

  getAvgFPS(): number {
    if (this.samples.length < 5) return 60;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p10Idx = Math.floor(sorted.length * 0.1);
    return sorted[p10Idx];
  }

  evaluate(currentPreset: GraphicsPreset, targetFPS: number, now: number): -1 | 0 | 1 {
    const avg = this.getAvgFPS();
    const currentIdx = PRESET_ORDER.indexOf(currentPreset);
    if (avg < targetFPS * 0.75) {
      this.consecutiveHigh = 0;
      this.consecutiveLow++;
      if (
        this.consecutiveLow >= 20 &&
        currentIdx > 0 &&
        now - this.lastDowngradeTime > this.downgradeCooldownMs
      ) {
        this.consecutiveLow = 0;
        this.lastDowngradeTime = now;
        return -1;
      }
    } else if (avg >= targetFPS * 0.95) {
      this.consecutiveLow = 0;
      this.consecutiveHigh++;
      if (
        this.consecutiveHigh >= 120 &&
        currentIdx < PRESET_ORDER.length - 1 &&
        now - this.lastUpgradeTime > this.upgradeCooldownMs
      ) {
        this.consecutiveHigh = 0;
        this.lastUpgradeTime = now;
        return 1;
      }
    } else {
      this.consecutiveLow = 0;
      this.consecutiveHigh = 0;
    }
    return 0;
  }

  reset() {
    this.samples = [];
    this.consecutiveLow = 0;
    this.consecutiveHigh = 0;
    this.lastTime = 0;
  }
}

// ─── Colour helpers ───────────────────────────────────────────────────────────

const COLOR_GREEN  = new THREE.Color(0x00ff00);
const COLOR_YELLOW = new THREE.Color(0xffff00);
const COLOR_ORANGE = new THREE.Color(0xff8c00);
const COLOR_RED    = new THREE.Color(0xff0000);

const getStrainColor = (repCount = 0) => {
  const n = Math.min(repCount / 20, 1);
  if (n < 0.5) return COLOR_GREEN.clone().lerp(COLOR_YELLOW, n * 2);
  return COLOR_ORANGE.clone().lerp(COLOR_RED, (n - 0.5) * 2);
};

const parseFeedback = (feedback: string) => {
  if (
    typeof feedback !== "string" ||
    feedback.includes("ESTABLISHING") ||
    feedback.includes("Get into position") ||
    feedback.includes("READY 🟢")
  ) {
    return { baseColor: COLOR_YELLOW, badJoints: new Set<number>() };
  }
  if (feedback.includes("Good form ✅")) {
    return { baseColor: COLOR_GREEN, badJoints: new Set<number>() };
  }

  const badJoints = new Set<number>();
  let baseColor = COLOR_YELLOW;
  const mistakeColor = COLOR_RED;

  if (feedback.includes("Keep your back straight ❌")) {
    baseColor = COLOR_RED;
    [11, 12, 23, 24].forEach((j) => badJoints.add(j));
  }
  if (feedback.includes("Go lower for full range"))
    [13, 14].forEach((j) => badJoints.add(j));
  if (feedback.includes("over-bend knees"))
    [25, 26].forEach((j) => badJoints.add(j));
  if (
    feedback.includes("hips lower") ||
    feedback.includes("Drop your hips") ||
    feedback.includes("Hips too high")
  )
    [23, 24].forEach((j) => badJoints.add(j));
  if (
    feedback.includes("Squeeze at the top") ||
    feedback.includes("Keep elbows at side")
  )
    [11, 12, 13, 14].forEach((j) => badJoints.add(j));
  if (feedback.includes("Raise arms higher"))
    [11, 12].forEach((j) => badJoints.add(j));

  return { baseColor, badJoints, mistakeColor };
};

// ─── Bone proportion types ────────────────────────────────────────────────────

type BoneProportionKey =
  | "leftShoulder" | "leftElbow" | "rightShoulder" | "rightElbow"
  | "leftHip" | "leftKnee" | "rightHip" | "rightKnee"
  | "spine" | "neck";

type SegmentDefinition = {
  readonly boneKey: BoneProportionKey;
  readonly sampleLandmarks:
    | readonly [number, number]
    | readonly [number, number, number, number];
  readonly restMultiplier?: number;
};

const PROPORTION_SEGMENTS: SegmentDefinition[] = [
  { boneKey: "leftShoulder",  sampleLandmarks: [11, 13] },
  { boneKey: "leftElbow",     sampleLandmarks: [13, 15] },
  { boneKey: "rightShoulder", sampleLandmarks: [12, 14] },
  { boneKey: "rightElbow",    sampleLandmarks: [14, 16] },
  { boneKey: "leftHip",       sampleLandmarks: [23, 25] },
  { boneKey: "leftKnee",      sampleLandmarks: [25, 27] },
  { boneKey: "rightHip",      sampleLandmarks: [24, 26] },
  { boneKey: "rightKnee",     sampleLandmarks: [26, 28] },
  { boneKey: "spine",         sampleLandmarks: [23, 11, 24, 12], restMultiplier: 0.5 },
  { boneKey: "neck",          sampleLandmarks: [11, 12], restMultiplier: 0.25 },
];

const PROPORTION_SMOOTHING = 0.12;
const PROPORTION_MIN_RATIO = 0.78;
const PROPORTION_MAX_RATIO = 1.26;
const GRID_RIPPLE_MAX      = 6;
const GRID_RIPPLE_LIFETIME = 2.8;
const GRID_SIZE            = 10;

const buildSegmentScaleState = (ratio: number) => {
  const clampedRatio = THREE.MathUtils.clamp(ratio, PROPORTION_MIN_RATIO, PROPORTION_MAX_RATIO);
  const lateralScale = THREE.MathUtils.clamp(
    1 / Math.sqrt(Math.max(clampedRatio, 0.0001)), 0.88, 1.12,
  );
  const matrix = new THREE.Matrix4().makeScale(lateralScale, clampedRatio, lateralScale);
  const scale  = new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  return { ratio: clampedRatio, matrix, scale };
};

// ─── Graphics Settings Panel ──────────────────────────────────────────────────

interface GraphicsPanelProps {
  preset: GraphicsPreset;
  autoAdapt: boolean;
  currentFPS: number;
  onPresetChange: (p: GraphicsPreset) => void;
  onAutoAdaptChange: (v: boolean) => void;
}

const GraphicsPanel: React.FC<GraphicsPanelProps> = ({
  preset, autoAdapt, currentFPS, onPresetChange, onAutoAdaptChange,
}) => {
  const [open, setOpen] = useState(false);
  const cfg = GRAPHICS_PRESETS[preset];
  const fpsColor = currentFPS >= 50 ? "#00ff88" : currentFPS >= 30 ? "#ffcc00" : "#ff4444";

  return (
    <div style={{ position: "absolute", top: 10, right: 10, zIndex: 20, fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}>
        <div style={{ background: "rgba(0,0,0,0.75)", border: `1px solid ${fpsColor}`, borderRadius: 4, padding: "2px 8px", fontSize: "0.72rem", color: fpsColor, letterSpacing: 1, minWidth: 64, textAlign: "center" }}>
          {currentFPS.toFixed(0)} FPS
        </div>
        <button onClick={() => setOpen((o) => !o)} title="Graphics Settings"
          style={{ background: "rgba(0,0,0,0.75)", border: "1px solid #444", borderRadius: 4, color: "#ccc", cursor: "pointer", padding: "3px 8px", fontSize: "0.72rem", letterSpacing: 1 }}>
          ⚙ {GRAPHICS_PRESETS[preset].label.toUpperCase()}
        </button>
      </div>

      {open && (
        <div style={{ marginTop: 6, background: "rgba(10,10,15,0.93)", border: "1px solid #333", borderRadius: 6, padding: "12px 14px", width: 230, boxShadow: "0 4px 24px rgba(0,0,0,0.7)" }}>
          <div style={{ fontSize: "0.65rem", color: "#888", letterSpacing: 2, marginBottom: 8 }}>GRAPHICS QUALITY</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {(PRESET_ORDER.slice().reverse() as GraphicsPreset[]).map((p) => (
              <button key={p} disabled={autoAdapt} onClick={() => onPresetChange(p)}
                style={{ padding: "4px 9px", fontSize: "0.65rem", borderRadius: 3, border: `1px solid ${preset === p ? "#00ffcc" : "#333"}`, background: preset === p ? "rgba(0,255,204,0.12)" : "rgba(255,255,255,0.04)", color: preset === p ? "#00ffcc" : "#888", cursor: autoAdapt ? "not-allowed" : "pointer", opacity: autoAdapt ? 0.5 : 1, letterSpacing: 1, transition: "all 0.15s" }}>
                {GRAPHICS_PRESETS[p].label.toUpperCase()}
              </button>
            ))}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
            <div onClick={() => onAutoAdaptChange(!autoAdapt)}
              style={{ width: 32, height: 16, borderRadius: 8, background: autoAdapt ? "#00ffcc" : "#333", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: autoAdapt ? 18 : 2, width: 12, height: 12, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: "0.65rem", color: autoAdapt ? "#00ffcc" : "#888", letterSpacing: 1 }}>AUTO-ADAPT</span>
          </label>

          <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: 8 }}>
            {[
              ["SMAA",    cfg.smaa ? "ON" : "OFF",                               cfg.smaa],
              ["SSAO",    cfg.ssao ? "ON" : "OFF",                               cfg.ssao],
              ["BLOOM",   cfg.bloom ? "ON" : "OFF",                              cfg.bloom],
              ["SHADOWS", cfg.shadowMapEnabled ? `${cfg.shadowMapSize}px` : "OFF", cfg.shadowMapEnabled],
              ["DPR",     `×${cfg.pixelRatio.toFixed(2)}`,                       cfg.pixelRatio >= 1.0],
              ["TARGET",  `${cfg.targetFPS} FPS`,                                true],
            ].map(([key, val, good]) => (
              <div key={key as string} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.62rem", color: "#555", padding: "2px 0", letterSpacing: 1 }}>
                <span>{key as string}</span>
                <span style={{ color: good ? "#00ffcc" : "#666" }}>{val as string}</span>
              </div>
            ))}
          </div>

          {autoAdapt && (
            <div style={{ marginTop: 8, fontSize: "0.58rem", color: "#555", letterSpacing: 0.5, lineHeight: 1.5 }}>
              Auto-adapt monitors FPS and steps quality up/down to maintain target frame rate.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const Replay3DModel: React.FC<Replay3DModelProps> = ({
  frames,
  modelUrl = "/model.glb",
  currentFrameIdx: externalFrameIdx,
  isPlaying: externalIsPlaying,
  onFrameChange,
  onPlayToggle,
  hideControls = false,
  skin = "Standard Human",
  exerciseName = "squat",
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [_isPlaying, _setIsPlaying]     = useState(false);
  const [_currentFrameIdx, _setCurrentFrameIdx] = useState(0);
  const [modelLoaded, setModelLoaded]   = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError]     = useState<string | null>(null);

  // Graphic state
  const [graphicsPreset, setGraphicsPreset] = useState<GraphicsPreset>("high");
  const [autoAdapt, setAutoAdapt]           = useState(true);
  const [displayFPS, setDisplayFPS]         = useState(60);
  const graphicsPresetRef = useRef<GraphicsPreset>("high");
  const autoAdaptRef      = useRef(true);
  const fpsMonitor        = useRef(new AdaptiveFPSMonitor());
  const frameFloatRef     = useRef(0);
  const currentFrameIdxRef = useRef(0);

  const isPlaying        = externalIsPlaying   !== undefined ? externalIsPlaying   : _isPlaying;
  const currentFrameIdx  = externalFrameIdx    !== undefined ? externalFrameIdx    : _currentFrameIdx;
  const setIsPlaying     = onPlayToggle ? () => onPlayToggle() : _setIsPlaying;
  const setCurrentFrameIdx = onFrameChange ? onFrameChange : _setCurrentFrameIdx;

  useEffect(() => { graphicsPresetRef.current = graphicsPreset; }, [graphicsPreset]);
  useEffect(() => { autoAdaptRef.current      = autoAdapt; },     [autoAdapt]);
  useEffect(() => { currentFrameIdxRef.current = currentFrameIdx; }, [currentFrameIdx]);

  // ── Three.js refs ─────────────────────────────────────────────────────────
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const smaaPassRef  = useRef<SMAAPass | null>(null);
  const ssaoPassRef  = useRef<SSAOPass | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // ── Builder-created object refs ───────────────────────────────────────────
  /** Joint sphere meshes produced by buildJointMeshes */
  const jointsRef       = useRef<THREE.Mesh[]>([]);
  /** Skeleton line segments produced by buildSkeletonLines */
  const bonesRef        = useRef<BoneEntry[]>([]);
  /** Per-joint axes helpers produced by buildAxesHelpers */
  const axesRef         = useRef<THREE.AxesHelper[]>([]);
  /** Muscle-group stress vector rigs produced by buildStressVectors */
  const stressVectorsRef = useRef<StressVectorRig[]>([]);
  const previousJointPositionsRef = useRef<(THREE.Vector3 | null)[]>([]);

  // ── Skybox / environment refs ─────────────────────────────────────────────
  const gridRef         = useRef<THREE.GridHelper | null>(null);
  const gridTargetRef   = useRef<THREE.Vector3>(new THREE.Vector3());
  /** Ripple-grid plane and its shader material produced by buildRippleGridPlane */
  const ripplePlaneRef    = useRef<THREE.Mesh | null>(null);
  const rippleMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // ── GLTF / bone refs ──────────────────────────────────────────────────────
  const modelGroupRef     = useRef<THREE.Group | null>(null);
  const boneMapRef        = useRef<Record<string, THREE.Bone>>({});
  const skinnedMeshesRef  = useRef<THREE.SkinnedMesh[]>([]);
  const restDataRef       = useRef<Record<string, { worldQuat: THREE.Quaternion; localQuat: THREE.Quaternion; dir: THREE.Vector3 }>>({});
  const rootOffsetRef     = useRef<THREE.Vector3>(new THREE.Vector3());
  const restSegmentLengthsRef   = useRef<Partial<Record<BoneProportionKey, number>>>({});
  const smoothedSegmentScalesRef = useRef<Partial<Record<BoneProportionKey, THREE.Vector3>>>({});

  // ── Ripple state refs ─────────────────────────────────────────────────────
  const rippleEventsRef             = useRef<RippleEvent[]>([]);
  const lastRepCountRef             = useRef<number | null>(null);
  const lastRippleCompletionTimeRef = useRef<number | null>(null);

  // ── Misc refs ─────────────────────────────────────────────────────────────
  const occluderMeshesRef    = useRef<THREE.Mesh[]>([]);
  const depthRaycasterRef    = useRef(new THREE.Raycaster());
  const orbitPelvisTargetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const hasOrbitPelvisTargetRef = useRef(false);
  const hudRefs      = useRef<Record<number, HTMLDivElement | null>>({});
  const hudAngleRefs = useRef<Record<number, HTMLSpanElement | null>>({});
  const reqIdRef             = useRef<number>(0);
  const lastTimeRef          = useRef<number>(0);
  const recoveryTimeoutRef   = useRef<number | null>(null);
  const rendererPipelineCleanupRef = useRef<(() => void) | null>(null);

  // ─── Occlusion helpers ──────────────────────────────────────────────────
  const refreshOccluderMeshes = useCallback((scene: THREE.Scene) => {
    const occluders: THREE.Mesh[] = [];
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (jointsRef.current.includes(mesh)) return;
      occluders.push(mesh);
    });
    occluderMeshesRef.current = occluders;
  }, []);

  const isPointOccluded = useCallback(
    (worldPoint: THREE.Vector3, camera: THREE.Camera) => {
      if (occluderMeshesRef.current.length === 0) return false;
      const origin = new THREE.Vector3();
      camera.getWorldPosition(origin);
      const toPoint = worldPoint.clone().sub(origin);
      const distance = toPoint.length();
      if (distance <= 0.0001) return false;
      const raycaster = depthRaycasterRef.current;
      raycaster.set(origin, toPoint.normalize());
      raycaster.near = 0.0001;
      raycaster.far  = distance - 0.002;
      const intersections = raycaster.intersectObjects(occluderMeshesRef.current, true);
      return intersections.length > 0 && intersections[0].distance < distance - 0.002;
    },
    [],
  );

  const updateFallbackSkeletonOcclusion = useCallback(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const jointVisibility = new Array(33).fill(true);
    jointsRef.current.forEach((joint, index) => {
      const worldPosition = joint.getWorldPosition(new THREE.Vector3());
      const visible = !isPointOccluded(worldPosition, camera);
      joint.visible = visible;
      jointVisibility[index] = visible;
    });
    bonesRef.current.forEach((bone) => {
      const startMesh = jointsRef.current[bone.startIdx];
      const endMesh   = jointsRef.current[bone.endIdx];
      if (!startMesh || !endMesh) return;
      const startPoint = startMesh.getWorldPosition(new THREE.Vector3());
      const endPoint   = endMesh.getWorldPosition(new THREE.Vector3());
      const midpoint   = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
      bone.line.visible =
        jointVisibility[bone.startIdx] ||
        jointVisibility[bone.endIdx]   ||
        !isPointOccluded(midpoint, camera);
    });
  }, [isPointOccluded]);

  // ─── Stress vector updater ───────────────────────────────────────────────
  const updateStressVectors = useCallback(
    (
      getLm: (idx: number) => THREE.Vector3 | null,
      bodyCenter: THREE.Vector3 | null,
      shoulderCenter: THREE.Vector3 | null,
      hipCenter: THREE.Vector3 | null,
      baseColor: THREE.Color,
      badJoints: Set<number>,
      exerciseName: string,
      time: number,
    ) => {
      const rigs = stressVectorsRef.current;
      if (rigs.length === 0) return;

      const previousPositions = previousJointPositionsRef.current;
      const allowedGroups = new Set<keyof typeof MUSCLE_JOINT_GROUPS>(
        (exerciseName.includes("squat")
          ? ["legs", "core"]
          : exerciseName.includes("plank")
            ? ["core", "legs"]
            : exerciseName.includes("curl") || exerciseName.includes("push")
              ? ["arms", "core"]
              : ["arms", "core", "legs"]) as Array<keyof typeof MUSCLE_JOINT_GROUPS>,
      );

      const fallbackCenter = bodyCenter ?? shoulderCenter ?? hipCenter ?? new THREE.Vector3(0, 0, 0);
      const upAxis   = new THREE.Vector3(0, 1, 0);
      const sideAxis = new THREE.Vector3(1, 0, 0);

      rigs.forEach((rig) => {
        const jointPos  = getLm(rig.jointIdx);
        const parentPos = getLm(rig.parentIdx) ?? fallbackCenter;
        if (!jointPos) { rig.mesh.visible = false; return; }

        const previousPos  = previousPositions[rig.jointIdx];
        const movement     = previousPos ? jointPos.distanceTo(previousPos) : 0;
        const motionStress = THREE.MathUtils.clamp(movement * 3.25, 0, 1);
        const tensionBoost = badJoints.has(rig.jointIdx) ? 0.38 : 0;
        const groupBoost   = allowedGroups.has(rig.muscleGroup) ? 0.14 : 0.04;

        const outward  = jointPos.clone().sub(fallbackCenter).normalize();
        const limbAxis = jointPos.clone().sub(parentPos).normalize();
        const direction = outward.multiplyScalar(0.55)
          .add(limbAxis.multiplyScalar(0.35))
          .add(upAxis.clone().multiplyScalar(0.07))
          .add(sideAxis.clone().multiplyScalar(0.03))
          .normalize();

        const stress    = THREE.MathUtils.clamp(motionStress * 0.55 + tensionBoost + groupBoost, 0, 1);
        const length    = 0.45 + stress * 1.55;
        const thickness = 0.045 + stress * 0.03;
        const position  = jointPos.clone().add(direction.clone().multiplyScalar(0.08 + stress * 0.1));

        rig.mesh.visible = stress > 0.02;
        rig.mesh.position.copy(position);
        rig.mesh.quaternion.setFromUnitVectors(upAxis, direction);
        rig.mesh.renderOrder = 4;

        rig.material.uniforms.uStress.value    = stress;
        rig.material.uniforms.uLength.value    = length;
        rig.material.uniforms.uThickness.value = thickness;
        rig.material.uniforms.uTime.value      = time * 0.001;
        rig.material.uniforms.uColor.value.copy(baseColor).lerp(
          badJoints.has(rig.jointIdx) ? new THREE.Color(0xff3300) : new THREE.Color(0x00ffff),
          stress,
        );

        previousPositions[rig.jointIdx] = jointPos.clone();
      });
    },
    [],
  );

  // ─── Ripple helpers ──────────────────────────────────────────────────────
  const syncRippleUniforms = useCallback((timeSeconds: number) => {
    const material = rippleMaterialRef.current;
    if (!material) return;
    const activeEvents = rippleEventsRef.current.filter(
      (event) => timeSeconds - event.startTime <= GRID_RIPPLE_LIFETIME,
    );
    rippleEventsRef.current = activeEvents;

    const origins   = material.uniforms.uRippleOrigins.value  as THREE.Vector2[];
    const starts    = material.uniforms.uRippleStarts.value    as number[];
    const speeds    = material.uniforms.uRippleSpeeds.value    as number[];
    const strengths = material.uniforms.uRippleStrengths.value as number[];

    material.uniforms.uTime.value        = timeSeconds;
    material.uniforms.uRippleCount.value = activeEvents.length;

    for (let i = 0; i < GRID_RIPPLE_MAX; i++) {
      const event = activeEvents[i];
      if (event) {
        origins[i].copy(event.origin);
        starts[i]    = event.startTime;
        speeds[i]    = event.speed;
        strengths[i] = event.strength;
      } else {
        origins[i].set(-10, -10);
        starts[i] = speeds[i] = strengths[i] = 0;
      }
    }
  }, []);

  const emitRipple = useCallback(
    (origin: THREE.Vector2, speed: number, strength: number, timeSeconds: number) => {
      rippleEventsRef.current = [
        { origin: origin.clone(), startTime: timeSeconds, speed, strength },
        ...rippleEventsRef.current,
      ].slice(0, GRID_RIPPLE_MAX);
      lastRippleCompletionTimeRef.current = timeSeconds;
      syncRippleUniforms(timeSeconds);
    },
    [syncRippleUniforms],
  );

  const updateGridPosition = useCallback((bodyCenter: THREE.Vector3 | null) => {
    const grid = gridRef.current;
    if (!grid) return;
    const targetX = bodyCenter ? bodyCenter.x : 0;
    const targetZ = bodyCenter ? bodyCenter.z : 0;
    gridTargetRef.current.set(targetX, -1.01, targetZ);
    grid.position.lerp(gridTargetRef.current, 0.08);
  }, []);

  // ─── Post-processing rebuild ─────────────────────────────────────────────
  const rebuildPasses = useCallback(
    (preset: GraphicsPreset, forceWidth?: number, forceHeight?: number) => {
      const renderer = rendererRef.current;
      const composer = composerRef.current;
      const scene    = sceneRef.current;
      const camera   = cameraRef.current;
      const mount    = mountRef.current;
      if (!renderer || !composer || !scene || !camera || !mount) return;

      const cfg = GRAPHICS_PRESETS[preset];
      const w   = forceWidth  ?? mount.clientWidth;
      const h   = forceHeight ?? mount.clientHeight;

      renderer.setPixelRatio(Math.min(cfg.pixelRatio, window.devicePixelRatio ?? 1));
      renderer.shadowMap.enabled = cfg.shadowMapEnabled;
      renderer.shadowMap.type    = cfg.shadowMapType;

      while (composer.passes.length > 1) composer.passes.pop();
      smaaPassRef.current = ssaoPassRef.current = bloomPassRef.current = null;

      if (cfg.ssao) {
        const ssao = new SSAOPass(scene, camera, w, h);
        ssao.kernelRadius  = cfg.ssaoRadius;
        ssao.minDistance   = cfg.ssaoMinDistance;
        ssao.maxDistance   = cfg.ssaoMaxDistance;
        ssao.output        = SSAOPass.OUTPUT.Default;
        composer.addPass(ssao);
        ssaoPassRef.current = ssao;
      }
      if (cfg.bloom) {
        const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), cfg.bloomStrength, cfg.bloomRadius, cfg.bloomThreshold);
        composer.addPass(bloom);
        bloomPassRef.current = bloom;
      }
      if (cfg.smaa) {
        const smaa = new SMAAPass(w, h);
        composer.addPass(smaa);
        smaaPassRef.current = smaa;
      }
      composer.setSize(w, h);
    },
    [],
  );

  const applyPreset = useCallback(
    (preset: GraphicsPreset) => {
      setGraphicsPreset(preset);
      graphicsPresetRef.current = preset;
      fpsMonitor.current.reset();
      rebuildPasses(preset);
    },
    [rebuildPasses],
  );

  // ─── Skin effect ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (modelLoaded && skinnedMeshesRef.current.length > 0) {
      skinnedMeshesRef.current.forEach((mesh) => {
        if (mesh.material) {
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else mesh.material.dispose();
        }
        mesh.material = createBaseMaterialForSkin(skin);
      });
    }
  }, [skin, modelLoaded]);

  // ─── Segment scale adaptor ───────────────────────────────────────────────
  const updateSegmentScaleAdaptor = useCallback(
    (frameLandmarks: ReplayFrame["landmarks"], getLm: (idx: number) => THREE.Vector3 | null) => {
      if (!modelLoaded || !modelGroupRef.current) return;
      const bones = boneMapRef.current;
      if (!bones || Object.keys(bones).length === 0) return;

      for (const segment of PROPORTION_SEGMENTS) {
        const bone = bones[segment.boneKey];
        if (!bone) continue;

        const [firstA, firstB, secondA, secondB] = segment.sampleLandmarks;
        const start = getLm(firstA);
        const end   = getLm(firstB);

        if (!start || !end) {
          const fallbackScale = smoothedSegmentScalesRef.current[segment.boneKey] ?? new THREE.Vector3(1, 1, 1);
          fallbackScale.lerp(new THREE.Vector3(1, 1, 1), PROPORTION_SMOOTHING);
          smoothedSegmentScalesRef.current[segment.boneKey] = fallbackScale;
          bone.scale.copy(fallbackScale);
          continue;
        }

        let measuredLength = start.distanceTo(end);
        if (typeof secondA === "number" && typeof secondB === "number") {
          const altStart = getLm(secondA), altEnd = getLm(secondB);
          if (altStart && altEnd) measuredLength = (measuredLength + altStart.distanceTo(altEnd)) / 2;
        }

        const visibilityA = frameLandmarks[firstA]?.visibility ?? 0;
        const visibilityB = frameLandmarks[firstB]?.visibility ?? 0;
        const visibilityC = typeof secondA === "number" ? (frameLandmarks[secondA]?.visibility ?? 0) : 1;
        const visibilityD = typeof secondB === "number" ? (frameLandmarks[secondB]?.visibility ?? 0) : 1;
        const confidence  = Math.min(visibilityA, visibilityB, visibilityC, visibilityD);

        if (confidence < 0.25) {
          const fallbackScale = smoothedSegmentScalesRef.current[segment.boneKey] ?? new THREE.Vector3(1, 1, 1);
          fallbackScale.lerp(new THREE.Vector3(1, 1, 1), PROPORTION_SMOOTHING);
          smoothedSegmentScalesRef.current[segment.boneKey] = fallbackScale;
          bone.scale.copy(fallbackScale);
          continue;
        }

        const restLength = restSegmentLengthsRef.current[segment.boneKey] ?? measuredLength;
        const normalizedDelta = restLength > 0 ? measuredLength / restLength - 1 : 0;
        const targetRatio = 1 + normalizedDelta * (segment.restMultiplier ?? 1);
        const targetScaleState = buildSegmentScaleState(targetRatio);

        const currentScale = smoothedSegmentScalesRef.current[segment.boneKey] ?? new THREE.Vector3(1, 1, 1);
        currentScale.lerp(targetScaleState.scale, PROPORTION_SMOOTHING);
        smoothedSegmentScalesRef.current[segment.boneKey] = currentScale;
        bone.scale.copy(currentScale);
        bone.updateMatrixWorld(true);
      }
    },
    [modelLoaded],
  );

  // ─── Scene + Renderer Setup ──────────────────────────────────────────────
  useEffect(() => {
    if (!frames || frames.length === 0) return;
    if (!mountRef.current) return;

    const width  = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.2);
    cameraRef.current = camera;

    // ── Environment assets (background, lights, grid, floor) ──────────────
    // Built by the dedicated helper — keeps this useEffect focused on wiring
    const skybox = buildSkyboxEnvironment(scene);
    gridRef.current = skybox.grid;

    // ── Ripple-grid animated ground plane ─────────────────────────────────
    const ripple = buildRippleGridPlane(scene);
    ripplePlaneRef.current    = ripple.plane;
    rippleMaterialRef.current = ripple.material;

    // ── Joint sphere meshes ────────────────────────────────────────────────
    jointsRef.current = buildJointMeshes(scene);

    // ── Per-joint axes helpers ─────────────────────────────────────────────
    axesRef.current = buildAxesHelpers(scene);

    // ── Skeleton line segments ─────────────────────────────────────────────
    bonesRef.current = buildSkeletonLines(scene);

    refreshOccluderMeshes(scene);

    // ── Muscle-group stress vectors ────────────────────────────────────────
    stressVectorsRef.current            = buildStressVectors(scene);
    previousJointPositionsRef.current   = new Array(33).fill(null);

    // ── GLTF model — cache-first loading ──────────────────────────────────
    setModelLoading(true);
    setModelError(null);

    const setupModel = (gltf: GLTF) => {
      const model = gltf.scene.clone(true);
      model.position.y = -1;
      scene.add(model);
      modelGroupRef.current = model;
      restSegmentLengthsRef.current  = {};
      smoothedSegmentScalesRef.current = {};

      const bones: Record<string, THREE.Bone> = {};
      model.traverse((o) => {
        if (o.type === "Bone") {
          const name = o.name.toLowerCase();
          if (name.includes("leftarm")  && !name.includes("fore")) bones.leftShoulder  = o as THREE.Bone;
          if (name.includes("leftforearm"))                         bones.leftElbow     = o as THREE.Bone;
          if (name.includes("lefthand") || name.includes("leftwrist")) bones.leftWrist = o as THREE.Bone;
          if (name.includes("rightarm") && !name.includes("fore")) bones.rightShoulder = o as THREE.Bone;
          if (name.includes("rightforearm"))                        bones.rightElbow    = o as THREE.Bone;
          if (name.includes("righthand") || name.includes("rightwrist")) bones.rightWrist = o as THREE.Bone;
          if (name.includes("leftupleg")  || name.includes("lefthip"))  bones.leftHip  = o as THREE.Bone;
          if (name.includes("leftleg")    || name.includes("leftknee")) bones.leftKnee = o as THREE.Bone;
          if (name.includes("leftfoot")   || name.includes("leftankle")) bones.leftAnkle = o as THREE.Bone;
          if (name.includes("rightupleg") || name.includes("righthip")) bones.rightHip  = o as THREE.Bone;
          if (name.includes("rightleg")   || name.includes("rightknee")) bones.rightKnee = o as THREE.Bone;
          if (name.includes("rightfoot")  || name.includes("rightankle")) bones.rightAnkle = o as THREE.Bone;
          if (name.includes("spine")) {
            if      (name.includes("1")) bones.spine1 = o as THREE.Bone;
            else if (name.includes("2")) bones.spine2 = o as THREE.Bone;
            else                          bones.spine  = o as THREE.Bone;
          }
          if (name.includes("hips") && !name.includes("left") && !name.includes("right"))
            bones.hips = o as THREE.Bone;
          if (name.includes("neck")) bones.neck = o as THREE.Bone;
          if (name.includes("head")) bones.head = o as THREE.Bone;
        }
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
          const mesh = o as THREE.SkinnedMesh;
          skinnedMeshesRef.current.push(mesh);
          mesh.material    = createBaseMaterialForSkin(skin);
          mesh.castShadow  = true;
          mesh.receiveShadow = true;
        }
      });
      boneMapRef.current = bones;

      model.updateMatrixWorld(true);
      if (bones.hips) {
        const hipPos = new THREE.Vector3();
        bones.hips.getWorldPosition(hipPos);
        rootOffsetRef.current = model.position.clone().sub(hipPos);
      }

      const recordRest = (boneKey: string, childKey: string) => {
        const bone = bones[boneKey], childBone = bones[childKey];
        if (!bone || !childBone) return;
        const pPos = new THREE.Vector3(), cPos = new THREE.Vector3();
        bone.getWorldPosition(pPos);
        childBone.getWorldPosition(cPos);
        restSegmentLengthsRef.current[boneKey as BoneProportionKey] = pPos.distanceTo(cPos);
        const dir = new THREE.Vector3().subVectors(cPos, pPos).normalize();
        if (dir.lengthSq() < 0.001) return;
        const worldQ = new THREE.Quaternion();
        bone.getWorldQuaternion(worldQ);
        restDataRef.current[boneKey] = { worldQuat: worldQ.clone(), localQuat: bone.quaternion.clone(), dir: dir.clone() };
      };

      recordRest("leftShoulder",  "leftElbow");
      recordRest("leftElbow",     "leftWrist");
      recordRest("rightShoulder", "rightElbow");
      recordRest("rightElbow",    "rightWrist");
      recordRest("leftHip",       "leftKnee");
      recordRest("leftKnee",      "leftAnkle");
      recordRest("rightHip",      "rightKnee");
      recordRest("rightKnee",     "rightAnkle");
      if (bones.spine && bones.spine1)  recordRest("spine", "spine1");
      if (bones.neck  && bones.head)    recordRest("neck",  "head");

      setModelLoaded(true);
      setModelLoading(false);
      jointsRef.current.forEach((j) => (j.visible = false));
      bonesRef.current.forEach((b)  => (b.line.visible = false));
    };

    if (gltfCache.has(modelUrl)) {
      setupModel(gltfCache.get(modelUrl)!);
    } else {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => { gltfCache.set(modelUrl, gltf); setupModel(gltf); },
        undefined,
        (err) => {
          console.warn("Replay3DModel: Failed to load GLTF, falling back to skeleton.", err);
          setModelLoaded(false);
          setModelLoading(false);
          setModelError("Failed to load 3D model. Using skeleton fallback.");
        },
      );
    }

    let cancelled = false;

    const disposeRendererPipeline = () => {
      if (rendererPipelineCleanupRef.current) {
        rendererPipelineCleanupRef.current();
        rendererPipelineCleanupRef.current = null;
      }
    };

    const createRendererPipeline = () => {
      if (cancelled || !mountRef.current || !sceneRef.current || !cameraRef.current) return;
      disposeRendererPipeline();

      const cfg      = GRAPHICS_PRESETS[graphicsPresetRef.current];
      const renderer = new THREE.WebGLRenderer({ antialias: cfg.antialias });
      renderer.setPixelRatio(Math.min(cfg.pixelRatio, window.devicePixelRatio ?? 1));
      renderer.setSize(width, height);
      renderer.outputColorSpace   = THREE.SRGBColorSpace;
      renderer.toneMapping        = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled  = cfg.shadowMapEnabled;
      renderer.shadowMap.type     = cfg.shadowMapType;
      renderer.shadowMap.autoUpdate = true;
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(sceneRef.current, cameraRef.current));
      composerRef.current = composer;

      rebuildPasses(graphicsPresetRef.current, width, height);

      const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.4, 0.8);
      composer.addPass(bloomPass);
      bloomPassRef.current = bloomPass;

      const controls = new OrbitControls(cameraRef.current, renderer.domElement);
      controls.enableDamping  = true;
      controls.dampingFactor  = 0.05;
      controls.maxPolarAngle  = Math.PI / 2 + 0.1;
      controls.minDistance    = 1.0;
      controls.maxDistance    = 10.0;
      controlsRef.current     = controls;

      const handleContextLost = (event: Event) => {
        event.preventDefault();
        if (recoveryTimeoutRef.current !== null) return;
        recoveryTimeoutRef.current = window.setTimeout(() => {
          recoveryTimeoutRef.current = null;
          if (cancelled) return;
          createRendererPipeline();
        }, 75);
      };

      const handleContextRestored = () => {
        if (recoveryTimeoutRef.current !== null) {
          window.clearTimeout(recoveryTimeoutRef.current);
          recoveryTimeoutRef.current = null;
        }
        if (cancelled || !sceneRef.current || !cameraRef.current || rendererRef.current !== renderer) return;
        composer.render();
      };

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (!cameraRef.current || !rendererRef.current) return;
          const { width: w, height: h } = entry.contentRect;
          if (w === 0 || h === 0) return;
          rendererRef.current.setSize(w, h);
          rendererRef.current.setPixelRatio(window.devicePixelRatio);
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          composerRef.current?.setSize(w, h);
          bloomPassRef.current?.setSize(w, h);
          if (smaaPassRef.current) rebuildPasses(graphicsPresetRef.current, w, h);
        }
      });

      if (mountRef.current) resizeObserver.observe(mountRef.current);

      renderer.domElement.addEventListener("webglcontextlost",     handleContextLost);
      renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

      rendererPipelineCleanupRef.current = () => {
        resizeObserver.disconnect();
        renderer.domElement.removeEventListener("webglcontextlost",     handleContextLost);
        renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
        controls.dispose();
        composer.dispose();
        composerRef.current = bloomPassRef.current = smaaPassRef.current = ssaoPassRef.current = null;
        if (mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement);
        renderer.dispose();
        renderer.forceContextLoss();
        if (rendererRef.current === renderer) rendererRef.current = null;
        if (controlsRef.current === controls) controlsRef.current = null;
      };

      requestAnimationFrame(() => {
        if (cancelled || !sceneRef.current || !cameraRef.current || rendererRef.current !== renderer) return;
        composer.render();
      });
    };

    createRendererPipeline();

    const orbitPelvisTarget = orbitPelvisTargetRef.current;

    return () => {
      cancelled = true;
      if (recoveryTimeoutRef.current !== null) {
        window.clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      disposeRendererPipeline();

      // Dispose joint meshes — all 33 share one geometry instance, so dispose
      // it once from the first mesh; dispose each mesh's cloned material individually.
      if (jointsRef.current.length > 0) {
        jointsRef.current[0].geometry.dispose();
      }
      jointsRef.current.forEach((mesh) => {
        (mesh.material as THREE.Material).dispose();
        sceneRef.current?.remove(mesh);
      });
      jointsRef.current = [];

      // Dispose skeleton lines — each line has its own geometry and material.
      bonesRef.current.forEach(({ line }) => {
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
        sceneRef.current?.remove(line);
      });
      bonesRef.current = [];

      // Dispose axes helpers — AxesHelper is a LineSegments object with its own
      // geometry/material; skipped by the isMesh scene traversal below so must
      // be cleaned up explicitly here to avoid leaking on unmount/remount.
      axesRef.current.forEach((helper) => {
        helper.geometry.dispose();
        (helper.material as THREE.Material).dispose();
        sceneRef.current?.remove(helper);
      });
      axesRef.current = [];

      // Dispose stress vectors
      stressVectorsRef.current.forEach(({ mesh, material, geometry }) => {
        geometry.dispose();
        material.dispose();
        sceneRef.current?.remove(mesh);
      });
      stressVectorsRef.current = [];
      previousJointPositionsRef.current = [];

      // Dispose grid
      if (gridRef.current) {
        gridRef.current.geometry.dispose();
        (gridRef.current.material as THREE.Material).dispose();
        sceneRef.current?.remove(gridRef.current);
        gridRef.current = null;
      }

      // Dispose ripple plane
      if (ripplePlaneRef.current) {
        ripplePlaneRef.current.geometry.dispose();
        rippleMaterialRef.current?.dispose();
        sceneRef.current?.remove(ripplePlaneRef.current);
        ripplePlaneRef.current = null;
        rippleMaterialRef.current = null;
      }

      // Dispose GLTF model
      if (modelGroupRef.current) {
        modelGroupRef.current.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              Object.values(mat).forEach((value) => { if (value instanceof THREE.Texture) value.dispose(); });
              mat.dispose();
            }
          }
        });
        sceneRef.current?.remove(modelGroupRef.current);
        modelGroupRef.current = null;
      }

      skinnedMeshesRef.current = [];
      boneMapRef.current       = {};
      restDataRef.current      = {};
      restSegmentLengthsRef.current    = {};
      smoothedSegmentScalesRef.current = {};
      orbitPelvisTarget.set(0, 0, 0);
      hasOrbitPelvisTargetRef.current  = false;

      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              if (mat) {
                Object.values(mat).forEach((value) => { if (value instanceof THREE.Texture) value.dispose(); });
                mat.dispose();
              }
            }
          }
        });
        sceneRef.current.clear();
        sceneRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frames, modelUrl]);

  // ─── Animation / Render Loop ─────────────────────────────────────────────
  useEffect(() => {
    if (!frames || frames.length === 0) return;

    let fpsDisplayTimer = 0;

    const renderLoop = (time: number) => {
      reqIdRef.current = requestAnimationFrame(renderLoop);

      fpsMonitor.current.record(time);
      fpsDisplayTimer += 1;
      if (fpsDisplayTimer >= 30) {
        fpsDisplayTimer = 0;
        setDisplayFPS(fpsMonitor.current.getAvgFPS());
      }

      if (autoAdaptRef.current) {
        const cfg        = GRAPHICS_PRESETS[graphicsPresetRef.current];
        const suggestion = fpsMonitor.current.evaluate(graphicsPresetRef.current, cfg.targetFPS, time);
        if (suggestion !== 0) {
          const idx = PRESET_ORDER.indexOf(graphicsPresetRef.current);
          const nextPreset = PRESET_ORDER[idx + suggestion];
          if (nextPreset) applyPreset(nextPreset);
        }
      }

      if (isPlaying && time - lastTimeRef.current > 1000 / 8) {
        const nextFloat = ((frameFloatRef.current ?? currentFrameIdxRef.current) + 1) % frames.length;
        frameFloatRef.current = nextFloat;
        const nextIdx = Math.round(nextFloat) % frames.length;
        setCurrentFrameIdx(nextIdx);
        lastTimeRef.current = time;
      }

      const renderFloat = isPlaying ? (frameFloatRef.current ?? currentFrameIdxRef.current) : currentFrameIdxRef.current;
      const interpolatedLm = getInterpolatedLandmarks(frames, renderFloat);
      if (!interpolatedLm) {
        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        return;
      }

      const frame      = frames[Math.round(renderFloat) % frames.length];
      const { baseColor, badJoints, mistakeColor } = parseFeedback(frame.feedback);
      const repCount   = frame.repCount ?? Math.floor(currentFrameIdxRef.current / 30);
      const timeSeconds = time * 0.001;

      // Compute depth scale from torso size
      let depthScale = 2.0;
      const rawLS = frame.landmarks[11], rawRS = frame.landmarks[12];
      const rawLH = frame.landmarks[23], rawRH = frame.landmarks[24];
      if (rawLS && rawRS && rawLH && rawRH) {
        const dx = rawLS.x - rawRH.x, dy = rawLS.y - rawRH.y;
        const torsoSize = Math.sqrt(dx * dx + dy * dy);
        if (torsoSize > 0.1) depthScale = (0.5 / torsoSize) * 3.0;
      }

      const getLm = (idx: number) => {
        const lm = interpolatedLm[idx];
        if (!lm) return null;
        return new THREE.Vector3(-(lm.x - 0.5) * 2, -(lm.y - 0.5) * 2, -lm.z * depthScale);
      };

      const lShoulder = getLm(11), rShoulder = getLm(12);
      const lHip = getLm(23),      rHip = getLm(24);
      const lAnkle = getLm(27),    rAnkle = getLm(28);

      const shoulderCenter = lShoulder && rShoulder
        ? new THREE.Vector3().addVectors(lShoulder, rShoulder).multiplyScalar(0.5)
        : new THREE.Vector3();
      const hipCenter = lHip && rHip
        ? new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5)
        : new THREE.Vector3();
      const bodyCenter = new THREE.Vector3().addVectors(shoulderCenter, hipCenter).multiplyScalar(0.5);

      const footCenter = lAnkle && rAnkle
        ? new THREE.Vector2((lAnkle.x + rAnkle.x) * 0.5, (lAnkle.z + rAnkle.z) * 0.5)
        : lAnkle ? new THREE.Vector2(lAnkle.x, lAnkle.z)
        : rAnkle ? new THREE.Vector2(rAnkle.x, rAnkle.z)
        : null;

      if (modelLoaded) updateSegmentScaleAdaptor(frame.landmarks, getLm);

      // Ripple on rep completion
      syncRippleUniforms(timeSeconds);
      if (lastRepCountRef.current === null) {
        lastRepCountRef.current = repCount;
      } else if (repCount !== lastRepCountRef.current) {
        if (repCount > lastRepCountRef.current && footCenter) {
          const lastCompletion    = lastRippleCompletionTimeRef.current;
          const intervalSeconds   = lastCompletion ? timeSeconds - lastCompletion : 1.0;
          const tempo             = THREE.MathUtils.clamp(1.8 / Math.max(intervalSeconds, 0.25), 0.7, 1.6);
          const rippleOrigin      = new THREE.Vector2(
            THREE.MathUtils.clamp(footCenter.x / GRID_SIZE + 0.5, 0.05, 0.95),
            THREE.MathUtils.clamp(footCenter.y / GRID_SIZE + 0.5, 0.05, 0.95),
          );
          emitRipple(rippleOrigin, 0.5 + tempo * 0.55, 0.65 + tempo * 0.35, timeSeconds);
        }
        lastRepCountRef.current = repCount;
      }

      updateGridPosition(bodyCenter);

      if (modelLoaded) {
        if (!modelGroupRef.current) return;

        if (lShoulder && rShoulder && lHip && rHip) {
          const up      = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
          const right   = new THREE.Vector3().subVectors(lShoulder, rShoulder).normalize();
          const forward = new THREE.Vector3().crossVectors(right, up).normalize();
          right.crossVectors(up, forward).normalize();

          const mat      = new THREE.Matrix4().makeBasis(right, up, forward);
          const torsoQuat = new THREE.Quaternion().setFromRotationMatrix(mat);
          modelGroupRef.current.quaternion.slerp(torsoQuat, 0.05);

          const rotatedOffset = rootOffsetRef.current.clone().applyQuaternion(modelGroupRef.current.quaternion);
          const targetPos     = hipCenter.clone().add(rotatedOffset);
          const minAnkleY     = Math.min(lAnkle?.y || 0, rAnkle?.y || 0);
          targetPos.y = -1.0 - minAnkleY;
          modelGroupRef.current.position.lerp(targetPos, 0.05);
          modelGroupRef.current.updateMatrixWorld(true);

          if (!hasOrbitPelvisTargetRef.current) {
            orbitPelvisTargetRef.current.copy(hipCenter);
            hasOrbitPelvisTargetRef.current = true;
          }
          const pelvisDisplacement = orbitPelvisTargetRef.current.distanceTo(hipCenter);
          const targetLerp = THREE.MathUtils.clamp(0.08 + pelvisDisplacement * 0.2, 0.08, 0.22);
          orbitPelvisTargetRef.current.lerp(hipCenter, targetLerp);
          if (controlsRef.current) controlsRef.current.target.copy(orbitPelvisTargetRef.current);
          else if (cameraRef.current) cameraRef.current.lookAt(orbitPelvisTargetRef.current);
        }

        const applyPose = (boneKey: string, startIdx: number, endIdx: number) => {
          if (!boneMapRef.current || !restDataRef.current) return;
          const bone = boneMapRef.current[boneKey];
          const rest = restDataRef.current[boneKey];
          if (!bone || !rest) return;
          const startV = getLm(startIdx), endV = getLm(endIdx);
          if (!startV || !endV) return;
          const targetDir = new THREE.Vector3().subVectors(endV, startV).normalize();
          if (targetDir.lengthSq() < 0.0001) return;
          const deltaQ       = new THREE.Quaternion().setFromUnitVectors(rest.dir, targetDir);
          const targetWorldQ = rest.worldQuat.clone().premultiply(deltaQ);
          const parentWorldQ = new THREE.Quaternion();
          if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
          bone.quaternion.slerp(targetWorldQ.clone().premultiply(parentWorldQ.invert()), 0.05);
        };

        const bMap = boneMapRef.current;
        if (bMap?.spine) {
          const spineDir = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
          const rest     = restDataRef.current["spine"];
          if (rest) {
            const deltaQ       = new THREE.Quaternion().setFromUnitVectors(rest.dir, spineDir);
            const targetWorldQ = rest.worldQuat.clone().premultiply(deltaQ);
            const parentWorldQ = new THREE.Quaternion();
            if (bMap.spine.parent) bMap.spine.parent.getWorldQuaternion(parentWorldQ);
            bMap.spine.quaternion.slerp(targetWorldQ.premultiply(parentWorldQ.invert()), 0.05);
          }
        }

        applyPose("leftShoulder",  11, 13);
        applyPose("leftElbow",     13, 15);
        applyPose("rightShoulder", 12, 14);
        applyPose("rightElbow",    14, 16);
        applyPose("leftHip",       23, 25);
        applyPose("leftKnee",      25, 27);
        applyPose("leftAnkle",     27, 29);
        applyPose("rightHip",      24, 26);
        applyPose("rightKnee",     26, 28);
        applyPose("rightAnkle",    28, 30);

        // HUD joint angle labels
        const updateHudLabel = (joint: typeof HUD_JOINTS[number]) => {
          const el = hudRefs.current[joint.idx];
          if (!el) return;
          if (!cameraRef.current || !rendererRef.current || !mountRef.current) {
            el.style.display = "none";
            return;
          }
          const a = getLm(joint.p1), b = getLm(joint.p2), c = getLm(joint.p3);
          let angle = 0;
          if (a && b && c) {
            const v1 = new THREE.Vector3().subVectors(a, b);
            const v2 = new THREE.Vector3().subVectors(c, b);
            angle = Math.round(v1.angleTo(v2) * (180 / Math.PI));
          }
          const bone = boneMapRef.current[joint.boneKey];
          if (!bone) {
            el.style.display = "none";
            return;
          }
          const pos    = new THREE.Vector3();
          bone.getWorldPosition(pos);
          const vector = pos.project(cameraRef.current);
          const x = (vector.x * 0.5 + 0.5) * mountRef.current.clientWidth;
          const y = -(vector.y * 0.5 - 0.5) * mountRef.current.clientHeight;
          el.style.display = "flex";
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.borderColor = angle < 140 ? "var(--neon-cyan)" : "var(--neon-purple)";
          const angleEl = hudAngleRefs.current[joint.idx];
          if (angleEl) angleEl.textContent = `${angle}°`;
        };

        HUD_JOINTS.forEach(updateHudLabel);

        // Skin error highlight
        skinnedMeshesRef.current.forEach((mesh) => {
          if (!mesh.material) return;
          const mat      = mesh.material as THREE.MeshStandardMaterial;
          const hasError = badJoints.size > 0;
          const targetColor = hasError ? mistakeColor || COLOR_RED : baseColor;
          if (skin === "Cyberpunk Neon") {
            const neonColor = hasError ? mistakeColor || new THREE.Color(0xff00ff) : targetColor;
            if (mat.color)    mat.color.lerp(new THREE.Color(0x050505), 0.2);
            if (mat.emissive) mat.emissive.lerp(neonColor, 0.2);
            mat.emissiveIntensity = hasError ? 1.5 : 1.2;
          } else if (skin === "Robot") {
            if (mat.color)    mat.color.lerp(new THREE.Color(0xd0d0d0), 0.2);
            if (mat.emissive) mat.emissive.lerp(targetColor, 0.2);
            mat.emissiveIntensity = hasError ? 1.0 : baseColor.equals(COLOR_GREEN) ? 0.3 : 0.6;
          } else {
            if (mat.color)    mat.color.lerp(new THREE.Color(0xe0a080), 0.2);
            if (mat.emissive) mat.emissive.lerp(targetColor, 0.2);
            mat.emissiveIntensity = hasError ? 0.4 : baseColor.equals(COLOR_GREEN) ? 0.05 : 0.1;
          }
        });
      } else {
        // Fallback skeleton rendering
        const strainColor = getStrainColor(repCount);
        const jointTargetColors = new Array(33).fill(baseColor);
        const activeMuscleGroups = exerciseName.includes("squat")
          ? MUSCLE_JOINT_GROUPS.legs
          : exerciseName.includes("plank")
            ? MUSCLE_JOINT_GROUPS.core
            : exerciseName.includes("curl") || exerciseName.includes("push")
              ? MUSCLE_JOINT_GROUPS.arms
              : [...MUSCLE_JOINT_GROUPS.arms, ...MUSCLE_JOINT_GROUPS.core, ...MUSCLE_JOINT_GROUPS.legs];

        activeMuscleGroups.forEach((j) => { jointTargetColors[j] = strainColor; });
        badJoints.forEach((j)          => { jointTargetColors[j] = mistakeColor || COLOR_RED; });

        for (let i = 0; i < 33; i++) {
          const landmark = frame.landmarks[i];
          if (!landmark || !jointsRef.current[i]) continue;
          const mesh = jointsRef.current[i];
          mesh.position.lerp(
            new THREE.Vector3(-(landmark.x - 0.5) * 2, -(landmark.y - 0.5) * 2, -landmark.z * 2),
            0.1,
          );
          const jMat = mesh.material as THREE.MeshStandardMaterial;
          if (jMat?.color) {
            jMat.color.lerp(jointTargetColors[i], 0.2);
            jMat.emissive.lerp(jointTargetColors[i], 0.2);
            jMat.emissiveIntensity = badJoints.has(i) ? 1.5 : 0.5;
          }
        }

        bonesRef.current.forEach((bone) => {
          const startMesh = jointsRef.current[bone.startIdx];
          const endMesh   = jointsRef.current[bone.endIdx];
          if (!startMesh || !endMesh) return;
          const positions = bone.line.geometry.attributes.position.array as Float32Array;
          positions[0] = startMesh.position.x; positions[1] = startMesh.position.y; positions[2] = startMesh.position.z;
          positions[3] = endMesh.position.x;   positions[4] = endMesh.position.y;   positions[5] = endMesh.position.z;
          bone.line.geometry.attributes.position.needsUpdate = true;
          const isBadBone = badJoints.has(bone.startIdx) || badJoints.has(bone.endIdx);
          (bone.line.material as THREE.LineBasicMaterial).color.lerp(
            isBadBone ? mistakeColor || COLOR_RED : strainColor, 0.2,
          );
        });

        updateFallbackSkeletonOcclusion();
      }

      updateStressVectors(getLm, bodyCenter, shoulderCenter, hipCenter, baseColor, badJoints, exerciseName, time);

      if (controlsRef.current) controlsRef.current.update();
      if (sceneRef.current && cameraRef.current) composerRef.current?.render();
    };

    reqIdRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(reqIdRef.current);
  }, [frames, isPlaying, modelLoaded, setCurrentFrameIdx, skin, applyPreset, emitRipple, exerciseName, syncRippleUniforms, updateFallbackSkeletonOcclusion, updateGridPosition, updateSegmentScaleAdaptor, updateStressVectors]);

  // ─── No frames guard ─────────────────────────────────────────────────────
  if (!frames || frames.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: "#fff", background: "#111", borderRadius: 8 }}>
        No session data available
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", position: "relative" }}>
      <div ref={mountRef} style={{ flex: 1, minHeight: "400px", width: "100%", height: "100%", borderRadius: "8px", overflow: "hidden" }} />

      {modelLoading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(17,17,17,0.85)", borderRadius: "8px", zIndex: 15 }}>
          <div style={{ textAlign: "center", color: "#00ffcc" }}>
            <div style={{ width: 36, height: 36, border: "3px solid rgba(0,255,204,0.2)", borderTopColor: "#00ffcc", borderRadius: "50%", animation: "gltf-spin 0.75s linear infinite", margin: "0 auto 12px" }} />
            <span style={{ fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>Loading 3D model...</span>
          </div>
          <style>{`@keyframes gltf-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {modelError && (
        <div style={{ position: "absolute", top: 10, left: 10, background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 6, padding: "6px 12px", fontSize: "0.72rem", color: "#ef4444", fontFamily: "'JetBrains Mono', monospace", zIndex: 15 }}>
          {modelError}
        </div>
      )}

      <GraphicsPanel
        preset={graphicsPreset}
        autoAdapt={autoAdapt}
        currentFPS={displayFPS}
        onPresetChange={applyPreset}
        onAutoAdaptChange={(v) => { setAutoAdapt(v); autoAdaptRef.current = v; fpsMonitor.current.reset(); }}
      />

      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {HUD_JOINTS.map((joint) => (
          <div key={joint.idx} ref={(el) => { hudRefs.current[joint.idx] = el; }} style={{ position: "absolute", display: "none", transform: "translate(-50%,-50%)", padding: "4px 8px", background: "rgba(0,0,0,0.6)", border: "1px solid var(--neon-cyan)", borderRadius: "4px", flexDirection: "column", alignItems: "center", backdropFilter: "blur(4px)", boxShadow: "0 0 10px rgba(0,0,0,0.5)", transition: "all 0.1s linear" }}>
            <span style={{ fontSize: "0.6rem", color: "#aaa", letterSpacing: "1px" }}>{joint.label}</span>
            <span ref={(el) => { hudAngleRefs.current[joint.idx] = el; }} style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 800 }}>0°</span>
          </div>
        ))}
      </div>

      {!hideControls && (
        <div style={{ padding: "15px", background: "#222", display: "flex", alignItems: "center", gap: "15px", borderRadius: "8px", marginTop: "10px" }}>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ padding: "8px 16px", background: "var(--neon-purple, #9D4EDD)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>
            {isPlaying ? "PAUSE" : "PLAY"}
          </button>
          <input type="range" min="0" max={frames.length - 1} value={currentFrameIdx}
            onChange={(e) => { setIsPlaying(false); setCurrentFrameIdx(Number(e.target.value)); }}
            style={{ flex: 1, cursor: "pointer" }} />
          <span style={{ color: "#aaa", fontSize: "0.85rem", minWidth: "80px", textAlign: "right" }}>
            {currentFrameIdx} / {frames.length - 1}
          </span>
        </div>
      )}
    </div>
  );
};
