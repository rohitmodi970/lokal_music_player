import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getArtistSongs, searchSongsByArtist } from '../api/saavnApi';
import { loadAndPlay } from '../audio/audioManager';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList, Song } from '../types';
import { formatDuration, getArtistName, getImageUrl } from '../utils/helpers';

type ArtistDetailRouteProp = RouteProp<RootStackParamList, 'ArtistDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ArtistDetailScreen() {
  const route = useRoute<ArtistDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { artistId, artistName, artistImage } = route.params;
  const { setQueue, setCurrentIndex } = usePlayerStore();
  const { colors } = useThemeStore();

  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSongs = async () => {
    setIsLoading(true);
    try {
      // Try the artist-ID endpoint first
      let result = await getArtistSongs(artistId, 1);
      // If no songs returned, fall back to name-based search
      if (result.length === 0) {
        result = await searchSongsByArtist(artistName, 20);
      }
      setSongs(result);
    } catch (e) {
      console.error('Failed to load artist songs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSongPress = useCallback(
    (index: number) => {
      setQueue(songs);
      setCurrentIndex(index);
      loadAndPlay();
      navigation.navigate('Player');
    },
    [songs, setQueue, setCurrentIndex, navigation],
  );

  const handlePlayAll = useCallback(() => {
    if (songs.length > 0) {
      setQueue(songs);
      setCurrentIndex(0);
      loadAndPlay();
      navigation.navigate('Player');
    }
  }, [songs, setQueue, setCurrentIndex, navigation]);

  const handleShuffle = useCallback(() => {
    if (songs.length > 0) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      setQueue(shuffled);
      setCurrentIndex(0);
      loadAndPlay();
      navigation.navigate('Player');
    }
  }, [songs, setQueue, setCurrentIndex, navigation]);

  const renderSong = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const imageUrl = getImageUrl(item.image, '150x150');
      const dur =
        typeof item.duration === 'string'
          ? parseInt(item.duration, 10)
          : item.duration || 0;

      return (
        <TouchableOpacity
          className="flex-row items-center py-2.5 px-5"
          onPress={() => handleSongPress(index)}
          activeOpacity={0.7}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="w-12 h-12 rounded-lg" style={{ backgroundColor: colors.surface }} />
          ) : (
            <View className="w-12 h-12 rounded-lg justify-center items-center" style={{ backgroundColor: colors.surface }}>
              <Ionicons name="musical-note" size={18} color={colors.textMuted} />
            </View>
          )}
          <View className="flex-1 ml-3">
            <Text className="text-sm font-semibold mb-0.5" style={{ color: (() => { const s = usePlayerStore.getState(); return s.queue[s.currentIndex]?.id === item.id ? colors.primary : colors.text; })() }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>
              {getArtistName(item)}
            </Text>
          </View>
          <Text className="text-xs mr-2" style={{ color: colors.textSecondary }}>{formatDuration(dur)}</Text>
          <TouchableOpacity className="w-[30px] h-[30px] rounded-[15px] border-2 justify-center items-center" style={{ borderColor: colors.primary }}>
            <Ionicons name={(() => { const s = usePlayerStore.getState(); return s.queue[s.currentIndex]?.id === item.id && s.isPlaying ? 'pause' : 'play'; })()} size={14} color={colors.primary} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [handleSongPress, colors],
  );

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          className="p-1.5 w-9"
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold flex-1 text-center" style={{ color: colors.text }} numberOfLines={1}>
          {artistName}
        </Text>
        <View className="p-1.5 w-9" />
      </View>

      {/* Artist Info */}
      <View className="items-center py-5">
        {artistImage ? (
          <Image source={{ uri: artistImage }} className="w-[120px] h-[120px] rounded-full" style={{ backgroundColor: colors.surface }} />
        ) : (
          <View className="w-[120px] h-[120px] rounded-full justify-center items-center" style={{ backgroundColor: colors.surface }}>
            <Ionicons name="person" size={40} color={colors.textMuted} />
          </View>
        )}
        <Text className="text-[22px] font-bold mt-3.5" style={{ color: colors.text }}>{artistName}</Text>
        <Text className="text-sm mt-1" style={{ color: colors.textSecondary }}>{songs.length} songs</Text>
      </View>

      {/* Action Buttons */}
      <View className="flex-row justify-center gap-4 px-10 py-4">
        <TouchableOpacity className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-3xl border-2" style={{ borderColor: colors.primary }} onPress={handleShuffle}>
          <Ionicons name="shuffle" size={18} color={colors.primary} />
          <Text className="text-[15px] font-semibold" style={{ color: colors.primary }}>Shuffle</Text>
        </TouchableOpacity>
        <TouchableOpacity className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-3xl" style={{ backgroundColor: colors.primary }} onPress={handlePlayAll}>
          <Ionicons name="play" size={18} color={colors.white} />
          <Text className="text-[15px] font-semibold" style={{ color: colors.white }}>Play</Text>
        </TouchableOpacity>
      </View>

      {/* Songs */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={songs}
          renderItem={renderSong}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-5"
          ListEmptyComponent={
            <View className="pt-10 items-center">
              <Text className="text-base" style={{ color: colors.textSecondary }}>No songs found</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
