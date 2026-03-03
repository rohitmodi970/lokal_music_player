import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { askAI, extractSongNames } from '../api/aiService';
import { searchSongs } from '../api/saavnApi';
import { loadAndPlay } from '../audio/audioManager';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList, Song } from '../types';
import { getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  songs?: Song[];
  timestamp: number;
}

const SUGGESTIONS = [
  'Suggest me some chill Hindi songs 🎵',
  'Best workout playlist songs 💪',
  'Recommend romantic Bollywood songs 💕',
  'Top trending songs this week 🔥',
  'Songs for a road trip 🚗',
];

export default function AiChatScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useThemeStore();
  const { setQueue, setCurrentIndex } = usePlayerStore();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const conversationRef = useRef<{ role: 'system' | 'user' | 'assistant'; content: string }[]>([]);

  const searchForSongs = async (songNames: string[]): Promise<Song[]> => {
    const allSongs: Song[] = [];
    const seen = new Set<string>();

    for (const name of songNames.slice(0, 8)) {
      try {
        const result = await searchSongs(name, 1, 3);
        for (const song of result.songs) {
          if (!seen.has(song.id)) {
            seen.add(song.id);
            allSongs.push(song);
          }
        }
      } catch {}
    }
    return allSongs;
  };

  const handleSend = useCallback(
    async (text?: string) => {
      const msgText = (text || inputText).trim();
      if (!msgText || isLoading) return;

      setInputText('');

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: msgText,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      conversationRef.current.push({ role: 'user' as const, content: msgText });
      setIsLoading(true);

      try {
        const aiResponse = await askAI(msgText, conversationRef.current);
        conversationRef.current.push({ role: 'assistant' as const, content: aiResponse });

        // Try extracting song names and searching
        const songNames = extractSongNames(aiResponse);
        let songs: Song[] = [];

        if (songNames.length > 0) {
          songs = await searchForSongs(songNames);
        }

        const assistantMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: aiResponse,
          songs: songs.length > 0 ? songs : undefined,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        const errorMsg: ChatMessage = {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Sorry, I couldn\'t process your request. Please check your API key or try again.',
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [inputText, isLoading],
  );

  const handlePlaySong = useCallback(
    (song: Song, songs: Song[]) => {
      const index = songs.findIndex((s) => s.id === song.id);
      setQueue(songs);
      setCurrentIndex(index >= 0 ? index : 0);
      loadAndPlay();
      navigation.navigate('Player');
    },
    [setQueue, setCurrentIndex, navigation],
  );

  const handlePlayAll = useCallback(
    (songs: Song[]) => {
      setQueue(songs);
      setCurrentIndex(0);
      loadAndPlay();
      navigation.navigate('Player');
    },
    [setQueue, setCurrentIndex, navigation],
  );

  const renderSongCard = (song: Song, songs: Song[]) => {
    const imageUrl = getImageUrl(song.image, '150x150');
    const artistName = getArtistName(song);

    return (
      <TouchableOpacity
        key={song.id}
        className="w-[120px] rounded-[10px] overflow-hidden p-2"
        style={{ backgroundColor: colors.surface }}
        onPress={() => handlePlaySong(song, songs)}
        activeOpacity={0.7}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} className="w-[104px] h-[104px] rounded-lg" />
        ) : (
          <View className="w-[104px] h-[104px] rounded-lg justify-center items-center" style={{ backgroundColor: colors.surfaceElevated }}>
            <Ionicons name="musical-note" size={16} color={colors.textMuted} />
          </View>
        )}
        <Text className="text-xs font-semibold mt-1.5" style={{ color: colors.text }} numberOfLines={1}>
          {song.name}
        </Text>
        <Text className="text-[10px] mt-0.5" style={{ color: colors.textSecondary }} numberOfLines={1}>
          {artistName}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === 'user';

    return (
      <View className={`flex-row mb-4 items-start ${isUser ? 'justify-end' : ''}`}>
        {!isUser && (
          <View className="w-8 h-8 rounded-full justify-center items-center mx-1.5 mt-0.5" style={{ backgroundColor: colors.primary }}>
            <Ionicons name="sparkles" size={16} color={colors.white} />
          </View>
        )}
        <View
          className="flex-1 rounded-2xl px-3.5 py-2.5 max-w-[80%]"
          style={
            isUser
              ? { backgroundColor: colors.primary, marginLeft: 50 }
              : { backgroundColor: colors.surface, marginRight: 50 }
          }
        >
          <Text
            className="text-sm leading-[21px]"
            style={{ color: isUser ? colors.white : colors.text }}
          >
            {item.content}
          </Text>

          {item.songs && item.songs.length > 0 && (
            <View className="mt-3">
              <TouchableOpacity
                className="flex-row items-center self-start gap-1 px-3 py-1.5 rounded-2xl mb-2.5"
                style={{ backgroundColor: colors.primary + '20' }}
                onPress={() => handlePlayAll(item.songs!)}
              >
                <Ionicons name="play" size={14} color={colors.primary} />
                <Text className="text-[13px] font-semibold" style={{ color: colors.primary }}>Play All</Text>
              </TouchableOpacity>
              <FlatList
                horizontal
                data={item.songs}
                renderItem={({ item: song }) => renderSongCard(song, item.songs!)}
                keyExtractor={(song) => song.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 10 }}
              />
            </View>
          )}
        </View>
        {isUser && (
          <View className="w-8 h-8 rounded-full justify-center items-center mx-1.5 mt-0.5" style={{ backgroundColor: colors.textSecondary }}>
            <Ionicons name="person" size={16} color={colors.white} />
          </View>
        )}
      </View>
    );
  };

  const renderEmpty = () => (
    <View className="flex-1 justify-center items-center px-[30px]">
      <View className="w-20 h-20 rounded-full justify-center items-center mb-4" style={{ backgroundColor: colors.primary + '15' }}>
        <Ionicons name="sparkles" size={48} color={colors.primary} />
      </View>
      <Text className="text-2xl font-bold" style={{ color: colors.text }}>Lokal AI</Text>
      <Text className="text-sm text-center mt-2 leading-5" style={{ color: colors.textSecondary }}>
        Your personal music assistant. Ask me anything about music!
      </Text>

      <View className="mt-7 gap-2.5 w-full">
        {SUGGESTIONS.map((suggestion) => (
          <TouchableOpacity
            key={suggestion}
            className="px-4 py-3 rounded-xl border"
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            onPress={() => handleSend(suggestion)}
          >
            <Text className="text-sm" style={{ color: colors.text }}>{suggestion}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b" style={{ borderBottomColor: colors.border }}>
        <TouchableOpacity className="p-1.5 w-9" onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="sparkles" size={18} color={colors.primary} />
          <Text className="text-lg font-bold" style={{ color: colors.text }}>Lokal AI</Text>
        </View>
        <TouchableOpacity
          className="p-1.5 w-9"
          onPress={() => {
            setMessages([]);
            conversationRef.current = [];
          }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[{ paddingHorizontal: 12, paddingVertical: 16 }, messages.length === 0 && { flex: 1 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Loading Indicator */}
        {isLoading && (
          <View className="flex-row items-center gap-2 px-5 py-2.5 mx-3 rounded-xl mb-2" style={{ backgroundColor: colors.surface }}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="text-[13px]" style={{ color: colors.textSecondary }}>Thinking...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View className="flex-row items-end px-3 py-2.5 border-t gap-2" style={{ backgroundColor: colors.surface, borderTopColor: colors.border }}>
          <TextInput
            className="flex-1 rounded-[20px] px-4 py-2.5 text-[15px] max-h-[100px]"
            style={{ color: colors.text, backgroundColor: colors.background }}
            placeholder="Ask about music..."
            placeholderTextColor={colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSend()}
            returnKeyType="send"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            className="w-10 h-10 rounded-full justify-center items-center"
            style={{ backgroundColor: inputText.trim() ? colors.primary : colors.textMuted }}
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons name="send" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

