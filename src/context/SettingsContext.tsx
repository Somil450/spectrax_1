import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  voiceFeedback: boolean;
  cameraFlipped: boolean;
  showSkeleton: boolean;
  bodyType: 'ecto' | 'meso' | 'endo' | 'default';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

const defaultSettings: UserSettings = {
  theme: 'dark',
  soundEnabled: true,
  voiceFeedback: true,
  cameraFlipped: true,
  showSkeleton: true,
  bodyType: 'default',
  difficulty: 'beginner',
};

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const SETTINGS_STORAGE_KEY = 'spectrax_user_settings_v1';

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings>(() => {
    if (typeof window === 'undefined') return defaultSettings;
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (stored) {
        return { ...defaultSettings, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to parse settings from local storage', e);
    }
    return defaultSettings;
  });

  // Sync settings to local storage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      } catch (e) {
        console.error('Failed to save settings to local storage', e);
      }
    }
  }, [settings]);

  // Sync state if local storage changes from another tab/window
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === SETTINGS_STORAGE_KEY && e.newValue) {
        try {
          const newSettings = JSON.parse(e.newValue);
          setSettings(prev => ({ ...prev, ...newSettings }));
        } catch (error) {
          console.error('Error parsing settings from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newSettings,
    }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
