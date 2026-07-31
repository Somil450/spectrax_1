import React from "react";

interface InfoPageProps {
  onBack: () => void;
}

const backButtonStyle: React.CSSProperties = {
  height: "40px",
  width: "130px",
  background: "var(--neon-cyan)",
  color: "var(--bg-primary)",
  borderRadius: "7px",
  fontWeight: 500,
  fontSize: "15px",
  borderColor: "white",
  cursor: "pointer",
};

const titleStyle: React.CSSProperties = {
  background: "rgba(0,255,200,0.1)",
  border: "1px solid rgba(0,255,200,0.3)",
  outline: "none",
  color: "#fff",
  fontSize: "0.9rem",
  fontWeight: 700,
  width: "100%",
  padding: "6px 8px",
  borderRadius: "6px",
  boxSizing: "border-box",
};

const panelStyle: React.CSSProperties = {
  boxShadow:
    "0 0 28px rgba(168, 85, 247, 0.5), 0 0 60px rgba(168, 85, 247, 0.2)",
};

export function FeaturesPage({ onBack }: InfoPageProps) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <button onClick={onBack} style={backButtonStyle}>
        ← Back to Home
      </button>
      <h1 style={titleStyle}>Features</h1>
      <p className="text-gray-500 mb-8">Last Updated: July 2026</p>

      <section>
        <p style={{ fontSize: "25px", background: "rgba(0,255,200,0.1)" }}>
          SpectraX uses your camera and pose estimation to turn exercise into a
          real-time, gamified experience — no wearable required.
        </p>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">Real-Time Pose Tracking</h2>
          <ul className="list-disc pl-6">
            <li>AI-powered body landmark detection via the camera</li>
            <li>3D skeleton rendering with live form feedback</li>
            <li>Body-type calibration that adapts tracking to your build</li>
          </ul>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">Exercise & Form Analysis</h2>
          <ul className="list-disc pl-6">
            <li>Multiple supported exercises (squat, pushup, bicep curl, and more)</li>
            <li>Automatic exercise detection</li>
            <li>Rep counting and accuracy/form scoring per rep</li>
          </ul>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">Workout & Progress Tracking</h2>
          <ul className="list-disc pl-6">
            <li>Calorie estimation, session summaries, and workout history</li>
            <li>XP, levels, badges, and streaks to keep you motivated</li>
            <li>Workout plans and tutorials</li>
          </ul>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">Privacy-First Design</h2>
          <ul className="list-disc pl-6">
            <li>Camera processing happens locally in the browser</li>
            <li>Offline mode with local session storage and sync when you reconnect</li>
            <li>Firestore security rules to protect your workout data</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

export function UsagePage({ onBack }: InfoPageProps) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <button onClick={onBack} style={backButtonStyle}>
        ← Back to Home
      </button>
      <h1 style={titleStyle}>Usage</h1>
      <p className="text-gray-500 mb-8">Last Updated: July 2026</p>

      <section>
        <p style={{ fontSize: "25px", background: "rgba(0,255,200,0.1)" }}>
          Get started with SpectraX in four simple steps.
        </p>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">1. Pick an Exercise</h2>
          <p>
            Choose an exercise from the home screen, or let SpectraX auto-detect
            the movement you are about to perform.
          </p>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">2. Calibrate</h2>
          <p>
            Stand in view of your camera and follow the calibration screen. Step
            back until your full body is visible so the app can align the pose
            model to your body type.
          </p>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">3. Work Out</h2>
          <p>
            Perform the exercise in real time. Watch your reps count, form score
            update, and the 3D skeleton mirror your movement. Keep your full body
            in frame and maintain good lighting for the best accuracy.
          </p>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">4. Review & Track</h2>
          <p>
            End the session to see your summary: reps, duration, calories, and
            accuracy. Progress is saved to your profile, history, badges, and
            streaks, and syncs when you are back online.
          </p>
        </div>
      </section>
    </main>
  );
}

export function ApiPage({ onBack }: InfoPageProps) {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <button onClick={onBack} style={backButtonStyle}>
        ← Back to Home
      </button>
      <h1 style={titleStyle}>API</h1>
      <p className="text-gray-500 mb-8">Last Updated: July 2026</p>

      <section>
        <p style={{ fontSize: "25px", background: "rgba(0,255,200,0.1)" }}>
          SpectraX exposes a lightweight server API for session management and
          real-time collaboration.
        </p>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">Sessions</h2>
          <ul className="list-disc pl-6">
            <li>POST /api/sessions — create a new workout session</li>
            <li>GET /api/sessions/:id — fetch session details</li>
            <li>WebSocket /ws/sessions/:id — real-time rep and form updates</li>
          </ul>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">Authentication</h2>
          <ul className="list-disc pl-6">
            <li>Firebase Auth tokens are required for protected routes</li>
            <li>Tokens are passed via a secure header, never in the URL</li>
          </ul>
        </div>

        <div style={panelStyle}>
          <h2 className="text-2xl font-semibold mb-2">Data & Privacy</h2>
          <ul className="list-disc pl-6">
            <li>Workout records persist to Firestore</li>
            <li>Firestore security rules enforce per-user access</li>
            <li>Offline queues replay pending writes on reconnect</li>
          </ul>
        </div>

        <p className="mt-6">
          For the full developer reference, see the project README and the
          source code on GitHub.
        </p>
      </section>
    </main>
  );
}
