import { useState, useRef, useEffect, Suspense, useCallback, lazy } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { BadgeNotification } from "./components/BadgeNotification";
import { exercises, ExerciseConfig } from "./config/exercises";
import { BodyType } from "./services/bodyTypeEngine";
import { useTheme } from "./context/ThemeContext";
import { useLeveling } from "./hooks/useLeveling";
import { SummaryScreenSkeleton } from "./components/SummaryScreenSkeleton";
import { GridSkeleton } from "./components/CardSkeleton";
import { useAuth } from "./context/AuthContext";
import { BackToTopButton } from "./components/BackToTopButton";
import { useBadges } from "./hooks/useBadges";
import { throttleMonitor } from './services/performanceThrottleService';
import NavBar from "./components/NavBar";
import About from "./components/About";
import Contact from "./components/Contact";
import PrivacyPage from './components/privacy';
import TermsAndConditions from './components/terms&conditions'
import { ExitConfirmModal } from "./components/ExitConfirmModal";
import { PerformanceMonitor } from "./components/PerformanceMonitor";


// Start monitoring throttling immediately
throttleMonitor.start();
import { useWorkoutSync } from "./hooks/useWorkoutSync";
import { useRegisterSW } from "virtual:pwa-register/react";
import { estimateCalories, getSavedUserWeight } from "./utils/calorieEstimator";
import { CursorGlow } from "./components/CursorGlow";
import { PageErrorBoundary } from "./components/PageErrorBoundary";
import type { ActivePlan } from "./components/WorkoutPlansScreen";
const WelcomeScreen = lazy(() => import("./components/WelcomeScreen").then(m => ({ default: m.WelcomeScreen })));
const SummaryScreen = lazy(() => import("./components/SummaryScreen").then(m => ({ default: m.SummaryScreen })));
const TrophyRoom = lazy(() => import("./components/TrophyRoom").then(m => ({ default: m.TrophyRoom })));
const UserProfileScreen = lazy(() => import("./components/UserProfileScreen").then(m => ({ default: m.UserProfileScreen })));
const HistoryPage = lazy(() => import("./HistoryPage"));
const LoginScreen = lazy(() => import("./components/LoginScreen").then(m => ({ default: m.LoginScreen })));
const SignUpScreen = lazy(() => import("./components/SignUpScreen").then(m => ({ default: m.SignUpScreen })));
const ForgotPasswordScreen = lazy(() => import("./components/ForgotPasswordScreen").then(m => ({ default: m.ForgotPasswordScreen })));
const FitnessCalculator = lazy(() => import("./components/FitnessCalculator").then(m => ({ default: m.FitnessCalculator })));

const CalibrationScreen = lazy(() => import("./components/CalibrationScreen").then(m => ({ default: m.CalibrationScreen })));
const WorkoutScreen = lazy(() => import("./components/WorkoutScreen").then(m => ({ default: m.WorkoutScreen })));
const ReplayScreen = lazy(() => import("./components/ReplayScreen").then(m => ({ default: m.ReplayScreen })));
const AvatarCustomizationScreen = lazy(() => import("./components/AvatarCustomizationScreen").then(m => ({ default: m.AvatarCustomizationScreen })));
const WorkoutPlansScreen = lazy(() => import("./components/WorkoutPlansScreen").then(m => ({ default: m.WorkoutPlansScreen })));
const BattleMode = lazy(() => import("./components/BattleMode/BattleMode").then(m => ({ default: m.BattleMode })));
const TutorialsScreen = lazy(() => import("./components/TutorialsScreen").then(m => ({ default: m.TutorialsScreen })));

type Screen =
  | "welcome"
  | "calibration"
  | "workout"
  | "summary"
  | "replay"
  | "history"
  | "about"
  | "contact"
  | "login"
  | "signup"
  | "forgot-password"
  | "trophy"
  | "profile"
  | "fitness"
  | "avatar"
  | "workoutPlans"
  | "privacy"
  | "terms&conditions"
  | "battle"
  | "tutorials";

type ScreenTransitionMap = Record<Screen, readonly Screen[]>;

const SCREEN_TRANSITIONS: ScreenTransitionMap = {
  welcome: ["calibration", "history", "trophy", "profile", "login", "fitness", "about", "contact", "avatar", "workoutPlans", "privacy", "terms&conditions", "battle", "tutorials"],
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
  about: ["welcome"],
  contact: ["welcome"],
  avatar: ["welcome"],
  workoutPlans: ["welcome"],
  privacy: ["welcome"],
  "terms&conditions": ["welcome"],
  battle: ["welcome"],
  tutorials: ["welcome", "calibration"],
};

const SCREEN_TO_PATH: Record<Screen, string> = {
  welcome: "/",
  calibration: "/calibration",
  workout: "/workout",
  summary: "/summary",
  replay: "/replay",
  history: "/history",
  about: "/about",
  contact: "/contact",
  login: "/login",
  signup: "/signup",
  "forgot-password": "/forgot-password",
  trophy: "/trophy",
  profile: "/profile",
  fitness: "/fitness",
  avatar: "/avatar",
  workoutPlans: "/workout-plans",
  privacy: "/privacy",
  "terms&conditions": "/terms",
  battle: "/battle",
  tutorials: "/tutorials",
};

const PATH_TO_SCREEN: Record<string, Screen> = Object.fromEntries(
  Object.entries(SCREEN_TO_PATH).map(([screen, path]) => [path, screen as Screen]),
);

const canTransitionTo = (from: Screen, to: Screen) => {
  return SCREEN_TRANSITIONS[from]?.includes(to) ?? false;
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
  tutMetrics?: {
    eccentricMs: number;
    concentricMs: number;
    isometricMs: number;
    tempoRatio: string;
    totalRepMs: number;
  };
}

// Derived from build-time env — safe to compute outside or at the top of the component
const firebaseConfigured = !!import.meta.env.VITE_FIREBASE_API_KEY;

function App() {
  const { theme, setTheme } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(null);

  const currentScreen: Screen = PATH_TO_SCREEN[location.pathname] ?? "welcome";

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
  const setAdaptiveFactor = useState<number>(1.0)[1];
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
    if (force || canTransitionTo(currentScreen, screen)) {
      navigate(SCREEN_TO_PATH[screen]);
    } else {
      console.warn(
        `[App] Blocked illegal screen transition from ${currentScreen} to ${screen}`,
      );
    }
  }, [currentScreen, navigate]);

  useEffect(() => {
    if (!firebaseConfigured) return;
    if (!authLoading) {
      if (!user) {
        navigate(SCREEN_TO_PATH.login, { replace: true });
      } else if (
        currentScreen === "login" ||
        currentScreen === "signup" ||
        currentScreen === "forgot-password"
      ) {
        navigate(SCREEN_TO_PATH.welcome, { replace: true });
      }
    }
  }, [user, authLoading, currentScreen, navigate]);

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
      calories: calorieResult.calories,
      tutMetrics: finalStats.tutMetrics,
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

  if (firebaseConfigured && !user) {
    return (
      <main className="spectrax-app">
        <Routes>
          <Route path={SCREEN_TO_PATH.signup} element={
            <SignUpScreen
              onSignUpSuccess={() => navigateTo("welcome")}
              onLoginClick={() => navigateTo("login")}
            />
          } />
          <Route path={SCREEN_TO_PATH["forgot-password"]} element={
            <ForgotPasswordScreen onBack={() => navigateTo("login")} />
          } />
          <Route path="*" element={
            <LoginScreen
              onLoginSuccess={() => navigateTo("welcome")}
              onSignUpClick={() => navigateTo("signup")}
              onForgotPasswordClick={() => navigateTo("forgot-password")}
            />
          } />
        </Routes>
      </main>
    );
  }

  const isWorkoutActive = currentScreen === "workout";
  const isHidden = ["summary", "replay", "history", "trophy", "fitness", "tutorials"].includes(currentScreen);

  return (
    <main
      className="spectrax-app"
      style={{ background: "var(--bg-primary)", minHeight: "100vh" }}
    >
      <CursorGlow />
      <NavBar navigateTo={navigateTo} theme={theme} setTheme={setTheme} />
      <PrivacyShield />
      <div
        className={`theme-selector-segmented ${isWorkoutActive ? "workout-active" : ""
          } ${isHidden ? "is-hidden" : ""}`}
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

      <Suspense fallback={<GridSkeleton />}>
        <Routes>
          <Route path={SCREEN_TO_PATH.welcome} element={
            <WelcomeScreen
              navigateTo={navigateTo}
              onStart={() => navigateTo("calibration")}
              onViewHistory={() => navigateTo("history")}
              onViewTrophies={() => navigateTo("trophy")}
              onViewProfile={() => navigateTo("profile")}
              onViewFitnessCalculator={() => navigateTo("fitness")}
              onViewAvatarCustomization={() => navigateTo("avatar")}
              onViewWorkoutPlans={() => navigateTo("workoutPlans")}
              leveling={leveling}
            />
          } />
          <Route path={SCREEN_TO_PATH.calibration} element={
            <PageErrorBoundary fallbackMessage="Failed to load calibration. Please try again.">
              <CalibrationScreen
                selectedExercise={selectedExercise}
                onSelectExercise={handleSelectExercise}
                onNext={() => navigateTo("workout")}
                onBack={() => setShowExitModal(true)}
                onBodyTypeDetected={(type, factor) => { setBodyType(type); setAdaptiveFactor(factor); }}
              />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH.workout} element={
            <PageErrorBoundary fallbackMessage="Something went wrong during your workout. Your progress has been saved.">
              <WorkoutScreen
                exercise={selectedExercise}
                onEnd={handleWorkoutEnd}
                onAutoDetect={handleAutoDetect}
                bodyType={bodyType}
              />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH.summary} element={
            statsLoading ? (
              <SummaryScreenSkeleton />
            ) : (
              <PageErrorBoundary fallbackMessage="Failed to load workout summary. Please try again.">
                <SummaryScreen
                  stats={stats}
                  leveling={leveling}
                  onRestart={() => navigateTo("welcome")}
                  onViewReplay={() => navigateTo("replay")}
                />
              </PageErrorBoundary>
            )
          } />
          <Route path={SCREEN_TO_PATH.replay} element={
            <PageErrorBoundary fallbackMessage="Failed to load replay. Please try again.">
              <ReplayScreen onBack={() => navigateTo("summary")} stats={stats} />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH.history} element={
            <PageErrorBoundary fallbackMessage="Failed to load workout history. Please try again.">
              <HistoryPage onBack={() => navigateTo("welcome")} />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH.trophy} element={
            <PageErrorBoundary fallbackMessage="Failed to load Trophy Room. Please try again.">
              <TrophyRoom onBack={() => navigateTo("welcome")} />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH.profile} element={
            <UserProfileScreen onLogout={() => navigateTo("welcome")} />
          } />
          <Route path={SCREEN_TO_PATH.contact} element={<Contact />} />
          <Route path={SCREEN_TO_PATH.about} element={<About />} />
          <Route path={SCREEN_TO_PATH.privacy} element={
            <PageErrorBoundary fallbackMessage="Failed to load Privacy page.">
              <PrivacyPage onBack={() => navigateTo("welcome")} />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH["terms&conditions"]} element={
            <PageErrorBoundary fallbackMessage="Failed to load Terms page.">
              <TermsAndConditions onBack={() => navigateTo("welcome")} />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH.battle} element={
            <PageErrorBoundary fallbackMessage="Failed to load Battle Mode. Please try again.">
              <BattleMode onBack={() => navigateTo("welcome")} />
            </PageErrorBoundary>
          } />
          <Route path={SCREEN_TO_PATH.avatar} element={
            <Suspense fallback={<div className="loading-fallback">Loading Avatar Customization...</div>}>
              <AvatarCustomizationScreen onBack={() => navigateTo("welcome")} />
            </Suspense>
          } />
          <Route path={SCREEN_TO_PATH.tutorials} element={
            <Suspense fallback={<div className="loading-fallback">Loading Tutorials...</div>}>
              <TutorialsScreen
                onBack={() => navigateTo("welcome")}
                onStartTryMode={(exerciseKey) => {
                  const config = exercises[exerciseKey];
                  if (config) {
                    setSelectedExercise(config);
                    navigateTo("calibration");
                  }
                }}
              />
            </Suspense>
          } />
          <Route path={SCREEN_TO_PATH.fitness} element={
            <FitnessCalculator onBack={() => navigateTo("welcome")} />
          } />
          <Route path={SCREEN_TO_PATH.workoutPlans} element={
            <PageErrorBoundary fallbackMessage="Failed to load workout plans. Please try again.">
              <WorkoutPlansScreen
                onBack={() => navigateTo("welcome")}
                activePlan={activePlan}
                setActivePlan={setActivePlan}
              />
            </PageErrorBoundary>
          } />
          <Route path="*" element={<WelcomeScreen
            navigateTo={navigateTo}
            onStart={() => navigateTo("calibration")}
            onViewHistory={() => navigateTo("history")}
            onViewTrophies={() => navigateTo("trophy")}
            onViewProfile={() => navigateTo("profile")}
            onViewFitnessCalculator={() => navigateTo("fitness")}
            onViewAvatarCustomization={() => navigateTo("avatar")}
            onViewWorkoutPlans={() => navigateTo("workoutPlans")}
            leveling={leveling}
          />} />
        </Routes>
      </Suspense>

      <BadgeNotification badge={newlyEarned} onClose={clearNewlyEarned} />
      <BackToTopButton />

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
        <ExitConfirmModal
          message="Are you sure you want to end your session?"
          onStay={() => setShowExitModal(false)}
          onExit={() => {
            setShowExitModal(false);
            if (user?.uid) {
              localStorage.removeItem(`spectrax_telemetry_snapshot_${user.uid}`);
            }
            navigateTo('welcome');
          }}
        />
      )}
      <PerformanceMonitor visible={currentScreen === 'workout' || currentScreen === 'calibration'} />
    </main>
  );
}

export default App;

// TODO: Consider adding more comprehensive JSDoc comments