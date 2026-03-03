import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { Song } from '../types';
import { getArtistName } from './helpers';

export const PLAYBACK_NOTIFICATION_ID = 'now_playing';

// ─── Notification Handler ───────────────────────────────────────────────────
// Controls how notifications behave while app is in the foreground
export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// ─── Android Channel ─────────────────────────────────────────────────────────
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('playback', {
    name: 'Music Playback',
    description: 'Shows the currently playing song with controls',
    importance: Notifications.AndroidImportance.LOW,
    vibrationPattern: [0],
    enableVibrate: false,
    showBadge: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ─── iOS Action Categories ───────────────────────────────────────────────────
// Defines the button actions shown below the notification on iOS
export async function setupNotificationCategories(): Promise<void> {
  if (Platform.OS !== 'ios') return;

  // Playing state — shows a Pause button
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

  // Paused state — shows a Play button
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
    const stateLabel = isPlaying ? '▶ Now Playing' : '⏸ Paused';

    await Notifications.scheduleNotificationAsync({
      identifier: PLAYBACK_NOTIFICATION_ID,
      content: {
        title: song.name,
        body: `${stateLabel}  •  ${artistName}`,
        // data is passed back when user taps the notification
        data: { navigateTo: 'Player' },
        // iOS category selects which action buttons to show
        categoryIdentifier: isPlaying ? 'PLAYBACK_PLAYING' : 'PLAYBACK_PAUSED',
        sound: false,
      },
      trigger: null, // immediate
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
