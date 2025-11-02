import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../lib/theme';
import { getBookingById } from '../lib/firebase/firestore';
import { Booking } from '../types';

interface QRScannerProps {
  onClose: () => void;
  onBookingVerified: (booking: Booking) => void;
}

export function QRScanner({ onClose, onBookingVerified }: QRScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || loading) return;
    
    setScanned(true);
    setLoading(true);

    try {
      // Parse QR code data
      const qrData = JSON.parse(data);

      // Validate QR code is for turf booking
      if (qrData.type !== 'turf_booking') {
        Alert.alert('Invalid QR Code', 'This is not a valid booking QR code');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Fetch booking from Firestore
      const booking = await getBookingById(qrData.bookingId);

      if (!booking) {
        Alert.alert('Booking Not Found', 'This booking does not exist or has been cancelled');
        setScanned(false);
        setLoading(false);
        return;
      }

      // Check booking status
      if (booking.status === 'cancelled') {
        Alert.alert(
          'Booking Cancelled',
          'This booking has been cancelled',
          [{ text: 'OK', onPress: () => { setScanned(false); setLoading(false); } }]
        );
        return;
      }

      if (booking.status === 'completed') {
        Alert.alert(
          'Already Used',
          'This booking has already been checked in',
          [{ text: 'OK', onPress: () => { setScanned(false); setLoading(false); } }]
        );
        return;
      }

      // Success - show booking details
      onBookingVerified(booking);
      
    } catch (error) {
      console.error('QR scan error:', error);
      Alert.alert(
        'Scan Error',
        'Failed to read QR code. Please try again.',
        [{ text: 'OK', onPress: () => { setScanned(false); setLoading(false); } }]
      );
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary[600]} />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={64} color={colors.gray[400]} />
        <Text style={styles.permissionText}>No access to camera</Text>
        <Text style={styles.permissionSubtext}>
          Please enable camera permissions in your device settings
        </Text>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Scan Booking QR Code</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeIconButton}>
          <Ionicons name="close" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      <View style={styles.overlay}>
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      </View>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="white" />
          <Text style={styles.loadingText}>Verifying booking...</Text>
        </View>
      )}

      <View style={styles.instructions}>
        <Ionicons name="qr-code" size={32} color={colors.primary[600]} />
        <Text style={styles.instructionText}>
          Position the QR code within the frame to scan
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[900],
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 16,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 10,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: 'white',
  },
  closeIconButton: {
    padding: spacing.xs,
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 300,
    height: 300,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: colors.primary[500],
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: typography.fontSize.base,
    marginTop: spacing.md,
  },
  instructions: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.lg,
  },
  instructionText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
  },
  permissionText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[300],
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  permissionSubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[400],
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  closeButton: {
    backgroundColor: colors.primary[600],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginTop: spacing.xl,
  },
  closeButtonText: {
    color: 'white',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
