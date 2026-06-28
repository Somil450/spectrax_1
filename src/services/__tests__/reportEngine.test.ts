import { describe, it, expect } from "vitest";
import { reportEngine, ReportEngine } from "../reportEngine";
import type { ReportData, TemplateType } from "../../types/report";

function sampleData(overrides: Partial<ReportData> = {}): ReportData {
  return {
    session: {
      exerciseName: "Squats",
      reps: 10,
      totalReps: 12,
      correctReps: 10,
      accuracy: 83,
      duration: 300,
      totalScore: 950,
      totalFrames: 450,
      mistakes: { "Knees caving in": 3, "Back rounding": 1 },
      bestStreak: 5,
      calories: 45,
      gainedXp: 120,
      timestamp: 1717000000000,
      jumpingJackSync: { score: 85, lagMs: 120, confidence: 0.8 },
    },
    biomechanics: {
      repScores: [85, 90, 78, 92, 88, 76, 95, 82, 87, 91, 80, 84],
      repDeviations: [0.5, 0.3, 0.8, 0.2, 0.4, 0.9, 0.1, 0.5, 0.3, 0.4, 0.6, 0.3],
      averageScore: 85.7,
      minScore: 76,
      maxScore: 95,
      tempoRatio: "2:1:1",
      holdTime: 0,
    },
    risk: {
      riskIndex: 25,
      fatigueIndex: 30,
      asymmetryScore: 15,
      recommendedStopRep: null,
      riskHistory: [
        { timestamp: 1717000000000, riskIndex: 10, fatigueIndex: 5, asymmetryScore: 8 },
        { timestamp: 1717000030000, riskIndex: 25, fatigueIndex: 30, asymmetryScore: 15 },
      ],
    },
    vbt: {
      peakConcentricVelocity: 1.25,
      averageConcentricVelocity: 1.02,
      baselineVelocity: 1.30,
      fatigueDropoff: 0.22,
      currentVelocity: 0.85,
    },
    depthAnalysis: {
      squatDepthStats: { fullDepthRatio: 0.7, partialRatio: 0.2, aboveParallelRatio: 0.1 },
    },
    user: { displayName: "Athlete-1", level: 12, xp: 3400, bodyType: "meso" },
    ...overrides,
  };
}

// ── 1. Template Selection ─────────────────────────────────────────

describe("template selection", () => {
  it("returns correct template for each type", () => {
    const types: TemplateType[] = ["executive", "technical", "compliance"];
    for (const type of types) {
      const template = reportEngine.getTemplate(type);
      expect(template.type).toBe(type);
      expect(template.label).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.supportedFormats.length).toBeGreaterThan(0);
    }
  });

  it("lists all available templates", () => {
    const templates = reportEngine.listTemplates();
    expect(templates).toHaveLength(3);
    expect(templates.map((t) => t.type).sort()).toEqual(["compliance", "executive", "technical"]);
  });

  it("throws on unknown template type", () => {
    expect(() => reportEngine.getTemplate("unknown" as TemplateType)).toThrow("Unknown template type");
  });

  it("throws on unsupported format for template", () => {
    const data = sampleData();
    expect(() => reportEngine.render(data, "executive", "json")).toThrow("not supported");
  });
});

// ── 2. Missing Fields / Partial Data ──────────────────────────────

describe("missing fields handling", () => {
  it("renders with minimal empty data without crashing", () => {
    const minimal: ReportData = { session: { exerciseName: "", reps: 0, totalReps: 0, correctReps: 0, accuracy: 0, duration: 0, totalScore: 0, totalFrames: 0, mistakes: {}, bestStreak: 0, calories: 0, gainedXp: 0, timestamp: 0 } };
    const types: TemplateType[] = ["executive", "technical", "compliance"];
    for (const type of types) {
      const formats = reportEngine.getTemplate(type).supportedFormats;
      for (const format of formats) {
        const result = reportEngine.render(minimal, type, format);
        expect(result).toBeTruthy();
        expect(result.length).toBeGreaterThan(0);
      }
    }
  });

  it("handles missing optional sections gracefully", () => {
    const withMissingRisk: ReportData = {
      session: sampleData().session,
      biomechanics: sampleData().biomechanics,
      vbt: sampleData().vbt,
    };
    const result = reportEngine.render(withMissingRisk, "technical", "html");
    expect(result).toContain("Technical Deep-Dive");
    expect(result).toContain("Biomechanics");
  });

  it("fills null/undefined numeric fields with defaults", () => {
    const sparse = sampleData({
      session: { exerciseName: "Test", reps: 0, totalReps: 0, correctReps: 0, accuracy: undefined as unknown as number, duration: undefined as unknown as number, totalScore: undefined as unknown as number, totalFrames: undefined as unknown as number, mistakes: {}, bestStreak: 0, calories: 0, gainedXp: 0, timestamp: 0 },
    });
    const result = reportEngine.render(sparse, "executive", "html");
    expect(result).toContain("0%");
    expect(result).toContain("0:00");
  });
});

// ── 3. Safe Rendering (XSS prevention) ────────────────────────────

describe("safe rendering / XSS prevention", () => {
  it("escapes HTML injection in exercise name", () => {
    const malicious = sampleData({
      session: {
        ...sampleData().session,
        exerciseName: "<script>alert('xss')</script>Squats",
      },
    });
    const result = reportEngine.render(malicious, "executive", "html");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });

  it("escapes HTML injection in mistake messages", () => {
    const malicious = sampleData({
      session: {
        ...sampleData().session,
        mistakes: { "<img src=x onerror=alert(1)>": 1 },
      },
    });
    const result = reportEngine.render(malicious, "executive", "html");
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });

  it("escapes HTML in display name", () => {
    const malicious = sampleData({
      user: { displayName: "<b>bold</b>", level: 0, xp: 0 },
    });
    const result = reportEngine.render(malicious, "compliance", "html");
    expect(result).not.toContain("<b>bold</b>");
  });
});

// ── 4. Export Output Consistency ──────────────────────────────────

describe("export output consistency", () => {
  it("produces same data fields for same input", () => {
    const data = sampleData();
    const first = JSON.parse(reportEngine.render(data, "compliance", "json"));
    const second = JSON.parse(reportEngine.render(data, "compliance", "json"));
    delete first.generatedAt;
    delete second.generatedAt;
    expect(first).toEqual(second);
  });

  it("JSON output is valid and parseable", () => {
    const data = sampleData();
    const result = reportEngine.render(data, "compliance", "json");
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.reportType).toBe("compliance");
    expect(parsed.session).toBeTruthy();
    expect(parsed.provenance).toBeTruthy();
  });

  it("technical JSON output contains expected top-level keys", () => {
    const data = sampleData();
    const result = reportEngine.render(data, "technical", "json");
    const parsed = JSON.parse(result);
    expect(parsed.reportType).toBe("technical");
    expect(parsed.session).toBeTruthy();
    expect(parsed.biomechanics).toBeTruthy();
  });

  it("markdown output has expected heading structure", () => {
    const data = sampleData();
    const md = reportEngine.render(data, "executive", "markdown");
    expect(md).toContain("# Executive");
    expect(md).toContain("| Metric | Value |");
  });
});

// ── 5. Preview ────────────────────────────────────────────────────

describe("report preview", () => {
  it("returns html, word count, and sections", () => {
    const data = sampleData();
    const preview = reportEngine.getPreview(data, "executive");
    expect(preview.html).toBeTruthy();
    expect(preview.wordCount).toBeGreaterThan(10);
    expect(preview.sections.length).toBeGreaterThan(0);
  });

  it("all templates produce valid previews", () => {
    const data = sampleData();
    const types: TemplateType[] = ["executive", "technical", "compliance"];
    for (const type of types) {
      const preview = reportEngine.getPreview(data, type);
      expect(preview.html).toBeTruthy();
      expect(preview.sections.length).toBeGreaterThan(0);
    }
  });
});

// ── 6. Validation ────────────────────────────────────────────────

describe("template validation", () => {
  it("validates all templates produce valid output", () => {
    const types: TemplateType[] = ["executive", "technical", "compliance"];
    for (const type of types) {
      const result = reportEngine.validate(type);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});

// ── 7. Engine Instance ───────────────────────────────────────────

describe("report engine instance", () => {
  it("is a singleton", () => {
    const engine2 = new ReportEngine();
    expect(reportEngine.listTemplates()).toEqual(engine2.listTemplates());
  });
});

// ── 8. Edge Cases ────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty mistakes object", () => {
    const data = sampleData({
      session: { ...sampleData().session, mistakes: {} },
    });
    const result = reportEngine.render(data, "executive", "html");
    expect(result).toContain("Executive");
  });

  it("handles 0 reps without division errors", () => {
    const data = sampleData({
      session: { ...sampleData().session, totalReps: 0, correctReps: 0, accuracy: 0, reps: 0 },
    });
    const result = reportEngine.render(data, "technical", "html");
    expect(result).toContain("Technical");
  });

  it("handles very large duration", () => {
    const data = sampleData({
      session: { ...sampleData().session, duration: 99999 },
    });
    const result = reportEngine.render(data, "executive", "html");
    expect(result).toContain("Executive");
  });
});
