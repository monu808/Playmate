import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { getUserBookings, cancelBooking } from '../lib/firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSpinner, Modal } from '../components/ui';
import { BookingQRCode } from '../components/BookingQRCode';
import { formatCurrency, formatTime, getStatusColor } from '../lib/utils';
import { Booking } from '../types';
import { theme } from '../lib/theme';

type FilterType = 'all' | 'upcoming' | 'past' | 'cancelled';

const BookingsScreen: React.FC = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [showQRCode, setShowQRCode] = useState(false);

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
      const data = await getUserBookings(user.uid);
      setBookings(data);
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
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await cancelBooking(booking.id);
              if (result.success) {
                Alert.alert('Success', 'Booking cancelled successfully');
                loadBookings();
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel booking');
              }
            } catch (error) {
              console.error('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking');
            }
          },
        },
      ]
    );
  };

  const renderBookingCard = ({ item }: { item: Booking }) => {
    const statusColor = getStatusColor(item.status);
    const canCancel =
      item.status === 'confirmed' &&
      new Date(item.date) >= new Date();

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

        {/* Payment Breakdown */}
        {item.paymentBreakdown && (
          <View style={styles.breakdownSection}>
            <Text style={styles.breakdownTitle}>Payment Details</Text>
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
            >
              <Ionicons name="close-circle" size={18} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancel Booking</Text>
            </TouchableOpacity>
          )}
        </View>

        {item.status === 'cancelled' && (
          <View style={styles.cancelledNote}>
            <Text style={styles.cancelledText}>This booking was cancelled</Text>
          </View>
        )}
      </View>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
        <Text style={styles.headerSubtitle}>
          {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
        </Text>
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
        data={filteredBookings}
        renderItem={renderBookingCard}
        keyExtractor={(item) => item.id}
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
                : `No ${activeFilter} bookings`}
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
    backgroundColor: '#ffffff',
  },
  header: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#ffffff',
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
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
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
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
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
});

export default BookingsScreen;
