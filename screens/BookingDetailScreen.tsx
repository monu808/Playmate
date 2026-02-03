import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { db } from '../config/firebase';
import { LoadingSpinner, Modal } from '../components/ui';
import { BookingQRCode } from '../components/BookingQRCode';
import { cancelBooking } from '../lib/firebase/firestore';
import { formatCurrency, getStatusColor } from '../lib/utils';
import { Booking } from '../types';
import { colors, spacing, borderRadius, shadows } from '../lib/theme';

type RootStackParamList = {
  BookingDetail: { bookingId: string };
};

type BookingDetailRouteProp = RouteProp<RootStackParamList, 'BookingDetail'>;
type BookingDetailNavigationProp = StackNavigationProp<RootStackParamList, 'BookingDetail'>;

export default function BookingDetailScreen() {
  const navigation = useNavigation<BookingDetailNavigationProp>();
  const route = useRoute<BookingDetailRouteProp>();
  const { bookingId } = route.params;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadBooking();
  }, [bookingId]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      const bookingDoc = await db.collection('bookings').doc(bookingId).get();
      
      if (bookingDoc.exists()) {
        const data = bookingDoc.data();
        setBooking({
          id: bookingDoc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() || new Date(),
        } as Booking);
      } else {
        Alert.alert('Error', 'Booking not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading booking:', error);
      Alert.alert('Error', 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = () => {
    if (!booking) return;

    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking? This action cannot be undone.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);
              const result = await cancelBooking(booking.id);
              
              if (result.success) {
                Alert.alert('Success', 'Booking cancelled successfully');
                navigation.goBack();
              } else {
                Alert.alert('Error', result.error || 'Failed to cancel booking');
              }
            } catch (error) {
              console.error('Error cancelling booking:', error);
              Alert.alert('Error', 'Failed to cancel booking');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleCallOwner = () => {
    if (booking?.userPhone) {
      Linking.openURL(`tel:${booking.userPhone}`);
    } else {
      Alert.alert('No Phone', 'No phone number available for this user');
    }
  };

  const handleEmailOwner = () => {
    if (booking?.userEmail) {
      Linking.openURL(`mailto:${booking.userEmail}`);
    }
  };

  const handleShareBooking = async () => {
    if (!booking) return;

    try {
      await Share.share({
        message: `Booking Details:\n\nTurf: ${booking.turfName}\nDate: ${formatDate(booking.date)}\nTime: ${booking.startTime} - ${booking.endTime}\nAmount: ${formatCurrency(booking.totalAmount)}\nStatus: ${booking.status.toUpperCase()}\nBooking ID: ${booking.id}`,
      });
    } catch (error) {
      console.error('Error sharing booking:', error);
    }
  };

  const handleGetDirections = () => {
    if (booking?.turfLocation) {
      const { lat, lng } = booking.turfLocation;
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      Linking.openURL(url);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'EEEE, MMMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      case 'completed':
        return 'checkmark-done-circle';
      case 'pending':
        return 'time';
      default:
        return 'ellipse';
    }
  };

  const canCancel = () => {
    if (!booking) return false;
    if (booking.status !== 'confirmed') return false;

    const now = new Date();
    const bookingDate = new Date(booking.date);
    const today = format(now, 'yyyy-MM-dd');
    const bookingDateStr = booking.date;

    // Can cancel if booking is in the future
    if (bookingDateStr > today) return true;
    
    // If booking is today, check if time hasn't started
    if (bookingDateStr === today) {
      const currentTime = format(now, 'HH:mm');
      return currentTime < booking.startTime;
    }

    return false;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.greenHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking Details</Text>
            <View style={styles.shareButton} />
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <LoadingSpinner />
        </View>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <View style={styles.greenHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking Details</Text>
            <View style={styles.shareButton} />
          </View>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color={colors.gray[400]} />
          <Text style={styles.errorText}>Booking not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Curved Green Header - Now scrolls with content */}
        <View style={styles.greenHeader}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Booking Details</Text>
            <TouchableOpacity onPress={handleShareBooking} style={styles.shareButton}>
              <Ionicons name="share-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Turf Image and Name */}
        <View style={styles.turfSection}>
          <Image
            source={{ uri: booking.turfImage || 'https://via.placeholder.com/400' }}
            style={styles.turfImage}
            contentFit="cover"
          />
          <View style={styles.turfInfo}>
            <Text style={styles.turfName}>{booking.turfName}</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={handleGetDirections}
            >
              <Ionicons name="location" size={16} color={colors.primary[600]} />
              <Text style={styles.locationText} numberOfLines={1}>
                {booking.turfLocation?.address || 'View on map'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Booking Details */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Booking Information</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(booking.status) }]}>
              <Ionicons
                name={getStatusIcon(booking.status) as any}
                size={14}
                color="#fff"
              />
              <Text style={styles.statusBadgeText}>{booking.status.toUpperCase()}</Text>
            </View>
          </View>
          
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="calendar" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Date</Text>
                <Text style={styles.detailValue}>{formatDate(booking.date)}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="time" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Time</Text>
                <Text style={styles.detailValue}>
                  {booking.startTime} - {booking.endTime}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="receipt" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Booking ID</Text>
                <Text style={styles.detailValue}>{booking.id}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* User Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="person" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Name</Text>
                <Text style={styles.detailValue}>{booking.userName}</Text>
              </View>
            </View>

            {booking.userEmail && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={handleEmailOwner}
                >
                  <View style={styles.detailIcon}>
                    <Ionicons name="mail" size={20} color={colors.primary[600]} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Email</Text>
                    <Text style={[styles.detailValue, styles.linkText]}>
                      {booking.userEmail}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
                </TouchableOpacity>
              </>
            )}

            {booking.userPhone && (
              <>
                <View style={styles.divider} />
                <TouchableOpacity
                  style={styles.detailRow}
                  onPress={handleCallOwner}
                >
                  <View style={styles.detailIcon}>
                    <Ionicons name="call" size={20} color={colors.primary[600]} />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={[styles.detailValue, styles.linkText]}>
                      {booking.userPhone}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Payment Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          
          <View style={styles.detailCard}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Base Amount</Text>
              <Text style={styles.paymentValue}>
                {formatCurrency(booking.paymentBreakdown?.baseTurfAmount || booking.totalAmount)}
              </Text>
            </View>

            {booking.paymentBreakdown && (
              <>
                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Platform Fee</Text>
                  <Text style={styles.paymentValue}>
                    {formatCurrency(booking.paymentBreakdown.platformCommission)}
                  </Text>
                </View>

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Gateway Fee</Text>
                  <Text style={styles.paymentValue}>
                    {formatCurrency(booking.paymentBreakdown.razorpayFee)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabelTotal}>Total Amount</Text>
                  <Text style={styles.paymentValueTotal}>
                    {formatCurrency(booking.totalAmount)}
                  </Text>
                </View>

                <View style={styles.divider} />

                <View style={styles.paymentRow}>
                  <Text style={styles.paymentLabel}>Owner Share</Text>
                  <Text style={[styles.paymentValue, styles.ownerShare]}>
                    {formatCurrency(booking.paymentBreakdown.ownerShare)}
                  </Text>
                </View>
              </>
            )}

            <View style={styles.divider} />

            <View style={styles.detailRow}>
              <View style={styles.detailIcon}>
                <Ionicons name="card" size={20} color={colors.primary[600]} />
              </View>
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>Payment ID</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {booking.paymentId}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          {booking.status === 'confirmed' && (
            <TouchableOpacity
              style={styles.qrButton}
              onPress={() => setShowQRCode(true)}
            >
              <Ionicons name="qr-code" size={24} color="#fff" />
              <Text style={styles.qrButtonText}>Show QR Code</Text>
            </TouchableOpacity>
          )}

          {canCancel() && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelBooking}
              disabled={cancelling}
            >
              {cancelling ? (
                <LoadingSpinner size="small" color="#ef4444" />
              ) : (
                <>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                  <Text style={styles.cancelButtonText}>Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      {/* QR Code Modal */}
      <Modal visible={showQRCode} onClose={() => setShowQRCode(false)}>
        <BookingQRCode
          bookingId={booking.id}
          turfName={booking.turfName}
          date={booking.date}
          time={`${booking.startTime} - ${booking.endTime}`}
          userName={booking.userName}
          onClose={() => setShowQRCode(false)}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  greenHeader: {
    backgroundColor: colors.primary[600],
    paddingTop: 48,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    padding: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorText: {
    fontSize: 16,
    color: colors.gray[600],
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
  },
  turfSection: {
    backgroundColor: '#fff',
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  turfImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.gray[200],
  },
  turfInfo: {
    padding: spacing.lg,
  },
  turfName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationText: {
    fontSize: 16,
    color: colors.primary[600],
    flex: 1,
  },
  section: {
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[900],
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  detailCard: {
    backgroundColor: '#fff',
    paddingVertical: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  detailIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.gray[600],
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    color: colors.gray[900],
    fontWeight: '500',
  },
  linkText: {
    color: colors.primary[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginLeft: spacing.lg + 36 + spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  paymentLabel: {
    fontSize: 16,
    color: colors.gray[600],
  },
  paymentValue: {
    fontSize: 16,
    color: colors.gray[900],
    fontWeight: '500',
  },
  paymentLabelTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[900],
  },
  paymentValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray[900],
  },
  ownerShare: {
    color: colors.primary[600],
    fontWeight: '700',
  },
  actionSection: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  qrButton: {
    backgroundColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  qrButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  bottomSpace: {
    height: spacing.xl,
  },
});
