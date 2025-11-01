import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors, typography, borderRadius, shadows } from '../../lib/theme';

interface ButtonProps {
  text: string;
  onPress: () => void;
  variant?: 'solid' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  text,
  onPress,
  variant = 'solid',
  size = 'medium',
  color = 'primary',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (disabled) return colors.gray[300];
    if (variant === 'ghost') return 'transparent';
    if (variant === 'outline') return 'transparent';
    
    switch (color) {
      case 'primary':
        return colors.primary[600];
      case 'secondary':
        return colors.secondary[600];
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      default:
        return colors.primary[600];
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.gray[500];
    if (variant === 'solid') return '#ffffff';
    
    switch (color) {
      case 'primary':
        return colors.primary[600];
      case 'secondary':
        return colors.secondary[600];
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      default:
        return colors.primary[600];
    }
  };

  const getBorderColor = () => {
    if (disabled) return colors.gray[300];
    if (variant === 'ghost') return 'transparent';
    
    switch (color) {
      case 'primary':
        return colors.primary[600];
      case 'secondary':
        return colors.secondary[600];
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      default:
        return colors.primary[600];
    }
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 8, paddingHorizontal: 16 };
      case 'large':
        return { paddingVertical: 16, paddingHorizontal: 24 };
      default:
        return { paddingVertical: 12, paddingHorizontal: 20 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return typography.fontSize.sm;
      case 'large':
        return typography.fontSize.lg;
      default:
        return typography.fontSize.base;
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 2 : 0,
          ...getPadding(),
          width: fullWidth ? '100%' : 'auto',
        },
        variant === 'solid' && !disabled && shadows.md,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'solid' ? '#ffffff' : getTextColor()} />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
              },
              textStyle,
            ]}
          >
            {text}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
  },
  icon: {
    marginRight: 8,
  },
});
