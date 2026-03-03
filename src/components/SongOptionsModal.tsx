import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as IntentLauncher from 'expo-intent-launcher';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    Share,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

import useLibraryStore from '../store/useLibraryStore';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList, Song } from '../types';
import { getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SongOptionsModalProps {
  visible: boolean;
  song: Song | null;
  onClose: () => void;
  onRemoveFromPlaylist?: () => void;
}

export default function SongOptionsModal({
  visible,
  song,
  onClose,
  onRemoveFromPlaylist,
}: SongOptionsModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const { queue, currentIndex, addToQueue, setQueue } = usePlayerStore();
  const { isFavorite, toggleFavorite, playlists, addSongToPlaylist } = useLibraryStore();

  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);

  if (!song) return null;

  const imageUrl = getImageUrl(song.image, '150x150');
  const artistName = getArtistName(song);
  const dur =
    typeof song.duration === 'string' ? parseInt(song.duration, 10) : song.duration || 0;
  const minutes = Math.floor(dur / 60);
  const seconds = dur % 60;
  const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const liked = isFavorite(song.id);

  // User-created playlists only (no system ones for manual add)
  const userPlaylists = playlists.filter((p) => !p.isSystem);

  const handlePlayNext = () => {
    const newQueue = [...queue];
    const insertAt = currentIndex >= 0 ? currentIndex + 1 : 0;
    newQueue.splice(insertAt, 0, song);
    setQueue(newQueue, currentIndex);
    onClose();
  };

  const handleAddToQueue = () => {
    addToQueue(song);
    onClose();
  };

  const handleGoToArtist = () => {
    onClose();
    const primaryArtist = song.artists?.primary?.[0];
    if (primaryArtist) {
      const artistImage = primaryArtist.image
        ? getImageUrl(primaryArtist.image, '500x500')
        : undefined;
      navigation.navigate('ArtistDetail', {
        artistId: primaryArtist.id,
        artistName: primaryArtist.name,
        artistImage,
      });
    }
  };

  const handleAddToPlaylist = (playlistId: string) => {
    addSongToPlaylist(playlistId, song);
    setShowPlaylistPicker(false);
    onClose();
  };

  const handleShare = async () => {
    const streamUrl =
      song.downloadUrl?.find((u) => u.quality === '320kbps')?.link ||
      song.downloadUrl?.find((u) => u.quality === '320kbps')?.url ||
      song.downloadUrl?.[0]?.link ||
      song.downloadUrl?.[0]?.url ||
      '';
    try {
      await Share.share(
        {
          message: `🎵 ${song.name}\nby ${artistName}\n${streamUrl ? `Listen: ${streamUrl}` : ''}`.trim(),
          title: song.name,
          url: streamUrl || undefined,
        },
        { dialogTitle: `Share “${song.name}”` },
      );
    } catch (e) {
      console.error('Share error:', e);
    }
    onClose();
  };

  const handleSetRingtone = async () => {
    if (Platform.OS !== 'android') {
      Alert.alert(
        'Not Available',
        'Setting a ringtone is only supported on Android devices.',
        [{ text: 'OK', onPress: onClose }],
      );
      return;
    }
    try {
      await IntentLauncher.startActivityAsync(
        'android.settings.SOUND_SETTINGS',
      );
    } catch {
      Alert.alert(
        'Set Ringtone',
        'To set this song as a ringtone:\n\n1. Download the song\n2. Open Files app\n3. Long-press the audio file\n4. Choose “Set as ringtone”',
        [{ text: 'OK' }],
      );
    }
    onClose();
  };

  type OptionItem = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    color?: string;
    onPress: () => void;
  };

  const options: OptionItem[] = [
    {
      icon: liked ? 'heart' : 'heart-outline',
      label: liked ? 'Unlike' : 'Like',
      color: liked ? colors.primary : undefined,
      onPress: () => { toggleFavorite(song); onClose(); },
    },
    { icon: 'play-forward-outline', label: 'Play Next', onPress: handlePlayNext },
    { icon: 'add-circle-outline', label: 'Add to Queue', onPress: handleAddToQueue },
    {
      icon: 'add-outline',
      label: 'Add to Playlist',
      onPress: () => setShowPlaylistPicker(true),
    },
    { icon: 'person-outline', label: 'Go to Artist', onPress: handleGoToArtist },
    { icon: 'share-social-outline', label: 'Share', onPress: handleShare },
    { icon: 'notifications-outline', label: 'Set as Ringtone', onPress: handleSetRingtone },
    ...(onRemoveFromPlaylist
      ? [{ icon: 'remove-circle-outline' as keyof typeof Ionicons.glyphMap, label: 'Remove from Playlist', color: colors.error, onPress: () => { onRemoveFromPlaylist!(); onClose(); } }]
      : []),
  ];

  // â”€â”€â”€ Playlist Picker sub-sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (showPlaylistPicker) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setShowPlaylistPicker(false)}>
        <TouchableWithoutFeedback onPress={() => setShowPlaylistPicker(false)}>
          <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
            <TouchableWithoutFeedback>
              <View className="rounded-t-[20px] pb-9 max-h-[70%]" style={{ backgroundColor: colors.modalBg }}>
                <View className="items-center pt-2.5 pb-1.5">
                  <View className="w-10 h-1 rounded-sm" style={{ backgroundColor: colors.border }} />
                </View>
                <View className="flex-row items-center px-5 py-3">
                  <TouchableOpacity className="p-1 mr-3" onPress={() => setShowPlaylistPicker(false)}>
                    <Ionicons name="arrow-back" size={22} color={colors.text} />
                  </TouchableOpacity>
                  <Text className="text-base font-bold" style={{ color: colors.text }}>Add to Playlist</Text>
                </View>
                <View className="h-px mx-5" style={{ backgroundColor: colors.border }} />

                {userPlaylists.length === 0 ? (
                  <View className="items-center py-10 px-8">
                    <Ionicons name="albums-outline" size={48} color={colors.textMuted} />
                    <Text className="text-base font-medium mt-3 text-center" style={{ color: colors.textSecondary }}>
                      No playlists yet.{'\n'}Create one in the Playlists tab.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={userPlaylists}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        className="flex-row items-center px-5 py-3.5 gap-4"
                        onPress={() => handleAddToPlaylist(item.id)}
                        activeOpacity={0.6}
                      >
                        <View className="w-10 h-10 rounded-lg justify-center items-center" style={{ backgroundColor: colors.primary + '18' }}>
                          <Text style={{ fontSize: 22 }}>{item.emoji ?? 'ðŸŽµ'}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-semibold" style={{ color: colors.text }}>{item.name}</Text>
                          <Text className="text-xs mt-0.5" style={{ color: colors.textSecondary }}>
                            {item.songs.length} songs
                          </Text>
                        </View>
                        <Ionicons name="add-circle" size={22} color={colors.primary} />
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  }

  // â”€â”€â”€ Main options sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <TouchableWithoutFeedback>
            <View className="rounded-t-[20px] pb-9 max-h-[85%]" style={{ backgroundColor: colors.modalBg }}>
              {/* Drag Handle */}
              <View className="items-center pt-2.5 pb-1.5">
                <View className="w-10 h-1 rounded-sm" style={{ backgroundColor: colors.border }} />
              </View>

              {/* Song header */}
              <View className="flex-row items-center px-5 py-3.5">
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} className="w-14 h-14 rounded-[10px]" />
                ) : (
                  <View className="w-14 h-14 rounded-[10px]" style={{ backgroundColor: colors.surface }} />
                )}
                <View className="flex-1 ml-3.5">
                  <Text className="text-base font-bold" style={{ color: colors.text }} numberOfLines={1}>
                    {song.name}
                  </Text>
                  <Text className="text-[13px] mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
                    {artistName}  â€¢  {durationStr}
                  </Text>
                </View>
                <TouchableOpacity className="p-2" onPress={() => { toggleFavorite(song); }}>
                  <Ionicons
                    name={liked ? 'heart' : 'heart-outline'}
                    size={24}
                    color={liked ? colors.primary : colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              <View className="h-px mx-5" style={{ backgroundColor: colors.border }} />

              {/* Options */}
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt.label}
                  className="flex-row items-center px-6 py-4 gap-[18px]"
                  onPress={opt.onPress}
                  activeOpacity={0.6}
                >
                  <Ionicons name={opt.icon} size={22} color={opt.color ?? colors.text} />
                  <Text className="text-base font-medium" style={{ color: opt.color ?? colors.text }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
