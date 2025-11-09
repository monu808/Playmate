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
import { getAllBookings, updateBookingStatus } from '../../lib/firebase/firestore';
import { LoadingSpinner } from '../../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { formatCurrency } from '../../lib/utils';

export default function AdminBookingsScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');

  useEffect(() => {
    loadBookings();
  }, []);

  useEffect(() => {
    filterBookingsByStatus();
  }, [filterStatus, bookings]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const allBookings = await getAllBookings();
      // Sort by date (most recent first)
      const sorted = allBookings.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setBookings(sorted);
    } catch (error) {
      console.error('Error loading bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const filterBookingsByStatus = () => {
    if (filterStatus === 'all') {
      setFilteredBookings(bookings);
    } else {
      setFilteredBookings(bookings.filter((b) => b.status === filterStatus));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const handleUpdateStatus = (bookingId: string, newStatus: string) => {
    Alert.alert(
      'Update Status',
      `Change booking status to "${newStatus}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            try {
              await updateBookingStatus(bookingId, newStatus as any);
              Alert.alert('Success', 'Booking status updated');
              loadBookings();
            } catch (error) {
              Alert.alert('Error', 'Failed to update booking status');
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return colors.primary[600];
      case 'pending':
        return '#f59e0b';
      case 'cancelled':
        return colors.error;
      case 'completed':
        return '#10b981';
      default:
        return colors.gray[600];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'cancelled':
        return 'close-circle';
      case 'completed':
        return 'checkmark-done-circle';
      default:
        return 'help-circle';
    }
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
        <Text style={styles.headerTitle}>All Bookings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContainer}
      >
        {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterButton,
              filterStatus === status && styles.filterButtonActive,
            ]}
            onPress={() => setFilterStatus(status as any)}
          >
            <Text
              style={[
                styles.filterButtonText,
                filterStatus === status && styles.filterButtonTextActive,
              ]}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Bookings List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.listContainer}>
          {filteredBookings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color={colors.gray[400]} />
              <Text style={styles.emptyText}>No bookings found</Text>
            </View>
          ) : (
            filteredBookings.map((booking) => (
              <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.bookingHeaderLeft}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(booking.status) + '20' },
                      ]}
                    >
                      <Ionicons
                        name={getStatusIcon(booking.status) as any}
                        size={16}
                        color={getStatusColor(booking.status)}
                      />
                      <Text
                        style={[styles.statusText, { color: getStatusColor(booking.status) }]}
                      >
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bookingAmount}>
                    {formatCurrency(booking.totalAmount)}
                  </Text>
                </View>

                <View style={styles.bookingContent}>
                  <Image
                    source={{ uri: booking.turfImage || 'https://via.placeholder.com/80' }}
                    style={styles.turfImage}
                    contentFit="cover"
                  />
                  <View style={styles.bookingDetails}>
                    <Text style={styles.turfName} numberOfLines={1}>
                      {booking.turfName}
                    </Text>
                    <View style={styles.detailRow}>
                      <Ionicons name="person-outline" size={14} color={colors.gray[600]} />
                      <Text style={styles.detailText}>{booking.userName}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={14} color={colors.gray[600]} />
                      <Text style={styles.detailText}>{booking.date}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={14} color={colors.gray[600]} />
                      <Text style={styles.detailText}>
                        {booking.startTime} - {booking.endTime}
                      </Text>
                    </View>
                  </View>
                </View>

                {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                  <View style={styles.actionButtons}>
                    {booking.status === 'pending' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: colors.primary[600] }]}
                        onPress={() => handleUpdateStatus(booking.id, 'confirmed')}
                      >
                        <Text style={styles.actionButtonText}>Confirm</Text>
                      </TouchableOpacity>
                    )}
                    {booking.status === 'confirmed' && (
                      <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: '#10b981' }]}
                        onPress={() => handleUpdateStatus(booking.id, 'completed')}
                      >
                        <Text style={styles.actionButtonText}>Complete</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.error }]}
                      onPress={() => handleUpdateStatus(booking.id, 'cancelled')}
                    >
                      <Text style={styles.actionButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
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
  filtersScroll: {
    height: 55,
    maxHeight: 55,
    flexGrow: 0,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    flexGrow: 0,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[200],
    marginRight: spacing.sm,
    minWidth: 80,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: colors.primary[600],
  },
  filterButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[700],
  },
  filterButtonTextActive: {
    color: '#ffffff',
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
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bookingHeaderLeft: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
  },
  bookingAmount: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  bookingContent: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  turfImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.lg,
  },
  bookingDetails: {
    flex: 1,
    gap: spacing.xs,
  },
  turfName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
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
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
  },
});
