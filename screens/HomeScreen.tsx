import React, { useState, useEffect, useCallback } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { Marker, PROVIDER_GOOGLE, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { getTurfs } from '../lib/firebase/firestore';
import { LoadingSpinner, Modal } from '../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import { formatCurrency } from '../lib/utils';
import { Turf, TurfSport } from '../types';

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

  // Video player for header background
  const videoSource = require('../Intro.mp4');
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    player.muted = true;
    player.playbackRate = 1.0;
    player.play();
  });

  // Ensure video keeps looping smoothly
  useEffect(() => {
    if (player) {
      player.loop = true;
      player.play();
    }
  }, [player]);

  useEffect(() => {
    loadTurfs();
    getUserLocation();
  }, []);

  useEffect(() => {
    filterTurfs();
  }, [turfs, searchQuery, selectedSport]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadTurfs = async () => {
    try {
      console.log('🏠 HomeScreen: Loading turfs...');
      const fetchedTurfs = await getTurfs();
      console.log('🏠 HomeScreen: Received turfs:', fetchedTurfs?.length || 0);
      
      // If no turfs from database, show sample data for testing
      if (!fetchedTurfs || fetchedTurfs.length === 0) {
        console.log('⚠️ No turfs in database, showing sample data');
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
              lat: 28.7041,
              lng: 77.1025,
              address: 'Connaught Place',
              city: 'New Delhi',
            },
            amenities: ['Parking', 'Changing Room', 'Floodlights', 'Drinking Water'],
            availableSlots: [],
            rating: 4.8,
            reviews: 45,
            totalBookings: 120,
            totalReviews: 45,
            createdAt: new Date(),
            isActive: true,
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
              lat: 28.6139,
              lng: 77.2090,
              address: 'Nehru Place',
              city: 'New Delhi',
            },
            amenities: ['Parking', 'Changing Room', 'Restrooms', 'Seating'],
            availableSlots: [],
            rating: 4.5,
            reviews: 32,
            totalBookings: 85,
            totalReviews: 32,
            createdAt: new Date(),
            isActive: true,
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
              lat: 28.5355,
              lng: 77.3910,
              address: 'Sector 18',
              city: 'Noida',
            },
            amenities: ['Indoor', 'Air Conditioning', 'Changing Room', 'Drinking Water'],
            availableSlots: [],
            rating: 4.9,
            reviews: 67,
            totalBookings: 200,
            totalReviews: 67,
            createdAt: new Date(),
            isActive: true,
          },
        ];
        setTurfs(sampleTurfs);
        console.log('✅ Sample turfs loaded:', sampleTurfs.length);
      } else {
        setTurfs(fetchedTurfs);
        console.log('✅ Database turfs loaded:', fetchedTurfs.length);
      }
    } catch (error) {
      console.error('❌ Error fetching turfs:', error);
      // Show sample data on error too
      setTurfs([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTurfs();
    setRefreshing(false);
  }, []);

  const filterTurfs = () => {
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
  };

  const renderTurfCard = ({ item }: { item: Turf }) => {
    // Calculate distance from user location
    let distance: string | null = null;
    if (userLocation && item.location?.lat && item.location?.lng) {
      const distanceKm = calculateDistance(
        userLocation.latitude,
        userLocation.longitude,
        item.location.lat,
        item.location.lng
      );
      distance = formatDistance(distanceKm);
    }

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
            transition={200}
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
  };

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

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with Video Background */}
      <View style={[styles.header, { height: HEADER_HEIGHT, width: HEADER_WIDTH }]}>
        <VideoView
          player={player}
          style={[styles.videoBackground, { height: HEADER_HEIGHT, width: HEADER_WIDTH }]}
          nativeControls={false}
          contentFit="contain"
          allowsPictureInPicture={false}
        />
        <LinearGradient
          colors={['rgba(22, 163, 74, 0.65)', 'rgba(21, 128, 60, 0)', 'rgba(20, 83, 45, 0)']}
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
          <MapView
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={CITY_LOCATIONS[selectedLocation]}
            showsUserLocation
            showsMyLocationButton
          >
            {filteredTurfs.map((turf) => {
              if (!turf.location?.lat || !turf.location?.lng) return null;

              const sportMarker = SPORT_MARKERS[turf.sport] || SPORT_MARKERS.football;
              
              // Calculate distance from user
              let distance: string | null = null;
              if (userLocation) {
                const distanceKm = calculateDistance(
                  userLocation.latitude,
                  userLocation.longitude,
                  turf.location.lat,
                  turf.location.lng
                );
                distance = formatDistance(distanceKm);
              }

              return (
                <Marker
                  key={turf.id}
                  coordinate={{
                    latitude: turf.location.lat,
                    longitude: turf.location.lng,
                  }}
                >
                  <View style={styles.markerContainer}>
                    <View style={[styles.marker, { backgroundColor: sportMarker.color }]}>
                      <Ionicons name={sportMarker.icon} size={20} color="#ffffff" />
                    </View>
                    <View style={[styles.markerArrow, { borderTopColor: sportMarker.color }]} />
                  </View>
                  <Callout tooltip onPress={() => navigation.navigate('TurfDetail', { id: turf.id })}>
                    <TouchableOpacity 
                      style={styles.calloutContainer}
                      onPress={() => navigation.navigate('TurfDetail', { id: turf.id })}
                      activeOpacity={0.9}
                    >
                      <Text style={styles.calloutTitle} numberOfLines={1}>{turf.name}</Text>
                      <View style={styles.calloutRow}>
                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.calloutAddress} numberOfLines={1}>
                          {turf.location.address}
                        </Text>
                      </View>
                      <View style={styles.calloutRow}>
                        <View style={styles.calloutRating}>
                          <Ionicons name="star" size={14} color="#FFA500" />
                          <Text style={styles.calloutRatingText}>
                            {turf.rating?.toFixed(1) || '5.0'}
                          </Text>
                        </View>
                        <Text style={styles.calloutPrice}>
                          {formatCurrency(turf.pricePerHour || turf.price)}/hr
                        </Text>
                      </View>
                      {distance && (
                        <View style={styles.calloutDistance}>
                          <Ionicons name="navigate" size={12} color={colors.primary[600]} />
                          <Text style={styles.calloutDistanceText}>{distance} away</Text>
                        </View>
                      )}
                      <Text style={styles.calloutTapHint}>Tap to view details</Text>
                    </TouchableOpacity>
                  </Callout>
                </Marker>
              );
            })}
          </MapView>
        </View>
      ) : (
        <FlatList
          data={filteredTurfs}
          renderItem={renderTurfCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
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
    paddingRight: spacing.lg,
    gap: spacing.sm,
  },
  filterChip: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg + 4,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginRight: spacing.sm,
    ...shadows.sm,
    elevation: 2,
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
  // Map view styles
  mapContainer: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.lg,
  },
  map: {
    flex: 1,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
    elevation: 8,
  },
  markerContainer: {
    alignItems: 'center',
  },
  marker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
    elevation: 5,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  markerArrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.primary[600],
    marginTop: -1,
  },
  // Location picker modal styles
  locationPickerContent: {
    paddingVertical: spacing.sm,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.backgroundSecondary,
  },
  locationOptionActive: {
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[600],
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
  },
  // Map callout styles
  calloutContainer: {
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 200,
    maxWidth: 250,
    ...shadows.lg,
    elevation: 8,
  },
  calloutTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  calloutAddress: {
    flex: 1,
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  calloutRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  calloutRatingText: {
    marginLeft: spacing.xs - 2,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  calloutPrice: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  calloutDistance: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  calloutDistanceText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium,
    color: colors.primary[600],
  },
  calloutTapHint: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
    textAlign: 'center',
  },
});
