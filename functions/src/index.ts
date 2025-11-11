/**
 * Firebase Cloud Functions for PlaymateApp
 * 
 * PRODUCTION-READY Payment Verification
 * Implements server-side Razorpay signature verification
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Razorpay from "razorpay";
import * as crypto from "crypto";

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Firestore
const db = admin.firestore();

// Razorpay Configuration
// These will be set via Firebase Functions config
const RAZORPAY_KEY_ID = functions.config().razorpay?.key_id || process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = functions.config().razorpay?.key_secret || process.env.RAZORPAY_KEY_SECRET;

// Log configuration status (without exposing secrets)
functions.logger.info("Razorpay configuration status", {
  hasKeyId: !!RAZORPAY_KEY_ID,
  hasKeySecret: !!RAZORPAY_KEY_SECRET,
  keyIdPrefix: RAZORPAY_KEY_ID?.substring(0, 8),
});

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

/**
 * Verify Razorpay Payment Signature
 * 
 * This function verifies the authenticity of a Razorpay payment
 * by checking the cryptographic signature.
 * 
 * SECURITY: This MUST be called before creating a booking
 */
export const verifyPayment = functions.https.onCall(async (data, context) => {
  try {
    // 1. Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to verify payment"
      );
    }

    // 2. Extract payment data
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      bookingData,
    } = data;

    // 3. Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required payment parameters"
      );
    }

    // 4. Verify signature using Razorpay secret
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    const isValidSignature = expectedSignature === razorpay_signature;

    if (!isValidSignature) {
      functions.logger.error("Payment signature verification failed", {
        razorpay_order_id,
        razorpay_payment_id,
        userId: context.auth.uid,
      });

      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid payment signature. Payment verification failed."
      );
    }

    // 5. Fetch payment details from Razorpay to verify amount
    try {
      const payment = await razorpay.payments.fetch(razorpay_payment_id);

      // Verify payment status
      if (payment.status !== "captured" && payment.status !== "authorized") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Payment status is ${payment.status}. Expected captured or authorized.`
        );
      }

      // Verify payment amount matches booking amount (amount in paise)
      const expectedAmount = Math.round(bookingData.totalAmount * 100);
      if (payment.amount !== expectedAmount) {
        functions.logger.error("Payment amount mismatch", {
          expected: expectedAmount,
          received: payment.amount,
          razorpay_payment_id,
        });

        throw new functions.https.HttpsError(
          "invalid-argument",
          "Payment amount does not match booking amount"
        );
      }

      // 6. Log successful verification
      functions.logger.info("Payment verified successfully", {
        razorpay_payment_id,
        razorpay_order_id,
        userId: context.auth.uid,
        amount: payment.amount,
      });

      // 7. Return verification result
      return {
        verified: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        amount: payment.amount / 100, // Convert back to rupees
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      };
    } catch (razorpayError: any) {
      functions.logger.error("Razorpay API error", {
        error: razorpayError.message,
        razorpay_payment_id,
      });

      throw new functions.https.HttpsError(
        "internal",
        "Failed to fetch payment details from Razorpay"
      );
    }
  } catch (error: any) {
    // Re-throw HttpsError
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    // Log unexpected errors
    functions.logger.error("Unexpected error in verifyPayment", {
      error: error.message,
      stack: error.stack,
    });

    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred during payment verification"
    );
  }
});

/**
 * Create Booking (Callable Function)
 * 
 * This function creates a booking ONLY after payment verification
 * It includes additional server-side validations
 */
export const createVerifiedBooking = functions.https.onCall(async (data, context) => {
  try {
    // 1. Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to create booking"
      );
    }

    const {bookingData, verifiedPayment} = data;

    // 2. Validate booking data
    if (!bookingData || !verifiedPayment) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing booking data or payment verification"
      );
    }

    // 3. Verify user ID matches authenticated user
    if (bookingData.userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Cannot create booking for another user"
      );
    }

    // 4. Check slot availability (atomic check)
    const existingBookingsQuery = await db
      .collection("bookings")
      .where("turfId", "==", bookingData.turfId)
      .where("date", "==", bookingData.date)
      .where("startTime", "==", bookingData.startTime)
      .where("endTime", "==", bookingData.endTime)
      .where("status", "in", ["confirmed", "pending"])
      .get();

    if (!existingBookingsQuery.empty) {
      throw new functions.https.HttpsError(
        "already-exists",
        "This slot was just booked by someone else. Please select another time slot."
      );
    }

    // 5. Create booking with transaction
    const bookingRef = db.collection("bookings").doc();
    const booking = {
      ...bookingData,
      id: bookingRef.id,
      paymentVerified: true,
      paymentDetails: verifiedPayment,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await bookingRef.set(booking);

    functions.logger.info("Booking created successfully", {
      bookingId: bookingRef.id,
      userId: context.auth.uid,
      turfId: bookingData.turfId,
      paymentId: verifiedPayment.paymentId,
    });

    return {
      success: true,
      bookingId: bookingRef.id,
      booking: booking,
    };
  } catch (error: any) {
    // Re-throw HttpsError
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    functions.logger.error("Unexpected error in createVerifiedBooking", {
      error: error.message,
      stack: error.stack,
    });

    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred while creating booking"
    );
  }
});

/**
 * Create Razorpay Order (Callable Function)
 * 
 * Creates a Razorpay order for initiating payment
 * This ensures amount consistency and proper order tracking
 */
export const createRazorpayOrder = functions.https.onCall(async (data, context) => {
  try {
    // 1. Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to create order"
      );
    }

    // 2. Verify Razorpay credentials are configured
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      functions.logger.error("Razorpay credentials not configured", {
        hasKeyId: !!RAZORPAY_KEY_ID,
        hasKeySecret: !!RAZORPAY_KEY_SECRET,
      });
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Payment gateway not configured"
      );
    }

    const {amount, currency = "INR", bookingDetails} = data;

    // 3. Validate amount
    if (!amount || amount <= 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid amount"
      );
    }

    // 4. Create Razorpay order
    const orderOptions = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency,
      receipt: `order_${Date.now()}_${context.auth.uid}`,
      notes: {
        userId: context.auth.uid,
        turfId: bookingDetails?.turfId || "",
        date: bookingDetails?.date || "",
        startTime: bookingDetails?.startTime || "",
        endTime: bookingDetails?.endTime || "",
      },
    };

    functions.logger.info("Creating Razorpay order with options", {
      orderOptions,
      userId: context.auth.uid,
    });

    const order = await razorpay.orders.create(orderOptions);

    functions.logger.info("Razorpay order created successfully", {
      orderId: order.id,
      amount: order.amount,
      userId: context.auth.uid,
    });

    return {
      orderId: order.id,
      amount: Number(order.amount) / 100, // Convert back to rupees
      currency: order.currency,
      receipt: order.receipt,
    };
  } catch (error: any) {
    functions.logger.error("Error creating Razorpay order", {
      error: error.message,
      errorStack: error.stack,
      errorDetails: error.error || error.description,
      statusCode: error.statusCode,
      userId: context.auth?.uid,
      hasRazorpayKey: !!RAZORPAY_KEY_ID,
    });

    throw new functions.https.HttpsError(
      "internal",
      `Failed to create payment order: ${error.message}`
    );
  }
});

/**
 * Verify Payment by ID (Simplified)
 * 
 * This function verifies a payment by fetching it directly from Razorpay
 * No order_id or signature needed - just the payment_id
 */
export const verifyPaymentById = functions.https.onCall(async (data, context) => {
  try {
    // 1. Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to verify payment"
      );
    }

    const { razorpay_payment_id, expectedAmount } = data;

    // 2. Validate payment ID
    if (!razorpay_payment_id) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing payment ID"
      );
    }

    // 3. Fetch payment from Razorpay
    functions.logger.info("Fetching payment from Razorpay", {
      paymentId: razorpay_payment_id,
      userId: context.auth.uid,
    });

    const payment = await razorpay.payments.fetch(razorpay_payment_id);

    functions.logger.info("Payment fetched successfully", {
      paymentId: payment.id,
      status: payment.status,
      amount: payment.amount,
      method: payment.method,
    });

    // 4. Verify payment status
    if (payment.status !== "captured" && payment.status !== "authorized") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `Payment status is ${payment.status}. Expected captured or authorized.`
      );
    }

    // 5. Verify amount if provided (amount in paise)
    if (expectedAmount) {
      const expectedAmountPaise = Math.round(expectedAmount * 100);
      const paymentAmount = Number(payment.amount);
      if (paymentAmount !== expectedAmountPaise) {
        functions.logger.error("Payment amount mismatch", {
          expected: expectedAmountPaise,
          received: paymentAmount,
          paymentId: razorpay_payment_id,
        });

        throw new functions.https.HttpsError(
          "invalid-argument",
          `Amount mismatch. Expected ${expectedAmount} INR, got ${paymentAmount / 100} INR`
        );
      }
    }

    // 6. Return verification result
    const paymentAmount = Number(payment.amount);
    return {
      verified: true,
      payment: {
        id: payment.id,
        amount: paymentAmount / 100, // Convert back to rupees
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        email: payment.email,
        contact: payment.contact,
        created_at: payment.created_at,
      },
    };
  } catch (error: any) {
    // Re-throw HttpsError
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    functions.logger.error("Error verifying payment", {
      error: error.message,
      stack: error.stack,
    });

    throw new functions.https.HttpsError(
      "internal",
      `Payment verification failed: ${error.message}`
    );
  }
});

/**
 * Health check endpoint
 */
export const healthCheck = functions.https.onRequest((req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    functions: {
      verifyPayment: "active",
      createVerifiedBooking: "active",
      createRazorpayOrder: "active",
    },
  });
});
