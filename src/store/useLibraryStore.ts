import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { Song } from '../types';

// ─── Storage Keys ─────────────────────────────────────────────────────────────
const FAVORITES_KEY = '@lokal_favorites';
const PLAYLISTS_KEY = '@lokal_playlists';
const HISTORY_KEY = '@lokal_history';

const MAX_HISTORY = 100; // Keep last 100 played songs

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Playlist {
  id: string;
  name: string;
  songs: Song[];
  isSystem: boolean; // true for "History" and "Likes" — cannot be deleted/renamed
  createdAt: number;
  emoji?: string;
}

interface LibraryState {
  favorites: Song[];
  playlists: Playlist[];
  history: Song[]; // same as the 'history' system playlist, kept separately for fast access

  // ─── Favorites ───────────────────────────────────────────────────
  addFavorite: (song: Song) => void;
  removeFavorite: (songId: string) => void;
  isFavorite: (songId: string) => boolean;
  toggleFavorite: (song: Song) => void;

  // ─── History ──────────────────────────────────────────────────────
  addToHistory: (song: Song) => void;
  clearHistory: () => void;

  // ─── Playlists ────────────────────────────────────────────────────
  createPlaylist: (name: string, emoji?: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  addSongToPlaylist: (playlistId: string, song: Song) => void;
  removeSongFromPlaylist: (playlistId: string, songId: string) => void;
  getPlaylist: (id: string) => Playlist | undefined;

  // ─── Persistence ─────────────────────────────────────────────────
  loadLibrary: () => Promise<void>;
}

// ─── System Playlist IDs ─────────────────────────────────────────────────────
export const HISTORY_PLAYLIST_ID = '__history__';
export const LIKES_PLAYLIST_ID = '__likes__';

function buildSystemPlaylists(favorites: Song[], history: Song[]): Playlist[] {
  return [
    {
      id: LIKES_PLAYLIST_ID,
      name: 'Liked Songs',
      songs: favorites,
      isSystem: true,
      createdAt: 0,
      emoji: '❤️',
    },
    {
      id: HISTORY_PLAYLIST_ID,
      name: 'History',
      songs: history,
      isSystem: true,
      createdAt: 0,
      emoji: '🕒',
    },
  ];
}

// ─── Store ───────────────────────────────────────────────────────────────────
const useLibraryStore = create<LibraryState>((set, get) => ({
  favorites: [],
  playlists: buildSystemPlaylists([], []),
  history: [],

  // ─── Favorites ───────────────────────────────────────────────────────────

  addFavorite: (song) => {
    const { favorites } = get();
    if (favorites.find((s) => s.id === song.id)) return; // already liked
    const updated = [song, ...favorites];
    set((state) => ({
      favorites: updated,
      playlists: syncSystemPlaylists(state.playlists, updated, state.history),
    }));
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  },

  removeFavorite: (songId) => {
    const { favorites } = get();
    const updated = favorites.filter((s) => s.id !== songId);
    set((state) => ({
      favorites: updated,
      playlists: syncSystemPlaylists(state.playlists, updated, state.history),
    }));
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
  },

  isFavorite: (songId) => {
    return get().favorites.some((s) => s.id === songId);
  },

  toggleFavorite: (song) => {
    if (get().isFavorite(song.id)) {
      get().removeFavorite(song.id);
    } else {
      get().addFavorite(song);
    }
  },

  // ─── History ─────────────────────────────────────────────────────────────

  addToHistory: (song) => {
    const { history } = get();
    // Remove duplicate then prepend
    const deduped = history.filter((s) => s.id !== song.id);
    const updated = [song, ...deduped].slice(0, MAX_HISTORY);
    set((state) => ({
      history: updated,
      playlists: syncSystemPlaylists(state.playlists, state.favorites, updated),
    }));
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  },

  clearHistory: () => {
    set((state) => ({
      history: [],
      playlists: syncSystemPlaylists(state.playlists, state.favorites, []),
    }));
    AsyncStorage.removeItem(HISTORY_KEY);
  },

  // ─── Playlists ───────────────────────────────────────────────────────────

  createPlaylist: (name, emoji) => {
    const newPlaylist: Playlist = {
      id: `playlist_${Date.now()}`,
      name,
      songs: [],
      isSystem: false,
      createdAt: Date.now(),
      emoji,
    };
    set((state) => {
      const updated = [...state.playlists, newPlaylist];
      persistUserPlaylists(updated);
      return { playlists: updated };
    });
    return newPlaylist;
  },

  deletePlaylist: (id) => {
    set((state) => {
      const updated = state.playlists.filter(
        (p) => p.id !== id || p.isSystem,
      );
      persistUserPlaylists(updated);
      return { playlists: updated };
    });
  },

  renamePlaylist: (id, name) => {
    set((state) => {
      const updated = state.playlists.map((p) =>
        p.id === id && !p.isSystem ? { ...p, name } : p,
      );
      persistUserPlaylists(updated);
      return { playlists: updated };
    });
  },

  addSongToPlaylist: (playlistId, song) => {
    set((state) => {
      const updated = state.playlists.map((p) => {
        if (p.id !== playlistId) return p;
        if (p.songs.find((s) => s.id === song.id)) return p; // already there
        return { ...p, songs: [...p.songs, song] };
      });
      persistUserPlaylists(updated);
      return { playlists: updated };
    });
  },

  removeSongFromPlaylist: (playlistId, songId) => {
    set((state) => {
      const updated = state.playlists.map((p) =>
        p.id === playlistId
          ? { ...p, songs: p.songs.filter((s) => s.id !== songId) }
          : p,
      );
      persistUserPlaylists(updated);
      return { playlists: updated };
    });
  },

  getPlaylist: (id) => get().playlists.find((p) => p.id === id),

  // ─── Persistence ─────────────────────────────────────────────────────────

  loadLibrary: async () => {
    try {
      const [favJson, playlistJson, historyJson] = await Promise.all([
        AsyncStorage.getItem(FAVORITES_KEY),
        AsyncStorage.getItem(PLAYLISTS_KEY),
        AsyncStorage.getItem(HISTORY_KEY),
      ]);

      const favorites: Song[] = favJson ? JSON.parse(favJson) : [];
      const history: Song[] = historyJson ? JSON.parse(historyJson) : [];
      const userPlaylists: Playlist[] = playlistJson
        ? JSON.parse(playlistJson)
        : [];

      const systemPlaylists = buildSystemPlaylists(favorites, history);
      const playlists = [...systemPlaylists, ...userPlaylists];

      set({ favorites, history, playlists });
    } catch (e) {
      console.error('Failed to load library:', e);
    }
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Keep system playlists in sync with favorites / history arrays */
function syncSystemPlaylists(
  playlists: Playlist[],
  favorites: Song[],
  history: Song[],
): Playlist[] {
  return playlists.map((p) => {
    if (p.id === LIKES_PLAYLIST_ID) return { ...p, songs: favorites };
    if (p.id === HISTORY_PLAYLIST_ID) return { ...p, songs: history };
    return p;
  });
}

/** Persist only user-created playlists (system ones are derived at load) */
function persistUserPlaylists(playlists: Playlist[]): void {
  const userOnly = playlists.filter((p) => !p.isSystem);
  AsyncStorage.setItem(PLAYLISTS_KEY, JSON.stringify(userOnly));
}

export default useLibraryStore;
