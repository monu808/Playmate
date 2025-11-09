import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackScreenProps } from '@react-navigation/stack';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { RootStackParamList } from '../types';
import { theme } from '../lib/theme';
import { formatCurrency } from '../lib/utils';
import { getTurfById } from '../lib/firebase/firestore';
import { LoadingSpinner } from '../components/ui';
import BookingModal from '../components/BookingModal';

const { width } = Dimensions.get('window');

type Props = StackScreenProps<RootStackParamList, 'TurfDetail'>;

const TurfDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id } = route.params;
  const [turf, setTurf] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  // PERFORMANCE: Memoize loadTurf function
  const loadTurf = useCallback(async () => {
    try {
      setLoading(true);
      const turfData = await getTurfById(id);
      if (turfData) {
        setTurf(turfData);
      } else {
        Alert.alert('Error', 'Turf not found');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading turf:', error);
      Alert.alert('Error', 'Failed to load turf details');
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  // PERFORMANCE: Memoize handlers
  const handleBookNow = useCallback(() => {
    setBookingModalVisible(true);
  }, []);

  const handleBookingSuccess = useCallback(() => {
    setBookingModalVisible(false);
    Alert.alert(
      'Success!',
      'Your booking has been confirmed. Check the Bookings tab for details.',
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Main'),
        },
      ]
    );
  }, [navigation]);

  // Load turf data on mount
  useEffect(() => {
    loadTurf();
  }, [loadTurf]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!turf) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Turf not found</Text>
      </SafeAreaView>
    );
  }

  const price = turf.pricePerHour || turf.price || 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.favoriteButton}>
            <Ionicons name="heart-outline" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Image Carousel */}
        <View style={styles.imageCarousel}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => {
              const index = Math.round(
                event.nativeEvent.contentOffset.x / width
              );
              setCurrentImageIndex(index);
            }}
          >
            {turf.images?.length > 0 ? (
              turf.images.map((image: string, index: number) => (
                <Image
                  key={index}
                  source={{ uri: image }}
                  style={styles.carouselImage}
                  contentFit="cover"
                />
              ))
            ) : (
              <View style={styles.placeholderImage}>
                <Ionicons name="image-outline" size={64} color="#9ca3af" />
                <Text style={styles.placeholderText}>No image available</Text>
              </View>
            )}
          </ScrollView>
          
          {/* Image Indicator */}
          <View style={styles.imageIndicator}>
            {turf.images?.map((_: any, index: number) => (
              <View
                key={index}
                style={[
                  styles.indicatorDot,
                  index === currentImageIndex && styles.indicatorDotActive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Turf Info */}
        <View style={styles.content}>
          {/* Title and Rating */}
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <View style={styles.sportBadge}>
                <Text style={styles.sportBadgeText}>
                  {turf.sport?.toUpperCase() || 'TURF'}
                </Text>
              </View>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#f59e0b" />
                <Text style={styles.ratingText}>
                  {turf.rating?.toFixed(1) || '4.5'}
                </Text>
                <Text style={styles.reviewsText}>
                  ({turf.reviews || 0} reviews)
                </Text>
              </View>
            </View>
            <Text style={styles.turfName}>{turf.name}</Text>
          </View>

          {/* Location */}
          <View style={styles.locationSection}>
            <Ionicons name="location" size={20} color="#16a34a" />
            <Text style={styles.locationText}>
              {turf.location?.address || 'Location not available'}
            </Text>
          </View>
          {turf.location?.city && (
            <Text style={styles.cityText}>{turf.location.city}</Text>
          )}

          {/* Price */}
          <View style={styles.priceSection}>
            <Text style={styles.priceLabel}>Price per hour</Text>
            <Text style={styles.priceValue}>{formatCurrency(price)}</Text>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>
              {turf.description || 'No description available'}
            </Text>
          </View>

          {/* Amenities */}
          {turf.amenities && turf.amenities.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Amenities</Text>
              <View style={styles.amenitiesGrid}>
                {turf.amenities.map((amenity: string, index: number) => (
                  <View key={index} style={styles.amenityItem}>
                    <Ionicons
                      name={getAmenityIcon(amenity)}
                      size={20}
                      color="#16a34a"
                    />
                    <Text style={styles.amenityText}>{amenity}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Location Map */}
          {turf.location?.lat && turf.location?.lng && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Location</Text>
              <View style={styles.mapContainer}>
                <MapView
                  provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                  style={styles.map}
                  initialRegion={{
                    latitude: turf.location.lat,
                    longitude: turf.location.lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }}
                  scrollEnabled={true}
                  zoomEnabled={true}
                >
                  <Marker
                    coordinate={{
                      latitude: turf.location.lat,
                      longitude: turf.location.lng,
                    }}
                    title={turf.name}
                    description={turf.location.address}
                  >
                    <View style={styles.markerContainer}>
                      <Ionicons name="location" size={40} color="#16a34a" />
                    </View>
                  </Marker>
                </MapView>
                <View style={styles.mapAddressOverlay}>
                  <Text style={styles.mapAddressText}>
                    {turf.location.address || 'Address not available'}
                  </Text>
                  {turf.location.city && (
                    <Text style={styles.mapCityText}>
                      {turf.location.city}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Bottom spacing */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Fixed Bottom Bar with Book Now Button */}
      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceContainer}>
          <Text style={styles.bottomPriceLabel}>Starting from</Text>
          <Text style={styles.bottomPriceValue}>{formatCurrency(price)}/hr</Text>
        </View>
        <TouchableOpacity style={styles.bookButton} onPress={handleBookNow}>
          <Text style={styles.bookButtonText}>Book Now</Text>
        </TouchableOpacity>
      </View>

      {/* Booking Modal */}
      <BookingModal
        visible={bookingModalVisible}
        turf={turf}
        onClose={() => setBookingModalVisible(false)}
        onBookingSuccess={handleBookingSuccess}
      />
    </SafeAreaView>
  );
};

// Helper function to get amenity icons
const getAmenityIcon = (amenity: string): any => {
  const amenityLower = amenity.toLowerCase();
  if (amenityLower.includes('light')) return 'bulb';
  if (amenityLower.includes('parking')) return 'car';
  if (amenityLower.includes('changing') || amenityLower.includes('locker'))
    return 'shirt';
  if (amenityLower.includes('washroom') || amenityLower.includes('shower'))
    return 'water';
  if (amenityLower.includes('first aid')) return 'medical';
  if (amenityLower.includes('drinking')) return 'cafe';
  if (amenityLower.includes('seating')) return 'people';
  if (amenityLower.includes('scoreboard')) return 'stats-chart';
  if (amenityLower.includes('equipment')) return 'basketball';
  if (amenityLower.includes('refreshment')) return 'fast-food';
  if (amenityLower.includes('wifi')) return 'wifi';
  if (amenityLower.includes('cctv') || amenityLower.includes('security'))
    return 'shield-checkmark';
  return 'checkmark-circle';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageCarousel: {
    height: 300,
    backgroundColor: '#f3f4f6',
  },
  carouselImage: {
    width,
    height: 300,
  },
  placeholderImage: {
    width,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  placeholderText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 12,
  },
  imageIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  indicatorDotActive: {
    backgroundColor: '#ffffff',
    width: 24,
  },
  content: {
    padding: 16,
  },
  titleSection: {
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sportBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sportBadgeText: {
    color: '#16a34a',
    fontSize: 12,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  reviewsText: {
    fontSize: 14,
    color: '#6b7280',
  },
  turfName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  cityText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 28,
    marginBottom: 16,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  priceLabel: {
    fontSize: 14,
    color: '#15803d',
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#16a34a',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4b5563',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  amenityText: {
    fontSize: 14,
    color: '#374151',
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  mapContainer: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapAddressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  mapAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'left',
  },
  mapCityText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    textAlign: 'left',
  },
  mapCoordinatesText: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  mapText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  bottomPriceContainer: {
    flex: 1,
  },
  bottomPriceLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  bottomPriceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  bookButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 24,
  },
});

export default TurfDetailScreen;
