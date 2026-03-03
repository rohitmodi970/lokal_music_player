import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Linking,
    ScrollView,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { togglePlayPause } from '../audio/audioManager';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { clearAllCache } from '../utils/cache';

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  colors: any;
  isLast?: boolean;
}

function SettingRow({ icon, label, subtitle, onPress, rightElement, colors, isLast }: SettingRowProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-3.5 py-3.5"
      style={{ borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: colors.border }}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress && !rightElement}
    >
      <View
        className="w-9 h-9 rounded-[10px] justify-center items-center mr-3"
        style={{ backgroundColor: colors.primary + '18' }}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-medium" style={{ color: colors.text }}>{label}</Text>
        {subtitle ? (
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>{subtitle}</Text>
        ) : null}
      </View>
      {rightElement ?? (onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null)}
    </TouchableOpacity>
  );
}

const SLEEP_OPTIONS = [
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '30 minutes', ms: 30 * 60 * 1000 },
  { label: '45 minutes', ms: 45 * 60 * 1000 },
  { label: '1 hour', ms: 60 * 60 * 1000 },
];

function formatCountdown(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useThemeStore();
  const { isPlaying } = usePlayerStore();

  // Sleep timer
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const sleepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear any existing timer
  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    sleepTimerRef.current = null;
    countdownRef.current = null;
    setSleepRemaining(null);
  };

  const startSleepTimer = (ms: number) => {
    cancelSleepTimer();
    setSleepRemaining(ms);

    // Tick every second
    let remaining = ms;
    countdownRef.current = setInterval(() => {
      remaining -= 1000;
      if (remaining <= 0) {
        cancelSleepTimer();
      } else {
        setSleepRemaining(remaining);
      }
    }, 1000);

    // When time's up — pause playback
    sleepTimerRef.current = setTimeout(() => {
      cancelSleepTimer();
      if (isPlaying) togglePlayPause();
      Alert.alert('Sleep Timer', 'Playback paused. Goodnight! 🌙');
    }, ms);
  };

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearTimeout(sleepTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const handleSleepTimer = () => {
    if (sleepRemaining !== null) {
      Alert.alert(
        'Sleep Timer',
        `Time remaining: ${formatCountdown(sleepRemaining)}`,
        [
          { text: 'Cancel Timer', style: 'destructive', onPress: () => { cancelSleepTimer(); Alert.alert('Sleep Timer', 'Timer cancelled.'); } },
          { text: 'Keep Running', style: 'cancel' },
        ],
      );
      return;
    }

    Alert.alert(
      'Sleep Timer',
      'Pause music after:',
      [
        ...SLEEP_OPTIONS.map((opt) => ({
          text: opt.label,
          onPress: () => {
            startSleepTimer(opt.ms);
            Alert.alert('Sleep Timer Set', `Music will pause in ${opt.label} 🌙`);
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will remove all cached search results and song data. Your playlists and favorites will not be affected.',
      [
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            Alert.alert('Cache Cleared', 'Cache has been cleared successfully ✓');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleEqualizer = () => {
    Alert.alert(
      'Equalizer',
      'To adjust audio settings, open your device\'s built-in equalizer or music settings.',
      [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleAudioQuality = () => {
    Alert.alert(
      'Audio Quality',
      'Lokal streams at the highest available quality from JioSaavn (up to 320kbps).',
      [{ text: 'OK' }],
    );
  };

  const handleAbout = () => {
    Alert.alert(
      'About Lokal',
      'Lokal Music Player v1.0.0\n\nBuilt with React Native & Expo\n\nStreaming powered by JioSaavn\nAI powered by Gemini & Lokal AI',
      [{ text: 'OK' }],
    );
  };

  const handleFeedback = () => {
    Linking.openURL('mailto:feedback@lokal.app?subject=Lokal%20App%20Feedback').catch(
      () => Alert.alert('Feedback', 'Send your feedback to feedback@lokal.app'),
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="px-5 py-3.5">
        <Text className="text-[22px] font-bold" style={{ color: colors.text }}>Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>

        {/* Appearance */}
        <Text className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1" style={{ color: colors.textSecondary }}>APPEARANCE</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            subtitle={isDark ? 'On' : 'Off'}
            colors={colors}
            isLast
            rightElement={
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: '#D1D5DB', true: colors.primary + '80' }}
                thumbColor={isDark ? colors.primary : '#F3F4F6'}
              />
            }
          />
        </View>

        {/* Playback */}
        <Text className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1" style={{ color: colors.textSecondary }}>PLAYBACK</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="musical-notes-outline"
            label="Audio Quality"
            subtitle="High (320kbps)"
            colors={colors}
            onPress={handleAudioQuality}
          />
          <SettingRow
            icon="options-outline"
            label="Equalizer"
            subtitle="Open device equalizer"
            colors={colors}
            onPress={handleEqualizer}
          />
          <SettingRow
            icon="timer-outline"
            label="Sleep Timer"
            subtitle={sleepRemaining !== null ? `Stops in ${formatCountdown(sleepRemaining)}` : 'Off'}
            colors={colors}
            onPress={handleSleepTimer}
            isLast
            rightElement={sleepRemaining !== null ? (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + '20' }}>
                <Text className="text-xs font-semibold" style={{ color: colors.primary }}>
                  {formatCountdown(sleepRemaining)}
                </Text>
              </View>
            ) : undefined}
          />
        </View>

        {/* Storage */}
        <Text className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1" style={{ color: colors.textSecondary }}>STORAGE</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="trash-outline"
            label="Clear Cache"
            subtitle="Remove cached search results"
            colors={colors}
            onPress={handleClearCache}
            isLast
          />
        </View>

        {/* General */}
        <Text className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1" style={{ color: colors.textSecondary }}>GENERAL</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            subtitle="Manage notification permissions"
            colors={colors}
            onPress={() => Linking.openSettings()}
          />
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Send Feedback"
            subtitle="Help us improve Lokal"
            colors={colors}
            onPress={handleFeedback}
            isLast
          />
        </View>

        {/* About */}
        <Text className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1" style={{ color: colors.textSecondary }}>ABOUT</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="information-circle-outline"
            label="About Lokal"
            subtitle="Version 1.0.0"
            colors={colors}
            onPress={handleAbout}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            colors={colors}
            onPress={() => Alert.alert('Privacy Policy', 'Your data is stored locally on your device. We do not sell or share personal information.')}
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            colors={colors}
            onPress={() => Alert.alert('Terms of Service', 'By using Lokal, you agree to use the app for personal, non-commercial purposes only.')}
            isLast
          />
        </View>

        <View className="h-[100px]" />
      </ScrollView>
    </SafeAreaView>
  );
}
