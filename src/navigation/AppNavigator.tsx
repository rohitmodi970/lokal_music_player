import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { Platform } from 'react-native';

import AiChatScreen from '../screens/AiChatScreen';
import ArtistDetailScreen from '../screens/ArtistDetailScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import HomeScreen from '../screens/HomeScreen';
import PlayerScreen from '../screens/PlayerScreen';
import PlaylistsScreen from '../screens/PlaylistsScreen';
import QueueScreen from '../screens/QueueScreen';
import SearchScreen from '../screens/SearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import useThemeStore from '../store/useThemeStore';
import { MainTabParamList, RootStackParamList } from '../types';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function MainTabs() {
  const { colors } = useThemeStore();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 70,
          paddingBottom: Platform.OS === 'ios' ? 28 : 14,
          paddingTop: 8,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="heart-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Playlists"
        component={PlaylistsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useThemeStore();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="Player"
        component={PlayerScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen name="Queue" component={QueueScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="ArtistDetail" component={ArtistDetailScreen} />
      <Stack.Screen name="AiChat" component={AiChatScreen} />
    </Stack.Navigator>
  );
}
