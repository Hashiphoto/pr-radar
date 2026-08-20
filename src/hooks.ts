import { useCallback, useEffect, useState } from 'react';

export const useLocalStorage = <TValue,>(key: string, initial: TValue) => {
  const [value, setValue] = useState<TValue>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored === null ? initial : (JSON.parse(stored) as TValue);
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: fall back to in-memory only */
    }
  }, [key, value]);

  return [value, setValue] as const;
};

const resolveInitialTheme = (): 'light' | 'dark' => {
  const stored = window.localStorage.getItem('pr-radar.theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(resolveInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('pr-radar.theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
};

export const useTick = (intervalMs: number) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((current) => current + 1), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return tick;
};
