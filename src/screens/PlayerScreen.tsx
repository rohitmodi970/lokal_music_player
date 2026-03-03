import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
    Image,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
    seekTo,
    skipNext,
    skipPrevious,
    togglePlayPause,
} from '../audio/audioManager';
import SongOptionsModal from '../components/SongOptionsModal';
import useLibraryStore from '../store/useLibraryStore';
import usePlayerStore, { getCurrentSong } from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList } from '../types';
import { formatDuration, getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PlayerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const { width } = useWindowDimensions();
  const {
    isPlaying,
    isLoading,
    positionMs,
    durationMs,
    repeat,
    shuffle,
    toggleShuffle,
    cycleRepeat,
  } = usePlayerStore();
  const { isFavorite, toggleFavorite } = useLibraryStore();

  const [showOptions, setShowOptions] = useState(false);
  const currentSong = getCurrentSong(usePlayerStore.getState());

  const artworkSize = width - 56; // 28px padding each side

  const handleSlidingComplete = useCallback((value: number) => {
    seekTo(value);
  }, []);

  if (!currentSong) {
    return (
      <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }}>
        <View className="flex-1 justify-center items-center px-8">
          <Ionicons name="musical-notes-outline" size={72} color={colors.textMuted} />
          <Text className="text-lg font-medium mt-4 mb-6 text-center" style={{ color: colors.textSecondary }}>
            Nothing playing right now
          </Text>
          <TouchableOpacity
            className="px-8 py-3 rounded-3xl"
            style={{ backgroundColor: colors.primary }}
            onPress={() => navigation.goBack()}
          >
            <Text className="text-base font-bold" style={{ color: '#fff' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageUrl = getImageUrl(currentSong.image, '500x500');
  const artistName = getArtistName(currentSong);
  const positionSec = Math.floor(positionMs / 1000);
  const durationSec = Math.floor(durationMs / 1000);
  const liked = isFavorite(currentSong.id);

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }}>
      {/* â”€â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View className="flex-row items-center px-4 pt-2 pb-1">
        <TouchableOpacity
          className="p-2 rounded-full"
          style={{ backgroundColor: colors.surface }}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-down" size={22} color={colors.text} />
        </TouchableOpacity>

        <View className="flex-1 items-center">
          <Text className="text-[11px] font-semibold tracking-widest uppercase" style={{ color: colors.textMuted }}>
            Now Playing
          </Text>
        </View>

        <TouchableOpacity
          className="p-2 rounded-full"
          style={{ backgroundColor: colors.surface }}
          onPress={() => setShowOptions(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* â”€â”€â”€ Artwork â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View className="items-center px-7 mt-4">
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: artworkSize,
              height: artworkSize,
              borderRadius: 20,
              backgroundColor: colors.surface,
            }}
            resizeMode="cover"
          />
        ) : (
          <View
            className="justify-center items-center rounded-[20px]"
            style={{ width: artworkSize, height: artworkSize, backgroundColor: colors.surface }}
          >
            <Ionicons name="musical-note" size={80} color={colors.textMuted} />
          </View>
        )}
      </View>

      {/* â”€â”€â”€ Song Info + Like â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View className="flex-row items-center px-6 mt-5 gap-3">
        <View className="flex-1">
          <Text className="text-xl font-bold" style={{ color: colors.text }} numberOfLines={1}>
            {currentSong.name}
          </Text>
          <Text className="text-sm mt-1" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {artistName}
          </Text>
        </View>
        <TouchableOpacity
          className="p-2"
          onPress={() => toggleFavorite(currentSong)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={26}
            color={liked ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      {/* â”€â”€â”€ Seek Bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View className="px-5 mt-4">
        <Slider
          style={{ width: '100%', height: 36 }}
          minimumValue={0}
          maximumValue={durationMs || 1}
          value={positionMs}
          onSlidingComplete={handleSlidingComplete}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.seekBarTrack}
          thumbTintColor={colors.primary}
        />
        <View className="flex-row justify-between -mt-1 px-1">
          <Text className="text-[12px]" style={{ color: colors.textSecondary }}>
            {formatDuration(positionSec)}
          </Text>
          <Text className="text-[12px]" style={{ color: colors.textSecondary }}>
            {formatDuration(durationSec)}
          </Text>
        </View>
      </View>

      {/* â”€â”€â”€ Main Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View className="flex-row items-center justify-between px-8 mt-4">
        {/* Skip Back */}
        <TouchableOpacity className="p-2" onPress={skipPrevious}>
          <Ionicons name="play-skip-back" size={28} color={colors.text} />
        </TouchableOpacity>

        {/* -10s */}
        <TouchableOpacity
          className="p-2 items-center"
          onPress={() => seekTo(Math.max(0, positionMs - 10000))}
        >
          <Ionicons name="refresh-outline" size={24} color={colors.text} style={{ transform: [{ scaleX: -1 }] }} />
          <Text className="text-[9px] font-bold absolute" style={{ color: colors.text, marginTop: 6 }}>10</Text>
        </TouchableOpacity>

        {/* Play / Pause */}
        <TouchableOpacity
          className="w-[66px] h-[66px] rounded-[33px] justify-center items-center"
          style={{ backgroundColor: colors.primary }}
          onPress={togglePlayPause}
          disabled={isLoading}
        >
          <Ionicons
            name={isLoading ? 'hourglass' : isPlaying ? 'pause' : 'play'}
            size={30}
            color="#fff"
          />
        </TouchableOpacity>

        {/* +10s */}
        <TouchableOpacity
          className="p-2 items-center"
          onPress={() => seekTo(Math.min(durationMs, positionMs + 10000))}
        >
          <Ionicons name="refresh-outline" size={24} color={colors.text} />
          <Text className="text-[9px] font-bold absolute" style={{ color: colors.text, marginTop: 6 }}>10</Text>
        </TouchableOpacity>

        {/* Skip Forward */}
        <TouchableOpacity className="p-2" onPress={skipNext}>
          <Ionicons name="play-skip-forward" size={28} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* â”€â”€â”€ Secondary Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <View className="flex-row items-center justify-around px-6 mt-6">
        {/* Shuffle */}
        <TouchableOpacity className="p-3" onPress={toggleShuffle}>
          <Ionicons
            name="shuffle"
            size={22}
            color={shuffle ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>

        {/* Repeat */}
        <TouchableOpacity className="p-3 relative" onPress={cycleRepeat}>
          <Ionicons
            name="repeat"
            size={22}
            color={repeat !== 'off' ? colors.primary : colors.textMuted}
          />
          {repeat === 'one' && (
            <View
              className="absolute top-1.5 right-1 w-3.5 h-3.5 rounded-full justify-center items-center"
              style={{ backgroundColor: colors.primary }}
            >
              <Text className="text-[8px] font-bold" style={{ color: '#fff' }}>1</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Queue */}
        <TouchableOpacity className="p-3" onPress={() => navigation.navigate('Queue')}>
          <Ionicons name="list" size={22} color={colors.textMuted} />
        </TouchableOpacity>

        {/* AI Chat */}
        <TouchableOpacity className="p-3" onPress={() => navigation.navigate('AiChat')}>
          <Ionicons name="sparkles-outline" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* â”€â”€â”€ Song Options Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <SongOptionsModal
        visible={showOptions}
        song={currentSong}
        onClose={() => setShowOptions(false)}
      />
    </SafeAreaView>
  );
}
