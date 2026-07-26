import React, { useState, useEffect } from 'react';
import { GeneratedRoutine } from '../../services/aiRoutineGenerator';
import './RoutinePlayer.css';

interface RoutinePlayerProps {
  routine: GeneratedRoutine;
  onComplete: () => void;
  onExit: () => void;
}

export const RoutinePlayer: React.FC<RoutinePlayerProps> = ({
  routine,
  onComplete,
  onExit,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restCountdown, setRestCountdown] = useState(0);
  const [repCount, setRepCount] = useState(0);

  const currentStep = routine.steps[currentStepIndex];

  // Rest countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isResting && restCountdown > 0) {
      timer = setInterval(() => {
        setRestCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isResting && restCountdown === 0) {
      setIsResting(false);
      setRepCount(0);
    }
    return () => clearInterval(timer);
  }, [isResting, restCountdown]);

  const handleNextSet = () => {
    if (currentSet < currentStep.sets) {
      setCurrentSet((prev) => prev + 1);
      if (currentStep.restSecs > 0) {
        setIsResting(true);
        setRestCountdown(currentStep.restSecs);
      }
    } else {
      // Advance to next exercise step
      if (currentStepIndex < routine.steps.length - 1) {
        setCurrentStepIndex((prev) => prev + 1);
        setCurrentSet(1);
        if (currentStep.restSecs > 0) {
          setIsResting(true);
          setRestCountdown(currentStep.restSecs);
        }
      } else {
        // Routine completed
        onComplete();
      }
    }
  };

  return (
    <div className="routine-player-container">
      <div className="player-header">
        <span className="routine-title-badge">🎯 {routine.title}</span>
        <button className="exit-player-btn" onClick={onExit}>
          ✕ Exit
        </button>
      </div>

      <div className="player-progress-bar">
        <div
          className="player-progress-fill"
          style={{
            width: `${((currentStepIndex + 1) / routine.steps.length) * 100}%`,
          }}
        />
      </div>

      {isResting ? (
        <div className="rest-timer-card">
          <h2>🧘 Rest & Recovery</h2>
          <div className="timer-countdown">{restCountdown}s</div>
          <p>Get ready for Set {currentSet} of {currentStep.exercise.name}</p>
          <button className="skip-rest-btn" onClick={() => setIsResting(false)}>
            Skip Rest ⏭️
          </button>
        </div>
      ) : (
        <div className="active-exercise-card">
          <div className="step-indicator">
            Step {currentStepIndex + 1} of {routine.steps.length} • Set {currentSet} of {currentStep.sets}
          </div>
          <h2 className="ex-name">{currentStep.exercise.name}</h2>
          <p className="ex-instructions">{currentStep.exercise.instructions}</p>

          <div className="rep-counter-display">
            <span className="rep-count">{repCount}</span>
            <span className="rep-target">/ {currentStep.reps} Reps</span>
          </div>

          <div className="rep-controls">
            <button className="rep-btn" onClick={() => setRepCount((r) => Math.max(0, r - 1))}>
              -1
            </button>
            <button className="rep-btn primary" onClick={() => setRepCount((r) => r + 1)}>
              +1 Rep
            </button>
          </div>

          <button
            className="complete-set-btn"
            onClick={handleNextSet}
          >
            {currentSet === currentStep.sets && currentStepIndex === routine.steps.length - 1
              ? '🎉 Complete Routine'
              : 'Complete Set ➔'}
          </button>
        </div>
      )}
    </div>
  );
};
