import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAuth } from '../contexts/AuthContext';
import { getUserBookings, getUserTransactions } from '../lib/firebase/firestore';
import { formatCurrency } from '../lib/utils';
import { Booking, Transaction } from '../types';
import { colors, spacing, borderRadius, typography } from '../lib/theme';

type RootStackParamList = {
  PaymentHistory: undefined;
};

type PaymentHistoryNavigationProp = StackNavigationProp<RootStackParamList, 'PaymentHistory'>;
type HistoryFilter = 'all' | 'payment' | 'refund';

interface PaymentHistoryItem {
  id: string;
  bookingId: string;
  type: 'payment' | 'refund';
  turfName: string;
  bookingDate: string;
  timeRange: string;
  amount: number;
  status: 'pending' | 'success' | 'processed' | 'failed';
  createdAt: Date;
  paymentId: string;
  refundId?: string;
  cancellationCharge?: number;
  ownerCompensation?: number;
  platformRetention?: number;
}

const toDate = (value: any): Date => {
  if (value?.toDate) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
};

const getStatusColor = (status: PaymentHistoryItem['status']) => {
  switch (status) {
    case 'success':
    case 'processed':
      return '#16a34a';
    case 'pending':
      return '#f59e0b';
    case 'failed':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

const normalizeStatus = (
  type: 'payment' | 'refund',
  transaction: any
): PaymentHistoryItem['status'] => {
  const rawStatus = String(transaction?.refundStatus || transaction?.status || '').toLowerCase();

  if (!rawStatus) {
    return type === 'payment' ? 'success' : 'pending';
  }

  if (rawStatus === 'success') {
    return 'success';
  }

  if (rawStatus === 'processed') {
    return 'processed';
  }

  if (rawStatus === 'failed') {
    return 'failed';
  }

  return 'pending';
};

const toHistoryItem = (transaction: Transaction, bookingsMap: Map<string, Booking>): PaymentHistoryItem => {
  const tx: any = transaction;
  const linkedBooking = bookingsMap.get(transaction.bookingId);
  const type: 'payment' | 'refund' = tx.type === 'refund' || tx.refundAmount ? 'refund' : 'payment';
  const status = normalizeStatus(type, tx);

  const createdAt = toDate(tx.createdAt || tx.timestamp);
  const turfName = tx.turfName || linkedBooking?.turfName || 'Turf Booking';
  const bookingDate = linkedBooking?.date || '-';
  const timeRange = linkedBooking
    ? `${linkedBooking.startTime} - ${linkedBooking.endTime}`
    : '-';

  const amount = type === 'refund'
    ? Number(tx.refundAmount || tx.amount || 0)
    : Number(tx.amount || linkedBooking?.totalAmount || 0);

  return {
    id: transaction.id,
    bookingId: transaction.bookingId,
    type,
    turfName,
    bookingDate,
    timeRange,
    amount,
    status,
    createdAt,
    paymentId: tx.paymentId || linkedBooking?.paymentId || '-',
    refundId: tx.refundId,
    cancellationCharge: tx.cancellationCharge,
    ownerCompensation: tx.ownerCompensation,
    platformRetention: tx.platformRetention,
  };
};

const toFallbackPaymentItem = (booking: Booking): PaymentHistoryItem => ({
  id: `payment_fallback_${booking.id}`,
  bookingId: booking.id,
  type: 'payment',
  turfName: booking.turfName,
  bookingDate: booking.date,
  timeRange: `${booking.startTime} - ${booking.endTime}`,
  amount: booking.totalAmount,
  status: 'success',
  createdAt: toDate((booking as any).createdAt),
  paymentId: booking.paymentId,
});

export default function PaymentHistoryScreen() {
  const navigation = useNavigation<PaymentHistoryNavigationProp>();
  const { user } = useAuth();

  const [history, setHistory] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<HistoryFilter>('all');

  const loadHistory = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [transactions, bookings] = await Promise.all([
        getUserTransactions(user.uid),
        getUserBookings(user.uid),
      ]);

      const bookingsMap = new Map(bookings.map(booking => [booking.id, booking]));

      const transactionItems = transactions.map(transaction => toHistoryItem(transaction, bookingsMap));

      const existingPaymentBookingIds = new Set(
        transactionItems
          .filter(item => item.type === 'payment')
          .map(item => item.bookingId)
      );

      const fallbackPaymentItems = bookings
        .filter(booking => !existingPaymentBookingIds.has(booking.id))
        .map(booking => toFallbackPaymentItem(booking));

      const mergedItems = [...transactionItems, ...fallbackPaymentItems].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );

      setHistory(mergedItems);
    } catch (error) {
      console.error('Error loading payment history:', error);
      Alert.alert('Error', 'Failed to load payment history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [user]);

  const filteredHistory = useMemo(() => {
    if (activeFilter === 'all') {
      return history;
    }

    return history.filter(item => item.type === activeFilter);
  }, [history, activeFilter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  const handleShareReceipt = async (item: PaymentHistoryItem) => {
    const amountLabel = `${item.type === 'refund' ? '+' : '-'}${formatCurrency(item.amount)}`;
    const message = [
      `Playmate ${item.type === 'refund' ? 'Refund' : 'Payment'} Receipt`,
      `Booking: ${item.bookingId}`,
      `Turf: ${item.turfName}`,
      `Date: ${item.bookingDate}`,
      `Time: ${item.timeRange}`,
      `Amount: ${amountLabel}`,
      `Status: ${item.status.toUpperCase()}`,
      `Payment ID: ${item.paymentId}`,
      item.refundId ? `Refund ID: ${item.refundId}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await Share.share({ message });
    } catch (error) {
      console.error('Error sharing receipt:', error);
      Alert.alert('Error', 'Could not share receipt');
    }
  };

  const renderItem = ({ item }: { item: PaymentHistoryItem }) => {
    const statusColor = getStatusColor(item.status);
    const amountLabel = `${item.type === 'refund' ? '+' : '-'}${formatCurrency(item.amount)}`;
    const amountColor = item.type === 'refund' ? '#16a34a' : '#111827';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.iconWrap, item.type === 'refund' ? styles.refundIcon : styles.paymentIcon]}>
              <Ionicons
                name={item.type === 'refund' ? 'arrow-undo' : 'card'}
                size={18}
                color={item.type === 'refund' ? '#0f766e' : '#1d4ed8'}
              />
            </View>
            <View>
              <Text style={styles.cardTitle}>{item.type === 'refund' ? 'Refund' : 'Payment'}</Text>
              <Text style={styles.cardSubtitle}>{item.turfName}</Text>
            </View>
          </View>
          <Text style={[styles.amount, { color: amountColor }]}>{amountLabel}</Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={14} color="#6b7280" />
          <Text style={styles.metaText}>{item.bookingDate}</Text>
          <Ionicons name="time-outline" size={14} color="#6b7280" />
          <Text style={styles.metaText}>{item.timeRange}</Text>
        </View>

        <View style={styles.metaRow}>
          <Ionicons name="finger-print-outline" size={14} color="#6b7280" />
          <Text style={styles.metaText} numberOfLines={1}>Payment ID: {item.paymentId}</Text>
        </View>

        {item.refundId && (
          <View style={styles.metaRow}>
            <Ionicons name="repeat-outline" size={14} color="#6b7280" />
            <Text style={styles.metaText} numberOfLines={1}>Refund ID: {item.refundId}</Text>
          </View>
        )}

        {item.type === 'refund' && (
          <View style={styles.breakdownWrap}>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Cancellation charge</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(item.cancellationCharge || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Owner compensation</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(item.ownerCompensation || 0)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Platform retention</Text>
              <Text style={styles.breakdownValue}>{formatCurrency(item.platformRetention || 0)}</Text>
            </View>
          </View>
        )}

        <View style={styles.footerRow}>
          <Text style={styles.timestampText}>{format(item.createdAt, 'dd MMM yyyy, hh:mm a')}</Text>
          <View style={[styles.statusChip, { backgroundColor: `${statusColor}20` }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.receiptButton} onPress={() => handleShareReceipt(item)}>
          <Ionicons name="share-social-outline" size={16} color="#16a34a" />
          <Text style={styles.receiptButtonText}>Share Receipt</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading payment history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Payment Flow</Text>
          <Text style={styles.headerSubtitle}>{history.length} entries</Text>
        </View>
      </View>

      <View style={styles.filters}>
        {(['all', 'payment', 'refund'] as HistoryFilter[]).map(filter => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
              {filter === 'all' ? 'All' : filter === 'payment' ? 'Payments' : 'Refunds'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredHistory}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="receipt-outline" size={56} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No payment history found</Text>
            <Text style={styles.emptySubtitle}>Your payments and refunds will appear here.</Text>
          </View>
        }
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
    backgroundColor: '#16a34a',
    paddingTop: 50,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: '#ffffff',
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#16a34a',
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    color: '#374151',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIcon: {
    backgroundColor: '#dbeafe',
  },
  refundIcon: {
    backgroundColor: '#ccfbf1',
  },
  cardTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: '#111827',
  },
  cardSubtitle: {
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
  },
  amount: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  metaText: {
    fontSize: typography.fontSize.sm,
    color: '#4b5563',
    flexShrink: 1,
  },
  breakdownWrap: {
    backgroundColor: '#f9fafb',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
  },
  breakdownValue: {
    fontSize: typography.fontSize.sm,
    color: '#111827',
    fontWeight: '600',
  },
  footerRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestampText: {
    fontSize: typography.fontSize.xs,
    color: '#6b7280',
  },
  statusChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
  receiptButton: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#f0fdf4',
  },
  receiptButtonText: {
    fontSize: typography.fontSize.sm,
    color: '#15803d',
    fontWeight: '600',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: '#4b5563',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing['4xl'],
  },
  emptyTitle: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    marginTop: spacing.xs,
    fontSize: typography.fontSize.sm,
    color: '#6b7280',
    textAlign: 'center',
  },
});
