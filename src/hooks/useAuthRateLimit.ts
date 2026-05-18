import { useCallback, useEffect, useState } from 'react';

const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;
const STORAGE_KEY = 'spectrax.authRateLimit';

interface RateLimitState {
  attempts: number;
  lockedUntil: number | null;
}

function loadState(key: string): RateLimitState {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}.${key}`);
    if (!raw) return { attempts: 0, lockedUntil: null };
    return JSON.parse(raw) as RateLimitState;
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function saveState(key: string, state: RateLimitState) {
  localStorage.setItem(`${STORAGE_KEY}.${key}`, JSON.stringify(state));
}

export function useAuthRateLimit(scope: 'login' | 'forgot-password' = 'login') {
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const stored = loadState(scope);
    setAttempts(stored.attempts);
    setLockedUntil(stored.lockedUntil);
  }, [scope]);

  useEffect(() => {
    if (!lockedUntil) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        setLockedUntil(null);
        setAttempts(0);
        saveState(scope, { attempts: 0, lockedUntil: null });
      }
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [lockedUntil, scope]);

  const isLocked = secondsLeft > 0;

  const recordFailure = useCallback(() => {
    if (isLocked) return;

    const nextAttempts = attempts + 1;
    const nextLockedUntil =
      nextAttempts >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_SECONDS * 1000 : null;

    setAttempts(nextAttempts);
    setLockedUntil(nextLockedUntil);
    saveState(scope, { attempts: nextAttempts, lockedUntil: nextLockedUntil });
  }, [attempts, isLocked, scope]);

  const recordSuccess = useCallback(() => {
    setAttempts(0);
    setLockedUntil(null);
    saveState(scope, { attempts: 0, lockedUntil: null });
  }, [scope]);

  const isRateLimitError = useCallback((message: string | null) => {
    if (!message) return false;
    const lower = message.toLowerCase();
    return lower.includes('too many') || lower.includes('429');
  }, []);

  return {
    isLocked,
    secondsLeft,
    attempts,
    maxAttempts: MAX_ATTEMPTS,
    recordFailure,
    recordSuccess,
    isRateLimitError,
  };
}
