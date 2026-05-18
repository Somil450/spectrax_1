import React, { createContext, useContext, useRef, useState } from 'react';
import { exercises, type ExerciseConfig } from '../config/exercises';
import type { BodyType } from '../services/bodyTypeEngine';

export interface WorkoutStats {
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

interface WorkoutFlowContextValue {
  selectedExercise: ExerciseConfig;
  setSelectedExercise: React.Dispatch<React.SetStateAction<ExerciseConfig>>;
  bodyType: BodyType;
  setBodyType: React.Dispatch<React.SetStateAction<BodyType>>;
  stats: WorkoutStats;
  setStats: React.Dispatch<React.SetStateAction<WorkoutStats>>;
  statsLoading: boolean;
  setStatsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  lastSwitchTime: React.MutableRefObject<number>;
}

const defaultStats: WorkoutStats = {
  reps: 0,
  totalReps: 0,
  correctReps: 0,
  repScores: [],
  duration: 0,
  accuracy: 0,
  exerciseName: exercises.squat.name,
  mistakes: {},
  bestStreak: 0,
};

const WorkoutFlowContext = createContext<WorkoutFlowContextValue | undefined>(undefined);

export function WorkoutFlowProvider({ children }: { children: React.ReactNode }) {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseConfig>(exercises.squat);
  const [bodyType, setBodyType] = useState<BodyType>('scanning');
  const [stats, setStats] = useState<WorkoutStats>(defaultStats);
  const [statsLoading, setStatsLoading] = useState(false);
  const lastSwitchTime = useRef(0);

  return (
    <WorkoutFlowContext.Provider
      value={{
        selectedExercise,
        setSelectedExercise,
        bodyType,
        setBodyType,
        stats,
        setStats,
        statsLoading,
        setStatsLoading,
        lastSwitchTime,
      }}
    >
      {children}
    </WorkoutFlowContext.Provider>
  );
}

export function useWorkoutFlow(): WorkoutFlowContextValue {
  const ctx = useContext(WorkoutFlowContext);
  if (!ctx) throw new Error('useWorkoutFlow must be used inside WorkoutFlowProvider');
  return ctx;
}
