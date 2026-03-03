import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { RepeatMode, Song } from '../types';

const QUEUE_STORAGE_KEY = '@lokal_player_queue';
const CURRENT_INDEX_KEY = '@lokal_player_current_index';

export interface PlayerState {
  // Queue
  queue: Song[];
  currentIndex: number;

  // Playback state
  isPlaying: boolean;
  isLoading: boolean;
  positionMs: number;
  durationMs: number;

  // Modes
  shuffle: boolean;
  repeat: RepeatMode;

  // Actions - Queue
  setQueue: (songs: Song[], startIndex?: number) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (from: number, to: number) => void;
  clearQueue: () => void;

  // Actions - Playback
  setCurrentIndex: (index: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setPosition: (ms: number) => void;
  setDuration: (ms: number) => void;
  playNext: () => void;
  playPrevious: () => void;

  // Actions - Modes
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // Persistence
  loadPersistedQueue: () => Promise<void>;
  persistQueue: () => Promise<void>;
}

// Helper to get current song
export function getCurrentSong(state: PlayerState): Song | null {
  if (state.queue.length === 0) return null;
  if (state.currentIndex < 0 || state.currentIndex >= state.queue.length) return null;
  return state.queue[state.currentIndex];
}

const usePlayerStore = create<PlayerState>((set, get) => ({
  // Initial state
  queue: [],
  currentIndex: -1,
  isPlaying: false,
  isLoading: false,
  positionMs: 0,
  durationMs: 0,
  shuffle: false,
  repeat: 'off',

  // --- Queue Actions ---

  setQueue: (songs, startIndex = 0) => {
    set({ queue: songs, currentIndex: startIndex, positionMs: 0, durationMs: 0 });
    get().persistQueue();
  },

  addToQueue: (song) => {
    const { queue } = get();
    set({ queue: [...queue, song] });
    get().persistQueue();
  },

  removeFromQueue: (index) => {
    const { queue, currentIndex } = get();
    if (index < 0 || index >= queue.length) return;
    const newQueue = [...queue];
    newQueue.splice(index, 1);

    let newIndex = currentIndex;
    if (index < currentIndex) {
      newIndex = currentIndex - 1;
    } else if (index === currentIndex) {
      // If removing current song, keep index (next song slides in)
      if (newIndex >= newQueue.length) newIndex = newQueue.length - 1;
    }

    set({ queue: newQueue, currentIndex: newIndex });
    get().persistQueue();
  },

  reorderQueue: (from, to) => {
    const { queue, currentIndex } = get();
    const newQueue = [...queue];
    const [moved] = newQueue.splice(from, 1);
    newQueue.splice(to, 0, moved);

    // Track current index shift
    let newIndex = currentIndex;
    if (currentIndex === from) {
      newIndex = to;
    } else if (from < currentIndex && to >= currentIndex) {
      newIndex = currentIndex - 1;
    } else if (from > currentIndex && to <= currentIndex) {
      newIndex = currentIndex + 1;
    }

    set({ queue: newQueue, currentIndex: newIndex });
    get().persistQueue();
  },

  clearQueue: () => {
    set({ queue: [], currentIndex: -1, isPlaying: false, positionMs: 0, durationMs: 0 });
    get().persistQueue();
  },

  // --- Playback Actions ---

  setCurrentIndex: (index) => {
    set({ currentIndex: index, positionMs: 0, durationMs: 0 });
    get().persistQueue();
  },

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setPosition: (ms) => set({ positionMs: ms }),

  setDuration: (ms) => set({ durationMs: ms }),

  playNext: () => {
    const { queue, currentIndex, shuffle, repeat } = get();
    if (queue.length === 0) return;

    if (repeat === 'one') {
      // Restart current song - handled by audio manager
      set({ positionMs: 0 });
      return;
    }

    let nextIndex: number;

    if (shuffle) {
      // Random index different from current
      if (queue.length === 1) {
        nextIndex = 0;
      } else {
        do {
          nextIndex = Math.floor(Math.random() * queue.length);
        } while (nextIndex === currentIndex);
      }
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeat === 'all') {
          nextIndex = 0;
        } else {
          // End of queue, stop
          set({ isPlaying: false });
          return;
        }
      }
    }

    set({ currentIndex: nextIndex, positionMs: 0, durationMs: 0 });
    get().persistQueue();
  },

  playPrevious: () => {
    const { queue, currentIndex, positionMs } = get();
    if (queue.length === 0) return;

    // If more than 3 seconds in, restart current song
    if (positionMs > 3000) {
      set({ positionMs: 0 });
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = queue.length - 1;

    set({ currentIndex: prevIndex, positionMs: 0, durationMs: 0 });
    get().persistQueue();
  },

  // --- Mode Actions ---

  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),

  cycleRepeat: () =>
    set((s) => {
      const modes: RepeatMode[] = ['off', 'all', 'one'];
      const idx = modes.indexOf(s.repeat);
      return { repeat: modes[(idx + 1) % modes.length] };
    }),

  // --- Persistence ---

  loadPersistedQueue: async () => {
    try {
      const [queueJson, indexStr] = await Promise.all([
        AsyncStorage.getItem(QUEUE_STORAGE_KEY),
        AsyncStorage.getItem(CURRENT_INDEX_KEY),
      ]);
      if (queueJson) {
        const queue: Song[] = JSON.parse(queueJson);
        const currentIndex = indexStr ? parseInt(indexStr, 10) : 0;
        set({ queue, currentIndex: Math.min(currentIndex, queue.length - 1) });
      }
    } catch (e) {
      console.error('Failed to load persisted queue:', e);
    }
  },

  persistQueue: async () => {
    try {
      const { queue, currentIndex } = get();
      await Promise.all([
        AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue)),
        AsyncStorage.setItem(CURRENT_INDEX_KEY, currentIndex.toString()),
      ]);
    } catch (e) {
      console.error('Failed to persist queue:', e);
    }
  },
}));

export default usePlayerStore;
