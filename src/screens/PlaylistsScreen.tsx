import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import useThemeStore from '../store/useThemeStore';

export default function PlaylistsScreen() {
  const { colors } = useThemeStore();

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="px-5 py-3.5">
        <Text className="text-[22px] font-bold" style={{ color: colors.text }}>Playlists</Text>
      </View>
      <View className="flex-1 justify-center items-center px-10">
        <Ionicons name="albums-outline" size={64} color={colors.textMuted} />
        <Text className="text-xl font-semibold mt-4" style={{ color: colors.text }}>No Playlists Yet</Text>
        <Text className="text-sm mt-2 text-center" style={{ color: colors.textSecondary }}>
          Create playlists to organize your music
        </Text>
      </View>
    </SafeAreaView>
  );
}
