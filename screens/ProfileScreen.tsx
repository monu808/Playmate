import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { AchievementBadge } from '../components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { BlurView } from 'expo-blur';
import { useNavigation } from '@react-navigation/native';
import auth from '@react-native-firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { getUserBookings } from '../lib/firebase/firestore';
import { updateUserProfile, uploadProfileImage } from '../lib/firebase/auth';
import { colors } from '../lib/theme';
import { LoadingSpinner } from '../components/ui';
import { SettingsModal } from '../components/SettingsModal';

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { user, userData, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [stats, setStats] = useState({
    spiritPoints: 0,
    upcomingBookings: 0,
    completedBookings: 0,
    sportsBreakdown: [] as Array<{ sport: string; count: number }>,
  });
  const [editMode, setEditMode] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState('Dashboard');
  const [displayName, setDisplayName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const profileModalAnim = useRef(new Animated.Value(0)).current;
  const profileContentAnim = useRef(new Animated.Value(1)).current;
  const profileTabs = ['Dashboard', 'Performance Matrix', 'Match History', 'Availability'];
  
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

  useEffect(() => {
    if (!profileModalVisible) return;

    profileContentAnim.setValue(0);
    Animated.timing(profileContentAnim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [activeProfileTab, editMode, profileModalVisible, profileContentAnim]);

  const loadUserStats = async () => {
    if (!user) return;

    try {
      const bookings = await getUserBookings(user.uid);
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const completedBookings = bookings.filter((b) => b.status === 'completed');

      const sportCountMap: Record<string, number> = {};
      completedBookings.forEach((booking) => {
        const rawSport = String(booking.sport || 'other').trim().toLowerCase();
        if (!rawSport) return;
        sportCountMap[rawSport] = (sportCountMap[rawSport] || 0) + 1;
      });

      const sportsBreakdown = Object.entries(sportCountMap)
        .map(([sport, count]) => ({
          sport: sport.charAt(0).toUpperCase() + sport.slice(1),
          count,
        }))
        .sort((a, b) => b.count - a.count);

      setStats({
        spiritPoints: Number(userData?.spiritPoints || 0),
        upcomingBookings: bookings.filter(
          (b) => b.status === 'confirmed' && b.date >= today
        ).length,
        completedBookings: completedBookings.length,
        sportsBreakdown,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const achievements = useMemo(() => {
    const totalEarnedPoints = Number(userData?.totalSpiritPointsEarned || stats.spiritPoints || 0);

    return [
      {
        key: 'first',
        title: 'First Match',
        subtitle: '1 completed',
        icon: 'flag-outline' as const,
        unlocked: stats.completedBookings >= 1,
      },
      {
        key: 'five',
        title: 'Team Regular',
        subtitle: '5 completed',
        icon: 'people-outline' as const,
        unlocked: stats.completedBookings >= 5,
      },
      {
        key: 'ten',
        title: 'Unstoppable',
        subtitle: '10 completed',
        icon: 'trophy-outline' as const,
        unlocked: stats.completedBookings >= 10,
      },
      {
        key: 'points',
        title: 'Point Collector',
        subtitle: '100 points earned',
        icon: 'sparkles-outline' as const,
        unlocked: totalEarnedPoints >= 100,
      },
    ];
  }, [stats.completedBookings, stats.spiritPoints, userData?.totalSpiritPointsEarned]);

  const resolvedDisplayName =
    displayName || userData?.name || userData?.displayName || user?.displayName || 'User';
  const profileBio = 'Plays weekly | Open to team invites';
  const totalMatches = stats.completedBookings + stats.upcomingBookings;
  const attendanceRate =
    totalMatches > 0 ? Math.min(99, Math.round((stats.completedBookings / totalMatches) * 100)) : 0;
  const latestFormCopy =
    stats.completedBookings >= 3
      ? `+${Math.min(24, 8 + stats.completedBookings)}% consistency in recent matches`
      : 'Complete more matches to unlock form insights';

  const openProfileModal = (startInEditMode: boolean = false) => {
    setEditMode(startInEditMode);
    setActiveProfileTab('Dashboard');
    setProfileModalVisible(true);
    profileModalAnim.setValue(0);

    Animated.spring(profileModalAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 17,
      mass: 0.7,
      stiffness: 180,
    }).start();
  };

  const closeProfileModal = () => {
    Animated.timing(profileModalAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        setProfileModalVisible(false);
        setEditMode(false);
      }
    });
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
              await auth().signOut();
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

    setSaving(true);
    try {
      const result = await updateUserProfile(user.uid, {
        name: displayName,
        phoneNumber: phoneNumber,
      });

      if (result.success) {
        // Refresh user data in context so UI updates
        await refreshUserData();
        setEditMode(false);
        // Use setTimeout to ensure state updates are processed before showing alert
        setTimeout(() => {
          Alert.alert('Success', 'Profile updated successfully!');
        }, 100);
      } else {
        Alert.alert('Error', result.error || 'Failed to update profile');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
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

  const modalCardScale = profileModalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1],
  });

  const modalCardTranslateY = profileModalAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [26, 0],
  });

  const profileContentTranslateY = profileContentAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [14, 0],
  });

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
            onPress={() => openProfileModal(true)}
          >
            <Ionicons
              name="pencil"
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>
        </View>

        {/* Collapsed Profile Card */}
        <TouchableOpacity style={styles.profileSection} activeOpacity={0.92} onPress={() => openProfileModal(false)}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarContainer}>
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
                <Ionicons name="camera" size={16} color="#ffffff" />
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.spiritPoints}</Text>
                <Text style={styles.statLabel}>Spirit Points</Text>
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

          <View style={styles.infoContainer}>
            <Text style={styles.userName}>{resolvedDisplayName}</Text>
            <Text style={styles.userBio}>{profileBio}</Text>
          </View>
        </TouchableOpacity>

        {/* Menu Options */}
        <View style={styles.menuSection}>
          <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ReviewsGiven')}>
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="star-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Venue Reviews Given</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('PaymentHistory')}
          >
            <View style={styles.menuItemLeft}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="card-outline" size={22} color="#111827" />
              </View>
              <Text style={styles.menuItemText}>Payment Flow & History</Text>
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

      <Modal
        visible={profileModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeProfileModal}
      >
        <View style={styles.profileModalRoot}>
          <Animated.View style={[styles.profileModalBackdrop, { opacity: profileModalAnim }]}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          </Animated.View>

          <View style={styles.profileModalContentWrap} pointerEvents="box-none">
            <Animated.View
              style={[
                styles.profileModalCard,
                {
                  opacity: profileModalAnim,
                  transform: [{ scale: modalCardScale }, { translateY: modalCardTranslateY }],
                },
              ]}
            >
              <View style={styles.profileModalHeader}>
                <View style={styles.profileModalHeaderCopy}>
                  <Text style={styles.profileModalTitle}>Your Profile</Text>
                  <Text style={styles.profileModalSubtitle}>
                    {editMode ? 'Edit your details' : 'Stats, achievements, and activity'}
                  </Text>
                </View>

                <TouchableOpacity style={styles.profileModalCloseButton} onPress={closeProfileModal}>
                  <Ionicons name="close" size={20} color="#111827" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.profileModalScrollView}
                contentContainerStyle={styles.profileModalBody}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.profileIdentityBlock}>
                  <TouchableOpacity
                    style={styles.profileIdentityAvatarWrap}
                    onPress={handleSelectImage}
                    activeOpacity={0.85}
                  >
                    {(userData?.photoURL || user?.photoURL) ? (
                      <Image
                        source={{ uri: (userData?.photoURL || user?.photoURL) as string }}
                        style={[styles.avatarImage, styles.profileIdentityAvatarImage]}
                        contentFit="cover"
                        transition={300}
                      />
                    ) : (
                      <View style={[styles.avatar, styles.profileIdentityAvatar]}>
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

                  <Text style={styles.profileIdentityName}>{resolvedDisplayName}</Text>
                  <Text style={styles.profileIdentityMeta}>{profileBio}</Text>
                </View>

                <View style={styles.profileHeadlineStats}>
                  <View style={styles.profileHeadlineStatBlock}>
                    <Text style={styles.profileHeadlineStatLabel}>Matches</Text>
                    <Text style={styles.profileHeadlineStatValue}>{totalMatches}</Text>
                  </View>
                  <View style={styles.profileHeadlineStatBlock}>
                    <Text style={styles.profileHeadlineStatLabel}>Spirit</Text>
                    <Text style={styles.profileHeadlineStatValue}>{stats.spiritPoints}</Text>
                  </View>
                  <View style={[styles.profileHeadlineStatBlock, styles.profileHeadlineStatBlockLast]}>
                    <Text style={styles.profileHeadlineStatLabel}>Played</Text>
                    <Text style={styles.profileHeadlineStatValue}>{stats.completedBookings}</Text>
                  </View>
                </View>

                <Animated.View
                  style={[
                    styles.profileAnimatedContent,
                    {
                      opacity: profileContentAnim,
                      transform: [{ translateY: profileContentTranslateY }],
                    },
                  ]}
                >
                  {editMode ? (
                    <View style={styles.profileEditPanel}>
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
                        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                        onPress={handleSaveProfile}
                        disabled={saving}
                      >
                        {saving ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.saveButtonText}>Save Changes</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <View style={styles.profileTabsStrip}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={styles.profileTabsRow}>
                            {profileTabs.map((tab) => {
                              const isActive = activeProfileTab === tab;

                              return (
                                <TouchableOpacity
                                  key={tab}
                                  style={styles.profileTabButton}
                                  onPress={() => setActiveProfileTab(tab)}
                                  activeOpacity={0.85}
                                >
                                  <Text style={[styles.profileTabLabel, isActive && styles.profileTabLabelActive]}>
                                    {tab}
                                  </Text>
                                  {isActive ? <View style={styles.profileTabUnderline} /> : null}
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </ScrollView>
                      </View>

                      {activeProfileTab === 'Dashboard' ? (
                        <View style={styles.profileDashboardStack}>
                          <View style={styles.profileInsightCard}>
                            <View style={styles.profileInsightIconWrap}>
                              <Ionicons name="trending-up" size={20} color={colors.primary[600]} />
                            </View>
                            <View style={styles.profileInsightTextWrap}>
                              <Text style={styles.profileInsightTitle}>Latest Form</Text>
                              <Text style={styles.profileInsightCopy}>{latestFormCopy}</Text>
                            </View>
                          </View>

                          <View style={styles.profileReliabilityCard}>
                            <View style={styles.profileReliabilityCopyWrap}>
                              <Text style={styles.profileReliabilityTitle}>Reliability</Text>
                              <Text style={styles.profileReliabilityCopy}>Attendance to confirmed sessions</Text>
                            </View>

                            <View style={styles.profileReliabilityScoreRing}>
                              <Text style={styles.profileReliabilityScoreText}>{attendanceRate}%</Text>
                            </View>
                          </View>

                          <View style={styles.achievementSection}>
                            <Text style={styles.sectionHeading}>Achievements</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementsRow}>
                              {achievements.map((achievement) => (
                                <AchievementBadge
                                  key={achievement.key}
                                  title={achievement.title}
                                  subtitle={achievement.subtitle}
                                  unlocked={achievement.unlocked}
                                  icon={achievement.icon}
                                />
                              ))}
                            </ScrollView>
                          </View>

                          <View style={styles.sportsSection}>
                            <Text style={styles.sectionHeading}>Your Sports</Text>
                            {stats.sportsBreakdown.length === 0 ? (
                              <Text style={styles.emptySportsText}>Complete a match to start tracking sport stats.</Text>
                            ) : (
                              <View style={styles.sportsChipsRow}>
                                {stats.sportsBreakdown.slice(0, 3).map((entry) => (
                                  <View key={entry.sport} style={styles.sportChip}>
                                    <Text style={styles.sportChipLabel}>{entry.sport}</Text>
                                    <Text style={styles.sportChipValue}>{entry.count}</Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>

                          <View style={styles.profileMetaSection}>
                            {!!(userData?.email || user?.email) ? (
                              <View style={styles.profileMetaRow}>
                                <Ionicons name="mail-outline" size={15} color={colors.primary[600]} />
                                <Text style={styles.profileMetaValue}>{userData?.email || user?.email}</Text>
                              </View>
                            ) : null}
                            {!!(phoneNumber || userData?.phoneNumber) ? (
                              <View style={styles.profileMetaRow}>
                                <Ionicons name="call-outline" size={15} color={colors.primary[600]} />
                                <Text style={styles.profileMetaValue}>{phoneNumber || userData?.phoneNumber}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      ) : (
                        <View style={styles.profileTabPlaceholderCard}>
                          <Text style={styles.profileTabPlaceholderTitle}>{activeProfileTab}</Text>
                          <Text style={styles.profileTabPlaceholderCopy}>
                            Detailed {activeProfileTab.toLowerCase()} insights are coming soon.
                          </Text>
                        </View>
                      )}
                    </>
                  )}
                </Animated.View>
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      </Modal>

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
          Cancellations made 1 hour or more before the booking start time are eligible for a full
          refund to the original payment source. Cancellations within 1 hour incur a ₹30 charge,
          where ₹25 goes to the turf owner and ₹5 is retained by Playmate.
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
  achievementSection: {
    width: '100%',
    marginTop: 16,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  achievementsRow: {
    paddingRight: 8,
  },
  sportsSection: {
    width: '100%',
    marginTop: 14,
  },
  sportsChipsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sportChip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  sportChipLabel: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  sportChipValue: {
    color: '#14532d',
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
  },
  emptySportsText: {
    color: '#6b7280',
    fontSize: 13,
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
  profileModalRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  profileModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  profileModalContentWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  profileModalCard: {
    width: '100%',
    height: '84%',
    minHeight: 460,
    maxHeight: '88%',
    backgroundColor: '#fdfdfd',
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 18,
  },
  profileModalHeader: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  profileModalHeaderCopy: {
    flex: 1,
    marginRight: 8,
  },
  profileModalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111111',
  },
  profileModalSubtitle: {
    marginTop: 1,
    fontSize: 12,
    color: '#3a3a3c',
    lineHeight: 16,
  },
  profileModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
  },
  profileModalScrollView: {
    flex: 1,
  },
  profileModalBody: {
    flexGrow: 1,
    padding: 16,
    paddingTop: 14,
    paddingBottom: 26,
  },
  profileAnimatedContent: {
    marginTop: 2,
  },
  profileIdentityBlock: {
    alignItems: 'center',
    paddingVertical: 6,
    marginBottom: 14,
  },
  profileIdentityAvatarWrap: {
    marginBottom: 10,
  },
  profileIdentityAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  profileIdentityAvatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  profileIdentityName: {
    fontSize: 29,
    fontWeight: '700',
    color: '#111111',
    letterSpacing: 0.2,
  },
  profileIdentityMeta: {
    marginTop: 4,
    fontSize: 14,
    color: '#3a3a3c',
    textAlign: 'center',
  },
  profileHeadlineStats: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    marginBottom: 16,
  },
  profileHeadlineStatBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: '#e5e5ea',
  },
  profileHeadlineStatBlockLast: {
    borderRightWidth: 0,
  },
  profileHeadlineStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#3a3a3c',
    marginBottom: 3,
  },
  profileHeadlineStatValue: {
    fontSize: 29,
    fontWeight: '600',
    color: '#111111',
  },
  profileTabsStrip: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
    marginBottom: 16,
  },
  profileTabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 22,
    paddingHorizontal: 2,
  },
  profileTabButton: {
    paddingBottom: 10,
    minWidth: 70,
  },
  profileTabLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  profileTabLabelActive: {
    color: '#111111',
    fontWeight: '700',
  },
  profileTabUnderline: {
    marginTop: 8,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#16a34a',
  },
  profileDashboardStack: {
    gap: 14,
  },
  profileInsightCard: {
    borderWidth: 1,
    borderColor: '#e5e5ea',
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
  },
  profileInsightIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInsightTextWrap: {
    flex: 1,
  },
  profileInsightTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  profileInsightCopy: {
    marginTop: 3,
    fontSize: 12,
    color: '#3a3a3c',
  },
  profileReliabilityCard: {
    borderWidth: 1,
    borderColor: '#e5e5ea',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 12,
  },
  profileReliabilityCopyWrap: {
    flex: 1,
  },
  profileReliabilityTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111111',
  },
  profileReliabilityCopy: {
    marginTop: 2,
    fontSize: 12,
    color: '#3a3a3c',
  },
  profileReliabilityScoreRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 4,
    borderColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
  },
  profileReliabilityScoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111111',
  },
  profileEditPanel: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5ea',
    padding: 14,
    borderRadius: 12,
  },
  profileTabPlaceholderCard: {
    borderWidth: 1,
    borderColor: '#e5e5ea',
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 12,
  },
  profileTabPlaceholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111111',
  },
  profileTabPlaceholderCopy: {
    marginTop: 6,
    fontSize: 13,
    color: '#3a3a3c',
  },
  profileHeroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dcfce7',
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  profileHeroAvatarWrap: {
    marginBottom: 10,
  },
  profileHeroAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  profileHeroAvatarImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
  },
  profileHeroName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  profileHeroBio: {
    marginTop: 2,
    fontSize: 13,
    color: '#4b5563',
    textAlign: 'center',
  },
  profileHeroMetaPill: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  profileHeroMetaText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '600',
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  profileStatCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingVertical: 12,
  },
  profileStatNumber: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111827',
  },
  profileStatLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  profileTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
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
    textAlign: 'center',
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
  profileMetaSection: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    padding: 14,
    gap: 10,
  },
  profileMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileMetaValue: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  saveButtonDisabled: {
    opacity: 0.7,
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
