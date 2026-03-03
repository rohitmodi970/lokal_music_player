import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import useLibraryStore, { Playlist } from '../store/useLibraryStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const EMOJI_OPTIONS = ['🎵', '🎸', '🎤', '🥁', '🎹', '🎻', '🔥', '💎', '🌊', '🌙', '⭐', '🎯'];

export default function PlaylistsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const { playlists, createPlaylist, deletePlaylist } = useLibraryStore();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎵');

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please enter a playlist name.');
      return;
    }
    createPlaylist(trimmed, selectedEmoji);
    setNewName('');
    setSelectedEmoji('🎵');
    setShowCreate(false);
  };

  const handleDelete = (playlist: Playlist) => {
    Alert.alert('Delete Playlist', `Delete "${playlist.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deletePlaylist(playlist.id),
      },
    ]);
  };

  const openPlaylist = (playlist: Playlist) => {
    navigation.navigate('PlaylistDetail', {
      playlistId: playlist.id,
      playlistName: playlist.name,
      emoji: playlist.emoji,
    });
  };

  const renderPlaylist = ({ item }: { item: Playlist }) => (
    <TouchableOpacity
      className="flex-row items-center px-4 py-3.5 gap-4"
      onPress={() => openPlaylist(item)}
      activeOpacity={0.7}
    >
      {/* Icon / Emoji */}
      <View
        className="w-14 h-14 rounded-xl justify-center items-center"
        style={{ backgroundColor: colors.primary + '18' }}
      >
        <Text style={{ fontSize: 28 }}>{item.emoji ?? '🎵'}</Text>
      </View>

      <View className="flex-1">
        <Text className="text-base font-semibold" style={{ color: colors.text }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text className="text-sm mt-0.5" style={{ color: colors.textSecondary }}>
          {item.songs.length} {item.songs.length === 1 ? 'song' : 'songs'}
          {item.isSystem ? '  •  Default' : ''}
        </Text>
      </View>

      {!item.isSystem && (
        <TouchableOpacity className="p-2" onPress={() => handleDelete(item)}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-5 py-3.5">
        <Text className="text-[22px] font-bold flex-1" style={{ color: colors.text }}>Playlists</Text>
        <TouchableOpacity
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl"
          style={{ backgroundColor: colors.primary + '18' }}
          onPress={() => setShowCreate(true)}
        >
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text className="text-sm font-semibold" style={{ color: colors.primary }}>New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={renderPlaylist}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => (
          <View className="h-px mx-4" style={{ backgroundColor: colors.border }} />
        )}
        ListEmptyComponent={() => (
          <View className="flex-1 justify-center items-center px-10 mt-20">
            <Ionicons name="albums-outline" size={64} color={colors.textMuted} />
            <Text className="text-xl font-semibold mt-4" style={{ color: colors.text }}>No Playlists Yet</Text>
            <Text className="text-sm mt-2 text-center" style={{ color: colors.textSecondary }}>
              {`Tap "New" to create your first playlist`}
            </Text>
          </View>
        )}
      />

      {/* Create Playlist Modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <TouchableWithoutFeedback onPress={() => setShowCreate(false)}>
          <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <TouchableWithoutFeedback>
              <View className="rounded-t-3xl px-5 pt-5 pb-10" style={{ backgroundColor: colors.modalBg }}>
                {/* Handle */}
                <View className="items-center mb-4">
                  <View className="w-10 h-1 rounded-full" style={{ backgroundColor: colors.border }} />
                </View>

                <Text className="text-lg font-bold mb-4" style={{ color: colors.text }}>New Playlist</Text>

                {/* Emoji picker */}
                <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Pick an icon</Text>
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      className="w-11 h-11 rounded-xl justify-center items-center"
                      style={{
                        backgroundColor: selectedEmoji === emoji ? colors.primary + '30' : colors.surface,
                        borderWidth: selectedEmoji === emoji ? 2 : 0,
                        borderColor: colors.primary,
                      }}
                      onPress={() => setSelectedEmoji(emoji)}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Name input */}
                <Text className="text-sm font-medium mb-2" style={{ color: colors.textSecondary }}>Playlist name</Text>
                <TextInput
                  className="rounded-xl px-4 py-3 text-base mb-5"
                  style={{
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  placeholder="My Playlist"
                  placeholderTextColor={colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />

                <TouchableOpacity
                  className="py-3.5 rounded-xl items-center"
                  style={{ backgroundColor: colors.primary }}
                  onPress={handleCreate}
                >
                  <Text className="text-base font-bold" style={{ color: '#fff' }}>Create Playlist</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}
