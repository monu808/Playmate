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
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input } from '../../components/ui';
import { MapPicker } from '../../components/MapPicker';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { createOwnerTurf } from '../../lib/firebase/owner';
import { useAuth } from '../../contexts/AuthContext';
import { TurfSport } from '../../types';

const { width, height } = Dimensions.get('window');

// Sport options with icons
const SPORTS_OPTIONS: { value: TurfSport; label: string; icon: string }[] = [
  { value: 'football', label: 'Football', icon: 'football' },
  { value: 'cricket', label: 'Cricket', icon: 'baseball' },
  { value: 'basketball', label: 'Basketball', icon: 'basketball' },
  { value: 'badminton', label: 'Badminton', icon: 'tennisball' },
  { value: 'tennis', label: 'Tennis', icon: 'tennisball' },
  { value: 'volleyball', label: 'Volleyball', icon: 'baseball' },
];

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    pricePerHour: '',
    address: '',
    city: 'Sehore',
  });
  
  // Multiple sports selection
  const [selectedSports, setSelectedSports] = useState<TurfSport[]>(['football']);
  
  // Location state
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: 23.2041,
    longitude: 77.0842,
  });
  const [showMapModal, setShowMapModal] = useState(false);
  
  const [images, setImages] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const updateField = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  const toggleSport = (sport: TurfSport) => {
    if (selectedSports.includes(sport)) {
      // Don't allow removing all sports
      if (selectedSports.length > 1) {
        setSelectedSports(selectedSports.filter(s => s !== sport));
      }
    } else {
      setSelectedSports([...selectedSports, sport]);
    }
  };

  const toggleAmenity = (amenity: string) => {
    if (amenities.includes(amenity)) {
      setAmenities(amenities.filter(a => a !== amenity));
    } else {
      setAmenities([...amenities, amenity]);
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
      // Use the first selected sport as primary, store all in amenities or description
      const primarySport = selectedSports[0];
      const sportsInfo = selectedSports.length > 1 
        ? `Available for: ${selectedSports.join(', ')}` 
        : '';

      const turfData = {
        name: formData.name.trim(),
        description: `${formData.description.trim()}${sportsInfo ? '\n' + sportsInfo : ''}`,
        sport: primarySport,
        sports: selectedSports, // Store all selected sports
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
    // Generate 30-minute slots from 10:00 AM to 11:00 PM (bookings till 12 AM)
    for (let hour = 10; hour < 24; hour++) {
      // First half-hour slot
      const startTime1 = `${hour.toString().padStart(2, '0')}:00`;
      const endTime1 = `${hour.toString().padStart(2, '0')}:30`;
      slots.push({
        startTime: startTime1,
        endTime: endTime1,
        isBooked: false,
      });
      
      // Second half-hour slot
      const startTime2 = `${hour.toString().padStart(2, '0')}:30`;
      const nextHour = hour + 1 === 24 ? '00' : (hour + 1).toString().padStart(2, '0');
      const endTime2 = `${nextHour}:00`;
      slots.push({
        startTime: startTime2,
        endTime: endTime2,
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

        {/* Sport Type - Multiple Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sport Types (Select Multiple)</Text>
          <View style={styles.sportGrid}>
            {SPORTS_OPTIONS.map((sport) => (
              <TouchableOpacity
                key={sport.value}
                style={[
                  styles.sportCard,
                  selectedSports.includes(sport.value) && styles.sportCardActive,
                ]}
                onPress={() => toggleSport(sport.value)}
              >
                <Ionicons
                  name={sport.icon as any}
                  size={32}
                  color={
                    selectedSports.includes(sport.value)
                      ? colors.primary[600]
                      : colors.gray[500]
                  }
                />
                <Text
                  style={[
                    styles.sportLabel,
                    selectedSports.includes(sport.value) && styles.sportLabelActive,
                  ]}
                >
                  {sport.label}
                </Text>
                {selectedSports.includes(sport.value) && (
                  <View style={styles.selectedBadge}>
                    <Ionicons name="checkmark-circle" size={20} color="white" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.helpText}>
            {selectedSports.length} sport(s) selected
          </Text>
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
          <Text style={styles.sectionTitle}>Amenities (Optional)</Text>
          <View style={styles.amenitiesGrid}>
            {AMENITIES_OPTIONS.map((amenity) => (
              <TouchableOpacity
                key={amenity}
                style={[
                  styles.amenityChip,
                  amenities.includes(amenity) && styles.amenityChipActive,
                ]}
                onPress={() => toggleAmenity(amenity)}
              >
                <Ionicons
                  name={amenities.includes(amenity) ? 'checkmark-circle' : 'add-circle-outline'}
                  size={18}
                  color={amenities.includes(amenity) ? colors.primary[600] : colors.gray[500]}
                />
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

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <Button
            text="Submit for Verification"
            onPress={handleSubmit}
            loading={loading}
            disabled={loading}
            fullWidth
          />
        </View>
      </ScrollView>

      {/* Map Picker Modal */}
      <MapPicker
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        initialLocation={selectedLocation}
        onLocationSelect={(location) => setSelectedLocation(location)}
      />
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    ...shadows.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primary[100],
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
    paddingHorizontal: spacing.lg,
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
    position: 'relative',
    ...shadows.sm,
  },
  sportCardActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
    ...shadows.md,
  },
  sportLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium,
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
    width: 120,
    height: 120,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[200],
  },
  removeImageBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.error[500],
    borderRadius: borderRadius.full,
    ...shadows.md,
  },
  addImageBtn: {
    width: 120,
    height: 120,
    backgroundColor: colors.primary[50],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary[600],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: typography.fontSize.xs,
    color: colors.primary[600],
    marginTop: spacing.xs,
    fontWeight: typography.fontWeight.semibold,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#fff',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.gray[300],
    ...shadows.sm,
  },
  amenityChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[600],
    ...shadows.md,
  },
  amenityText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  amenityTextActive: {
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  errorText: {
    fontSize: typography.fontSize.sm,
    color: colors.error[500],
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  submitContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing['2xl'],
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
    ...shadows.sm,
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
  // Sport Selection Badge
  selectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.primary[600],
    borderRadius: borderRadius.full,
    padding: 2,
  },
  helpText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
