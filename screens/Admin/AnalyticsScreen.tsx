import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getTurfs, getAllBookings } from '../../lib/firebase/firestore';
import { LoadingSpinner } from '../../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { formatCurrency } from '../../lib/utils';

export default function AnalyticsScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    platformRevenue: 0,
    totalRevenue: 0,
    totalBookings: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    pendingBookings: 0,
    completedBookings: 0,
    totalTurfs: 0,
    activeTurfs: 0,
  });

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [turfs, bookings] = await Promise.all([
        getTurfs(),
        getAllBookings(),
      ]);

      // Calculate total revenue (what users paid)
      const totalRevenue = bookings
        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

      // Calculate platform revenue (platform fees only)
      const platformRevenue = bookings
        .filter((b) => b.status === 'confirmed' || b.status === 'completed')
        .reduce((sum, b) => sum + (b.paymentBreakdown?.platformShare || 0), 0);

      setStats({
        platformRevenue,
        totalRevenue,
        totalBookings: bookings.length,
        confirmedBookings: bookings.filter((b) => b.status === 'confirmed').length,
        cancelledBookings: bookings.filter((b) => b.status === 'cancelled').length,
        pendingBookings: bookings.filter((b) => b.status === 'pending').length,
        completedBookings: bookings.filter((b) => b.status === 'completed').length,
        totalTurfs: turfs.length,
        activeTurfs: turfs.filter((t) => t.isActive !== false).length,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
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
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadAnalytics}>
          <Ionicons name="refresh" size={24} color={colors.primary[600]} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Revenue Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Revenue Overview</Text>
          
          {/* Platform Revenue Card */}
          <View style={styles.revenueCard}>
            <Ionicons name="cash" size={48} color={colors.primary[600]} />
            <View style={styles.revenueContent}>
              <Text style={styles.revenueLabel}>Platform Revenue (Fees)</Text>
              <Text style={styles.revenueValue}>
                {formatCurrency(stats.platformRevenue)}
              </Text>
            </View>
          </View>

          {/* Total Revenue Card */}
          <View style={[styles.revenueCard, { marginTop: spacing.md }]}>
            <Ionicons name="trending-up" size={48} color="#10b981" />
            <View style={styles.revenueContent}>
              <Text style={styles.revenueLabel}>Total Bookings Value</Text>
              <Text style={[styles.revenueValue, { color: '#10b981' }]}>
                {formatCurrency(stats.totalRevenue)}
              </Text>
            </View>
          </View>
        </View>

        {/* Bookings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bookings Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: colors.primary[100] }]}>
                <Ionicons name="calendar" size={24} color={colors.primary[600]} />
              </View>
              <Text style={styles.statValue}>{stats.totalBookings}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#dbeafe' }]}>
                <Ionicons name="checkmark-circle" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.statValue}>{stats.confirmedBookings}</Text>
              <Text style={styles.statLabel}>Confirmed</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#dcfce7' }]}>
                <Ionicons name="checkmark-done-circle" size={24} color="#10b981" />
              </View>
              <Text style={styles.statValue}>{stats.completedBookings}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="time" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.statValue}>{stats.pendingBookings}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>

            <View style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: '#fee2e2' }]}>
                <Ionicons name="close-circle" size={24} color={colors.error} />
              </View>
              <Text style={styles.statValue}>{stats.cancelledBookings}</Text>
              <Text style={styles.statLabel}>Cancelled</Text>
            </View>
          </View>
        </View>

        {/* Turfs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Turfs Overview</Text>
          <View style={styles.turfStats}>
            <View style={styles.turfStatCard}>
              <Ionicons name="football" size={32} color={colors.primary[600]} />
              <View style={styles.turfStatContent}>
                <Text style={styles.turfStatValue}>{stats.totalTurfs}</Text>
                <Text style={styles.turfStatLabel}>Total Turfs</Text>
              </View>
            </View>
            <View style={styles.turfStatCard}>
              <Ionicons name="checkmark-done" size={32} color="#10b981" />
              <View style={styles.turfStatContent}>
                <Text style={styles.turfStatValue}>{stats.activeTurfs}</Text>
                <Text style={styles.turfStatLabel}>Active Turfs</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Insights */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Insights</Text>
          <View style={styles.insightCard}>
            <Ionicons name="trending-up" size={24} color={colors.primary[600]} />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Booking Success Rate</Text>
              <Text style={styles.insightValue}>
                {stats.totalBookings > 0
                  ? Math.round(
                      ((stats.confirmedBookings + stats.completedBookings) /
                        stats.totalBookings) *
                        100
                    )
                  : 0}
                %
              </Text>
            </View>
          </View>

          <View style={styles.insightCard}>
            <Ionicons name="stats-chart" size={24} color="#3b82f6" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Average Platform Fee per Booking</Text>
              <Text style={styles.insightValue}>
                {formatCurrency(
                  stats.totalBookings > 0
                    ? Math.round(stats.platformRevenue / stats.totalBookings)
                    : 0
                )}
              </Text>
            </View>
          </View>

          <View style={styles.insightCard}>
            <Ionicons name="wallet" size={24} color="#f59e0b" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Average Booking Value</Text>
              <Text style={styles.insightValue}>
                {formatCurrency(
                  stats.totalBookings > 0
                    ? Math.round(stats.totalRevenue / stats.totalBookings)
                    : 0
                )}
              </Text>
            </View>
          </View>

          <View style={styles.insightCard}>
            <Ionicons name="pulse" size={24} color="#10b981" />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>Active Turfs Rate</Text>
              <Text style={styles.insightValue}>
                {stats.totalTurfs > 0
                  ? Math.round((stats.activeTurfs / stats.totalTurfs) * 100)
                  : 0}
                %
              </Text>
            </View>
          </View>
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
  refreshButton: {
    padding: spacing.sm,
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  revenueCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.lg,
  },
  revenueContent: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  revenueLabel: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  revenueValue: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  },
  statIcon: {
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
    textAlign: 'center',
  },
  turfStats: {
    gap: spacing.md,
  },
  turfStatCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    ...shadows.md,
  },
  turfStatContent: {
    marginLeft: spacing.lg,
  },
  turfStatValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  turfStatLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  insightCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: spacing.lg,
    borderRadius: borderRadius.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  insightContent: {
    marginLeft: spacing.md,
    flex: 1,
  },
  insightTitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
  },
  insightValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
});
