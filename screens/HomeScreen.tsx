import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image as RNImage } from 'react-native';
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

  //==========================================================================
  // STATE MANAGEMENT
  //==========================================================================
  
  // Video player for header background - OPTIMIZED: muted and reduced quality
  const videoSource = require('../Intro.mp4');
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    player.muted = true;
    player.playbackRate = 0.8; // Slightly slower for better performance
    player.volume = 0;
  });

  // PERFORMANCE: Control video playback based on view mode - simplified
  useEffect(() => {
    if (!player) return;
    
    const timeoutId = setTimeout(() => {
      try {
        if (viewMode === 'list') {
          player.play();
        }
      } catch (error) {
        // Ignore video errors
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [viewMode]); // Only depend on viewMode, not player

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
          {distance && (
            <View style={styles.distanceBadge}>
              <Ionicons name="navigate" size={12} color="#ffffff" />
              <Text style={styles.distanceText}>{distance}</Text>
            </View>
          )}
          <View style={styles.turfInfo}>
            <View style={styles.turfHeader}>
              <Text style={styles.turfName} numberOfLines={1}>
                {item.name || 'Unnamed Turf'}
              </Text>
              {item.sport && (
                <View style={styles.sportBadge}>
                  <Text style={styles.sportBadgeText}>
                    {item.sport.charAt(0).toUpperCase() + item.sport.slice(1)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.location} numberOfLines={1}>
                {item.location?.address || 'Location not available'}
                {item.location?.city ? `, ${item.location.city}` : ''}
              </Text>
            </View>

            <View style={styles.bottomRow}>
              <View style={styles.ratingContainer}>
                <Ionicons name="star" size={16} color="#FFA500" />
                <Text style={styles.rating}>
                  {item.rating?.toFixed(1) || '5.0'}
                </Text>
                <Text style={styles.reviewCount}>
                  ({item.totalReviews || item.reviews || 0})
                </Text>
              </View>
              <Text style={styles.price}>
                {formatCurrency(item.pricePerHour || item.price || 0)}/hr
              </Text>
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

  const HEADER_HEIGHT = 200;
  const HEADER_WIDTH = 400; // You can change to a number like 350 or keep '100%'

  //==========================================================================
  // MAIN RENDER
  //==========================================================================
  
  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with Video Background */}
      <View style={[styles.header, { height: HEADER_HEIGHT, width: HEADER_WIDTH }]}>
        <VideoView
          player={player}
          style={[styles.videoBackground, { height: HEADER_HEIGHT, width: HEADER_WIDTH }]}
          nativeControls={false}
          contentFit="cover"
          allowsPictureInPicture={false}
        />
        <LinearGradient
          colors={['rgba(22, 163, 74, 0.59)', 'rgba(21, 128, 60, 0)', 'rgba(20, 83, 45, 0)']}
          style={styles.gradientOverlay}
        />
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={{ flex: 1 }} />
          </View>
          <View style={styles.headerBottom}>
            <Text style={styles.headerTitle}>Playmate</Text>
            <Text style={styles.headerSubtitle}>Book Your Perfect Turf</Text>
          </View>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search-outline" size={20} color={colors.gray[500]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search turfs..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.gray[400]}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Location & View Mode Selector */}
      <View style={styles.controlsSection}>
        <View style={styles.locationSelector}>
          <Ionicons name="location" size={18} color={colors.primary[600]} />
          <Text style={styles.locationText}>{selectedLocation}</Text>
        </View>
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'list' && styles.viewButtonActive]}
            onPress={() => setViewMode('list')}
          >
            <Ionicons 
              name="list" 
              size={20} 
              color={viewMode === 'list' ? '#ffffff' : colors.gray[600]} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewButton, viewMode === 'map' && styles.viewButtonActive]}
            onPress={() => setViewMode('map')}
          >
            <Ionicons 
              name="map" 
              size={20} 
              color={viewMode === 'map' ? '#ffffff' : colors.gray[600]} 
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Sport Filters */}
      <View style={styles.filtersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {SPORT_FILTERS.map((filter) => (
            <TouchableOpacity
              key={filter.value}
              style={[
                styles.filterChip,
                selectedSport === filter.value && styles.filterChipActive,
              ]}
              onPress={() => setSelectedSport(filter.value)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSport === filter.value && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
    </SafeAreaView>
  );
}//==============================================================================
// STYLES
//==============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
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
  header: {
    backgroundColor: 'transparent',
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    position: 'relative',
    minHeight: 160,
    overflow: 'hidden',
    width: '100%',
  },
  videoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    zIndex: 0,
    transform: [
    { scale: 1.2 },      // Zoom in 20%
    { translateY: 0 }, // Shift up 20px
  ],
  },
  gradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
  },
  headerBottom: {
    marginBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
    marginBottom: spacing.xs - 5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.base,
    color: '#ffffff',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    ...shadows.md,
    elevation: 4,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.md + 2,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  clearButton: {
    padding: spacing.xs,
  },
  filtersSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filtersContainer: {
    justifyContent: 'flex-start',
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg + 4,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    borderWidth: 0.5,
    // borderColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: spacing.sm,
    // ...shadows.sm,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
    ...shadows.md,
    elevation: 4,
  },
  filterChipText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4b5563',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    padding: spacing.lg,
  },
  turfCardWrapper: {
    marginBottom: spacing.lg,
  },
  turfCard: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  turfImage: {
    width: '100%',
    height: 220,
    backgroundColor: colors.gray[200],
  },
  distanceBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    ...shadows.md,
    elevation: 4,
  },
  distanceText: {
    marginLeft: spacing.xs - 2,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  turfInfo: {
    padding: spacing.lg,
  },
  turfHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  turfName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  sportBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    shadowColor: colors.primary[600],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  sportBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  location: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
  },
  reviewCount: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  price: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
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
  // Location and view mode controls
  controlsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  locationSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    elevation: 2,
  },
  locationText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    elevation: 2,
    overflow: 'hidden',
  },
  viewButton: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewButtonActive: {
    backgroundColor: colors.primary[600],
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
