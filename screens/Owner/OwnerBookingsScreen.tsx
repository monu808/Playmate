import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '../../lib/theme';
import { getOwnerBookings } from '../../lib/firebase/owner';
import { useAuth } from '../../contexts/AuthContext';
import { Booking } from '../../types';
import { useFocusEffect } from '@react-navigation/native';

export default function OwnerBookingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');

  const loadBookings = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await getOwnerBookings(user.uid);
      setBookings(data);
      applyFilter(data, filter);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [user])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadBookings();
    setRefreshing(false);
  };

  const applyFilter = (data: Booking[], filterType: typeof filter) => {
    if (filterType === 'all') {
      setFilteredBookings(data);
    } else {
      setFilteredBookings(data.filter(b => b.status === filterType));
    }
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    applyFilter(bookings, newFilter);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return colors.success[500];
      case 'pending':
        return colors.warning[500];
      case 'completed':
        return colors.primary[600];
      case 'cancelled':
        return colors.error[500];
      default:
        return colors.gray[500];
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'pending':
        return 'time';
      case 'completed':
        return 'checkmark-done-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const renderFilterButton = (
    filterValue: typeof filter,
    label: string,
    count: number
  ) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filter === filterValue && styles.filterButtonActive,
      ]}
      onPress={() => handleFilterChange(filterValue)}
    >
      <Text
        style={[
          styles.filterText,
          filter === filterValue && styles.filterTextActive,
        ]}
      >
        {label} ({count})
      </Text>
    </TouchableOpacity>
  );

  const renderBookingCard = ({ item }: { item: Booking }) => (
    <TouchableOpacity
      style={styles.bookingCard}
      onPress={() => navigation.navigate('BookingDetail', { bookingId: item.id })}
    >
      <View style={styles.bookingHeader}>
        <Image
          source={{ uri: item.turfImage || 'https://via.placeholder.com/100' }}
          style={styles.turfImage}
        />
        <View style={styles.bookingInfo}>
          <Text style={styles.turfName} numberOfLines={1}>
            {item.turfName}
          </Text>
          <Text style={styles.userName}>
            👤 {item.userName}
          </Text>
          <Text style={styles.userContact}>
            📞 {item.userPhone || item.userEmail}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Ionicons
            name={getStatusIcon(item.status) as any}
            size={16}
            color={getStatusColor(item.status)}
          />
        </View>
      </View>

      <View style={styles.bookingDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="calendar" size={16} color={colors.gray[500]} />
          <Text style={styles.detailText}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="time" size={16} color={colors.gray[500]} />
          <Text style={styles.detailText}>
            {item.startTime} - {item.endTime}
          </Text>
        </View>
      </View>

      <View style={styles.bookingFooter}>
        <View>
          <Text style={styles.amountLabel}>Your Earnings</Text>
          <Text style={styles.amount}>
            ₹{item.paymentBreakdown?.ownerShare?.toFixed(2) || item.totalAmount}
          </Text>
        </View>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: getStatusColor(item.status) + '20' },
          ]}
        >
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="calendar-outline" size={64} color={colors.gray[400]} />
      <Text style={styles.emptyTitle}>No Bookings Yet</Text>
      <Text style={styles.emptyText}>
        {filter === 'all'
          ? 'Bookings for your turfs will appear here'
          : `No ${filter} bookings found`}
      </Text>
    </View>
  );

  const stats = {
    all: bookings.length,
    pending: bookings.filter(b => b.status === 'pending').length,
    confirmed: bookings.filter(b => b.status === 'confirmed').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    cancelled: bookings.filter(b => b.status === 'cancelled').length,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bookings</Text>
        <Text style={styles.headerSubtitle}>
          {filteredBookings.length} {filter === 'all' ? 'total' : filter}
        </Text>
      </View>

      <View style={styles.filtersContainer}>
        {renderFilterButton('all', 'All', stats.all)}
        {renderFilterButton('pending', 'Pending', stats.pending)}
        {renderFilterButton('confirmed', 'Confirmed', stats.confirmed)}
        {renderFilterButton('completed', 'Completed', stats.completed)}
      </View>

      <FlatList
        data={filteredBookings}
        renderItem={renderBookingCard}
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
    marginTop: spacing.xs,
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    gap: spacing.sm,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  filterButtonActive: {
    backgroundColor: colors.primary[600],
  },
  filterText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.semibold,
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: spacing.lg,
  },
  bookingCard: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  bookingHeader: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  turfImage: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[200],
  },
  bookingInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  turfName: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  userContact: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  statusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingDetails: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
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
  bookingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  amount: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.success[600],
  },
  statusPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['4xl'],
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
  },
});
