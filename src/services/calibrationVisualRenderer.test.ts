
/**
 * calibrationVisualRenderer.test.ts
 *
 * 100% test coverage for calibration visual rendering
 * Tests all state-to-visual mappings
 */

import {
  CalibrationVisualRenderer,
  CalibrationVisuals,
} from "./calibrationVisualRenderer";
import type { CalibrationState } from "./calibrationStateEngine";

/**
 * Helper to create mock calibration state
 */
function createMockState(
  reason: CalibrationState["reason"],
  overrides: Partial<CalibrationState> = {},
): CalibrationState {
  const defaults: CalibrationState = {
    isReady: reason === "calibration_ready",
    visibleCount: 8,
    totalCount: 8,
    visibilityPercent: 100,
    isCentered: reason === "calibration_ready",
    centerX: 0.5,
    reason,
  };

  return { ...defaults, ...overrides };
}

describe("CalibrationVisualRenderer", () => {
  let renderer: CalibrationVisualRenderer;

  beforeEach(() => {
    renderer = new CalibrationVisualRenderer();
  });

  describe("No Body Detection", () => {
    test("should render red status for no body detected", () => {
      const state = createMockState("no_body_detected");
      const visuals = renderer.render(state);

      expect(visuals.status).toBe("error");
      expect(visuals.color).toBe("var(--neon-red)");
    });

    test("should show appropriate message for no body detected", () => {
      const state = createMockState("no_body_detected");
      const visuals = renderer.render(state);

      expect(visuals.primaryMessage).toContain("No body detected");
      expect(visuals.primaryMessage).toContain("Step into frame");
      expect(visuals.secondaryMessage).toContain("camera view");
    });

    test("should not be interactive when no body detected", () => {
      const state = createMockState("no_body_detected");
      const visuals = renderer.render(state);

      expect(visuals.isInteractive).toBe(false);
    });

    test("should show 0% progress for no body detected", () => {
      const state = createMockState("no_body_detected");
      const visuals = renderer.render(state);

      expect(visuals.progressPercent).toBe(0);
    });

    test("should suggest moving closer", () => {
      const state = createMockState("no_body_detected");
      const visuals = renderer.render(state);

      expect(visuals.actionHint).toContain("camera");
    });
  });

  describe("Insufficient Visibility", () => {
    test("should render red status for very low visibility (< 25%)", () => {
      const state = createMockState("insufficient_visibility", {
        visibleCount: 1,
        visibilityPercent: 12,
      });
      const visuals = renderer.render(state);

      expect(visuals.status).toBe("error");
      expect(visuals.color).toBe("var(--neon-red)");
    });

    test("should render yellow status for partial visibility (25-75%)", () => {
      const state = createMockState("insufficient_visibility", {
        visibleCount: 4,
        visibilityPercent: 50,
      });
      const visuals = renderer.render(state);

      expect(visuals.status).toBe("warning");
      expect(visuals.color).toBe("var(--neon-yellow)");
    });

    test("should show step back message for very low visibility", () => {
      const state = createMockState("insufficient_visibility", {
        visibleCount: 1,
        visibilityPercent: 12,
      });
      const visuals = renderer.render(state);

      expect(visuals.primaryMessage).toContain("Step back");
      expect(visuals.primaryMessage).toContain("Full body");
    });

    test("should show ankle/knee message for partial visibility", () => {
      const state = createMockState("insufficient_visibility", {
        visibleCount: 5,
        visibilityPercent: 62,
      });
      const visuals = renderer.render(state);

      expect(visuals.primaryMessage).toContain("Adjust position");
      expect(visuals.primaryMessage).toContain("Ankles or knees");
    });

    test("should display visible joint count in secondary message", () => {
      const state = createMockState("insufficient_visibility", {
        visibleCount: 5,
        visibilityPercent: 62,
      });
      const visuals = renderer.render(state);

      expect(visuals.secondaryMessage).toContain("5");
      expect(visuals.secondaryMessage).toContain("8");
    });

    test("should not be interactive with insufficient visibility", () => {
      const state = createMockState("insufficient_visibility", {
        visibleCount: 4,
        visibilityPercent: 50,
      });
      const visuals = renderer.render(state);

      expect(visuals.isInteractive).toBe(false);
    });

    test("should reflect progress as visibility percent", () => {
      const testCases = [
        { visibilityPercent: 25, expected: 25 },
        { visibilityPercent: 50, expected: 50 },
        { visibilityPercent: 75, expected: 75 },
      ];

      testCases.forEach(({ visibilityPercent, expected }) => {
        const state = createMockState("insufficient_visibility", {
          visibilityPercent,
        });
        const visuals = renderer.render(state);

        expect(visuals.progressPercent).toBe(expected);
      });
    });
  });

  describe("Not Centered", () => {
    test("should render yellow status for not centered", () => {
      const state = createMockState("not_centered", { isCentered: false });
      const visuals = renderer.render(state);

      expect(visuals.status).toBe("warning");
      expect(visuals.color).toBe("var(--neon-yellow)");
    });

    test("should show center body message", () => {
      const state = createMockState("not_centered", { isCentered: false });
      const visuals = renderer.render(state);

      expect(visuals.primaryMessage).toContain("Center your body");
    });

    test("should suggest moving right when center is too left", () => {
      const state = createMockState("not_centered", {
        isCentered: false,
        centerX: 0.1,
      });
      const visuals = renderer.render(state);

      expect(visuals.secondaryMessage).toContain("right");
      expect(visuals.actionHint).toContain("right");
    });

    test("should suggest moving left when center is too right", () => {
      const state = createMockState("not_centered", {
        isCentered: false,
        centerX: 0.9,
      });
      const visuals = renderer.render(state);

      expect(visuals.secondaryMessage).toContain("left");
      expect(visuals.actionHint).toContain("left");
    });

    test("should not be interactive when not centered", () => {
      const state = createMockState("not_centered", { isCentered: false });
      const visuals = renderer.render(state);

      expect(visuals.isInteractive).toBe(false);
    });

    test("should reflect visibility progress", () => {
      const state = createMockState("not_centered", {
        isCentered: false,
        visibilityPercent: 85,
      });
      const visuals = renderer.render(state);

      expect(visuals.progressPercent).toBe(85);
    });
  });

  describe("Calibration Ready", () => {
    test("should render green status when calibration ready", () => {
      const state = createMockState("calibration_ready");
      const visuals = renderer.render(state);

      expect(visuals.status).toBe("success");
      expect(visuals.color).toBe("var(--neon-green)");
    });

    test("should show calibration complete message", () => {
      const state = createMockState("calibration_ready");
      const visuals = renderer.render(state);

      expect(visuals.primaryMessage).toContain("Good position");
      expect(visuals.primaryMessage).toContain("Calibration complete");
    });

    test("should show instruction to hold position", () => {
      const state = createMockState("calibration_ready");
      const visuals = renderer.render(state);

      expect(visuals.secondaryMessage).toContain("Hold this position");
      expect(visuals.secondaryMessage).toContain("analyzes");
    });

    test("should be interactive when calibration ready", () => {
      const state = createMockState("calibration_ready");
      const visuals = renderer.render(state);

      expect(visuals.isInteractive).toBe(true);
    });

    test("should show 100% progress when calibration ready", () => {
      const state = createMockState("calibration_ready");
      const visuals = renderer.render(state);

      expect(visuals.progressPercent).toBe(100);
    });

    test("should show action hint to raise hands", () => {
      const state = createMockState("calibration_ready");
      const visuals = renderer.render(state);

      expect(visuals.actionHint).toContain("Raise both hands");
    });
  });

  describe("Default State", () => {
    test("should handle unknown reason with default visuals", () => {
      const state = createMockState("calibration_ready" as any);
      // Directly set invalid reason to test default case
      (state.reason as any) = "unknown_reason";

      const visuals = renderer.render(state);

      expect(visuals.primaryMessage).toContain("Initializing");
      expect(visuals.progressPercent).toBe(0);
    });
  });

  describe("CSS Color Utilities", () => {
    test("should return correct background color for error status", () => {
      const color = renderer.getBackgroundColor("error");
      expect(color).toBe("rgba(255, 59, 92, 0.1)");
    });

    test("should return correct background color for warning status", () => {
      const color = renderer.getBackgroundColor("warning");
      expect(color).toBe("rgba(255, 193, 7, 0.1)");
    });

    test("should return correct background color for success status", () => {
      const color = renderer.getBackgroundColor("success");
      expect(color).toBe("rgba(76, 175, 80, 0.1)");
    });

    test("should return default background color for unknown status", () => {
      const color = renderer.getBackgroundColor("unknown" as any);
      expect(color).toBe("rgba(13, 17, 39, 0.9)");
    });
  });

  describe("Glow Effect Utilities", () => {
    test("should return red glow for red color", () => {
      const glow = renderer.getGlowColor("var(--neon-red)");
      expect(glow).toBe("rgba(255, 59, 92, 0.3)");
    });

    test("should return yellow glow for yellow color", () => {
      const glow = renderer.getGlowColor("var(--neon-yellow)");
      expect(glow).toBe("rgba(255, 193, 7, 0.3)");
    });

    test("should return green glow for green color", () => {
      const glow = renderer.getGlowColor("var(--neon-green)");
      expect(glow).toBe("rgba(76, 175, 80, 0.3)");
    });

    test("should return cyan glow for unknown color", () => {
      const glow = renderer.getGlowColor("var(--unknown)" as any);
      expect(glow).toBe("rgba(0, 240, 255, 0.3)");
    });
  });

  describe("Border Color Utilities", () => {
    test("should return red border for error status", () => {
      const border = renderer.getBorderColor("error");
      expect(border).toBe("1px solid var(--neon-red)");
    });

    test("should return yellow border for warning status", () => {
      const border = renderer.getBorderColor("warning");
      expect(border).toBe("1px solid var(--neon-yellow)");
    });

    test("should return green border for success status", () => {
      const border = renderer.getBorderColor("success");
      expect(border).toBe("1px solid var(--neon-green)");
    });

    test("should return cyan border for unknown status", () => {
      const border = renderer.getBorderColor("unknown" as any);
      expect(border).toBe("1px solid var(--neon-cyan)");
    });
  });

  describe("Progress Bar Color Utilities", () => {
    test("should return red progress bar for error status", () => {
      const color = renderer.getProgressBarColor("error");
      expect(color).toBe("var(--neon-red)");
    });

    test("should return yellow progress bar for warning status", () => {
      const color = renderer.getProgressBarColor("warning");
      expect(color).toBe("var(--neon-yellow)");
    });

    test("should return green progress bar for success status", () => {
      const color = renderer.getProgressBarColor("success");
      expect(color).toBe("var(--neon-green)");
    });

    test("should return cyan progress bar for unknown status", () => {
      const color = renderer.getProgressBarColor("unknown" as any);
      expect(color).toBe("var(--neon-cyan)");
    });
  });

  describe("Visual Output Consistency", () => {
    test("should have consistent color scheme across all outputs", () => {
      const state = createMockState("no_body_detected");
      const visuals = renderer.render(state);

      const bgColor = renderer.getBackgroundColor(visuals.status);
      const glowColor = renderer.getGlowColor(visuals.color);
      const borderColor = renderer.getBorderColor(visuals.status);
      const progressColor = renderer.getProgressBarColor(visuals.status);

      // All should use red theme
      expect(visuals.color).toBe("var(--neon-red)");
      expect(bgColor).toContain("255, 59, 92");
      expect(glowColor).toContain("255, 59, 92");
      expect(borderColor).toContain("--neon-red");
      expect(progressColor).toBe("var(--neon-red)");
    });

    test("should have different colors for different states", () => {
      const errorState = createMockState("no_body_detected");
      const warningState = createMockState("insufficient_visibility");
      const successState = createMockState("calibration_ready");

      const errorVisuals = renderer.render(errorState);
      const warningVisuals = renderer.render(warningState);
      const successVisuals = renderer.render(successState);

      expect(errorVisuals.color).not.toBe(warningVisuals.color);
      expect(warningVisuals.color).not.toBe(successVisuals.color);
      expect(errorVisuals.color).not.toBe(successVisuals.color);
    });
  });

  describe("Edge Cases", () => {
    test("should handle zero visibility percent", () => {
      const state = createMockState("insufficient_visibility", {
        visibilityPercent: 0,
      });
      const visuals = renderer.render(state);

      expect(visuals.progressPercent).toBe(0);
    });

    test("should handle very high visibility that is not ready", () => {
      const state = createMockState("not_centered", {
        visibilityPercent: 95,
      });
      const visuals = renderer.render(state);

      expect(visuals.progressPercent).toBe(95);
      expect(visuals.isInteractive).toBe(false);
    });

    test("should handle extreme centerX values", () => {
      const leftState = createMockState("not_centered", { centerX: 0.05 });
      const rightState = createMockState("not_centered", { centerX: 0.95 });

      const leftVisuals = renderer.render(leftState);
      const rightVisuals = renderer.render(rightState);

      expect(leftVisuals.secondaryMessage).toContain("right");
      expect(rightVisuals.secondaryMessage).toContain("left");
    });

    test("should have non-empty messages for all states", () => {
      const reasons: CalibrationState["reason"][] = [
        "no_body_detected",
        "insufficient_visibility",
        "not_centered",
        "calibration_ready",
      ];

      reasons.forEach((reason) => {
        const state = createMockState(reason);
        const visuals = renderer.render(state);

        expect(visuals.primaryMessage.length).toBeGreaterThan(0);
        expect(visuals.secondaryMessage.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Numeric Properties", () => {
    test("should have progressPercent between 0 and 100", () => {
      const reasons: CalibrationState["reason"][] = [
        "no_body_detected",
        "insufficient_visibility",
        "not_centered",
        "calibration_ready",
      ];

      reasons.forEach((reason) => {
        const state = createMockState(reason);
        const visuals = renderer.render(state);

        expect(visuals.progressPercent).toBeGreaterThanOrEqual(0);
        expect(visuals.progressPercent).toBeLessThanOrEqual(100);
      });
    });

    test("should have valid status values", () => {
      const reasons: CalibrationState["reason"][] = [
        "no_body_detected",
        "insufficient_visibility",
        "not_centered",
        "calibration_ready",
      ];

      const validStatuses = ["error", "warning", "success"];

      reasons.forEach((reason) => {
        const state = createMockState(reason);
        const visuals = renderer.render(state);

        expect(validStatuses).toContain(visuals.status);
      });
    });
  });
});
