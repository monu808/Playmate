import React, { useState } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps as RNTextInputProps,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../lib/theme';
import { Ionicons } from '@expo/vector-icons';

interface InputProps extends RNTextInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: string;
  required?: boolean;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  disabled?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  leftIcon,
  rightIcon,
  error,
  required = false,
  containerStyle,
  inputStyle,
  disabled = false,
  ...props
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View
        style={[
          styles.inputContainer,
          isFocused && styles.inputContainerFocused,
          error && styles.inputContainerError,
          disabled && styles.inputContainerDisabled,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        
        <RNTextInput
          style={[styles.input, leftIcon ? styles.inputWithLeftIcon : undefined, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={colors.gray[400]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isPasswordVisible}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          editable={!disabled}
          {...props}
        />
        
        {secureTextEntry && (
          <TouchableOpacity
            onPress={togglePasswordVisibility}
            style={styles.rightIcon}
          >
            <Ionicons
              name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.gray[500]}
            />
          </TouchableOpacity>
        )}
        
        {!secureTextEntry && rightIcon && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>
      
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  required: {
    color: colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputContainerFocused: {
    borderColor: colors.primary[600],
    borderWidth: 2,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  inputContainerDisabled: {
    backgroundColor: colors.gray[100],
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    padding: 0,
  },
  inputWithLeftIcon: {
    marginLeft: spacing.sm,
  },
  leftIcon: {
    marginRight: spacing.xs,
  },
  rightIcon: {
    marginLeft: spacing.xs,
    padding: spacing.xs,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
