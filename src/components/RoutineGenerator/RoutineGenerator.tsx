import React, { useState } from 'react';
import {
  aiRoutineGenerator,
  UserGoal,
  GeneratedRoutine,
} from '../../services/aiRoutineGenerator';
import { DifficultyLevel } from '../../config/routineExercises';
import './RoutineGenerator.css';

interface RoutineGeneratorProps {
  onStartRoutine: (routine: GeneratedRoutine) => void;
  onCancel?: () => void;
}

export const RoutineGenerator: React.FC<RoutineGeneratorProps> = ({
  onStartRoutine,
  onCancel,
}) => {
  const [goal, setGoal] = useState<UserGoal>('full_body');
  const [duration, setDuration] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('beginner');
  const [routine, setRoutine] = useState<GeneratedRoutine | null>(null);

  const handleGenerate = () => {
    const generated = aiRoutineGenerator.generateRoutine({
      goal,
      targetDurationMinutes: duration,
      difficulty,
    });
    setRoutine(generated);
  };

  return (
    <div className="routine-generator-container">
      <h2 className="routine-gen-title">🤖 AI Custom Routine Generator</h2>
      <p className="routine-gen-subtitle">
        Select your fitness goals and available time to generate a balanced, personalized AI workout plan.
      </p>

      <div className="routine-gen-form">
        <div className="form-group">
          <label>Target Goal:</label>
          <select value={goal} onChange={(e) => setGoal(e.target.value as UserGoal)}>
            <option value="full_body">🔥 Full-Body Conditioning</option>
            <option value="fat_loss">⚡ High-Intensity Fat Loss</option>
            <option value="leg_strength">🦵 Leg & Lower Body Strength</option>
            <option value="upper_strength">💪 Upper Body Power</option>
            <option value="core_stability">🛡️ Core Stability & Abs</option>
          </select>
        </div>

        <div className="form-group">
          <label>Workout Duration: {duration} Minutes</label>
          <input
            type="range"
            min="5"
            max="30"
            step="5"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>

        <div className="form-group">
          <label>Fitness Level:</label>
          <div className="btn-group">
            {(['beginner', 'intermediate', 'advanced'] as DifficultyLevel[]).map((level) => (
              <button
                key={level}
                type="button"
                className={`level-btn ${difficulty === level ? 'active' : ''}`}
                onClick={() => setDifficulty(level)}
              >
                {level.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="generate-btn" onClick={handleGenerate}>
          ✨ Generate AI Routine
        </button>
      </div>

      {routine && (
        <div className="routine-preview-card">
          <h3>{routine.title}</h3>
          <p>{routine.description}</p>

          <div className="routine-meta">
            <span>⏱️ Est. Time: ~{routine.estimatedDurationMinutes} mins</span>
            <span>🔥 Est. Burn: ~{routine.totalCalories} kcal</span>
            <span>🎯 Exercises: {routine.steps.length}</span>
          </div>

          <div className="routine-steps-list">
            <h4>Exercise Sequence:</h4>
            {routine.steps.map((step, idx) => (
              <div key={idx} className="step-item">
                <span className="step-num">{idx + 1}.</span>
                <span className="step-name">{step.exercise.name}</span>
                <span className="step-details">
                  {step.sets} Set{step.sets > 1 ? 's' : ''} × {step.reps} Reps (Rest {step.restSecs}s)
                </span>
              </div>
            ))}
          </div>

          <div className="routine-actions">
            <button className="start-routine-btn" onClick={() => onStartRoutine(routine)}>
              🚀 Start Routine Now
            </button>
            {onCancel && (
              <button className="cancel-btn" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
