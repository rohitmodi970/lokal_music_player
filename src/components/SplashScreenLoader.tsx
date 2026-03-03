import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Easing,
    Image,
    StyleSheet,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const PANEL_COLORS = [
  '#F7C948',
  '#FDB100',
  '#FD5C05',
  '#CB005B',
  '#6500AA',
  '#0A0564',
];

const PANEL_WIDTH = width / PANEL_COLORS.length;

// Each panel slides up from below, staggered by STAGGER ms
const SLIDE_DURATION = 480;
const STAGGER = 110;
// After last panel lands, logo pops in
const LOGO_DELAY = STAGGER * (PANEL_COLORS.length - 1) + SLIDE_DURATION + 60;
const LOGO_DURATION = 420;
// How long we hold the full splash before fading out
const HOLD_AFTER_LOGO = 900;
const EXIT_DURATION = 450;

interface Props {
  onComplete?: () => void;
}

export default function SplashScreenLoader({ onComplete }: Props) {
  // One translateY per panel — start above screen, slide DOWN into place
  const panelY = useRef(
    PANEL_COLORS.map(() => new Animated.Value(-height))
  ).current;

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.2)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Slide every panel up, staggered
    const slideAnims = panelY.map((val, i) =>
      Animated.timing(val, {
        toValue: 0,
        duration: SLIDE_DURATION,
        delay: i * STAGGER,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );

    // 2. Logo pops in with spring after all panels land
    const logoIn = Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: LOGO_DURATION,
        delay: LOGO_DELAY,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        delay: LOGO_DELAY,
        friction: 5,
        tension: 70,
        useNativeDriver: true,
      }),
    ]);

    // 3. Fade everything out after hold
    const exitFade = Animated.timing(containerOpacity, {
      toValue: 0,
      duration: EXIT_DURATION,
      delay: LOGO_DELAY + LOGO_DURATION + HOLD_AFTER_LOGO,
      useNativeDriver: true,
    });

    Animated.parallel([
      ...slideAnims,
      logoIn,
      exitFade,
    ]).start(() => onComplete?.());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View
      style={[styles.container, { opacity: containerOpacity }]}
      pointerEvents="none"
    >
      {/* Panels absolutely positioned — translateY slides them up from below */}
      {PANEL_COLORS.map((color, i) => (
        <Animated.View
          key={i}
          style={[
            styles.panel,
            {
              left: i * PANEL_WIDTH,
              backgroundColor: color,
              transform: [{ translateY: panelY[i] }],
            },
          ]}
        />
      ))}

      {/* White K logo centred */}
      <Animated.View
        style={[
          styles.logoOverlay,
          { opacity: logoOpacity, transform: [{ scale: logoScale }] },
        ]}
        pointerEvents="none"
      >
        <Image
          source={require('../../assets/images/6901a1e2ca0de6f8a827bb63_lokal-k-white.webp')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    zIndex: 99999,
    elevation: 99999,
    overflow: 'hidden',
  },
  panel: {
    position: 'absolute',
    top: 0,
    width: PANEL_WIDTH,
    height,
  },
  logoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.28,
    height: width * 0.28,
  },
});
