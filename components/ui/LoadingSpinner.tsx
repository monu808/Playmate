import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { colors, typography, spacing } from '../../lib/theme';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  fullScreen?: boolean;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'large',
  color = colors.primary[600],
  text,
  fullScreen = false,
}) => {
  const Container = fullScreen ? View : React.Fragment;
  const containerProps = fullScreen ? { style: styles.fullScreen } : {};

  return (
    <Container {...containerProps}>
      <View style={styles.container}>
        <ActivityIndicator size={size} color={color} />
        {text && <Text style={styles.text}>{text}</Text>}
      </View>
    </Container>
  );
};

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  text: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
});
