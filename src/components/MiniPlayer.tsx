import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
    Image,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { togglePlayPause } from '../audio/audioManager';
import usePlayerStore, { getCurrentSong } from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList } from '../types';
import { getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function MiniPlayer() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const { isPlaying, isLoading, positionMs, durationMs } = usePlayerStore();
  const currentSong = getCurrentSong(usePlayerStore.getState());

  if (!currentSong) return null;

  const imageUrl = getImageUrl(currentSong.image, '150x150');
  const artistName = getArtistName(currentSong);
  const progress = durationMs > 0 ? positionMs / durationMs : 0;

  return (
    <TouchableOpacity
      className="absolute bottom-0 left-0 right-0 border-t shadow-lg"
      style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.miniPlayerBg, borderTopColor: colors.border, borderTopWidth: 1, elevation: 8 }}
      activeOpacity={0.9}
      onPress={() => navigation.navigate('Player')}
    >
      {/* Progress Bar */}
      <View className="h-0.5" style={{ backgroundColor: colors.progressBackground }}>
        <View className="h-0.5" style={{ width: `${progress * 100}%`, backgroundColor: colors.primary }} />
      </View>

      <View className="flex-row items-center px-4 py-2.5 gap-3">
        {/* Album Art */}
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="w-[42px] h-[42px] rounded-lg" style={{ backgroundColor: colors.surface }} />
        ) : (
          <View className="w-[42px] h-[42px] rounded-lg justify-center items-center" style={{ backgroundColor: colors.surface }}>
            <Ionicons name="musical-note" size={18} color={colors.textMuted} />
          </View>
        )}

        {/* Song Info */}
        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color: colors.text }} numberOfLines={1}>
            {currentSong.name}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {artistName}
          </Text>
        </View>

        {/* Controls */}
        <TouchableOpacity
          className="p-2"
          onPress={(e) => {
            e.stopPropagation?.();
            togglePlayPause();
          }}
        >
          {isLoading ? (
            <Ionicons name="hourglass" size={24} color={colors.primary} />
          ) : (
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={24}
              color={colors.primary}
            />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
