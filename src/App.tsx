import { useState, useRef } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CalibrationScreen } from './components/CalibrationScreen';
import { WorkoutScreen } from './components/WorkoutScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { ReplayScreen } from './components/ReplayScreen';
import { exercises, ExerciseConfig } from './config/exercises';
import { BodyType } from './services/bodyTypeEngine';
import { useTheme } from './context/ThemeContext';
import HistoryPage from "./HistoryPage";

type Screen = 'welcome' | 'calibration' | 'workout' | 'summary' | 'replay' | 'history';

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
    bestStreak: 0
  });
  const lastSwitchTime = useRef<number>(0);

  const navigateTo = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleWorkoutEnd = (finalStats: Omit<WorkoutStats, 'exerciseName'> & { tags?: string[] }) => {
    setStats({ ...finalStats, exerciseName: selectedExercise.name });
    navigateTo('summary');
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

  return (
    <main className="spectrax-app" style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <button
        onClick={toggleTheme}
        className="theme-toggle"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? '☾ Dark Mode' : '☀ Light Mode'}
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
      
      {currentScreen === 'replay' && (
      <ReplayScreen onBack={() => navigateTo('summary')} stats={stats} />
      )}
      {currentScreen === 'history' && (
      <HistoryPage onBack={() => navigateTo('welcome')} />
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
