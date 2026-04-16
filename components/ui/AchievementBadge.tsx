import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AchievementBadgeProps {
  title: string;
  subtitle?: string;
  unlocked: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  title,
  subtitle,
  unlocked,
  icon,
}) => {
  return (
    <View style={[styles.badge, unlocked ? styles.badgeUnlocked : styles.badgeLocked]}>
      <View style={[styles.iconWrap, unlocked ? styles.iconUnlocked : styles.iconLocked]}>
        <Ionicons name={icon} size={16} color={unlocked ? '#166534' : '#6b7280'} />
      </View>
      <Text style={[styles.title, !unlocked && styles.textLocked]} numberOfLines={1}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, !unlocked && styles.textLocked]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    minWidth: 108,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 10,
  },
  badgeUnlocked: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
  },
  badgeLocked: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  iconUnlocked: {
    backgroundColor: '#dcfce7',
  },
  iconLocked: {
    backgroundColor: '#e5e7eb',
  },
  title: {
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
  },
  subtitle: {
    color: '#4b5563',
    fontSize: 11,
    marginTop: 2,
  },
  textLocked: {
    color: '#6b7280',
  },
});
