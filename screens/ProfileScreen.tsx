import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { getUserBookings } from '../lib/firebase/firestore';
import { updateUserProfile, uploadProfileImage } from '../lib/firebase/auth';
import { LoadingSpinner } from '../components/ui';
import { SettingsModal } from '../components/SettingsModal';
import { theme } from '../lib/theme';

const ProfileScreen: React.FC = () => {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    completedBookings: 0,
  });
  const [editMode, setEditMode] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Modal states
  const [notificationsModal, setNotificationsModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [helpModal, setHelpModal] = useState(false);
  const [termsModal, setTermsModal] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);
  
  // Notification settings
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  useEffect(() => {
    if (userData) {
      setDisplayName(userData.name || '');
      setPhoneNumber(userData.phoneNumber || '');
      loadUserStats();
    }
  }, [userData]);

  const loadUserStats = async () => {
    if (!user) return;

    try {
      const bookings = await getUserBookings(user.uid);
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      setStats({
        totalBookings: bookings.length,
        upcomingBookings: bookings.filter(
          (b) => b.status === 'confirmed' && b.date >= today
        ).length,
        completedBookings: bookings.filter(
          (b) => b.status === 'completed'
        ).length,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              // Navigation will be handled by AuthContext
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await updateUserProfile(user.uid, {
        name: displayName,
        phoneNumber: phoneNumber,
      });

      if (result.success) {
        setEditMode(false);
        Alert.alert('Success', 'Profile updated successfully!');
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectImage = async () => {
    if (!user) return;

    // Show options: Take Photo or Choose from Library
    Alert.alert(
      'Update Profile Picture',
      'Choose how you want to update your profile picture',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert(
                'Permission Required',
                'Please grant camera permissions to take a photo.'
              );
              return;
            }

            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              uploadImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              Alert.alert(
                'Permission Required',
                'Please grant gallery permissions to select a photo.'
              );
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
              uploadImage(result.assets[0].uri);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;
    
    setUploadingImage(true);
    try {
      const uploadResult = await uploadProfileImage(user.uid, uri);
      if (uploadResult.success) {
        Alert.alert('Success', 'Profile picture updated successfully!');
      } else {
        Alert.alert('Error', uploadResult.error || 'Failed to upload image');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setUploadingImage(false);
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
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Green Header */}
        <View style={styles.greenHeader}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setEditMode(!editMode)}
          >
            <Ionicons
              name={editMode ? 'close' : 'pencil'}
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>
        </View>

        {/* Profile Info with Inline Stats */}
        <View style={styles.profileSection}>
          <View style={styles.profileTopRow}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              <TouchableOpacity onPress={handleSelectImage} activeOpacity={0.8}>
                {(userData?.photoURL || user?.photoURL) ? (
                  <Image
                    source={{ uri: (userData?.photoURL || user?.photoURL) as string }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={300}
                  />
                ) : (
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(userData?.name || user?.email || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.cameraButton}>
                  {uploadingImage ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="camera" size={16} color="#ffffff" />
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.totalBookings}</Text>
                <Text style={styles.statLabel}>Bookings</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.upcomingBookings}</Text>
                <Text style={styles.statLabel}>Matches</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.completedBookings}</Text>
                <Text style={styles.statLabel}>Played</Text>
              </View>
            </View>
          </View>

          {/* User Info */}
          <View style={styles.infoContainer}>
            {editMode ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Enter your name"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <TextInput
                    style={styles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Enter phone number"
                    placeholderTextColor="#9ca3af"
                    keyboardType="phone-pad"
                  />
                </View>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveProfile}
                >
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.userName}>
                  {userData?.name || user?.displayName || 'User'}
                </Text>
                <Text style={styles.userBio}>
                  Plays weekly | Open to team invites
                </Text>
                {editMode && (
                  <TouchableOpacity style={styles.editIconButton}>
                    <Ionicons name="pencil" size={16} color="#6b7280" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </View>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="calendar-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Upcoming Bookings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="people-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Team Invites</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="star-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Venue Reviews Given</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="time-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Booking History</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setHelpModal(true)}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="help-circle-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuItem}
            onPress={() => setAboutModal(true)}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="settings-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={handleLogout}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIconContainer, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              </View>
              <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Logout</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modals */}
      <SettingsModal
        visible={notificationsModal}
        onClose={() => setNotificationsModal(false)}
        title="Notifications"
        icon="notifications"
      >
        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive booking confirmations and updates
            </Text>
          </View>
          <Switch
            value={pushNotifications}
            onValueChange={setPushNotifications}
            trackColor={{ false: '#d1d5db', true: '#86efac' }}
            thumbColor={pushNotifications ? '#16a34a' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Email Notifications</Text>
            <Text style={styles.settingDescription}>
              Get email updates about your bookings
            </Text>
          </View>
          <Switch
            value={emailNotifications}
            onValueChange={setEmailNotifications}
            trackColor={{ false: '#d1d5db', true: '#86efac' }}
            thumbColor={emailNotifications ? '#16a34a' : '#f3f4f6'}
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>SMS Notifications</Text>
            <Text style={styles.settingDescription}>
              Receive SMS alerts for bookings
            </Text>
          </View>
          <Switch
            value={smsNotifications}
            onValueChange={setSmsNotifications}
            trackColor={{ false: '#d1d5db', true: '#86efac' }}
            thumbColor={smsNotifications ? '#16a34a' : '#f3f4f6'}
          />
        </View>
      </SettingsModal>

      <SettingsModal
        visible={paymentModal}
        onClose={() => setPaymentModal(false)}
        title="Payment Methods"
        icon="card"
      >
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color="#3b82f6" />
          <Text style={styles.infoText}>
            Payment methods are managed through Razorpay. You can add or update your payment
            information during checkout.
          </Text>
        </View>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="card-outline" size={20} color="#16a34a" />
          <Text style={styles.actionButtonText}>Manage Cards</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="wallet-outline" size={20} color="#16a34a" />
          <Text style={styles.actionButtonText}>UPI & Wallets</Text>
        </TouchableOpacity>
      </SettingsModal>

      <SettingsModal
        visible={helpModal}
        onClose={() => setHelpModal(false)}
        title="Help & Support"
        icon="help-circle"
      >
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="mail-outline" size={20} color="#16a34a" />
          <Text style={styles.actionButtonText}>Email Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="call-outline" size={20} color="#16a34a" />
          <Text style={styles.actionButtonText}>Call Us</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="chatbubble-outline" size={20} color="#16a34a" />
          <Text style={styles.actionButtonText}>Live Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="document-text-outline" size={20} color="#16a34a" />
          <Text style={styles.actionButtonText}>FAQs</Text>
        </TouchableOpacity>
      </SettingsModal>

      <SettingsModal
        visible={termsModal}
        onClose={() => setTermsModal(false)}
        title="Terms & Privacy"
        icon="document-text"
      >
        <Text style={styles.modalSectionTitle}>Terms of Service</Text>
        <Text style={styles.modalText}>
          By using Playmate, you agree to our terms of service. We provide a platform for
          booking sports turfs and facilities. All bookings are subject to availability and
          confirmation.
        </Text>
        <Text style={styles.modalSectionTitle}>Privacy Policy</Text>
        <Text style={styles.modalText}>
          We respect your privacy and protect your personal information. Your data is used
          only for booking purposes and will never be shared with third parties without your
          consent.
        </Text>
        <Text style={styles.modalSectionTitle}>Refund Policy</Text>
        <Text style={styles.modalText}>
          Cancellations made 24 hours before the booking time are eligible for a full refund.
          Cancellations within 24 hours may incur a cancellation fee.
        </Text>
      </SettingsModal>

      <SettingsModal
        visible={aboutModal}
        onClose={() => setAboutModal(false)}
        title="About Playmate"
        icon="information-circle"
      >
        <View style={styles.aboutSection}>
          <Text style={styles.appName}>🏟️ Playmate</Text>
          <Text style={styles.appVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>
            Playmate is your one-stop solution for booking sports turfs and facilities.
            Find and book the perfect venue for football, cricket, basketball, badminton,
            and more!
          </Text>
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              <Text style={styles.featureText}>Easy booking process</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              <Text style={styles.featureText}>Secure payments</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              <Text style={styles.featureText}>Real-time availability</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
              <Text style={styles.featureText}>24/7 support</Text>
            </View>
          </View>
          <Text style={styles.copyright}>
            © 2025 Playmate. All rights reserved.
          </Text>
        </View>
      </SettingsModal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  greenHeader: {
    backgroundColor: '#16a34a',
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    height: 150,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    backgroundColor: '#ffffffff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  editButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  profileSection: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    margin: 16,
    marginTop: -40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e5e7eb',
  },
  infoContainer: {
    width: '100%',
    alignItems: 'center',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  userBio: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  editIconButton: {
    marginTop: 8,
    padding: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  menuSection: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    margin: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#ebebebff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  // Modal content styles
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1eb819ff',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffffff',
    borderRadius: 12,
    marginBottom: 16,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  modalText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 22,
    marginBottom: 16,
  },
  aboutSection: {
    alignItems: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#16a34a',
    marginBottom: 8,
  },
  appVersion: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  aboutText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  featureList: {
    width: '100%',
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
  },
  copyright: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 16,
  },
});

export default ProfileScreen;
