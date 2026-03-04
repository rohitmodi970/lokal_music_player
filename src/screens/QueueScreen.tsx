import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import {
    Alert,
    Image,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import DraggableFlatList, {
    RenderItemParams,
    ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loadAndPlay } from '../audio/audioManager';
import usePlayerStore, { getCurrentSong } from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { Song } from '../types';
import { formatDuration, getArtistName, getImageUrl } from '../utils/helpers';

export default function QueueScreen() {
  const navigation = useNavigation();
  const { colors } = useThemeStore();
  const {
    queue,
    currentIndex,
    setCurrentIndex,
    removeFromQueue,
    reorderQueue,
    clearQueue,
  } = usePlayerStore();

  const currentSong = getCurrentSong(usePlayerStore.getState());

  const handleDragEnd = useCallback(
    ({ data, from, to }: { data: Song[]; from: number; to: number }) => {
      // Use reorderQueue for atomic update — avoids triggering a reload
      reorderQueue(from, to);
    },
    [reorderQueue],
  );

  const handleRemoveSong = useCallback(
    (index: number) => {
      if (queue.length === 1) {
        clearQueue();
        return;
      }
      removeFromQueue(index);
    },
    [queue.length, removeFromQueue, clearQueue],
  );

  const handleSongPress = useCallback(
    (index: number) => {
      if (index !== currentIndex) {
        setCurrentIndex(index);
        loadAndPlay();
      }
      navigation.goBack();
    },
    [currentIndex, setCurrentIndex, navigation],
  );

  const handleClearQueue = useCallback(() => {
    Alert.alert('Clear Queue', 'Remove all songs from the queue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          clearQueue();
          navigation.goBack();
        },
      },
    ]);
  }, [clearQueue, navigation]);

  const renderItem = useCallback(
    ({ item, drag, isActive, getIndex }: RenderItemParams<Song>) => {
      const index = getIndex() ?? 0;
      const isCurrentSong = index === currentIndex;
      const imageUrl = getImageUrl(item.image, '150x150');
      const artistName = getArtistName(item);
      const dur =
        typeof item.duration === 'string'
          ? parseInt(item.duration, 10)
          : item.duration || 0;

      return (
        <ScaleDecorator>
          <TouchableOpacity
            activeOpacity={0.7}
            onLongPress={drag}
            disabled={isActive}
            onPress={() => handleSongPress(index)}
            className="flex-row items-center py-2.5 px-4"
            style={[
              { backgroundColor: colors.background },
              isCurrentSong && { backgroundColor: colors.accentLight },
              isActive && { backgroundColor: colors.surface, elevation: 4 },
            ]}
          >
            <TouchableOpacity onLongPress={drag} className="p-1.5 mr-2">
              <Ionicons name="menu" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                className="w-11 h-11 rounded-lg"
                style={{ backgroundColor: colors.surface }}
              />
            ) : (
              <View
                className="w-11 h-11 rounded-lg justify-center items-center"
                style={{ backgroundColor: colors.surface }}
              >
                <Ionicons name="musical-note" size={18} color={colors.textMuted} />
              </View>
            )}

            <View className="flex-1 ml-3">
              <Text
                className="text-sm font-medium"
                style={[
                  { color: colors.text },
                  isCurrentSong && { color: colors.primary, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: colors.textSecondary }}
                numberOfLines={1}
              >
                {artistName}
              </Text>
            </View>

            <Text className="text-xs mr-2" style={{ color: colors.textSecondary }}>
              {formatDuration(dur)}
            </Text>

            <TouchableOpacity
              className="p-1.5"
              onPress={() => handleRemoveSong(index)}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>

            {isCurrentSong && (
              <View
                className="absolute left-14 bottom-2.5 rounded-lg p-0.5"
                style={{ backgroundColor: colors.background }}
              >
                <Ionicons
                  name="musical-note"
                  size={10}
                  color={colors.primary}
                />
              </View>
            )}
          </TouchableOpacity>
        </ScaleDecorator>
      );
    },
    [currentIndex, handleSongPress, handleRemoveSong, colors],
  );

  const renderHeader = () => (
    <View
      className="px-5 py-3.5 border-b"
      style={{ borderBottomColor: colors.border }}
    >
      <Text className="text-sm" style={{ color: colors.textSecondary }}>
        {queue.length} {queue.length === 1 ? 'song' : 'songs'} in queue
      </Text>
      {currentSong && (
        <Text
          className="text-xs mt-1 font-medium"
          style={{ color: colors.primary }}
          numberOfLines={1}
        >
          Now playing: {currentSong.name}
        </Text>
      )}
    </View>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={['top']}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-4 py-3 border-b"
          style={{ borderBottomColor: colors.border }}
        >
          <TouchableOpacity
            className="p-1.5 w-9"
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-semibold" style={{ color: colors.text }}>Queue</Text>
          {queue.length > 0 ? (
            <TouchableOpacity
              className="p-1.5 w-9"
              onPress={handleClearQueue}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </TouchableOpacity>
          ) : (
            <View className="p-1.5 w-9" />
          )}
        </View>

        {queue.length > 0 ? (
          <DraggableFlatList
            data={queue}
            renderItem={renderItem}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            onDragEnd={handleDragEnd}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View className="flex-1 justify-center items-center px-10">
            <Ionicons name="list" size={64} color={colors.textMuted} />
            <Text className="text-xl font-semibold mt-4" style={{ color: colors.text }}>
              Queue is empty
            </Text>
            <Text className="text-sm mt-2 text-center" style={{ color: colors.textSecondary }}>
              Search and add songs to start playing
            </Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
