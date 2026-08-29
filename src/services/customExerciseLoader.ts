import { ExerciseConfig, exercises } from '../config/exercises';
import { exercisePluginRegistry } from '../plugins/exercises/ExercisePluginRegistry';
import { BaseExercisePlugin } from '../plugins/exercises/BaseExercisePlugin';

/**
 * customExerciseLoader.ts
 *
 * Runtime plugin loader: parses user-uploaded JSON "layouts" that describe a
 * custom reps counter and registers them into the exercise config map and the
 * plugin registry. Registered exercises are immediately available to the core
 * engine (`getStrategy`) with zero rebuilds, and survive page reloads via
 * localStorage.
 */

export interface CustomExerciseLayout {
  key: string;
  name: string;
  primaryJoint: string;
  primaryJointIndex?: number;
  joints?: number[][];
  downThreshold: number;
  upThreshold: number;
  isStatic?: boolean;
  guide?: {
    instructions?: string[];
    commonMistakes?: string[];
    targetMuscles?: string[];
  };
}

const STORAGE_KEY = 'spectrax_custom_exercise_layouts';

const INVALID_KEY_PATTERN = /[^a-zA-Z0-9]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNumberField(
  layout: Record<string, unknown>,
  field: string
): number {
  const value = layout[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(
      `Invalid custom exercise layout: "${field}" must be a finite number, got ${JSON.stringify(value)}.`
    );
  }
  return value;
}

function assertStringField(
  layout: Record<string, unknown>,
  field: string
): string {
  const value = layout[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Invalid custom exercise layout: "${field}" must be a non-empty string, got ${JSON.stringify(value)}.`
    );
  }
  return value.trim();
}

function assertKeyField(value: string): string {
  if (INVALID_KEY_PATTERN.test(value)) {
    throw new Error(
      `Invalid custom exercise layout: "key" may only contain letters and digits, got "${value}".`
    );
  }
  return value;
}

/**
 * Strictly parse and validate a user-uploaded JSON layout string into a typed
 * CustomExerciseLayout. Throws descriptive errors on malformed input.
 */
export function parseCustomExerciseLayout(json: string): CustomExerciseLayout {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (err) {
    throw new Error(
      `Invalid custom exercise layout: the uploaded file is not valid JSON (${(err as Error).message}).`
    );
  }

  if (!isRecord(parsed)) {
    throw new Error(
      'Invalid custom exercise layout: the JSON root must be an object.'
    );
  }

  const key = assertKeyField(assertStringField(parsed, 'key'));
  const name = assertStringField(parsed, 'name');
  const primaryJoint = assertStringField(parsed, 'primaryJoint');

  const downThreshold = assertNumberField(parsed, 'downThreshold');
  const upThreshold = assertNumberField(parsed, 'upThreshold');

  if (downThreshold >= upThreshold) {
    throw new Error(
      'Invalid custom exercise layout: downThreshold must be less than upThreshold.'
    );
  }

  const layout: CustomExerciseLayout = {
    key,
    name,
    primaryJoint,
    downThreshold,
    upThreshold,
  };

  if (parsed.primaryJointIndex !== undefined) {
    const idx = assertNumberField(parsed, 'primaryJointIndex');
    if (!Number.isInteger(idx) || idx < 0 || idx > 32) {
      throw new Error(
        'Invalid custom exercise layout: primaryJointIndex must be an integer between 0 and 32.'
      );
    }
    layout.primaryJointIndex = idx;
  }

  if (parsed.joints !== undefined) {
    if (!Array.isArray(parsed.joints)) {
      throw new Error(
        'Invalid custom exercise layout: "joints" must be an array of [a, b] landmark index pairs.'
      );
    }
    for (const pair of parsed.joints) {
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        !pair.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)
      ) {
        throw new Error(
          'Invalid custom exercise layout: every "joints" entry must be a [a, b] pair of landmark indices.'
        );
      }
    }
    layout.joints = parsed.joints as number[][];
  }

  if (parsed.isStatic !== undefined) {
    if (typeof parsed.isStatic !== 'boolean') {
      throw new Error(
        'Invalid custom exercise layout: "isStatic" must be a boolean.'
      );
    }
    layout.isStatic = parsed.isStatic;
  }

  if (parsed.guide !== undefined) {
    if (!isRecord(parsed.guide)) {
      throw new Error('Invalid custom exercise layout: "guide" must be an object.');
    }
    const guide: NonNullable<CustomExerciseLayout['guide']> = {};
    for (const field of ['instructions', 'commonMistakes', 'targetMuscles'] as const) {
      if (parsed.guide[field] !== undefined) {
        const arr = parsed.guide[field];
        if (!Array.isArray(arr) || !arr.every((s) => typeof s === 'string')) {
          throw new Error(
            `Invalid custom exercise layout: "guide.${field}" must be an array of strings.`
          );
        }
        guide[field] = arr as string[];
      }
    }
    if (Object.keys(guide).length > 0) layout.guide = guide;
  }

  return layout;
}

function buildConfig(layout: CustomExerciseLayout): ExerciseConfig {
  return {
    key: layout.key,
    name: layout.name,
    primaryJoint: layout.primaryJoint,
    joints: layout.joints || [],
    downThreshold: layout.downThreshold,
    upThreshold: layout.upThreshold,
    isStatic: layout.isStatic ?? false,
    feedbackRules: [],
    guide: layout.guide
      ? {
          instructions: layout.guide.instructions || [],
          commonMistakes: layout.guide.commonMistakes || [],
          targetMuscles: layout.guide.targetMuscles || [],
        }
      : undefined,
  };
}

class CustomLayoutPlugin extends BaseExercisePlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly configKey: string;

  constructor(layout: CustomExerciseLayout) {
    super(layout.primaryJointIndex ?? 24);
    this.id = layout.key;
    this.name = layout.name;
    this.description = `Runtime-registered custom exercise: ${layout.name}`;
    this.configKey = layout.key;
  }
}

/**
 * Register a parsed custom exercise layout into the runtime engine. Idempotent:
 * re-registering an existing key overwrites the previous configuration.
 */
export function registerCustomExercise(layout: CustomExerciseLayout): ExerciseConfig {
  const config = buildConfig(layout);
  exercises[layout.key] = config;
  exercisePluginRegistry.register(new CustomLayoutPlugin(layout));
  return config;
}

/**
 * Convenience wrapper: parse a JSON string then register it.
 */
export function registerCustomExerciseFromJson(json: string): ExerciseConfig {
  return registerCustomExercise(parseCustomExerciseLayout(json));
}

/**
 * Remove a runtime-registered custom exercise. Built-in exercises cannot be
 * removed; the operation is a no-op for them.
 */
export function unregisterCustomExercise(key: string): boolean {
  if (isBuiltInExerciseKey(key)) return false;
  delete exercises[key];
  exercisePluginRegistry.unregister(key);
  return true;
}

const BUILT_IN_KEYS = new Set<string>(Object.keys(exercises));

export function isBuiltInExerciseKey(key: string): boolean {
  return BUILT_IN_KEYS.has(key);
}

/**
 * Persist all currently registered custom exercise layouts to localStorage.
 */
export function saveCustomExerciseLayouts(layouts: CustomExerciseLayout[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  } catch {
    // Storage may be unavailable (private mode / quota). Registration is still
    // valid for this session, so silently fall through.
  }
}

/**
 * Load persisted custom layouts from localStorage.
 */
export function loadCustomExerciseLayouts(): CustomExerciseLayout[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).map((entry) => parseCustomExerciseLayout(JSON.stringify(entry)));
  } catch {
    return [];
  }
}

/**
 * Re-register every persisted custom layout. Call once at app startup so
 * user-uploaded exercises survive page reloads.
 */
export function restoreCustomExercises(): ExerciseConfig[] {
  return loadCustomExerciseLayouts().map(registerCustomExercise);
}
