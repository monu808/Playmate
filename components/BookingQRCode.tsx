import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../lib/theme';

interface BookingQRCodeProps {
  bookingId: string;
  turfName: string;
  date: string;
  time: string;
  userName: string;
  onClose: () => void;
}

export function BookingQRCode({
  bookingId,
  turfName,
  date,
  time,
  userName,
  onClose,
}: BookingQRCodeProps) {
  // Create QR code data with all booking information
  const qrData = JSON.stringify({
    bookingId,
    turfName,
    date,
    time,
    userName,
    type: 'turf_booking',
    timestamp: new Date().toISOString(),
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `My Booking QR Code\n\nTurf: ${turfName}\nDate: ${date}\nTime: ${time}\n\nBooking ID: ${bookingId}`,
        title: 'Share Booking QR Code',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Booking QR Code</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.qrContainer}>
          <QRCode
            value={qrData}
            size={250}
            color={colors.gray[900]}
            backgroundColor="white"
            logo={require('../assets/icon.png')} // Optional: Add your app logo in center
            logoSize={50}
            logoBackgroundColor="white"
            logoBorderRadius={10}
          />
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="business" size={20} color={colors.primary[600]} />
            <Text style={styles.infoLabel}>Turf:</Text>
            <Text style={styles.infoValue}>{turfName}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={20} color={colors.primary[600]} />
            <Text style={styles.infoLabel}>Date:</Text>
            <Text style={styles.infoValue}>{date}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="time" size={20} color={colors.primary[600]} />
            <Text style={styles.infoLabel}>Time:</Text>
            <Text style={styles.infoValue}>{time}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="finger-print" size={20} color={colors.gray[500]} />
            <Text style={styles.infoLabel}>Booking ID:</Text>
            <Text style={[styles.infoValue, styles.bookingId]}>{bookingId.slice(0, 12)}...</Text>
          </View>
        </View>

        <View style={styles.instructionsCard}>
          <View style={styles.instructionHeader}>
            <Ionicons name="information-circle" size={24} color={colors.primary[600]} />
            <Text style={styles.instructionTitle}>How to Use</Text>
          </View>
          <Text style={styles.instructionText}>
            • Show this QR code to the turf admin on arrival
          </Text>
          <Text style={styles.instructionText}>
            • Admin will scan to verify your booking
          </Text>
          <Text style={styles.instructionText}>
            • Keep this code safe until check-in
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={20} color="white" />
            <Text style={styles.shareButtonText}>Share QR Code</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  qrContainer: {
    backgroundColor: 'white',
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.lg,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[600],
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    flex: 1,
  },
  bookingId: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: typography.fontSize.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: spacing.sm,
  },
  instructionsCard: {
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary[200],
    marginBottom: spacing.lg,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  instructionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[700],
    marginLeft: spacing.sm,
  },
  instructionText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    marginBottom: spacing.xs,
    paddingLeft: spacing.md,
  },
  actions: {
    gap: spacing.md,
  },
  shareButton: {
    backgroundColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  shareButtonText: {
    color: 'white',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
