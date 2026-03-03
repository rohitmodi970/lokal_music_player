import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import './app/global.css';

import { initAudio, skipNext, skipPrevious, startStoreSubscription, togglePlayPause } from './src/audio/audioManager';
import AppNavigator from './src/navigation/AppNavigator';
import useLibraryStore from './src/store/useLibraryStore';
import usePlayerStore from './src/store/usePlayerStore';
import useThemeStore from './src/store/useThemeStore';
import { RootStackParamList } from './src/types';
import { initNotifications } from './src/utils/notificationManager';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function App() {
  const { colors, isDark } = useThemeStore();

  useEffect(() => {
    initAudio();
    startStoreSubscription();
    usePlayerStore.getState().loadPersistedQueue();
    useThemeStore.getState().loadTheme();

    // Init notification permissions + channel + categories
    initNotifications();

    // Load persisted library (favorites, playlists, history)
    useLibraryStore.getState().loadLibrary();

    // Handle tapping the notification (or action buttons on iOS)
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data as Record<string, string>;

      // Action buttons (iOS only)
      if (actionId === 'PREVIOUS') {
        skipPrevious();
        return;
      }
      if (actionId === 'NEXT') {
        skipNext();
        return;
      }
      if (actionId === 'PLAY' || actionId === 'PAUSE') {
        togglePlayPause();
        return;
      }

      // Default tap — navigate to Player screen
      if (data?.navigateTo === 'Player' && navigationRef.isReady()) {
        navigationRef.navigate('Player');
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <GestureHandlerRootView className="flex-1" style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={{
            dark: isDark,
            colors: {
              primary: colors.primary,
              background: colors.background,
              card: colors.surface,
              text: colors.text,
              border: colors.border,
              notification: colors.primary,
            },
            fonts: {
              regular: { fontFamily: 'System', fontWeight: '400' },
              medium: { fontFamily: 'System', fontWeight: '500' },
              bold: { fontFamily: 'System', fontWeight: '700' },
              heavy: { fontFamily: 'System', fontWeight: '800' },
            },
          }}
        >
          <View className="flex-1" style={{ flex: 1, backgroundColor: colors.background }}>
            <AppNavigator />
          </View>
        </NavigationContainer>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
