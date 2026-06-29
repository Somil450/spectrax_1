import { useState, useEffect } from 'react';

const XP_PER_REP = 10;
const STORAGE_KEY = 'spectrax_user_xp';

export function calculateLevel(xp: number): number {
  if (!Number.isFinite(xp) || xp < 100) return 1;
  if (xp < 250) return 2;
  if (xp < 500) return 3;
  if (xp < 1000) return 4;
  if (xp < 2000) return 5;
  if (xp < 4000) return 6;
  if (xp < 8000) return 7;
  return 8 + Math.floor((xp - 8000) / 5000);
}

export function calculateXPForNextLevel(level: number): number {
  if (level === 1) return 100;
  if (level === 2) return 250;
  if (level === 3) return 500;
  if (level === 4) return 1000;
  if (level === 5) return 2000;
  if (level === 6) return 4000;
  if (level === 7) return 8000;
  return 8000 + (level - 7) * 5000;
}

export function useLeveling() {
  const [xp, setXp] = useState<number>(0);

  useEffect(() => {
    const storedXp = localStorage.getItem(STORAGE_KEY);
    if (storedXp) {
      const parsed = parseInt(storedXp, 10);
      setXp(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
    }
  }, []);

  const addXpFromReps = (reps: number) => {
    const gainedXp = Number.isFinite(reps) && reps > 0 ? reps * XP_PER_REP : 0;
    setXp((prevXp) => {
      const safePrev = Number.isFinite(prevXp) ? prevXp : 0;
      const newXp = safePrev + gainedXp;
      localStorage.setItem(STORAGE_KEY, newXp.toString());
      return newXp;
    });
    return gainedXp;
  };

  const currentLevel = calculateLevel(xp);
  const nextLevelXp = calculateXPForNextLevel(currentLevel);
  const prevLevelXp = currentLevel === 1 ? 0 : calculateXPForNextLevel(currentLevel - 1);
  const progress = ((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100;

  return {
    xp,
    level: currentLevel,
    progress,
    nextLevelXp,
    addXpFromReps
  };
}
