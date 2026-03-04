import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { Song } from '../types';
import { getArtistName } from './helpers';

export const PLAYBACK_NOTIFICATION_ID = 'now_playing';
export const LISTENING_REMINDER_ID = 'listening_reminder';

// ─── Notification Handler ───────────────────────────────────────────────────
// Controls how notifications behave while app is in the foreground
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// ─── Android Channels ────────────────────────────────────────────────────────
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  // Playback channel - low importance, no sound/vibration
  await Notifications.setNotificationChannelAsync('playback', {
    name: 'Music Playback',
    description: 'Shows the currently playing song with controls',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });

  // Reminders channel - default importance
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    description: 'Listening time reminders and break notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── iOS Action Categories ───────────────────────────────────────────────────
export async function setupNotificationCategories(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await Notifications.setNotificationCategoryAsync('PLAYBACK_PLAYING', [
    {
      identifier: 'PREVIOUS',
      buttonTitle: '⏮ Previous',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'PAUSE',
      buttonTitle: '⏸ Pause',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'NEXT',
      buttonTitle: '⏭ Next',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);

  await Notifications.setNotificationCategoryAsync('PLAYBACK_PAUSED', [
    {
      identifier: 'PREVIOUS',
      buttonTitle: '⏮ Previous',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'PLAY',
      buttonTitle: '▶ Play',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
    {
      identifier: 'NEXT',
      buttonTitle: '⏭ Next',
      options: { isDestructive: false, isAuthenticationRequired: false },
    },
  ]);
}

// ─── Permissions ─────────────────────────────────────────────────────────────
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Init (call once on app start) ───────────────────────────────────────────
export async function initNotifications(): Promise<void> {
  setupNotificationHandler();
  await setupNotificationChannel();
  await setupNotificationCategories();
  await requestNotificationPermissions();
}

// ─── Show / Update Playback Notification ─────────────────────────────────────
export async function showPlaybackNotification(
  song: Song,
  isPlaying: boolean,
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    const artistName = getArtistName(song);
    const stateIcon = isPlaying ? '▶' : '⏸';
    const albumName = song.album?.name || '';

    // Build a Spotify/YT Music-like notification body
    const bodyParts = [artistName];
    if (albumName && albumName !== 'Local') bodyParts.push(albumName);
    const body = bodyParts.join(' • ');

    await Notifications.scheduleNotificationAsync({
      identifier: PLAYBACK_NOTIFICATION_ID,
      content: {
        title: `${stateIcon} ${song.name}`,
        body,
        subtitle: isPlaying ? 'Playing' : 'Paused',
        data: { navigateTo: 'Player' },
        categoryIdentifier: isPlaying ? 'PLAYBACK_PLAYING' : 'PLAYBACK_PAUSED',
        sound: false,
        sticky: true,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn('showPlaybackNotification error:', e);
  }
}

// ─── Dismiss ─────────────────────────────────────────────────────────────────
export async function dismissPlaybackNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(PLAYBACK_NOTIFICATION_ID);
  } catch {
    // silently ignore if nothing to dismiss
  }
}

// ─── Listening Time Reminder ─────────────────────────────────────────────────
let listeningStartTime: number | null = null;
let reminderTimerRef: ReturnType<typeof setTimeout> | null = null;

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function startListeningReminder(): void {
  cancelListeningReminder();
  listeningStartTime = Date.now();
  
  reminderTimerRef = setTimeout(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') return;

      await Notifications.scheduleNotificationAsync({
        identifier: LISTENING_REMINDER_ID,
        content: {
          title: '🎵 Time for a break!',
          body: "You've been listening for an hour. Take a short break to rest your ears!",
          data: { type: 'reminder' },
          sound: true,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Listening reminder error:', e);
    }
  }, REMINDER_INTERVAL_MS);
}

export function cancelListeningReminder(): void {
  if (reminderTimerRef) {
    clearTimeout(reminderTimerRef);
    reminderTimerRef = null;
  }
  listeningStartTime = null;
}

export function resetListeningReminder(): void {
  if (listeningStartTime !== null) {
    startListeningReminder();
  }
}
