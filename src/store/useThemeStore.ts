import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

const THEME_KEY = '@lokal_theme_mode';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  card: string;
  accent: string;
  accentLight: string;
  accentDark: string;
  primary: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  text: string;
  border: string;
  error: string;
  success: string;
  white: string;
  black: string;
  miniPlayerBg: string;
  tabBar: string;
  tabBarInactive: string;
  seekBarTrack: string;
  seekBarFill: string;
  progressBackground: string;
  overlay: string;
  modalBg: string;
}

const LIGHT: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceElevated: '#EEEEEE',
  card: '#FFFFFF',
  accent: '#F97316',
  accentLight: '#FFF3E8',
  accentDark: '#EA580C',
  primary: '#F97316',
  textPrimary: '#1A1A1A',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  text: '#1A1A1A',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#22C55E',
  white: '#FFFFFF',
  black: '#000000',
  miniPlayerBg: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarInactive: '#9CA3AF',
  seekBarTrack: '#E5E7EB',
  seekBarFill: '#F97316',
  progressBackground: '#E5E7EB',
  overlay: 'rgba(0,0,0,0.5)',
  modalBg: '#FFFFFF',
};

const DARK: ThemeColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#2A2A2A',
  card: '#1E1E1E',
  accent: '#F97316',
  accentLight: '#2A1A0A',
  accentDark: '#EA580C',
  primary: '#F97316',
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  text: '#FFFFFF',
  border: '#2A2A2A',
  error: '#EF4444',
  success: '#22C55E',
  white: '#FFFFFF',
  black: '#000000',
  miniPlayerBg: '#1E1E1E',
  tabBar: '#1A1A1A',
  tabBarInactive: '#6B7280',
  seekBarTrack: '#3A3A3A',
  seekBarFill: '#F97316',
  progressBackground: '#3A3A3A',
  overlay: 'rgba(0,0,0,0.7)',
  modalBg: '#1E1E1E',
};

interface ThemeState {
  mode: ThemeMode;
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

const useThemeStore = create<ThemeState>((set, get) => ({
  mode: 'dark',
  colors: DARK,
  isDark: true,

  toggleTheme: () => {
    const newMode = get().mode === 'light' ? 'dark' : 'light';
    const colors = newMode === 'dark' ? DARK : LIGHT;
    set({ mode: newMode, colors, isDark: newMode === 'dark' });
    AsyncStorage.setItem(THEME_KEY, newMode);
  },

  setTheme: (mode: ThemeMode) => {
    const colors = mode === 'dark' ? DARK : LIGHT;
    set({ mode, colors, isDark: mode === 'dark' });
    AsyncStorage.setItem(THEME_KEY, mode);
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored === 'dark' || stored === 'light') {
        const colors = stored === 'dark' ? DARK : LIGHT;
        set({ mode: stored, colors, isDark: stored === 'dark' });
      }
    } catch {}
  },
}));

export default useThemeStore;
