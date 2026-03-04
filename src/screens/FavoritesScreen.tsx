import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    FlatList,
    Image,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadAndPlay } from '../audio/audioManager';
import SongOptionsModal from '../components/SongOptionsModal';
import useLibraryStore from '../store/useLibraryStore';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList, Song } from '../types';
import { formatDuration, getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const { favorites, removeFavorite } = useLibraryStore();
  const { setQueue, setCurrentIndex } = usePlayerStore();
  const [optionsSong, setOptionsSong] = useState<Song | null>(null);

  const playSong = (song: Song, index: number) => {
    setQueue(favorites, index);
    setCurrentIndex(index);
    loadAndPlay();
    navigation.navigate('Player');
  };

  const playAll = () => {
    if (favorites.length === 0) return;
    setQueue(favorites, 0);
    loadAndPlay();
    navigation.navigate('Player');
  };

  const renderItem = ({ item, index }: { item: Song; index: number }) => {
    const imgUrl = getImageUrl(item.image, '150x150');
    const artist = getArtistName(item);
    const dur = typeof item.duration === 'string' ? parseInt(item.duration, 10) : item.duration || 0;
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
          <Image source={{ uri: imgUrl }} className="w-12 h-12 rounded-lg" style={{ backgroundColor: colors.surface }} />
        ) : (
          <View className="w-12 h-12 rounded-lg justify-center items-center" style={{ backgroundColor: colors.surface }}>
            <Ionicons name="musical-note" size={20} color={colors.textMuted} />
          </View>
        )}
        <View className="flex-1">
          <Text className="text-sm font-semibold" style={{ color: isCurrentSong ? colors.primary : colors.text }} numberOfLines={1}>{item.name}</Text>
          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {artist}  •  {formatDuration(dur)}
          </Text>
        </View>
        {isCurrentSong && (
          <Ionicons name={isCurrentPlaying ? 'pause-circle' : 'play-circle'} size={24} color={colors.primary} />
        )}
        <TouchableOpacity className="p-1.5" onPress={() => removeFavorite(item.id)}>
          <Ionicons name="heart" size={20} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity className="p-1.5 ml-1" onPress={() => setOptionsSong(item)}>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <View className="flex-row items-center px-5 py-3.5">
        <View className="flex-1">
          <Text className="text-[22px] font-bold" style={{ color: colors.text }}>Liked Songs</Text>
          <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
            {favorites.length} {favorites.length === 1 ? 'song' : 'songs'}
          </Text>
        </View>
        {favorites.length > 0 && (
          <TouchableOpacity
            className="w-10 h-10 rounded-full justify-center items-center"
            style={{ backgroundColor: colors.primary }}
            onPress={playAll}
          >
            <Ionicons name="play" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {favorites.length === 0 ? (
        <View className="flex-1 justify-center items-center px-10">
          <Ionicons name="heart-outline" size={64} color={colors.textMuted} />
          <Text className="text-xl font-semibold mt-4" style={{ color: colors.text }}>No Liked Songs Yet</Text>
          <Text className="text-sm mt-2 text-center" style={{ color: colors.textSecondary }}>
            Tap the ♡ on any song to save it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
      />
    </SafeAreaView>
  );
}
