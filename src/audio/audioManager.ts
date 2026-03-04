import { Audio, AVPlaybackStatus, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

import useLibraryStore from '../store/useLibraryStore';
import usePlayerStore, { getCurrentSong } from '../store/usePlayerStore';
import { getDownloadUrl } from '../utils/helpers';
import {
    cancelListeningReminder,
    dismissPlaybackNotification,
    showPlaybackNotification,
    startListeningReminder,
} from '../utils/notificationManager';

let sound: Audio.Sound | null = null;
let isLoadingSound = false;

/**
 * Configure audio session for background playback
 */
export async function initAudio(): Promise<void> {
  try {
    await Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  } catch (e) {
    console.error('initAudio error:', e);
  }
}

/**
 * Called on playback status updates — syncs position/duration to store
 */
function onPlaybackStatusUpdate(status: AVPlaybackStatus): void {
  if (!status.isLoaded) {
    if (status.error) {
      console.error('Playback error:', status.error);
      usePlayerStore.getState().setIsLoading(false);
    }
    return;
  }

  const store = usePlayerStore.getState();
  store.setPosition(status.positionMillis || 0);
  store.setDuration(status.durationMillis || 0);

  if (status.isLoaded && !status.isBuffering && store.isLoading) {
    store.setIsLoading(false);
  }

  // Track finished
  if (status.didJustFinish && !status.isLooping) {
    handleTrackFinished();
  }
}

async function handleTrackFinished(): Promise<void> {
  const store = usePlayerStore.getState();
  const { repeat } = store;

  if (repeat === 'one') {
    // Replay current song
    await seekTo(0);
    await play();
  } else {
    store.playNext();
  }
}

/**
 * Load and play the current song from the queue
 */
export async function loadAndPlay(): Promise<void> {
  if (isLoadingSound) return;
  isLoadingSound = true;

  const store = usePlayerStore.getState();
  const song = getCurrentSong(store);

  if (!song) {
    isLoadingSound = false;
    return;
  }

  store.setIsLoading(true);

  try {
    // Unload previous sound
    if (sound) {
      await sound.unloadAsync();
      sound = null;
    }

    const url = song.localUri ?? getDownloadUrl(song.downloadUrl, '320kbps');
    if (!url) {
      console.error('No download URL for song:', song.name);
      store.setIsLoading(false);
      isLoadingSound = false;
      return;
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: url },
      { shouldPlay: true, progressUpdateIntervalMillis: 500 },
      onPlaybackStatusUpdate,
    );

    sound = newSound;
    store.setIsPlaying(true);
    store.setIsLoading(false);
    // Add to history
    useLibraryStore.getState().addToHistory(song);
    // Show playback notification with current song
    showPlaybackNotification(song, true).catch(() => {});
    // Start listening reminder (resets if already running)
    startListeningReminder();
  } catch (e) {
    console.error('loadAndPlay error:', e);
    store.setIsLoading(false);
  } finally {
    isLoadingSound = false;
  }
}

export async function play(): Promise<void> {
  if (sound) {
    await sound.playAsync();
    const store = usePlayerStore.getState();
    store.setIsPlaying(true);
    const song = getCurrentSong(store);
    if (song) showPlaybackNotification(song, true).catch(() => {});
  }
}

export async function pause(): Promise<void> {
  if (sound) {
    await sound.pauseAsync();
    const store = usePlayerStore.getState();
    store.setIsPlaying(false);
    const song = getCurrentSong(store);
    if (song) showPlaybackNotification(song, false).catch(() => {});
  }
}

export async function togglePlayPause(): Promise<void> {
  const { isPlaying } = usePlayerStore.getState();
  if (isPlaying) {
    await pause();
  } else {
    if (sound) {
      await play();
    } else {
      await loadAndPlay();
    }
  }
}

export async function seekTo(positionMs: number): Promise<void> {
  if (sound) {
    await sound.setPositionAsync(positionMs);
    usePlayerStore.getState().setPosition(positionMs);
  }
}

export async function skipNext(): Promise<void> {
  usePlayerStore.getState().playNext();
}

export async function skipPrevious(): Promise<void> {
  const { positionMs } = usePlayerStore.getState();
  if (positionMs > 3000) {
    await seekTo(0);
  } else {
    usePlayerStore.getState().playPrevious();
  }
}

export async function stopAndUnload(): Promise<void> {
  if (sound) {
    await sound.stopAsync();
    await sound.unloadAsync();
    sound = null;
  }
  const store = usePlayerStore.getState();
  store.setIsPlaying(false);
  store.setPosition(0);
  store.setDuration(0);
  dismissPlaybackNotification().catch(() => {});
  cancelListeningReminder();
}

/**
 * Subscribe to store changes — when currentIndex changes, load new song
 */
let previousIndex = -1;
let previousQueueLength = 0;
let previousQueueId = ''; // Track queue identity to detect real changes vs reorders

export function startStoreSubscription(): void {
  usePlayerStore.subscribe((state) => {
    const { currentIndex, queue } = state;
    // Build a lightweight queue identity: current song ID at currentIndex
    const currentSongId = currentIndex >= 0 && currentIndex < queue.length
      ? queue[currentIndex]?.id ?? ''
      : '';
    const queueId = `${currentSongId}_${currentIndex}`;

    if (
      currentIndex >= 0 &&
      queue.length > 0 &&
      currentIndex !== previousIndex
    ) {
      // Only reload if the song at the index actually changed
      const prevSongChanged = queueId !== previousQueueId;
      previousIndex = currentIndex;
      previousQueueLength = queue.length;
      previousQueueId = queueId;
      if (prevSongChanged) {
        loadAndPlay();
      }
    } else {
      previousIndex = currentIndex;
      previousQueueLength = queue.length;
      previousQueueId = queueId;
    }
  });
}
