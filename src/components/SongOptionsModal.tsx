import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import {
    Image,
    Modal,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList, Song } from '../types';
import { getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SongOptionsModalProps {
  visible: boolean;
  song: Song | null;
  onClose: () => void;
}

export default function SongOptionsModal({
  visible,
  song,
  onClose,
}: SongOptionsModalProps) {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const { queue, currentIndex, addToQueue, setQueue } =
    usePlayerStore();

  if (!song) return null;

  const imageUrl = getImageUrl(song.image, '150x150');
  const artistName = getArtistName(song);
  const dur =
    typeof song.duration === 'string'
      ? parseInt(song.duration, 10)
      : song.duration || 0;
  const minutes = Math.floor(dur / 60);
  const seconds = dur % 60;
  const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} mins`;

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

  type OptionItem = {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
  };

  const options: OptionItem[] = [
    { icon: 'play-forward-outline', label: 'Play Next', onPress: handlePlayNext },
    {
      icon: 'add-circle-outline',
      label: 'Add to Playing Queue',
      onPress: handleAddToQueue,
    },
    { icon: 'add-outline', label: 'Add to Playlist', onPress: onClose },
    { icon: 'disc-outline', label: 'Go to Album', onPress: onClose },
    { icon: 'person-outline', label: 'Go to Artist', onPress: handleGoToArtist },
    {
      icon: 'information-circle-outline',
      label: 'Details',
      onPress: onClose,
    },
    { icon: 'share-social-outline', label: 'Share', onPress: onClose },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 justify-end" style={{ backgroundColor: colors.overlay }}>
          <TouchableWithoutFeedback>
            <View
              className="rounded-t-[20px] pb-9 max-h-[85%]"
              style={{ backgroundColor: colors.modalBg }}
            >
              {/* Drag Handle */}
              <View className="items-center pt-2.5 pb-1.5">
                <View className="w-10 h-1 rounded-sm" style={{ backgroundColor: colors.border }} />
              </View>

              {/* Song header */}
              <View className="flex-row items-center px-5 py-3.5">
                {imageUrl ? (
                  <Image source={{ uri: imageUrl }} className="w-14 h-14 rounded-[10px]" />
                ) : (
                  <View
                    className="w-14 h-14 rounded-[10px]"
                    style={{ backgroundColor: colors.surface }}
                  />
                )}
                <View className="flex-1 ml-3.5">
                  <Text
                    className="text-base font-bold"
                    style={{ color: colors.text }}
                    numberOfLines={1}
                  >
                    {song.name}
                  </Text>
                  <Text
                    className="text-[13px] mt-0.5"
                    style={{ color: colors.textSecondary }}
                    numberOfLines={1}
                  >
                    {artistName}  |  {durationStr}
                  </Text>
                </View>
                <TouchableOpacity className="p-2">
                  <Ionicons
                    name="heart-outline"
                    size={24}
                    color={colors.textSecondary}
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
                  <Ionicons name={opt.icon} size={22} color={colors.text} />
                  <Text className="text-base font-medium" style={{ color: colors.text }}>
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
