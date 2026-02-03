/**
 * BookingModal Component
 * 
 * Real Razorpay Payment Integration via WebView
 * Works in Expo Go - No native build required!
 * OPTIMIZED FOR PERFORMANCE
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { createBooking, getUnavailableSlots } from '../lib/firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { theme } from '../lib/theme';
// WebView-based Razorpay (works in Expo Go!)
import { RazorpayWebView } from './RazorpayWebView';

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
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  
  // Compact processing/success popup state
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [popupStatus, setPopupStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  const price = turf?.pricePerHour || turf?.price || 0;

  // PERFORMANCE: Memoize loadBookedSlots function
  const loadBookedSlots = useCallback(async () => {
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Get both bookings and blocked slots
      const { bookings, blockedSlots } = await getUnavailableSlots(turf.id, dateStr);
      
      if (bookings.length === 0 && blockedSlots.length === 0) {
        setBookedSlots([]);
        return;
      }
      
      // Combine booking slots and blocked slots
      const bookingSlots = bookings.map((b) => `${b.startTime}-${b.endTime}`);
      const blockedSlotStrings = blockedSlots.map((b) => `${b.startTime}-${b.endTime}`);
      const allUnavailableSlots = [...bookingSlots, ...blockedSlotStrings];
      
      // Update slots only if different to prevent unnecessary re-renders
      setBookedSlots(prevSlots => {
        const prevSlotsStr = JSON.stringify(prevSlots.sort());
        const newSlotsStr = JSON.stringify(allUnavailableSlots.sort());
        
        if (prevSlotsStr !== newSlotsStr) {
          return allUnavailableSlots;
        }
        
        return prevSlots;
      });
    } catch (error) {
      console.error('Error loading booked slots:', error);
    }
  }, [turf?.id, selectedDate]);

  useEffect(() => {
    if (visible && turf?.id) {
      // Load slots immediately
      loadBookedSlots();
      
      // Reset selections when modal opens or date changes
      setStartTime(null);
      setEndTime(null);
      setAgreedToTerms(false);
    }
  }, [visible, selectedDate, turf?.id, loadBookedSlots]); // ✅ FIXED: Added loadBookedSlots to dependencies

  const isTimeSlotBooked = (time: string) => {
    // Check if this time overlaps with any booked slots
    const isBooked = bookedSlots.some((slot) => {
      const [bookedStart, bookedEnd] = slot.split('-');
      return time >= bookedStart && time < bookedEnd;
    });
    
    return isBooked;
  };

  // PERFORMANCE: Memoize date selection handler
  const handleDateSelect = useCallback((daysToAdd: number) => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + daysToAdd);
    const newDateStr = format(newDate, 'yyyy-MM-dd');
    const currentDateStr = format(selectedDate, 'yyyy-MM-dd');
    
    // Only update if date actually changed
    if (newDateStr !== currentDateStr) {
      setSelectedDate(newDate);
      setStartTime(null);
      setEndTime(null);
    }
  }, [selectedDate]);

  const handleStartTimeSelect = useCallback((time: string) => {
    setStartTime(time);
    // Reset end time if it's before new start time
    if (endTime && endTime <= time) {
      setEndTime(null);
    }
  }, [endTime]);

  const handleEndTimeSelect = useCallback((time: string) => {
    if (!startTime) {
      Alert.alert('Select Start Time', 'Please select a start time first');
      return;
    }
    if (time <= startTime) {
      Alert.alert('Invalid Time', 'End time must be after start time');
      return;
    }
    setEndTime(time);
  }, [startTime]);

  const isValidTimeRange = () => {
    if (!startTime || !endTime) return true;
    
    // ✅ FIXED: Check every 30-minute slot in the range (not just hourly)
    // Convert times to total minutes for accurate 30-minute interval checking
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    // Check each 30-minute slot in the range
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const checkTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      if (isTimeSlotBooked(checkTime)) {
        return false;
      }
    }
    
    return true;
  };

  const handlePayment = () => {
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

    // Show payment modal directly
    console.log('💰 Opening payment modal for amount:', breakdown.totalAmount);
    console.log('🔑 Razorpay Key ID:', RAZORPAY_KEY_ID);
    console.log('👤 User details:', {
      name: user.displayName,
      email: user.email,
      phone: user.phoneNumber,
    });
    setShowPaymentModal(true);
    console.log('✅ Payment modal state set to true');
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    // Capture current values before any state changes
    const currentBreakdown = breakdown;
    const currentStartTime = startTime!;
    const currentEndTime = endTime!;
    const currentDate = format(selectedDate, 'yyyy-MM-dd');
    
    // Close Razorpay and show compact processing popup immediately
    setShowPaymentModal(false);
    setPopupStatus('processing');
    setShowStatusPopup(true);
    
    console.log('✅ Payment received. Processing...');

    try {
      const { functions } = await import('../config/firebase');

      // Prepare booking data
      const bookingData = {
        userId: user!.uid,
        userName: user!.displayName || 'User',
        userEmail: user!.email || '',
        userPhone: user!.phoneNumber || '',
        turfId: turf.id,
        turfName: turf.name,
        turfImage: turf.images?.[0] || '',
        turfLocation: turf.location,
        date: currentDate,
        startTime: currentStartTime,
        endTime: currentEndTime,
        totalAmount: currentBreakdown.totalAmount,
        status: 'confirmed' as const,
        paymentBreakdown: currentBreakdown,
        createdAt: new Date(),
      };

      // Verify payment
      const verifyPaymentById = functions.httpsCallable('verifyPaymentById');
      const response = await verifyPaymentById({
        razorpay_payment_id: paymentData.razorpay_payment_id,
        expectedAmount: currentBreakdown.totalAmount,
      });

      const verificationResult = response.data as any;
      console.log('✅ Payment verified:', verificationResult);

      // Create booking
      const createVerifiedBooking = functions.httpsCallable('createVerifiedBooking');
      const bookingResponse = await createVerifiedBooking({
        bookingData: {
          ...bookingData,
          paymentId: verificationResult.payment.id,
          paymentDetails: verificationResult.payment,
        },
        verifiedPayment: verificationResult,
      });

      const result = bookingResponse.data as any;

      if (result.success) {
        console.log('✅ Booking created successfully');
        // Lock the slot
        const bookedSlot = `${currentStartTime}-${currentEndTime}`;
        setBookedSlots(prev => [...prev, bookedSlot]);
        // Show success
        setPopupStatus('success');
        // Reload slots in background
        loadBookedSlots();
      } else {
        throw new Error('Booking creation failed');
      }
    } catch (error: any) {
      console.error('❌ Error:', error);
      setErrorMessage(error.message || 'Something went wrong');
      setPopupStatus('error');
    }
  };

  // Handle closing the status popup
  const handleStatusPopupClose = useCallback(() => {
    if (popupStatus === 'success') {
      setShowStatusPopup(false);
      setStartTime(null);
      setEndTime(null);
      setAgreedToTerms(false);
      onBookingSuccess();
    } else if (popupStatus === 'error') {
      setShowStatusPopup(false);
      // Keep form state so user can retry
    }
  }, [popupStatus, onBookingSuccess]);

  const handlePaymentError = (error: any) => {
    setShowPaymentModal(false);
    Alert.alert('Payment Failed', error.description || 'Payment failed. Please try again.');
  };

  const handlePaymentDismiss = () => {
    setShowPaymentModal(false);
  };

  // PERFORMANCE: Memoize payment breakdown calculations
  const baseTurfAmount = useMemo(() => 
    startTime && endTime ? calculateBaseTurfAmount(price, startTime, endTime) : 0,
    [price, startTime, endTime]
  );
  
  const breakdown = useMemo(() => 
    calculatePaymentBreakdown(baseTurfAmount),
    [baseTurfAmount]
  );
  
  const duration = useMemo(() => 
    startTime && endTime ? calculateDuration(startTime, endTime) : 0,
    [startTime, endTime]
  );

  // If showing status popup, render a clean fullscreen popup instead of the booking form
  if (showStatusPopup) {
    return (
      <Modal visible={visible} onClose={() => {}} showCloseButton={false}>
        <View style={styles.statusPopupFullscreen}>
          <View style={styles.popupContainer}>
            {popupStatus === 'processing' && (
              <>
                <ActivityIndicator size="large" color="#16a34a" />
                <Text style={styles.popupText}>Processing...</Text>
              </>
            )}
            {popupStatus === 'success' && (
              <>
                <View style={styles.popupSuccessIcon}>
                  <Ionicons name="checkmark" size={32} color="#ffffff" />
                </View>
                <Text style={styles.popupTitle}>Booking Confirmed!</Text>
                <TouchableOpacity style={styles.popupButton} onPress={handleStatusPopupClose}>
                  <Text style={styles.popupButtonText}>Done</Text>
                </TouchableOpacity>
              </>
            )}
            {popupStatus === 'error' && (
              <>
                <View style={styles.popupErrorIcon}>
                  <Ionicons name="close" size={32} color="#ffffff" />
                </View>
                <Text style={styles.popupTitle}>Something went wrong</Text>
                <Text style={styles.popupErrorText}>{errorMessage}</Text>
                <TouchableOpacity style={styles.popupRetryButton} onPress={handleStatusPopupClose}>
                  <Text style={styles.popupButtonText}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    );
  }

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
                    activeOpacity={0.7}
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

        {/* Payment Breakdown - COLLAPSIBLE */}
        {startTime && endTime && isValidTimeRange() && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.breakdownHeader}
              onPress={() => setShowBreakdown(!showBreakdown)}
            >
              <Text style={styles.sectionTitle}>Payment Breakdown</Text>
              <Ionicons 
                name={showBreakdown ? "chevron-up" : "chevron-down"} 
                size={24} 
                color="#111827" 
              />
            </TouchableOpacity>
            
            {showBreakdown && (
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
            )}
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

      {/* Razorpay Payment WebView */}
      {user && startTime && endTime && (
        <RazorpayWebView
          visible={showPaymentModal}
          amount={breakdown.totalAmount}
          currency="INR"
          keyId={RAZORPAY_KEY_ID}
          name="Playmate"
          description={`Booking for ${turf.name}`}
          prefill={{
            name: user.displayName || 'User',
            email: user.email || '',
            contact: user.phoneNumber || '',
          }}
          theme={{ color: '#16a34a' }}
          onSuccess={handlePaymentSuccess}
          onError={handlePaymentError}
          onDismiss={handlePaymentDismiss}
        />
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  statusPopupFullscreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
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
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownCard: {
    backgroundColor: '#f9fafb',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8,
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
  // Compact Status Popup Styles
  popupContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 220,
    maxWidth: 280,
  },
  popupText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  popupTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  popupSuccessIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupErrorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupErrorText: {
    marginTop: 8,
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
  popupButton: {
    marginTop: 20,
    backgroundColor: '#16a34a',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  popupRetryButton: {
    marginTop: 20,
    backgroundColor: '#6b7280',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  popupButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BookingModal;
