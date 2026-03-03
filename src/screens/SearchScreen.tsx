import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    FlatList,
    Image,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchSongs } from '../api/saavnApi';
import { loadAndPlay } from '../audio/audioManager';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { RootStackParamList, Song } from '../types';
import { getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const RECENT_SEARCHES_KEY = '@lokal_recent_searches';
const MAX_RECENT = 10;

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { setQueue, setCurrentIndex } = usePlayerStore();
  const { colors } = useThemeStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadRecentSearches();
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  const loadRecentSearches = async () => {
    try {
      const data = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (data) setRecentSearches(JSON.parse(data));
    } catch {}
  };

  const saveRecentSearch = async (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(
      0,
      MAX_RECENT,
    );
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const clearAllRecent = async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
  };

  const removeRecentSearch = async (term: string) => {
    const updated = recentSearches.filter((s) => s !== term);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const doSearch = useCallback(async (searchTerm: string) => {
    if (!searchTerm.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setIsSearching(true);
    setHasSearched(true);
    try {
      const result = await searchSongs(searchTerm.trim(), 1, 30);
      setResults(result.songs);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleTextChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 500);
  };

  const handleRecentPress = (term: string) => {
    setQuery(term);
    doSearch(term);
    saveRecentSearch(term);
  };

  const handleSubmit = () => {
    if (query.trim()) {
      doSearch(query);
      saveRecentSearch(query.trim());
    }
  };

  const handleSongPress = useCallback(
    (song: Song, index: number) => {
      saveRecentSearch(query.trim());
      setQueue(results);
      setCurrentIndex(index);
      loadAndPlay();
      navigation.navigate('Player');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, query, setQueue, setCurrentIndex, navigation],
  );

  const renderRecentSearches = () => {
    if (hasSearched || recentSearches.length === 0) return null;
    return (
      <View className="px-5 pt-2.5">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-[17px] font-bold" style={{ color: colors.text }}>Recent Searches</Text>
          <TouchableOpacity onPress={clearAllRecent}>
            <Text className="text-sm font-semibold" style={{ color: colors.primary }}>Clear All</Text>
          </TouchableOpacity>
        </View>
        <View className="h-px mb-1" style={{ backgroundColor: colors.border }} />
        {recentSearches.map((term) => (
          <TouchableOpacity
            key={term}
            className="flex-row justify-between items-center py-3.5"
            onPress={() => handleRecentPress(term)}
          >
            <Text className="text-[15px]" style={{ color: colors.textSecondary }}>{term}</Text>
            <TouchableOpacity onPress={() => removeRecentSearch(term)}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderNotFound = () => (
    <View className="flex-1 justify-center items-center px-10">
      <Ionicons name="sad-outline" size={80} color={colors.primary} />
      <Text className="text-[22px] font-bold mt-5" style={{ color: colors.text }}>Not Found</Text>
      <Text className="text-sm text-center mt-3 leading-[22px]" style={{ color: colors.textSecondary }}>
        Sorry, the keyword you entered cannot be found, please check again or
        search with another keyword.
      </Text>
    </View>
  );

  const renderSongResult = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const imageUrl = getImageUrl(item.image, '150x150');
      const artistName = getArtistName(item);

      return (
        <TouchableOpacity
          className="flex-row items-center py-2.5 px-5"
          onPress={() => handleSongPress(item, index)}
          activeOpacity={0.7}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} className="w-[52px] h-[52px] rounded-[10px]" style={{ backgroundColor: colors.surface }} />
          ) : (
            <View className="w-[52px] h-[52px] rounded-[10px] justify-center items-center" style={{ backgroundColor: colors.surface }}>
              <Ionicons name="musical-note" size={20} color={colors.textMuted} />
            </View>
          )}
          <View className="flex-1 ml-3.5">
            <Text className="text-[15px] font-semibold mb-0.5" style={{ color: colors.text }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-[13px]" style={{ color: colors.textSecondary }} numberOfLines={1}>
              {artistName}
            </Text>
          </View>
          <TouchableOpacity
            className="w-[34px] h-[34px] rounded-[17px] border-2 justify-center items-center ml-2"
            style={{ borderColor: colors.primary }}
          >
            <Ionicons name="play" size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity className="p-2 ml-0.5">
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [handleSongPress, colors],
  );

  const renderFilterChips = () => (
    <View className="flex-row px-4 py-2.5 gap-2.5">
      {['Songs', 'Artists', 'Albums', 'Folders'].map((chip, i) => (
        <TouchableOpacity
          key={chip}
          className="px-[18px] py-2 rounded-[20px] border-[1.5px]"
          style={{
            borderColor: colors.primary,
            backgroundColor: i === 0 ? colors.primary : colors.background,
          }}
        >
          <Text
            className="text-[13px] font-semibold"
            style={{ color: i === 0 ? colors.white : colors.primary }}
          >
            {chip}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-2.5 gap-2.5">
        <TouchableOpacity className="p-1" onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View
          className="flex-1 flex-row items-center rounded-xl border-[1.5px] px-3.5 h-[46px] gap-2.5"
          style={{ backgroundColor: colors.surface, borderColor: colors.primary }}
        >
          <Ionicons name="search" size={18} color={colors.primary} />
          <TextInput
            ref={inputRef}
            className="flex-1 text-[15px] p-0"
            style={{ color: colors.text }}
            placeholder="Search songs, artists..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleTextChange}
            onSubmitEditing={handleSubmit}
            returnKeyType="search"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setResults([]);
                setHasSearched(false);
              }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filter Chips */}
      {hasSearched && renderFilterChips()}

      {/* Content */}
      {!hasSearched && !isSearching ? (
        renderRecentSearches()
      ) : hasSearched && results.length === 0 && !isSearching ? (
        renderNotFound()
      ) : (
        <FlatList
          data={results}
          renderItem={renderSongResult}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </SafeAreaView>
  );
}
