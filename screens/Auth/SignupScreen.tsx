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
import { signUp } from '../../lib/firebase/auth';
import { Button, Input } from '../../components/ui';
import { colors, typography, spacing, borderRadius } from '../../lib/theme';
import { validateEmail, validatePhone } from '../../lib/utils';

export default function SignupScreen({ navigation }: any) {
  const [step, setStep] = useState<'role' | 'form'>('role');
  const [selectedRole, setSelectedRole] = useState<'user' | 'owner'>('user');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    businessName: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (formData.phone && !validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (selectedRole === 'owner' && !formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required for turf owners';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const result = await signUp(
        formData.email.trim(),
        formData.password,
        formData.name.trim(),
        formData.phone,
        selectedRole,
        selectedRole === 'owner' ? formData.businessName.trim() : undefined
      );

      if (result.success) {
        Alert.alert(
          'Success', 
          selectedRole === 'owner' 
            ? 'Owner account created! You can now add your turfs.'
            : 'Account created successfully!'
        );
      } else {
        Alert.alert('Signup Failed', result.error || 'Please try again');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
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
          {step === 'role' ? (
            /* STEP 1: Role Selection */
            <>
              <View style={styles.header}>
                <View style={styles.iconContainer}>
                  <Ionicons name="person-add" size={48} color={colors.primary[600]} />
                </View>
                <Text style={styles.title}>Join Playmate</Text>
                <Text style={styles.subtitle}>Choose your account type</Text>
              </View>

              <View style={styles.roleSelectionContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    selectedRole === 'user' && styles.roleCardActive
                  ]}
                  onPress={() => setSelectedRole('user')}
                >
                  <View style={[
                    styles.roleIconContainer,
                    selectedRole === 'user' && styles.roleIconContainerActive
                  ]}>
                    <Ionicons 
                      name="person" 
                      size={48} 
                      color={selectedRole === 'user' ? '#fff' : colors.primary[600]} 
                    />
                  </View>
                  <Text style={[
                    styles.roleCardTitle,
                    selectedRole === 'user' && styles.roleCardTitleActive
                  ]}>
                    User
                  </Text>
                  <Text style={[
                    styles.roleCardDescription,
                    selectedRole === 'user' && styles.roleCardDescriptionActive
                  ]}>
                    Browse and book turfs for your games
                  </Text>
                  {selectedRole === 'user' && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary[600]} />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleCard,
                    selectedRole === 'owner' && styles.roleCardActive
                  ]}
                  onPress={() => setSelectedRole('owner')}
                >
                  <View style={[
                    styles.roleIconContainer,
                    selectedRole === 'owner' && styles.roleIconContainerActive
                  ]}>
                    <Ionicons 
                      name="business" 
                      size={48} 
                      color={selectedRole === 'owner' ? '#fff' : colors.primary[600]} 
                    />
                  </View>
                  <Text style={[
                    styles.roleCardTitle,
                    selectedRole === 'owner' && styles.roleCardTitleActive
                  ]}>
                    Turf Owner
                  </Text>
                  <Text style={[
                    styles.roleCardDescription,
                    selectedRole === 'owner' && styles.roleCardDescriptionActive
                  ]}>
                    List and manage your sports facilities
                  </Text>
                  {selectedRole === 'owner' && (
                    <View style={styles.checkmark}>
                      <Ionicons name="checkmark-circle" size={24} color={colors.primary[600]} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <Button
                text="Continue"
                onPress={() => setStep('form')}
                style={styles.continueButton}
                fullWidth
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.link}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            /* STEP 2: Signup Form */
            <>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => setStep('role')}
              >
                <Ionicons name="arrow-back" size={24} color={colors.primary[600]} />
                <Text style={styles.backButtonText}>Change Account Type</Text>
              </TouchableOpacity>

              <View style={styles.header}>
                <View style={styles.selectedRoleBadge}>
                  <Ionicons 
                    name={selectedRole === 'user' ? 'person' : 'business'} 
                    size={20} 
                    color={colors.primary[600]} 
                  />
                  <Text style={styles.selectedRoleText}>
                    {selectedRole === 'user' ? 'User Account' : 'Turf Owner Account'}
                  </Text>
                </View>
                <Text style={styles.title}>Create Account</Text>
                <Text style={styles.subtitle}>
                  {selectedRole === 'user' 
                    ? 'Start booking turfs today' 
                    : 'Grow your turf business'}
                </Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChangeText={(text) => updateField('name', text)}
                  autoCapitalize="words"
                  error={errors.name}
                  required
                  leftIcon={<Ionicons name="person-outline" size={20} color={colors.gray[500]} />}
                />

                {selectedRole === 'owner' && (
                  <Input
                    label="Business Name"
                    placeholder="Enter your business/turf name"
                    value={formData.businessName}
                    onChangeText={(text) => updateField('businessName', text)}
                    autoCapitalize="words"
                    error={errors.businessName}
                    required
                    leftIcon={<Ionicons name="business-outline" size={20} color={colors.gray[500]} />}
                  />
                )}

                <Input
                  label="Email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChangeText={(text) => updateField('email', text)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  error={errors.email}
                  required
                  leftIcon={<Ionicons name="mail-outline" size={20} color={colors.gray[500]} />}
                />

                <Input
                  label="Phone Number"
                  placeholder="Enter your phone number (optional)"
                  value={formData.phone}
                  onChangeText={(text) => updateField('phone', text)}
                  keyboardType="phone-pad"
                  error={errors.phone}
                  leftIcon={<Ionicons name="call-outline" size={20} color={colors.gray[500]} />}
                />

                <Input
                  label="Password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChangeText={(text) => updateField('password', text)}
                  secureTextEntry
                  error={errors.password}
                  required
                  leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[500]} />}
                />

                <Input
                  label="Confirm Password"
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChangeText={(text) => updateField('confirmPassword', text)}
                  secureTextEntry
                  error={errors.confirmPassword}
                  required
                  leftIcon={<Ionicons name="lock-closed-outline" size={20} color={colors.gray[500]} />}
                />

                <Button
                  text="Sign Up"
                  onPress={handleSignup}
                  loading={loading}
                  disabled={loading}
                  fullWidth
                  style={styles.button}
                />
              </View>

              <View style={styles.footer}>
                <Text style={styles.footerText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.link}>Sign In</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
    marginTop: spacing.lg,
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
    textAlign: 'center',
  },
  
  // Role Selection Styles
  roleSelectionContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  roleCard: {
    width: '100%',
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    borderColor: colors.gray[300],
    backgroundColor: '#fff',
    marginBottom: spacing.lg,
    position: 'relative',
  },
  roleCardActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  roleIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  roleIconContainerActive: {
    backgroundColor: colors.primary[600],
  },
  roleCardTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  roleCardTitleActive: {
    color: colors.primary[700],
  },
  roleCardDescription: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  roleCardDescriptionActive: {
    color: colors.primary[600],
  },
  checkmark: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
  },
  continueButton: {
    marginBottom: spacing.xl,
  },
  
  // Form Step Styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    marginLeft: spacing.sm,
    fontWeight: typography.fontWeight.semibold,
  },
  selectedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary[100],
    borderRadius: borderRadius.full,
    marginBottom: spacing.lg,
  },
  selectedRoleText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
    marginLeft: spacing.sm,
  },
  form: {
    width: '100%',
  },
  button: {
    marginTop: spacing.lg,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
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
