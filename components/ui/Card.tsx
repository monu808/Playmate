import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, borderRadius, shadows } from '../../lib/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'elevated' | 'outlined' | 'flat';
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = 'elevated',
}) => {
  const getCardStyle = () => {
    switch (variant) {
      case 'outlined':
        return {
          borderWidth: 1,
          borderColor: colors.gray[200],
        };
      case 'flat':
        return {
          backgroundColor: colors.backgroundSecondary,
        };
      default:
        return shadows.md;
    }
  };

  return (
    <View style={[styles.card, getCardStyle(), style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.xl,
    padding: 16,
  },
});
