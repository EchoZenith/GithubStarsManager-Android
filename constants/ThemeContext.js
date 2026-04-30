import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from '../services/database';
import { lightTheme, darkTheme } from './theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState('light');

  useEffect(() => {
    (async () => {
      const saved = await getSetting('theme_mode');
      if (saved === 'light' || saved === 'dark') {
        setMode(saved);
      } else if (saved === 'system') {
        setMode(systemScheme === 'dark' ? 'dark' : 'light');
      } else {
        setMode(systemScheme === 'dark' ? 'dark' : 'light');
      }
    })();
  }, []);

  const theme = mode === 'dark' ? darkTheme : lightTheme;

  const toggleTheme = useCallback(async (newMode) => {
    setMode(newMode);
    await setSetting('theme_mode', newMode);
  }, []);

  return (
    <ThemeContext.Provider value={{ ...theme, mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { ...lightTheme, mode: 'light', toggleTheme: () => { } };
  return ctx;
}
