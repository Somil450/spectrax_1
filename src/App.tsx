import { useState, useRef, useEffect } from "react";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { BadgeNotification } from "./components/BadgeNotification";
import { SummaryScreenSkeleton } from "./components/SummaryScreenSkeleton";
import { exercises, ExerciseConfig } from "./config/exercises";
import { BodyType } from "./services/bodyTypeEngine";
import { useTheme } from "./context/ThemeContext";
import HistoryPage from "./HistoryPage";
import { SummaryScreenSkeleton } from "./components/SummaryScreenSkeleton";
import { useAuth } from "./hooks/useAuth";
import { LoginScreen } from "./components/LoginScreen";
import { SignUpScreen } from "./components/SignUpScreen";
import { ForgotPasswordScreen } from "./components/ForgotPasswordScreen";
import { useBadges } from "./hooks/useBadges";
import { useRegisterSW } from "virtual:pwa-register/react";


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
  | "trophy";
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
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [selectedExercise, setSelectedExercise] = useState<ExerciseConfig>(exercises.squat);
  const [bodyType, setBodyType] = useState<BodyType>('scanning');
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
    onRegistered(r) {
      console.log("SW Registered: " + r);
    },
    onRegisterError(error) {
      console.error("SW registration error", error);
    },
  });

  const closeOfflineNotification = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        setCurrentScreen((prev) => {
          if (prev !== "login" && prev !== "signup" && prev !== "forgot-password") {
            return "login";
          }
          return prev;
        });
      } else {
        setCurrentScreen((prev) => {
          if (prev === "login" || prev === "signup" || prev === "forgot-password") {
            return "welcome";
          }
          return prev;
        });
      }
    }
  }, [user, authLoading]);

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


      
      {currentScreen === 'welcome' && (
      <WelcomeScreen
        onStart={() => navigateTo('calibration')}
        onViewHistory={() => navigateTo('history')}  // add this
       />
      )}
      
      {currentScreen === 'calibration' && (
        <CalibrationScreen 
          selectedExercise={selectedExercise}
          onSelectExercise={handleSelectExercise}
          onNext={() => navigateTo('workout')}
          onBack={() => setShowExitModal(true)}
          onBodyTypeDetected={setBodyType} 
        />
      )}
      
      {currentScreen === 'workout' && (
        <WorkoutScreen 
          exercise={selectedExercise}
          onEnd={handleWorkoutEnd} 
          onAutoDetect={handleAutoDetect}
          bodyType={bodyType}
        />
      )}
      
      {currentScreen === 'summary' && (
        <SummaryScreen 
          stats={stats}
          onRestart={() => navigateTo('welcome')} 
          onViewReplay={() => navigateTo('replay')} 
        />
      )}

      <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
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
      </Suspense>

      {/* Global badge unlock notification — rendered at the app root so it's
          always visible regardless of which screen is active */}
      <BadgeNotification badge={newlyEarned} onClose={clearNewlyEarned} />

      {(offlineReady || needRefresh) && (
        <div className="pwa-toast glass animate-in" role="alert">
          <div className="pwa-toast-message">
            {offlineReady ? (
              <span>App is ready to work offline!</span>
            ) : (
              <span>New content available, click on reload button to update.</span>
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
            <button className="pwa-toast-btn secondary" onClick={closeOfflineNotification}>
              Close
            </button>
          </div>
        </div>
      )}
      {showExitModal && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 999,
      backdropFilter: 'blur(8px)'
    }}
  >
    <div
      style={{
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '20px',
        padding: '30px',
        width: '320px',
        textAlign: 'center',
        color: 'white',
        backdropFilter: 'blur(15px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
      }}
    >
      <h2>Confirm Exit</h2>

      <p>Are you sure you want to end your session?</p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '20px'
        }}
      >
        <button
          onClick={() => setShowExitModal(false)}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          Stay
        </button>

        <button
          onClick={() => {
            setShowExitModal(false);
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
