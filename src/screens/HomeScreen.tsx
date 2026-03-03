import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchSongs } from '../api/saavnApi';
import { loadAndPlay } from '../audio/audioManager';
import MiniPlayer from '../components/MiniPlayer';
import SongOptionsModal from '../components/SongOptionsModal';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { HomeTabType, RootStackParamList, Song, SongImage } from '../types';
import { getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2.4;
const ARTIST_CARD_WIDTH = (SCREEN_WIDTH - 60) / 2.8;

const TABS: HomeTabType[] = ['Suggested', 'Songs', 'Artists'];

type SortOption = 'asc' | 'desc' | 'artist' | 'album' | 'year';
const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'asc', label: 'Ascending' },
  { key: 'desc', label: 'Descending' },
  { key: 'artist', label: 'Artist' },
  { key: 'album', label: 'Album' },
  { key: 'year', label: 'Year' },
];

interface ArtistInfo {
  id: string;
  name: string;
  image?: SongImage[];
  albumCount: number;
  songCount: number;
}

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { queue, currentIndex, setQueue, setCurrentIndex } = usePlayerStore();
  const { colors } = useThemeStore();

  const [activeTab, setActiveTab] = useState<HomeTabType>('Suggested');
  const [songs, setSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortOption, setSortOption] = useState<SortOption>('asc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [optionsSong, setOptionsSong] = useState<Song | null>(null);

  const hasCurrentSong = queue.length > 0 && currentIndex >= 0;

  useEffect(() => {
    loadInitialSongs();
  }, []);

  const loadInitialSongs = async () => {
    setIsLoading(true);
    try {
      const result = await searchSongs('arijit singh', 1, 30);
      if (result.songs.length > 0) {
        setSongs(result.songs);
      } else {
        const fallback = await searchSongs('bollywood', 1, 30);
        setSongs(fallback.songs);
      }
    } catch (e) {
      console.error('Failed to load songs:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Derived data for tabs ---
  const artists = useMemo<ArtistInfo[]>(() => {
    const map = new Map<
      string,
      { id: string; name: string; image?: SongImage[]; albums: Set<string>; count: number }
    >();
    for (const song of songs) {
      const primary = song.artists?.primary;
      if (primary?.length) {
        for (const a of primary) {
          const existing = map.get(a.id);
          if (existing) {
            existing.count++;
            if (song.album?.id) existing.albums.add(song.album.id);
          } else {
            const albums = new Set<string>();
            if (song.album?.id) albums.add(song.album.id);
            map.set(a.id, {
              id: a.id,
              name: a.name,
              image: a.image,
              albums,
              count: 1,
            });
          }
        }
      }
    }
    return Array.from(map.values()).map((a) => ({
      id: a.id,
      name: a.name,
      image: a.image,
      albumCount: a.albums.size,
      songCount: a.count,
    }));
  }, [songs]);

  // --- Sort ---
  const sortedSongs = useMemo(() => {
    const sorted = [...songs];
    switch (sortOption) {
      case 'asc':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'desc':
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      case 'artist':
        return sorted.sort((a, b) =>
          getArtistName(a).localeCompare(getArtistName(b)),
        );
      case 'album':
        return sorted.sort((a, b) =>
          (a.album?.name || '').localeCompare(b.album?.name || ''),
        );
      case 'year':
        return sorted.sort((a, b) =>
          (b.year || '0').localeCompare(a.year || '0'),
        );
      default:
        return sorted;
    }
  }, [songs, sortOption]);

  // Recently played = first 10 songs (simulated)
  const recentlyPlayed = useMemo(() => songs.slice(0, 10), [songs]);
  // Most played = shuffled subset (simulated)
  const mostPlayed = useMemo(() => [...songs].sort(() => 0.5 - Math.random()).slice(0, 10), [songs]);

  const handleSongPress = useCallback(
    (song: Song, list: Song[]) => {
      const index = list.findIndex((s) => s.id === song.id);
      setQueue(list);
      setCurrentIndex(index >= 0 ? index : 0);
      loadAndPlay();
      navigation.navigate('Player');
    },
    [setQueue, setCurrentIndex, navigation],
  );

  const handleArtistPress = useCallback(
    (artist: ArtistInfo) => {
      const artistImage = artist.image
        ? getImageUrl(artist.image, '500x500')
        : undefined;
      navigation.navigate('ArtistDetail', {
        artistId: artist.id,
        artistName: artist.name,
        artistImage,
      });
    },
    [navigation],
  );

  // --- Get tab content label ---
  const getHeaderLabel = () => {
    switch (activeTab) {
      case 'Artists':
        return `${artists.length} artists`;
      default:
        return `${(activeTab === 'Songs' ? sortedSongs : songs).length} songs`;
    }
  };

  const getSortLabel = () =>
    SORT_OPTIONS.find((o) => o.key === sortOption)?.label || 'Ascending';

  // ========================
  // SECTION HEADER
  // ========================
  const SectionHeader = ({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) => (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={[styles.seeAllText, { color: colors.primary }]}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ========================
  // SUGGESTED TAB CONTENT
  // ========================
  const renderSuggestedContent = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.suggestedContainer,
        hasCurrentSong && { paddingBottom: 100 },
      ]}
    >
      {/* Recently Played */}
      <SectionHeader title="Recently Played" onSeeAll={() => setActiveTab('Songs')} />
      <FlatList
        horizontal
        data={recentlyPlayed}
        keyExtractor={(item) => `recent-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => {
          const imageUrl = getImageUrl(item.image, '500x500');
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleSongPress(item, recentlyPlayed)}
              activeOpacity={0.8}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={[styles.cardImage, { backgroundColor: colors.surface }]} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-note" size={32} color={colors.textMuted} />
                </View>
              )}
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {item.name} - {getArtistName(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Artists */}
      <SectionHeader title="Artists" onSeeAll={() => setActiveTab('Artists')} />
      <FlatList
        horizontal
        data={artists.slice(0, 10)}
        keyExtractor={(item) => `artist-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => {
          const imageUrl = item.image ? getImageUrl(item.image, '500x500') : '';
          return (
            <TouchableOpacity
              style={styles.artistCard}
              onPress={() => handleArtistPress(item)}
              activeOpacity={0.8}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={[styles.artistCircleImage, { backgroundColor: colors.surface }]} />
              ) : (
                <View style={[styles.artistCircleImage, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={36} color={colors.textMuted} />
                </View>
              )}
              <Text style={[styles.artistCardName, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Most Played */}
      <SectionHeader title="Most Played" onSeeAll={() => setActiveTab('Songs')} />
      <FlatList
        horizontal
        data={mostPlayed}
        keyExtractor={(item) => `most-${item.id}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalList}
        renderItem={({ item }) => {
          const imageUrl = getImageUrl(item.image, '500x500');
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => handleSongPress(item, mostPlayed)}
              activeOpacity={0.8}
            >
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={[styles.cardImage, { backgroundColor: colors.surface }]} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-note" size={32} color={colors.textMuted} />
                </View>
              )}
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                {item.name} - {getArtistName(item)}
              </Text>
            </TouchableOpacity>
          );
        }}
      />
    </ScrollView>
  );

  // --- Renderers ---
  const renderSongItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const imageUrl = getImageUrl(item.image, '150x150');
      const artistName = getArtistName(item);
      const dur =
        typeof item.duration === 'string'
          ? parseInt(item.duration, 10)
          : item.duration || 0;
      const minutes = Math.floor(dur / 60);
      const seconds = dur % 60;
      const durationStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} mins`;
      const isCurrentSong = queue[currentIndex]?.id === item.id;

      return (
        <TouchableOpacity
          style={styles.songRow}
          onPress={() => handleSongPress(item, activeTab === 'Songs' ? sortedSongs : songs)}
          activeOpacity={0.7}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={[styles.songImage, { backgroundColor: colors.surface }]} />
          ) : (
            <View style={[styles.songImage, styles.placeholderImage, { backgroundColor: colors.surface }]}>
              <Ionicons name="musical-note" size={22} color={colors.textMuted} />
            </View>
          )}

          <View style={styles.songInfo}>
            <Text
              style={[styles.songName, { color: colors.text }, isCurrentSong && { color: colors.primary }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <Text style={[styles.songMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {artistName}  |  {durationStr}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.playBtn, { borderColor: colors.primary }]}
            onPress={() => handleSongPress(item, activeTab === 'Songs' ? sortedSongs : songs)}
          >
            <Ionicons name="play" size={16} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionsBtn}
            onPress={() => setOptionsSong(item)}
          >
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [handleSongPress, queue, currentIndex, colors, activeTab, sortedSongs, songs],
  );

  const renderArtistItem = useCallback(
    ({ item }: { item: ArtistInfo }) => {
      const imageUrl = item.image ? getImageUrl(item.image, '150x150') : '';
      return (
        <TouchableOpacity
          style={styles.artistRow}
          onPress={() => handleArtistPress(item)}
          activeOpacity={0.7}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={[styles.artistRowImage, { backgroundColor: colors.surface }]} />
          ) : (
            <View style={[styles.artistRowImage, styles.placeholderImage, { backgroundColor: colors.surface }]}>
              <Ionicons name="person" size={28} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.artistInfo}>
            <Text style={[styles.artistName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.artistMeta, { color: colors.textSecondary }]}>
              {item.albumCount} {item.albumCount === 1 ? 'Album' : 'Albums'}  |  {item.songCount} Songs
            </Text>
          </View>
          <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      );
    },
    [handleArtistPress, colors],
  );

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <Text style={[styles.songCount, { color: colors.text }]}>{getHeaderLabel()}</Text>
      <TouchableOpacity
        style={styles.sortButton}
        onPress={() => setShowSortModal(true)}
      >
        <Text style={[styles.sortText, { color: colors.primary }]}>{getSortLabel()}</Text>
        <Ionicons name="swap-vertical" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      );
    }

    if (activeTab === 'Suggested') {
      return renderSuggestedContent();
    }

    switch (activeTab) {
      case 'Artists':
        return (
          <FlatList
            data={artists}
            renderItem={renderArtistItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={[
              styles.listContent,
              hasCurrentSong && styles.listContentWithMiniPlayer,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No artists found</Text>
              </View>
            }
          />
        );
      default: {
        const data = activeTab === 'Songs' ? sortedSongs : songs;
        return (
          <FlatList
            data={data}
            renderItem={renderSongItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={[
              styles.listContent,
              hasCurrentSong && styles.listContentWithMiniPlayer,
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No songs found</Text>
              </View>
            }
          />
        );
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="musical-notes" size={28} color={colors.primary} />
          <Text style={[styles.brandName, { color: colors.text }]}>Mume</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.searchBtn}
            onPress={() => navigation.navigate('Search')}
          >
            <Ionicons name="search-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Category Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textMuted },
                  activeTab === tab && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={[styles.tabLine, { backgroundColor: colors.border }]} />
      </View>

      {/* Content */}
      {renderTabContent()}

      {/* Mini Player */}
      {hasCurrentSong && <MiniPlayer />}

      {/* Sort Modal */}
      <Modal visible={showSortModal} transparent animationType="fade" onRequestClose={() => setShowSortModal(false)}>
        <TouchableWithoutFeedback onPress={() => setShowSortModal(false)}>
          <View style={styles.sortOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.sortSheet, { backgroundColor: colors.modalBg }]}>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.sortOptionRow, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setSortOption(opt.key);
                      setShowSortModal(false);
                    }}
                  >
                    <Text style={[styles.sortOptionText, { color: colors.text }]}>
                      {opt.label}
                    </Text>
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: sortOption === opt.key ? colors.primary : colors.textMuted },
                      ]}
                    >
                      {sortOption === opt.key && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Song Options Bottom Sheet */}
      <SongOptionsModal
        visible={!!optionsSong}
        song={optionsSong}
        onClose={() => setOptionsSong(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsWrapper: {
    paddingTop: 4,
  },
  tabsContent: {
    paddingHorizontal: 20,
    gap: 28,
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  tabLine: {
    height: 1,
    marginTop: -1,
  },
  // ===== SUGGESTED TAB =====
  suggestedContainer: {
    paddingBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  horizontalList: {
    paddingHorizontal: 20,
    gap: 14,
  },
  card: {
    width: CARD_WIDTH,
  },
  cardImage: {
    width: CARD_WIDTH,
    height: CARD_WIDTH,
    borderRadius: 14,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 18,
  },
  artistCard: {
    width: ARTIST_CARD_WIDTH,
    alignItems: 'center',
  },
  artistCircleImage: {
    width: ARTIST_CARD_WIDTH - 10,
    height: ARTIST_CARD_WIDTH - 10,
    borderRadius: (ARTIST_CARD_WIDTH - 10) / 2,
  },
  artistCardName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  // ===== SONGS TAB LIST =====
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  songCount: {
    fontSize: 15,
    fontWeight: '700',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 14,
    fontWeight: '500',
  },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  songImage: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  songInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  songName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  songMeta: {
    fontSize: 12,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  optionsBtn: {
    padding: 8,
    marginLeft: 2,
  },
  // ===== ARTIST ROW (Songs/Artists tabs) =====
  artistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  artistRowImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  artistInfo: {
    flex: 1,
    marginLeft: 14,
  },
  artistName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  artistMeta: {
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 20,
  },
  listContentWithMiniPlayer: {
    paddingBottom: 90,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  // Sort modal
  sortOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 16,
    paddingTop: 100,
  },
  sortSheet: {
    borderRadius: 14,
    paddingVertical: 8,
    width: 220,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  sortOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  sortOptionText: {
    fontSize: 15,
    fontWeight: '500',
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
