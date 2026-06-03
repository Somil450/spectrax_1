import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { SSAOPass } from "three/examples/jsm/postprocessing/SSAOPass.js";
import { createBaseMaterialForSkin } from "../utils/avatarSkins";

// ─── Module-Level GLTF Cache ──────────────────────────────────────────────────

const gltfCache = new Map<string, GLTF>();

/**
 * Clear the module-level GLTF cache.
 * Useful for hot-reload and testing environments.
 */
export function clearGLTFCache(): void {
  gltfCache.clear();
}

// Vite HMR: clear cache on hot module replacement
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

export interface Replay3DModelProps {
  frames: ReplayFrame[];
  modelUrl?: string;
  currentFrameIdx?: number;
  isPlaying?: boolean;
  onFrameChange?: (idx: number) => void;
  onPlayToggle?: () => void;
  hideControls?: boolean;
  skin?: string;
}

type HudLabel = {
  x: number;
  y: number;
  angle: number;
  label: string;
  id: number;
};



type StressVectorRig = {
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
  jointIdx: number;
  parentIdx: number;
  muscleGroup: keyof typeof MUSCLE_JOINT_GROUPS;
};

type RippleEvent = {
  origin: THREE.Vector2;
  startTime: number;
  speed: number;
  strength: number;
};


// ─── Graphic Quality Presets ───────────────────────────────────────────────────

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
    label: "Ultra",
    targetFPS: 60,
    pixelRatio: 2.0,
    smaa: true,
    ssao: true,
    ssaoRadius: 8,
    ssaoMinDistance: 0.005,
    ssaoMaxDistance: 0.1,
    bloom: true,
    bloomStrength: 0.6,
    bloomRadius: 0.5,
    bloomThreshold: 0.4,
    shadowMapEnabled: true,
    shadowMapType: THREE.PCFSoftShadowMap,
    shadowMapSize: 2048,
    antialias: true,
  },
  high: {
    label: "High",
    targetFPS: 60,
    pixelRatio: 1.5,
    smaa: true,
    ssao: true,
    ssaoRadius: 6,
    ssaoMinDistance: 0.005,
    ssaoMaxDistance: 0.1,
    bloom: true,
    bloomStrength: 0.5,
    bloomRadius: 0.4,
    bloomThreshold: 0.4,
    shadowMapEnabled: true,
    shadowMapType: THREE.PCFShadowMap,
    shadowMapSize: 1024,
    antialias: true,
  },
  medium: {
    label: "Medium",
    targetFPS: 30,
    pixelRatio: 1.0,
    smaa: true,
    ssao: false,
    ssaoRadius: 4,
    ssaoMinDistance: 0.005,
    ssaoMaxDistance: 0.1,
    bloom: true,
    bloomStrength: 0.4,
    bloomRadius: 0.3,
    bloomThreshold: 0.5,
    shadowMapEnabled: true,
    shadowMapType: THREE.PCFShadowMap,
    shadowMapSize: 512,
    antialias: false,
  },
  low: {
    label: "Low",
    targetFPS: 30,
    pixelRatio: 0.75,
    smaa: false,
    ssao: false,
    ssaoRadius: 0,
    ssaoMinDistance: 0,
    ssaoMaxDistance: 0,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    shadowMapEnabled: false,
    shadowMapType: THREE.BasicShadowMap,
    shadowMapSize: 256,
    antialias: false,
  },
  potato: {
    label: "Potato",
    targetFPS: 24,
    pixelRatio: 0.5,
    smaa: false,
    ssao: false,
    ssaoRadius: 0,
    ssaoMinDistance: 0,
    ssaoMaxDistance: 0,
    bloom: false,
    bloomStrength: 0,
    bloomRadius: 0,
    bloomThreshold: 1,
    shadowMapEnabled: false,
    shadowMapType: THREE.BasicShadowMap,
    shadowMapSize: 128,
    antialias: false,
  },
};

// Ordered from worst to best for adaptive stepping
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
    // Use P10 (low percentile) to be conservative — avoid false upgrades
    const p10Idx = Math.floor(sorted.length * 0.1);
    return sorted[p10Idx];
  }

  // Returns suggested preset change: +1 step, 0 no change, -1 step down
  evaluate(
    currentPreset: GraphicsPreset,
    targetFPS: number,
    now: number,
  ): -1 | 0 | 1 {
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

// ─── Constants ────────────────────────────────────────────────────────────────

const BONES_CONNECTIONS = [
  [11, 12], [12, 24], [24, 23], [23, 11],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
  [23, 25], [25, 27],
  [24, 26], [26, 28],
];

const COLOR_GREEN  = new THREE.Color(0x00ff00);
const COLOR_YELLOW = new THREE.Color(0xffff00);
const COLOR_ORANGE = new THREE.Color(0xff8c00);
const COLOR_RED    = new THREE.Color(0xff0000);

const getStrainColor = (repCount = 0) => {
  const n = Math.min(repCount / 20, 1);
  if (n < 0.5) return COLOR_GREEN.clone().lerp(COLOR_YELLOW, n * 2);
  return COLOR_ORANGE.clone().lerp(COLOR_RED, (n - 0.5) * 2);
};

const MUSCLE_JOINT_GROUPS: Record<string, number[]> = {
  arms: [11, 12, 13, 14, 15, 16],
  core: [11, 12, 23, 24],
  legs: [23, 24, 25, 26, 27, 28],
};

const STRESS_VECTOR_ATTACHMENTS: Array<{
  jointIdx: number;
  parentIdx: number;
  muscleGroup: keyof typeof MUSCLE_JOINT_GROUPS;
}> = [
  { jointIdx: 11, parentIdx: 23, muscleGroup: "core" },
  { jointIdx: 12, parentIdx: 24, muscleGroup: "core" },
  { jointIdx: 13, parentIdx: 11, muscleGroup: "arms" },
  { jointIdx: 14, parentIdx: 12, muscleGroup: "arms" },
  { jointIdx: 15, parentIdx: 13, muscleGroup: "arms" },
  { jointIdx: 16, parentIdx: 14, muscleGroup: "arms" },
  { jointIdx: 23, parentIdx: 11, muscleGroup: "legs" },
  { jointIdx: 24, parentIdx: 12, muscleGroup: "legs" },
  { jointIdx: 25, parentIdx: 23, muscleGroup: "legs" },
  { jointIdx: 26, parentIdx: 24, muscleGroup: "legs" },
  { jointIdx: 27, parentIdx: 25, muscleGroup: "legs" },
  { jointIdx: 28, parentIdx: 26, muscleGroup: "legs" },
];



type BoneProportionKey =
  | "leftShoulder"
  | "leftElbow"
  | "rightShoulder"
  | "rightElbow"
  | "leftHip"
  | "leftKnee"
  | "rightHip"
  | "rightKnee"
  | "spine"
  | "neck";

type SegmentDefinition = {
  readonly boneKey: BoneProportionKey;
  readonly sampleLandmarks:
    | readonly [number, number]
    | readonly [number, number, number, number];
  readonly restMultiplier?: number;
};

type SegmentScaleState = {
  readonly ratio: number;
  readonly matrix: THREE.Matrix4;
  readonly scale: THREE.Vector3;
};

const PROPORTION_SEGMENTS: SegmentDefinition[] = [
  { boneKey: "leftShoulder", sampleLandmarks: [11, 13] },
  { boneKey: "leftElbow", sampleLandmarks: [13, 15] },
  { boneKey: "rightShoulder", sampleLandmarks: [12, 14] },
  { boneKey: "rightElbow", sampleLandmarks: [14, 16] },
  { boneKey: "leftHip", sampleLandmarks: [23, 25] },
  { boneKey: "leftKnee", sampleLandmarks: [25, 27] },
  { boneKey: "rightHip", sampleLandmarks: [24, 26] },
  { boneKey: "rightKnee", sampleLandmarks: [26, 28] },
  { boneKey: "spine", sampleLandmarks: [23, 11, 24, 12], restMultiplier: 0.5 },
  { boneKey: "neck", sampleLandmarks: [11, 12], restMultiplier: 0.25 },
];

const PROPORTION_SMOOTHING = 0.12;
const PROPORTION_MIN_RATIO = 0.78;
const PROPORTION_MAX_RATIO = 1.26;

const buildSegmentScaleState = (ratio: number): SegmentScaleState => {
  const clampedRatio = THREE.MathUtils.clamp(
    ratio,
    PROPORTION_MIN_RATIO,
    PROPORTION_MAX_RATIO,
  );
  const lateralScale = THREE.MathUtils.clamp(
    1 / Math.sqrt(Math.max(clampedRatio, 0.0001)),
    0.88,
    1.12,
  );
  const matrix = new THREE.Matrix4().makeScale(
    lateralScale,
    clampedRatio,
    lateralScale,
  );
  const scale = new THREE.Vector3();
  matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

  return {
    ratio: clampedRatio,
    matrix,
    scale,
  };
};

const GRID_RIPPLE_MAX = 6;
const GRID_RIPPLE_LIFETIME = 2.8;
const GRID_SIZE = 10;
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
  if (feedback.includes("Go lower for full range")) [13, 14].forEach((j) => badJoints.add(j));
  if (feedback.includes("over-bend knees")) [25, 26].forEach((j) => badJoints.add(j));
  if (feedback.includes("hips lower") || feedback.includes("Drop your hips") || feedback.includes("Hips too high"))
    [23, 24].forEach((j) => badJoints.add(j));
  if (feedback.includes("Squeeze at the top") || feedback.includes("Keep elbows at side"))
    [11, 12, 13, 14].forEach((j) => badJoints.add(j));
  if (feedback.includes("Raise arms higher")) [11, 12].forEach((j) => badJoints.add(j));

  return { baseColor, badJoints, mistakeColor };
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
  preset,
  autoAdapt,
  currentFPS,
  onPresetChange,
  onAutoAdaptChange,
}) => {
  const [open, setOpen] = useState(false);
  const cfg = GRAPHICS_PRESETS[preset];

  const fpsColor =
    currentFPS >= 50 ? "#00ff88" : currentFPS >= 30 ? "#ffcc00" : "#ff4444";

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 20,
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* FPS Badge + Toggle */}
      <div
        style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "flex-end" }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.75)",
            border: `1px solid ${fpsColor}`,
            borderRadius: 4,
            padding: "2px 8px",
            fontSize: "0.72rem",
            color: fpsColor,
            letterSpacing: 1,
            minWidth: 64,
            textAlign: "center",
          }}
        >
          {currentFPS.toFixed(0)} FPS
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          title="Graphics Settings"
          style={{
            background: "rgba(0,0,0,0.75)",
            border: "1px solid #444",
            borderRadius: 4,
            color: "#ccc",
            cursor: "pointer",
            padding: "3px 8px",
            fontSize: "0.72rem",
            letterSpacing: 1,
          }}
        >
          ⚙ {GRAPHICS_PRESETS[preset].label.toUpperCase()}
        </button>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div
          style={{
            marginTop: 6,
            background: "rgba(10,10,15,0.93)",
            border: "1px solid #333",
            borderRadius: 6,
            padding: "12px 14px",
            width: 230,
            boxShadow: "0 4px 24px rgba(0,0,0,0.7)",
          }}
        >
          <div style={{ fontSize: "0.65rem", color: "#888", letterSpacing: 2, marginBottom: 8 }}>
            GRAPHICS QUALITY
          </div>

          {/* Preset buttons */}
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 10 }}>
            {(PRESET_ORDER.slice().reverse() as GraphicsPreset[]).map((p) => (
              <button
                key={p}
                disabled={autoAdapt}
                onClick={() => { onPresetChange(p); }}
                style={{
                  padding: "4px 9px",
                  fontSize: "0.65rem",
                  borderRadius: 3,
                  border: `1px solid ${preset === p ? "#00ffcc" : "#333"}`,
                  background: preset === p ? "rgba(0,255,204,0.12)" : "rgba(255,255,255,0.04)",
                  color: preset === p ? "#00ffcc" : "#888",
                  cursor: autoAdapt ? "not-allowed" : "pointer",
                  opacity: autoAdapt ? 0.5 : 1,
                  letterSpacing: 1,
                  transition: "all 0.15s",
                }}
              >
                {GRAPHICS_PRESETS[p].label.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Auto adapt toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              marginBottom: 10,
            }}
          >
            <div
              onClick={() => onAutoAdaptChange(!autoAdapt)}
              style={{
                width: 32,
                height: 16,
                borderRadius: 8,
                background: autoAdapt ? "#00ffcc" : "#333",
                position: "relative",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 2,
                  left: autoAdapt ? 18 : 2,
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                }}
              />
            </div>
            <span style={{ fontSize: "0.65rem", color: autoAdapt ? "#00ffcc" : "#888", letterSpacing: 1 }}>
              AUTO-ADAPT
            </span>
          </label>

          {/* Current config indicators */}
          <div style={{ borderTop: "1px solid #1e1e1e", paddingTop: 8 }}>
            {[
              ["SMAA",    cfg.smaa         ? "ON"  : "OFF",  cfg.smaa],
              ["SSAO",    cfg.ssao         ? "ON"  : "OFF",  cfg.ssao],
              ["BLOOM",   cfg.bloom        ? "ON"  : "OFF",  cfg.bloom],
              ["SHADOWS", cfg.shadowMapEnabled ? `${cfg.shadowMapSize}px` : "OFF", cfg.shadowMapEnabled],
              ["DPR",     `×${cfg.pixelRatio.toFixed(2)}`,   cfg.pixelRatio >= 1.0],
              ["TARGET",  `${cfg.targetFPS} FPS`,             true],
            ].map(([key, val, good]) => (
              <div
                key={key as string}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.62rem",
                  color: "#555",
                  padding: "2px 0",
                  letterSpacing: 1,
                }}
              >
                <span>{key as string}</span>
                <span style={{ color: good ? "#00ffcc" : "#666" }}>{val as string}</span>
              </div>
            ))}
          </div>

          {autoAdapt && (
            <div
              style={{
                marginTop: 8,
                fontSize: "0.58rem",
                color: "#555",
                letterSpacing: 0.5,
                lineHeight: 1.5,
              }}
            >
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
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [_isPlaying, _setIsPlaying] = useState(false);
  const [_currentFrameIdx, _setCurrentFrameIdx] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // ─ Graphic state ─
  const [graphicsPreset, setGraphicsPreset] = useState<GraphicsPreset>("high");
  const [autoAdapt, setAutoAdapt] = useState(true);
  const [displayFPS, setDisplayFPS] = useState(60);
  const graphicsPresetRef = useRef<GraphicsPreset>("high");
  const autoAdaptRef = useRef(true);
  const fpsMonitor = useRef(new AdaptiveFPSMonitor());

  // Keep refs in sync with state for use inside animation loop

  useEffect(() => {
    graphicsPresetRef.current = graphicsPreset;
  }, [graphicsPreset]);
  useEffect(() => {
    autoAdaptRef.current = autoAdapt;
  }, [autoAdapt]);



  const isPlaying =
    externalIsPlaying !== undefined ? externalIsPlaying : _isPlaying;
  const currentFrameIdx =
    externalFrameIdx !== undefined ? externalFrameIdx : _currentFrameIdx;
  const setIsPlaying = onPlayToggle ? () => onPlayToggle() : _setIsPlaying;
  const setCurrentFrameIdx = onFrameChange
    ? onFrameChange
    : _setCurrentFrameIdx;

  // Three.js refs
  const sceneRef    = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);
  const smaaPassRef  = useRef<SMAAPass | null>(null);
  const ssaoPassRef  = useRef<SSAOPass | null>(null);
  const cameraRef   = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  // Fallback skeleton refs
  const jointsRef = useRef<THREE.Mesh[]>([]);
  const bonesRef  = useRef<{ line: THREE.Line; startIdx: number; endIdx: number }[]>([]);
  const axesRef   = useRef<THREE.AxesHelper[]>([]);

  // GLTF refs

  const modelGroupRef = useRef<THREE.Group | null>(null);
  const boneMapRef = useRef<Record<string, THREE.Bone>>({});
  const skinnedMeshesRef = useRef<THREE.SkinnedMesh[]>([]);

  const restDataRef = useRef<
    Record<
      string,
      {
        worldQuat: THREE.Quaternion;
        localQuat: THREE.Quaternion;
        dir: THREE.Vector3;
      }
    >
  >({});
  const rootOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3());

  const restSegmentLengthsRef = useRef<
    Partial<Record<BoneProportionKey, number>>
  >({});
  const smoothedSegmentScalesRef = useRef<
    Partial<Record<BoneProportionKey, THREE.Vector3>>
  >({});

  const ripplePlaneRef = useRef<THREE.Mesh | null>(null);
  const rippleMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const rippleEventsRef = useRef<RippleEvent[]>([]);
  const lastRepCountRef = useRef<number | null>(null);
  const lastRippleCompletionTimeRef = useRef<number | null>(null);
  const stressVectorsRef = useRef<StressVectorRig[]>([]);
  const previousJointPositionsRef = useRef<Array<THREE.Vector3 | null>>([]);


  const [hudLabels, setHudLabels] = useState<HudLabel[]>([]);
  const reqIdRef           = useRef<number>(0);
  const lastTimeRef        = useRef<number>(0);
  const recoveryTimeoutRef = useRef<number | null>(null);
  const rendererPipelineCleanupRef = useRef<(() => void) | null>(null);



  const createStressVectorMaterial = useCallback(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x00ffff) },
        uStress: { value: 0 },
        uLength: { value: 1 },
        uThickness: { value: 0.05 },
        uTime: { value: 0 },
      },
      vertexShader: `
        uniform float uStress;
        uniform float uLength;
        uniform float uThickness;
        uniform float uTime;
        varying float vProgress;
        varying float vStress;

        void main() {
          vProgress = clamp(position.y, 0.0, 1.0);
          vStress = clamp(uStress, 0.0, 1.0);

          vec3 transformed = position;
          float pulse = 1.0 + sin(uTime * 4.5 + vProgress * 8.0) * 0.06 * vStress;
          float taper = mix(1.0, 0.22, vProgress);

          transformed.x *= uThickness * taper * pulse;
          transformed.z *= uThickness * taper * pulse;
          transformed.y *= mix(0.45, uLength, vStress);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uStress;
        varying float vProgress;
        varying float vStress;

        void main() {
          vec3 hot = vec3(1.0, 0.35, 0.12);
          vec3 cool = uColor;
          vec3 color = mix(cool, hot, clamp(uStress, 0.0, 1.0));
          float shaft = smoothstep(0.0, 0.18, vProgress) * (1.0 - smoothstep(0.82, 1.0, vProgress));
          float glow = mix(0.35, 0.95, vStress);
          float alpha = mix(0.24, 0.92, shaft) * glow;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const createRippleGridMaterial = useCallback(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uGridColor: { value: new THREE.Color(0x00ffff) },
        uRippleColor: { value: new THREE.Color(0x85fff4) },
        uGridScale: { value: 7.5 },
        uLineWidth: { value: 0.06 },
        uRippleCount: { value: 0 },
        uRippleOrigins: {
          value: Array.from(
            { length: GRID_RIPPLE_MAX },
            () => new THREE.Vector2(-10, -10),
          ),
        },
        uRippleStarts: {
          value: Array.from({ length: GRID_RIPPLE_MAX }, () => 0),
        },
        uRippleSpeeds: {
          value: Array.from({ length: GRID_RIPPLE_MAX }, () => 0),
        },
        uRippleStrengths: {
          value: Array.from({ length: GRID_RIPPLE_MAX }, () => 0),
        },
      },
      vertexShader: `
        varying vec2 vUv;

        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        #define MAX_RIPPLES ${GRID_RIPPLE_MAX}

        uniform float uTime;
        uniform vec3 uGridColor;
        uniform vec3 uRippleColor;
        uniform float uGridScale;
        uniform float uLineWidth;
        uniform int uRippleCount;
        uniform vec2 uRippleOrigins[MAX_RIPPLES];
        uniform float uRippleStarts[MAX_RIPPLES];
        uniform float uRippleSpeeds[MAX_RIPPLES];
        uniform float uRippleStrengths[MAX_RIPPLES];
        varying vec2 vUv;

        float gridMask(vec2 uv) {
          vec2 cell = abs(fract(uv * uGridScale) - 0.5);
          float lineX = smoothstep(0.5, 0.5 - uLineWidth, cell.x);
          float lineY = smoothstep(0.5, 0.5 - uLineWidth, cell.y);
          return max(lineX, lineY);
        }

        void main() {
          vec3 base = vec3(0.01, 0.03, 0.05);
          float grid = gridMask(vUv);
          float rippleGlow = 0.0;
          float rippleCore = 0.0;

          for (int i = 0; i < MAX_RIPPLES; i++) {
            if (i >= uRippleCount) break;
            float age = max(uTime - uRippleStarts[i], 0.0);
            float radius = age * uRippleSpeeds[i];
            float dist = distance(vUv, uRippleOrigins[i]);
            float ring = 1.0 - smoothstep(0.0, 0.035, abs(dist - radius));
            float pulse = 0.5 + 0.5 * sin((dist - radius) * 65.0);
            float fade = exp(-age * 1.25) * exp(-dist * 0.8);
            float strength = uRippleStrengths[i] * ring * pulse * fade;
            rippleGlow += strength;
            rippleCore = max(rippleCore, strength);
          }

          vec3 gridColor = mix(base, uGridColor, grid * 0.55);
          vec3 rippleColor = mix(gridColor, uRippleColor, clamp(rippleGlow, 0.0, 1.0));
          rippleColor += uRippleColor * rippleCore * 0.75;

          float alpha = clamp(0.08 + grid * 0.6 + rippleGlow * 0.85, 0.0, 0.95);
          gl_FragColor = vec4(rippleColor, alpha);

        }
      `,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }, []);


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
              : ["arms", "core", "legs"]) as Array<
          keyof typeof MUSCLE_JOINT_GROUPS
        >,
      );

      const fallbackCenter =
        bodyCenter ?? shoulderCenter ?? hipCenter ?? new THREE.Vector3(0, 0, 0);
      const upAxis = new THREE.Vector3(0, 1, 0);
      const sideAxis = new THREE.Vector3(1, 0, 0);

      rigs.forEach((rig) => {
        const jointPos = getLm(rig.jointIdx);
        const parentPos = getLm(rig.parentIdx) ?? fallbackCenter;
        if (!jointPos) {
          rig.mesh.visible = false;
          return;
        }

        const previousPos = previousPositions[rig.jointIdx];
        const movement = previousPos ? jointPos.distanceTo(previousPos) : 0;
        const motionStress = THREE.MathUtils.clamp(movement * 3.25, 0, 1);
        const tensionBoost = badJoints.has(rig.jointIdx) ? 0.38 : 0;
        const groupBoost = allowedGroups.has(rig.muscleGroup) ? 0.14 : 0.04;

        const outward = jointPos.clone().sub(fallbackCenter).normalize();
        const limbAxis = jointPos.clone().sub(parentPos).normalize();
        const direction = outward
          .multiplyScalar(0.55)
          .add(limbAxis.multiplyScalar(0.35))
          .add(upAxis.clone().multiplyScalar(0.07))
          .add(sideAxis.clone().multiplyScalar(0.03))
          .normalize();

        const stress = THREE.MathUtils.clamp(
          motionStress * 0.55 + tensionBoost + groupBoost,
          0,
          1,
        );

        const length = 0.45 + stress * 1.55;
        const thickness = 0.045 + stress * 0.03;
        const position = jointPos
          .clone()
          .add(direction.clone().multiplyScalar(0.08 + stress * 0.1));

        rig.mesh.visible = stress > 0.02;
        rig.mesh.position.copy(position);
        rig.mesh.quaternion.setFromUnitVectors(upAxis, direction);
        rig.mesh.renderOrder = 4;

        rig.material.uniforms.uStress.value = stress;
        rig.material.uniforms.uLength.value = length;
        rig.material.uniforms.uThickness.value = thickness;
        rig.material.uniforms.uTime.value = time * 0.001;
        rig.material.uniforms.uColor.value
          .copy(baseColor)
          .lerp(
            badJoints.has(rig.jointIdx)
              ? new THREE.Color(0xff3300)
              : new THREE.Color(0x00ffff),
            stress,
          );

        previousPositions[rig.jointIdx] = jointPos.clone();
      });
    },
    [],
  );

  const syncRippleUniforms = useCallback((timeSeconds: number) => {
    const material = rippleMaterialRef.current;
    if (!material) return;

    const activeEvents = rippleEventsRef.current.filter(
      (event) => timeSeconds - event.startTime <= GRID_RIPPLE_LIFETIME,
    );
    rippleEventsRef.current = activeEvents;

    const origins = material.uniforms.uRippleOrigins.value as THREE.Vector2[];
    const starts = material.uniforms.uRippleStarts.value as number[];
    const speeds = material.uniforms.uRippleSpeeds.value as number[];
    const strengths = material.uniforms.uRippleStrengths.value as number[];

    material.uniforms.uTime.value = timeSeconds;
    material.uniforms.uRippleCount.value = activeEvents.length;

    for (let i = 0; i < GRID_RIPPLE_MAX; i++) {
      const event = activeEvents[i];
      if (event) {
        origins[i].copy(event.origin);
        starts[i] = event.startTime;
        speeds[i] = event.speed;
        strengths[i] = event.strength;
      } else {
        origins[i].set(-10, -10);
        starts[i] = 0;
        speeds[i] = 0;
        strengths[i] = 0;
      }
    }
  }, []);

  const emitRipple = useCallback(
    (
      origin: THREE.Vector2,
      speed: number,
      strength: number,
      timeSeconds: number,
    ) => {
      rippleEventsRef.current = [
        { origin: origin.clone(), startTime: timeSeconds, speed, strength },
        ...rippleEventsRef.current,
      ].slice(0, GRID_RIPPLE_MAX);
      lastRippleCompletionTimeRef.current = timeSeconds;
      syncRippleUniforms(timeSeconds);
    },
    [syncRippleUniforms],
  );

  const orbitPelvisTargetRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const hasOrbitPelvisTargetRef = useRef(false);


  // ─── Rebuild post-processing passes when preset changes ───────────────────
  const rebuildPasses = useCallback(
    (preset: GraphicsPreset, forceWidth?: number, forceHeight?: number) => {
      const renderer  = rendererRef.current;
      const composer  = composerRef.current;
      const scene     = sceneRef.current;
      const camera    = cameraRef.current;
      const mount     = mountRef.current;
      if (!renderer || !composer || !scene || !camera || !mount) return;

      const cfg = GRAPHICS_PRESETS[preset];
      const w = forceWidth  ?? mount.clientWidth;
      const h = forceHeight ?? mount.clientHeight;

      // Update DPR
      renderer.setPixelRatio(Math.min(cfg.pixelRatio, window.devicePixelRatio ?? 1));

      // Shadow settings
      renderer.shadowMap.enabled  = cfg.shadowMapEnabled;
      renderer.shadowMap.type     = cfg.shadowMapType;

      // Remove existing effect passes (keep RenderPass at index 0)
      while (composer.passes.length > 1) composer.passes.pop();
      smaaPassRef.current  = null;
      ssaoPassRef.current  = null;
      bloomPassRef.current = null;

      // SSAO — must come before SMAA/bloom
      if (cfg.ssao) {
        const ssao = new SSAOPass(scene, camera, w, h);
        ssao.kernelRadius   = cfg.ssaoRadius;
        ssao.minDistance    = cfg.ssaoMinDistance;
        ssao.maxDistance    = cfg.ssaoMaxDistance;
        ssao.output         = SSAOPass.OUTPUT.Default;
        composer.addPass(ssao);
        ssaoPassRef.current = ssao;
      }

      // Bloom
      if (cfg.bloom) {
        const bloom = new UnrealBloomPass(
          new THREE.Vector2(w, h),
          cfg.bloomStrength,
          cfg.bloomRadius,
          cfg.bloomThreshold,
        );
        composer.addPass(bloom);
        bloomPassRef.current = bloom;
      }

      // SMAA (always last — AA over everything)
      if (cfg.smaa) {
        const smaa = new SMAAPass(w, h);
        composer.addPass(smaa);
        smaaPassRef.current = smaa;
      }

      composer.setSize(w, h);
    },
    [],
  );

  // ─── Apply a new preset (state + immediate pipeline rebuild) ──────────────
  const applyPreset = useCallback(
    (preset: GraphicsPreset) => {
      setGraphicsPreset(preset);
      graphicsPresetRef.current = preset;
      fpsMonitor.current.reset();
      rebuildPasses(preset);
    },
    [rebuildPasses],
  );

  // ─── Skin effect ──────────────────────────────────────────────────────────
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

  const updateSegmentScaleAdaptor = useCallback(
    (
      frameLandmarks: ReplayFrame["landmarks"],
      getLm: (idx: number) => THREE.Vector3 | null,
    ) => {
      if (!modelLoaded || !modelGroupRef.current) return;

      const bones = boneMapRef.current;
      if (!bones || Object.keys(bones).length === 0) return;

      for (const segment of PROPORTION_SEGMENTS) {
        const bone = bones[segment.boneKey];
        if (!bone) continue;

        const [firstA, firstB, secondA, secondB] = segment.sampleLandmarks;
        const start = getLm(firstA);
        const end = getLm(firstB);
        if (!start || !end) {
          const fallbackScale =
            smoothedSegmentScalesRef.current[segment.boneKey] ??
            new THREE.Vector3(1, 1, 1);
          fallbackScale.lerp(new THREE.Vector3(1, 1, 1), PROPORTION_SMOOTHING);
          smoothedSegmentScalesRef.current[segment.boneKey] = fallbackScale;
          bone.scale.copy(fallbackScale);
          continue;
        }

        let measuredLength = start.distanceTo(end);

        if (typeof secondA === "number" && typeof secondB === "number") {
          const altStart = getLm(secondA);
          const altEnd = getLm(secondB);
          if (altStart && altEnd) {
            measuredLength = (measuredLength + altStart.distanceTo(altEnd)) / 2;
          }
        }

        const visibilityA = frameLandmarks[firstA]?.visibility ?? 0;
        const visibilityB = frameLandmarks[firstB]?.visibility ?? 0;
        const visibilityC =
          typeof secondA === "number"
            ? (frameLandmarks[secondA]?.visibility ?? 0)
            : 1;
        const visibilityD =
          typeof secondB === "number"
            ? (frameLandmarks[secondB]?.visibility ?? 0)
            : 1;
        const confidence = Math.min(
          visibilityA,
          visibilityB,
          visibilityC,
          visibilityD,
        );

        if (confidence < 0.25) {
          const fallbackScale =
            smoothedSegmentScalesRef.current[segment.boneKey] ??
            new THREE.Vector3(1, 1, 1);
          fallbackScale.lerp(new THREE.Vector3(1, 1, 1), PROPORTION_SMOOTHING);
          smoothedSegmentScalesRef.current[segment.boneKey] = fallbackScale;
          bone.scale.copy(fallbackScale);
          continue;
        }

        const restLength =
          restSegmentLengthsRef.current[segment.boneKey] ?? measuredLength;
        const normalizedDelta =
          restLength > 0 ? measuredLength / restLength - 1 : 0;
        const targetRatio = 1 + normalizedDelta * (segment.restMultiplier ?? 1);
        const targetScaleState = buildSegmentScaleState(targetRatio);

        const currentScale =
          smoothedSegmentScalesRef.current[segment.boneKey] ??
          new THREE.Vector3(1, 1, 1);
        currentScale.lerp(targetScaleState.scale, PROPORTION_SMOOTHING);
        smoothedSegmentScalesRef.current[segment.boneKey] = currentScale;

        bone.scale.copy(currentScale);
        bone.updateMatrixWorld(true);
      }
    },
    [modelLoaded],
  );

  // ─── Scene + Renderer Setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!frames || frames.length === 0) return;
    if (!mountRef.current) return;

    const width  = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 0, 3.2);
    cameraRef.current = camera;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0x00ffff, 1.2);
    keyLight.position.set(2, 4, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width  = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.left   = -5;
    keyLight.shadow.camera.right  = 5;
    keyLight.shadow.camera.top    = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.camera.near   = 0.1;
    keyLight.shadow.camera.far    = 50;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x9d4edd, 0.7);
    fillLight.position.set(-2, 2, 2);
    fillLight.castShadow = true;
    fillLight.shadow.mapSize.width  = 512;
    fillLight.shadow.mapSize.height = 512;
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffffff, 1);
    rimLight.position.set(0, 3, -4);
    rimLight.castShadow = true;
    scene.add(rimLight);


    // Grid
    const grid = new THREE.GridHelper(10, 20, 0x00ffff, 0x222222);
    grid.position.y = -1.01;
    (grid.material as THREE.LineBasicMaterial).transparent = true;

    (grid.material as THREE.LineBasicMaterial).opacity = 0.2;
    scene.add(grid);



    (grid.material as THREE.LineBasicMaterial).opacity = 0.2;

    scene.add(grid);


    (grid.material as THREE.LineBasicMaterial).opacity     = 0.2;

    scene.add(grid);


    // Floor
    const floorGeo = new THREE.PlaneGeometry(10, 10);
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0x000000,
      emissive: 0x00ffff,
      emissiveIntensity: 0.05,
      transparent: true,
      opacity: 0.8,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.02;
    floor.receiveShadow = true;
    scene.add(floor);

    // Fallback skeleton
    const jointGeometry = new THREE.SphereGeometry(0.04, 16, 16);
    const jointMaterial  = new THREE.MeshStandardMaterial({
      color: 0x00ff00, emissive: 0x00ff00, emissiveIntensity: 0.5,
    });
    const createdJoints: THREE.Mesh[] = [];
    for (let i = 0; i < 33; i++) {
      const sphere = new THREE.Mesh(jointGeometry, jointMaterial.clone());
      sphere.castShadow = true;
      sphere.receiveShadow = true;
      sphere.userData.isOverlay = true;
      scene.add(sphere);
      createdJoints.push(sphere);
    }
    jointsRef.current = createdJoints;


    // ── Create XYZ axis helpers for each joint hub ────────────────────────
    // Each AxesHelper shows X=red, Y=green, Z=blue rotational planes in 3D
    const createdAxes: THREE.AxesHelper[] = [];
    for (let i = 0; i < 33; i++) {
      const axesHelper = new THREE.AxesHelper(0.08);
      axesHelper.visible = false; // hidden by default
      scene.add(axesHelper);
      createdAxes.push(axesHelper);
    }
    axesRef.current = createdAxes;


    const createdBones: { line: THREE.Line; startIdx: number; endIdx: number }[] = [];

    BONES_CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const geometry = new THREE.BufferGeometry();

      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(6), 3),
      );
      const line = new THREE.Line(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 }),
      );

      line.userData.isOverlay = true;

      scene.add(line);
      createdBones.push({ line, startIdx, endIdx });
    });
    bonesRef.current = createdBones;

    const createdStressVectors: StressVectorRig[] = [];
    STRESS_VECTOR_ATTACHMENTS.forEach(
      ({ jointIdx, parentIdx, muscleGroup }) => {
        const geometry = new THREE.CylinderGeometry(
          0.05,
          0.015,
          1,
          10,
          1,
          false,
        );
        geometry.translate(0, 0.5, 0);
        const material = createStressVectorMaterial();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.renderOrder = 4;
        mesh.userData.isOverlay = true;
        scene.add(mesh);
        createdStressVectors.push({
          mesh,
          material,
          geometry,
          jointIdx,
          parentIdx,
          muscleGroup,
        });
      },
    );
    stressVectorsRef.current = createdStressVectors;
    previousJointPositionsRef.current = new Array(33).fill(null);

    // GLTF model — cache-first loading
    setModelLoading(true);
    setModelError(null);

    const setupModel = (gltf: GLTF) => {
      // Always clone from cache — never mutate the cached original
      const model = gltf.scene.clone(true);
      model.position.y = -1;
      scene.add(model);
      modelGroupRef.current = model;
      restSegmentLengthsRef.current = {};
      smoothedSegmentScalesRef.current = {};

      const bones: Record<string, THREE.Bone> = {};
      model.traverse((o) => {
        if (o.type === "Bone") {
          const name = o.name.toLowerCase();
          if (name.includes("leftarm")  && !name.includes("fore")) bones.leftShoulder  = o as THREE.Bone;
          if (name.includes("leftforearm"))                         bones.leftElbow     = o as THREE.Bone;
          if (name.includes("lefthand")  || name.includes("leftwrist"))  bones.leftWrist  = o as THREE.Bone;
          if (name.includes("rightarm") && !name.includes("fore")) bones.rightShoulder = o as THREE.Bone;
          if (name.includes("rightforearm"))                        bones.rightElbow    = o as THREE.Bone;
          if (name.includes("righthand") || name.includes("rightwrist")) bones.rightWrist = o as THREE.Bone;
          if (name.includes("leftupleg")  || name.includes("lefthip"))   bones.leftHip   = o as THREE.Bone;
          if (name.includes("leftleg")    || name.includes("leftknee"))  bones.leftKnee  = o as THREE.Bone;
          if (name.includes("leftfoot")   || name.includes("leftankle")) bones.leftAnkle = o as THREE.Bone;
          if (name.includes("rightupleg") || name.includes("righthip"))  bones.rightHip  = o as THREE.Bone;
          if (name.includes("rightleg")   || name.includes("rightknee")) bones.rightKnee = o as THREE.Bone;
          if (name.includes("rightfoot")  || name.includes("rightankle"))bones.rightAnkle= o as THREE.Bone;
          if (name.includes("spine")) {
            if (name.includes("1")) bones.spine1 = o as THREE.Bone;
            else if (name.includes("2")) bones.spine2 = o as THREE.Bone;
            else bones.spine = o as THREE.Bone;
          }
          if (name.includes("hips") && !name.includes("left") && !name.includes("right"))
            bones.hips = o as THREE.Bone;
          if (name.includes("neck")) bones.neck = o as THREE.Bone;
          if (name.includes("head")) bones.head = o as THREE.Bone;
        }
        if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
          const mesh = o as THREE.SkinnedMesh;
          skinnedMeshesRef.current.push(mesh);
          mesh.material     = createBaseMaterialForSkin(skin);
          mesh.castShadow   = true;
          mesh.receiveShadow = true;
        }
      });
      boneMapRef.current = bones;

      model.updateMatrixWorld(true);
      const hipPos = new THREE.Vector3();
      if (bones.hips) {
        bones.hips.getWorldPosition(hipPos);
        rootOffsetRef.current = model.position.clone().sub(hipPos);
      }

      const recordRest = (boneKey: string, childKey: string) => {
        const bone = bones[boneKey], childBone = bones[childKey];
        if (!bone || !childBone) return;
        const pPos = new THREE.Vector3(), cPos = new THREE.Vector3();
        bone.getWorldPosition(pPos);
        childBone.getWorldPosition(cPos);
        restSegmentLengthsRef.current[boneKey as BoneProportionKey] =
          pPos.distanceTo(cPos);
        const dir = new THREE.Vector3().subVectors(cPos, pPos).normalize();
        if (dir.lengthSq() < 0.001) return;
        const worldQ = new THREE.Quaternion();
        bone.getWorldQuaternion(worldQ);
        restDataRef.current[boneKey] = { worldQuat: worldQ.clone(), localQuat: bone.quaternion.clone(), dir: dir.clone() };
      };

      recordRest("leftShoulder", "leftElbow");
      recordRest("leftElbow",    "leftWrist");
      recordRest("rightShoulder","rightElbow");
      recordRest("rightElbow",   "rightWrist");
      recordRest("leftHip",      "leftKnee");
      recordRest("leftKnee",     "leftAnkle");
      recordRest("rightHip",     "rightKnee");
      recordRest("rightKnee",    "rightAnkle");
      if (bones.spine && bones.spine1) recordRest("spine", "spine1");
      if (bones.neck  && bones.head)   recordRest("neck",  "head");

      setModelLoaded(true);
      setModelLoading(false);
      jointsRef.current.forEach((j) => (j.visible = false));
      bonesRef.current.forEach((b) => (b.line.visible = false));
    };

    // Check cache first
    if (gltfCache.has(modelUrl)) {
      setupModel(gltfCache.get(modelUrl)!);
    } else {
      const loader = new GLTFLoader();
      loader.load(
        modelUrl,
        (gltf) => {
          // Store in cache, then clone for use
          gltfCache.set(modelUrl, gltf);
          setupModel(gltf);
        },
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

      const cfg = GRAPHICS_PRESETS[graphicsPresetRef.current];
      const renderer = new THREE.WebGLRenderer({ antialias: cfg.antialias });
      renderer.setPixelRatio(Math.min(cfg.pixelRatio, window.devicePixelRatio ?? 1));
      renderer.setSize(width, height);
      renderer.outputColorSpace    = THREE.SRGBColorSpace;
      renderer.toneMapping         = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.shadowMap.enabled   = cfg.shadowMapEnabled;
      renderer.shadowMap.type      = cfg.shadowMapType;
      renderer.shadowMap.autoUpdate= true;
      mountRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Build composer + passes
      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(sceneRef.current, cameraRef.current));
      composerRef.current = composer;

      // Build effect passes for initial preset
      rebuildPasses(graphicsPresetRef.current, width, height);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.5,
        0.4,
        0.8,
      );
      composer.addPass(bloomPass);
      bloomPassRef.current = bloomPass;


      
    

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

      // ResizeObserver for accurate element-level resize tracking
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
          if (smaaPassRef.current) {
            rebuildPasses(graphicsPresetRef.current, w, h);
          }
        }
      });

      if (mountRef.current) {
        resizeObserver.observe(mountRef.current);
      }

      renderer.domElement.addEventListener("webglcontextlost",     handleContextLost);
      renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored);

      rendererPipelineCleanupRef.current = () => {
        resizeObserver.disconnect();

        renderer.domElement.removeEventListener("webglcontextlost",     handleContextLost);
        renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);

        controlsRef.current?.dispose();

   
     
        composerRef.current  = null;
        bloomPassRef.current = null;
        smaaPassRef.current  = null;
        ssaoPassRef.current  = null;
        if (mountRef.current?.contains(renderer.domElement)) mountRef.current.removeChild(renderer.domElement);
        renderer.dispose();
        renderer.forceContextLoss();
        if (rendererRef.current  === renderer) rendererRef.current  = null;
        if (controlsRef.current  === controlsRef.current) controlsRef.current  = null;
      };

      requestAnimationFrame(() => {
        if (cancelled || !sceneRef.current || !cameraRef.current || rendererRef.current !== renderer) return;
        composer.render();
      });
    };

    createRendererPipeline();

    return () => {
      cancelled = true;
      if (recoveryTimeoutRef.current !== null) {
        window.clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = null;
      }
      disposeRendererPipeline();

      jointsRef.current.forEach((mesh) => {
        mesh.geometry.dispose();
        (mesh.material as THREE.ShaderMaterial).dispose();
      });
      jointsRef.current = [];
      bonesRef.current.forEach(({ line }) => {
        line.geometry.dispose();
        (line.material as THREE.LineBasicMaterial).dispose();
      });
      bonesRef.current = [];

      stressVectorsRef.current.forEach(({ mesh, material, geometry }) => {
        geometry.dispose();
        material.dispose();
        sceneRef.current?.remove(mesh);
      });
      stressVectorsRef.current = [];
      previousJointPositionsRef.current = [];

      if (modelGroupRef.current) {
        modelGroupRef.current.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              // Dispose all mapped textures
              Object.values(mat).forEach((value) => {
                if (value instanceof THREE.Texture) {
                  value.dispose();
                }
              });
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


      restSegmentLengthsRef.current = {};
      smoothedSegmentScalesRef.current = {};

      orbitPelvisTargetRef.current.set(0, 0, 0);
      hasOrbitPelvisTargetRef.current = false;



      if (sceneRef.current) {
        sceneRef.current.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const mat of materials) {
              if (mat) {
                Object.values(mat).forEach((value) => {
                  if (value instanceof THREE.Texture) {
                    value.dispose();
                  }
                });
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

    // FPS display throttle
    let fpsDisplayTimer = 0;

    const renderLoop = (time: number) => {
      reqIdRef.current = requestAnimationFrame(renderLoop);

      // Record FPS sample
      fpsMonitor.current.record(time);

      // Update FPS display every 500 ms
      fpsDisplayTimer += 1;
      if (fpsDisplayTimer >= 30) {
        fpsDisplayTimer = 0;
        setDisplayFPS(fpsMonitor.current.getAvgFPS());
      }

      // Adaptive quality stepping
      if (autoAdaptRef.current) {
        const cfg = GRAPHICS_PRESETS[graphicsPresetRef.current];
        const suggestion = fpsMonitor.current.evaluate(graphicsPresetRef.current, cfg.targetFPS, time);
        if (suggestion !== 0) {
          const idx = PRESET_ORDER.indexOf(graphicsPresetRef.current);
          const nextPreset = PRESET_ORDER[idx + suggestion];
          if (nextPreset) applyPreset(nextPreset);
        }
      }

      // Frame advance
      const cfg = GRAPHICS_PRESETS[graphicsPresetRef.current];
      if (isPlaying && time - lastTimeRef.current > 1000 / 8) {
        const nextIdx = (currentFrameIdx + 1) % frames.length;
        setCurrentFrameIdx(nextIdx);
        lastTimeRef.current = time;
      }

      const frame = frames[currentFrameIdx];
      if (!frame || !frame.landmarks) {
        rendererRef.current?.render(sceneRef.current!, cameraRef.current!);
        return;
      }



      const repCount = frame.repCount ?? Math.floor(currentFrameIdx / 30);
      const timeSeconds = time * 0.001;
      const { baseColor, badJoints, mistakeColor } = parseFeedback(frame.feedback);
      const exerciseName = frame.exercise?.toLowerCase() || "";




      // Helper
      let depthScale = 2.0;
      const rawLS = frame.landmarks[11], rawRS = frame.landmarks[12];
      const rawLH = frame.landmarks[23], rawRH = frame.landmarks[24];
      if (rawLS && rawRS && rawLH && rawRH) {
        const dx = rawLS.x - rawRH.x, dy = rawLS.y - rawRH.y;
        const torsoSize = Math.sqrt(dx * dx + dy * dy);
        if (torsoSize > 0.1) depthScale = (0.5 / torsoSize) * 3.0;
      }

      const getLm = (idx: number) => {
        const lm = frame.landmarks[idx];
        if (!lm) return null;
        return new THREE.Vector3(-(lm.x - 0.5) * 2, -(lm.y - 0.5) * 2, -lm.z * depthScale);
      };


      const lShoulder = getLm(11),
        rShoulder = getLm(12);
      const lHip = getLm(23),
        rHip = getLm(24);
      const lAnkle = getLm(27),
        rAnkle = getLm(28);
      const shoulderCenter =
        lShoulder && rShoulder
          ? new THREE.Vector3()
              .addVectors(lShoulder, rShoulder)
              .multiplyScalar(0.5)
          : null;
      const hipCenter =
        lHip && rHip
          ? new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5)
          : null;
      const bodyCenter =
        shoulderCenter && hipCenter
          ? new THREE.Vector3()
              .addVectors(shoulderCenter, hipCenter)
              .multiplyScalar(0.5)
          : shoulderCenter || hipCenter;

      if (modelLoaded) {
        updateSegmentScaleAdaptor(frame.landmarks, getLm);
      }


      const footCenter =
        lAnkle && rAnkle
          ? new THREE.Vector2(
              (lAnkle.x + rAnkle.x) * 0.5,
              (lAnkle.z + rAnkle.z) * 0.5,
            )
          : lAnkle
            ? new THREE.Vector2(lAnkle.x, lAnkle.z)
            : rAnkle
              ? new THREE.Vector2(rAnkle.x, rAnkle.z)
              : null;

      syncRippleUniforms(timeSeconds);
      if (lastRepCountRef.current === null) {
        lastRepCountRef.current = repCount;
      } else if (repCount !== lastRepCountRef.current) {
        if (repCount > lastRepCountRef.current && footCenter) {
          const lastCompletion = lastRippleCompletionTimeRef.current;
          const intervalSeconds = lastCompletion
            ? timeSeconds - lastCompletion
            : 1.0;
          const tempo = THREE.MathUtils.clamp(
            1.8 / Math.max(intervalSeconds, 0.25),
            0.7,
            1.6,
          );
          const rippleOrigin = new THREE.Vector2(
            THREE.MathUtils.clamp(footCenter.x / GRID_SIZE + 0.5, 0.05, 0.95),
            THREE.MathUtils.clamp(footCenter.y / GRID_SIZE + 0.5, 0.05, 0.95),
          );
          emitRipple(
            rippleOrigin,
            0.5 + tempo * 0.55,
            0.65 + tempo * 0.35,
            timeSeconds,
          );
        }
        lastRepCountRef.current = repCount;
      }

      if (modelLoaded) {
        if (!modelGroupRef.current) return;

        if (lShoulder && rShoulder && lHip && rHip && shoulderCenter && hipCenter) {
          const up      = new THREE.Vector3().subVectors(shoulderCenter, hipCenter).normalize();
          const right   = new THREE.Vector3().subVectors(lShoulder, rShoulder).normalize();
          const forward = new THREE.Vector3().crossVectors(right, up).normalize();

          right.crossVectors(up, forward).normalize();
          const mat       = new THREE.Matrix4();
          mat.makeBasis(right, up, forward);
          const torsoQuat = new THREE.Quaternion().setFromRotationMatrix(mat);
          modelGroupRef.current.quaternion.slerp(torsoQuat, 0.05);

          const rotatedOffset = rootOffsetRef.current.clone().applyQuaternion(modelGroupRef.current.quaternion);
          const targetPos     = hipCenter.clone().add(rotatedOffset);
          const minAnkleY     = Math.min(lAnkle?.y || 0, rAnkle?.y || 0);
          targetPos.y         = -1.0 - minAnkleY;
          modelGroupRef.current.position.lerp(targetPos, 0.05);
          modelGroupRef.current.updateMatrixWorld(true);



          if (!hasOrbitPelvisTargetRef.current) {
            orbitPelvisTargetRef.current.copy(hipCenter);
            hasOrbitPelvisTargetRef.current = true;
          }

          const pelvisDisplacement =
            orbitPelvisTargetRef.current.distanceTo(hipCenter);
          const targetLerp = THREE.MathUtils.clamp(
            0.08 + pelvisDisplacement * 0.2,
            0.08,
            0.22,
          );
          orbitPelvisTargetRef.current.lerp(hipCenter, targetLerp);

          if (controlsRef.current)
            controlsRef.current.target.copy(orbitPelvisTargetRef.current);
          else if (cameraRef.current)
            cameraRef.current.lookAt(orbitPelvisTargetRef.current);

          const lookTarget = new THREE.Vector3().lerpVectors(hipCenter, shoulderCenter, 0.5);
          if (controlsRef.current) {
            controlsRef.current.target.lerp(lookTarget, 0.05);
          } else if (cameraRef.current) {
            cameraRef.current.lookAt(lookTarget);
          }

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
          const deltaQ        = new THREE.Quaternion().setFromUnitVectors(rest.dir, targetDir);
          const targetWorldQ  = rest.worldQuat.clone().premultiply(deltaQ);
          const parentWorldQ  = new THREE.Quaternion();
          if (bone.parent) bone.parent.getWorldQuaternion(parentWorldQ);
          const targetLocalQ  = targetWorldQ.clone().premultiply(parentWorldQ.invert());
          bone.quaternion.slerp(targetLocalQ, 0.05);
        };

        const bMap = boneMapRef.current;
        if (bMap && bMap.spine) {
          const hC = lHip && rHip ? new THREE.Vector3().addVectors(lHip, rHip).multiplyScalar(0.5) : null;
          const sC = lShoulder && rShoulder ? new THREE.Vector3().addVectors(lShoulder, rShoulder).multiplyScalar(0.5) : null;
          if (hC && sC) {
            const spineDir = new THREE.Vector3().subVectors(sC, hC).normalize();
            const rest = restDataRef.current["spine"];
            if (rest) {
              const deltaQ       = new THREE.Quaternion().setFromUnitVectors(rest.dir, spineDir);
              const targetWorldQ = rest.worldQuat.clone().premultiply(deltaQ);
              const parentWorldQ = new THREE.Quaternion();
              if (bMap.spine.parent) bMap.spine.parent.getWorldQuaternion(parentWorldQ);
              bMap.spine.quaternion.slerp(targetWorldQ.premultiply(parentWorldQ.invert()), 0.05);
            }
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

        // HUD projection
        const newLabels: HudLabel[] = [];
        const projectJoint = (
          idx: number, boneKey: string, label: string,
          p1: number, p2: number, p3: number,
        ) => {
          if (!cameraRef.current || !rendererRef.current || !mountRef.current) return;
          const a = getLm(p1), b = getLm(p2), c = getLm(p3);
          let angle = 0;
          if (a && b && c) {
            const v1 = new THREE.Vector3().subVectors(a, b);
            const v2 = new THREE.Vector3().subVectors(c, b);
            angle = Math.round(v1.angleTo(v2) * (180 / Math.PI));
          }
          const bone = boneMapRef.current[boneKey];
          if (!bone) return;
          const pos    = new THREE.Vector3();
          bone.getWorldPosition(pos);
          const vector = pos.project(cameraRef.current);
          const x = (vector.x * 0.5 + 0.5) * mountRef.current.clientWidth;
          const y = -(vector.y * 0.5 - 0.5) * mountRef.current.clientHeight;
          newLabels.push({ x, y, angle, label, id: idx });
        };

        projectJoint(13, "leftElbow",  "L ELBOW", 11, 13, 15);
        projectJoint(14, "rightElbow", "R ELBOW", 12, 14, 16);
        projectJoint(25, "leftKnee",   "L KNEE",  23, 25, 27);
        projectJoint(26, "rightKnee",  "R KNEE",  24, 26, 28);
        projectJoint(23, "leftHip",    "L HIP",   11, 23, 25);
        projectJoint(24, "rightHip",   "R HIP",   12, 24, 26);
        setHudLabels(newLabels);

        // Material error highlight
        skinnedMeshesRef.current.forEach((mesh) => {
          if (!mesh.material) return;
          const mat       = mesh.material as THREE.MeshStandardMaterial;
          const hasError  = badJoints.size > 0;
          const targetColor = hasError ? mistakeColor || COLOR_RED : baseColor;

          if (skin === "Cyberpunk Neon") {
            const neonColor = hasError ? (mistakeColor || new THREE.Color(0xff00ff)) : targetColor;
            if (mat.color)   mat.color.lerp(new THREE.Color(0x050505), 0.2);
            if (mat.emissive)mat.emissive.lerp(neonColor, 0.2);
            mat.emissiveIntensity = hasError ? 1.5 : 1.2;
          } else if (skin === "Robot") {
            if (mat.color)   mat.color.lerp(new THREE.Color(0xd0d0d0), 0.2);
            if (mat.emissive)mat.emissive.lerp(targetColor, 0.2);
            mat.emissiveIntensity = hasError ? 1.0 : (baseColor.equals(COLOR_GREEN) ? 0.3 : 0.6);
          } else {
            if (mat.color)   mat.color.lerp(new THREE.Color(0xe0a080), 0.2);
            if (mat.emissive)mat.emissive.lerp(targetColor, 0.2);
            mat.emissiveIntensity = hasError ? 0.4 : (baseColor.equals(COLOR_GREEN) ? 0.05 : 0.1);
          }
        });
      } else {
        // Fallback skeleton rendering
        const repCount   = frame.repCount ?? Math.floor(currentFrameIdx / 30);
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
        badJoints.forEach((j)         => { jointTargetColors[j] = mistakeColor || COLOR_RED; });

        for (let i = 0; i < 33; i++) {
          const landmark = frame.landmarks[i];
          if (!landmark || !jointsRef.current[i]) continue;
          const mesh = jointsRef.current[i];
          mesh.position.lerp(new THREE.Vector3(-(landmark.x - 0.5) * 2, -(landmark.y - 0.5) * 2, -landmark.z * 2), 0.1);
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
      }

      updateStressVectors(
        getLm,
        bodyCenter,
        shoulderCenter,
        hipCenter,
        baseColor,
        badJoints,
        exerciseName,
        time,
      );

      if (controlsRef.current) controlsRef.current.update();
      if (sceneRef.current && cameraRef.current) composerRef.current?.render();
    };

    reqIdRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(reqIdRef.current);
  }, [frames, currentFrameIdx, isPlaying, modelLoaded, setCurrentFrameIdx, skin, applyPreset]);

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
      <div
        ref={mountRef}
        style={{ flex: 1, minHeight: "400px", width: "100%", height: "100%", borderRadius: "8px", overflow: "hidden" }}
      />

      {/* Loading Spinner Overlay */}
      {modelLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(17, 17, 17, 0.85)",
            borderRadius: "8px",
            zIndex: 15,
          }}
        >
          <div style={{ textAlign: "center", color: "#00ffcc" }}>
            <div
              style={{
                width: 36,
                height: 36,
                border: "3px solid rgba(0, 255, 204, 0.2)",
                borderTopColor: "#00ffcc",
                borderRadius: "50%",
                animation: "gltf-spin 0.75s linear infinite",
                margin: "0 auto 12px",
              }}
            />
            <span style={{ fontSize: "0.8rem", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 1 }}>
              Loading 3D model...
            </span>
          </div>
          <style>{`@keyframes gltf-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Model Error Message */}
      {modelError && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            background: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: 6,
            padding: "6px 12px",
            fontSize: "0.72rem",
            color: "#ef4444",
            fontFamily: "'JetBrains Mono', monospace",
            zIndex: 15,
          }}
        >
          {modelError}
        </div>
      )}

      {/* Graphic Settings Overlay */}
      <GraphicsPanel
        preset={graphicsPreset}
        autoAdapt={autoAdapt}
        currentFPS={displayFPS}
        onPresetChange={applyPreset}
        onAutoAdaptChange={(v) => {
          setAutoAdapt(v);
          autoAdaptRef.current = v;
          fpsMonitor.current.reset();
        }}
      />

      {/* 3D HUD Labels */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {hudLabels.map((node) => (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: node.x,
              top: node.y,
              transform: "translate(-50%, -50%)",
              padding: "4px 8px",
              background: "rgba(0, 0, 0, 0.6)",
              border: `1px solid ${node.angle < 140 ? "var(--neon-cyan)" : "var(--neon-purple)"}`,
              borderRadius: "4px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              backdropFilter: "blur(4px)",
              boxShadow: "0 0 10px rgba(0,0,0,0.5)",
              transition: "all 0.1s linear",
            }}
          >
            <span style={{ fontSize: "0.6rem", color: "#aaa", letterSpacing: "1px" }}>{node.label}</span>
            <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 800 }}>{node.angle}°</span>
          </div>
        ))}
      </div>

      {/* Playback Controls */}
      {!hideControls && (
        <div
          style={{
            padding: "15px",
            background: "#222",
            display: "flex",
            alignItems: "center",
            gap: "15px",
            borderRadius: "8px",
            marginTop: "10px",
          }}
        >
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: "8px 16px",
              background: "var(--neon-purple, #9D4EDD)",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isPlaying ? "PAUSE" : "PLAY"}
          </button>
          <input
            type="range"
            min="0"
            max={frames.length - 1}
            value={currentFrameIdx}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentFrameIdx(Number(e.target.value));
            }}
            style={{ flex: 1, cursor: "pointer" }}
          />
          <span style={{ color: "#aaa", fontSize: "0.85rem", minWidth: "80px", textAlign: "right" }}>
            {currentFrameIdx} / {frames.length - 1}
          </span>
        </div>
      )}
    </div>
  );
};
