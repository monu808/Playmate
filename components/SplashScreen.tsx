
import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Text,
  Image,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Update this require path to where you put the PlayMate logo inside your RN project, for example:
// const logo = require('../assets/Playmate_logo-removebg-preview.png');
const logo = require('../assets/splash-icon.png');

interface SplashScreenProps {
  onFinish: () => void;
  appName?: string;
}

export function SplashScreen({ onFinish, appName = 'PlayMate' }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current; // For overall opacity
  const scaleAnim = useRef(new Animated.Value(0.8)).current; // Entrance scale
  const pulseAnim = useRef(new Animated.Value(1)).current; // Continuous pulse
  const rotateAnim = useRef(new Animated.Value(0)).current; // Continuous rotation
  const textTranslate = useRef(new Animated.Value(12)).current; // Text slide-up

  // Keep references to loops so we can stop them on unmount
  const pulseLoopRef = useRef<any>(null);
  const rotateLoopRef = useRef<any>(null);

  useEffect(() => {
    // Entrance: fade + pop + text slide
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslate, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After entrance, start gentle pulsing and slow rotation
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.04,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      // rotateLoopRef.current = Animated.loop(
      //   Animated.timing(rotateAnim, {
      //     toValue: 1,
      //     duration: 14000,
      //     easing: Easing.linear,
      //     useNativeDriver: true,
      //   }),
      // );

      // pulseLoopRef.current.start();
      // rotateLoopRef.current.start();
    });

    // Exit after a graceful hold
    const timer = setTimeout(() => {
      // Stop infinite loops first for predictable exit
      try {
        pulseLoopRef.current?.stop?.();
        rotateLoopRef.current?.stop?.();
      } catch (e) {
        // ignore
      }

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.bezier(0.2, 0.8, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.12,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: -8,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => onFinish && onFinish());
    }, 2600);

    return () => {
      clearTimeout(timer);
      pulseLoopRef.current?.stop?.();
      rotateLoopRef.current?.stop?.();
    };
  }, [fadeAnim, scaleAnim, pulseAnim, rotateAnim, textTranslate, onFinish]);

  // Rotation interpolation
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Responsive sizing
  const logoSize = Math.round(Math.min(width, height) * 0.34);
  const containerSize = logoSize + 48;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#16a34a', '#15803d', '#0f5132']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Animated.View
          style={[
            styles.card,
            {
              width: containerSize,
              height: containerSize,
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
            },
            styles.cardShadow,
          ]}
        >
          <Animated.View
            style={[
              styles.logoWrapper,
              {
                transform: [{ rotate }],
              },
            ]}
          >
            <Animated.Image
              source={logo}
              resizeMode="contain"
              style={[
                {
                  width: logoSize,
                  height: logoSize,
                },
                styles.logoImage,
              ]}
            />
          </Animated.View>
        </Animated.View>

        <Animated.View
          style={[
            styles.appNameWrap,
            {
              opacity: fadeAnim,
              transform: [{ translateY: textTranslate }],
            },
          ]}
        >
          <Text style={styles.appName}>{appName}</Text>
          <Text style={styles.tagline}>Your match. Your moments.</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    // subtle stroke
    borderWidth: Platform.OS === 'ios' ? 0.6 : 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 18,
  },
  logoWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    borderRadius: 18,
    // a tiny inner shadow effect via overlay (native shadow across platforms is limited)
  },
  appNameWrap: {
    marginTop: 18,
    alignItems: 'center',
  },
  appName: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  tagline: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    marginTop: 6,
    opacity: 0.95,
  },
});
