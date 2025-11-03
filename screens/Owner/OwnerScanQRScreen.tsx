import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { QRScanner } from '../../components/QRScanner';
import { Modal } from '../../components/ui';
import { colors, spacing, typography, borderRadius, shadows } from '../../lib/theme';
import { formatCurrency, formatTime } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';
import { Booking } from '../../types';

export default function OwnerScanQRScreen({ navigation }: any) {
  const { user } = useAuth();
  const [showScanner, setShowScanner] = useState(false);
  const [scannedBooking, setScannedBooking] = useState<Booking | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBookingVerified = async (booking: Booking) => {
    try {
      // Verify the booking belongs to one of owner's turfs
      const turfRef = doc(db, 'turfs', booking.turfId);
      const turfSnap = await getDoc(turfRef);

      if (!turfSnap.exists()) {
        Alert.alert('Error', 'Turf not found.');
        return;
      }

      const turf = turfSnap.data();

      if (turf.ownerId !== user?.uid) {
        Alert.alert(
          'Unauthorized',
          'This booking is not for your turf.',
          [{ text: 'OK' }]
        );
        return;
      }

      // All checks passed - show booking details
      setScannedBooking(booking);
      setShowScanner(false);
      setShowDetails(true);
    } catch (error) {
      console.error('Error verifying booking:', error);
      Alert.alert('Error', 'Failed to verify booking ownership.');
    }
  };

  const handleCheckIn = async () => {
    if (!scannedBooking) return;

    try {
      setProcessing(true);
      
      // Update booking status to completed
      const bookingRef = doc(db, 'bookings', scannedBooking.id);
      await updateDoc(bookingRef, {
        status: 'completed',
        checkedInAt: new Date(),
      });

      Alert.alert(
        'Check-In Successful! ✅',
        `${scannedBooking.userName} has been checked in successfully.`,
        [
          {
            text: 'OK',
            onPress: () => {
              setShowDetails(false);
              setScannedBooking(null);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error updating booking:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>QR Scanner</Text>
          <Text style={styles.headerSubtitle}>Verify customer check-ins</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.instructionCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="qr-code-outline" size={64} color={colors.primary[600]} />
          </View>
          <Text style={styles.instructionTitle}>Scan Booking QR Code</Text>
          <Text style={styles.instructionText}>
            Tap the button below to open the camera and scan a customer's booking QR code
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>Instant verification</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>Booking details display</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color={colors.success} />
              <Text style={styles.featureText}>One-tap check-in</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setShowScanner(true)}
        >
          <Ionicons name="scan" size={24} color="white" />
          <Text style={styles.scanButtonText}>Start Scanning</Text>
        </TouchableOpacity>
      </View>

      {/* QR Scanner - Full Screen */}
      {showScanner && (
        <View style={StyleSheet.absoluteFillObject}>
          <QRScanner
            onClose={() => setShowScanner(false)}
            onBookingVerified={handleBookingVerified}
          />
        </View>
      )}

      {/* Booking Details Modal */}
      {scannedBooking && (
        <Modal
          visible={showDetails}
          onClose={() => {
            setShowDetails(false);
            setScannedBooking(null);
          }}
          title="Booking Details"
        >
          <ScrollView style={styles.detailsContent}>
            <View style={styles.statusCard}>
              <Ionicons name="checkmark-circle" size={48} color={colors.success} />
              <Text style={styles.statusTitle}>Valid Booking</Text>
              <Text style={styles.statusSubtitle}>Ready for check-in</Text>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Ionicons name="person" size={20} color={colors.gray[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Customer Name</Text>
                  <Text style={styles.detailValue}>{scannedBooking.userName}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="mail" size={20} color={colors.gray[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{scannedBooking.userEmail}</Text>
                </View>
              </View>

              {scannedBooking.userPhone && (
                <View style={styles.detailRow}>
                  <Ionicons name="call" size={20} color={colors.gray[600]} />
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{scannedBooking.userPhone}</Text>
                  </View>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Ionicons name="business" size={20} color={colors.gray[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Turf</Text>
                  <Text style={styles.detailValue}>{scannedBooking.turfName}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="calendar" size={20} color={colors.gray[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>
                    {format(new Date(scannedBooking.date), 'EEEE, MMM dd, yyyy')}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="time" size={20} color={colors.gray[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(scannedBooking.startTime)} - {formatTime(scannedBooking.endTime)}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="cash" size={20} color={colors.gray[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Amount Paid</Text>
                  <Text style={styles.detailValue}>
                    {formatCurrency(scannedBooking.totalAmount)}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <Ionicons name="finger-print" size={20} color={colors.gray[600]} />
                <View style={styles.detailContent}>
                  <Text style={styles.detailLabel}>Booking ID</Text>
                  <Text style={[styles.detailValue, styles.bookingId]}>
                    {scannedBooking.id}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.checkInButton, processing && styles.buttonDisabled]}
              onPress={handleCheckIn}
              disabled={processing}
            >
              <Ionicons name="log-in" size={20} color="white" />
              <Text style={styles.checkInButtonText}>
                {processing ? 'Processing...' : 'Confirm Check-In'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Modal>
      )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    marginTop: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  instructionCard: {
    backgroundColor: 'white',
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    ...shadows.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  instructionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  instructionText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  featureList: {
    width: '100%',
    gap: spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
  },
  scanButton: {
    backgroundColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  scanButtonText: {
    color: 'white',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  detailsContent: {
    flex: 1,
  },
  statusCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.success + '10',
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  statusTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.success,
    marginTop: spacing.md,
  },
  statusSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    marginTop: spacing.xs,
  },
  detailsCard: {
    backgroundColor: 'white',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    fontWeight: typography.fontWeight.semibold,
  },
  detailValue: {
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
  bookingId: {
    fontSize: typography.fontSize.xs,
    fontFamily: 'monospace',
    color: colors.gray[600],
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.md,
  },
  checkInButton: {
    backgroundColor: colors.success,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  checkInButtonText: {
    color: 'white',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
