import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography, borderRadius, spacing } from '../../lib/theme';

interface BadgeProps {
  text: string;
  variant?: 'solid' | 'outline';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  text,
  variant = 'solid',
  color = 'primary',
  size = 'medium',
  style,
  textStyle,
}) => {
  const getBackgroundColor = () => {
    if (variant === 'outline') return 'transparent';
    
    switch (color) {
      case 'primary':
        return colors.primary[100];
      case 'secondary':
        return colors.secondary[500] + '20';
      case 'success':
        return colors.success + '20';
      case 'warning':
        return colors.warning + '20';
      case 'error':
        return colors.error + '20';
      case 'info':
        return colors.info + '20';
      default:
        return colors.primary[100];
    }
  };

  const getTextColor = () => {
    switch (color) {
      case 'primary':
        return colors.primary[700];
      case 'secondary':
        return colors.secondary[600];
      case 'success':
        return colors.success;
      case 'warning':
        return colors.warning;
      case 'error':
        return colors.error;
      case 'info':
        return colors.info;
      default:
        return colors.primary[700];
    }
  };

  const getBorderColor = () => {
    return getTextColor();
  };

  const getPadding = () => {
    switch (size) {
      case 'small':
        return { paddingVertical: 2, paddingHorizontal: 8 };
      case 'large':
        return { paddingVertical: 6, paddingHorizontal: 16 };
      default:
        return { paddingVertical: 4, paddingHorizontal: 12 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small':
        return typography.fontSize.xs;
      case 'large':
        return typography.fontSize.base;
      default:
        return typography.fontSize.sm;
    }
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1 : 0,
          ...getPadding(),
        },
        style,
      ]}
    >
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
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
  },
});
