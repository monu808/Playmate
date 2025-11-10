import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { getTurfs } from '../lib/firebase/firestore';
import { LoadingSpinner, Modal } from '../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import { formatCurrency } from '../lib/utils';
import { Turf, TurfSport } from '../types';

//==============================================================================
// UTILITY FUNCTIONS
//==============================================================================

// Calculate distance between two coordinates (Haversine formula)
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Format distance for display
const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)}m`;
  }
  return `${km.toFixed(1)}km`;
};

//==============================================================================
// CONSTANTS AND CONFIGURATIONS
//==============================================================================

// Promotional banners
const PROMOTIONAL_BANNERS = [
  require('../assets/banners/banner1.jpg'),
  require('../assets/banners/banner2.jpg'),
  require('../assets/banners/banner3.jpg'),
];

// Available sport filters
const SPORT_FILTERS: { label: string; value: TurfSport | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Football', value: 'football' },
  { label: 'Cricket', value: 'cricket' },
  { label: 'Basketball', value: 'basketball' },
  { label: 'Badminton', value: 'badminton' },
];

// City locations in Madhya Pradesh
const CITY_LOCATIONS = {
  Sehore: {
    latitude: 23.2041,
    longitude: 77.0842,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
};

// Sport icons and colors
const SPORT_MARKERS = {
  football: { icon: 'football' as const, color: '#22c55e' },
  cricket: { icon: 'baseball' as const, color: '#3b82f6' },
  basketball: { icon: 'basketball' as const, color: '#f97316' },
  badminton: { icon: 'tennisball' as const, color: '#a855f7' },
  tennis: { icon: 'tennisball' as const, color: '#ec4899' },
  volleyball: { icon: 'american-football' as const, color: '#eab308' },
};

//==============================================================================
// MAIN COMPONENT
//==============================================================================

export default function HomeScreen({ navigation }: any) {
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [filteredTurfs, setFilteredTurfs] = useState<Turf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<TurfSport | 'all'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedLocation] = useState<keyof typeof CITY_LOCATIONS>('Sehore');
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedMarkerTurf, setSelectedMarkerTurf] = useState<Turf | null>(null);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const bannerScrollViewRef = useRef<ScrollView>(null);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  //==========================================================================
  // STATE MANAGEMENT
  //==========================================================================
  
  // Auto-scroll banners every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBannerIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % PROMOTIONAL_BANNERS.length;
        
        // Scroll to the next banner - use full window width for pagingEnabled
        const screenWidth = Dimensions.get('window').width;
        bannerScrollViewRef.current?.scrollTo({
          x: nextIndex * screenWidth,
          animated: true,
        });
        
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  //==========================================================================
  // HELPER FUNCTIONS - MEMOIZED
  //==========================================================================

  // Get user's current location - MEMOIZED
  const getUserLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      // Silently fail - location is optional
    }
  }, []); // Empty dependency array

  const loadTurfs = useCallback(async () => {
    try {
      const fetchedTurfs = await getTurfs();
      
      // If no turfs from database, show sample data for testing
      if (!fetchedTurfs || fetchedTurfs.length === 0) {
        const sampleTurfs: Turf[] = [
          {
            id: '1',
            name: 'Premium Football Arena',
            description: 'Professional grade football turf with excellent facilities',
            sport: 'football',
            price: 1500,
            pricePerHour: 1500,
            images: ['https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800'],
            location: {
              lat: 23.2041,
              lng: 77.0842,
              address: 'Near City Center',
              city: 'Sehore',
            },
            amenities: ['Parking', 'Changing Room', 'Floodlights', 'Drinking Water'],
            availableSlots: [],
            rating: 4.8,
            reviews: 45,
            totalBookings: 120,
            totalReviews: 45,
            createdAt: new Date(),
            isActive: true,
            ownerId: 'sample-owner-1',
            ownerName: 'Sample Owner',
            ownerEmail: 'owner@example.com',
            ownerPhone: '+91-9876543210',
            isVerified: true,
          },
          {
            id: '2',
            name: 'City Cricket Ground',
            description: 'Well-maintained cricket pitch with all amenities',
            sport: 'cricket',
            price: 2000,
            pricePerHour: 2000,
            images: ['https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800'],
            location: {
              lat: 23.1990,
              lng: 77.0799,
              address: 'Stadium Road',
              city: 'Sehore',
            },
            amenities: ['Parking', 'Changing Room', 'Restrooms', 'Seating'],
            availableSlots: [],
            rating: 4.5,
            reviews: 32,
            totalBookings: 85,
            totalReviews: 32,
            createdAt: new Date(),
            isActive: true,
            ownerId: 'sample-owner-2',
            ownerName: 'Sample Owner 2',
            ownerEmail: 'owner2@example.com',
            ownerPhone: '+91-9876543211',
            isVerified: true,
          },
          {
            id: '3',
            name: 'Sports Hub Basketball Court',
            description: 'Indoor basketball court with professional flooring',
            sport: 'basketball',
            price: 1200,
            pricePerHour: 1200,
            images: ['https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800'],
            location: {
              lat: 23.2100,
              lng: 77.0890,
              address: 'College Road',
              city: 'Sehore',
            },
            amenities: ['Indoor', 'Air Conditioning', 'Changing Room', 'Drinking Water'],
            availableSlots: [],
            rating: 4.9,
            reviews: 67,
            totalBookings: 200,
            totalReviews: 67,
            createdAt: new Date(),
            isActive: true,
            ownerId: 'sample-owner-3',
            ownerName: 'Sample Owner 3',
            ownerEmail: 'owner3@example.com',
            ownerPhone: '+91-9876543212',
            isVerified: true,
          },
        ];
        setTurfs(sampleTurfs);
      } else {
        setTurfs(fetchedTurfs);
      }
    } catch (error) {
      // Show sample data on error too
      setTurfs([]);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTurfs();
    setRefreshing(false);
  }, [loadTurfs]);

  // PERFORMANCE: Memoize filtering logic
  const filterTurfs = useCallback(() => {
    let filtered = [...turfs];

    // Filter by sport
    if (selectedSport !== 'all') {
      filtered = filtered.filter((turf) => turf.sport && turf.sport === selectedSport);
    }

    // Filter by search query (name or location)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (turf) =>
          turf.name?.toLowerCase().includes(query) ||
          turf.location?.address?.toLowerCase().includes(query) ||
          (turf.location?.city && turf.location.city.toLowerCase().includes(query))
      );
    }

    setFilteredTurfs(filtered);
  }, [turfs, selectedSport, searchQuery]); // Dependencies

  // Load data on mount ONLY
  useEffect(() => {
    const initializeData = async () => {
      await loadTurfs();
      await getUserLocation();
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run ONCE on mount

  // Filter turfs when dependencies change
  useEffect(() => {
    filterTurfs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turfs, selectedSport, searchQuery]); // Only re-filter when these change

  //==========================================================================
  // RENDER FUNCTIONS - MEMOIZED
  //==========================================================================

  // PERFORMANCE: Memoize turf card component
  const TurfCard = memo(({ item }: { item: Turf }) => {
    // Calculate distance from user location
    const distance = useMemo(() => {
      if (userLocation && item.location?.lat && item.location?.lng) {
        const distanceKm = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.location.lat,
          item.location.lng
        );
        return formatDistance(distanceKm);
      }
      return null;
    }, [item.location?.lat, item.location?.lng, userLocation]);

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('TurfDetail', { id: item.id })}
        activeOpacity={0.7}
        style={styles.turfCardWrapper}
      >
        <View style={styles.turfCard}>
          {/* Left: Image */}
          <View style={styles.turfImageContainer}>
            <Image
              source={{ uri: item.images?.[0] || 'https://via.placeholder.com/400x250' }}
              style={styles.turfImage}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              priority="normal"
              recyclingKey={item.id}
              placeholderContentFit="cover"
            />
          </View>
          
          {/* Right: Content */}
          <View style={styles.turfInfo}>
            {/* Title and Bookmark */}
            <View style={styles.turfTitleRow}>
              <Text style={styles.turfName} numberOfLines={1}>
                {item.name || 'Unnamed Turf'}
              </Text>
              <TouchableOpacity style={styles.bookmarkButton}>
                <Ionicons name="bookmark-outline" size={18} color={colors.gray[400]} />
              </TouchableOpacity>
            </View>
            
            {/* Location */}
            <View style={styles.turfLocationRow}>
              <Ionicons name="location-outline" size={14} color={colors.gray[500]} />
              <Text style={styles.location} numberOfLines={1}>
                {item.location?.address || item.location?.city || 'Location not specified'}
              </Text>
            </View>
            
            {/* Rating and Reviews */}
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color="#fbbf24" />
              <Text style={styles.rating}>
                {item.rating?.toFixed(1) || '4.0'}
              </Text>
              <Text style={styles.reviewCount}>
                ({item.totalReviews || item.reviews || 0})
              </Text>
            </View>
            
            {/* Bottom Row: Sport Badge and Price */}
            <View style={styles.bottomRow}>
              <View style={styles.sportBadge}>
                <Text style={styles.sportBadgeText}>
                  {item.sport?.toUpperCase() || 'SPORTS'}
                </Text>
              </View>
              <Text style={styles.price}>₹{item.pricePerHour || item.price}/hr</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  // Render function for FlatList
  const renderTurfCard = useCallback(({ item }: { item: Turf }) => (
    <TurfCard item={item} />
  ), []);

  // PERFORMANCE: Memoize keyExtractor
  const keyExtractor = useCallback((item: Turf) => item.id, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Loading turfs...</Text>
      </SafeAreaView>
    );
  }

  //==========================================================================
  // MAIN RENDER
  //==========================================================================
  
  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Green Header Section */}
      <View style={styles.greenHeader}>
        {/* Location with Map Selector */}
        <View style={styles.locationRow}>
          <View style={styles.locationInfo}>
            <Ionicons name="location-sharp" size={16} color="#ffffff" />
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationTitle}>Sehore</Text>
              <Text style={styles.locationSubtitle}>Madhya Pradesh, India</Text>
              {/* <Ionicons name="chevron-down" size={16} color="#ffffff" /> */}
            </View>
          </View>
          
          {/* View Mode Toggle */}
          <View style={styles.headerViewToggle}>
            <TouchableOpacity
              style={[styles.headerViewButton, viewMode === 'list' && styles.headerViewButtonActive]}
              onPress={() => setViewMode('list')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="list" 
                size={20} 
                color={viewMode === 'list' ? colors.primary[600] : '#ffffff'} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerViewButton, viewMode === 'map' && styles.headerViewButtonActive]}
              onPress={() => setViewMode('map')}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="map" 
                size={20} 
                color={viewMode === 'map' ? colors.primary[600] : '#ffffff'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar with Filter Button */}
        <View style={styles.searchWithFilterRow}>
          <View style={styles.searchBarContainer}>
            <Ionicons name="search-outline" size={20} color={colors.gray[500]} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="find a spot..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.gray[400]}
            />
          </View>
          
          {/* Small Filter Icon Button */}
          <TouchableOpacity 
            style={styles.filterIconButton}
            onPress={() => setIsFilterModalVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="options-outline" size={22} color={colors.primary[600]} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Promotional Banner Carousel */}
      <View style={styles.bannerSection}>
        <ScrollView
          ref={bannerScrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(event) => {
            const newIndex = Math.round(
              event.nativeEvent.contentOffset.x / (Dimensions.get('window').width)
            );
            setCurrentBannerIndex(newIndex);
          }}
        >
          {PROMOTIONAL_BANNERS.map((banner, index) => (
            <View key={index} style={styles.bannerSlide}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => {
                  // Handle banner tap - could navigate to promotions screen
                }}
              >
                <Image
                  source={banner}
                  style={styles.bannerImage}
                  contentFit="cover"
                  transition={200}
                />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
        
        {/* Banner Pagination Dots */}
        <View style={styles.paginationDots}>
          {PROMOTIONAL_BANNERS.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                currentBannerIndex === index ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Turfs List or Map */}
      <View style={{ flex: 1 }}>
        {filteredTurfs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={colors.gray[300]} />
            <Text style={styles.emptyTitle}>No turfs found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || selectedSport !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Check back later for new turfs'}
            </Text>
          </View>
        ) : viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <View style={styles.mapWrapper}>
            <MapView
              provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
              style={styles.map}
              initialRegion={{
                latitude: 23.2041,
                longitude: 77.0842,
                latitudeDelta: 0.0922,
                longitudeDelta: 0.0421,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
            >
              {filteredTurfs.map((turf) => {
                if (!turf.location?.lat || !turf.location?.lng) {
                  return null;
                }

                const sportMarker = SPORT_MARKERS[turf.sport] || SPORT_MARKERS.football;

                const address = turf.location?.address || 'Location not available';
                const rating = turf.rating?.toFixed(1) || '5.0';
                const price = turf.pricePerHour || turf.price;

                return (
                  <Marker
                    key={turf.id}
                    coordinate={{
                      latitude: turf.location.lat,
                      longitude: turf.location.lng,
                    }}
                    title={turf.name}
                    description={`${address}\n★ ${rating} • ₹${price}/hr`}
                    onPress={() => setSelectedMarkerTurf(turf)}
                    onCalloutPress={() => {
                      navigation.navigate('TurfDetail', { id: turf.id });
                    }}
                  >
                    <View style={styles.customMarker}>
                      <View style={[styles.markerCircle, { backgroundColor: sportMarker.color }]}>
                        <Ionicons name={sportMarker.icon} size={22} color="#ffffff" />
                      </View>
                    </View>
                  </Marker>
                );
              })}
            </MapView>
          </View>
        </View>
        ) : (
          <FlatList
            data={filteredTurfs}
            renderItem={renderTurfCard}
            keyExtractor={keyExtractor}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            maxToRenderPerBatch={5}
            initialNumToRender={5}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary[600]}
                colors={[colors.primary[600]]}
              />
            }
          />
        )}
      </View>

      {/* Custom Styled Callout Modal */}
      {selectedMarkerTurf && (
        <View style={styles.markerCalloutOverlay}>
          <TouchableOpacity 
            style={styles.markerCalloutBackdrop}
            activeOpacity={1}
            onPress={() => setSelectedMarkerTurf(null)}
          />
          <View style={styles.markerCalloutCard}>
            <TouchableOpacity
              style={styles.markerCalloutContent}
              activeOpacity={0.9}
              onPress={() => {
                setSelectedMarkerTurf(null);
                navigation.navigate('TurfDetail', { id: selectedMarkerTurf.id });
              }}
            >
              <View style={styles.markerCalloutHeader}>
                <Text style={styles.markerCalloutTitle} numberOfLines={1}>
                  {selectedMarkerTurf.name}
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedMarkerTurf(null)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close-circle" size={24} color={colors.gray[400]} />
                </TouchableOpacity>
              </View>
              
              <View style={styles.markerCalloutBody}>
                <View style={styles.markerCalloutRow}>
                  <Ionicons name="location-outline" size={16} color={colors.gray[600]} />
                  <Text style={styles.markerCalloutAddress} numberOfLines={1}>
                    {selectedMarkerTurf.location?.address || 'Location not available'}
                  </Text>
                </View>
                
                <View style={styles.markerCalloutRow}>
                  <Ionicons 
                    name={SPORT_MARKERS[selectedMarkerTurf.sport]?.icon || 'football'} 
                    size={16} 
                    color={SPORT_MARKERS[selectedMarkerTurf.sport]?.color || colors.primary[600]} 
                  />
                  <Text style={styles.markerCalloutSport}>
                    {selectedMarkerTurf.sport}
                  </Text>
                </View>
              </View>
              
              <View style={styles.markerCalloutFooter}>
                <View style={styles.markerCalloutRatingBox}>
                  <Ionicons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.markerCalloutRating}>
                    {selectedMarkerTurf.rating?.toFixed(1) || '5.0'}
                  </Text>
                </View>
                <Text style={styles.markerCalloutPrice}>
                  ₹{selectedMarkerTurf.pricePerHour || selectedMarkerTurf.price}/hr
                </Text>
              </View>
              
              <View style={styles.markerCalloutTapHint}>
                <Text style={styles.markerCalloutTapText}>Tap to view details</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary[600]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        title="Filter by Sport"
        showCloseButton={true}
      >
        <View>
          {SPORT_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterModalOption,
                selectedSport === filter.value && styles.filterModalOptionActive,
              ]}
              onPress={() => {
                setSelectedSport(filter.value);
                setIsFilterModalVisible(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterModalOptionText,
                  selectedSport === filter.value && styles.filterModalOptionTextActive,
                ]}
              >
                {filter.label}
              </Text>
              {selectedSport === filter.value && (
                <Ionicons name="checkmark-circle" size={24} color={colors.primary[600]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}//==============================================================================
// STYLES
//==============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // Marker Styles
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerCircle: {
    width:37,
    height: 37,
    borderRadius: 22,
    backgroundColor: '#16a34a',
    borderWidth: 3,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  
  // Callout Styles - Simple and Android-compatible
  calloutContainer: {
    width: 200,
  },
  calloutContent: {
    padding: 0,
    width: 200,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 6,
  },
  calloutInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calloutRating: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  calloutPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },

  // Custom Marker Callout Modal Styles
  markerCalloutOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  markerCalloutBackdrop: {
    position: 'absolute',
    top: -1000,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  markerCalloutCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: Platform.select({ ios: 34, android: 24 }),
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  markerCalloutContent: {
    paddingHorizontal: 20,
  },
  markerCalloutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingTop: 8,
  },
  markerCalloutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 12,
  },
  markerCalloutBody: {
    marginBottom: 16,
  },
  markerCalloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  markerCalloutAddress: {
    fontSize: 14,
    color: colors.gray[600],
    marginLeft: 8,
    flex: 1,
  },
  markerCalloutSport: {
    fontSize: 14,
    color: colors.gray[700],
    marginLeft: 8,
    textTransform: 'capitalize',
    fontWeight: '500',
  },
  markerCalloutFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    marginBottom: 12,
  },
  markerCalloutRatingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  markerCalloutRating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  markerCalloutPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary[600],
  },
  markerCalloutTapHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
  },
  markerCalloutTapText: {
    fontSize: 13,
    color: colors.primary[600],
    fontWeight: '600',
  },

  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  
  // Green Header Section (matches reference image)
  greenHeader: {
    backgroundColor: colors.primary[600],
    paddingTop: Platform.select({ ios: spacing.xl + 4, android: spacing.xl + 8 }),
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius['2xl'],
    ...shadows.lg,
    elevation: 8,
    height: 160,
  },
  locationRow: {
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  locationTextContainer: {
    flex: 1,
    marginHorizontal: spacing.xs,
  },
  locationTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
  },
  locationSubtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  headerViewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.lg,
    padding: 2,
  },
  headerViewButton: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 40,
  },
  headerViewButtonActive: {
    backgroundColor: '#ffffff',
    
  },
  searchWithFilterRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'stretch',
  },
  searchBarContainer: {
    height: 40,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  searchBarInput: {
    
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  filterIconButton: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.md,
    width: 48,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.sm,
    elevation: 2,
  },
  
  // Filter Modal Styles  
  filterModalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  filterModalOptionActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
    borderWidth: 2,
  },
  filterModalOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  filterModalOptionTextActive: {
    color: colors.primary[700],
    fontWeight: '700',
  },
  
  // Banner Carousel Styles
  bannerSection: {
    paddingVertical: spacing.md,
    backgroundColor: '#f8f9fa',
  },
  bannerSlide: {
    width: Dimensions.get('window').width,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  bannerImage: {
    width: Dimensions.get('window').width - 32,
    height: 160,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.gray[200],
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.primary[600],
    width: 24,
  },
  dotInactive: {
    backgroundColor: colors.gray[300],
  },
  
  listContainer: {
    padding: spacing.lg,
  },
  turfCardWrapper: {
    marginBottom: spacing.md,
  },
  turfCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  turfImageContainer: {
    width: 100,
    height: 120,
  },
  turfImage: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray[200],
  },
  turfInfo: {
    flex: 1,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  turfTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  turfName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.xs,
  },
  bookmarkButton: {
    padding: 2,
  },
  turfLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: 4,
  },
  location: {
    fontSize: 13,
    color: colors.gray[600],
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 4,
  },
  rating: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  reviewCount: {
    fontSize: 12,
    color: colors.gray[500],
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sportBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  sportBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary[600],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
  },
  emptyTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  
  //--------------------------------------------------------------------------
  // Map View Styles
  //--------------------------------------------------------------------------
  mapContainer: {
    margin: spacing.lg,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    ...shadows.lg,
    elevation: 3,
  },
  mapWrapper: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    height: '100%',
  },
  map: {
    width: '100%',
    height: '100%',
  },

  // Location picker modal styles
  locationPickerContent: {
    paddingVertical: spacing.sm,
    height: '100%',
    backgroundColor: colors.backgroundSecondary,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
    height: 48,
    width: '100%',
  },
  locationOptionActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[600],
    elevation: 2,

  },
  locationOptionText: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,

  },
  locationOptionTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.bold,
    textDecorationLine: 'underline',
  },

});
