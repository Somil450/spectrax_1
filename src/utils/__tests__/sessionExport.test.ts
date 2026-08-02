import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  qualityTierFor,
  issueForRep,
  buildRepLog,
  countQualityTiers,
  longestGoodStreak,
  exportSessionJSON,
  exportSessionCSV,
} from "../sessionExport";

const stats = {
  reps: 5,
  totalReps: 5,
  correctReps: 4,
  repScores: [92, 75, 40, 88, 84],
  repDeviations: [5, 12, 28, 8, 15],
  duration: 50,
  accuracy: 76,
  exerciseName: "Pushups",
  mistakes: { "elbow flare": 2 },
  bestStreak: 2,
  calories: 30,
};

describe("qualityTierFor", () => {
  it("tiers scores by the 80/60 boundaries", () => {
    expect(qualityTierFor(92)).toBe("Good");
    expect(qualityTierFor(80)).toBe("Good");
    expect(qualityTierFor(79)).toBe("Acceptable");
    expect(qualityTierFor(60)).toBe("Acceptable");
    expect(qualityTierFor(59)).toBe("Poor");
  });
});

describe("issueForRep", () => {
  it("flags large posture deviations first", () => {
    expect(issueForRep(40, 28)).toBe("Posture deviation detected");
  });

  it("reports good form for high scores without deviation", () => {
    expect(issueForRep(92, 5)).toBe("Good form");
  });
});

describe("buildRepLog", () => {
  it("builds a row per rep with timestamp, tier, and issue", () => {
    const rows = buildRepLog(stats);
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ rep: 1, timestampSec: 10, score: 92, tier: "Good", issue: "Good form" });
    expect(rows[2]).toMatchObject({ rep: 3, timestampSec: 30, score: 40, tier: "Poor", issue: "Posture deviation detected" });
  });

  it("returns an empty array when there are no rep scores", () => {
    expect(buildRepLog({ ...stats, repScores: [] })).toEqual([]);
  });
});

describe("countQualityTiers", () => {
  it("counts reps per tier", () => {
    const counts = countQualityTiers(buildRepLog(stats));
    expect(counts).toEqual({ Good: 3, Acceptable: 1, Poor: 1 });
  });
});

describe("longestGoodStreak", () => {
  it("measures the longest run of Good reps", () => {
    const rows = buildRepLog(stats);
    expect(longestGoodStreak(rows)).toBe(2);
  });
});

describe("exportSessionJSON / exportSessionCSV", () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:fake"),
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      value: originalCreateObjectURL,
      configurable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: originalRevoke,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("downloads a JSON blob with the session payload", () => {
    let capturedBlob: Blob | undefined;
    let downloadName = "";
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const anchor = originalCreate(tag);
      return new Proxy(anchor, {
        set(target, prop, value) {
          if (prop === "download") downloadName = value as string;
          return Reflect.set(target, prop, value);
        },
        get(target, prop) {
          if (prop === "click") return () => {};
          return Reflect.get(target, prop);
        },
      });
    });
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return "blob:fake";
      }),
      configurable: true,
    });

    exportSessionJSON(stats);

    expect(downloadName).toContain("pushups-session-");
    expect(downloadName.endsWith(".json")).toBe(true);
    expect(capturedBlob?.type).toBe("application/json");
  });

  it("downloads a CSV blob with a rep log header and rows", async () => {
    let capturedBlob: Blob | undefined;
    let downloadName = "";
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const anchor = originalCreate(tag);
      return new Proxy(anchor, {
        set(target, prop, value) {
          if (prop === "download") downloadName = value as string;
          return Reflect.set(target, prop, value);
        },
        get(target, prop) {
          if (prop === "click") return () => {};
          return Reflect.get(target, prop);
        },
      });
    });
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return "blob:fake";
      }),
      configurable: true,
    });

    exportSessionCSV(stats);

    expect(downloadName.endsWith(".csv")).toBe(true);
    const text = await capturedBlob!.text();
    expect(text.split("\n")[0]).toBe("rep,timestamp_seconds,form_score,quality_tier,top_issue");
    expect(text).toContain("1,10,92,Good,Good form");
    expect(text).toContain("3,30,40,Poor,Posture deviation detected");
  });
});
