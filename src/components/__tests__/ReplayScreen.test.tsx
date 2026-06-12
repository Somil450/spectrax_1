import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { ReplayScreen } from "../ReplayScreen";

vi.mock("../../services/sessionRecorder", () => ({
  sessionRecorder: { frames: [] },
}));

vi.mock("../Replay3DModel", () => ({
  Replay3DModel: () => <div data-testid="replay-3d-model" />,
}));

describe("ReplayScreen", () => {
  const defaultProps = {
    onBack: vi.fn(),
    stats: { accuracy: 85, reps: 10, exerciseName: "Squat" },
  };

  it("renders the 3D replay area", () => {
    render(<ReplayScreen {...defaultProps} />);
    expect(screen.getByTestId("replay-3d-model")).toBeDefined();
  });

  it("renders the EXIT REPLAY button with text label", () => {
    render(<ReplayScreen {...defaultProps} />);
    const exitButton = screen.getByText("EXIT REPLAY");
    expect(exitButton).toBeDefined();
  });

  it("renders the PLAY/PAUSE button with text label", () => {
    render(<ReplayScreen {...defaultProps} />);
    const playButton = screen.getByText("PLAY");
    expect(playButton).toBeDefined();
  });

  it("renders the session header with exercise name", () => {
    render(<ReplayScreen {...defaultProps} />);
    expect(screen.getByText(/SQUAT/)).toBeDefined();
  });

  it("renders the 3D SPATIAL REPLAY header", () => {
    render(<ReplayScreen {...defaultProps} />);
    expect(screen.getByText("3D SPATIAL REPLAY")).toBeDefined();
  });

  it("renders the frame counter", () => {
    render(<ReplayScreen {...defaultProps} />);
    const counter = screen.getByText(/000 \/ 000/);
    expect(counter).toBeDefined();
  });

  it("renders play button with aria-label", () => {
    render(<ReplayScreen {...defaultProps} />);
    const button = screen.getByLabelText("Play replay");
    expect(button).toBeDefined();
  });

  it("has responsive CSS class on panel", () => {
    const { container } = render(<ReplayScreen {...defaultProps} />);
    const leftPanel = container.querySelector(".replay-panel-left");
    expect(leftPanel).toBeDefined();
    const rightPanel = container.querySelector(".replay-panel-right");
    expect(rightPanel).toBeDefined();
  });
});
