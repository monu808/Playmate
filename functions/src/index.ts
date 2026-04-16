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

const FULL_REFUND_WINDOW_MINUTES = 60;
const LATE_CANCELLATION_CHARGE_RUPEES = 30;
const LATE_CANCELLATION_OWNER_SHARE_RUPEES = 25;
const LATE_CANCELLATION_PLATFORM_SHARE_RUPEES = 5;
const PLATFORM_COMMISSION_RUPEES = 25;
const RAZORPAY_FEE_PERCENTAGE = 2.07;

const DEFAULT_DYNAMIC_BOUNDARY_TIME = "18:00";
const DEFAULT_DAY_START_TIME = "06:00";
const DEFAULT_MANUAL_ACTIVE_PERIOD = "day";

const DEFAULT_HAPPY_HOUR_ENABLED = true;
const DEFAULT_HAPPY_HOUR_DISCOUNT_PERCENT = 30;
const DEFAULT_HAPPY_HOUR_START_TIME = "11:00";
const DEFAULT_HAPPY_HOUR_END_TIME = "16:00";
const DEFAULT_HAPPY_HOUR_LEAD_TIME_MINUTES = 120;

const MILESTONE_COMPLETED_MATCHES = 5;
const MILESTONE_REWARD_DISCOUNT_PERCENT = 50;
const SPIRIT_POINT_RUPEE_VALUE = 0.5;
const SPIRIT_POINTS_EARNING_DIVISOR = 20;
const PLAYER_GROUP_MAX_MEMBERS = 50;
const PLAYER_GROUP_NAME_MAX_LENGTH = 50;
const PLAYER_GROUP_DESCRIPTION_MAX_LENGTH = 240;
const TURF_REVIEW_COMMENT_MAX_LENGTH = 500;

type DiscountSource = "none" | "happy_hour" | "reward_code" | "spirit_points";

interface AppliedDiscount {
  source: DiscountSource;
  label: string;
  amount: number;
  percentage?: number;
  rewardCode?: string;
  spiritPointsUsed?: number;
}

interface PricingBreakdown {
  baseTurfAmount: number;
  platformCommission: number;
  razorpayFee: number;
  subtotal: number;
  totalAmount: number;
  ownerShare: number;
  platformShare: number;
  originalSubtotal: number;
  discountAmount: number;
  discountSource: DiscountSource;
  discountLabel?: string;
  rewardCode?: string;
  spiritPointsRedeemed?: number;
  isHappyHourApplied: boolean;
}

interface ServerBookingPricingQuote {
  baseTurfAmount: number;
  durationHours: number;
  pricePerHour: number;
  appliedPricingPeriod: "day" | "night";
  happyHour: {
    enabled: boolean;
    discountPercent: number;
    startTime: string;
    endTime: string;
    leadTimeMinutes: number;
    eligible: boolean;
  };
  availableSpiritPoints: number;
  requestedSpiritPoints: number;
  rewardCodeValidation: {
    valid: boolean;
    message?: string;
    normalizedCode?: string;
  };
  selectedDiscount: AppliedDiscount;
  breakdown: PricingBreakdown;
}

interface PricingInput {
  turfId: string;
  date: string;
  startTime: string;
  endTime: string;
  rewardCode?: string;
  requestedSpiritPoints?: number;
}

const round2 = (value: number): number => {
  return parseFloat(value.toFixed(2));
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const parseTimeToMinutes = (time: string): number => {
  const [rawHours, rawMinutes] = String(time || "").split(":");
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return 0;
  }

  return (hours * 60) + minutes;
};

const calculateDurationHours = (startTime: string, endTime: string): number => {
  const startMinutes = parseTimeToMinutes(startTime);
  let endMinutes = parseTimeToMinutes(endTime);

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return (endMinutes - startMinutes) / 60;
};

const isNightPricingTime = (
  time: string,
  boundaryTime: string = DEFAULT_DYNAMIC_BOUNDARY_TIME,
  dayStartTime: string = DEFAULT_DAY_START_TIME
): boolean => {
  const totalMinutes = parseTimeToMinutes(time);
  const boundaryMinutes = parseTimeToMinutes(boundaryTime);
  const dayStartMinutes = parseTimeToMinutes(dayStartTime);

  return totalMinutes >= boundaryMinutes || totalMinutes < dayStartMinutes;
};

const isWithinHappyHourWindow = (
  slotStartTime: string,
  happyHourStartTime: string,
  happyHourEndTime: string
): boolean => {
  const slotMinutes = parseTimeToMinutes(slotStartTime);
  const startMinutes = parseTimeToMinutes(happyHourStartTime);
  const endMinutes = parseTimeToMinutes(happyHourEndTime);

  return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
};

const normalizeRewardCode = (value: unknown): string => {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
};

const normalizeEmail = (value: unknown): string => {
  return String(value || "").trim().toLowerCase();
};

const getUserDisplayName = (userData: any, fallbackEmail?: string): string => {
  const fromProfile =
    String(userData?.name || "").trim() ||
    String(userData?.displayName || "").trim();

  if (fromProfile) {
    return fromProfile;
  }

  const safeEmail = String(fallbackEmail || "").trim();
  if (safeEmail.includes("@")) {
    return safeEmail.split("@")[0];
  }

  return "Player";
};

const calculatePaymentBreakdown = (
  baseTurfAmount: number,
  discount: AppliedDiscount
): PricingBreakdown => {
  const originalSubtotal = baseTurfAmount + PLATFORM_COMMISSION_RUPEES;
  const discountAmount = clamp(discount.amount || 0, 0, originalSubtotal);
  const subtotal = Math.max(0, originalSubtotal - discountAmount);
  const razorpayFee = subtotal * (RAZORPAY_FEE_PERCENTAGE / 100);
  const totalAmount = subtotal + razorpayFee;
  const ownerShare = baseTurfAmount;
  const basePlatformShare =
    PLATFORM_COMMISSION_RUPEES - (PLATFORM_COMMISSION_RUPEES * (RAZORPAY_FEE_PERCENTAGE / 100));
  const platformShare = basePlatformShare - discountAmount;

  return {
    baseTurfAmount: round2(baseTurfAmount),
    platformCommission: PLATFORM_COMMISSION_RUPEES,
    razorpayFee: round2(razorpayFee),
    subtotal: round2(subtotal),
    totalAmount: round2(totalAmount),
    ownerShare: round2(ownerShare),
    platformShare: round2(platformShare),
    originalSubtotal: round2(originalSubtotal),
    discountAmount: round2(discountAmount),
    discountSource: discount.source,
    discountLabel: discount.label,
    rewardCode: discount.rewardCode,
    spiritPointsRedeemed: discount.spiritPointsUsed,
    isHappyHourApplied: discount.source === "happy_hour",
  };
};

const calculatePointsForCompletedMatch = (baseTurfAmount: number): number => {
  if (!baseTurfAmount || baseTurfAmount <= 0) {
    return 0;
  }

  return Math.max(1, Math.floor(baseTurfAmount / SPIRIT_POINTS_EARNING_DIVISOR));
};

const getNextMilestone = (completedMatchesCount: number): number => {
  const safeCompleted = Math.max(0, Math.floor(completedMatchesCount || 0));
  return (Math.floor(safeCompleted / MILESTONE_COMPLETED_MATCHES) + 1) * MILESTONE_COMPLETED_MATCHES;
};

const generateMilestoneRewardCode = (userId: string, milestoneCompletedCount: number): string => {
  const suffix = userId.slice(-4).toUpperCase();
  return `SPIRIT${milestoneCompletedCount}${suffix}`;
};

const getServerPricingQuote = async (
  userId: string,
  input: PricingInput,
  now: Date = new Date()
): Promise<ServerBookingPricingQuote> => {
  const turfSnap = await db.collection("turfs").doc(input.turfId).get();

  if (!turfSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Turf not found");
  }

  const turf = turfSnap.data() || {};

  const basePricePerHour =
    typeof turf.pricePerHour === "number" && turf.pricePerHour > 0
      ? turf.pricePerHour
      : typeof turf.price === "number" && turf.price > 0
      ? turf.price
      : 0;

  const dayPricePerHour =
    typeof turf.dayPricePerHour === "number" && turf.dayPricePerHour > 0
      ? turf.dayPricePerHour
      : basePricePerHour;

  const nightPricePerHour =
    typeof turf.nightPricePerHour === "number" && turf.nightPricePerHour > 0
      ? turf.nightPricePerHour
      : basePricePerHour;

  const dynamicBoundaryTime = turf.dynamicBoundaryTime || DEFAULT_DYNAMIC_BOUNDARY_TIME;
  const dynamicPricingEnabled = turf.dynamicPricingEnabled ?? false;
  const manualActivePeriod = turf.manualActivePeriod === "night" ? "night" : DEFAULT_MANUAL_ACTIVE_PERIOD;

  const appliedPricingPeriod: "day" | "night" = dynamicPricingEnabled
    ? (isNightPricingTime(input.startTime, dynamicBoundaryTime) ? "night" : "day")
    : (manualActivePeriod as "day" | "night");

  const pricePerHour = appliedPricingPeriod === "night" ? nightPricePerHour : dayPricePerHour;
  const durationHours = calculateDurationHours(input.startTime, input.endTime);
  const baseTurfAmount = pricePerHour * durationHours;

  const happyHourConfig = {
    enabled: turf.happyHourEnabled ?? DEFAULT_HAPPY_HOUR_ENABLED,
    discountPercent:
      typeof turf.happyHourDiscountPercent === "number"
        ? turf.happyHourDiscountPercent
        : DEFAULT_HAPPY_HOUR_DISCOUNT_PERCENT,
    startTime: turf.happyHourStartTime || DEFAULT_HAPPY_HOUR_START_TIME,
    endTime: turf.happyHourEndTime || DEFAULT_HAPPY_HOUR_END_TIME,
    leadTimeMinutes:
      typeof turf.happyHourLeadTimeMinutes === "number"
        ? turf.happyHourLeadTimeMinutes
        : DEFAULT_HAPPY_HOUR_LEAD_TIME_MINUTES,
  };

  const bookingStartDateTime = parseBookingStartDateTime(input.date, input.startTime);
  const minutesUntilSlot = Math.floor((bookingStartDateTime.getTime() - now.getTime()) / 60000);
  const happyHourEligible =
    happyHourConfig.enabled &&
    isWithinHappyHourWindow(input.startTime, happyHourConfig.startTime, happyHourConfig.endTime) &&
    minutesUntilSlot >= 0 &&
    minutesUntilSlot <= happyHourConfig.leadTimeMinutes;

  const userSnap = await db.collection("users").doc(userId).get();
  const userData = userSnap.data() || {};
  const availableSpiritPoints = Math.max(0, Number(userData.spiritPoints || 0));
  const requestedSpiritPoints = Math.max(0, Math.floor(Number(input.requestedSpiritPoints || 0)));

  const normalizedCode = normalizeRewardCode(input.rewardCode);
  const rewardCodeValidation: ServerBookingPricingQuote["rewardCodeValidation"] = {
    valid: false,
    normalizedCode: normalizedCode || undefined,
  };

  let rewardCodeDiscountPercent = 0;
  let rewardCodeApplied: string | undefined;

  if (normalizedCode) {
    const rewardCodeSnap = await db.collection("rewardCodes").doc(normalizedCode).get();

    if (!rewardCodeSnap.exists) {
      rewardCodeValidation.message = "Reward code not found";
    } else {
      const rewardCodeData = rewardCodeSnap.data() || {};
      const isOwnerMatch = rewardCodeData.userId === userId;
      const isStatusActive = rewardCodeData.status === "active";
      const isExpired =
        rewardCodeData.expiresAt && rewardCodeData.expiresAt.toDate
          ? rewardCodeData.expiresAt.toDate().getTime() < now.getTime()
          : false;

      if (!isOwnerMatch) {
        rewardCodeValidation.message = "This reward code does not belong to you";
      } else if (!isStatusActive) {
        rewardCodeValidation.message = "Reward code is not active";
      } else if (isExpired) {
        rewardCodeValidation.message = "Reward code has expired";
      } else {
        rewardCodeValidation.valid = true;
        rewardCodeValidation.message = "Reward code applied";
        rewardCodeDiscountPercent = Number(rewardCodeData.discountPercent || MILESTONE_REWARD_DISCOUNT_PERCENT);
        rewardCodeApplied = normalizedCode;
      }
    }
  }

  const candidates: AppliedDiscount[] = [];

  if (happyHourEligible) {
    candidates.push({
      source: "happy_hour",
      label: `Happy Hour ${happyHourConfig.discountPercent}% off`,
      amount: (baseTurfAmount * happyHourConfig.discountPercent) / 100,
      percentage: happyHourConfig.discountPercent,
    });
  }

  if (rewardCodeValidation.valid && rewardCodeDiscountPercent > 0) {
    candidates.push({
      source: "reward_code",
      label: `${rewardCodeDiscountPercent}% milestone reward`,
      amount: (baseTurfAmount * rewardCodeDiscountPercent) / 100,
      percentage: rewardCodeDiscountPercent,
      rewardCode: rewardCodeApplied,
    });
  }

  const spiritPointsToUse = Math.min(availableSpiritPoints, requestedSpiritPoints);
  if (spiritPointsToUse > 0) {
    candidates.push({
      source: "spirit_points",
      label: `Spirit points (${spiritPointsToUse})`,
      amount: spiritPointsToUse * SPIRIT_POINT_RUPEE_VALUE,
      spiritPointsUsed: spiritPointsToUse,
    });
  }

  const priority: Record<DiscountSource, number> = {
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
    source: "none" as const,
    label: "No discount applied",
    amount: 0,
  };

  return {
    baseTurfAmount: round2(baseTurfAmount),
    durationHours: round2(durationHours),
    pricePerHour: round2(pricePerHour),
    appliedPricingPeriod,
    happyHour: {
      ...happyHourConfig,
      eligible: happyHourEligible,
    },
    availableSpiritPoints,
    requestedSpiritPoints,
    rewardCodeValidation,
    selectedDiscount,
    breakdown: calculatePaymentBreakdown(baseTurfAmount, selectedDiscount),
  };
};

type RefundStatus = "none" | "pending" | "processed" | "failed";

interface CancellationBreakdown {
  canCancel: boolean;
  minutesBeforeStart: number;
  policyApplied: "full_refund" | "late_cancellation_fee";
  refundAmount: number;
  cancellationCharge: number;
  ownerCompensation: number;
  platformRetention: number;
}

const parseBookingStartDateTime = (date: string, startTime: string): Date => {
  return new Date(`${date}T${startTime}:00`);
};

const parseBookingEndDateTime = (
  date: string,
  endTime?: string,
  startTime?: string
): Date => {
  const safeTime = endTime || startTime || "00:00";
  return new Date(`${date}T${safeTime}:00`);
};

const isPlayerFinderPostExpired = (post: any, now: Date = new Date()): boolean => {
  const endDateTime = parseBookingEndDateTime(
    String(post?.date || ""),
    typeof post?.endTime === "string" ? post.endTime : undefined,
    typeof post?.startTime === "string" ? post.startTime : undefined
  );

  if (Number.isNaN(endDateTime.getTime())) {
    return false;
  }

  return endDateTime.getTime() <= now.getTime();
};

const deleteDocumentReferencesInChunks = async (
  refs: admin.firestore.DocumentReference[]
): Promise<number> => {
  if (!refs.length) {
    return 0;
  }

  const maxBatchSize = 450;
  let deletedCount = 0;

  for (let i = 0; i < refs.length; i += maxBatchSize) {
    const slice = refs.slice(i, i + maxBatchSize);
    const batch = db.batch();

    slice.forEach((ref) => {
      batch.delete(ref);
    });

    await batch.commit();
    deletedCount += slice.length;
  }

  return deletedCount;
};

const calculateCancellationBreakdown = (
  totalAmount: number,
  date: string,
  startTime: string,
  now: Date = new Date()
): CancellationBreakdown => {
  const bookingStart = parseBookingStartDateTime(date, startTime);

  if (Number.isNaN(bookingStart.getTime())) {
    return {
      canCancel: false,
      minutesBeforeStart: -1,
      policyApplied: "late_cancellation_fee",
      refundAmount: 0,
      cancellationCharge: 0,
      ownerCompensation: 0,
      platformRetention: 0,
    };
  }

  const minutesBeforeStart = Math.floor((bookingStart.getTime() - now.getTime()) / 60000);

  if (minutesBeforeStart < 0) {
    return {
      canCancel: false,
      minutesBeforeStart,
      policyApplied: "late_cancellation_fee",
      refundAmount: 0,
      cancellationCharge: 0,
      ownerCompensation: 0,
      platformRetention: 0,
    };
  }

  const isFullRefund = minutesBeforeStart >= FULL_REFUND_WINDOW_MINUTES;
  const cancellationCharge = isFullRefund ? 0 : Math.min(LATE_CANCELLATION_CHARGE_RUPEES, totalAmount);
  const ownerCompensation = isFullRefund ? 0 : Math.min(LATE_CANCELLATION_OWNER_SHARE_RUPEES, cancellationCharge);
  const remainingAfterOwner = Math.max(0, cancellationCharge - ownerCompensation);
  const platformRetention = isFullRefund
    ? 0
    : Math.min(LATE_CANCELLATION_PLATFORM_SHARE_RUPEES, remainingAfterOwner);
  const refundAmount = Math.max(0, totalAmount - cancellationCharge);

  return {
    canCancel: true,
    minutesBeforeStart,
    policyApplied: isFullRefund ? "full_refund" : "late_cancellation_fee",
    refundAmount: parseFloat(refundAmount.toFixed(2)),
    cancellationCharge: parseFloat(cancellationCharge.toFixed(2)),
    ownerCompensation: parseFloat(ownerCompensation.toFixed(2)),
    platformRetention: parseFloat(platformRetention.toFixed(2)),
  };
};

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
    const authUid = context.auth.uid;

    const {bookingData, verifiedPayment, pricingInput} = data;

    // 2. Validate booking data
    if (!bookingData || !verifiedPayment) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing booking data or payment verification"
      );
    }

    // 3. Verify user ID matches authenticated user
    if (bookingData.userId !== authUid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Cannot create booking for another user"
      );
    }

    const normalizedPricingInput: PricingInput = {
      turfId: String(pricingInput?.turfId || bookingData?.turfId || "").trim(),
      date: String(pricingInput?.date || bookingData?.date || "").trim(),
      startTime: String(pricingInput?.startTime || bookingData?.startTime || "").trim(),
      endTime: String(pricingInput?.endTime || bookingData?.endTime || "").trim(),
      rewardCode:
        typeof pricingInput?.rewardCode === "string"
          ? pricingInput.rewardCode
          : typeof bookingData?.requestedRewardCode === "string"
          ? bookingData.requestedRewardCode
          : undefined,
      requestedSpiritPoints: Number(
        pricingInput?.requestedSpiritPoints ?? bookingData?.requestedSpiritPoints ?? 0
      ),
    };

    if (
      !normalizedPricingInput.turfId ||
      !normalizedPricingInput.date ||
      !normalizedPricingInput.startTime ||
      !normalizedPricingInput.endTime
    ) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required slot details for booking"
      );
    }

    // 4. Recalculate pricing on the server to prevent client-side tampering.
    const serverQuote = await getServerPricingQuote(
      authUid,
      normalizedPricingInput,
      new Date()
    );

    if (normalizedPricingInput.rewardCode && !serverQuote.rewardCodeValidation.valid) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        serverQuote.rewardCodeValidation.message || "Invalid reward code"
      );
    }

    const expectedAmountPaise = Math.round(serverQuote.breakdown.totalAmount * 100);
    const verifiedAmountRupees = Number(
      verifiedPayment?.payment?.amount ?? verifiedPayment?.amount ?? 0
    );
    const verifiedAmountPaise = Math.round(verifiedAmountRupees * 100);

    if (!verifiedAmountPaise || verifiedAmountPaise !== expectedAmountPaise) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Verified payment amount does not match server pricing"
      );
    }

    const clientSubmittedAmountPaise = Math.round(Number(bookingData?.totalAmount || 0) * 100);
    if (clientSubmittedAmountPaise !== expectedAmountPaise) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Client booking amount mismatch"
      );
    }

    const resolvedPaymentId =
      verifiedPayment?.paymentId ||
      verifiedPayment?.payment?.id ||
      bookingData?.paymentId ||
      "";

    const turfSnap = await db.collection("turfs").doc(normalizedPricingInput.turfId).get();
    const bookingSport = String(turfSnap.data()?.sport || bookingData?.sport || "football").trim() || "football";

    const bookingRef = db.collection("bookings").doc();
    const paymentTransactionRef = db.collection("transactions").doc();
    const userRef = db.collection("users").doc(authUid);
    let createdBooking: Record<string, unknown> | null = null;

    await db.runTransaction(async (transaction) => {
      const existingBookingsQuery = db
        .collection("bookings")
        .where("turfId", "==", normalizedPricingInput.turfId)
        .where("date", "==", normalizedPricingInput.date)
        .where("startTime", "==", normalizedPricingInput.startTime)
        .where("endTime", "==", normalizedPricingInput.endTime)
        .where("status", "in", ["confirmed", "pending"]);

      const existingBookingsSnap = await transaction.get(existingBookingsQuery);
      if (!existingBookingsSnap.empty) {
        throw new functions.https.HttpsError(
          "already-exists",
          "This slot was just booked by someone else. Please select another time slot."
        );
      }

      const nowValue = admin.firestore.FieldValue.serverTimestamp();
      let redeemedSpiritPoints = 0;
      let redeemedRewardCode: string | undefined;

      if (serverQuote.selectedDiscount.source === "spirit_points") {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists) {
          throw new functions.https.HttpsError("not-found", "User profile not found");
        }

        const userData = userSnap.data() || {};
        const currentPoints = Math.max(0, Number(userData.spiritPoints || 0));
        const pointsToUse = Math.max(
          0,
          Math.floor(Number(serverQuote.selectedDiscount.spiritPointsUsed || 0))
        );

        if (currentPoints < pointsToUse) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Insufficient spirit points"
          );
        }

        redeemedSpiritPoints = pointsToUse;
        transaction.update(userRef, {
          spiritPoints: currentPoints - pointsToUse,
          updatedAt: nowValue,
        });

        const redeemLedgerRef = db.collection("spiritPointsLedger").doc(`redeem_${bookingRef.id}`);
        transaction.set(redeemLedgerRef, {
          id: redeemLedgerRef.id,
          userId: authUid,
          bookingId: bookingRef.id,
          type: "redeemed",
          points: pointsToUse,
          rupeeValue: round2(pointsToUse * SPIRIT_POINT_RUPEE_VALUE),
          balanceBefore: currentPoints,
          balanceAfter: currentPoints - pointsToUse,
          description: "Spirit points redeemed during booking",
          createdAt: nowValue,
        });
      }

      if (serverQuote.selectedDiscount.source === "reward_code") {
        const normalizedCode = normalizeRewardCode(serverQuote.selectedDiscount.rewardCode);
        if (!normalizedCode) {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Missing reward code for redemption"
          );
        }

        const rewardCodeRef = db.collection("rewardCodes").doc(normalizedCode);
        const rewardCodeSnap = await transaction.get(rewardCodeRef);

        if (!rewardCodeSnap.exists) {
          throw new functions.https.HttpsError("not-found", "Reward code not found");
        }

        const rewardCodeData = rewardCodeSnap.data() || {};
        if (rewardCodeData.userId !== authUid || rewardCodeData.status !== "active") {
          throw new functions.https.HttpsError(
            "failed-precondition",
            "Reward code is no longer valid"
          );
        }

        redeemedRewardCode = normalizedCode;
        transaction.update(rewardCodeRef, {
          status: "redeemed",
          redeemedAt: nowValue,
          redeemedBookingId: bookingRef.id,
        });
      }

      const booking = {
        ...bookingData,
        id: bookingRef.id,
        turfId: normalizedPricingInput.turfId,
        sport: bookingSport,
        date: normalizedPricingInput.date,
        startTime: normalizedPricingInput.startTime,
        endTime: normalizedPricingInput.endTime,
        totalAmount: serverQuote.breakdown.totalAmount,
        paymentBreakdown: serverQuote.breakdown,
        appliedDiscount:
          serverQuote.selectedDiscount.source === "none" ? null : serverQuote.selectedDiscount,
        requestedRewardCode: normalizeRewardCode(normalizedPricingInput.rewardCode),
        redeemedRewardCode: redeemedRewardCode || null,
        requestedSpiritPoints: Math.max(0, Math.floor(normalizedPricingInput.requestedSpiritPoints || 0)),
        redeemedSpiritPoints,
        paymentVerified: true,
        paymentDetails: verifiedPayment,
        paymentId: resolvedPaymentId,
        createdAt: nowValue,
        updatedAt: nowValue,
      };

      transaction.set(bookingRef, booking);
      transaction.set(paymentTransactionRef, {
        id: paymentTransactionRef.id,
        type: "payment",
        bookingId: bookingRef.id,
        userId: authUid,
        turfId: normalizedPricingInput.turfId,
        turfName: bookingData.turfName || "",
        paymentId: resolvedPaymentId,
        amount: serverQuote.breakdown.totalAmount,
        currency: "INR",
        method: "razorpay",
        status: "success",
        timestamp: nowValue,
        createdAt: nowValue,
        updatedAt: nowValue,
        breakdown: serverQuote.breakdown,
        appliedDiscount:
          serverQuote.selectedDiscount.source === "none" ? null : serverQuote.selectedDiscount,
      });

      createdBooking = booking;
    });

    functions.logger.info("Booking created successfully", {
      bookingId: bookingRef.id,
      userId: authUid,
      turfId: normalizedPricingInput.turfId,
      paymentId: resolvedPaymentId,
      discountSource: serverQuote.selectedDiscount.source,
    });

    return {
      success: true,
      bookingId: bookingRef.id,
      booking: createdBooking,
      pricing: serverQuote,
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
 * Calculate booking pricing quote on server.
 *
 * This is the source of truth for all booking discounts and final payable amount.
 */
export const calculateBookingPricing = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to calculate booking pricing"
      );
    }

    const input: PricingInput = {
      turfId: String(data?.turfId || "").trim(),
      date: String(data?.date || "").trim(),
      startTime: String(data?.startTime || "").trim(),
      endTime: String(data?.endTime || "").trim(),
      rewardCode: typeof data?.rewardCode === "string" ? data.rewardCode : undefined,
      requestedSpiritPoints: Number(data?.requestedSpiritPoints || 0),
    };

    if (!input.turfId || !input.date || !input.startTime || !input.endTime) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required pricing fields"
      );
    }

    const quote = await getServerPricingQuote(context.auth.uid, input, new Date());

    return {
      ...quote,
      quoteGeneratedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    functions.logger.error("Error calculating booking pricing", {
      error: error.message,
      stack: error.stack,
      userId: context.auth?.uid,
    });

    throw new functions.https.HttpsError(
      "internal",
      "Failed to calculate booking pricing"
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
 * Cancel booking with policy-based refund to original payment source.
 *
 * Policy:
 * - Cancel >= 60 mins before start: full refund.
 * - Cancel < 60 mins before start: ₹30 cancellation charge.
 *   - ₹25 owner compensation
 *   - ₹5 platform retention
 */
export const cancelBookingWithRefund = functions.https.onCall(async (data, context) => {
  try {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated to cancel booking"
      );
    }

    const bookingId = data?.bookingId;

    if (!bookingId || typeof bookingId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing bookingId"
      );
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await bookingRef.get();

    if (!bookingSnap.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        "Booking not found"
      );
    }

    const booking = bookingSnap.data() as any;

    if (booking.userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You can only cancel your own bookings"
      );
    }

    if (booking.status === "cancelled") {
      return {
        success: true,
        alreadyCancelled: true,
        bookingId,
        refundDetails: booking.refundDetails || null,
      };
    }

    if (booking.status !== "confirmed") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Only confirmed bookings can be cancelled"
      );
    }

    const totalAmount = Number(booking.totalAmount || 0);
    if (totalAmount <= 0) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Invalid booking amount for refund"
      );
    }

    const paymentId =
      booking.paymentId ||
      booking.paymentDetails?.payment?.id ||
      booking.paymentDetails?.id;

    if (!paymentId) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Payment reference not found for this booking"
      );
    }

    const breakdown = calculateCancellationBreakdown(
      totalAmount,
      String(booking.date || ""),
      String(booking.startTime || "")
    );

    if (!breakdown.canCancel) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Booking can no longer be cancelled after start time"
      );
    }

    let refundId: string | null = null;
    let refundStatus: RefundStatus = "none";
    let refundFailureReason: string | null = null;

    if (breakdown.refundAmount > 0) {
      if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Payment gateway is not configured for refunds"
        );
      }

      try {
        const refund = await razorpay.payments.refund(paymentId, {
          amount: Math.round(breakdown.refundAmount * 100),
          speed: "normal",
          notes: {
            bookingId,
            userId: context.auth.uid,
            policyApplied: breakdown.policyApplied,
          },
        });

        refundId = refund.id;
        refundStatus = refund.status === "processed" ? "processed" : "pending";
      } catch (refundError: any) {
        refundStatus = "failed";
        refundFailureReason = refundError?.message || "Refund initiation failed";

        functions.logger.error("Refund initiation failed", {
          bookingId,
          paymentId,
          userId: context.auth.uid,
          error: refundError?.message,
        });
      }
    } else {
      refundStatus = "processed";
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const refundDetails = {
      status: refundStatus,
      policyApplied: breakdown.policyApplied,
      minutesBeforeStart: breakdown.minutesBeforeStart,
      refundAmount: breakdown.refundAmount,
      cancellationCharge: breakdown.cancellationCharge,
      ownerCompensation: breakdown.ownerCompensation,
      platformRetention: breakdown.platformRetention,
      refundId,
      initiatedAt: now,
      processedAt: refundStatus === "processed" ? now : null,
      failureReason: refundFailureReason,
    };

    const transactionRef = db.collection("transactions").doc();
    const batch = db.batch();

    batch.update(bookingRef, {
      status: "cancelled",
      cancelledBy: "user",
      cancelledAt: now,
      updatedAt: now,
      refundDetails,
    });

    batch.set(transactionRef, {
      id: transactionRef.id,
      type: "refund",
      bookingId,
      userId: context.auth.uid,
      turfId: booking.turfId || "",
      turfName: booking.turfName || "",
      paymentId,
      amount: breakdown.refundAmount,
      refundAmount: breakdown.refundAmount,
      cancellationCharge: breakdown.cancellationCharge,
      ownerCompensation: breakdown.ownerCompensation,
      platformRetention: breakdown.platformRetention,
      refundStatus,
      refundId,
      currency: "INR",
      method: "razorpay",
      status: refundStatus === "processed" ? "processed" : refundStatus,
      breakdown: booking.paymentBreakdown || null,
      timestamp: now,
      createdAt: now,
      updatedAt: now,
      metadata: {
        policyApplied: breakdown.policyApplied,
        minutesBeforeStart: breakdown.minutesBeforeStart,
      },
    });

    await batch.commit();

    functions.logger.info("Booking cancelled with refund policy", {
      bookingId,
      userId: context.auth.uid,
      paymentId,
      refundId,
      refundStatus,
      refundAmount: breakdown.refundAmount,
      cancellationCharge: breakdown.cancellationCharge,
      policyApplied: breakdown.policyApplied,
    });

    return {
      success: true,
      bookingId,
      refundDetails: {
        ...breakdown,
        status: refundStatus,
        refundId,
        failureReason: refundFailureReason,
      },
    };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    functions.logger.error("Unexpected error in cancelBookingWithRefund", {
      error: error.message,
      stack: error.stack,
    });

    throw new functions.https.HttpsError(
      "internal",
      "An unexpected error occurred while cancelling booking"
    );
  }
});

/**
 * Award spirit points and milestone reward code when a booking is completed.
 *
 * This trigger centralizes credit logic across all completion paths
 * (admin panel, owner scan QR, admin scan QR, etc.).
 */
export const onBookingCompletedAwardBenefits = functions.firestore
  .document("bookings/{bookingId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data() || {};
    const after = change.after.data() || {};

    if (before.status === "completed" || after.status !== "completed") {
      return;
    }

    const bookingId = context.params.bookingId as string;
    const userId = String(after.userId || "").trim();

    if (!userId) {
      functions.logger.warn("Skipping rewards for completed booking without userId", {
        bookingId,
      });
      return;
    }

    const baseTurfAmount = Number(after?.paymentBreakdown?.baseTurfAmount || after?.totalAmount || 0);
    const pointsEarned = calculatePointsForCompletedMatch(baseTurfAmount);

    const userRef = db.collection("users").doc(userId);
    const earningLedgerRef = db.collection("spiritPointsLedger").doc(`complete_${bookingId}`);
    let generatedRewardCode: string | null = null;

    await db.runTransaction(async (transaction) => {
      const [ledgerSnap, userSnap] = await Promise.all([
        transaction.get(earningLedgerRef),
        transaction.get(userRef),
      ]);

      // Idempotency guard for retried trigger events.
      if (ledgerSnap.exists) {
        return;
      }

      const userData = userSnap.data() || {};
      const currentSpiritPoints = Math.max(0, Number(userData.spiritPoints || 0));
      const currentCompletedMatches = Math.max(0, Number(userData.completedMatchesCount || 0));
      const currentTotalSpiritPointsEarned = Math.max(0, Number(userData.totalSpiritPointsEarned || 0));

      const newSpiritPoints = currentSpiritPoints + pointsEarned;
      const newCompletedMatches = currentCompletedMatches + 1;
      const newTotalSpiritPointsEarned = currentTotalSpiritPointsEarned + pointsEarned;
      const nextRewardAtCompletedCount = getNextMilestone(newCompletedMatches);

      const nowValue = admin.firestore.FieldValue.serverTimestamp();

      transaction.set(userRef, {
        spiritPoints: newSpiritPoints,
        completedMatchesCount: newCompletedMatches,
        totalSpiritPointsEarned: newTotalSpiritPointsEarned,
        nextRewardAtCompletedCount,
        updatedAt: nowValue,
      }, {merge: true});

      transaction.set(earningLedgerRef, {
        id: earningLedgerRef.id,
        userId,
        bookingId,
        type: "earned",
        points: pointsEarned,
        rupeeValue: round2(pointsEarned * SPIRIT_POINT_RUPEE_VALUE),
        balanceBefore: currentSpiritPoints,
        balanceAfter: newSpiritPoints,
        description: "Spirit points earned from completed match",
        createdAt: nowValue,
      });

      if (newCompletedMatches % MILESTONE_COMPLETED_MATCHES === 0) {
        const rewardCode = generateMilestoneRewardCode(userId, newCompletedMatches);
        const rewardCodeRef = db.collection("rewardCodes").doc(rewardCode);
        const rewardCodeSnap = await transaction.get(rewardCodeRef);

        if (!rewardCodeSnap.exists) {
          transaction.set(rewardCodeRef, {
            id: rewardCode,
            code: rewardCode,
            userId,
            discountPercent: MILESTONE_REWARD_DISCOUNT_PERCENT,
            milestoneCompletedCount: newCompletedMatches,
            status: "active",
            generatedAt: nowValue,
            createdAt: nowValue,
            updatedAt: nowValue,
          });
          generatedRewardCode = rewardCode;
        }
      }
    });

    functions.logger.info("Booking completion rewards processed", {
      bookingId,
      userId,
      pointsEarned,
      generatedRewardCode,
    });
  });

/**
 * Create a player group owned by the authenticated user.
 */
export const createPlayerGroup = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const ownerId = context.auth.uid;
  const name = String(data?.name || "").trim();
  const description = String(data?.description || "").trim();
  const sports = Array.isArray(data?.sports)
    ? data.sports
      .map((item: unknown) => String(item || "").trim().toLowerCase())
      .filter((item: string) => !!item)
      .slice(0, 5)
    : [];

  if (name.length < 3 || name.length > PLAYER_GROUP_NAME_MAX_LENGTH) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Group name must be between 3 and ${PLAYER_GROUP_NAME_MAX_LENGTH} characters`
    );
  }

  if (description.length > PLAYER_GROUP_DESCRIPTION_MAX_LENGTH) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `Group description must be up to ${PLAYER_GROUP_DESCRIPTION_MAX_LENGTH} characters`
    );
  }

  const ownerRef = db.collection("users").doc(ownerId);
  const ownerSnap = await ownerRef.get();
  const ownerData = ownerSnap.data() || {};
  const ownerEmail = String(ownerData?.email || context.auth.token?.email || "").trim() || null;
  const ownerName = getUserDisplayName(ownerData, ownerEmail || undefined);

  const groupRef = db.collection("groups").doc();
  const ownerMember = {
    userId: ownerId,
    name: ownerName,
    role: "owner",
    joinedAt: admin.firestore.Timestamp.now(),
    photoURL: ownerData?.photoURL || null,
    email: ownerEmail,
  };

  await groupRef.set({
    id: groupRef.id,
    name,
    description,
    sports,
    createdBy: ownerId,
    createdByName: ownerName,
    memberIds: [ownerId],
    members: [ownerMember],
    memberCount: 1,
    isActive: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: true,
    groupId: groupRef.id,
  };
});

/**
 * Invite a teammate to group by email. Only group owner can invite.
 */
export const inviteGroupMember = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const ownerId = context.auth.uid;
  const groupId = String(data?.groupId || "").trim();
  const inviteeEmailRaw = String(data?.inviteeEmail || data?.email || "").trim();
  const inviteeEmail = normalizeEmail(inviteeEmailRaw);

  if (!groupId) {
    throw new functions.https.HttpsError("invalid-argument", "groupId is required");
  }

  if (!inviteeEmail || !inviteeEmail.includes("@")) {
    throw new functions.https.HttpsError("invalid-argument", "Valid teammate email is required");
  }

  const groupRef = db.collection("groups").doc(groupId);
  const groupSnap = await groupRef.get();

  if (!groupSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Group not found");
  }

  const groupData = groupSnap.data() || {};
  if (groupData.createdBy !== ownerId) {
    throw new functions.https.HttpsError("permission-denied", "Only group owner can invite members");
  }

  const memberIds: string[] = Array.isArray(groupData.memberIds)
    ? groupData.memberIds.map((entry: unknown) => String(entry || ""))
    : [];

  if (memberIds.length >= PLAYER_GROUP_MAX_MEMBERS) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      `Group has reached the maximum limit of ${PLAYER_GROUP_MAX_MEMBERS} members`
    );
  }

  let userSnapshot = await db
    .collection("users")
    .where("email", "==", inviteeEmailRaw)
    .limit(1)
    .get();

  if (userSnapshot.empty && inviteeEmailRaw !== inviteeEmail) {
    userSnapshot = await db
      .collection("users")
      .where("email", "==", inviteeEmail)
      .limit(1)
      .get();
  }

  if (userSnapshot.empty) {
    throw new functions.https.HttpsError("not-found", "No user found with this email");
  }

  const invitedUserDoc = userSnapshot.docs[0];
  const invitedUserId = invitedUserDoc.id;

  if (invitedUserId === ownerId) {
    throw new functions.https.HttpsError("failed-precondition", "You are already in this group");
  }

  if (memberIds.includes(invitedUserId)) {
    throw new functions.https.HttpsError("already-exists", "User is already a group member");
  }

  const ownerRef = db.collection("users").doc(ownerId);
  const ownerSnap = await ownerRef.get();
  const ownerData = ownerSnap.data() || {};
  const ownerName = getUserDisplayName(ownerData, context.auth.token?.email);

  const invitationId = `${groupId}_${invitedUserId}`;
  const invitationRef = db.collection("groupInvitations").doc(invitationId);
  const invitationSnap = await invitationRef.get();

  if (invitationSnap.exists && invitationSnap.data()?.status === "pending") {
    throw new functions.https.HttpsError("already-exists", "Invitation is already pending");
  }

  await invitationRef.set({
    id: invitationId,
    groupId,
    groupName: String(groupData.name || "Group"),
    groupOwnerId: ownerId,
    invitedBy: ownerId,
    invitedByName: ownerName,
    invitedUserId,
    invitedUserEmail: normalizeEmail(invitedUserDoc.data()?.email || inviteeEmail),
    status: "pending",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    respondedAt: null,
  }, {merge: true});

  return {
    success: true,
    invitationId,
  };
});

/**
 * Invited user accepts or declines a pending group invitation.
 */
export const respondToGroupInvitation = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = context.auth.uid;
  const invitationId = String(data?.invitationId || "").trim();
  const actionRaw = String(data?.action || "").trim().toLowerCase();
  const shouldAccept = actionRaw === "accept";
  const shouldDecline = actionRaw === "decline";

  if (!invitationId) {
    throw new functions.https.HttpsError("invalid-argument", "invitationId is required");
  }

  if (!shouldAccept && !shouldDecline) {
    throw new functions.https.HttpsError("invalid-argument", "action must be accept or decline");
  }

  await db.runTransaction(async (transaction) => {
    const invitationRef = db.collection("groupInvitations").doc(invitationId);
    const invitationSnap = await transaction.get(invitationRef);

    if (!invitationSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Invitation not found");
    }

    const invitationData = invitationSnap.data() || {};

    if (invitationData.invitedUserId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "This invitation does not belong to you");
    }

    if (invitationData.status !== "pending") {
      throw new functions.https.HttpsError("failed-precondition", "Invitation is already processed");
    }

    const nowValue = admin.firestore.FieldValue.serverTimestamp();

    if (shouldDecline) {
      transaction.update(invitationRef, {
        status: "declined",
        updatedAt: nowValue,
        respondedAt: nowValue,
      });
      return;
    }

    const groupId = String(invitationData.groupId || "");
    const groupRef = db.collection("groups").doc(groupId);
    const groupSnap = await transaction.get(groupRef);

    if (!groupSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Group not found");
    }

    const groupData = groupSnap.data() || {};
    const memberIds: string[] = Array.isArray(groupData.memberIds)
      ? groupData.memberIds.map((entry: unknown) => String(entry || ""))
      : [];
    const members: any[] = Array.isArray(groupData.members) ? [...groupData.members] : [];

    if (!memberIds.includes(userId)) {
      if (memberIds.length >= PLAYER_GROUP_MAX_MEMBERS) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Group has reached the maximum limit of ${PLAYER_GROUP_MAX_MEMBERS} members`
        );
      }

      const userRef = db.collection("users").doc(userId);
      const userSnap = await transaction.get(userRef);
      const userData = userSnap.data() || {};
      const userEmail = String(userData?.email || context.auth?.token?.email || invitationData.invitedUserEmail || "").trim() || null;

      members.push({
        userId,
        name: getUserDisplayName(userData, userEmail || undefined),
        role: "member",
        joinedAt: admin.firestore.Timestamp.now(),
        photoURL: userData?.photoURL || null,
        email: userEmail,
      });

      transaction.update(groupRef, {
        memberIds: [...memberIds, userId],
        members,
        memberCount: memberIds.length + 1,
        updatedAt: nowValue,
      });
    } else {
      transaction.update(groupRef, {
        updatedAt: nowValue,
      });
    }

    transaction.update(invitationRef, {
      status: "accepted",
      updatedAt: nowValue,
      respondedAt: nowValue,
    });
  });

  return {
    success: true,
    invitationId,
  };
});

/**
 * Submit a turf review for a completed booking.
 * Only one review per booking is allowed.
 */
export const createTurfReview = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
  }

  const userId = context.auth.uid;
  const bookingId = String(data?.bookingId || "").trim();
  const rating = Number(data?.rating || 0);
  const comment = String(data?.comment || "").trim().slice(0, TURF_REVIEW_COMMENT_MAX_LENGTH);

  if (!bookingId) {
    throw new functions.https.HttpsError("invalid-argument", "bookingId is required");
  }

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new functions.https.HttpsError("invalid-argument", "Rating must be between 1 and 5");
  }

  await db.runTransaction(async (transaction) => {
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingSnap = await transaction.get(bookingRef);

    if (!bookingSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Booking not found");
    }

    const bookingData = bookingSnap.data() || {};

    if (bookingData.userId !== userId) {
      throw new functions.https.HttpsError("permission-denied", "You can review only your own booking");
    }

    if (bookingData.status !== "completed") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Review can only be submitted after match completion"
      );
    }

    const turfId = String(bookingData.turfId || "").trim();
    if (!turfId) {
      throw new functions.https.HttpsError("failed-precondition", "Booking does not have a valid turf");
    }

    const reviewRef = db.collection("turfReviews").doc(bookingId);
    const reviewSnap = await transaction.get(reviewRef);

    if (reviewSnap.exists) {
      throw new functions.https.HttpsError("already-exists", "Review already submitted for this booking");
    }

    const userRef = db.collection("users").doc(userId);
    const userSnap = await transaction.get(userRef);
    const userData = userSnap.data() || {};
    const userEmail = String(userData?.email || context.auth?.token?.email || "").trim();

    const nowValue = admin.firestore.FieldValue.serverTimestamp();

    transaction.set(reviewRef, {
      id: bookingId,
      bookingId,
      turfId,
      turfName: String(bookingData.turfName || "Turf"),
      userId,
      userName: getUserDisplayName(userData, userEmail || undefined),
      rating: Math.round(rating),
      comment,
      createdAt: nowValue,
      updatedAt: nowValue,
    });

    transaction.set(bookingRef, {
      hasReview: true,
      reviewId: bookingId,
      updatedAt: nowValue,
    }, {merge: true});
  });

  return {
    success: true,
    reviewId: bookingId,
  };
});

/**
 * Keep turf rating aggregates in sync whenever a review is created/updated/deleted.
 */
export const onTurfReviewWriteUpdateAggregates = functions.firestore
  .document("turfReviews/{reviewId}")
  .onWrite(async (change) => {
    const beforeData = change.before.exists ? change.before.data() || {} : {};
    const afterData = change.after.exists ? change.after.data() || {} : {};

    const turfId = String(afterData.turfId || beforeData.turfId || "").trim();
    if (!turfId) {
      return;
    }

    const reviewsSnap = await db
      .collection("turfReviews")
      .where("turfId", "==", turfId)
      .get();

    let totalRating = 0;
    let reviewCount = 0;

    reviewsSnap.docs.forEach((doc) => {
      const rating = Number(doc.data()?.rating || 0);
      if (rating > 0) {
        totalRating += rating;
        reviewCount += 1;
      }
    });

    const averageRating = reviewCount > 0 ? round2(totalRating / reviewCount) : 0;

    await db.collection("turfs").doc(turfId).set({
      rating: averageRating,
      reviews: reviewCount,
      totalReviews: reviewCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
  });

/**
 * Scheduled cleanup for expired Player Finder team artifacts.
 *
 * Deletes:
 * - playerFinderJoinRequests documents for expired posts
 * - playerFinderPostMessages documents for expired posts
 *
 * Also marks expired open/full posts as completed so they stop appearing as active.
 */
export const cleanupExpiredPlayerFinderArtifacts = functions.pubsub
  .schedule("every 60 minutes")
  .timeZone("Asia/Kolkata")
  .onRun(async () => {
    const now = new Date();

    try {
      const activePostsSnap = await db
        .collection("playerFinderPosts")
        .where("status", "in", ["open", "full"])
        .get();

      if (activePostsSnap.empty) {
        functions.logger.info("Player Finder cleanup skipped: no active posts found");
        return null;
      }

      const expiredPostDocs = activePostsSnap.docs.filter((doc) => {
        return isPlayerFinderPostExpired(doc.data(), now);
      });

      if (!expiredPostDocs.length) {
        functions.logger.info("Player Finder cleanup skipped: no expired posts found", {
          activePostCount: activePostsSnap.size,
        });
        return null;
      }

      let deletedJoinRequests = 0;
      let deletedMessages = 0;
      let updatedPosts = 0;

      for (const postDoc of expiredPostDocs) {
        const postId = postDoc.id;

        const [joinRequestsSnap, messagesSnap] = await Promise.all([
          db.collection("playerFinderJoinRequests").where("postId", "==", postId).get(),
          db.collection("playerFinderPostMessages").where("postId", "==", postId).get(),
        ]);

        deletedJoinRequests += await deleteDocumentReferencesInChunks(
          joinRequestsSnap.docs.map((doc) => doc.ref)
        );

        deletedMessages += await deleteDocumentReferencesInChunks(
          messagesSnap.docs.map((doc) => doc.ref)
        );

        await postDoc.ref.set({
          status: "completed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          teamArtifactsCleanedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});

        updatedPosts += 1;
      }

      functions.logger.info("Player Finder cleanup completed", {
        scannedActivePosts: activePostsSnap.size,
        expiredPostsProcessed: expiredPostDocs.length,
        updatedPosts,
        deletedJoinRequests,
        deletedMessages,
      });

      return null;
    } catch (error: any) {
      functions.logger.error("Player Finder cleanup failed", {
        error: error?.message,
        stack: error?.stack,
      });
      throw error;
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
      calculateBookingPricing: "active",
      cancelBookingWithRefund: "active",
      onBookingCompletedAwardBenefits: "active",
      createPlayerGroup: "active",
      inviteGroupMember: "active",
      respondToGroupInvitation: "active",
      createTurfReview: "active",
      onTurfReviewWriteUpdateAggregates: "active",
      cleanupExpiredPlayerFinderArtifacts: "active",
    },
  });
});
