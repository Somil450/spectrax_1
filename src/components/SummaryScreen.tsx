import React, { useEffect, useState } from "react";
import { useWorkoutSync } from "../hooks/useWorkoutSync";

interface SessionStats {
  reps: number;
  totalReps: number;
  correctReps: number;
  repScores: number[];
  duration: number;
  accuracy: number;
  exerciseName?: string;
  mistakes: Record<string, number>;
  bestStreak: number;
  tags?: string[];
}

interface SummaryScreenProps {
  stats: SessionStats;
  leveling?: any;
  onRestart: () => void;
  onViewReplay: () => void;
}

export const SummaryScreen: React.FC<SummaryScreenProps> = ({
  stats,
  onRestart,
  onViewReplay,
}) => {
  const [accuracyDisplay, setAccuracyDisplay] = useState(0);
  const { addWorkout } = useWorkoutSync();
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setAccuracyDisplay(stats.accuracy), 200);
    return () => clearTimeout(t);
  }, [stats.accuracy]);

  useEffect(() => {
    if (!addWorkout) return;
    if (stats.totalReps === 0) return;

    const save = async () => {
      setIsSavingWorkout(true);
      try {
        await addWorkout({
          exerciseType: (stats.exerciseName || "exercise").toLowerCase(),
          totalReps: stats.totalReps,
          accuracyScore: stats.accuracy,
          duration: stats.duration,
          timestamp: Date.now(),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setIsSavingWorkout(false);
      }
    };
    save();
  }, [stats, addWorkout]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="screen-container" style={{ padding: 24 }}>
      <h2>Session Summary</h2>
      <div>
        <div>Accuracy: {accuracyDisplay}%</div>
        <div>Reps: {stats.totalReps}</div>
        <div>Duration: {formatTime(stats.duration)}</div>
        <div>
          Best Mistake: {Object.keys(stats.mistakes || {})[0] || "None"}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={onViewReplay}>View Replay</button>
        <button onClick={onRestart} style={{ marginLeft: 8 }}>
          Restart
        </button>
        {isSavingWorkout && <span style={{ marginLeft: 8 }}>Saving…</span>}
      </div>
    </div>
  );
};

export default SummaryScreen;
