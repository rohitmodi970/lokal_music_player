import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useState } from 'react';
import {
    Dimensions,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
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
import usePlayerStore, { getCurrentSong } from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList } from '../types';
import { formatDuration, getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ARTWORK_SIZE = SCREEN_WIDTH - 64;

export default function PlayerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const {
    isPlaying,
    isLoading,
    positionMs,
    durationMs,
    repeat,
    toggleShuffle,
    cycleRepeat,
  } = usePlayerStore();

  const [showOptions, setShowOptions] = useState(false);
  const currentSong = getCurrentSong(usePlayerStore.getState());

  const handleSlidingComplete = useCallback((value: number) => {
    seekTo(value);
  }, []);

  if (!currentSong) {
    return (
      <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }}>
        <View className="flex-1 justify-center items-center">
          <Ionicons name="musical-notes-outline" size={64} color={colors.textMuted} />
          <Text className="text-lg mt-4 mb-6" style={{ color: colors.textSecondary }}>No song playing</Text>
          <TouchableOpacity
            className="px-6 py-3 rounded-3xl"
            style={{ backgroundColor: colors.primary }}
            onPress={() => navigation.goBack()}
          >
            <Text className="text-base font-semibold" style={{ color: colors.white }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageUrl = getImageUrl(currentSong.image, '500x500');
  const artistName = getArtistName(currentSong);
  const positionSec = Math.floor(positionMs / 1000);
  const durationSec = Math.floor(durationMs / 1000);

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3">
        <TouchableOpacity
          className="p-2"
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1" />
        <TouchableOpacity
          className="p-2"
          onPress={() => setShowOptions(true)}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Artwork */}
        <View className="items-center mt-2 px-8">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              className="rounded-2xl"
              style={{ width: ARTWORK_SIZE, height: ARTWORK_SIZE, backgroundColor: colors.surface }}
              resizeMode="cover"
            />
          ) : (
            <View
              className="rounded-2xl justify-center items-center"
              style={{ width: ARTWORK_SIZE, height: ARTWORK_SIZE, backgroundColor: colors.surface }}
            >
              <Ionicons name="musical-note" size={80} color={colors.textMuted} />
            </View>
          )}
        </View>

        {/* Song Info */}
        <View className="items-center px-10 mt-7">
          <Text className="text-2xl font-bold text-center" style={{ color: colors.text }} numberOfLines={1}>
            {currentSong.name}
          </Text>
          <Text className="text-base text-center mt-2" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {artistName}
          </Text>
        </View>

        {/* Divider */}
        <View className="h-[2px] mx-8 mt-5 rounded-[1px]" style={{ backgroundColor: colors.primary }} />

        {/* Seek Bar */}
        <View className="px-6 mt-2">
          <Slider
            style={{ width: '100%', height: 40 }}
            minimumValue={0}
            maximumValue={durationMs || 1}
            value={positionMs}
            onSlidingComplete={handleSlidingComplete}
            minimumTrackTintColor={colors.primary}
            maximumTrackTintColor={colors.seekBarTrack}
            thumbTintColor={colors.primary}
          />
          <View className="flex-row justify-between -mt-1 px-1">
            <Text className="text-[13px]" style={{ color: colors.textSecondary }}>{formatDuration(positionSec)}</Text>
            <Text className="text-[13px]" style={{ color: colors.textSecondary }}>{formatDuration(durationSec)}</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View className="flex-row items-center justify-center px-5 mt-4 gap-[18px]">
          <TouchableOpacity className="p-2.5" onPress={skipPrevious}>
            <Ionicons name="play-skip-back" size={30} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            className="p-2.5"
            onPress={() => seekTo(Math.max(0, positionMs - 10000))}
          >
            <View className="items-center justify-center">
              <Ionicons name="refresh-outline" size={26} color={colors.text} style={{ transform: [{ scaleX: -1 }] }} />
              <Text className="text-[9px] font-bold -mt-1" style={{ color: colors.text }}>10</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            className="w-[68px] h-[68px] rounded-[34px] justify-center items-center mx-2"
            style={{ backgroundColor: colors.primary }}
            onPress={togglePlayPause}
            disabled={isLoading}
          >
            {isLoading ? (
              <Ionicons name="hourglass" size={32} color={colors.white} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={32}
                color={colors.white}
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            className="p-2.5"
            onPress={() => seekTo(Math.min(durationMs, positionMs + 10000))}
          >
            <View className="items-center justify-center">
              <Ionicons name="refresh-outline" size={26} color={colors.text} />
              <Text className="text-[9px] font-bold -mt-1" style={{ color: colors.text }}>10</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity className="p-2.5" onPress={skipNext}>
            <Ionicons name="play-skip-forward" size={30} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Secondary Controls */}
        <View className="flex-row justify-center items-center mt-7 gap-10">
          <TouchableOpacity className="p-2 relative" onPress={cycleRepeat}>
            <Ionicons
              name="repeat"
              size={22}
              color={repeat !== 'off' ? colors.primary : colors.text}
            />
            {repeat === 'one' && (
              <View className="absolute top-1 right-0.5 rounded-md w-3 h-3 justify-center items-center" style={{ backgroundColor: colors.primary }}>
                <Text className="text-[8px] font-bold" style={{ color: colors.white }}>1</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity className="p-2 relative" onPress={toggleShuffle}>
            <Ionicons
              name="timer-outline"
              size={22}
              color={colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            className="p-2 relative"
            onPress={() => navigation.navigate('Queue')}
          >
            <Ionicons name="radio-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            className="p-2 relative"
            onPress={() => setShowOptions(true)}
          >
            <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Lyrics Section */}
        <TouchableOpacity className="items-center mt-8 pb-4">
          <Ionicons name="chevron-up" size={20} color={colors.textSecondary} />
          <Text className="text-sm font-semibold mt-0.5" style={{ color: colors.textSecondary }}>Lyrics</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Song Options Bottom Sheet */}
      <SongOptionsModal
        visible={showOptions}
        song={currentSong}
        onClose={() => setShowOptions(false)}
      />
    </SafeAreaView>
  );
}


