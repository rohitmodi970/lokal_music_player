import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Image,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import useThemeStore from '../store/useThemeStore';
import { Song } from '../types';
import { getArtistName, getImageUrl } from '../utils/helpers';

interface SongItemProps {
  song: Song;
  index: number;
  isActive?: boolean;
  onPress: (song: Song, index: number) => void;
  onOptionsPress?: (song: Song) => void;
}

export default function SongItem({
  song,
  index,
  isActive,
  onPress,
  onOptionsPress,
}: SongItemProps) {
  const { colors } = useThemeStore();
  const imageUrl = getImageUrl(song.image, '150x150');
  const artistName = getArtistName(song);
  const dur =
    typeof song.duration === 'string'
      ? parseInt(song.duration, 10)
      : song.duration || 0;
  const minutes = Math.floor(dur / 60);
  const seconds = dur % 60;
  const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} mins`;

  return (
    <TouchableOpacity
      className="flex-row items-center py-2.5 px-5"
      onPress={() => onPress(song, index)}
      activeOpacity={0.7}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} className="w-14 h-14 rounded-[10px]" style={{ backgroundColor: colors.surface }} />
      ) : (
        <View className="w-14 h-14 rounded-[10px] justify-center items-center" style={{ backgroundColor: colors.surface }}>
          <Ionicons name="musical-note" size={22} color={colors.textMuted} />
        </View>
      )}

      <View className="flex-1 ml-3.5">
        <Text
          className="text-[15px] font-semibold mb-1"
          style={{ color: isActive ? colors.primary : colors.text }}
          numberOfLines={1}
        >
          {song.name}
        </Text>
        <Text className="text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>
          {artistName}  |  {durationStr}
        </Text>
      </View>

      <TouchableOpacity
        className="w-[34px] h-[34px] rounded-[17px] border-2 justify-center items-center ml-2"
        style={{ borderColor: colors.primary }}
        onPress={() => onPress(song, index)}
      >
        <Ionicons name="play" size={16} color={colors.primary} />
      </TouchableOpacity>

      <TouchableOpacity
        className="p-2 ml-0.5"
        onPress={() => onOptionsPress?.(song)}
      >
        <Ionicons
          name="ellipsis-vertical"
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}
