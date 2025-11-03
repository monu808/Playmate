import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSpinner } from '../../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { formatCurrency } from '../../lib/utils';
import { Turf } from '../../types';
import { getOwnerTurfs, toggleTurfActive } from '../../lib/firebase/owner';
import { useFocusEffect } from '@react-navigation/native';

export default function MyTurfsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMyTurfs = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const ownerTurfs = await getOwnerTurfs(user.uid);
      setTurfs(ownerTurfs);
    } catch (error) {
      console.error('Error loading turfs:', error);
      Alert.alert('Error', 'Failed to load your turfs');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMyTurfs();
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMyTurfs();
    setRefreshing(false);
  };

  const handleToggleActive = async (turf: Turf) => {
    if (!user) return;
    
    try {
      const result = await toggleTurfActive(turf.id, user.uid);
      if (result.success) {
        await loadMyTurfs();
        Alert.alert('Success', `Turf ${turf.isActive ? 'deactivated' : 'activated'} successfully`);
      } else {
        Alert.alert('Error', result.error || 'Failed to update turf');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    }
  };

  const getStatusColor = (turf: Turf) => {
    if (!turf.isVerified) return colors.warning[500];
    if (!turf.isActive) return colors.gray[500];
    return colors.success[500];
  };

  const getStatusText = (turf: Turf) => {
    if (!turf.isVerified) return 'Pending Verification';
    if (!turf.isActive) return 'Inactive';
    return 'Active';
  };

  const getStatusIcon = (turf: Turf) => {
    if (!turf.isVerified) return 'time';
    if (!turf.isActive) return 'pause-circle';
    return 'checkmark-circle';
  };

  const renderTurfCard = ({ item }: { item: Turf }) => (
    <TouchableOpacity
      style={styles.turfCard}
      onPress={() => navigation.navigate('TurfDetail', { id: item.id })}
    >
      <Image
        source={{ uri: item.images[0] || 'https://via.placeholder.com/400' }}
        style={styles.turfImage}
        contentFit="cover"
      />

      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item) }]}>
        <Ionicons name={getStatusIcon(item) as any} size={14} color="#fff" />
        <Text style={styles.statusText}>{getStatusText(item)}</Text>
      </View>

      <View style={styles.turfContent}>
        <View style={styles.turfHeader}>
          <Text style={styles.turfName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.turfPrice}>{formatCurrency(item.pricePerHour)}/hr</Text>
        </View>

        <View style={styles.turfMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="location" size={14} color={colors.gray[500]} />
            <Text style={styles.metaText} numberOfLines={1}>
              {item.location.address}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="star" size={14} color={colors.warning[500]} />
            <Text style={styles.metaText}>
              {item.rating?.toFixed(1) || '0.0'} ({item.totalReviews || 0})
            </Text>
          </View>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Ionicons name="calendar" size={18} color={colors.primary[600]} />
            <Text style={styles.statValue}>{item.totalBookings || 0}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Ionicons name="eye" size={18} color={colors.primary[600]} />
            <Text style={styles.statValue}>-</Text>
            <Text style={styles.statLabel}>Views</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Ionicons name="cash" size={18} color={colors.success[600]} />
            <Text style={styles.statValue}>-</Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>
        </View>

        <View style={styles.actions}>
          {/* TODO: Implement TurfBookings screen */}
          {/* <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('TurfBookings', { turfId: item.id })}
          >
            <Ionicons name="calendar-outline" size={18} color={colors.primary[600]} />
            <Text style={styles.actionText}>Bookings</Text>
          </TouchableOpacity> */}

          {item.isVerified && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleToggleActive(item)}
            >
              <Ionicons
                name={item.isActive ? 'pause-circle-outline' : 'play-circle-outline'}
                size={18}
                color={colors.primary[600]}
              />
              <Text style={styles.actionText}>
                {item.isActive ? 'Deactivate' : 'Activate'}
              </Text>
            </TouchableOpacity>
          )}

          {/* TODO: Implement EditTurf screen */}
          {/* <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('EditTurf', { turfId: item.id })}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary[600]} />
            <Text style={styles.actionText}>Edit</Text>
          </TouchableOpacity> */}
        </View>

        {!item.isVerified && item.rejectionReason && (
          <View style={styles.rejectionBanner}>
            <Ionicons name="warning" size={16} color={colors.error[600]} />
            <Text style={styles.rejectionText}>{item.rejectionReason}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="business-outline" size={64} color={colors.gray[400]} />
      <Text style={styles.emptyTitle}>No Turfs Yet</Text>
      <Text style={styles.emptyText}>
        Add your first turf to start accepting bookings
      </Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('AddTurf')}
      >
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add Your First Turf</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Turfs</Text>
          <Text style={styles.headerSubtitle}>
            {turfs.length} {turfs.length === 1 ? 'turf' : 'turfs'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addIconButton}
          onPress={() => navigation.navigate('AddTurf')}
        >
          <Ionicons name="add-circle" size={32} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={turfs}
        renderItem={renderTurfCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addIconButton: {
    padding: spacing.sm,
  },
  listContent: {
    padding: spacing.lg,
  },
  turfCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  turfImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.gray[200],
  },
  statusBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
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
    flex: 1,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginRight: spacing.md,
  },
  turfPrice: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  turfMeta: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  metaText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  stats: {
    flexDirection: 'row',
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray[200],
    marginBottom: spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    width: 1,
    backgroundColor: colors.gray[200],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  actionText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  rejectionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error[50],
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  rejectionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.error[600],
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  addButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
});
