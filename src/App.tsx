import { useState, useRef, useEffect, Suspense, useCallback, lazy } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { SummaryScreen } from "./components/SummaryScreen";
import { TrophyRoom } from "./components/TrophyRoom";
import { UserProfileScreen } from "./components/UserProfileScreen";
import { BadgeNotification } from "./components/BadgeNotification";
import { exercises, ExerciseConfig } from "./config/exercises";
import { BodyType } from "./services/bodyTypeEngine";
import { useTheme } from "./context/ThemeContext";
import HistoryPage from "./HistoryPage";
import { useLeveling } from "./hooks/useLeveling";
import { SummaryScreenSkeleton } from "./components/SummaryScreenSkeleton";
import { GridSkeleton } from "./components/CardSkeleton";
import { useAuth } from "./context/AuthContext";
import { LoginScreen } from "./components/LoginScreen";
import { SignUpScreen } from "./components/SignUpScreen";
import { ForgotPasswordScreen } from "./components/ForgotPasswordScreen";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { useBadges } from "./hooks/useBadges";
import { throttleMonitor } from './services/performanceThrottleService';

// Start monitoring throttling immediately
throttleMonitor.start();
import { useWorkoutSync } from "./hooks/useWorkoutSync";
import { useRegisterSW } from "virtual:pwa-register/react";
import { estimateCalories, getSavedUserWeight } from "./utils/calorieEstimator";
import { CursorGlow } from "./components/CursorGlow";
import { FitnessCalculator } from "./components/FitnessCalculator";
import { PageErrorBoundary } from "./components/PageErrorBoundary";

const CalibrationScreen = lazy(() => import("./components/CalibrationScreen").then(m => ({ default: m.CalibrationScreen })));
const WorkoutScreen = lazy(() => import("./components/WorkoutScreen").then(m => ({ default: m.WorkoutScreen })));
const ReplayScreen = lazy(() => import("./components/ReplayScreen").then(m => ({ default: m.ReplayScreen })));

type Screen =
  | "welcome"
  | "calibration"
  | "workout"
  | "summary"
  | "replay"
  | "history"
  | "login"
  | "signup"
  | "forgot-password"
  | "trophy"
  | "profile"
  | "fitness";

type ScreenTransitionMap = Record<Screen, readonly Screen[]>;

const SCREEN_TRANSITIONS: ScreenTransitionMap = {
  welcome: ["calibration", "history", "trophy", "profile", "login", "fitness"],
  calibration: ["workout", "welcome", "login"],
  workout: ["summary", "welcome"],
  summary: ["replay", "welcome"],
  replay: ["summary", "welcome"],
  history: ["welcome", "login"],
  login: ["signup", "forgot-password", "welcome"],
  signup: ["login", "welcome"],
  "forgot-password": ["login", "welcome"],
  trophy: ["welcome", "login"],
  profile: ["welcome", "login"],
  fitness: ["welcome"],
};

const canTransitionTo = (from: Screen, to: Screen) => {
  return SCREEN_TRANSITIONS[from].includes(to);
};

interface WorkoutStats {
  reps: number;
  totalReps: number;
  correctReps: number;
  repScores: number[];
  repDeviations?: number[];
  duration: number;
  accuracy: number;
  exerciseName: string;
  mistakes: Record<string, number>;
  bestStreak: number;
  jumpingJackSync?: {
    score: number | null;
    lagMs: number | null;
    confidence: number;
    samples: number;
  };
  tags?: string[];
  gainedXp?: number;
  calories?: number;
}

// Derived from build-time env — safe to compute outside or at the top of the component
const firebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

function App() {
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>("welcome");

  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (currentScreen !== "workout") {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, [currentScreen]);

  const [selectedExercise, setSelectedExercise] = useState<ExerciseConfig>(
    exercises.squat,
  );
  const [bodyType, setBodyType] = useState<BodyType>("scanning");
  const [adaptiveFactor, setAdaptiveFactor] = useState<number>(1.0);
  const [showExitModal, setShowExitModal] = useState(false);
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
  const [pendingRecovery, setPendingRecovery] = useState<{ stats: WorkoutStats; exerciseKey: string } | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const cacheKey = `spectrax_telemetry_snapshot_${user.uid}`;
    const rawCache = localStorage.getItem(cacheKey);
    if (rawCache) {
      try {
        const parsed = JSON.parse(rawCache);
        if (parsed && parsed.stats && parsed.stats.totalReps > 0) {
          setPendingRecovery(parsed);
        }
      } catch (e) {
        console.error("Failed parsing telemetry cache:", e);
      }
    }
  }, [user?.uid, currentScreen]);

  const handleApplyRecovery = () => {
    if (!pendingRecovery) return;
    setStats(pendingRecovery.stats);
    if (exercises[pendingRecovery.exerciseKey]) {
      setSelectedExercise(exercises[pendingRecovery.exerciseKey]);
    }
    setPendingRecovery(null);
    navigateTo("summary");
  };

  const handleDiscardRecovery = () => {
    if (!user?.uid) return;
    localStorage.removeItem(`spectrax_telemetry_snapshot_${user.uid}`);
    setPendingRecovery(null);
  };

  const { newlyEarned, clearNewlyEarned, checkAndAwardBadges } = useBadges();
  const { addWorkout } = useWorkoutSync();

  const [statsLoading, setStatsLoading] = useState(false);

  const lastSwitchTime = useRef<number>(0);
  const leveling = useLeveling();

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered() {
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  const closeOfflineNotification = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const navigateTo = useCallback((screen: Screen, force = false) => {
    setCurrentScreen((prevScreen) => {
      if (force || canTransitionTo(prevScreen, screen)) {
        return screen;
      }

      console.warn(
        `[App] Blocked illegal screen transition from ${prevScreen} to ${screen}`,
      );
      return prevScreen;
    });
  }, []);

  useEffect(() => {
    if (!firebaseConfigured) return; // no-op in demo/offline mode
    if (!authLoading) {
      if (!user) {
        navigateTo("login", true);
      } else if (
        currentScreen === "login" ||
        currentScreen === "signup" ||
        currentScreen === "forgot-password"
      ) {
        navigateTo("welcome", true);
      }
    }
  }, [user, authLoading, currentScreen, navigateTo]);

  const handleWorkoutEnd = (
    finalStats: Omit<WorkoutStats, "exerciseName"> & { tags?: string[] },
  ) => {
    setStatsLoading(true);
    if (user?.uid) {
      localStorage.removeItem(`spectrax_telemetry_snapshot_${user.uid}`);
    }
    const gainedXp = leveling.addXpFromReps(finalStats.reps);
    const calorieResult = estimateCalories({
      exerciseName: selectedExercise.name,
      totalReps: finalStats.totalReps,
      durationSeconds: finalStats.duration,
      accuracyScore: finalStats.accuracy,
      userWeightKg: getSavedUserWeight() ?? 70,
    });

    const fullStats = {
      ...finalStats,
      exerciseName: selectedExercise.name,
      gainedXp,
      calories: calorieResult.calories, // ADD THIS
    };
    setStats(fullStats);
    navigateTo("summary");

    // Award badges based on completed session
    checkAndAwardBadges({
      totalReps: finalStats.totalReps,
      accuracy: finalStats.accuracy,
      exerciseName: selectedExercise.name,
      bestStreak: finalStats.bestStreak,
    });

    if (finalStats.totalReps > 0) {
      addWorkout({
        exerciseType: selectedExercise.name.toLowerCase().replace(/\s+/g, "_"),
        totalReps: finalStats.totalReps,
        accuracyScore: finalStats.accuracy,
        duration: finalStats.duration,
        timestamp: Date.now(),
      }).catch((error) => {
        console.error("Failed to save workout:", error);
      });
    }

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
      lastSwitchTime.current = now;
      setSelectedExercise(exercises[exerciseKey]);
    }
  };

  const handleSelectExercise = (key: string) => {
    if (exercises[key]) {
      setSelectedExercise(exercises[key]);
    }
  };

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
    const activeAuthScreen = ["login", "signup", "forgot-password"].includes(
      currentScreen,
    )
      ? currentScreen
      : "login";
    return (
      <main className="spectrax-app">
        {(currentScreen === "login" ||
          (currentScreen !== "signup" &&
            currentScreen !== "forgot-password")) && (
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
      {/* Global neon cursor trail — pointer-events:none, touch/motion-safe */}
      <CursorGlow />
      <div
        className={`theme-selector-segmented ${
          currentScreen === "workout" ? "workout-active" : ""
        } ${
          ["summary", "replay", "history", "trophy", "fitness"].includes(currentScreen)
            ? "is-hidden"
            : ""
        }`}
      >
        <div className={`selector-indicator theme-${theme}`} />
        <button
          className={`selector-btn ${theme === "cyber-dark" ? "active" : ""}`}
          onClick={() => setTheme("cyber-dark")}
          aria-label="Switch to Cyber theme"
        >
          🌌 Cyber
        </button>
        <button
          className={`selector-btn ${theme === "retro" ? "active" : ""}`}
          onClick={() => setTheme("retro")}
          aria-label="Switch to Retro theme"
        >
          📻 Retro
        </button>
        <button
          className={`selector-btn ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
          aria-label="Switch to Light theme"
        >
          ☀️ Light
        </button>
      </div>

      {currentScreen === "welcome" && (
        <WelcomeScreen
          onStart={() => navigateTo("calibration")}
          onViewHistory={() => navigateTo("history")}
          onViewTrophies={() => navigateTo("trophy")}
          onViewProfile={user ? () => navigateTo("profile") : undefined}
          onViewFitnessCalculator={() => navigateTo("fitness")}
          leveling={leveling}
          pendingRecovery={pendingRecovery}
          onApplyRecovery={handleApplyRecovery}
          onDiscardRecovery={handleDiscardRecovery}
        />
      )}

      <Suspense fallback={<GridSkeleton />}>
        {currentScreen === "calibration" && (
          <CalibrationScreen
            selectedExercise={selectedExercise}
            onSelectExercise={handleSelectExercise}
            onNext={() => navigateTo("workout")}
            onBack={() => setShowExitModal(true)}
            onBodyTypeDetected={(type, factor) => { setBodyType(type); setAdaptiveFactor(factor); }}
          />
        )}

        {currentScreen === "workout" && (
          <WorkoutScreen
            exercise={selectedExercise}
            onEnd={handleWorkoutEnd}
            onAutoDetect={handleAutoDetect}
            bodyType={bodyType}
            onSnapshotUpdate={(liveStats: any) => {
              if (!user?.uid) return;
              const fullStats = { ...liveStats, exerciseName: selectedExercise.name };
              localStorage.setItem(
                `spectrax_telemetry_snapshot_${user.uid}`,
                JSON.stringify({ stats: fullStats, exerciseKey: selectedExercise.key })
              );
            }}
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
          <PageErrorBoundary fallbackMessage="Failed to load workout history. Please try again.">
            <HistoryPage onBack={() => navigateTo("welcome")} />
          </PageErrorBoundary>
        )}

        {currentScreen === "trophy" && (
          <PageErrorBoundary fallbackMessage="Failed to load Trophy Room. Please try again.">
            <TrophyRoom onBack={() => navigateTo("welcome")} />
          </PageErrorBoundary>
        )}

        {currentScreen === "profile" && (
          <UserProfileScreen onLogout={() => navigateTo("welcome")} />
        )}

        {currentScreen === "fitness" && (
          <FitnessCalculator onBack={() => navigateTo("welcome")} />
        )}
      </Suspense>

      {/* Global badge unlock notification — rendered at the app root so it's
          always visible regardless of which screen is active */}
      <BadgeNotification badge={newlyEarned} onClose={clearNewlyEarned} />
      <ScrollToTopButton />

      {(offlineReady || needRefresh) && (
        <div className="pwa-toast glass animate-in" role="alert">
          <div className="pwa-toast-message">
            {offlineReady ? (
              <span>App is ready to work offline!</span>
            ) : (
              <span>
                New content available, click on reload button to update.
              </span>
            )}
          </div>
          <div className="pwa-toast-buttons">
            {needRefresh && (
              <button
                className="pwa-toast-btn primary"
                onClick={() => updateServiceWorker(true)}
              >
                Reload
              </button>
            )}
            <button
              className="pwa-toast-btn secondary"
              onClick={closeOfflineNotification}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {showExitModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999,
            backdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "20px",
              padding: "30px",
              width: "320px",
              textAlign: "center",
              color: "white",
              backdropFilter: "blur(15px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <h2>Confirm Exit</h2>

            <p>Are you sure you want to end your session?</p>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "20px",
              }}
            >
              <button
                onClick={() => setShowExitModal(false)}
                style={{
                  padding: "10px 20px",
                  borderRadius: "10px",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Stay
              </button>

        <button
          onClick={() => {
            setShowExitModal(false);
            if (user?.uid) {
              localStorage.removeItem(`spectrax_telemetry_snapshot_${user.uid}`);
            }
            navigateTo('welcome');
          }}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer',
            background: '#ff4d4f',
            color: 'white'
          }}
        >
          Exit
        </button>
      </div>
    </div>
  </div>
)}
    </main>
  );
}

export default App;

// TODO: Consider adding more comprehensive JSDoc comments
