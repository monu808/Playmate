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
  TextInput,
} from 'react-native';
import { Modal } from './ui';
import { Ionicons } from '@expo/vector-icons';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions/lib/modular';
import { format } from 'date-fns';
import {
  calculateBookingBaseAmount,
  calculatePaymentBreakdown,
  formatCurrency,
  formatTime,
  calculateDuration,
  resolveTurfPricing,
} from '../lib/utils';
import { TIME_SLOTS, RAZORPAY_KEY_ID } from '../lib/constants';
import { calculateBookingPricing, getUnavailableSlots } from '../lib/firebase/firestore';
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
  const { user, userData } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [rewardCode, setRewardCode] = useState('');
  const [requestedSpiritPoints, setRequestedSpiritPoints] = useState(0);
  const [availableSpiritPoints, setAvailableSpiritPoints] = useState(0);
  const [sliderTrackWidth, setSliderTrackWidth] = useState(0);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [pricingQuote, setPricingQuote] = useState<any | null>(null);
  
  // Compact processing/success popup state
  const [showStatusPopup, setShowStatusPopup] = useState(false);
  const [popupStatus, setPopupStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

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
      setShowOffers(false);
      setRewardCode('');
      setRequestedSpiritPoints(0);
      setQuoteError('');
      setPricingQuote(null);
      setAvailableSpiritPoints(Math.max(0, Number(userData?.spiritPoints || 0)));
    }
  }, [visible, selectedDate, turf?.id, loadBookedSlots, userData?.spiritPoints]); // ✅ FIXED: Added loadBookedSlots to dependencies

  useEffect(() => {
    if (requestedSpiritPoints > availableSpiritPoints) {
      setRequestedSpiritPoints(availableSpiritPoints);
    }
  }, [requestedSpiritPoints, availableSpiritPoints]);

  useEffect(() => {
    setQuoteError('');
    setPricingQuote(null);
  }, [startTime, endTime, selectedDate]);

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

  const timeRangeValid = useMemo(() => {
    if (!startTime || !endTime) {
      return true;
    }

    // Check every 30-minute slot in the range.
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const checkTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

      const isBooked = bookedSlots.some((slot) => {
        const [bookedStart, bookedEnd] = slot.split('-');
        return checkTime >= bookedStart && checkTime < bookedEnd;
      });

      if (isBooked) {
        return false;
      }
    }

    return true;
  }, [startTime, endTime, bookedSlots]);

  const setPointsByRatio = useCallback((ratio: number) => {
    const safeAvailablePoints = Math.max(0, availableSpiritPoints);
    if (safeAvailablePoints === 0) {
      setRequestedSpiritPoints(0);
      return;
    }

    const clampedRatio = Math.max(0, Math.min(1, ratio));
    const rawPoints = Math.round(safeAvailablePoints * clampedRatio);
    setRequestedSpiritPoints(Math.min(safeAvailablePoints, rawPoints));
  }, [availableSpiritPoints]);

  const handleSpiritSliderTouch = useCallback((locationX: number) => {
    if (sliderTrackWidth <= 0) {
      return;
    }

    setPointsByRatio(locationX / sliderTrackWidth);
  }, [sliderTrackWidth, setPointsByRatio]);

  const refreshPricingQuote = useCallback(async () => {
    if (!user || !startTime || !endTime) {
      return null;
    }

    setQuoteLoading(true);
    setQuoteError('');

    const result = await calculateBookingPricing({
      turfId: turf.id,
      date: format(selectedDate, 'yyyy-MM-dd'),
      startTime,
      endTime,
      rewardCode: rewardCode.trim() || undefined,
      requestedSpiritPoints,
    });

    setQuoteLoading(false);

    if (!result.success || !result.quote) {
      const errorText = result.error || 'Unable to calculate discounted price right now';
      setQuoteError(errorText);
      return null;
    }

    const quote = result.quote;
    setPricingQuote(quote);
    setAvailableSpiritPoints(Math.max(0, Number(quote.availableSpiritPoints || 0)));

    if (rewardCode.trim() && quote?.rewardCodeValidation?.valid === false) {
      setQuoteError(quote?.rewardCodeValidation?.message || 'Invalid reward code');
      return quote;
    }

    setQuoteError('');
    return quote;
  }, [
    user,
    startTime,
    endTime,
    turf?.id,
    selectedDate,
    rewardCode,
    requestedSpiritPoints,
  ]);

  useEffect(() => {
    if (!visible || !user || !startTime || !endTime || !timeRangeValid) {
      return;
    }

    const timer = setTimeout(() => {
      refreshPricingQuote();
    }, 250);

    return () => clearTimeout(timer);
  }, [
    visible,
    user,
    startTime,
    endTime,
    rewardCode,
    requestedSpiritPoints,
    timeRangeValid,
    refreshPricingQuote,
  ]);

  const handlePayment = async () => {
    if (!startTime || !endTime) {
      Alert.alert('Error', 'Please select both start and end time');
      return;
    }

    if (!timeRangeValid) {
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

    const latestQuote = await refreshPricingQuote();
    if (!latestQuote) {
      Alert.alert('Pricing Error', 'Unable to refresh final payable amount. Please try again.');
      return;
    }

    if (rewardCode.trim() && latestQuote?.rewardCodeValidation?.valid === false) {
      Alert.alert('Invalid Reward Code', latestQuote?.rewardCodeValidation?.message || 'Please check your code and try again.');
      return;
    }

    const payableAmount = Number(latestQuote?.breakdown?.totalAmount || breakdown.totalAmount);

    // Show payment modal directly
    console.log('💰 Opening payment modal for amount:', payableAmount);
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
    const currentBreakdown = effectiveBreakdown;
    const currentDiscount = effectiveDiscount;
    const currentStartTime = startTime!;
    const currentEndTime = endTime!;
    const currentDate = format(selectedDate, 'yyyy-MM-dd');
    const normalizedRewardCode = rewardCode.trim().toUpperCase();
    const requestedPoints = Math.max(0, Math.floor(requestedSpiritPoints));
    
    // Close Razorpay and show compact processing popup immediately
    setShowPaymentModal(false);
    setPopupStatus('processing');
    setShowStatusPopup(true);
    
    console.log('✅ Payment received. Processing...');

    try {
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
        appliedDiscount: currentDiscount,
        requestedRewardCode: normalizedRewardCode,
        requestedSpiritPoints: requestedPoints,
        createdAt: new Date(),
      };

      const functionsInstance = getFunctions();

      // Verify payment
      const verifyPaymentById = httpsCallable(functionsInstance, 'verifyPaymentById');
      const response = await verifyPaymentById({
        razorpay_payment_id: paymentData.razorpay_payment_id,
        expectedAmount: currentBreakdown.totalAmount,
      });

      const verificationResult = response.data as any;
      console.log('✅ Payment verified:', verificationResult);

      // Create booking
      const createVerifiedBooking = httpsCallable(functionsInstance, 'createVerifiedBooking');
      const bookingResponse = await createVerifiedBooking({
        bookingData: {
          ...bookingData,
          paymentId: verificationResult.payment.id,
          paymentDetails: verificationResult.payment,
        },
        verifiedPayment: verificationResult,
        pricingInput: {
          turfId: turf.id,
          date: currentDate,
          startTime: currentStartTime,
          endTime: currentEndTime,
          rewardCode: normalizedRewardCode || undefined,
          requestedSpiritPoints: requestedPoints,
        },
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
  const pricingSnapshot = useMemo(
    () => resolveTurfPricing(turf, startTime || '10:00'),
    [turf, startTime]
  );

  const baseTurfAmount = useMemo(() => {
    if (!startTime || !endTime) {
      return 0;
    }

    return calculateBookingBaseAmount(turf, startTime, endTime).baseTurfAmount;
  }, [turf, startTime, endTime]);
  
  const breakdown = useMemo(() => 
    calculatePaymentBreakdown(baseTurfAmount),
    [baseTurfAmount]
  );

  const effectiveBreakdown = pricingQuote?.breakdown || breakdown;
  const effectiveDiscount = pricingQuote?.selectedDiscount || null;
  
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

          {!timeRangeValid && startTime && endTime && (
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={18} color="#f59e0b" />
              <Text style={styles.warningText}>
                Some slots in this range are already booked
              </Text>
            </View>
          )}
        </View>

        {/* Offers & Spirit Points */}
        {startTime && endTime && timeRangeValid && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.breakdownHeader}
              onPress={() => setShowOffers(!showOffers)}
            >
              <Text style={styles.sectionTitle}>Offers & Spirit Points</Text>
              <View style={styles.offerHeaderActions}>
                {quoteLoading && <ActivityIndicator size="small" color="#16a34a" />}
                <Ionicons
                  name={showOffers ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color="#111827"
                />
              </View>
            </TouchableOpacity>

            {showOffers && (
              <View style={styles.offerCard}>
                <Text style={styles.offerLabel}>Milestone Reward Code</Text>
                <TextInput
                  style={styles.offerInput}
                  placeholder="Enter your reward code"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="characters"
                  value={rewardCode}
                  onChangeText={setRewardCode}
                />

                <View style={styles.pointsHeaderRow}>
                  <Text style={styles.offerLabel}>Spirit Points</Text>
                  <Text style={styles.pointsMetaText}>
                    Available: {availableSpiritPoints}
                  </Text>
                </View>

                <View style={styles.pointsSliderContainer}>
                  <View
                    style={styles.pointsSliderTrack}
                    onLayout={(event) => setSliderTrackWidth(event.nativeEvent.layout.width)}
                    onStartShouldSetResponder={() => true}
                    onResponderGrant={(event) => handleSpiritSliderTouch(event.nativeEvent.locationX)}
                    onResponderMove={(event) => handleSpiritSliderTouch(event.nativeEvent.locationX)}
                  >
                    <View
                      style={[
                        styles.pointsSliderFill,
                        {
                          width:
                            availableSpiritPoints > 0
                              ? `${Math.min(100, (requestedSpiritPoints / availableSpiritPoints) * 100)}%`
                              : '0%',
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.pointsSliderThumb,
                        {
                          left:
                            availableSpiritPoints > 0
                              ? `${Math.min(100, (requestedSpiritPoints / availableSpiritPoints) * 100)}%`
                              : '0%',
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.pointsScaleRow}>
                    <Text style={styles.pointsScaleText}>0</Text>
                    <Text style={styles.pointsScaleText}>{availableSpiritPoints}</Text>
                  </View>
                </View>

                <Text style={styles.pointsSelectedText}>{requestedSpiritPoints} points</Text>

                <Text style={styles.pointsValueHint}>
                  Approx discount value: {formatCurrency(requestedSpiritPoints * 0.5)}
                </Text>

                {quoteError ? <Text style={styles.quoteErrorText}>{quoteError}</Text> : null}
              </View>
            )}
          </View>
        )}

        {/* Payment Breakdown - COLLAPSIBLE */}
        {startTime && endTime && timeRangeValid && (
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
                    Base Turf Amount ({duration}h x {formatCurrency(pricingSnapshot.pricePerHour)})
                  </Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(effectiveBreakdown.baseTurfAmount)}
                  </Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Platform Commission</Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(effectiveBreakdown.platformCommission)}
                  </Text>
                </View>
                {(effectiveBreakdown.discountAmount || 0) > 0 && (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownDiscountLabel}>
                      Discount ({effectiveBreakdown.discountLabel || 'Best available offer'})
                    </Text>
                    <Text style={styles.breakdownDiscountValue}>
                      -{formatCurrency(effectiveBreakdown.discountAmount || 0)}
                    </Text>
                  </View>
                )}
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>
                    Payment Gateway Fee (2.07%)
                  </Text>
                  <Text style={styles.breakdownValue}>
                    {formatCurrency(effectiveBreakdown.razorpayFee)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabelTotal}>Total Amount</Text>
                  <Text style={styles.breakdownValueTotal}>
                    {formatCurrency(effectiveBreakdown.totalAmount)}
                  </Text>
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
            (!startTime || !endTime || !agreedToTerms || loading || !timeRangeValid) &&
              styles.bookButtonDisabled,
          ]}
          onPress={handlePayment}
          disabled={!startTime || !endTime || !agreedToTerms || loading || !timeRangeValid}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.bookButtonText}>
                Pay {formatCurrency(effectiveBreakdown.totalAmount)}
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
          amount={effectiveBreakdown.totalAmount}
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
  offerHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  offerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    gap: 10,
  },
  offerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  offerInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  pointsHeaderRow: {
    marginTop: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsMetaText: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  pointsSliderContainer: {
    gap: 8,
  },
  pointsSliderTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
  },
  pointsSliderFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#16a34a',
  },
  pointsSliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  pointsScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pointsScaleText: {
    fontSize: 11,
    color: '#64748b',
  },
  pointsSelectedText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  pointsValueHint: {
    fontSize: 12,
    color: '#334155',
    textAlign: 'center',
  },
  quoteErrorText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
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
  breakdownDiscountLabel: {
    fontSize: 14,
    color: '#15803d',
    flex: 1,
    fontWeight: '600',
  },
  breakdownDiscountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#16a34a',
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
