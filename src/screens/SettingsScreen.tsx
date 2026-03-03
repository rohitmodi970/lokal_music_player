import { Ionicons } from '@expo/vector-icons';
import React from 'react';
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

import useThemeStore from '../store/useThemeStore';

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  colors: any;
}

function SettingRow({ icon, label, subtitle, onPress, rightElement, colors }: SettingRowProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center px-3.5 py-3.5 border-b-[0.5px]"
      style={{ borderBottomColor: colors.border }}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress && !rightElement}
    >
      <View
        className="w-9 h-9 rounded-[10px] justify-center items-center mr-3"
        style={{ backgroundColor: colors.primary + '15' }}
      >
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-medium" style={{ color: colors.text }}>{label}</Text>
        {subtitle ? (
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>{subtitle}</Text>
        ) : null}
      </View>
      {rightElement || (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { colors, isDark, toggleTheme } = useThemeStore();

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="px-5 py-3.5">
        <Text className="text-[22px] font-bold" style={{ color: colors.text }}>Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <Text
          className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1"
          style={{ color: colors.textSecondary }}
        >APPEARANCE</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="moon-outline"
            label="Dark Mode"
            subtitle={isDark ? 'On' : 'Off'}
            colors={colors}
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

        {/* Playback Section */}
        <Text
          className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1"
          style={{ color: colors.textSecondary }}
        >PLAYBACK</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="volume-high-outline"
            label="Audio Quality"
            subtitle="High (320kbps)"
            colors={colors}
            onPress={() => Alert.alert('Audio Quality', 'High quality streaming is enabled.')}
          />
          <SettingRow
            icon="download-outline"
            label="Download Quality"
            subtitle="High (320kbps)"
            colors={colors}
            onPress={() => Alert.alert('Download Quality', 'High quality downloads enabled.')}
          />
          <SettingRow
            icon="timer-outline"
            label="Sleep Timer"
            subtitle="Off"
            colors={colors}
            onPress={() => Alert.alert('Sleep Timer', 'Sleep timer feature coming soon.')}
          />
        </View>

        {/* General Section */}
        <Text
          className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1"
          style={{ color: colors.textSecondary }}
        >GENERAL</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="language-outline"
            label="Language"
            subtitle="English"
            colors={colors}
            onPress={() => Alert.alert('Language', 'Only English is supported currently.')}
          />
          <SettingRow
            icon="notifications-outline"
            label="Notifications"
            subtitle="Enabled"
            colors={colors}
            onPress={() => Linking.openSettings()}
          />
        </View>

        {/* About Section */}
        <Text
          className="text-xs font-bold tracking-wider mt-5 mb-2 ml-1"
          style={{ color: colors.textSecondary }}
        >ABOUT</Text>
        <View className="rounded-xl overflow-hidden" style={{ backgroundColor: colors.surface }}>
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            subtitle="1.0.0"
            colors={colors}
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            colors={colors}
            onPress={() => Alert.alert('Privacy Policy', 'Privacy policy will be available soon.')}
          />
          <SettingRow
            icon="document-text-outline"
            label="Terms of Service"
            colors={colors}
            onPress={() => Alert.alert('Terms', 'Terms of service will be available soon.')}
          />
        </View>

        <View className="h-[100px]" />
      </ScrollView>
    </SafeAreaView>
  );
}
