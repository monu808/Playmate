import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  Image,
  Modal,
  Dimensions,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { addTurf } from '../../lib/firebase/firestore';
import { LoadingSpinner } from '../../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';

const { width, height } = Dimensions.get('window');

const SPORTS_OPTIONS = ['football', 'cricket', 'basketball', 'badminton', 'tennis', 'volleyball'];
const AMENITIES_OPTIONS = [
  'Parking',
  'Drinking Water',
  'Seating Area',
  'Equipment Storage',
  'Changing Rooms',
  'First Aid',
  'Flood Lights',
  'Washrooms',
  'CCTV',
  'Refreshments',
];

export default function AddTurfScreen({ navigation }: any) {
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const markerScale = useRef(new Animated.Value(1)).current;
  
  // Basic Info
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sport, setSport] = useState('football');
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  
  // Location
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: 28.5355,
    longitude: 77.3910,
  });
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  
  // Images - now storing local URIs or uploaded URLs
  const [images, setImages] = useState<string[]>([]);
  
  // Amenities
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  // Rating (optional, defaults to 4.5)
  const [rating, setRating] = useState('4.5');

  const toggleAmenity = (amenity: string) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities(selectedAmenities.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities([...selectedAmenities, amenity]);
    }
  };

  // Image Picker Functions
  const pickImages = async () => {
    // Request permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to upload images.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      aspect: [16, 9],
    });

    if (!result.canceled && result.assets) {
      const newImages = result.assets.map(asset => asset.uri);
      setImages([...images, ...newImages]);
    }
  };

  const takePicture = async () => {
    // Request permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera permissions to take pictures.');
      return;
    }

    // Launch camera
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      aspect: [16, 9],
    });

    if (!result.canceled && result.assets) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const showImageOptions = () => {
    Alert.alert(
      'Add Image',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: takePicture },
        { text: 'Choose from Gallery', onPress: pickImages },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  // Map Functions
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
    
    // Animate map to new location
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      },
      300
    );
  };

  const handleMarkerDragEnd = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    animateMarker();
  };

  const confirmLocation = () => {
    setShowMapModal(false);
    setMapReady(false);
  };

  const handleMapReady = () => {
    setMapReady(true);
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

  const handleSubmit = async () => {
    // Validation
    if (!name || !description || !price || !address || !city) {
      Alert.alert('Error', 'Please fill in all required fields:\n• Name\n• Description\n• Price\n• Address\n• City');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Warning', 'No images added. Add at least one image for better presentation.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue Anyway', onPress: () => submitTurf() },
      ]);
      return;
    }

    await submitTurf();
  };

  const submitTurf = async () => {
    try {
      setLoading(true);
      
      // In a real app, you would upload images to Firebase Storage first
      // For now, we'll use the local URIs or provide placeholder URLs
      const imageUrls = images.length > 0 ? images : [
        'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=800',
      ];
      
      const turfData = {
        name: name.trim(),
        description: description.trim(),
        sport,
        price: parseFloat(price),
        pricePerHour: parseFloat(price),
        location: {
          address: address.trim(),
          city: city.trim(),
          lat: selectedLocation.latitude,
          lng: selectedLocation.longitude,
        },
        images: imageUrls,
        amenities: selectedAmenities,
        isActive,
        rating: parseFloat(rating) || 4.5,
        reviews: 0,
        totalBookings: 0,
        totalReviews: 0,
        availableSlots: [],
        createdAt: new Date(),
      };

      await addTurf(turfData as any);
      Alert.alert('Success', 'Turf added successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error adding turf:', error);
      Alert.alert('Error', 'Failed to add turf. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Turf</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.form}>
          {/* Basic Information */}
          <Text style={styles.sectionTitle}>Basic Information</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Turf Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="e.g., Urban Sports Basketball Court"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe your turf..."
              placeholderTextColor={colors.gray[400]}
              multiline
              numberOfLines={4}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Sport Type *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sportScroll}>
              {SPORTS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sportChip, sport === s && styles.sportChipActive]}
                  onPress={() => setSport(s)}
                >
                  <Text style={[styles.sportChipText, sport === s && styles.sportChipTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Price Per Hour (₹) *</Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              placeholder="e.g., 900"
              placeholderTextColor={colors.gray[400]}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.label}>Active Status</Text>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
                thumbColor={isActive ? colors.primary[600] : colors.gray[500]}
              />
            </View>
            <Text style={styles.helpText}>Active turfs are visible to users</Text>
          </View>

          {/* Location */}
          <Text style={styles.sectionTitle}>Location</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              value={address}
              onChangeText={setAddress}
              placeholder="e.g., Sector 15"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City *</Text>
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="e.g., Noida"
              placeholderTextColor={colors.gray[400]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Pick Location on Map</Text>
            <TouchableOpacity style={styles.mapButton} onPress={() => setShowMapModal(true)}>
              <Ionicons name="location" size={24} color={colors.primary[600]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.mapButtonText}>
                  {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
                </Text>
                <Text style={styles.mapButtonSubtext}>Tap to change location</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>

          {/* Images */}
          <Text style={styles.sectionTitle}>Images</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Turf Photos</Text>
            <TouchableOpacity style={styles.uploadButton} onPress={showImageOptions}>
              <Ionicons name="camera" size={24} color={colors.primary[600]} />
              <Text style={styles.uploadButtonText}>Add Photos</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>
              {images.length} {images.length === 1 ? 'image' : 'images'} added
            </Text>
          </View>

          {images.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewScroll}>
              {images.map((uri, index) => (
                <View key={index} style={styles.imagePreviewContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity 
                    style={styles.removeImageButton} 
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ffffff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {/* Amenities */}
          <Text style={styles.sectionTitle}>Amenities</Text>

          <View style={styles.amenitiesGrid}>
            {AMENITIES_OPTIONS.map((amenity) => (
              <TouchableOpacity
                key={amenity}
                style={[
                  styles.amenityChip,
                  selectedAmenities.includes(amenity) && styles.amenityChipActive,
                ]}
                onPress={() => toggleAmenity(amenity)}
              >
                <Ionicons
                  name={selectedAmenities.includes(amenity) ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={selectedAmenities.includes(amenity) ? colors.primary[600] : colors.gray[400]}
                />
                <Text
                  style={[
                    styles.amenityText,
                    selectedAmenities.includes(amenity) && styles.amenityTextActive,
                  ]}
                >
                  {amenity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Initial Rating (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Initial Rating (Optional)</Text>
            <TextInput
              style={styles.input}
              value={rating}
              onChangeText={setRating}
              placeholder="4.5"
              placeholderTextColor={colors.gray[400]}
              keyboardType="decimal-pad"
            />
            <Text style={styles.helpText}>Default: 4.5 stars</Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Add Turf</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView style={styles.mapModalContainer}>
          <View style={styles.mapHeader}>
            <TouchableOpacity 
              onPress={() => setShowMapModal(false)}
              style={styles.mapHeaderButton}
            >
              <Ionicons name="close" size={28} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Select Location</Text>
            <TouchableOpacity 
              onPress={confirmLocation}
              style={styles.mapHeaderButton}
            >
              <Text style={styles.mapHeaderDone}>Done</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.mapContainer}>
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
              onMapReady={handleMapReady}
              showsUserLocation
              showsMyLocationButton={false}
              showsCompass
              rotateEnabled
              pitchEnabled={false}
              scrollEnabled
              zoomEnabled
              toolbarEnabled={false}
            >
              <Marker
                coordinate={selectedLocation}
                draggable
                onDragEnd={handleMarkerDragEnd}
                pinColor={colors.primary[600]}
              >
                <Animated.View style={{ transform: [{ scale: markerScale }] }}>
                  <View style={styles.customMarker}>
                    <Ionicons name="location" size={40} color={colors.primary[600]} />
                  </View>
                </Animated.View>
              </Marker>
            </MapView>

            {/* Center Button */}
            <TouchableOpacity 
              style={styles.centerButton}
              onPress={centerOnLocation}
            >
              <Ionicons name="locate" size={24} color={colors.primary[600]} />
            </TouchableOpacity>

            {/* Loading Overlay */}
            {!mapReady && (
              <View style={styles.mapLoadingOverlay}>
                <ActivityIndicator size="large" color={colors.primary[600]} />
                <Text style={styles.mapLoadingText}>Loading map...</Text>
              </View>
            )}
          </View>
          
          <View style={styles.mapFooter}>
            <View style={styles.coordinatesContainer}>
              <Ionicons name="location-outline" size={20} color={colors.primary[600]} />
              <Text style={styles.mapCoordinates}>
                {selectedLocation.latitude.toFixed(6)}, {selectedLocation.longitude.toFixed(6)}
              </Text>
            </View>
            <Text style={styles.mapHint}>Tap anywhere on the map or drag the marker</Text>
          </View>
        </SafeAreaView>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    ...shadows.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  form: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sportScroll: {
    marginTop: spacing.sm,
  },
  sportChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray[300],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  sportChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  sportChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.gray[700],
  },
  sportChipTextActive: {
    color: '#ffffff',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  mapButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  mapButtonSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
    borderWidth: 2,
    borderColor: colors.primary[600],
    borderStyle: 'dashed',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  uploadButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.primary[600],
  },
  imagePreviewScroll: {
    marginBottom: spacing.md,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[200],
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.error,
    borderRadius: borderRadius.full,
  },
  imageInputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  imageInput: {
    flex: 1,
  },
  addButton: {
    backgroundColor: colors.primary[600],
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  imageUrl: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.gray[300],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
  },
  amenityChipActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  amenityText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
  },
  amenityTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  submitButton: {
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing['2xl'],
    ...shadows.lg,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  mapModalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.lg,
    backgroundColor: '#ffffff',
    ...shadows.sm,
  },
  mapHeaderButton: {
    padding: spacing.sm,
    minWidth: 60,
  },
  mapHeaderTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  mapHeaderDone: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  centerButton: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.lg,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  mapLoadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  mapFooter: {
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  coordinatesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  mapCoordinates: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  mapHint: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
