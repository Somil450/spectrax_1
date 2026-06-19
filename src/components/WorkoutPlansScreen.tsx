import React, { useState } from "react";
import {
  ArrowLeft,
  Target,
  Calendar,
  Award,
  Play,
  CheckCircle,
} from "lucide-react";
import { useTheme } from "../context/ThemeContext";

interface ActivePlan {
  id: string;
  goal: string;
  level: string;
  week: number;
  totalWeeks: number;
  progress: number;
  name: string;
  exercises: Array<{
    day: string;
    name: string;
    sets: number;
    reps: string;
    completed?: boolean;
  }>;
}

interface WorkoutPlansScreenProps {
  onBack: () => void;
  activePlan: ActivePlan | null;
  setActivePlan: (plan: ActivePlan | null) => void;
  addXP?: (amount: number) => void;
  onStartWorkout?: (exerciseKey: string) => void;
}

const PLAN_TEMPLATES: Record<string, Record<string, any>> = {
  "Weight Loss": {
    Beginner: {
      name: "Fat Burn Foundations",
      totalWeeks: 4,
      exercises: [
        { day: "Monday", name: "Bodyweight Squats", sets: 3, reps: "12-15" },
        { day: "Monday", name: "Push-ups", sets: 3, reps: "8-12" },
        { day: "Wednesday", name: "Walking Lunges", sets: 3, reps: "10 each" },
        { day: "Wednesday", name: "Plank", sets: 3, reps: "20-30s" },
        { day: "Friday", name: "Jumping Jacks", sets: 4, reps: "30" },
      ],
    },
    Intermediate: {
      name: "Metabolic Burn",
      totalWeeks: 6,
      exercises: [
        { day: "Monday", name: "Goblet Squats", sets: 4, reps: "12" },
        { day: "Tuesday", name: "Burpees", sets: 4, reps: "10" },
        {
          day: "Thursday",
          name: "Mountain Climbers",
          sets: 4,
          reps: "20 each",
        },
      ],
    },
    Advanced: {
      name: "HIIT Shredder",
      totalWeeks: 8,
      exercises: [
        { day: "Monday", name: "Deadlifts", sets: 4, reps: "8" },
        { day: "Tuesday", name: "Box Jumps", sets: 4, reps: "10" },
      ],
    },
  },
  "Strength Building": {
    Beginner: {
      name: "Strength Starter",
      totalWeeks: 4,
      exercises: [
        { day: "Monday", name: "Push-ups", sets: 3, reps: "8-12" },
        { day: "Tuesday", name: "Squats", sets: 3, reps: "10-15" },
        { day: "Thursday", name: "Dumbbell Rows", sets: 3, reps: "10 each" },
      ],
    },
    Intermediate: {
      name: "Power Builder",
      totalWeeks: 6,
      exercises: [
        { day: "Monday", name: "Bench Press", sets: 4, reps: "8-10" },
        { day: "Wednesday", name: "Deadlifts", sets: 4, reps: "6-8" },
      ],
    },
    Advanced: {
      name: "Elite Strength",
      totalWeeks: 8,
      exercises: [
        { day: "Monday", name: "Overhead Press", sets: 5, reps: "5" },
        { day: "Friday", name: "Pull-ups", sets: 5, reps: "Max" },
      ],
    },
  },
  Endurance: {
    Beginner: {
      name: "Endurance Base",
      totalWeeks: 4,
      exercises: [
        { day: "Monday", name: "Brisk Walk", sets: 1, reps: "20 min" },
        { day: "Wednesday", name: "Cycling", sets: 1, reps: "25 min" },
      ],
    },
    Intermediate: {
      name: "Stamina Surge",
      totalWeeks: 6,
      exercises: [
        { day: "Tuesday", name: "Running", sets: 1, reps: "30 min" },
        { day: "Thursday", name: "Jump Rope", sets: 4, reps: "60s" },
      ],
    },
    Advanced: {
      name: "Peak Endurance",
      totalWeeks: 8,
      exercises: [
        { day: "Monday", name: "Trail Run", sets: 1, reps: "45 min" },
      ],
    },
  },
};

export const WorkoutPlansScreen: React.FC<WorkoutPlansScreenProps> = ({
  onBack,
  activePlan,
  setActivePlan,
  addXP,
  onStartWorkout,
}) => {
  const { theme } = useTheme();
  const [selectedGoal, setSelectedGoal] = useState<string>("Weight Loss");
  const [selectedLevel, setSelectedLevel] = useState<string>("Beginner");
  const [generatedPlan, setGeneratedPlan] = useState<ActivePlan | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<string[]>([]);

  const generatePlan = () => {
    const template = PLAN_TEMPLATES[selectedGoal]?.[selectedLevel];
    if (!template) return;

    const newPlan: ActivePlan = {
      id: `plan-${Date.now()}`,
      goal: selectedGoal,
      level: selectedLevel,
      week: 1,
      totalWeeks: template.totalWeeks,
      progress: 0,
      name: template.name,
      exercises: template.exercises.map((ex) => ({ ...ex, completed: false })),
    };

    setGeneratedPlan(newPlan);
  };

  const startPlan = () => {
    if (generatedPlan) {
      setActivePlan(generatedPlan);
      setGeneratedPlan(null);
    }
  };

  const completeWorkout = (exerciseName: string) => {
    if (!activePlan) return;

    const updatedExercises = activePlan.exercises.map((ex) =>
      ex.name === exerciseName ? { ...ex, completed: true } : ex,
    );

    const completedCount = updatedExercises.filter((ex) => ex.completed).length;
    const progress = Math.round(
      (completedCount / updatedExercises.length) * 100,
    );

    const updatedPlan = {
      ...activePlan,
      exercises: updatedExercises,
      progress,
      week:
        progress === 100
          ? Math.min(activePlan.week + 1, activePlan.totalWeeks)
          : activePlan.week,
    };

    setActivePlan(updatedPlan);

    if (progress === 100 && addXP) {
      addXP(150);
    }
  };

  const currentPlan = activePlan || generatedPlan;

  return (
    <div
      className="plans-screen"
      data-theme={theme === "light" ? "light" : "dark"}
    >
      <div className="plans-header">
        <button onClick={onBack} className="back-button">
          <ArrowLeft size={20} />
          Back
        </button>
        <h1>Workout Plans</h1>
      </div>

      <div className="plans-content">
        {!activePlan && (
          <div className="plan-generator">
            <div className="selector-group">
              <h3>Goal</h3>
              <div className="option-buttons">
                {["Weight Loss", "Strength Building", "Endurance"].map(
                  (goal) => (
                    <button
                      key={goal}
                      className={`option-btn ${selectedGoal === goal ? "active" : ""}`}
                      onClick={() => setSelectedGoal(goal)}
                    >
                      {goal}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="selector-group">
              <h3>Experience Level</h3>
              <div className="option-buttons">
                {["Beginner", "Intermediate", "Advanced"].map((level) => (
                  <button
                    key={level}
                    className={`option-btn ${selectedLevel === level ? "active" : ""}`}
                    onClick={() => setSelectedLevel(level)}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <button onClick={generatePlan} className="generate-plan-btn">
              <Target size={18} />
              Generate My Plan
            </button>
          </div>
        )}

        {currentPlan && (
          <div className="active-plan-detail">
            <div className="plan-header">
              <h2>{currentPlan.name}</h2>
              <div className="plan-meta">
                {currentPlan.goal} • {currentPlan.level} • Week{" "}
                {currentPlan.week}/{currentPlan.totalWeeks}
              </div>
            </div>

            <div className="progress-section">
              <div className="progress-bar-large">
                <div
                  className="progress-fill"
                  style={{ width: `${currentPlan.progress}%` }}
                />
              </div>
              <span>{currentPlan.progress}% Complete</span>
            </div>

            <div className="weekly-schedule">
              <h3>Weekly Schedule</h3>
              {currentPlan.exercises.map((ex, index) => (
                <div key={index} className="exercise-row">
                  <div className="exercise-info">
                    <div className="exercise-day">{ex.day}</div>
                    <div className="exercise-name">{ex.name}</div>
                    <div className="exercise-sets">
                      {ex.sets} sets × {ex.reps}
                    </div>
                  </div>
                  <button
                    className={`complete-btn ${ex.completed ? "completed" : ""}`}
                    onClick={() => completeWorkout(ex.name)}
                    disabled={ex.completed}
                  >
                    {ex.completed ? (
                      <CheckCircle size={20} />
                    ) : (
                      <Play size={18} />
                    )}
                    {ex.completed ? "Done" : "Start"}
                  </button>
                </div>
              ))}
            </div>

            {generatedPlan && (
              <button onClick={startPlan} className="start-plan-btn">
                Activate This Plan
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkoutPlansScreen;
