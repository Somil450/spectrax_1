import React from "react";
import { ExerciseConfig } from "../config/exercises";

interface WorkoutScreenProps {
  exercise: ExerciseConfig;
  onEnd: (stats: any) => void;
  onAutoDetect?: (key: string) => void;
  bodyType?: string;
}

export const WorkoutScreen: React.FC<WorkoutScreenProps> = ({ exercise }) => {
  return (
    <div style={{ padding: 16 }}>
      <h2>Workout: {exercise?.name || "Exercise"}</h2>
      <p>
        WorkoutScreen placeholder to allow build. Full implementation restored
        later.
      </p>
    </div>
  );
};

export default WorkoutScreen;
