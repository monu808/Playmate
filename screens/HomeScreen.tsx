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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import { getTurfs } from '../lib/firebase/firestore';
import { LoadingSpinner, Modal } from '../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../lib/theme';
import { formatCurrency } from '../lib/utils';
import { Turf, TurfSport } from '../types';

const SPORT_FILTERS: { label: string; value: TurfSport | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Football', value: 'football' },
  { label: 'Cricket', value: 'cricket' },
  { label: 'Basketball', value: 'basketball' },
  { label: 'Badminton', value: 'badminton' },
];

export default function HomeScreen({ navigation }: any) {
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [filteredTurfs, setFilteredTurfs] = useState<Turf[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<TurfSport | 'all'>('all');

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
  }, []);

  useEffect(() => {
    filterTurfs();
  }, [turfs, searchQuery, selectedSport]);

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

  const renderTurfCard = ({ item }: { item: Turf }) => (
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

      {/* Turfs List */}
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
});
