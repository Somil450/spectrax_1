import React from 'react';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme = 'cyber-dark' | 'retro' | 'light';

export const VALID_THEMES: Theme[] = ['cyber-dark', 'retro', 'light'];

export function sanitizeTheme(val: unknown): Theme {
  if (typeof val === 'string' && VALID_THEMES.includes(val as Theme)) {
    return val as Theme;
  }
  if (val === 'dark') {
    return 'cyber-dark';
  }
  return 'cyber-dark'; // Secure fallback
}

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // 1. Check localStorage first
    const saved = localStorage.getItem('spectrax-theme');
    const validated = sanitizeTheme(saved);
    if (saved) return validated;
    
    // 2. Fallback to system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'cyber-dark' : 'light';
  });

  useEffect(() => {
    const validatedTheme = sanitizeTheme(theme);
    
    // Apply dual-attributes: data-theme for legacy compatibility, data-theme-style for specific themes
    document.documentElement.setAttribute('data-theme', validatedTheme === 'light' ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme-style', validatedTheme);
    
    localStorage.setItem('spectrax-theme', validatedTheme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      if (prev === 'cyber-dark') return 'retro';
      if (prev === 'retro') return 'light';
      return 'cyber-dark';
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
