import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { colors, spacing, typography, borderRadius, shadows } from '../lib/theme';

const { width, height } = Dimensions.get('window');

interface MapPickerProps {
  visible: boolean;
  onClose: () => void;
  initialLocation: {
    latitude: number;
    longitude: number;
  };
  onLocationSelect: (location: { latitude: number; longitude: number }) => void;
}

export function MapPicker({ visible, onClose, initialLocation, onLocationSelect }: MapPickerProps) {
  const mapRef = useRef<MapView>(null);
  const markerScale = useRef(new Animated.Value(1)).current;
  const [selectedLocation, setSelectedLocation] = useState(initialLocation);
  const [mapReady, setMapReady] = useState(false);

  // Reset map ready state when modal opens/closes to fix header position issue
  useEffect(() => {
    if (visible) {
      setMapReady(false);
      setSelectedLocation(initialLocation);
      // Delay map ready to ensure proper layout
      const timer = setTimeout(() => {
        setMapReady(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setMapReady(false);
    }
  }, [visible]);

  const animateMarker = () => {
    Animated.sequence([
      Animated.timing(markerScale, {
        toValue: 1.3,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(markerScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    animateMarker();

    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        },
        300
      );
    }
  };

  const handleMarkerDragEnd = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    animateMarker();
  };

  const handleConfirm = () => {
    onLocationSelect(selectedLocation);
    onClose();
  };

  const centerOnLocation = () => {
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: selectedLocation.latitude,
          longitude: selectedLocation.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        },
        500
      );
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <View style={styles.container}>
        {/* Header - Fixed positioning */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <TouchableOpacity style={styles.recenterButton} onPress={centerOnLocation}>
            <Ionicons name="locate" size={20} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {mapReady && (
            <MapView
              ref={mapRef}
              style={styles.map}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              onPress={handleMapPress}
              onMapReady={() => console.log('Map ready')}
            >
              <Marker
                coordinate={selectedLocation}
                draggable
                onDragEnd={handleMarkerDragEnd}
              >
                <Animated.View style={{ transform: [{ scale: markerScale }] }}>
                  <View style={styles.customMarker}>
                    <Ionicons name="location" size={40} color={colors.primary[600]} />
                  </View>
                </Animated.View>
              </Marker>
            </MapView>
          )}
          
          {!mapReady && (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
        </View>

        {/* Instructions Card */}
        <View style={styles.instructionsCard}>
          <View style={styles.instructionRow}>
            <Ionicons name="hand-left" size={20} color={colors.primary[600]} />
            <Text style={styles.instructionText}>Tap anywhere on map to set location</Text>
          </View>
          <View style={styles.instructionRow}>
            <Ionicons name="move" size={20} color={colors.primary[600]} />
            <Text style={styles.instructionText}>Drag marker to adjust position</Text>
          </View>
        </View>

        {/* Coordinates Display */}
        <View style={styles.coordinatesCard}>
          <View style={styles.coordinateRow}>
            <Text style={styles.coordinateLabel}>Latitude:</Text>
            <Text style={styles.coordinateValue}>{selectedLocation.latitude.toFixed(6)}</Text>
          </View>
          <View style={styles.coordinateRow}>
            <Text style={styles.coordinateLabel}>Longitude:</Text>
            <Text style={styles.coordinateValue}>{selectedLocation.longitude.toFixed(6)}</Text>
          </View>
        </View>

        {/* Confirm Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
            <Ionicons name="checkmark-circle" size={24} color="white" />
            <Text style={styles.confirmButtonText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: spacing.lg,
    paddingTop: Platform.OS === 'ios' ? spacing['2xl'] + spacing.lg : spacing['2xl'],
    paddingBottom: spacing.md,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    ...shadows.sm,
    // Fixed z-index to prevent layout shift
    zIndex: 10,
    elevation: 5,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  recenterButton: {
    padding: spacing.xs,
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.gray[200],
  },
  map: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
  },
  loadingText: {
    fontSize: typography.fontSize.base,
    color: colors.gray[600],
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionsCard: {
    backgroundColor: 'white',
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  instructionText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    flex: 1,
  },
  coordinatesCard: {
    backgroundColor: 'white',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  coordinateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  coordinateLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    fontWeight: typography.fontWeight.medium,
  },
  coordinateValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.semibold,
    fontFamily: 'monospace',
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
    ...shadows.md,
  },
  confirmButtonText: {
    color: 'white',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
  },
});
