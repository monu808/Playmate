import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../config/firebase';
import { signOut } from '../../lib/firebase/auth';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';

export default function AdminDashboardScreen({ navigation }: any) {
  const [stats, setStats] = useState({
    totalTurfs: 0,
    totalBookings: 0,
    totalUsers: 0,
    revenue: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      
      // Fetch turfs
      const turfsSnapshot = await db.collection('turfs').get();
      const totalTurfs = turfsSnapshot.size;
      
      // Fetch bookings
      const bookingsSnapshot = await db.collection('bookings').get();
      const totalBookings = bookingsSnapshot.size;
      
      // Calculate platform revenue from bookings (platform fees only)
      let revenue = 0;
      bookingsSnapshot.docs.forEach(doc => {
        const booking = doc.data();
        // Only count completed and confirmed bookings
        if ((booking.status === 'completed' || booking.status === 'confirmed') && booking.paymentBreakdown?.platformShare) {
          revenue += booking.paymentBreakdown.platformShare;
        }
      });
      
      // Fetch users
      const usersSnapshot = await db.collection('users').get();
      const totalUsers = usersSnapshot.size;
      
      setStats({
        totalTurfs,
        totalBookings,
        totalUsers,
        revenue,
      });
      
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const adminFeatures = [
    {
      id: 'scanner',
      title: 'QR Scanner',
      description: 'Verify booking check-ins',
      icon: 'qr-code',
      color: '#10b981',
      screen: 'ScanQR',
    },
    {
      id: 'turfs',
      title: 'Manage Turfs',
      description: 'Add, edit, or remove turfs',
      icon: 'football',
      color: colors.primary[600],
      screen: 'ManageTurfs',
    },
    {
      id: 'bookings',
      title: 'View Bookings',
      description: 'Manage all bookings',
      icon: 'calendar',
      color: '#3b82f6',
      screen: 'AdminBookings',
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'View and manage users',
      icon: 'people',
      color: '#8b5cf6',
      screen: 'ManageUsers',
    },
    {
      id: 'analytics',
      title: 'Analytics',
      description: 'View reports and insights',
      icon: 'stats-chart',
      color: '#f59e0b',
      screen: 'Analytics',
    },
  ];

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const result = await signOut();
            if (result.success) {
              // Navigation handled by auth state
            }
          },
        },
      ]
    );
  };

  const handleVerifyAllTurfs = async () => {
    Alert.alert(
      'Verify All Existing Turfs',
      'This will mark all existing turfs as verified. This is a one-time migration for turfs created before the verification system. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Verify All',
          onPress: async () => {
            try {
              // Get all turfs
              const turfsCol = collection(db, 'turfs');
              const snapshot = await getDocs(turfsCol);
              
              let updated = 0;
              let alreadyVerified = 0;
              
              // Update each turf
              for (const turfDoc of snapshot.docs) {
                const data = turfDoc.data();
                
                // Check if already verified
                if (data.isVerified === true) {
                  alreadyVerified++;
                  continue;
                }
                
                // Update to verified
                await updateDoc(doc(db, 'turfs', turfDoc.id), {
                  isVerified: true,
                  isActive: data.isActive !== undefined ? data.isActive : true,
                  verifiedAt: Timestamp.now(),
                  rejectionReason: null,
                });
                
                updated++;
              }
              
              Alert.alert(
                'Success!',
                `Migration complete!\n\n✅ Newly verified: ${updated}\n✓ Already verified: ${alreadyVerified}\n📊 Total turfs: ${snapshot.size}`,
                [{ text: 'OK' }]
              );
              
            } catch (error) {
              console.error('Migration error:', error);
              Alert.alert('Error', 'Failed to verify turfs. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Admin Dashboard</Text>
            <Text style={styles.subGreeting}>Manage your turf booking platform</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.refreshButton} 
              onPress={loadStats}
              disabled={loading}
            >
              <Ionicons 
                name="refresh" 
                size={24} 
                color={colors.primary[600]} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primary[100] }]}>
              <Ionicons name="football" size={24} color={colors.primary[600]} />
            </View>
            <Text style={styles.statValue}>{stats.totalTurfs}</Text>
            <Text style={styles.statLabel}>Total Turfs</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#dbeafe' }]}>
              <Ionicons name="calendar" size={24} color="#3b82f6" />
            </View>
            <Text style={styles.statValue}>{stats.totalBookings}</Text>
            <Text style={styles.statLabel}>Bookings</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#ede9fe' }]}>
              <Ionicons name="people" size={24} color="#8b5cf6" />
            </View>
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Users</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#fef3c7' }]}>
              <Ionicons name="cash" size={24} color="#f59e0b" />
            </View>
            <Text style={styles.statValue}>
              ₹{stats.revenue.toLocaleString('en-IN')}
            </Text>
            <Text style={styles.statLabel}>Platform Revenue</Text>
          </View>
        </View>

        {/* Admin Features */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Admin Features</Text>
          
          {adminFeatures.map((feature) => (
            <TouchableOpacity
              key={feature.id}
              style={styles.featureCard}
              onPress={() => navigation.navigate(feature.screen)}
            >
              <View style={[styles.featureIcon, { backgroundColor: feature.color + '20' }]}>
                <Ionicons name={feature.icon as any} size={28} color={feature.color} />
              </View>
              <View style={styles.featureContent}>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.gray[400]} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('AddTurf')}
          >
            <Ionicons name="add-circle" size={24} color="#ffffff" />
            <Text style={styles.actionButtonText}>Add New Turf</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#f59e0b' }]}
            onPress={() => navigation.navigate('PendingTurfs')}
          >
            <Ionicons name="time" size={24} color="#ffffff" />
            <Text style={styles.actionButtonText}>Verify Pending Turfs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#8b5cf6' }]}
            onPress={handleVerifyAllTurfs}
          >
            <Ionicons name="checkmark-done" size={24} color="#ffffff" />
            <Text style={styles.actionButtonText}>Verify All Existing Turfs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#3b82f6' }]}
            onPress={() => navigation.navigate('AdminBookings')}
          >
            <Ionicons name="calendar" size={24} color="#ffffff" />
            <Text style={styles.actionButtonText}>View Today's Bookings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  greeting: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  subGreeting: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  refreshButton: {
    padding: spacing.sm,
  },
  logoutButton: {
    padding: spacing.sm,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.md,
    elevation: 4,
  },
  statIconContainer: {
    width: 50,
    height: 50,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  featuresSection: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    ...shadows.md,
    elevation: 4,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  featureDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  quickActions: {
    padding: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginBottom: spacing.md,
    ...shadows.lg,
    elevation: 6,
  },
  actionButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: '#ffffff',
    marginLeft: spacing.sm,
  },
});
