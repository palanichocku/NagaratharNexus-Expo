// src/theme/ThemeProvider.tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '../lib/supabase';
import { themes, ThemeName, AppTheme } from './themes';

const STORAGE_KEY = 'NN_THEME_V1';

type ThemeContextValue = {
  theme: AppTheme;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
  availableThemes: ThemeName[];
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

async function readGlobalThemeName(): Promise<'warm' | 'cool' | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'global_config')
      .maybeSingle();

    if (error) return null;

    const t = (data?.value as any)?.themeName;
    const s = String(t || '').toLowerCase();
    if (s === 'warm' || s === 'cool') return s;
    return null;
  } catch {
    return null;
  }
}

async function readThemeName(): Promise<ThemeName | null> {
  try {
    if (Platform.OS === 'web') {
      const v = window.localStorage.getItem(STORAGE_KEY);
      return (v as ThemeName) || null;
    }
    const v = await AsyncStorage.getItem(STORAGE_KEY);
    return (v as ThemeName) || null;
  } catch {
    return null;
  }
}

async function writeThemeName(name: ThemeName): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(STORAGE_KEY, name);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, name);
  } catch {
    // ignore persist errors
  }
}

function normalizeThemeName(v: any): ThemeName | null {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'warm' || s === 'cool') return s;
  return null;
}

async function fetchGlobalThemeName(): Promise<ThemeName | null> {
  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'global_config')
      .maybeSingle();

    if (error) return null;

    const cfg = (data?.value ?? {}) as any;
    // Prefer themeName; allow legacy keys if you ever had them
    return normalizeThemeName(cfg.themeName ?? cfg.theme ?? cfg.uiTheme);
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const availableThemes = useMemo(() => Object.keys(themes) as ThemeName[], []);
  const [themeName, setThemeNameState] = useState<ThemeName>('warm');

  // Prevent duplicate initial sync work
  const didInitRef = useRef(false);

  const setThemeName = useCallback((name: ThemeName) => {
    if (!themes[name]) return;
    setThemeNameState(name);
    void writeThemeName(name);
  }, []);

  const syncFromGlobal = useCallback(async () => {
    const global = await fetchGlobalThemeName();
    if (global && themes[global]) {
      setThemeNameState(global);
      void writeThemeName(global); // keep local in sync with global
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      // 1) Local first (fast)
      const savedLocal = await readThemeName();
      if (!mounted) return;
      if (savedLocal && themes[savedLocal]) setThemeNameState(savedLocal);

      // 2) Global overrides (authoritative)
      await syncFromGlobal();
    })();

    return () => {
      mounted = false;
    };
  }, [syncFromGlobal]);

  // Optional: live updates when admin changes global_config
  useEffect(() => {
    const channel = supabase
      .channel('nn-system-settings-theme')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_settings', filter: 'key=eq.global_config' },
        async () => {
          await syncFromGlobal();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [syncFromGlobal]);

  // Optional: when app returns to foreground, re-sync (mobile)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') void syncFromGlobal();
    });
    return () => sub.remove();
  }, [syncFromGlobal]);

  const value = useMemo<ThemeContextValue>(() => {
    return {
      theme: themes[themeName],
      themeName,
      setThemeName,
      availableThemes,
    };
  }, [availableThemes, setThemeName, themeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used inside ThemeProvider');
  return ctx;
}