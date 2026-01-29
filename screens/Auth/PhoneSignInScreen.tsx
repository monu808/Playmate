import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableOpacity,
  TextInput as RNTextInput,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { sendPhoneOTP, verifyPhoneOTP } from '../../lib/firebase/auth';
import { Button, Input } from '../../components/ui';
import { colors, typography, spacing, borderRadius } from '../../lib/theme';

export default function PhoneSignInScreen({ navigation }: any) {
  const [phoneNumber, setPhoneNumber] = useState('+91');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<any>(null);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);

  // OTP input refs
  const otpRefs = useRef<(RNTextInput | null)[]>([]);

  // Start countdown timer
  const startTimer = () => {
    setTimer(60);
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOTP = async () => {
    setError('');

    // Validate phone number
    if (phoneNumber.length < 13) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const result = await sendPhoneOTP(phoneNumber);

      if (result.success && result.confirmation) {
        setConfirmation(result.confirmation);
        startTimer();
        Alert.alert('Success', 'OTP sent successfully!');
      } else {
        setError(result.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    setError('');
    const otpCode = otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit OTP');
      return;
    }

    if (!confirmation) {
      setError('Please request OTP first');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyPhoneOTP(confirmation, otpCode);

      if (result.success) {
        Alert.alert('Success', 'Phone number verified successfully!');
        // Navigation will be handled by AuthContext
      } else {
        setError(result.error || 'Failed to verify OTP');
        // Clear OTP inputs on error
        setOtp(['', '', '', '', '', '']);
        otpRefs.current[0]?.focus();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) return;
    setOtp(['', '', '', '', '', '']);
    await handleSendOTP();
  };

  const handleOtpChange = (text: string, index: number) => {
    // Only allow numbers
    if (text && !/^\d+$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-focus next input
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-verify when all digits are entered
    if (index === 5 && text) {
      const fullOtp = [...newOtp];
      fullOtp[index] = text;
      if (fullOtp.every((digit) => digit)) {
        handleVerifyOTP();
      }
    }
  };

  const handleOtpKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePhoneNumberChange = (text: string) => {
    // Ensure it starts with +91
    if (!text.startsWith('+91')) {
      setPhoneNumber('+91');
      return;
    }

    // Only allow numbers after +91
    const numbers = text.slice(3).replace(/\D/g, '');
    if (numbers.length <= 10) {
      setPhoneNumber('+91' + numbers);
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
            <Text style={styles.title}>Phone Sign In</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="phone-portrait-outline" size={80} color={colors.primary[600]} />
          </View>

          {/* Instructions */}
          <Text style={styles.subtitle}>
            {confirmation
              ? 'Enter the 6-digit code sent to your phone'
              : 'Enter your phone number to receive OTP'}
          </Text>

          {/* Phone Number Input */}
          {!confirmation && (
            <View style={styles.inputSection}>
              <Input
                label="Phone Number"
                value={phoneNumber}
                onChangeText={handlePhoneNumberChange}
                placeholder="+91XXXXXXXXXX"
                keyboardType="phone-pad"
                maxLength={13}
                leftIcon={
                  <Ionicons name="call-outline" size={20} color={colors.textSecondary} />
                }
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                text={loading ? 'Sending OTP...' : 'Send OTP'}
                onPress={handleSendOTP}
                loading={loading}
                disabled={loading || phoneNumber.length < 13}
                style={styles.button}
              />
            </View>
          )}

          {/* OTP Input */}
          {confirmation && (
            <View style={styles.inputSection}>
              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      otpRefs.current[index] = ref;
                    }}
                    style={styles.otpInput}
                    value={digit}
                    onChangeText={(text: string) => handleOtpChange(text, index)}
                    onKeyPress={(e: NativeSyntheticEvent<TextInputKeyPressEventData>) => handleOtpKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={1}
                    selectTextOnFocus
                  />
                ))}
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <Button
                text={loading ? 'Verifying...' : 'Verify OTP'}
                onPress={handleVerifyOTP}
                loading={loading}
                disabled={loading || otp.some((digit) => !digit)}
                style={styles.button}
              />

              {/* Resend OTP */}
              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={timer > 0}
                style={styles.resendButton}
              >
                <Text style={[styles.resendText, timer > 0 && styles.resendTextDisabled]}>
                  {timer > 0 ? `Resend OTP in ${timer}s` : 'Resend OTP'}
                </Text>
              </TouchableOpacity>

              {/* Change Number */}
              <TouchableOpacity
                onPress={() => {
                  setConfirmation(null);
                  setOtp(['', '', '', '', '', '']);
                  setTimer(0);
                  setError('');
                }}
                style={styles.changeNumberButton}
              >
                <Text style={styles.changeNumberText}>Change Phone Number</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Other Sign In Options */}
          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            onPress={() => navigation.navigate('Login')}
            style={styles.otherSignInButton}
          >
            <Text style={styles.otherSignInText}>
              Sign in with Email or Google
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Custom TextInput for OTP (since we need ref access)
const TextInput = React.forwardRef<RNTextInput, any>((props, ref) => (
  <RNTextInput {...props} ref={ref} />
));

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
  inputSection: {
    marginBottom: spacing.lg,
  },
  button: {
    marginTop: spacing.lg,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  otpInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    textAlign: 'center',
    color: colors.textPrimary,
    backgroundColor: '#ffffff',
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
  resendButton: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  resendText: {
    fontSize: typography.fontSize.base,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  resendTextDisabled: {
    color: colors.textSecondary,
  },
  changeNumberButton: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  changeNumberText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
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
