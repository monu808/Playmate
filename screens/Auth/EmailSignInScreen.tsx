import React, { useState } from 'react';
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
import { signIn } from '../../lib/firebase/auth';
import { Button, Input } from '../../components/ui';
import { colors, typography, spacing, borderRadius } from '../../lib/theme';
import { validateEmail } from '../../lib/utils';

export default function EmailSignInScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validateForm = (): boolean => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await signIn(email.trim(), password);
      
      if (result.success) {
        // Navigation will be handled by auth state change
      } else {
        Alert.alert('Login Failed', result.error || 'Please check your credentials');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.title}>Email Sign In</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={80} color={colors.primary[600]} />
          </View>

          {/* Instructions */}
          <Text style={styles.subtitle}>
            Enter your email and password to continue
          </Text>

          {/* Form */}
          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="Enter your email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (errors.email) setErrors({ ...errors, email: undefined });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
              leftIcon={<Ionicons name="mail-outline" size={20} color={colors.gray[500]} />}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errors.password) setErrors({ ...errors, password: undefined });
              }}
              secureTextEntry
              autoComplete="password"
              error={errors.password}
              leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[500]} />}
            />

            <Button
              text={loading ? 'Signing In...' : 'Sign In'}
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              fullWidth
              style={styles.button}
            />
          </View>

          {/* Other Sign In Options */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.otherSignInButton}
          >
            <Text style={styles.otherSignInText}>
              Use Phone or Google
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    lineHeight: typography.lineHeight.normal * typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: {
    marginBottom: spacing.lg,
  },
  button: {
    marginTop: spacing.lg,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray[300],
  },
  dividerText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
  },
  otherSignInButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  otherSignInText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
});
