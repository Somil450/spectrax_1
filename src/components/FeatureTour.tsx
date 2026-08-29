import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";

const TOUR_COMPLETED_KEY = "spectrax_feature_tour_completed";

const steps: Step[] = [
  {
    target: "body",
    content: (
      <div>
        <h3>Welcome to SpectraX Track!</h3>
        <p>
          Your AI-powered fitness companion that uses your camera to track
          exercises, count reps, and provide real-time form feedback.
        </p>
      </div>
    ),
    placement: "center" as const,
    disableBeacon: true,
  },
  {
    target: ".theme-selector-segmented",
    content: (
      <div>
        <h3>Choose Your Theme</h3>
        <p>
          Switch between Cyber-dark, Retro, and Light themes to match your
          workout vibe.
        </p>
      </div>
    ),
    placement: "bottom" as const,
  },
  {
    target: ".nav-bar",
    content: (
      <div>
        <h3>Navigation</h3>
        <p>
          Access your profile, history, trophies, fitness tools, tutorials, and
          more from the navigation bar.
        </p>
      </div>
    ),
    placement: "bottom" as const,
  },
  {
    target: ".exercise-selector",
    content: (
      <div>
        <h3>Select an Exercise</h3>
        <p>
          Choose from Squats, Push-ups, Jumping Jacks, Bicep Curls, and more.
          Each exercise has its own rep counter and accuracy tracking.
        </p>
      </div>
    ),
    placement: "right" as const,
  },
  {
    target: ".start-workout-btn",
    content: (
      <div>
        <h3>Start Your Workout</h3>
        <p>
          Click here to begin tracking. Position yourself so your full body is
          visible in the camera preview before starting.
        </p>
      </div>
    ),
    placement: "left" as const,
  },
  {
    target: ".health-metrics",
    content: (
      <div>
        <h3>Real-Time Metrics</h3>
        <p>
          Watch your rep count, accuracy score, calories burned, and form status
          update live as you exercise.
        </p>
      </div>
    ),
    placement: "left" as const,
  },
];

export function FeatureTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!completed) {
      const timer = setTimeout(() => setRun(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  function handleJoyrideCallback(data: CallBackProps) {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
      setRun(false);
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      callback={handleJoyrideCallback}
      continuous
      showProgress
      showSkipButton
      styles={{
        options: {
          primaryColor: "#00f0ff",
          textColor: "#e0e0e0",
          backgroundColor: "#1a1a2e",
          arrowColor: "#1a1a2e",
          overlayColor: "rgba(0, 0, 0, 0.6)",
        },
        tooltipContainer: {
          textAlign: "left" as const,
        },
        buttonNext: {
          backgroundColor: "#00f0ff",
          color: "#0a0a1a",
        },
        buttonBack: {
          color: "#00f0ff",
          marginRight: 8,
        },
        buttonSkip: {
          color: "#888",
        },
      }}
      locale={{
        last: "Done",
        skip: "Skip Tour",
      }}
    />
  );
}
