import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { formatCurrency } from '../../lib/utils';
import { getOwnerStats } from '../../lib/firebase/owner';

interface DashboardStats {
  totalTurfs: number;
  activeTurfs: number;
  pendingVerification: number;
  todayBookings: number;
  todayRevenue: number;
  monthRevenue: number;
  totalRevenue: number;
  totalBookings: number;
}

export default function OwnerDashboardScreen({ navigation }: any) {
  const { user, userData } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalTurfs: 0,
    activeTurfs: 0,
    pendingVerification: 0,
    todayBookings: 0,
    todayRevenue: 0,
    monthRevenue: 0,
    totalRevenue: 0,
    totalBookings: 0,
  });

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    if (!user) return;
    
    try {
      const ownerStats = await getOwnerStats(user.uid);
      
      setStats({
        totalTurfs: ownerStats.turfs.total,
        activeTurfs: ownerStats.turfs.active,
        pendingVerification: ownerStats.turfs.pending,
        todayBookings: ownerStats.bookings.today,
        todayRevenue: ownerStats.revenue.today,
        monthRevenue: ownerStats.revenue.thisMonth,
        totalRevenue: ownerStats.revenue.total,
        totalBookings: ownerStats.bookings.total,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardStats();
    setRefreshing(false);
  };

  const quickActions = [
    {
      id: 'add-turf',
      title: 'Add New Turf',
      icon: 'add-circle',
      color: colors.primary[600],
      route: 'AddTurf',
    },
    {
      id: 'scan-qr',
      title: 'Scan QR',
      icon: 'qr-code-outline',
      color: '#10b981',
      route: 'OwnerScanQR',
    },
    {
      id: 'my-turfs',
      title: 'My Turfs',
      icon: 'football-outline',
      color: '#f59e0b',
      route: 'MyTurfs',
    },
    {
      id: 'bookings',
      title: 'Bookings',
      icon: 'calendar-outline',
      color: '#3b82f6',
      route: 'OwnerBookings',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary[600]}
          />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[colors.primary[600], colors.primary[700]]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.ownerName}>{userData?.displayName || user?.displayName || 'Owner'}</Text>
              <Text style={styles.businessName}>{userData?.businessName || 'Your Business'}</Text>
            </View>
            {/* TODO: Implement Notifications screen */}
            {/* <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color="#ffffff" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationCount}>3</Text>
              </View>
            </TouchableOpacity> */}
          </View>
        </LinearGradient>

        {/* Revenue Summary Card */}
        <View style={styles.section}>
          <View style={styles.revenueCard}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.revenueGradient}
            >
              <View style={styles.revenueHeader}>
                <Ionicons name="trending-up" size={32} color="#ffffff" />
                <Text style={styles.revenueLabel}>Total Revenue</Text>
              </View>
              <Text style={styles.revenueAmount}>{formatCurrency(stats.totalRevenue)}</Text>
              <View style={styles.revenueBreakdown}>
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueItemLabel}>Today</Text>
                  <Text style={styles.revenueItemValue}>
                    {formatCurrency(stats.todayRevenue)}
                  </Text>
                </View>
                <View style={styles.revenueDivider} />
                <View style={styles.revenueItem}>
                  <Text style={styles.revenueItemLabel}>This Month</Text>
                  <Text style={styles.revenueItemValue}>
                    {formatCurrency(stats.monthRevenue)}
                  </Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.section}>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#3b82f6' }]}>
                <Ionicons name="football" size={24} color="#ffffff" />
              </View>
              <Text style={styles.statValue}>{stats.activeTurfs}/{stats.totalTurfs}</Text>
              <Text style={styles.statLabel}>Active Turfs</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#fef3c7' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#f59e0b' }]}>
                <Ionicons name="time-outline" size={24} color="#ffffff" />
              </View>
              <Text style={styles.statValue}>{stats.pendingVerification}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#10b981' }]}>
                <Ionicons name="calendar" size={24} color="#ffffff" />
              </View>
              <Text style={styles.statValue}>{stats.todayBookings}</Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: '#e0e7ff' }]}>
              <View style={[styles.statIconContainer, { backgroundColor: '#6366f1' }]}>
                <Ionicons name="stats-chart" size={24} color="#ffffff" />
              </View>
              <Text style={styles.statValue}>{stats.totalBookings}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionCard}
                onPress={() => navigation.navigate(action.route)}
                activeOpacity={0.7}
              >
                <View style={[styles.actionIconContainer, { backgroundColor: action.color }]}>
                  <Ionicons name={action.icon as any} size={28} color="#ffffff" />
                </View>
                <Text style={styles.actionTitle}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('OwnerBookings')}>
              <Text style={styles.seeAllButton}>See All</Text>
            </TouchableOpacity>
          </View>
          
          {/* Placeholder for recent bookings */}
          <View style={styles.activityCard}>
            <Ionicons name="checkmark-circle" size={24} color="#10b981" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>New booking received</Text>
              <Text style={styles.activityTime}>5 minutes ago</Text>
            </View>
            <Text style={styles.activityAmount}>{formatCurrency(1500)}</Text>
          </View>

          <View style={styles.activityCard}>
            <Ionicons name="calendar-outline" size={24} color="#3b82f6" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Booking confirmed</Text>
              <Text style={styles.activityTime}>1 hour ago</Text>
            </View>
            <Text style={styles.activityAmount}>{formatCurrency(2000)}</Text>
          </View>

          <View style={styles.activityCard}>
            <Ionicons name="qr-code-outline" size={24} color="#10b981" />
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>QR verified successfully</Text>
              <Text style={styles.activityTime}>2 hours ago</Text>
            </View>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          </View>
        </View>

        <View style={{ height: 24 }} />
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  greeting: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: spacing.xs,
  },
  ownerName: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
    marginBottom: spacing.xs - 2,
  },
  businessName: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: typography.fontWeight.medium,
  },
  notificationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  section: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  revenueCard: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
    elevation: 8,
  },
  revenueGradient: {
    padding: spacing.xl,
  },
  revenueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  revenueLabel: {
    fontSize: typography.fontSize.base,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  revenueAmount: {
    fontSize: 36,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
    marginBottom: spacing.lg,
  },
  revenueBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  revenueItem: {
    flex: 1,
  },
  revenueItemLabel: {
    fontSize: typography.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: spacing.xs - 2,
  },
  revenueItemValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
  },
  revenueDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  statCard: {
    width: '48%',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginHorizontal: '1%',
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.md,
    elevation: 4,
  },
  statIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
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
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllButton: {
    fontSize: typography.fontSize.sm,
    color: colors.primary[600],
    fontWeight: typography.fontWeight.semibold,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  actionCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    marginHorizontal: '1%',
    marginBottom: spacing.md,
    alignItems: 'center',
    ...shadows.md,
    elevation: 4,
  },
  actionIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  actionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    ...shadows.sm,
    elevation: 2,
  },
  activityContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  activityTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.xs - 2,
  },
  activityTime: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  activityAmount: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
});
