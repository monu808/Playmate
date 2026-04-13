import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { getUserBookings, cancelBookingWithRefund, getJoinedTeamBookingsForUser } from '../lib/firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, Modal } from '../components/ui';
import { BookingQRCode } from '../components/BookingQRCode';
import {
  calculateCancellationBreakdown,
  formatCurrency,
  formatTime,
  getStatusColor,
} from '../lib/utils';
import { Booking, JoinedTeamBooking } from '../types';
import { theme } from '../lib/theme';

type FilterType = 'all' | 'upcoming' | 'past' | 'cancelled';

type BookingListItem =
  | { kind: 'joined'; data: JoinedTeamBooking }
  | { kind: 'booking'; data: Booking };

const BookingsScreen: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [joinedTeamBookings, setJoinedTeamBookings] = useState<JoinedTeamBooking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);
  const [expandedBreakdowns, setExpandedBreakdowns] = useState<Set<string>>(new Set());
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);

  const filteredJoinedTeamBookings = useMemo(() => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    switch (activeFilter) {
      case 'upcoming':
        return joinedTeamBookings.filter(
          (item) =>
            item.teamStatus !== 'cancelled' &&
            (item.date > today || (item.date === today && item.endTime > format(now, 'HH:mm')))
        );
      case 'past':
        return joinedTeamBookings.filter(
          (item) =>
            item.teamStatus === 'completed' ||
            item.date < today ||
            (item.date === today && item.endTime < format(now, 'HH:mm'))
        );
      case 'cancelled':
        return joinedTeamBookings.filter((item) => item.teamStatus === 'cancelled');
      default:
        return joinedTeamBookings;
    }
  }, [joinedTeamBookings, activeFilter]);

  const listItems = useMemo<BookingListItem[]>(
    () => [
      ...filteredJoinedTeamBookings.map((item) => ({ kind: 'joined' as const, data: item })),
      ...filteredBookings.map((item) => ({ kind: 'booking' as const, data: item })),
    ],
    [filteredJoinedTeamBookings, filteredBookings]
  );

  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  useEffect(() => {
    filterBookings();
  }, [bookings, activeFilter]);

  const loadBookings = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const [data, joinedData] = await Promise.all([
        getUserBookings(user.uid),
        getJoinedTeamBookingsForUser(user.uid),
      ]);
      setBookings(data);
      setJoinedTeamBookings(joinedData);
    } catch (error) {
      console.error('Error loading bookings:', error);
      Alert.alert('Error', 'Failed to load bookings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadBookings();
  };

  const filterBookings = () => {
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');

    let filtered = bookings;

    switch (activeFilter) {
      case 'upcoming':
        filtered = bookings.filter(
          (b) =>
            b.status === 'confirmed' &&
            (b.date > today || (b.date === today && b.endTime > format(now, 'HH:mm')))
        );
        break;
      case 'past':
        filtered = bookings.filter(
          (b) =>
            b.status === 'completed' ||
            (b.date < today || (b.date === today && b.endTime < format(now, 'HH:mm')))
        );
        break;
      case 'cancelled':
        filtered = bookings.filter((b) => b.status === 'cancelled');
        break;
      default:
        filtered = bookings;
    }

    setFilteredBookings(filtered);
  };

  const handleCancelBooking = (booking: Booking) => {
    const cancellationPreview = calculateCancellationBreakdown(
      booking.totalAmount,
      booking.date,
      booking.startTime
    );

    if (!cancellationPreview.canCancel) {
      Alert.alert('Cannot cancel', 'This booking has already started and cannot be cancelled.');
      return;
    }

    const refundMessage = cancellationPreview.isFullRefund
      ? `You will receive a full refund of ${formatCurrency(cancellationPreview.refundAmount)}.`
      : `Refund amount: ${formatCurrency(cancellationPreview.refundAmount)}\nCancellation charge: ${formatCurrency(cancellationPreview.cancellationCharge)}\n${formatCurrency(cancellationPreview.ownerCompensation)} goes to owner and ${formatCurrency(cancellationPreview.platformRetention)} is retained by platform.`;

    Alert.alert(
      'Cancel Booking',
      `${refundMessage}\n\nDo you want to continue?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancellingBookingId(booking.id);
              const result = await cancelBookingWithRefund(booking.id);
              if (result.success) {
                const status = result.refundDetails?.status;
                const refundedAmount = result.refundDetails?.refundAmount ?? cancellationPreview.refundAmount;
                const statusText = status === 'processed'
                  ? 'Refund processed successfully.'
                  : status === 'pending'
                  ? 'Refund is initiated and currently pending.'
                  : status === 'failed'
                  ? 'Booking cancelled, but refund initiation failed. Please contact support.'
                  : 'Booking cancelled successfully.';

                Alert.alert(
                  'Booking Cancelled',
                  `${statusText}\nRefund amount: ${formatCurrency(refundedAmount)}`
                );
                loadBookings();
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel booking');
              }
            } catch (error) {
              console.error('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking');
            } finally {
              setCancellingBookingId(null);
            }
          },
        },
      ]
    );
  };

  const toggleBreakdown = (bookingId: string) => {
    setExpandedBreakdowns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bookingId)) {
        newSet.delete(bookingId);
      } else {
        newSet.add(bookingId);
      }
      return newSet;
    });
  };

  const renderBookingCard = ({ item }: { item: Booking }) => {
    const statusColor = getStatusColor(item.status);
    const cancellationPreview = calculateCancellationBreakdown(
      item.totalAmount,
      item.date,
      item.startTime
    );
    const canCancel = item.status === 'confirmed' && cancellationPreview.canCancel;

    return (
      <View style={styles.bookingCard}>
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: item.turfImage }}
            style={styles.turfImage}
            contentFit="cover"
          />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.turfName}>{item.turfName}</Text>
            <Text style={styles.location}>
              {item.turfLocation?.city || 'Location'}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {item.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={18} color="#6b7280" />
            <Text style={styles.detailText}>
              {format(new Date(item.date), 'EEE, MMM dd, yyyy')}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={18} color="#6b7280" />
            <Text style={styles.detailText}>
              {formatTime(item.startTime)} - {formatTime(item.endTime)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="cash" size={18} color="#6b7280" />
            <Text style={styles.detailText}>
              {formatCurrency(item.totalAmount)}
            </Text>
          </View>
        </View>

        {/* Payment Breakdown - Collapsible */}
        {item.paymentBreakdown && (
          <View style={styles.breakdownSection}>
            <TouchableOpacity 
              style={styles.breakdownHeader}
              onPress={() => toggleBreakdown(item.id)}
            >
              <Text style={styles.breakdownTitle}>Payment Details</Text>
              <Ionicons 
                name={expandedBreakdowns.has(item.id) ? "chevron-up" : "chevron-down"} 
                size={20} 
                color="#111827" 
              />
            </TouchableOpacity>
            
            {expandedBreakdowns.has(item.id) && (
              <>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Base Amount</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(item.paymentBreakdown.baseTurfAmount)}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Platform Fee</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(item.paymentBreakdown.platformCommission)}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Gateway Fee</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(item.paymentBreakdown.razorpayFee)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* QR Code Button - Show for confirmed bookings */}
          {item.status === 'confirmed' && (
            <TouchableOpacity
              style={styles.qrButton}
              onPress={() => {
                setSelectedBooking(item);
                setShowQRCode(true);
              }}
            >
              <Ionicons name="qr-code" size={20} color="white" />
              <Text style={styles.qrButtonText}>Show QR Code</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Button */}
          {canCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelBooking(item)}
              disabled={cancellingBookingId === item.id}
            >
              {cancellingBookingId === item.id ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={18} color="#ef4444" />
                  <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {item.status === 'cancelled' && (
          <View style={styles.cancelledNote}>
            <Text style={styles.cancelledText}>This booking was cancelled</Text>
            {item.refundDetails && (
              <Text style={styles.cancelledSubtext}>
                Refund: {formatCurrency(item.refundDetails.refundAmount || 0)} ({item.refundDetails.status})
              </Text>
            )}
          </View>
        )}
      </View>
    );
  };

  const getTeamStatusColor = (status: string) => {
    switch (status) {
      case 'full':
        return '#f59e0b';
      case 'cancelled':
        return '#ef4444';
      case 'completed':
        return '#6b7280';
      default:
        return '#10b981';
    }
  };

  const renderJoinedBookingCard = ({ item }: { item: JoinedTeamBooking }) => {
    const statusColor = getTeamStatusColor(item.teamStatus);

    return (
      <View style={[styles.bookingCard, styles.joinedBookingCard]}>
        <View style={styles.cardHeader}>
          <Image
            source={{ uri: item.turfImage }}
            style={styles.turfImage}
            contentFit="cover"
          />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.turfName}>{item.turfName}</Text>
            <Text style={styles.location}>{item.turfLocation?.city || 'Location'}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>JOINED</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar" size={18} color="#6b7280" />
            <Text style={styles.detailText}>{format(new Date(item.date), 'EEE, MMM dd, yyyy')}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time" size={18} color="#6b7280" />
            <Text style={styles.detailText}>
              {formatTime(item.startTime)} - {formatTime(item.endTime)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="person" size={18} color="#6b7280" />
            <Text style={styles.detailText}>Host: {item.hostName}</Text>
          </View>
        </View>

        <View style={styles.readOnlyNote}>
          <Ionicons name="information-circle-outline" size={16} color="#166534" />
          <Text style={styles.readOnlyText}>
            Joined via Player Finder. This is a read-only booking detail card.
          </Text>
        </View>
      </View>
    );
  };

  const renderListItem = ({ item }: { item: BookingListItem }) => {
    if (item.kind === 'joined') {
      return renderJoinedBookingCard({ item: item.data });
    }
    return renderBookingCard({ item: item.data });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Green Header */}
      <View style={styles.greenHeader}>
        <View>
          <Text style={styles.headerTitle}>My Bookings</Text>
          <Text style={styles.headerSubtitle}>
            {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'} • {joinedTeamBookings.length}{' '}
            {joinedTeamBookings.length === 1 ? 'joined team' : 'joined teams'}
          </Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        {(['all', 'upcoming', 'past', 'cancelled'] as FilterType[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              activeFilter === filter && styles.filterChipActive,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === filter && styles.filterTextActive,
              ]}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bookings List */}
      <FlatList
        data={listItems}
        renderItem={renderListItem}
        keyExtractor={(item) => (item.kind === 'joined' ? `joined-${item.data.postId}` : `booking-${item.data.id}`)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyText}>No bookings found</Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === 'all'
                ? 'Start booking turfs to see them here'
                : `No ${activeFilter} booking entries`}
            </Text>
          </View>
        }
      />

      {/* QR Code Modal */}
      {selectedBooking && (
        <Modal
          visible={showQRCode}
          onClose={() => {
            setShowQRCode(false);
            setSelectedBooking(null);
          }}
          title=""
          showCloseButton={false}
        >
          <BookingQRCode
            bookingId={selectedBooking.id}
            turfName={selectedBooking.turfName}
            date={format(new Date(selectedBooking.date), 'MMM dd, yyyy')}
            time={`${formatTime(selectedBooking.startTime)} - ${formatTime(selectedBooking.endTime)}`}
            userName={selectedBooking.userName}
            onClose={() => {
              setShowQRCode(false);
              setSelectedBooking(null);
            }}
          />
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  greenHeader: {
    backgroundColor: '#16a34a',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    height: 150,
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: 'transparent',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipActive: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  listContent: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    padding: 12,
  },
  turfImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  cardHeaderInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  turfName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  location: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  cardDetails: {
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
  },
  breakdownSection: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 12,
  },
  qrButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    backgroundColor: '#16a34a',
    borderRadius: 8,
  },
  qrButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  cancelButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  cancelledNote: {
    padding: 12,
    backgroundColor: '#fee2e2',
    borderTopWidth: 1,
    borderTopColor: '#fecaca',
  },
  cancelledText: {
    fontSize: 13,
    color: '#991b1b',
    textAlign: 'center',
  },
  cancelledSubtext: {
    fontSize: 12,
    color: '#7f1d1d',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  joinedBookingCard: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  readOnlyNote: {
    borderTopWidth: 1,
    borderTopColor: '#dcfce7',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readOnlyText: {
    flex: 1,
    color: '#166534',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default BookingsScreen;
