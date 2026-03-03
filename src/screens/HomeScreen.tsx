import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as MediaLibrary from 'expo-media-library';
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

import { getDynamicHomeQuery } from '../api/aiService';
import { searchSongs } from '../api/saavnApi';
import { loadAndPlay } from '../audio/audioManager';
import MiniPlayer from '../components/MiniPlayer';
import SongOptionsModal from '../components/SongOptionsModal';
import usePlayerStore from '../store/usePlayerStore';
import useThemeStore from '../store/useThemeStore';
import { HomeTabType, RootStackParamList, Song, SongImage } from '../types';
import { getCached } from '../utils/cache';
import { getArtistName, getImageUrl } from '../utils/helpers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 60) / 2.4;
const ARTIST_CARD_WIDTH = (SCREEN_WIDTH - 60) / 2.8;

const TABS: HomeTabType[] = ['Suggested', 'Songs', 'Albums', 'Artists', 'Local'];

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

interface AlbumInfo {
  id: string;
  name: string;
  image?: SongImage[];
  artistName: string;
  year?: string;
  songCount: number;
  songs: Song[];
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
  // Albums state
  const [selectedAlbum, setSelectedAlbum] = useState<AlbumInfo | null>(null);
  // Local songs state
  const [localSongs, setLocalSongs] = useState<Song[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localPermission, setLocalPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  // AI query hint label
  const [aiQueryHint, setAiQueryHint] = useState<string>('');

  const hasCurrentSong = queue.length > 0 && currentIndex >= 0;

  useEffect(() => {
    loadInitialSongs();
  }, []);

  const loadInitialSongs = async (showSpinner = true) => {
    // --- Step 1: Try to serve cached data immediately ---
    const hour = new Date().getHours();
    const period =
      hour < 6 ? 'late_night' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';
    const staticQueries: Record<string, string> = {
      late_night: 'late night chill',
      morning: 'morning energy',
      afternoon: 'afternoon focus',
      evening: 'evening relaxing',
      night: 'night vibes',
    };
    const staticQuery = staticQueries[period] ?? 'top hits';

    if (showSpinner) {
      // Check if songs for this time-of-day are already cached → render instantly
      const cachedKey = `search_${staticQuery}_1_40`;
      const cachedResult = await getCached<{ songs: Song[]; total: number }>(cachedKey);
      if (cachedResult && cachedResult.songs.length > 0) {
        setSongs(cachedResult.songs);
        setAiQueryHint(staticQuery);
        setIsLoading(false);
        // Silently refresh in background (no spinner, no recursion)
        fetchFreshSongs(staticQuery);
        return;
      }
      setIsLoading(true);
    }

    await fetchFreshSongs(staticQuery);
  };

  const fetchFreshSongs = async (defaultQuery: string) => {
    try {
      let query = defaultQuery;
      try {
        query = await getDynamicHomeQuery();
        setAiQueryHint(query);
      } catch {
        // keep defaultQuery
      }
      const result = await searchSongs(query, 1, 40);
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

  const loadLocalSongs = useCallback(async () => {
    setLocalLoading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setLocalPermission('denied');
        setLocalLoading(false);
        return;
      }
      setLocalPermission('granted');
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: 500,
        sortBy: MediaLibrary.SortBy.modificationTime,
      });
      const mapped: Song[] = media.assets.map((a) => ({
        id: a.id,
        name: a.filename.replace(/\.[^/.]+$/, ''),
        album: { id: '', name: 'Local' },
        duration: Math.floor(a.duration),
        image: [],
        downloadUrl: [],
        localUri: a.uri,
      }));
      setLocalSongs(mapped);
    } catch (e) {
      console.error('loadLocalSongs error:', e);
    } finally {
      setLocalLoading(false);
    }
  }, []);

  // Load local songs when Local tab is selected
  useEffect(() => {
    if (activeTab === 'Local' && localPermission === 'unknown') {
      loadLocalSongs();
    }
  }, [activeTab, localPermission, loadLocalSongs]);

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

  // --- Derived albums from songs ---
  const albums = useMemo<AlbumInfo[]>(() => {
    const map = new Map<string, AlbumInfo>();
    for (const song of songs) {
      const albumId = song.album?.id;
      const albumName = song.album?.name;
      if (!albumId || !albumName) continue;
      const existing = map.get(albumId);
      if (existing) {
        existing.songCount++;
        existing.songs.push(song);
      } else {
        map.set(albumId, {
          id: albumId,
          name: albumName,
          image: song.image,
          artistName: getArtistName(song),
          year: song.year,
          songCount: 1,
          songs: [song],
        });
      }
    }
    return Array.from(map.values());
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
      case 'Artists': return `${artists.length} artists`;
      case 'Albums': return `${albums.length} albums`;
      case 'Local': return `${localSongs.length} local songs`;
      default: return `${(activeTab === 'Songs' ? sortedSongs : songs).length} songs`;
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
      {/* AI Query Hint */}
      {aiQueryHint ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 2, gap: 6 }}>
          <Ionicons name="sparkles" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, color: colors.textSecondary }}>
            AI picked: <Text style={{ color: colors.primary, fontWeight: '600' }}>{aiQueryHint}</Text>
          </Text>
        </View>
      ) : null}

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

      {/* Albums */}
      {albums.length > 0 && (
        <>
          <SectionHeader title="Albums" onSeeAll={() => setActiveTab('Albums')} />
          <FlatList
            horizontal
            data={albums.slice(0, 12)}
            keyExtractor={(item) => `album-${item.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item }) => {
              const imageUrl = item.image ? getImageUrl(item.image, '500x500') : '';
              return (
                <TouchableOpacity
                  style={styles.card}
                  onPress={() => setSelectedAlbum(item)}
                  activeOpacity={0.8}
                >
                  {imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={[styles.cardImage, { backgroundColor: colors.surface }]} />
                  ) : (
                    <View style={[styles.cardImage, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                      <Ionicons name="albums-outline" size={32} color={colors.textMuted} />
                    </View>
                  )}
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.textSecondary }} numberOfLines={1}>{item.artistName}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </>
      )}
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
      {(activeTab === 'Songs' || activeTab === 'Albums') && (
        <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortModal(true)}>
          <Text style={[styles.sortText, { color: colors.primary }]}>{getSortLabel()}</Text>
          <Ionicons name="swap-vertical" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAlbumGridItem = useCallback(
    ({ item }: { item: AlbumInfo }) => {
      const imageUrl = item.image ? getImageUrl(item.image, '500x500') : '';
      return (
        <TouchableOpacity
          style={[styles.albumCard, { backgroundColor: colors.surface }]}
          onPress={() => setSelectedAlbum(item)}
          activeOpacity={0.8}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.albumCover} />
          ) : (
            <View style={[styles.albumCover, { justifyContent: 'center', alignItems: 'center', backgroundColor: colors.border }]}>
              <Ionicons name="albums-outline" size={36} color={colors.textMuted} />
            </View>
          )}
          <View style={{ padding: 8 }}>
            <Text style={[styles.albumCardName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
            <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }} numberOfLines={1}>
              {item.artistName}{item.year ? `  •  ${item.year}` : ''}
            </Text>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
              {item.songCount} {item.songCount === 1 ? 'song' : 'songs'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [colors],
  );

  const renderLocalSongItem = useCallback(
    ({ item, index }: { item: Song; index: number }) => {
      const isCurrentSong = queue[currentIndex]?.id === item.id;
      return (
        <TouchableOpacity
          style={styles.songRow}
          onPress={() => { setQueue(localSongs); setCurrentIndex(index); loadAndPlay(); navigation.navigate('Player'); }}
          activeOpacity={0.7}
        >
          <View style={[styles.songImage, styles.placeholderImage, { backgroundColor: colors.surface }]}>
            <Ionicons name="musical-note" size={22} color={isCurrentSong ? colors.primary : colors.textMuted} />
          </View>
          <View style={styles.songInfo}>
            <Text style={[styles.songName, { color: isCurrentSong ? colors.primary : colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.songMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              Local  •  {Math.floor(((typeof item.duration === 'number' ? item.duration : parseInt(item.duration as string, 10)) || 0) / 60)}:{String((typeof item.duration === 'number' ? item.duration : parseInt(item.duration as string, 10) || 0) % 60).padStart(2, '0')}
            </Text>
          </View>
          <TouchableOpacity style={styles.optionsBtn} onPress={() => setOptionsSong(item)}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      );
    },
    [colors, queue, currentIndex, localSongs, setQueue, setCurrentIndex, navigation],
  );

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          {aiQueryHint ? (
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              ✨ Loading {aiQueryHint}...
            </Text>
          ) : (
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
          )}
        </View>
      );
    }

    if (activeTab === 'Suggested') return renderSuggestedContent();

    switch (activeTab) {
      case 'Albums':
        return (
          <FlatList
            key="albums-grid-2col"
            data={albums}
            renderItem={renderAlbumGridItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={[styles.listContent, hasCurrentSong && styles.listContentWithMiniPlayer]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="albums-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No albums found</Text>
              </View>
            }
          />
        );

      case 'Artists':
        return (
          <FlatList
            data={artists}
            renderItem={renderArtistItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={[styles.listContent, hasCurrentSong && styles.listContentWithMiniPlayer]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No artists found</Text>
              </View>
            }
          />
        );

      case 'Local':
        if (localLoading) {
          return (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Scanning device music...</Text>
            </View>
          );
        }
        if (localPermission === 'denied') {
          return (
            <View style={styles.emptyContainer}>
              <Ionicons name="lock-closed-outline" size={56} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text, marginTop: 16 }]}>Permission Denied</Text>
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 8, paddingHorizontal: 32 }}>
                Allow media access in device Settings to browse local songs.
              </Text>
              <TouchableOpacity
                style={[styles.sortButton, { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: colors.primary }]}
                onPress={loadLocalSongs}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Try Again</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <FlatList
            data={localSongs}
            renderItem={renderLocalSongItem}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={renderListHeader}
            contentContainerStyle={[styles.listContent, hasCurrentSong && styles.listContentWithMiniPlayer]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="musical-notes-outline" size={56} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No local music found</Text>
                <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 8, paddingHorizontal: 32, fontSize: 13 }}>
                  Add audio files to your device to see them here.
                </Text>
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
            contentContainerStyle={[styles.listContent, hasCurrentSong && styles.listContentWithMiniPlayer]}
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
          <Text style={[styles.brandName, { color: colors.text }]}>Lokal</Text>
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

      {/* Album Detail Modal */}
      <Modal
        visible={!!selectedAlbum}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedAlbum(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedAlbum(null)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay }}>
            <TouchableWithoutFeedback>
              <View style={{ backgroundColor: colors.modalBg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 32 }}>
                {/* Handle */}
                <View style={{ alignItems: 'center', paddingTop: 10 }}>
                  <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
                </View>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
                  {selectedAlbum?.image && getImageUrl(selectedAlbum.image, '150x150') ? (
                    <Image
                      source={{ uri: getImageUrl(selectedAlbum!.image, '150x150') as string }}
                      style={{ width: 56, height: 56, borderRadius: 10 }}
                    />
                  ) : (
                    <View style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="albums-outline" size={28} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: colors.text }} numberOfLines={1}>
                      {selectedAlbum?.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                      {selectedAlbum?.artistName}{selectedAlbum?.year ? `  •  ${selectedAlbum.year}` : ''}
                    </Text>
                  </View>
                  {(selectedAlbum?.songs.length ?? 0) > 0 && (
                    <TouchableOpacity
                      style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
                      onPress={() => {
                        setQueue(selectedAlbum!.songs);
                        setCurrentIndex(0);
                        loadAndPlay();
                        setSelectedAlbum(null);
                        navigation.navigate('Player');
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Play All</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 16 }} />
                {/* Song list */}
                <FlatList
                  data={selectedAlbum?.songs ?? []}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => {
                    const imageUrl = getImageUrl(item.image, '150x150');
                    return (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 16 }}
                        onPress={() => {
                          setQueue(selectedAlbum!.songs);
                          setCurrentIndex(index);
                          loadAndPlay();
                          setSelectedAlbum(null);
                          navigation.navigate('Player');
                        }}
                      >
                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={{ width: 44, height: 44, borderRadius: 8 }} />
                        ) : (
                          <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }}>
                            <Ionicons name="musical-note" size={20} color={colors.textMuted} />
                          </View>
                        )}
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={{ fontWeight: '600', color: colors.text, fontSize: 14 }} numberOfLines={1}>{item.name}</Text>
                          <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>{getArtistName(item)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setOptionsSong(item)} style={{ padding: 8 }}>
                          <Ionicons name="ellipsis-vertical" size={16} color={colors.textMuted} />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  }}
                />
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
  // Albums grid
  albumCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  albumCover: {
    width: '100%',
    aspectRatio: 1,
  },
  albumCardName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
});
