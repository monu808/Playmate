// Utility Functions

import {
  CANCELLATION_FULL_REFUND_WINDOW_MINUTES,
  DEFAULT_DAY_START_TIME,
  DEFAULT_DYNAMIC_BOUNDARY_TIME,
  DEFAULT_HAPPY_HOUR_DISCOUNT_PERCENT,
  DEFAULT_HAPPY_HOUR_ENABLED,
  DEFAULT_HAPPY_HOUR_END_TIME,
  DEFAULT_HAPPY_HOUR_LEAD_TIME_MINUTES,
  DEFAULT_HAPPY_HOUR_START_TIME,
  DEFAULT_MANUAL_ACTIVE_PERIOD,
  LATE_CANCELLATION_CHARGE,
  LATE_CANCELLATION_OWNER_SHARE,
  PLATFORM_COMMISSION,
  RAZORPAY_FEE_PERCENTAGE,
  SPIRIT_POINT_RUPEE_VALUE,
} from './constants';
import { AppliedDiscount, PaymentBreakdown, PricingPeriod, Turf } from '../types';

export interface ResolvedTurfPricing {
  appliedPeriod: PricingPeriod;
  boundaryTime: string;
  dayPricePerHour: number;
  nightPricePerHour: number;
  dynamicPricingEnabled: boolean;
  manualActivePeriod: PricingPeriod;
  pricePerHour: number;
}

export interface HappyHourConfig {
  enabled: boolean;
  discountPercent: number;
  startTime: string;
  endTime: string;
  leadTimeMinutes: number;
}

export interface BookingPricingQuote {
  baseTurfAmount: number;
  durationHours: number;
  pricing: ResolvedTurfPricing;
  happyHour: HappyHourConfig & { eligible: boolean };
  availableSpiritPoints: number;
  selectedDiscount: AppliedDiscount;
  breakdown: PaymentBreakdown;
}

export interface CancellationBreakdown {
  canCancel: boolean;
  minutesBeforeStart: number;
  isFullRefund: boolean;
  refundAmount: number;
  cancellationCharge: number;
  ownerCompensation: number;
  platformRetention: number;
  policyApplied: 'full_refund' | 'late_cancellation_fee';
}

/**
 * Format currency as Indian Rupees
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Parse booking date + time into a single Date object in local timezone.
 */
export function getBookingStartDateTime(date: string, startTime: string): Date {
  return new Date(`${date}T${startTime}:00`);
}

/**
 * Calculate refund/cancellation policy output for a booking.
 */
export function calculateCancellationBreakdown(
  totalAmount: number,
  bookingDate: string,
  startTime: string,
  currentTime: Date = new Date()
): CancellationBreakdown {
  const bookingStart = getBookingStartDateTime(bookingDate, startTime);

  if (Number.isNaN(bookingStart.getTime())) {
    return {
      canCancel: false,
      minutesBeforeStart: -1,
      isFullRefund: false,
      refundAmount: 0,
      cancellationCharge: 0,
      ownerCompensation: 0,
      platformRetention: 0,
      policyApplied: 'late_cancellation_fee',
    };
  }

  const diffMs = bookingStart.getTime() - currentTime.getTime();
  const minutesBeforeStart = Math.floor(diffMs / 60000);
  const canCancel = minutesBeforeStart >= 0;

  if (!canCancel) {
    return {
      canCancel: false,
      minutesBeforeStart,
      isFullRefund: false,
      refundAmount: 0,
      cancellationCharge: 0,
      ownerCompensation: 0,
      platformRetention: 0,
      policyApplied: 'late_cancellation_fee',
    };
  }

  const isFullRefund = minutesBeforeStart >= CANCELLATION_FULL_REFUND_WINDOW_MINUTES;
  const cancellationCharge = isFullRefund ? 0 : Math.min(LATE_CANCELLATION_CHARGE, totalAmount);
  const ownerCompensation = isFullRefund ? 0 : Math.min(LATE_CANCELLATION_OWNER_SHARE, cancellationCharge);
  const platformRetention = isFullRefund ? 0 : Math.max(0, cancellationCharge - ownerCompensation);
  const refundAmount = Math.max(0, totalAmount - cancellationCharge);

  return {
    canCancel,
    minutesBeforeStart,
    isFullRefund,
    refundAmount: parseFloat(refundAmount.toFixed(2)),
    cancellationCharge: parseFloat(cancellationCharge.toFixed(2)),
    ownerCompensation: parseFloat(ownerCompensation.toFixed(2)),
    platformRetention: parseFloat(platformRetention.toFixed(2)),
    policyApplied: isFullRefund ? 'full_refund' : 'late_cancellation_fee',
  };
}

/**
 * Calculate base turf amount (without commission) - supports 30-minute intervals
 */
export function calculateBaseTurfAmount(
  pricePerHour: number,
  startTime: string,
  endTime: string
): number {
  const duration = calculateDuration(startTime, endTime);
  return pricePerHour * duration;
}

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Calculate complete payment breakdown (CRITICAL FUNCTION)
 */
export function calculatePaymentBreakdown(
  baseTurfAmount: number,
  discount?: AppliedDiscount
): PaymentBreakdown {
  const originalSubtotal = baseTurfAmount + PLATFORM_COMMISSION;
  const discountAmount = clamp(discount?.amount || 0, 0, originalSubtotal);
  const subtotal = Math.max(0, originalSubtotal - discountAmount);
  const razorpayFee = subtotal * (RAZORPAY_FEE_PERCENTAGE / 100);
  const totalAmount = subtotal + razorpayFee;
  const ownerShare = baseTurfAmount;
  const basePlatformShare = PLATFORM_COMMISSION - (PLATFORM_COMMISSION * (RAZORPAY_FEE_PERCENTAGE / 100));
  const platformShare = basePlatformShare - discountAmount;
  
  return {
    baseTurfAmount: parseFloat(baseTurfAmount.toFixed(2)),
    platformCommission: PLATFORM_COMMISSION,
    razorpayFee: parseFloat(razorpayFee.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    ownerShare: parseFloat(ownerShare.toFixed(2)),
    platformShare: parseFloat(platformShare.toFixed(2)),
    originalSubtotal: parseFloat(originalSubtotal.toFixed(2)),
    discountAmount: parseFloat(discountAmount.toFixed(2)),
    discountSource: discount?.source || 'none',
    discountLabel: discount?.label,
    rewardCode: discount?.rewardCode,
    spiritPointsRedeemed: discount?.spiritPointsUsed,
    isHappyHourApplied: discount?.source === 'happy_hour',
  };
}

/**
 * Parse HH:MM time string into total minutes.
 */
export function parseTimeToMinutes(time: string): number {
  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return (hours * 60) + minutes;
}

export function resolveHappyHourConfig(
  turf: Partial<Turf> | null | undefined
): HappyHourConfig {
  return {
    enabled: turf?.happyHourEnabled ?? DEFAULT_HAPPY_HOUR_ENABLED,
    discountPercent:
      typeof turf?.happyHourDiscountPercent === 'number'
        ? turf.happyHourDiscountPercent
        : DEFAULT_HAPPY_HOUR_DISCOUNT_PERCENT,
    startTime: turf?.happyHourStartTime || DEFAULT_HAPPY_HOUR_START_TIME,
    endTime: turf?.happyHourEndTime || DEFAULT_HAPPY_HOUR_END_TIME,
    leadTimeMinutes:
      typeof turf?.happyHourLeadTimeMinutes === 'number'
        ? turf.happyHourLeadTimeMinutes
        : DEFAULT_HAPPY_HOUR_LEAD_TIME_MINUTES,
  };
}

export function isWithinHappyHourWindow(
  slotStartTime: string,
  startTime: string = DEFAULT_HAPPY_HOUR_START_TIME,
  endTime: string = DEFAULT_HAPPY_HOUR_END_TIME
): boolean {
  const slotMinutes = parseTimeToMinutes(slotStartTime);
  const windowStartMinutes = parseTimeToMinutes(startTime);
  const windowEndMinutes = parseTimeToMinutes(endTime);

  return slotMinutes >= windowStartMinutes && slotMinutes <= windowEndMinutes;
}

export function calculateBookingPriceQuote(params: {
  turf: Partial<Turf> | null | undefined;
  bookingDate: string;
  startTime: string;
  endTime: string;
  now?: Date;
  rewardCode?: string;
  rewardCodeDiscountPercent?: number;
  requestedSpiritPoints?: number;
  availableSpiritPoints?: number;
}): BookingPricingQuote {
  const {
    turf,
    bookingDate,
    startTime,
    endTime,
    now = new Date(),
    rewardCode,
    rewardCodeDiscountPercent = 0,
    requestedSpiritPoints = 0,
    availableSpiritPoints = 0,
  } = params;

  const pricing = resolveTurfPricing(turf, startTime);
  const durationHours = calculateDuration(startTime, endTime);
  const baseTurfAmount = calculateBaseTurfAmount(pricing.pricePerHour, startTime, endTime);
  const happyHour = resolveHappyHourConfig(turf);

  const slotDateTime = getBookingStartDateTime(bookingDate, startTime);
  const minutesUntilSlot = Math.floor((slotDateTime.getTime() - now.getTime()) / 60000);
  const isHappyHourEligible =
    happyHour.enabled &&
    isWithinHappyHourWindow(startTime, happyHour.startTime, happyHour.endTime) &&
    minutesUntilSlot >= 0 &&
    minutesUntilSlot <= happyHour.leadTimeMinutes;

  const rewardDiscountAmount = rewardCode && rewardCodeDiscountPercent > 0
    ? (baseTurfAmount * rewardCodeDiscountPercent) / 100
    : 0;

  const cappedSpiritPoints = Math.max(
    0,
    Math.min(
      Math.floor(requestedSpiritPoints || 0),
      Math.floor(availableSpiritPoints || 0)
    )
  );
  const spiritDiscountAmount = cappedSpiritPoints * SPIRIT_POINT_RUPEE_VALUE;

  const candidates: AppliedDiscount[] = [];

  if (isHappyHourEligible) {
    candidates.push({
      source: 'happy_hour',
      label: `Happy Hour ${happyHour.discountPercent}% off`,
      amount: (baseTurfAmount * happyHour.discountPercent) / 100,
      percentage: happyHour.discountPercent,
    });
  }

  if (rewardDiscountAmount > 0) {
    candidates.push({
      source: 'reward_code',
      label: `${rewardCodeDiscountPercent}% milestone reward`,
      amount: rewardDiscountAmount,
      percentage: rewardCodeDiscountPercent,
      rewardCode,
    });
  }

  if (spiritDiscountAmount > 0) {
    candidates.push({
      source: 'spirit_points',
      label: `Spirit points (${cappedSpiritPoints})`,
      amount: spiritDiscountAmount,
      spiritPointsUsed: cappedSpiritPoints,
    });
  }

  const priority: Record<AppliedDiscount['source'], number> = {
    reward_code: 3,
    happy_hour: 2,
    spirit_points: 1,
    none: 0,
  };

  const selectedDiscount = candidates.sort((a, b) => {
    if (b.amount === a.amount) {
      return (priority[b.source] || 0) - (priority[a.source] || 0);
    }
    return b.amount - a.amount;
  })[0] || {
    source: 'none' as const,
    label: 'No discount applied',
    amount: 0,
  };

  return {
    baseTurfAmount: parseFloat(baseTurfAmount.toFixed(2)),
    durationHours,
    pricing,
    happyHour: {
      ...happyHour,
      eligible: isHappyHourEligible,
    },
    availableSpiritPoints: Math.floor(availableSpiritPoints || 0),
    selectedDiscount,
    breakdown: calculatePaymentBreakdown(baseTurfAmount, selectedDiscount),
  };
}

/**
 * Determine if pricing period should be night for a given time.
 */
export function isNightPricingTime(
  time: string,
  boundaryTime: string = DEFAULT_DYNAMIC_BOUNDARY_TIME,
  dayStartTime: string = DEFAULT_DAY_START_TIME
): boolean {
  const totalMinutes = parseTimeToMinutes(time);
  const boundaryMinutes = parseTimeToMinutes(boundaryTime);
  const dayStartMinutes = parseTimeToMinutes(dayStartTime);

  return totalMinutes >= boundaryMinutes || totalMinutes < dayStartMinutes;
}

/**
 * Resolve effective hourly price for a turf based on current pricing configuration.
 */
export function resolveTurfPricing(
  turf: Partial<Turf> | null | undefined,
  startTime: string
): ResolvedTurfPricing {
  const basePrice =
    typeof turf?.pricePerHour === 'number' && turf.pricePerHour > 0
      ? turf.pricePerHour
      : typeof turf?.price === 'number' && turf.price > 0
      ? turf.price
      : 0;

  const dayPricePerHour =
    typeof turf?.dayPricePerHour === 'number' && turf.dayPricePerHour > 0
      ? turf.dayPricePerHour
      : basePrice;

  const nightPricePerHour =
    typeof turf?.nightPricePerHour === 'number' && turf.nightPricePerHour > 0
      ? turf.nightPricePerHour
      : basePrice;

  const boundaryTime = turf?.dynamicBoundaryTime || DEFAULT_DYNAMIC_BOUNDARY_TIME;
  const dynamicPricingEnabled = turf?.dynamicPricingEnabled ?? false;
  const manualActivePeriod: PricingPeriod =
    turf?.manualActivePeriod === 'night' ? 'night' : DEFAULT_MANUAL_ACTIVE_PERIOD;

  const appliedPeriod: PricingPeriod = dynamicPricingEnabled
    ? (isNightPricingTime(startTime, boundaryTime) ? 'night' : 'day')
    : manualActivePeriod;

  const pricePerHour = appliedPeriod === 'night' ? nightPricePerHour : dayPricePerHour;

  return {
    appliedPeriod,
    boundaryTime,
    dayPricePerHour,
    nightPricePerHour,
    dynamicPricingEnabled,
    manualActivePeriod,
    pricePerHour,
  };
}

/**
 * Resolve booking base amount directly from turf pricing config and selected slot.
 */
export function calculateBookingBaseAmount(
  turf: Partial<Turf> | null | undefined,
  startTime: string,
  endTime: string
): { baseTurfAmount: number; pricing: ResolvedTurfPricing } {
  const pricing = resolveTurfPricing(turf, startTime);
  return {
    baseTurfAmount: calculateBaseTurfAmount(pricing.pricePerHour, startTime, endTime),
    pricing,
  };
}

/**
 * Format currency amount
 */
export function formatAmount(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

/**
 * Format date
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  };
  return d.toLocaleDateString('en-IN', options);
}

/**
 * Format time
 */
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

/**
 * Calculate duration in hours (supports 30-minute intervals and midnight crossing)
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  
  const startTotalMinutes = startHour * 60 + startMinute;
  let endTotalMinutes = endHour * 60 + endMinute;
  
  // Handle midnight crossing (e.g., 23:00 to 00:30)
  if (endTotalMinutes < startTotalMinutes) {
    endTotalMinutes += 24 * 60; // Add 24 hours
  }
  
  const durationMinutes = endTotalMinutes - startTotalMinutes;
  const durationHours = durationMinutes / 60;
  
  return durationHours;
}

/**
 * Calculate end time from start time and duration in hours
 */
export function calculateEndTime(startTime: string, durationHours: number): string {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMinute;
  const endTotalMinutes = startTotalMinutes + (durationHours * 60);
  
  const endHour = Math.floor(endTotalMinutes / 60) % 24;
  const endMinute = endTotalMinutes % 60;
  
  return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
}

/**
 * Get booking status color
 */
export function getStatusColor(status: string): string {
  switch (status) {
    case 'confirmed':
      return '#10b981';
    case 'pending':
      return '#f59e0b';
    case 'cancelled':
      return '#ef4444';
    case 'completed':
      return '#6b7280';
    default:
      return '#6b7280';
  }
}

/**
 * Validate email
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number (Indian format)
 */
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  message?: string;
} {
  if (password.length < 6) {
    return { isValid: false, message: 'Password must be at least 6 characters' };
  }
  return { isValid: true };
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return parseFloat(distance.toFixed(2));
}

/**
 * Truncate text
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Debounce function
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Check if slot is available
 */
export function isSlotAvailable(
  slot: { startTime: string; endTime: string },
  bookedSlots: Array<{ startTime: string; endTime: string }>
): boolean {
  return !bookedSlots.some(
    (booked) =>
      slot.startTime === booked.startTime && slot.endTime === booked.endTime
  );
}

/**
 * Get greeting based on time
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}
