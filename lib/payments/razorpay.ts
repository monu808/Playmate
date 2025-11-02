// Razorpay Payment Integration (CRITICAL)
import { PLATFORM_COMMISSION, RAZORPAY_FEE_PERCENTAGE, RAZORPAY_KEY_ID } from '../constants';
import { PaymentBreakdown } from '../../types';
import { calculateBaseTurfAmount, calculatePaymentBreakdown } from '../utils';

// Note: react-native-razorpay will be installed separately
// import RazorpayCheckout from 'react-native-razorpay';

export interface BookingData {
  turfId: string;
  turfName: string;
  turfPrice: number;
  date: string;
  startTime: string;
  endTime: string;
  userId: string;
}

export interface UserDetails {
  name: string;
  email: string;
  phone: string;
}

export interface PaymentOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
}

export interface PaymentResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Calculate payment breakdown for a booking
 * This is the CRITICAL function that calculates the Rs 25 commission
 */
export function getBookingPaymentBreakdown(
  pricePerHour: number,
  startTime: string,
  endTime: string
): PaymentBreakdown {
  const baseTurfAmount = calculateBaseTurfAmount(pricePerHour, startTime, endTime);
  return calculatePaymentBreakdown(baseTurfAmount);
}

/**
 * Initiate Razorpay payment
 * Note: This requires backend API endpoints to create and verify orders
 */
export async function initiatePayment(
  bookingData: BookingData,
  userDetails: UserDetails,
  apiBaseUrl: string
): Promise<{ success: boolean; bookingId?: string; error?: string; breakdown?: PaymentBreakdown }> {
  try {
    // 1. Calculate payment breakdown
    const breakdown = getBookingPaymentBreakdown(
      bookingData.turfPrice,
      bookingData.startTime,
      bookingData.endTime
    );

    // 2. Create order on backend
    const response = await fetch(`${apiBaseUrl}/api/payment/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: breakdown.totalAmount,
        bookingData,
        breakdown,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment order');
    }

    const { orderId, amount, currency } = await response.json();

    // 3. Open Razorpay checkout
    // Uncomment when react-native-razorpay is installed:
    /*
    const options: PaymentOptions = {
      key: RAZORPAY_KEY_ID, // rzp_test_RVSNX0MyGKgNm9
      amount: amount * 100, // Convert to paise
      currency,
      name: 'Playmate Turf Booking',
      description: `Book ${bookingData.turfName}`,
      order_id: orderId,
      prefill: {
        name: userDetails.name,
        email: userDetails.email,
        contact: userDetails.phone,
      },
      theme: {
        color: '#16a34a', // Primary green color
      },
    };

    const data = await RazorpayCheckout.open(options);
    */

    // For now, return a placeholder
    // This will be replaced with actual Razorpay integration
    const data = {
      razorpay_payment_id: 'pay_test_' + Date.now(),
      razorpay_order_id: orderId,
      razorpay_signature: 'sig_test_' + Date.now(),
    };

    // 4. Verify payment on backend
    const verifyResponse = await fetch(`${apiBaseUrl}/api/payment/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpay_order_id: orderId,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        bookingData,
        userDetails,
        breakdown,
      }),
    });

    if (!verifyResponse.ok) {
      throw new Error('Payment verification failed');
    }

    const result = await verifyResponse.json();

    return {
      success: true,
      bookingId: result.bookingId,
      breakdown: result.breakdown,
    };
  } catch (error: any) {
    console.error('Payment error:', error);
    return {
      success: false,
      error: error.message || 'Payment failed. Please try again.',
    };
  }
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(
  pricePerHour: number,
  startTime: string,
  endTime: string,
  receivedAmount: number
): boolean {
  const breakdown = getBookingPaymentBreakdown(pricePerHour, startTime, endTime);
  // Allow small floating point differences
  return Math.abs(breakdown.totalAmount - receivedAmount) < 0.01;
}

/**
 * Format payment details for display
 */
export function formatPaymentBreakdown(breakdown: PaymentBreakdown): {
  label: string;
  value: string;
  bold?: boolean;
  highlighted?: boolean;
}[] {
  return [
    {
      label: `Turf Booking`,
      value: `₹${breakdown.baseTurfAmount.toFixed(2)}`,
    },
    {
      label: 'Platform Fee',
      value: `₹${breakdown.platformCommission.toFixed(2)}`,
    },
    {
      label: 'Payment Gateway Charges',
      value: `₹${breakdown.razorpayFee.toFixed(2)}`,
    },
    {
      label: 'You Pay',
      value: `₹${breakdown.totalAmount.toFixed(2)}`,
      bold: true,
      highlighted: true,
    },
  ];
}
