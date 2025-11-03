/**
 * BookingModal Component
 * 
 * IMPORTANT: This component uses a MOCK Razorpay implementation for Expo Go testing.
 * For production, you need to:
 * 1. Create a development build: npx expo install expo-dev-client
 * 2. Replace the mock RazorpayCheckout with: import RazorpayCheckout from 'react-native-razorpay'
 * 3. Build with: npx expo run:android or npx expo run:ios
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Modal } from './ui';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import {
  calculatePaymentBreakdown,
  calculateBaseTurfAmount,
  formatCurrency,
  formatTime,
  calculateDuration,
} from '../lib/utils';
import { TIME_SLOTS, RAZORPAY_KEY_ID } from '../lib/constants';
import { createBooking, getTurfBookings } from '../lib/firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../lib/theme';

// Mock Razorpay for Expo Go (replace with actual import in production build)
const RazorpayCheckout = {
  open: (options: any) => {
    return new Promise((resolve, reject) => {
      // Simulate payment success for testing in Expo Go
      setTimeout(() => {
        resolve({
          razorpay_payment_id: 'pay_mock_' + Date.now(),
          razorpay_order_id: 'order_mock_' + Date.now(),
          razorpay_signature: 'sig_mock_' + Date.now(),
        });
      }, 1000);
    });
  },
  PAYMENT_CANCELLED: 'payment_cancelled',
};

interface BookingModalProps {
  visible: boolean;
  turf: any;
  onClose: () => void;
  onBookingSuccess: () => void;
}

const BookingModal: React.FC<BookingModalProps> = ({
  visible,
  turf,
  onClose,
  onBookingSuccess,
}) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const price = turf?.pricePerHour || turf?.price || 0;

  useEffect(() => {
    console.log('🎯 useEffect triggered - visible:', visible, 'turf?.id:', turf?.id);
    if (visible && turf?.id) {
      console.log('🔄 Modal opened, loading slots...');
      console.log('  Selected date:', format(selectedDate, 'yyyy-MM-dd'));
      loadBookedSlots();
      // Reset selections when modal opens
      setStartTime(null);
      setEndTime(null);
      setAgreedToTerms(false);
    } else {
      console.log('⏭️ Skipping slot load - visible:', visible, 'turf?.id:', turf?.id);
    }
  }, [visible, selectedDate, turf?.id]);

  const loadBookedSlots = async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      console.log('📅 Loading booked slots for:', dateStr, 'Turf:', turf.id);
      console.log('🔍 Fetching bookings from Firestore...');
      
      const bookings = await getTurfBookings(turf.id, dateStr);
      console.log('📊 Raw bookings data:', JSON.stringify(bookings, null, 2));
      console.log('📊 Found bookings:', bookings.length);
      
      if (bookings.length === 0) {
        console.log('⚠️ No bookings found for this turf on this date');
        setBookedSlots([]);
        return;
      }
      
      const slots = bookings.map(
        (b) => {
          const slotStr = `${b.startTime}-${b.endTime}`;
          console.log('🔒 Booked slot:', slotStr, 'Status:', b.status);
          return slotStr;
        }
      );
      setBookedSlots(slots);
      console.log('✅ Total booked slots set in state:', slots);
      console.log('✅ bookedSlots state will be:', slots);
    } catch (error) {
      console.error('❌ Error loading booked slots:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
    }
  };

  const isTimeSlotBooked = (time: string) => {
    console.log(`🔎 Checking if time ${time} is booked...`);
    console.log(`🔎 Current bookedSlots state:`, bookedSlots);
    
    // Check if this time overlaps with any booked slots
    // A time slot is booked if it falls within a booked range (excluding the end time)
    // Example: If 20:00-21:00 is booked, 20:00 is locked but 21:00 is available for next booking
    const isBooked = bookedSlots.some((slot) => {
      const [bookedStart, bookedEnd] = slot.split('-');
      console.log(`  Comparing ${time} with slot ${bookedStart}-${bookedEnd}`);
      // Only lock times that are actually being used in the booked slot
      // time >= bookedStart && time < bookedEnd ensures end time is available for next slot
      const result = time >= bookedStart && time < bookedEnd;
      if (result) {
        console.log(`  ✅ MATCH: Time ${time} is booked (slot: ${slot})`);
      }
      return result;
    });
    
    console.log(`🔎 Final result for ${time}: ${isBooked ? '🔒 BOOKED' : '✅ AVAILABLE'}`);
    return isBooked;
  };

  const handleDateSelect = (daysToAdd: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysToAdd);
    setSelectedDate(newDate);
    setStartTime(null);
    setEndTime(null);
  };

  const handleStartTimeSelect = (time: string) => {
    setStartTime(time);
    // Reset end time if it's before new start time
    if (endTime && endTime <= time) {
      setEndTime(null);
    }
  };

  const handleEndTimeSelect = (time: string) => {
    if (!startTime) {
      Alert.alert('Select Start Time', 'Please select a start time first');
      return;
    }
    if (time <= startTime) {
      Alert.alert('Invalid Time', 'End time must be after start time');
      return;
    }
    setEndTime(time);
  };

  const isValidTimeRange = () => {
    if (!startTime || !endTime) return true;
    
    // Check if any slot in the range is booked
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    
    for (let hour = startHour; hour < endHour; hour++) {
      const checkTime = `${hour.toString().padStart(2, '0')}:00`;
      if (isTimeSlotBooked(checkTime)) {
        return false;
      }
    }
    return true;
  };

  const handlePayment = async () => {
    if (!startTime || !endTime) {
      Alert.alert('Error', 'Please select both start and end time');
      return;
    }

    if (!isValidTimeRange()) {
      Alert.alert('Error', 'Some slots in the selected time range are already booked');
      return;
    }

    if (!agreedToTerms) {
      Alert.alert('Error', 'Please agree to the terms and conditions');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'Please login to book a turf');
      return;
    }

    try {
      setLoading(true);

      // Calculate payment breakdown
      const baseTurfAmount = calculateBaseTurfAmount(
        price,
        startTime,
        endTime
      );
      const breakdown = calculatePaymentBreakdown(baseTurfAmount);

      // Razorpay options
      const options = {
        description: `Booking for ${turf.name}`,
        image: turf.images?.[0] || '',
        currency: 'INR',
        key: RAZORPAY_KEY_ID,
        amount: breakdown.totalAmount * 100, // Razorpay expects amount in paise
        name: 'Playmate',
        prefill: {
          email: user.email || '',
          contact: user.phoneNumber || '',
          name: user.displayName || 'User',
        },
        theme: { color: '#16a34a' },
      };

      // Open Razorpay
      RazorpayCheckout.open(options)
        .then(async (data: any) => {
          // Payment successful
          console.log('Payment success:', data);
          
          // Create booking (payment simulated in Expo Go)
          const bookingData = {
            userId: user.uid,
            userName: user.displayName || 'User',
            userEmail: user.email || '',
            userPhone: user.phoneNumber || '',
            turfId: turf.id,
            turfName: turf.name,
            turfImage: turf.images?.[0] || '',
            turfLocation: turf.location,
            date: format(selectedDate, 'yyyy-MM-dd'),
            startTime: startTime,
            endTime: endTime,
            totalAmount: breakdown.totalAmount,
            paymentId: data.razorpay_payment_id,
            status: 'confirmed' as const,
            paymentBreakdown: breakdown,
            createdAt: new Date(),
          };

          const result = await createBooking(bookingData);

          if (result.success) {
            // Reload booked slots to show the newly booked slot as locked
            await loadBookedSlots();
            
            // Success handled by parent screen's onBookingSuccess callback
            onBookingSuccess();
            // Reset selections after successful booking
            setStartTime(null);
            setEndTime(null);
            setAgreedToTerms(false);
          } else {
            Alert.alert('Error', result.error || 'Failed to create booking');
          }
        })
        .catch((error: any) => {
          // Payment failed or cancelled
          console.log('Payment error:', error);
          if (error.code !== RazorpayCheckout.PAYMENT_CANCELLED) {
            Alert.alert('Payment Failed', error.description || 'Payment failed');
          }
        })
        .finally(() => {
          setLoading(false);
        });
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  // Generate payment breakdown for display
  const baseTurfAmount = startTime && endTime
    ? calculateBaseTurfAmount(price, startTime, endTime)
    : 0;
  const breakdown = calculatePaymentBreakdown(baseTurfAmount);
  const duration = startTime && endTime
    ? calculateDuration(startTime, endTime)
    : 0;

  return (
    <Modal visible={visible} onClose={onClose} showCloseButton={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Book Your Slot</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
        </View>

        {/* Turf Info */}
        <View style={styles.turfInfo}>
          <Text style={styles.turfName}>{turf?.name}</Text>
          <Text style={styles.turfLocation}>{turf?.location?.city}</Text>
        </View>

        {/* Date Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.dateContainer}>
              {[0, 1, 2, 3, 4, 5, 6].map((daysAhead) => {
                const date = new Date();
                date.setDate(date.getDate() + daysAhead);
                const isSelected =
                  format(date, 'yyyy-MM-dd') ===
                  format(selectedDate, 'yyyy-MM-dd');

                return (
                  <TouchableOpacity
                    key={daysAhead}
                    style={[
                      styles.dateCard,
                      isSelected && styles.dateCardSelected,
                    ]}
                    onPress={() => handleDateSelect(daysAhead)}
                  >
                    <Text
                      style={[
                        styles.dateDay,
                        isSelected && styles.dateDaySelected,
                      ]}
                    >
                      {format(date, 'EEE')}
                    </Text>
                    <Text
                      style={[
                        styles.dateNumber,
                        isSelected && styles.dateNumberSelected,
                      ]}
                    >
                      {format(date, 'dd')}
                    </Text>
                    <Text
                      style={[
                        styles.dateMonth,
                        isSelected && styles.dateMonthSelected,
                      ]}
                    >
                      {format(date, 'MMM')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Time Selection - Start and End Time */}
        <View style={styles.section}>
          <View style={styles.timeSelectionHeader}>
            <Ionicons name="time" size={20} color="#16a34a" />
            <Text style={styles.sectionTitle}>Select Time</Text>
          </View>
          
          {/* Start Time */}
          <Text style={styles.timeLabel}>Start Time</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.timeScrollView}
          >
            <View style={styles.timeSlotRow}>
              {TIME_SLOTS.map((slot, index) => {
                const isBooked = isTimeSlotBooked(slot.startTime);
                const isSelected = startTime === slot.startTime;
                const isDisabled = endTime ? slot.startTime >= endTime : false;

                return (
                  <TouchableOpacity
                    key={`start-${index}`}
                    style={[
                      styles.timeSlot,
                      isBooked && styles.timeSlotBooked,
                      isSelected && styles.timeSlotSelectedStart,
                      isDisabled && styles.timeSlotDisabled,
                    ]}
                    onPress={() => handleStartTimeSelect(slot.startTime)}
                    disabled={isBooked || isDisabled}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        isBooked && styles.timeSlotTextBooked,
                        isSelected && styles.timeSlotTextSelectedStart,
                        isDisabled && styles.timeSlotTextDisabled,
                      ]}
                    >
                      {formatTime(slot.startTime)}
                    </Text>
                    {isBooked && (
                      <View style={styles.bookedIndicator}>
                        <Ionicons name="lock-closed" size={10} color="#ef4444" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* End Time */}
          <Text style={[styles.timeLabel, { marginTop: 16 }]}>End Time</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.timeScrollView}
          >
            <View style={styles.timeSlotRow}>
              {TIME_SLOTS.map((slot, index) => {
                // For end time, show the endTime of each slot (not startTime)
                // This ensures user selects actual end time, not another start time
                const timeToShow = slot.endTime;
                const isBooked = isTimeSlotBooked(slot.startTime);
                const isSelected = endTime === timeToShow;
                const isDisabled = !startTime || timeToShow <= startTime;

                return (
                  <TouchableOpacity
                    key={`end-${index}`}
                    style={[
                      styles.timeSlot,
                      isBooked && styles.timeSlotBooked,
                      isSelected && styles.timeSlotSelectedEnd,
                      isDisabled && styles.timeSlotDisabled,
                    ]}
                    onPress={() => handleEndTimeSelect(timeToShow)}
                    disabled={isBooked || isDisabled}
                  >
                    <Text
                      style={[
                        styles.timeSlotText,
                        isBooked && styles.timeSlotTextBooked,
                        isSelected && styles.timeSlotTextSelectedEnd,
                        isDisabled && styles.timeSlotTextDisabled,
                      ]}
                    >
                      {formatTime(timeToShow)}
                    </Text>
                    {isBooked && (
                      <View style={styles.bookedIndicator}>
                        <Ionicons name="lock-closed" size={10} color="#ef4444" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Duration Display */}
          {startTime && endTime && (
            <View style={styles.durationDisplay}>
              <Ionicons name="hourglass-outline" size={18} color="#16a34a" />
              <Text style={styles.durationText}>
                Duration: {duration} {duration === 1 ? 'hour' : 'hours'}
              </Text>
              <Text style={styles.durationTime}>
                {formatTime(startTime)} - {formatTime(endTime)}
              </Text>
            </View>
          )}

          {!isValidTimeRange() && startTime && endTime && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={18} color="#f59e0b" />
              <Text style={styles.warningText}>
                Some slots in this range are already booked
              </Text>
            </View>
          )}
        </View>

        {/* Payment Breakdown - CRITICAL SECTION */}
        {startTime && endTime && isValidTimeRange() && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment Breakdown</Text>
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Base Turf Amount ({duration}h × {formatCurrency(price)})
                </Text>
                <Text style={styles.breakdownValue}>
                  {formatCurrency(breakdown.baseTurfAmount)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>Platform Commission</Text>
                <Text style={styles.breakdownValue}>
                  {formatCurrency(breakdown.platformCommission)}
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>
                  Payment Gateway Fee (2.07%)
                </Text>
                <Text style={styles.breakdownValue}>
                  {formatCurrency(breakdown.razorpayFee)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.breakdownRow}>
                <Text style={styles.breakdownLabelTotal}>Total Amount</Text>
                <Text style={styles.breakdownValueTotal}>
                  {formatCurrency(breakdown.totalAmount)}
                </Text>
              </View>
              
              {/* Owner vs Platform Share Info */}
              <View style={styles.shareInfoBox}>
                <Text style={styles.shareInfoTitle}>Payment Distribution</Text>
                <View style={styles.shareRow}>
                  <View style={styles.shareItem}>
                    <Text style={styles.shareLabel}>Turf Owner Gets</Text>
                    <Text style={styles.shareValue}>
                      {formatCurrency(breakdown.ownerShare)}
                    </Text>
                  </View>
                  <View style={styles.shareItem}>
                    <Text style={styles.shareLabel}>Platform Gets</Text>
                    <Text style={styles.shareValue}>
                      {formatCurrency(breakdown.platformShare)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Terms & Conditions */}
        <TouchableOpacity
          style={styles.termsContainer}
          onPress={() => setAgreedToTerms(!agreedToTerms)}
        >
          <View
            style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}
          >
            {agreedToTerms && (
              <Ionicons name="checkmark" size={16} color="#ffffff" />
            )}
          </View>
          <Text style={styles.termsText}>
            I agree to the terms and conditions and cancellation policy
          </Text>
        </TouchableOpacity>

        {/* Book Button */}
        <TouchableOpacity
          style={[
            styles.bookButton,
            (!startTime || !endTime || !agreedToTerms || loading || !isValidTimeRange()) &&
              styles.bookButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!startTime || !endTime || !agreedToTerms || loading || !isValidTimeRange()}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.bookButtonText}>
                Pay {formatCurrency(breakdown.totalAmount)}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#ffffff" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  turfInfo: {
    marginBottom: 24,
  },
  turfName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  turfLocation: {
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  dateContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCard: {
    width: 70,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  dateCardSelected: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  dateDay: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  dateDaySelected: {
    color: '#dcfce7',
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginVertical: 4,
  },
  dateNumberSelected: {
    color: '#ffffff',
  },
  dateMonth: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  dateMonthSelected: {
    color: '#dcfce7',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slotCard: {
    width: '30%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  slotCardBooked: {
    backgroundColor: '#f3f4f6',
    borderColor: '#d1d5db',
  },
  slotCardSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
    borderWidth: 2,
  },
  slotTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  slotTimeBooked: {
    color: '#9ca3af',
  },
  slotTimeSelected: {
    color: '#16a34a',
  },
  slotTo: {
    fontSize: 10,
    color: '#9ca3af',
    marginVertical: 2,
  },
  slotToBooked: {
    color: '#d1d5db',
  },
  slotToSelected: {
    color: '#15803d',
  },
  bookedBadge: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#fee2e2',
    borderRadius: 4,
  },
  bookedText: {
    fontSize: 9,
    color: '#ef4444',
    fontWeight: '600',
  },
  breakdownCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  breakdownLabelTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  breakdownValueTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#16a34a',
  },
  shareInfoBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  shareInfoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#15803d',
    marginBottom: 8,
  },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shareItem: {
    flex: 1,
  },
  shareLabel: {
    fontSize: 11,
    color: '#15803d',
    marginBottom: 2,
  },
  shareValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  bookButton: {
    backgroundColor: '#16a34a',
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  bookButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  bookButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  // New Time Selection Styles
  timeSelectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  timeScrollView: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  timeSlotRow: {
    flexDirection: 'row',
    gap: 10,
    paddingRight: 16,
  },
  timeSlot: {
    minWidth: 90,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeSlotBooked: {
    backgroundColor: '#fee2e2',
    borderColor: '#fecaca',
  },
  timeSlotSelectedStart: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a',
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timeSlotSelectedEnd: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  timeSlotDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    opacity: 0.5,
  },
  timeSlotText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  timeSlotTextBooked: {
    color: '#ef4444',
  },
  timeSlotTextSelectedStart: {
    color: '#16a34a',
  },
  timeSlotTextSelectedEnd: {
    color: '#3b82f6',
  },
  timeSlotTextDisabled: {
    color: '#9ca3af',
  },
  bookedIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  durationDisplay: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#f0fdf4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803d',
    flex: 1,
  },
  durationTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16a34a',
  },
  warningBox: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  warningText: {
    fontSize: 13,
    color: '#92400e',
    flex: 1,
  },
});

export default BookingModal;
