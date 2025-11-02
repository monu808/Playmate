import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { getTurfs, deleteTurf } from '../../lib/firebase/firestore';
import { LoadingSpinner } from '../../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { formatCurrency } from '../../lib/utils';

export default function ManageTurfsScreen({ navigation }: any) {
  const [turfs, setTurfs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadTurfs();
  }, []);

  const loadTurfs = async () => {
    try {
      setLoading(true);
      const allTurfs = await getTurfs();
      setTurfs(allTurfs);
    } catch (error) {
      console.error('Error loading turfs:', error);
      Alert.alert('Error', 'Failed to load turfs');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTurfs();
    setRefreshing(false);
  };

  const handleDeleteTurf = (turfId: string, turfName: string) => {
    Alert.alert(
      'Delete Turf',
      `Are you sure you want to delete "${turfName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTurf(turfId);
              Alert.alert('Success', 'Turf deleted successfully');
              loadTurfs();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete turf');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Turfs</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate('AddTurf')}
        >
          <Ionicons name="add" size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{turfs.length}</Text>
            <Text style={styles.statLabel}>Total Turfs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {turfs.filter((t) => t.isActive !== false).length}
            </Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {turfs.filter((t) => t.isActive === false).length}
            </Text>
            <Text style={styles.statLabel}>Inactive</Text>
          </View>
        </View>

        {/* Turfs List */}
        <View style={styles.listContainer}>
          {turfs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="football-outline" size={64} color={colors.gray[400]} />
              <Text style={styles.emptyText}>No turfs found</Text>
              <TouchableOpacity
                style={styles.addTurfButton}
                onPress={() => navigation.navigate('AddTurf')}
              >
                <Text style={styles.addTurfButtonText}>Add Your First Turf</Text>
              </TouchableOpacity>
            </View>
          ) : (
            turfs.map((turf) => (
              <View key={turf.id} style={styles.turfCard}>
                <Image
                  source={{ uri: turf.images?.[0] || 'https://via.placeholder.com/150' }}
                  style={styles.turfImage}
                  contentFit="cover"
                />
                <View style={styles.turfContent}>
                  <View style={styles.turfHeader}>
                    <Text style={styles.turfName} numberOfLines={1}>
                      {turf.name}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        turf.isActive === false && styles.inactiveBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          turf.isActive === false && styles.inactiveText,
                        ]}
                      >
                        {turf.isActive === false ? 'Inactive' : 'Active'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.turfDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="location-outline" size={16} color={colors.gray[600]} />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {turf.location?.city || 'Unknown location'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cash-outline" size={16} color={colors.gray[600]} />
                      <Text style={styles.detailText}>
                        {formatCurrency(turf.pricePerHour || turf.price || 0)}/hr
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="star" size={16} color="#f59e0b" />
                      <Text style={styles.detailText}>
                        {turf.rating?.toFixed(1) || '4.5'} ({turf.reviews || 0} reviews)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => navigation.navigate('TurfDetail', { id: turf.id })}
                    >
                      <Ionicons name="eye-outline" size={20} color={colors.primary[600]} />
                      <Text style={styles.actionButtonText}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => navigation.navigate('EditTurf', { turfId: turf.id })}
                    >
                      <Ionicons name="create-outline" size={20} color="#3b82f6" />
                      <Text style={[styles.actionButtonText, { color: '#3b82f6' }]}>
                        Edit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeleteTurf(turf.id, turf.name)}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.error} />
                      <Text style={[styles.actionButtonText, { color: colors.error }]}>
                        Delete
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: colors.primary[600],
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  listContainer: {
    padding: spacing.lg,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  addTurfButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.xl,
  },
  addTurfButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
  turfCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...shadows.md,
  },
  turfImage: {
    width: '100%',
    height: 180,
  },
  turfContent: {
    padding: spacing.lg,
  },
  turfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  turfName: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.md,
  },
  statusBadge: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  inactiveBadge: {
    backgroundColor: colors.gray[200],
  },
  statusText: {
    color: colors.primary[600],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  inactiveText: {
    color: colors.gray[600],
  },
  turfDetails: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  actionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
});
