import { useState, useRef, useEffect } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { CalibrationScreen } from "./components/CalibrationScreen";
import { WorkoutScreen } from "./components/WorkoutScreen";
import { SummaryScreen } from "./components/SummaryScreen";
import { ReplayScreen } from "./components/ReplayScreen";
import { TrophyRoom } from "./components/TrophyRoom";
import { BadgeNotification } from "./components/BadgeNotification";
import { exercises, ExerciseConfig } from "./config/exercises";
import { BodyType } from "./services/bodyTypeEngine";
import { useTheme } from "./context/ThemeContext";
import HistoryPage from "./HistoryPage";
import { SummaryScreenSkeleton } from "./components/SummaryScreenSkeleton";
import { useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/LoginScreen";
import { SignUpScreen } from "./components/SignUpScreen";
import { ForgotPasswordScreen } from "./components/ForgotPasswordScreen";
import { useBadges } from "./hooks/useBadges";

// ─── FSM ──────────────────────────────────────────────────────────────────────
type AppState = "welcome" | "calibration" | "workout" | "summary" | "replay" | "history" | "trophy";
type AuthScreen = "login" | "signup" | "forgot-password";

// Only these edges are legal. Anything else is a no-op.
const TRANSITIONS: Record<AppState, AppState[]> = {
  welcome:     ["calibration", "history", "trophy"],
  calibration: ["workout", "welcome"],
  workout:     ["summary"],
  summary:     ["welcome", "replay"],
  replay:      ["summary"],
  history:     ["welcome"],
  trophy:      ["welcome"],
};

interface WorkoutStats {
  reps: number;
  totalReps: number;
  correctReps: number;
  repScores: number[];
  duration: number;
  accuracy: number;
  exerciseName: string;
  mistakes: Record<string, number>;
  bestStreak: number;
  tags?: string[];
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();

  const [state, setState] = useState<AppState>("welcome");
  const [authScreen, setAuthScreen] = useState<AuthScreen>("login");

  const [selectedExercise, setSelectedExercise] = useState<ExerciseConfig>(exercises.squat);
  const [bodyType, setBodyType] = useState<BodyType>("scanning");
  const [stats, setStats] = useState<WorkoutStats>({
    reps: 0,
    totalReps: 0,
    correctReps: 0,
    repScores: [],
    duration: 0,
    accuracy: 0,
    exerciseName: exercises.squat.name,
    mistakes: {},
    bestStreak: 0,
  });

  const { newlyEarned, clearNewlyEarned, checkAndAwardBadges } = useBadges();
  const [statsLoading, setStatsLoading] = useState(false);
  const lastSwitchTime = useRef<number>(0);
  const prevState = useRef<AppState>(state);

  const go = (next: AppState) => {
    if (!TRANSITIONS[state]?.includes(next)) {
      console.warn(`invalid transition: ${state} → ${next}`);
      return;
    }
    setState(next);
  };

  // Camera / WebGL cleanup when leaving workout — WorkoutScreen unmounts and
  // handles its own teardown, but this catches any app-level resources.
  useEffect(() => {
    if (prevState.current === "workout" && state !== "workout") {
      // workout exited — app-level cleanup goes here if needed
    }
    prevState.current = state;
  }, [state]);

  const handleWorkoutEnd = (finalStats: Omit<WorkoutStats, "exerciseName"> & { tags?: string[] }) => {
    setStatsLoading(true);
    setStats({ ...finalStats, exerciseName: selectedExercise.name });
    go("summary");
    checkAndAwardBadges({
      totalReps: finalStats.totalReps,
      accuracy: finalStats.accuracy,
      exerciseName: selectedExercise.name,
      bestStreak: finalStats.bestStreak,
    });
    setTimeout(() => setStatsLoading(false), 1500);
  };

  const handleAutoDetect = (exerciseKey: string) => {
    const now = Date.now();
    if (now - lastSwitchTime.current < 5000) return;
    if (exercises[exerciseKey] && selectedExercise.key !== exerciseKey) {
      console.log(`CLIP: Auto-switching to ${exerciseKey.toUpperCase()}`);
      lastSwitchTime.current = now;
      setSelectedExercise(exercises[exerciseKey]);
    }
  };

  const handleSelectExercise = (key: string) => {
    if (exercises[key]) setSelectedExercise(exercises[key]);
  };

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <main className="spectrax-app">
        {authScreen === "login" && (
          <LoginScreen
            onLoginSuccess={() => setState("welcome")}
            onSignUpClick={() => setAuthScreen("signup")}
            onForgotPasswordClick={() => setAuthScreen("forgot-password")}
          />
        )}
        {authScreen === "signup" && (
          <SignUpScreen
            onSignUpSuccess={() => setState("welcome")}
            onLoginClick={() => setAuthScreen("login")}
          />
        )}
        {authScreen === "forgot-password" && (
          <ForgotPasswordScreen onBack={() => setAuthScreen("login")} />
        )}
      </main>
    );
  }

  return (
    <main className="spectrax-app" style={{ background: "var(--bg-primary)", minHeight: "100vh" }}>
      <button
        onClick={toggleTheme}
        className={`theme-toggle ${state === "workout" ? "workout-active" : ""}`}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "☾ Dark Mode" : "☀ Light Mode"}
      </button>

      {state === "welcome" && (
        <WelcomeScreen
          onStart={() => go("calibration")}
          onViewHistory={() => go("history")}
          onViewTrophies={() => go("trophy")}
        />
      )}

      {state === "calibration" && (
        <CalibrationScreen
          selectedExercise={selectedExercise}
          onSelectExercise={handleSelectExercise}
          onNext={() => go("workout")}
          onBack={() => go("welcome")}
          onBodyTypeDetected={setBodyType}
        />
      )}

      {state === "workout" && (
        <WorkoutScreen
          exercise={selectedExercise}
          onEnd={handleWorkoutEnd}
          onAutoDetect={handleAutoDetect}
          bodyType={bodyType}
        />
      )}

      {state === "summary" &&
        (statsLoading ? (
          <SummaryScreenSkeleton />
        ) : (
          <SummaryScreen
            stats={stats}
            onRestart={() => go("welcome")}
            onViewReplay={() => go("replay")}
          />
        ))}

      {state === "replay" && (
        <ReplayScreen onBack={() => go("summary")} stats={stats} />
      )}

      {state === "history" && (
        <HistoryPage onBack={() => go("welcome")} />
      )}

      {state === "trophy" && (
        <TrophyRoom onBack={() => go("welcome")} />
      )}

      <BadgeNotification badge={newlyEarned} onClose={clearNewlyEarned} />
    </main>
  );
}

export default App;
