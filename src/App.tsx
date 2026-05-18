import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { useWorkoutFlow } from './context/WorkoutFlowContext';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CalibrationScreen } from './components/CalibrationScreen';
import { WorkoutScreen } from './components/WorkoutScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { ReplayScreen } from './components/ReplayScreen';
import { SummaryScreenSkeleton } from './components/SummaryScreenSkeleton';
import { LoginScreen } from './components/LoginScreen';
import { SignUpScreen } from './components/SignUpScreen';
import { ForgotPasswordScreen } from './components/ForgotPasswordScreen';
import { ProtectedRoute } from './components/ProtectedRoute';
import HistoryPage from './HistoryPage';
import { exercises } from './config/exercises';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const {
    selectedExercise,
    setSelectedExercise,
    bodyType,
    setBodyType,
    stats,
    setStats,
    statsLoading,
    setStatsLoading,
    lastSwitchTime,
  } = useWorkoutFlow();

  const handleWorkoutEnd = (
    finalStats: Omit<typeof stats, 'exerciseName'> & { tags?: string[] },
  ) => {
    setStatsLoading(true);
    setStats({ ...finalStats, exerciseName: selectedExercise.name });
    navigate('/summary');
    window.setTimeout(() => setStatsLoading(false), 1500);
  };

  const handleAutoDetect = (exerciseKey: string) => {
    const now = Date.now();
    if (now - lastSwitchTime.current < 5000) return;
    if (exercises[exerciseKey] && selectedExercise.key !== exerciseKey) {
      lastSwitchTime.current = now;
      setSelectedExercise(exercises[exerciseKey]);
    }
  };

  return (
    <main className="spectrax-app" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button
        onClick={toggleTheme}
        className="theme-toggle"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? '☾ Dark Mode' : '☀ Light Mode'}
      </button>

      <Routes>
        <Route
          path="/"
          element={
            <WelcomeScreen
              onStart={() => navigate('/calibration')}
              onViewHistory={() => navigate('/history')}
            />
          }
        />
        <Route
          path="/calibration"
          element={
            <CalibrationScreen
              selectedExercise={selectedExercise}
              onSelectExercise={(key) => exercises[key] && setSelectedExercise(exercises[key])}
              onNext={() => navigate('/workout')}
              onBack={() => navigate('/')}
              onBodyTypeDetected={setBodyType}
            />
          }
        />
        <Route
          path="/workout"
          element={
            <WorkoutScreen
              exercise={selectedExercise}
              onEnd={handleWorkoutEnd}
              onAutoDetect={handleAutoDetect}
              bodyType={bodyType}
            />
          }
        />
        <Route
          path="/summary"
          element={
            statsLoading ? (
              <SummaryScreenSkeleton />
            ) : (
              <SummaryScreen
                stats={stats}
                onRestart={() => navigate('/')}
                onViewReplay={() => navigate('/replay')}
              />
            )
          }
        />
        <Route
          path="/replay"
          element={<ReplayScreen onBack={() => navigate('/summary')} stats={stats} />}
        />
        <Route path="/history" element={<HistoryPage onBack={() => navigate('/')} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthGate><LoginScreen /></AuthGate>} />
      <Route path="/signup" element={<AuthGate><SignUpScreen /></AuthGate>} />
      <Route path="/forgot-password" element={<AuthGate><ForgotPasswordScreen /></AuthGate>} />

      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AppShell />} />
      </Route>
    </Routes>
  );
}

export default App;
