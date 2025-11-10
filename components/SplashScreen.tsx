
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
  const scaleAnim = useRef(new Animated.Value(0.3)).current; // Entrance scale - start smaller
  const pulseAnim = useRef(new Animated.Value(1)).current; // Continuous pulse
  const textTranslate = useRef(new Animated.Value(30)).current; // Text slide-up - increased
  const glowAnim = useRef(new Animated.Value(0)).current; // Glow effect
  const particleAnim = useRef(new Animated.Value(0)).current; // Particle effect

  // Keep references to loops so we can stop them on unmount
  const pulseLoopRef = useRef<any>(null);

  useEffect(() => {
    // Entrance: fade + pop + text slide + glow
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(textTranslate, {
        toValue: 0,
        duration: 900,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(particleAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // After entrance, start gentle pulsing
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.06,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );

      pulseLoopRef.current.start();
    });

    // Exit after a graceful hold
    const timer = setTimeout(() => {
      // Stop infinite loops first for predictable exit
      try {
        pulseLoopRef.current?.stop?.();
      } catch (e) {
        // ignore
      }

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 700,
          easing: Easing.in(Easing.back(1.3)),
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: -20,
          duration: 700,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => onFinish && onFinish());
    }, 3000);

    return () => {
      clearTimeout(timer);
      pulseLoopRef.current?.stop?.();
    };
  }, [fadeAnim, scaleAnim, pulseAnim, textTranslate, glowAnim, particleAnim, onFinish]);

  // Glow opacity interpolation
  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.4],
  });

  // Particle animations
  const particle1Scale = particleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const particle1Translate = particleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -60],
  });

  const particle2Translate = particleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });

  // Responsive sizing - made logo bigger
  const logoSize = Math.round(Math.min(width, height) * 0.45);
  const containerSize = logoSize + 60;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#16a34a', '#15803d', '#0f5132']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Animated background particles */}
        <Animated.View
          style={[
            styles.particle,
            styles.particle1,
            {
              opacity: glowOpacity,
              transform: [
                { scale: particle1Scale },
                { translateX: particle1Translate },
                { translateY: particle1Translate },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.particle,
            styles.particle2,
            {
              opacity: glowOpacity,
              transform: [
                { scale: particle1Scale },
                { translateX: particle2Translate },
                { translateY: particle1Translate },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.particle,
            styles.particle3,
            {
              opacity: glowOpacity,
              transform: [
                { scale: particle1Scale },
                { translateX: particle1Translate },
                { translateY: particle2Translate },
              ],
            },
          ]}
        />

        {/* Outer glow ring - made bigger */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              width: containerSize + 80,
              height: containerSize + 80,
              opacity: glowOpacity,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Content container to center logo and text together */}
        <View style={styles.contentContainer}>
          {/* Logo without rotation */}
          <Animated.View
            style={[
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
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
            <View style={styles.taglineContainer}>
              <View style={styles.taglineDot} />
              <Text style={styles.tagline}>Your match. Your moments.</Text>
              <View style={styles.taglineDot} />
            </View>
          </Animated.View>
        </View>
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
  particle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  particle1: {
    top: '20%',
    left: '10%',
  },
  particle2: {
    top: '20%',
    right: '10%',
  },
  particle3: {
    bottom: '25%',
    left: '15%',
  },
  glowRing: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  appNameWrap: {
    // marginTop: 30,
    alignItems: 'center',
  },
  appName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // marginTop: 8,
    gap: 8,
  },
  taglineDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  tagline: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
});
