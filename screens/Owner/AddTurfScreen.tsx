import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
  Modal,
  Dimensions,
  Animated,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Button, Input } from '../../components/ui';
import { colors, typography, spacing, borderRadius } from '../../lib/theme';
import { createOwnerTurf } from '../../lib/firebase/owner';
import { useAuth } from '../../contexts/AuthContext';
import { TurfSport } from '../../types';

const { width, height } = Dimensions.get('window');


export default function AddTurfScreen({ navigation }: any) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const mapRef = useRef<MapView>(null);
  const markerScale = useRef(new Animated.Value(1)).current;
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pricePerHour: '',
    address: '',
    city: 'Sehore',
    sport: 'football' as TurfSport,
  });
  
  // Location state
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: 23.2041,
    longitude: 77.0842,
  });
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  
  const [images, setImages] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const sports: { value: TurfSport; label: string; icon: string }[] = [
    { value: 'football', label: 'Football', icon: 'football' },
    { value: 'cricket', label: 'Cricket', icon: 'baseball' },
    { value: 'basketball', label: 'Basketball', icon: 'basketball' },
    { value: 'badminton', label: 'Badminton', icon: 'tennisball' },
    { value: 'tennis', label: 'Tennis', icon: 'tennisball' },
    { value: 'volleyball', label: 'Volleyball', icon: 'baseball' },
  ];

  const availableAmenities = [
    'Parking', 'Washroom', 'Changing Room', 'Drinking Water',
    'First Aid', 'Seating', 'Lighting', 'Equipment',
  ];

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const pickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages([...images, ...newImages].slice(0, 5)); // Max 5 images
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images');
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const toggleAmenity = (amenity: string) => {
    if (amenities.includes(amenity)) {
      setAmenities(amenities.filter(a => a !== amenity));
    } else {
      setAmenities([...amenities, amenity]);
    }
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

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Turf name is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.pricePerHour || parseFloat(formData.pricePerHour) <= 0) {
      newErrors.pricePerHour = 'Valid price is required';
    }
    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }
    if (images.length === 0) {
      newErrors.images = 'At least one image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      return;
    }

    setLoading(true);
    try {
      const turfData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        sport: formData.sport,
        price: parseFloat(formData.pricePerHour), // Legacy field
        pricePerHour: parseFloat(formData.pricePerHour),
        images: images,
        location: {
          lat: selectedLocation.latitude,
          lng: selectedLocation.longitude,
          address: formData.address.trim(),
          city: formData.city,
        },
        amenities: amenities,
        availableSlots: generateDefaultSlots(),
        ownerId: user.uid,
        ownerName: user.displayName || 'Unknown',
        ownerEmail: user.email || '',
        ownerPhone: user.phoneNumber || '',
        isActive: false,
        rating: 0,
        reviews: 0,
      };

      const result = await createOwnerTurf(turfData as any);

      if (result.success) {
        Alert.alert(
          'Success!',
          'Your turf has been submitted for admin verification. You will be notified once it is approved.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', result.error || 'Failed to create turf');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const generateDefaultSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 22; hour++) {
      const startTime = `${hour.toString().padStart(2, '0')}:00`;
      const endTime = `${(hour + 1).toString().padStart(2, '0')}:00`;
      slots.push({
        startTime,
        endTime,
        isBooked: false,
      });
    }
    return slots;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add New Turf</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={24} color={colors.primary[600]} />
          <Text style={styles.infoText}>
            Your turf will be reviewed by admin before going live
          </Text>
        </View>

        {/* Basic Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Input
            label="Turf Name"
            placeholder="e.g., Green Valley Sports Complex"
            value={formData.name}
            onChangeText={(text) => updateField('name', text)}
            error={errors.name}
            required
          />

          <Input
            label="Description"
            placeholder="Describe your turf facilities..."
            value={formData.description}
            onChangeText={(text) => updateField('description', text)}
            error={errors.description}
            required
            multiline
            numberOfLines={4}
          />

          <Input
            label="Price per Hour (₹)"
            placeholder="e.g., 500"
            value={formData.pricePerHour}
            onChangeText={(text) => updateField('pricePerHour', text)}
            error={errors.pricePerHour}
            required
            keyboardType="numeric"
          />
        </View>

        {/* Sport Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sport Type</Text>
          <View style={styles.sportGrid}>
            {sports.map((sport) => (
              <TouchableOpacity
                key={sport.value}
                style={[
                  styles.sportCard,
                  formData.sport === sport.value && styles.sportCardActive,
                ]}
                onPress={() => updateField('sport', sport.value)}
              >
                <Ionicons
                  name={sport.icon as any}
                  size={32}
                  color={
                    formData.sport === sport.value
                      ? colors.primary[600]
                      : colors.gray[500]
                  }
                />
                <Text
                  style={[
                    styles.sportLabel,
                    formData.sport === sport.value && styles.sportLabelActive,
                  ]}
                >
                  {sport.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Photos {images.length > 0 && `(${images.length}/5)`}
          </Text>
          {errors.images && <Text style={styles.errorText}>{errors.images}</Text>}
          
          <View style={styles.imagesContainer}>
            {images.map((uri, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => removeImage(index)}
                >
                  <Ionicons name="close-circle" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                <Ionicons name="camera" size={32} color={colors.primary[600]} />
                <Text style={styles.addImageText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <Input
            label="Address"
            placeholder="Enter street address"
            value={formData.address}
            onChangeText={(text) => updateField('address', text)}
            error={errors.address}
            required
            multiline
          />

          <Input
            label="City"
            value={formData.city}
            onChangeText={(text) => updateField('city', text)}
            editable={false}
          />

          {/* Map Selector Button */}
          <View style={styles.mapSelectorContainer}>
            <Text style={styles.inputLabel}>Turf Location</Text>
            <TouchableOpacity
              style={styles.mapSelectorButton}
              onPress={() => setShowMapModal(true)}
            >
              <View style={styles.mapSelectorContent}>
                <Ionicons name="location" size={24} color={colors.primary[600]} />
                <View style={styles.mapSelectorText}>
                  <Text style={styles.mapSelectorTitle}>
                    {selectedLocation.latitude === 23.2041 && selectedLocation.longitude === 77.0842
                      ? 'Select Location on Map'
                      : 'Location Selected'}
                  </Text>
                  <Text style={styles.mapSelectorSubtitle}>
                    Lat: {selectedLocation.latitude.toFixed(4)}, Lng: {selectedLocation.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Amenities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Amenities</Text>
          <View style={styles.amenitiesGrid}>
            {availableAmenities.map((amenity) => (
              <TouchableOpacity
                key={amenity}
                style={[
                  styles.amenityChip,
                  amenities.includes(amenity) && styles.amenityChipActive,
                ]}
                onPress={() => toggleAmenity(amenity)}
              >
                <Text
                  style={[
                    styles.amenityText,
                    amenities.includes(amenity) && styles.amenityTextActive,
                  ]}
                >
                  {amenity}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Button
          text="Submit for Verification"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
          style={styles.submitBtn}
        />
      </ScrollView>

      {/* Map Modal */}
      <Modal
        visible={showMapModal}
        animationType="slide"
        onRequestClose={() => setShowMapModal(false)}
      >
        <SafeAreaView style={styles.mapModal}>
          {/* Map Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity
              style={styles.mapCloseButton}
              onPress={() => setShowMapModal(false)}
            >
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.mapHeaderTitle}>Select Turf Location</Text>
            <TouchableOpacity
              style={styles.mapCenterButton}
              onPress={centerOnLocation}
            >
              <Ionicons name="locate" size={24} color={colors.primary[600]} />
            </TouchableOpacity>
          </View>

          {/* Map View */}
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={{
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            onPress={handleMapPress}
            onMapReady={handleMapReady}
          >
            <Marker
              coordinate={selectedLocation}
              draggable
              onDragEnd={handleMarkerDragEnd}
              pinColor={colors.primary[600]}
            >
              <Animated.View
                style={[
                  styles.customMarker,
                  { transform: [{ scale: markerScale }] },
                ]}
              >
                <Ionicons name="location" size={48} color={colors.primary[600]} />
              </Animated.View>
            </Marker>
          </MapView>

          {/* Map Instructions */}
          <View style={styles.mapInstructions}>
            <View style={styles.instructionRow}>
              <Ionicons name="hand-left" size={20} color={colors.primary[600]} />
              <Text style={styles.instructionText}>Tap or drag the marker to set location</Text>
            </View>
            <View style={styles.coordinatesDisplay}>
              <Text style={styles.coordinatesText}>
                Lat: {selectedLocation.latitude.toFixed(6)}
              </Text>
              <Text style={styles.coordinatesText}>
                Lng: {selectedLocation.longitude.toFixed(6)}
              </Text>
            </View>
          </View>

          {/* Confirm Button */}
          <View style={styles.mapFooter}>
            <TouchableOpacity
              style={styles.confirmLocationButton}
              onPress={confirmLocation}
            >
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.confirmLocationText}>Confirm Location</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  infoText: {
    flex: 1,
    marginLeft: spacing.md,
    fontSize: typography.fontSize.sm,
    color: colors.primary[700],
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sportCard: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#fff',
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.gray[300],
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  sportCardActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  sportLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  sportLabelActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  imageWrapper: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  addImageBtn: {
    width: 100,
    height: 100,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.gray[300],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amenitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  amenityChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  amenityChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  amenityText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  amenityTextActive: {
    color: '#fff',
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[500],
    marginBottom: spacing.sm,
  },
  submitBtn: {
    marginTop: spacing.lg,
    marginBottom: spacing['2xl'],
  },
  // Map Selector Styles
  mapSelectorContainer: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  mapSelectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  mapSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mapSelectorText: {
    marginLeft: spacing.md,
    flex: 1,
  },
  mapSelectorTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  mapSelectorSubtitle: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  // Map Modal Styles
  mapModal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  },
  mapCloseButton: {
    padding: spacing.sm,
  },
  mapHeaderTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  mapCenterButton: {
    padding: spacing.sm,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapInstructions: {
    backgroundColor: '#fff',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  instructionText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
  coordinatesDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  coordinatesText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  mapFooter: {
    padding: spacing.lg,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
  },
  confirmLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    padding: spacing.lg,
    borderRadius: borderRadius.full,
    gap: spacing.sm,
  },
  confirmLocationText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#fff',
  },
});
