import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signIn } from '../../lib/firebase/auth';
import { Button, Input } from '../../components/ui';
import { colors, typography, spacing, borderRadius } from '../../lib/theme';
import { validateEmail } from '../../lib/utils';

export default function LoginScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);

  // Configure Google Sign-In
  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const upsertUserDocForAuth = async (firebaseUser: any, providerName: string) => {
    const { db } = await import('../../config/firebase');
    const { initializeAdminUser } = await import('../../lib/firebase/admin');

    const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
    const baseName =
      firebaseUser.displayName ||
      firebaseUser.email ||
      `${providerName} User`;

    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      name: baseName,
      phoneNumber: firebaseUser.phoneNumber || null,
      photoURL: firebaseUser.photoURL || null,
      role: 'user',
      createdAt: new Date(),
    };

    if (!userDoc.exists()) {
      console.log(`🆕 ${providerName} user document does not exist - creating...`);
      await db.collection('users').doc(firebaseUser.uid).set(userData);

      if (firebaseUser.email) {
        await initializeAdminUser(firebaseUser.uid, firebaseUser.email);
      }
    } else {
      console.log(`✅ ${providerName} user document already exists`);
      await db.collection('users').doc(firebaseUser.uid).set(
        {
          ...userData,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    }

    const { ensureUsernameForUser } = await import('../../lib/firebase/auth');
    await ensureUsernameForUser(firebaseUser.uid, baseName);
  };

  const handleGoogleSignInSuccess = async (idToken: string) => {
    try {
      console.log('🔐 Creating Google credential with ID token...');
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      console.log('✅ Google credential created');

      console.log('🔄 Signing in to Firebase with credential...');
      const userCredential = await auth().signInWithCredential(googleCredential);
      console.log('✅ Successfully signed in to Firebase!');

      await upsertUserDocForAuth(userCredential.user, 'Google');
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      Alert.alert('Error', error.message || 'Failed to sign in with Google');
    }
  };

  const handleAppleSignIn = async () => {
    try {
      if (Platform.OS !== 'ios') {
        Alert.alert('Apple Login', 'Apple Sign-In is available on iOS devices.');
        return;
      }

      setLoading(true);
      console.log('🔐 Starting Apple Sign-In...');

      const appleResult = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!appleResult.identityToken) {
        throw new Error('No identity token received from Apple');
      }

      const appleCredential = auth.AppleAuthProvider.credential(
        appleResult.identityToken,
        appleResult.nonce
      );

      const userCredential = await auth().signInWithCredential(appleCredential);
      console.log('✅ Apple Sign-In successful:', userCredential.user.email);

      await upsertUserDocForAuth(userCredential.user, 'Apple');
    } catch (error: any) {
      console.error('❌ Apple Sign-In error:', error);

      if (error.code === 'ERR_CANCELED') {
        console.log('User cancelled Apple sign-in');
      } else {
        Alert.alert('Error', error.message || 'Failed to sign in with Apple');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      console.log('🔐 Starting Google Sign-In...');

      await GoogleSignin.hasPlayServices();

      const userInfo = await GoogleSignin.signIn();
      console.log('✅ Google Sign-In successful:', userInfo.data?.user.email);

      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        throw new Error('No ID token received from Google');
      }

      await handleGoogleSignInSuccess(idToken);
    } catch (error: any) {
      console.error('❌ Google Sign-In error:', error);

      if (error.code === 'SIGN_IN_CANCELLED') {
        console.log('User cancelled sign-in');
      } else if (error.code === 'IN_PROGRESS') {
        Alert.alert('Please wait', 'Sign-in already in progress');
      } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
        Alert.alert('Error', 'Google Play Services not available');
      } else {
        Alert.alert('Error', error.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="football" size={48} color={colors.primary[600]} />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to book your turf</Text>
          </View>

          {/* Primary Auth Methods */}
          <View style={styles.form}>
            {/* Phone Sign-In Button - PRIMARY */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('PhoneSignIn')}
              disabled={loading}
            >
              <View style={styles.primaryButtonContent}>
                <Ionicons name="call" size={24} color="#ffffff" />
                <Text style={styles.primaryButtonText}>Continue with Phone</Text>
              </View>
            </TouchableOpacity>

            {/* Google Sign-In Button */}
            <TouchableOpacity
              style={styles.googleButton}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Apple Sign-In Button */}
            <TouchableOpacity
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              <Ionicons name="logo-apple" size={20} color="#111827" />
              <Text style={styles.appleButtonText}>Continue with Apple</Text>
            </TouchableOpacity>

            {/* Email Sign-In Button */}
            <TouchableOpacity
              style={styles.emailButton}
              onPress={() => navigation.navigate('EmailSignIn')}
              disabled={loading}
            >
              <Ionicons name="mail-outline" size={20} color={colors.textPrimary} />
              <Text style={styles.emailButtonText}>Sign in with Email</Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.link}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: spacing.lg,
  },
  primaryButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.lg,
    color: '#ffffff',
    fontWeight: typography.fontWeight.bold,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[300],
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  googleButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#111827',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  appleButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: spacing.md + 2,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[300],
    gap: spacing.sm,
  },
  emailButtonText: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  link: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
});
