import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, spacing, borderRadius, shadows } from '../../lib/theme';
import { useAuth } from '../../contexts/AuthContext';
import { Turf, BlockedSlot } from '../../types';
import {
  getTurfs,
  getUnavailableSlots,
  createBlockedSlot,
  deleteBlockedSlot,
} from '../../lib/firebase/firestore';
import { TIME_SLOTS } from '../../lib/constants';
import { formatTime } from '../../lib/utils';

export default function AdminManageSlotsScreen({ navigation }: any) {
  const { user, userData } = useAuth();
  const [turfs, setTurfs] = useState<Turf[]>([]);
  const [selectedTurf, setSelectedTurf] = useState<Turf | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [selectedStartTime, setSelectedStartTime] = useState<string | null>(null);
  const [selectedEndTime, setSelectedEndTime] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Generate next 14 days for date selection
  const dateOptions = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      dates.push(addDays(new Date(), i));
    }
    return dates;
  }, []);

  // Filter turfs based on search query
  const filteredTurfs = useMemo(() => {
    if (!searchQuery.trim()) return turfs;
    const query = searchQuery.toLowerCase();
    return turfs.filter(
      (turf) =>
        turf.name.toLowerCase().includes(query) ||
        turf.location?.address?.toLowerCase().includes(query)
    );
  }, [turfs, searchQuery]);

  const loadTurfs = async () => {
    try {
      // Admin can access ALL turfs
      const allTurfs = await getTurfs();
      // Only show verified turfs
      const verifiedTurfs = allTurfs.filter((t) => t.isVerified);
      setTurfs(verifiedTurfs);
      if (verifiedTurfs.length > 0 && !selectedTurf) {
        setSelectedTurf(verifiedTurfs[0]);
      }
    } catch (error) {
      console.error('Error loading turfs:', error);
    }
  };

  const loadSlots = useCallback(async () => {
    if (!selectedTurf) return;

    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const { bookings, blockedSlots: blocked } = await getUnavailableSlots(
        selectedTurf.id,
        dateStr
      );

      // Store booked slots (from actual bookings)
      const bookedSlotStrings = bookings.map((b) => `${b.startTime}-${b.endTime}`);
      setBookedSlots(bookedSlotStrings);

      // Store blocked slots separately (we need full data to delete them)
      setBlockedSlots(blocked);
    } catch (error) {
      console.error('Error loading slots:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedTurf, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      loadTurfs();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (selectedTurf) {
        loadSlots();
      }
    }, [selectedTurf, selectedDate, loadSlots])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSlots();
    setRefreshing(false);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date);
    setSelectedStartTime(null);
    setSelectedEndTime(null);
  };

  const handleTurfChange = (turf: Turf) => {
    setSelectedTurf(turf);
    setSelectedStartTime(null);
    setSelectedEndTime(null);
  };

  const isSlotBooked = (time: string) => {
    return bookedSlots.some((slot) => {
      const [start, end] = slot.split('-');
      return time >= start && time < end;
    });
  };

  const isSlotBlocked = (time: string) => {
    return blockedSlots.some((slot) => {
      return time >= slot.startTime && time < slot.endTime;
    });
  };

  const getBlockedSlotForTime = (time: string): BlockedSlot | undefined => {
    return blockedSlots.find((slot) => {
      return time >= slot.startTime && time < slot.endTime;
    });
  };

  const handleSlotSelect = (time: string) => {
    if (isSlotBooked(time)) return;

    // If already blocked, offer to unblock
    const blockedSlot = getBlockedSlotForTime(time);
    if (blockedSlot) {
      Alert.alert(
        'Unlock Slot?',
        `This slot is currently locked${blockedSlot.reason ? ` for: ${blockedSlot.reason}` : ''}.\n\nDo you want to unlock it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unlock',
            style: 'destructive',
            onPress: () => handleUnlockSlot(blockedSlot.id),
          },
        ]
      );
      return;
    }

    // Check-in/Check-out style selection:
    // First click = start time, Second click = end time
    if (!selectedStartTime) {
      // First click - set start time
      setSelectedStartTime(time);
      setSelectedEndTime(null);
    } else if (!selectedEndTime) {
      // Second click - set end time
      if (time <= selectedStartTime) {
        // If clicked time is before or equal to start, reset and use this as new start
        setSelectedStartTime(time);
        setSelectedEndTime(null);
      } else {
        // Valid end time - use clicked time directly as the end time
        setSelectedEndTime(time);
      }
    } else {
      // Both already selected - start fresh with new selection
      setSelectedStartTime(time);
      setSelectedEndTime(null);
    }
  };

  const handleLockSlots = async () => {
    if (!selectedTurf || !selectedStartTime || !selectedEndTime || !user) {
      Alert.alert('Error', 'Please select a time range to lock');
      return;
    }

    try {
      setSaving(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const slotData: any = {
        turfId: selectedTurf.id,
        turfName: selectedTurf.name,
        date: dateStr,
        startTime: selectedStartTime,
        endTime: selectedEndTime,
        blockedBy: user.uid,
        blockedByName: userData?.displayName || user.email || 'Admin',
      };
      
      // Only add reason if provided
      if (reason.trim()) {
        slotData.reason = reason.trim();
      }
      
      const result = await createBlockedSlot(slotData);

      if (result.success) {
        Alert.alert('Success', 'Slot locked successfully');
        setSelectedStartTime(null);
        setSelectedEndTime(null);
        setReason('');
        await loadSlots();
      } else {
        Alert.alert('Error', result.error || 'Failed to lock slot');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlockSlot = async (slotId: string) => {
    try {
      setSaving(true);
      const result = await deleteBlockedSlot(slotId);

      if (result.success) {
        Alert.alert('Success', 'Slot unlocked successfully');
        await loadSlots();
      } else {
        Alert.alert('Error', result.error || 'Failed to unlock slot');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const renderTimeSlot = (
    slot: { startTime: string; endTime: string },
    index: number
  ) => {
    const isBooked = isSlotBooked(slot.startTime);
    const isBlocked = isSlotBlocked(slot.startTime);
    const isStartSelected = selectedStartTime === slot.startTime;
    const isInRange =
      selectedStartTime &&
      selectedEndTime &&
      slot.startTime >= selectedStartTime &&
      slot.startTime < selectedEndTime;
    // Show as "pending" when start is selected but end is not yet
    const isPendingEnd = selectedStartTime && !selectedEndTime && slot.startTime === selectedStartTime;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.timeSlot,
          isBooked && styles.timeSlotBooked,
          isBlocked && styles.timeSlotBlocked,
          isStartSelected && styles.timeSlotSelected,
          isPendingEnd && styles.timeSlotPending,
          isInRange && !isStartSelected && styles.timeSlotInRange,
        ]}
        onPress={() => handleSlotSelect(slot.startTime)}
        disabled={isBooked}
      >
        <Text
          style={[
            styles.timeSlotText,
            isBooked && styles.timeSlotTextBooked,
            isBlocked && styles.timeSlotTextBlocked,
            (isStartSelected || isInRange || isPendingEnd) && styles.timeSlotTextSelected,
          ]}
        >
          {formatTime(slot.startTime)}
        </Text>
        {isBooked && (
          <Ionicons name="person" size={12} color="#ef4444" style={styles.slotIcon} />
        )}
        {isBlocked && !isBooked && (
          <Ionicons name="lock-closed" size={12} color="#f59e0b" style={styles.slotIcon} />
        )}
      </TouchableOpacity>
    );
  };

  if (turfs.length === 0 && !loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lock Slots (Admin)</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color={colors.gray[400]} />
          <Text style={styles.emptyText}>No turfs found</Text>
          <Text style={styles.emptySubtext}>No verified turfs available</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lock Slots (Admin)</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Search & Select Turf */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Turf</Text>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.gray[400]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search turfs..."
              placeholderTextColor={colors.gray[400]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.gray[400]} />
              </TouchableOpacity>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.turfsScrollView}
          >
            {filteredTurfs.slice(0, 20).map((turf) => (
              <TouchableOpacity
                key={turf.id}
                style={[
                  styles.turfChip,
                  selectedTurf?.id === turf.id && styles.turfChipActive,
                ]}
                onPress={() => handleTurfChange(turf)}
              >
                <Text
                  style={[
                    styles.turfChipText,
                    selectedTurf?.id === turf.id && styles.turfChipTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {turf.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedTurf && (
            <View style={styles.selectedTurfInfo}>
              <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.selectedTurfLocation} numberOfLines={1}>
                {selectedTurf.location?.address || 'No location'}
              </Text>
            </View>
          )}
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dateOptions.map((date, index) => {
              const isSelected =
                format(date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
              const isToday = index === 0;
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dateCard, isSelected && styles.dateCardActive]}
                  onPress={() => handleDateChange(date)}
                >
                  <Text style={[styles.dateDay, isSelected && styles.dateDayActive]}>
                    {isToday ? 'Today' : format(date, 'EEE')}
                  </Text>
                  <Text style={[styles.dateNumber, isSelected && styles.dateNumberActive]}>
                    {format(date, 'd')}
                  </Text>
                  <Text style={[styles.dateMonth, isSelected && styles.dateMonthActive]}>
                    {format(date, 'MMM')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.gray[200] }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#fee2e2' }]} />
            <Text style={styles.legendText}>Booked</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#fef3c7' }]} />
            <Text style={styles.legendText}>Locked</Text>
          </View>
        </View>

        {/* Time Slots */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Time Slots</Text>
          {loading ? (
            <ActivityIndicator size="large" color={colors.primary[600]} />
          ) : (
            <View style={styles.timeSlotsGrid}>
              {TIME_SLOTS.map((slot, index) => renderTimeSlot(slot, index))}
            </View>
          )}
        </View>

        {/* Lock Slot Form */}
        {selectedStartTime && selectedEndTime && (
          <View style={styles.lockForm}>
            <Text style={styles.lockFormTitle}>Lock Time Slot</Text>
            <View style={styles.selectedTimeRow}>
              <View style={styles.selectedTimeBox}>
                <Text style={styles.selectedTimeLabel}>From</Text>
                <Text style={styles.selectedTimeValue}>{formatTime(selectedStartTime)}</Text>
              </View>
              <Ionicons name="arrow-forward" size={20} color={colors.gray[400]} />
              <View style={styles.selectedTimeBox}>
                <Text style={styles.selectedTimeLabel}>To</Text>
                <Text style={styles.selectedTimeValue}>{formatTime(selectedEndTime)}</Text>
              </View>
            </View>

            <TextInput
              style={styles.reasonInput}
              placeholder="Reason (optional) e.g., Phone booking - John"
              placeholderTextColor={colors.gray[400]}
              value={reason}
              onChangeText={setReason}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedStartTime(null);
                  setSelectedEndTime(null);
                  setReason('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.lockButton, saving && styles.lockButtonDisabled]}
                onPress={handleLockSlots}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#fff" />
                    <Text style={styles.lockButtonText}>Lock Slot</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Currently Blocked Slots */}
        {blockedSlots.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Locked Slots Today</Text>
            {blockedSlots.map((slot) => (
              <View key={slot.id} style={styles.blockedSlotCard}>
                <View style={styles.blockedSlotInfo}>
                  <View style={styles.blockedSlotTime}>
                    <Ionicons name="time-outline" size={16} color={colors.warning[600]} />
                    <Text style={styles.blockedSlotTimeText}>
                      {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                    </Text>
                  </View>
                  {slot.reason && (
                    <Text style={styles.blockedSlotReason}>{slot.reason}</Text>
                  )}
                  <Text style={styles.blockedByText}>By: {slot.blockedByName}</Text>
                </View>
                <TouchableOpacity
                  style={styles.unlockButton}
                  onPress={() => handleUnlockSlot(slot.id)}
                >
                  <Ionicons name="lock-open" size={18} color={colors.error[600]} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
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
  },
  section: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[300],
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginLeft: spacing.sm,
  },
  turfsScrollView: {
    marginBottom: spacing.sm,
  },
  turfChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[300],
    maxWidth: 160,
  },
  turfChipActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  turfChipText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  turfChipTextActive: {
    color: '#ffffff',
  },
  selectedTurfInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  selectedTurfLocation: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    flex: 1,
  },
  dateCard: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    marginRight: spacing.sm,
    backgroundColor: '#ffffff',
    minWidth: 70,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  dateCardActive: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  dateDay: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  dateDayActive: {
    color: '#ffffff',
  },
  dateNumber: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  dateNumberActive: {
    color: '#ffffff',
  },
  dateMonth: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  dateMonthActive: {
    color: '#ffffff',
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: '#ffffff',
    marginHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  timeSlotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeSlot: {
    width: '22%',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    flexDirection: 'row',
    justifyContent: 'center',
  },
  timeSlotBooked: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  timeSlotBlocked: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
  },
  timeSlotSelected: {
    backgroundColor: colors.primary[600],
    borderColor: colors.primary[600],
  },
  timeSlotPending: {
    backgroundColor: colors.primary[400],
    borderColor: colors.primary[500],
  },
  timeSlotInRange: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[300],
  },
  timeSlotText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  timeSlotTextBooked: {
    color: '#ef4444',
  },
  timeSlotTextBlocked: {
    color: '#d97706',
  },
  timeSlotTextSelected: {
    color: '#ffffff',
  },
  slotIcon: {
    marginLeft: 4,
  },
  lockForm: {
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.xl,
    ...shadows.md,
  },
  lockFormTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  selectedTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  selectedTimeBox: {
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  selectedTimeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  selectedTimeValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary[600],
  },
  reasonInput: {
    backgroundColor: colors.gray[50],
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    marginRight: spacing.sm,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
  },
  lockButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: '#f59e0b',
  },
  lockButtonDisabled: {
    opacity: 0.6,
  },
  lockButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: '#ffffff',
    marginLeft: spacing.sm,
  },
  blockedSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  blockedSlotInfo: {
    flex: 1,
  },
  blockedSlotTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  blockedSlotTimeText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.warning[700],
  },
  blockedSlotReason: {
    fontSize: typography.fontSize.sm,
    color: colors.warning[600],
    marginTop: 2,
  },
  blockedByText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[500],
    marginTop: 2,
  },
  unlockButton: {
    padding: spacing.sm,
    backgroundColor: '#ffffff',
    borderRadius: borderRadius.full,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.fontSize.base,
    color: colors.gray[400],
    marginTop: spacing.xs,
  },
});
