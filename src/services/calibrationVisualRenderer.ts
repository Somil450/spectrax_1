/**
 * calibrationVisualRenderer.ts
 *
 * Maps calibration state to visual presentation elements.
 * Responsible for:
 * - Converting state to colors
 * - Converting state to user messages
 * - Converting state to UI indicators
 *
 * This module is 100% testable and independent of React/UI rendering.
 */

import type { CalibrationState } from "./calibrationStateEngine";

/**
 * Visual status levels
 */
export type VisualStatus = "error" | "warning" | "success";

/**
 * Complete visual output for UI rendering
 */
export interface CalibrationVisuals {
  /** Color for UI elements (CSS variable reference) */
  color: "var(--neon-red)" | "var(--neon-yellow)" | "var(--neon-green)";

  /** Status level for styling */
  status: VisualStatus;

  /** Main message for user */
  primaryMessage: string;

  /** Secondary message for context */
  secondaryMessage: string;

  /** Progress indicator (0-100) */
  progressPercent: number;

  /** Is state actionable? */
  isInteractive: boolean;

  /** Suggested action for user */
  actionHint: string;
}

/**
 * CalibrationVisualRenderer - Pure visual calculation logic
 * No external dependencies, fully testable
 */
export class CalibrationVisualRenderer {
  /**
   * Convert calibration state to visual elements
   */
  render(state: CalibrationState): CalibrationVisuals {
    // Route to appropriate visual based on state reason
    switch (state.reason) {
      case "no_body_detected":
        return this.renderNoBodyDetected();

      case "insufficient_visibility":
        return this.renderInsufficientVisibility(state);

      case "not_centered":
        return this.renderNotCentered(state);

      case "calibration_ready":
        return this.renderCalibrationReady(state);

      default:
        return this.renderDefault();
    }
  }

  /**
   * No body detected in frame
   */
  private renderNoBodyDetected(): CalibrationVisuals {
    return {
      color: "var(--neon-red)",
      status: "error",
      primaryMessage: "No body detected. Step into frame.",
      secondaryMessage: "Position yourself in the center of the camera view.",
      progressPercent: 0,
      isInteractive: false,
      actionHint: "Move closer to the camera",
    };
  }

  /**
   * Body partially visible or joints not detected
   */
  private renderInsufficientVisibility(
    state: CalibrationState,
  ): CalibrationVisuals {
    const percent = state.visibilityPercent;

    if (percent < 25) {
      return {
        color: "var(--neon-red)",
        status: "error",
        primaryMessage: "Step back. Full body must be visible.",
        secondaryMessage: `${state.visibleCount}/${state.totalCount} joints detected`,
        progressPercent: percent,
        isInteractive: false,
        actionHint: "Move to show your full body",
      };
    }

    return {
      color: "var(--neon-yellow)",
      status: "warning",
      primaryMessage: "Adjust position. Ankles or knees not clear.",
      secondaryMessage: `${state.visibleCount}/${state.totalCount} joints detected`,
      progressPercent: percent,
      isInteractive: false,
      actionHint: "Move to show all body parts",
    };
  }

  /**
   * Body visible but not centered
   */
  private renderNotCentered(state: CalibrationState): CalibrationVisuals {
    const direction = state.centerX < 0.5 ? "right" : "left";

    return {
      color: "var(--neon-yellow)",
      status: "warning",
      primaryMessage: "Center your body in the frame.",
      secondaryMessage: `Move ${direction} to center yourself`,
      progressPercent: state.visibilityPercent,
      isInteractive: false,
      actionHint: `Shift your body to the ${direction}`,
    };
  }

  /**
   * Calibration complete and ready
   */
  private renderCalibrationReady(state: CalibrationState): CalibrationVisuals {
    return {
      color: "var(--neon-green)",
      status: "success",
      primaryMessage: "Good position. Calibration complete.",
      secondaryMessage:
        "Hold this position while the system analyzes your form.",
      progressPercent: 100,
      isInteractive: true,
      actionHint: "Raise both hands to begin",
    };
  }

  /**
   * Default/unknown state
   */
  private renderDefault(): CalibrationVisuals {
    return {
      color: "var(--neon-yellow)",
      status: "warning",
      primaryMessage: "Initializing system...",
      secondaryMessage: "Please wait while the AI engine warms up.",
      progressPercent: 0,
      isInteractive: false,
      actionHint: "",
    };
  }

  /**
   * Get background color with opacity
   */
  getBackgroundColor(status: VisualStatus): string {
    switch (status) {
      case "error":
        return "rgba(255, 59, 92, 0.1)";
      case "warning":
        return "rgba(255, 193, 7, 0.1)";
      case "success":
        return "rgba(76, 175, 80, 0.1)";
      default:
        return "rgba(13, 17, 39, 0.9)";
    }
  }

  /**
   * Get glow effect color
   */
  getGlowColor(color: CalibrationVisuals["color"]): string {
    switch (color) {
      case "var(--neon-red)":
        return "rgba(255, 59, 92, 0.3)";
      case "var(--neon-yellow)":
        return "rgba(255, 193, 7, 0.3)";
      case "var(--neon-green)":
        return "rgba(76, 175, 80, 0.3)";
      default:
        return "rgba(0, 240, 255, 0.3)";
    }
  }

  /**
   * Get border color
   */
  getBorderColor(status: VisualStatus): string {
    switch (status) {
      case "error":
        return "1px solid var(--neon-red)";
      case "warning":
        return "1px solid var(--neon-yellow)";
      case "success":
        return "1px solid var(--neon-green)";
      default:
        return "1px solid var(--neon-cyan)";
    }
  }

  /**
   * Get progress bar color
   */
  getProgressBarColor(status: VisualStatus): string {
    switch (status) {
      case "error":
        return "var(--neon-red)";
      case "warning":
        return "var(--neon-yellow)";
      case "success":
        return "var(--neon-green)";
      default:
        return "var(--neon-cyan)";
    }
  }
}

/**
 * Singleton instance
 */
export const calibrationVisualRenderer = new CalibrationVisualRenderer();
