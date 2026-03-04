import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadAndPlay } from '../audio/audioManager';
import SongOptionsModal from '../components/SongOptionsModal';
import useLibraryStore, { HISTORY_PLAYLIST_ID, LIKES_PLAYLIST_ID } from '../store/useLibraryStore';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList, Song } from '../types';
import { formatDuration, getArtistName, getImageUrl } from '../utils/helpers';

type PlaylistDetailRouteProp = RouteProp<RootStackParamList, 'PlaylistDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PlaylistDetailScreen() {
  const route = useRoute<PlaylistDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { playlistId, playlistName, emoji } = route.params;

  const { colors } = useThemeStore();
  const { getPlaylist, removeSongFromPlaylist, removeFavorite, clearHistory } = useLibraryStore();
  const { setQueue, setCurrentIndex } = usePlayerStore();

  const [optionsSong, setOptionsSong] = useState<Song | null>(null);

  const playlist = getPlaylist(playlistId);
  const songs = playlist?.songs ?? [];
  const isSystem = playlist?.isSystem ?? false;

  const playSong = (song: Song, index: number) => {
    setQueue(songs, index);
    setCurrentIndex(index);
    loadAndPlay();
    navigation.navigate('Player');
  };

  const playAll = () => {
    if (songs.length === 0) return;
    setQueue(songs, 0);
    setCurrentIndex(0);
    loadAndPlay();
    navigation.navigate('Player');
  };

  const handleRemoveSong = (song: Song) => {
    Alert.alert(
      'Remove Song',
      `Remove "${song.name}" from ${playlistName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (playlistId === LIKES_PLAYLIST_ID) {
              removeFavorite(song.id);
            } else {
              removeSongFromPlaylist(playlistId, song.id);
            }
          },
        },
      ],
    );
  };

  const handleClearHistory = () => {
    Alert.alert('Clear History', 'Remove all songs from history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearHistory },
    ]);
  };

  const renderSong = ({ item, index }: { item: Song; index: number }) => {
    const imgUrl = getImageUrl(item.image, '150x150');
    const artist = getArtistName(item);
    const dur =
      typeof item.duration === 'string'
        ? parseInt(item.duration, 10)
        : item.duration || 0;
    const { queue, currentIndex, isPlaying } = usePlayerStore.getState();
    const isCurrentSong = queue[currentIndex]?.id === item.id;
    const isCurrentPlaying = isCurrentSong && isPlaying;

    return (
      <TouchableOpacity
        className="flex-row items-center px-4 py-3 gap-3"
        onPress={() => playSong(item, index)}
        activeOpacity={0.7}
      >
        {imgUrl ? (
          <Image
            source={{ uri: imgUrl }}
            className="w-12 h-12 rounded-lg"
            style={{ backgroundColor: colors.surface }}
          />
        ) : (
          <View
            className="w-12 h-12 rounded-lg justify-center items-center"
            style={{ backgroundColor: colors.surface }}
          >
            <Ionicons name="musical-note" size={20} color={colors.textMuted} />
          </View>
        )}

        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color: isCurrentSong ? colors.primary : colors.text }} numberOfLines={1}>
            {item.name}
          </Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {artist}  •  {formatDuration(dur)}
          </Text>
        </View>

        {isCurrentSong && (
          <Ionicons name={isCurrentPlaying ? 'pause-circle' : 'play-circle'} size={24} color={colors.primary} />
        )}
        <TouchableOpacity
          className="p-2"
          onPress={() => setOptionsSong(item)}
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 gap-3">
        <TouchableOpacity className="p-2" onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold" style={{ color: colors.text }} numberOfLines={1}>
            {emoji ? `${emoji}  ${playlistName}` : playlistName}
          </Text>
          <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
            {songs.length} {songs.length === 1 ? 'song' : 'songs'}
          </Text>
        </View>
        {playlistId === HISTORY_PLAYLIST_ID && songs.length > 0 && (
          <TouchableOpacity className="p-2" onPress={handleClearHistory}>
            <Ionicons name="trash-outline" size={22} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Play All bar */}
      {songs.length > 0 && (
        <TouchableOpacity
          className="flex-row items-center mx-4 mb-3 px-4 py-3 rounded-xl gap-3"
          style={{ backgroundColor: colors.primary + '18' }}
          onPress={playAll}
        >
          <View
            className="w-9 h-9 rounded-full justify-center items-center"
            style={{ backgroundColor: colors.primary }}
          >
            <Ionicons name="play" size={18} color="#fff" />
          </View>
          <Text className="font-semibold text-base" style={{ color: colors.primary }}>
            Play All
          </Text>
          <View className="flex-1" />
          <Ionicons name="shuffle" size={20} color={colors.primary} />
        </TouchableOpacity>
      )}

      {songs.length === 0 ? (
        <View className="flex-1 justify-center items-center px-10">
          <Ionicons name="musical-notes-outline" size={64} color={colors.textMuted} />
          <Text className="text-lg font-semibold mt-4 text-center" style={{ color: colors.text }}>
            No songs yet
          </Text>
          <Text className="text-sm mt-2 text-center" style={{ color: colors.textSecondary }}>
            {playlistId === HISTORY_PLAYLIST_ID
              ? 'Songs you play will appear here'
              : playlistId === LIKES_PLAYLIST_ID
              ? 'Like songs to add them here'
              : 'Add songs from the options menu'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={(item, i) => `${item.id}_${i}`}
          renderItem={renderSong}
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => (
            <View className="h-px mx-4" style={{ backgroundColor: colors.border }} />
          )}
        />
      )}

      <SongOptionsModal
        visible={!!optionsSong}
        song={optionsSong}
        onClose={() => setOptionsSong(null)}
        onRemoveFromPlaylist={
          !isSystem || playlistId === LIKES_PLAYLIST_ID
            ? () => optionsSong && handleRemoveSong(optionsSong)
            : undefined
        }
      />
    </SafeAreaView>
  );
}
