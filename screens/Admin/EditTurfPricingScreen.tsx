import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '../../components/ui';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { getTurfById, updateTurf } from '../../lib/firebase/firestore';
import { resolveTurfPricing } from '../../lib/utils';

export default function AdminEditTurfPricingScreen({ navigation, route }: any) {
  const turfId = route?.params?.turfId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [turfName, setTurfName] = useState('');

  const [dayPricePerHour, setDayPricePerHour] = useState('');
  const [nightPricePerHour, setNightPricePerHour] = useState('');
  const [dynamicPricingEnabled, setDynamicPricingEnabled] = useState(true);
  const [manualActivePeriod, setManualActivePeriod] = useState<'day' | 'night'>('day');
  const [happyHourEnabled, setHappyHourEnabled] = useState(true);
  const [happyHourDiscountPercent, setHappyHourDiscountPercent] = useState('30');

  const loadTurf = useCallback(async () => {
    if (!turfId) {
      Alert.alert('Error', 'Missing turf information');
      navigation.goBack();
      return;
    }

    try {
      setLoading(true);
      const turf = await getTurfById(turfId);
      if (!turf) {
        Alert.alert('Error', 'Turf not found');
        navigation.goBack();
        return;
      }

      const pricing = resolveTurfPricing(turf, '10:00');
      setTurfName(turf.name || 'Turf');
      setDayPricePerHour(String(pricing.dayPricePerHour || ''));
      setNightPricePerHour(String(pricing.nightPricePerHour || ''));
      setDynamicPricingEnabled(pricing.dynamicPricingEnabled);
      setManualActivePeriod(pricing.manualActivePeriod);
      setHappyHourEnabled(turf.happyHourEnabled ?? true);
      setHappyHourDiscountPercent(String(turf.happyHourDiscountPercent ?? 30));
    } catch (error) {
      Alert.alert('Error', 'Unable to load turf pricing');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [turfId, navigation]);

  useEffect(() => {
    loadTurf();
  }, [loadTurf]);

  const handleSave = async () => {
    const dayPrice = parseFloat(dayPricePerHour);
    const nightPrice = parseFloat(nightPricePerHour);
    const happyHourDiscount = parseFloat(happyHourDiscountPercent);

    if (!dayPricePerHour || !nightPricePerHour || Number.isNaN(dayPrice) || Number.isNaN(nightPrice)) {
      Alert.alert('Error', 'Please enter valid day and night prices');
      return;
    }

    if (dayPrice <= 0 || nightPrice <= 0) {
      Alert.alert('Error', 'Day and night prices must be greater than zero');
      return;
    }

    if (Number.isNaN(happyHourDiscount) || happyHourDiscount <= 0 || happyHourDiscount > 90) {
      Alert.alert('Error', 'Happy Hour discount must be between 1% and 90%');
      return;
    }

    const effectivePricePerHour = dynamicPricingEnabled
      ? dayPrice
      : manualActivePeriod === 'night'
      ? nightPrice
      : dayPrice;

    try {
      setSaving(true);
      const result = await updateTurf(turfId, {
        dayPricePerHour: dayPrice,
        nightPricePerHour: nightPrice,
        dynamicPricingEnabled,
        dynamicBoundaryTime: '18:00',
        manualActivePeriod,
        happyHourEnabled,
        happyHourDiscountPercent: happyHourDiscount,
        happyHourStartTime: '11:00',
        happyHourEndTime: '16:00',
        happyHourLeadTimeMinutes: 120,
        pricePerHour: effectivePricePerHour,
        price: effectivePricePerHour,
      } as any);

      if (!result.success) {
        Alert.alert('Error', result.error || 'Failed to update pricing');
        return;
      }

      Alert.alert('Success', 'Turf pricing updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary[600]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Edit Pricing</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.turfName}>{turfName}</Text>
          <Text style={styles.subtitle}>Admin override for turf day/night pricing</Text>

          <Input
            label="Day Price per Hour (₹)"
            placeholder="e.g., 500"
            value={dayPricePerHour}
            onChangeText={setDayPricePerHour}
            keyboardType="numeric"
            required
          />

          <Input
            label="Night Price per Hour (₹)"
            placeholder="e.g., 700"
            value={nightPricePerHour}
            onChangeText={setNightPricePerHour}
            keyboardType="numeric"
            required
          />

          <View style={styles.dynamicToggleRow}>
            <View style={styles.dynamicToggleContent}>
              <Text style={styles.dynamicToggleLabel}>Dynamic Day/Night Pricing</Text>
              <Text style={styles.dynamicToggleHint}>Auto switches at 18:00 based on booking start time</Text>
            </View>
            <Switch
              value={dynamicPricingEnabled}
              onValueChange={setDynamicPricingEnabled}
              trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
              thumbColor={dynamicPricingEnabled ? colors.primary[600] : colors.gray[500]}
            />
          </View>

          {!dynamicPricingEnabled && (
            <View style={styles.manualPeriodContainer}>
              <Text style={styles.manualPeriodTitle}>Manual Active Period</Text>
              <View style={styles.manualPeriodRow}>
                <TouchableOpacity
                  style={[
                    styles.manualPeriodChip,
                    manualActivePeriod === 'day' && styles.manualPeriodChipActive,
                  ]}
                  onPress={() => setManualActivePeriod('day')}
                >
                  <Text
                    style={[
                      styles.manualPeriodText,
                      manualActivePeriod === 'day' && styles.manualPeriodTextActive,
                    ]}
                  >
                    Day Rate Active
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.manualPeriodChip,
                    manualActivePeriod === 'night' && styles.manualPeriodChipActive,
                  ]}
                  onPress={() => setManualActivePeriod('night')}
                >
                  <Text
                    style={[
                      styles.manualPeriodText,
                      manualActivePeriod === 'night' && styles.manualPeriodTextActive,
                    ]}
                  >
                    Night Rate Active
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.dynamicToggleRow}>
            <View style={styles.dynamicToggleContent}>
              <Text style={styles.dynamicToggleLabel}>Happy Hour Auto Discount</Text>
              <Text style={styles.dynamicToggleHint}>
                Applies for 11:00-16:00 slots when booked within 2 hours
              </Text>
            </View>
            <Switch
              value={happyHourEnabled}
              onValueChange={setHappyHourEnabled}
              trackColor={{ false: colors.gray[300], true: colors.primary[200] }}
              thumbColor={happyHourEnabled ? colors.primary[600] : colors.gray[500]}
            />
          </View>

          <Input
            label="Happy Hour Discount (%)"
            placeholder="e.g., 30"
            value={happyHourDiscountPercent}
            onChangeText={setHappyHourDiscountPercent}
            keyboardType="numeric"
            required
          />

          <Button
            text="Save Pricing"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            fullWidth
            style={styles.saveButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  turfName: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  dynamicToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  dynamicToggleContent: {
    flex: 1,
    marginRight: spacing.md,
  },
  dynamicToggleLabel: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  dynamicToggleHint: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  manualPeriodContainer: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  manualPeriodTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  manualPeriodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  manualPeriodChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
    backgroundColor: '#fff',
  },
  manualPeriodChipActive: {
    borderColor: colors.primary[600],
    backgroundColor: colors.primary[50],
  },
  manualPeriodText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  manualPeriodTextActive: {
    color: colors.primary[700],
    fontWeight: typography.fontWeight.semibold,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
});
