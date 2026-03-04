import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    ViewToken,
} from 'react-native';

import useThemeStore from '../store/useThemeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface OnboardingSlide {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
  emoji: string;
}

const SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    icon: 'musical-notes',
    title: 'Welcome to Lokal',
    description:
      'Your personal music player with millions of songs from JioSaavn. Stream Bollywood, Punjabi, Indie & more!',
    color: '#E8364F',
    emoji: '🎵',
  },
  {
    id: '2',
    icon: 'sparkles',
    title: 'AI-Powered Discovery',
    description:
      'Our AI assistant suggests songs based on your mood, time of day, and preferences. Just ask for recommendations!',
    color: '#8B5CF6',
    emoji: '✨',
  },
  {
    id: '3',
    icon: 'list',
    title: 'Smart Queue & Playlists',
    description:
      'Create playlists, manage your queue with drag-and-drop, and let AI auto-suggest what to play next.',
    color: '#1DB954',
    emoji: '📋',
  },
  {
    id: '4',
    icon: 'heart',
    title: 'Favorites & History',
    description:
      'Like songs to save them, browse your listening history, and rediscover your favorite tracks anytime.',
    color: '#EC4899',
    emoji: '❤️',
  },
  {
    id: '5',
    icon: 'notifications',
    title: 'Music Controls Everywhere',
    description:
      'Control playback from notifications — pause, skip, and play next. Set a sleep timer for bedtime listening.',
    color: '#F97316',
    emoji: '🔔',
  },
  {
    id: '6',
    icon: 'phone-portrait',
    title: 'Local Music Support',
    description:
      'Play songs from your device alongside streaming. All your music in one place!',
    color: '#06B6D4',
    emoji: '📱',
  },
];

interface Props {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: Props) {
  const { colors } = useThemeStore();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goToNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    } else {
      onComplete();
    }
  };

  const renderSlide = ({ item, index }: { item: OnboardingSlide; index: number }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
        <Text style={styles.slideEmoji}>{item.emoji}</Text>
        <Ionicons name={item.icon} size={64} color={item.color} style={{ marginTop: 8 }} />
      </View>
      <Text style={[styles.slideTitle, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.slideDescription, { color: colors.textSecondary }]}>
        {item.description}
      </Text>
    </View>
  );

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.skipContainer}>
        {!isLastSlide ? (
          <TouchableOpacity onPress={onComplete} style={styles.skipBtn}>
            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipBtn} />
        )}
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        bounces={false}
      />

      {/* Dots */}
      <View style={styles.dotsContainer}>
        {SLIDES.map((slide, index) => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 24, 8],
            extrapolate: 'clamp',
          });
          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={slide.id}
              style={[
                styles.dot,
                {
                  width: dotWidth,
                  opacity: dotOpacity,
                  backgroundColor: slide.color,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Bottom button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: SLIDES[currentIndex].color }]}
          onPress={goToNext}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>
            {isLastSlide ? "Let's Go!" : 'Next'}
          </Text>
          {!isLastSlide && (
            <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 8 }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  skipBtn: {
    padding: 8,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '500',
  },
  slide: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  slideEmoji: {
    fontSize: 40,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  slideDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  bottomContainer: {
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  nextBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 30,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
