import { useState, useRef } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CalibrationScreen } from './components/CalibrationScreen';
import { WorkoutScreen } from './components/WorkoutScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { ReplayScreen } from './components/ReplayScreen';
import { exercises, ExerciseConfig } from './config/exercises';
import { BodyType } from './services/bodyTypeEngine';
import { useTheme } from './context/ThemeContext';

type Screen = 'welcome' | 'calibration' | 'workout' | 'summary' | 'replay';

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
        <WelcomeScreen onStart={() => navigateTo('calibration')} />
      )}
      
      {currentScreen === 'calibration' && (
        <CalibrationScreen 
          selectedExercise={selectedExercise}
          onSelectExercise={handleSelectExercise}
          onNext={() => navigateTo('workout')} 
          onBack={() => navigateTo('welcome')}
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
    </main>
  );
}

export default App;
