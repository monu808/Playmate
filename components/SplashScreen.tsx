import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  Text,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const logo = require('../assets/splash-icon.png');

interface SplashScreenProps {
  onFinish: () => void;
  appName?: string;
}

export function SplashScreen({ onFinish, appName = 'PlayMate' }: SplashScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslate = useRef(new Animated.Value(20)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Staggered entrance animation
    Animated.sequence([
      // Logo appears with bounce
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 5,
          tension: 80,
          useNativeDriver: true,
        }),
      ]),
      // App name slides up
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslate, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
      ]),
      // Tagline fades in
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Start gentle pulse
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      pulseLoopRef.current.start();

      // Shimmer effect
      shimmerLoopRef.current = Animated.loop(
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      shimmerLoopRef.current.start();
    });

    // Exit after hold time
    const timer = setTimeout(() => {
      pulseLoopRef.current?.stop();
      shimmerLoopRef.current?.stop();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(taglineOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onFinish && onFinish());
    }, 2500);

    return () => {
      clearTimeout(timer);
      pulseLoopRef.current?.stop();
      shimmerLoopRef.current?.stop();
    };
  }, []);

  const logoSize = Math.min(width * 0.35, 150);
  
  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#16a34a', '#15803d', '#166534']}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        {/* Decorative circles */}
        <View style={[styles.decorCircle, styles.circle1]} />
        <View style={[styles.decorCircle, styles.circle2]} />
        <View style={[styles.decorCircle, styles.circle3]} />

        {/* Main content */}
        <View style={styles.contentContainer}>
          {/* Logo with glow effect */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
              },
            ]}
          >
            <View style={styles.logoGlow} />
            <Image
              source={logo}
              resizeMode="contain"
              style={[styles.logoImage, { width: logoSize, height: logoSize }]}
            />
          </Animated.View>

          {/* App name */}
          <Animated.View
            style={[
              styles.textContainer,
              {
                opacity: textOpacity,
                transform: [{ translateY: textTranslate }],
              },
            ]}
          >
            <Text style={styles.appName}>{appName}</Text>
            
            {/* Shimmer effect on app name */}
            <Animated.View
              style={[
                styles.shimmer,
                { transform: [{ translateX: shimmerTranslate }] },
              ]}
            />
          </Animated.View>

          {/* Tagline */}
          <Animated.View style={{ opacity: taglineOpacity }}>
            <View style={styles.taglineContainer}>
              <View style={styles.taglineLine} />
              <Text style={styles.tagline}>Your match. Your moments.</Text>
              <View style={styles.taglineLine} />
            </View>
          </Animated.View>
        </View>

        {/* Bottom branding */}
        <Animated.View style={[styles.bottomBrand, { opacity: taglineOpacity }]}>
          <Text style={styles.bottomText}>⚽ Book • Play • Win</Text>
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  gradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  circle1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
  },
  circle2: {
    width: 200,
    height: 200,
    bottom: 100,
    left: -80,
  },
  circle3: {
    width: 150,
    height: 150,
    bottom: -50,
    right: 50,
  },
  contentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logoGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  logoImage: {
    borderRadius: 24,
  },
  textContainer: {
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 12,
  },
  appName: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    transform: [{ skewX: '-20deg' }],
  },
  taglineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  taglineLine: {
    width: 20,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 1,
    marginHorizontal: 12,
  },
  tagline: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  bottomBrand: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  bottomText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
