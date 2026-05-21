import { useState, useRef } from "react";
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
import { useLeveling } from './hooks/useLeveling';
import { SummaryScreenSkeleton } from "./components/SummaryScreenSkeleton";
import { useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/LoginScreen";
import { SignUpScreen } from "./components/SignUpScreen";
import { ForgotPasswordScreen } from "./components/ForgotPasswordScreen";
import { useBadges } from "./hooks/useBadges";


type Screen =
  | "welcome"
  | "calibration"
  | "workout"
  | "summary"
  | "replay"
  | "history"
  | "trophy"
  | "login"
  | "signup"
  | "forgot-password";

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
  gainedXp?: number;
}

function App() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");
  const [selectedExercise, setSelectedExercise] = useState<ExerciseConfig>(
    exercises.squat,
  );
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
  const leveling = useLeveling();

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleWorkoutEnd = (
    finalStats: Omit<WorkoutStats, "exerciseName"> & { tags?: string[] },
  ) => {
    setStatsLoading(true);
    const gainedXp = leveling.addXpFromReps(finalStats.reps);
    const fullStats = { ...finalStats, exerciseName: selectedExercise.name, gainedXp };
    setStats(fullStats);
    navigateTo("summary");

    // Award badges based on completed session
    checkAndAwardBadges({
      totalReps: finalStats.totalReps,
      accuracy: finalStats.accuracy,
      exerciseName: selectedExercise.name,
      bestStreak: finalStats.bestStreak,
    });

    // Show skeleton briefly before rendering real summary
    setTimeout(() => {
      setStatsLoading(false);
    }, 1500);
  };

  const handleAutoDetect = (exerciseKey: string) => {
    const now = Date.now();
    // 5-second cooldown
    if (now - lastSwitchTime.current < 5000) return;

    if (exercises[exerciseKey] && selectedExercise.key !== exerciseKey) {
      console.log(`CLIP: Auto-switching to ${exerciseKey.toUpperCase()}`);
      lastSwitchTime.current = now;
      setSelectedExercise(exercises[exerciseKey]);
    }
  };

  const handleSelectExercise = (key: string) => {
    if (exercises[key]) {
      setSelectedExercise(exercises[key]);
    }
  };

  // Skip auth gate when Firebase is not configured (no .env)
  const firebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

  // Show loading state while auth is being checked
  if (firebaseConfigured && authLoading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // If not authenticated and Firebase is configured, show auth screens
  if (firebaseConfigured && !user) {
    const activeAuthScreen = ["login", "signup", "forgot-password"].includes(currentScreen)
      ? currentScreen
      : "login";
    return (
      <main className="spectrax-app">
        {activeAuthScreen === "login" && (
          <LoginScreen
            onLoginSuccess={() => navigateTo("welcome")}
            onSignUpClick={() => navigateTo("signup")}
            onForgotPasswordClick={() => navigateTo("forgot-password")}
          />
        )}
        {activeAuthScreen === "signup" && (
          <SignUpScreen
            onSignUpSuccess={() => navigateTo("welcome")}
            onLoginClick={() => navigateTo("login")}
          />
        )}
        {activeAuthScreen === "forgot-password" && (
          <ForgotPasswordScreen onBack={() => navigateTo("login")} />
        )}
      </main>
    );
  }

  // If authenticated, show main app with theme toggle and workout screens
  return (
    <main
      className="spectrax-app"
      style={{ background: "var(--bg-primary)", minHeight: "100vh" }}
    >
      <button
        onClick={toggleTheme}
        className={`theme-toggle ${currentScreen === "workout" ? "workout-active" : ""}`}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      >
        {theme === "dark" ? "☾ Dark Mode" : "☀ Light Mode"}
      </button>

      {currentScreen === "welcome" && (
        <WelcomeScreen
          onStart={() => navigateTo("calibration")}
          onViewHistory={() => navigateTo("history")}
          onViewTrophies={() => navigateTo("trophy")}
          leveling={leveling}
        />
      )}

      {currentScreen === "calibration" && (
        <CalibrationScreen
          selectedExercise={selectedExercise}
          onSelectExercise={handleSelectExercise}
          onNext={() => navigateTo("workout")}
          onBack={() => navigateTo("welcome")}
          onBodyTypeDetected={setBodyType}
        />
      )}

      {currentScreen === "workout" && (
        <WorkoutScreen
          exercise={selectedExercise}
          onEnd={handleWorkoutEnd}
          onAutoDetect={handleAutoDetect}
          bodyType={bodyType}
        />
      )}
      {currentScreen === "summary" &&
        (statsLoading ? (
          <SummaryScreenSkeleton />
        ) : (
          <SummaryScreen
            stats={stats}
            leveling={leveling}
            onRestart={() => navigateTo("welcome")}
            onViewReplay={() => navigateTo("replay")}
          />
        ))}

      {currentScreen === "replay" && (
        <ReplayScreen onBack={() => navigateTo("summary")} stats={stats} />
      )}

      {currentScreen === "history" && (
        <HistoryPage onBack={() => navigateTo("welcome")} />
      )}

      {currentScreen === "trophy" && (
        <TrophyRoom onBack={() => navigateTo("welcome")} />
      )}

      {/* Global badge unlock notification — rendered at the app root so it's
          always visible regardless of which screen is active */}
      <BadgeNotification badge={newlyEarned} onClose={clearNewlyEarned} />
    </main>
  );
}

export default App;
