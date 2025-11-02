// Utility Functions

import { PLATFORM_COMMISSION, RAZORPAY_FEE_PERCENTAGE } from './constants';
import { PaymentBreakdown } from '../types';

/**
 * Format currency as Indian Rupees
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/**
 * Calculate base turf amount (without commission)
 */
export function calculateBaseTurfAmount(
  pricePerHour: number,
  startTime: string,
  endTime: string
): number {
  const start = parseInt(startTime.split(':')[0]);
  const end = parseInt(endTime.split(':')[0]);
  const hours = end - start;
  return pricePerHour * hours;
}

/**
 * Calculate complete payment breakdown (CRITICAL FUNCTION)
 */
export function calculatePaymentBreakdown(baseTurfAmount: number): PaymentBreakdown {
  const subtotal = baseTurfAmount + PLATFORM_COMMISSION;
  const razorpayFee = subtotal * (RAZORPAY_FEE_PERCENTAGE / 100);
  const totalAmount = subtotal + razorpayFee;
  const ownerShare = baseTurfAmount;
  const platformShare = PLATFORM_COMMISSION - (PLATFORM_COMMISSION * 0.0207);
  
  return {
    baseTurfAmount: parseFloat(baseTurfAmount.toFixed(2)),
    platformCommission: PLATFORM_COMMISSION,
    razorpayFee: parseFloat(razorpayFee.toFixed(2)),
    subtotal: parseFloat(subtotal.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
    ownerShare: parseFloat(ownerShare.toFixed(2)),
    platformShare: parseFloat(platformShare.toFixed(2)),
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
 * Calculate duration in hours
 */
export function calculateDuration(startTime: string, endTime: string): number {
  const start = parseInt(startTime.split(':')[0]);
  const end = parseInt(endTime.split(':')[0]);
  return end - start;
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
