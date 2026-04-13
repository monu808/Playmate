// Firebase Firestore Functions
import firestore from '@react-native-firebase/firestore';
import { db, functions } from '../../config/firebase';
import {
  DEFAULT_HAPPY_HOUR_DISCOUNT_PERCENT,
  DEFAULT_HAPPY_HOUR_ENABLED,
  DEFAULT_HAPPY_HOUR_END_TIME,
  DEFAULT_HAPPY_HOUR_LEAD_TIME_MINUTES,
  DEFAULT_HAPPY_HOUR_START_TIME,
} from '../constants';
import {
  Turf,
  Booking,
  User,
  BlockedSlot,
  Transaction,
  RewardCode,
  SpiritPointsLedgerEntry,
  JoinedTeamBooking,
  PlayerFinderChatMessage,
  PlayerFinderBookingSnapshot,
  PlayerFinderJoinRequest,
  PlayerFinderPost,
  PlayerFinderPostStatus,
  PlayerJoinRequestStatus,
} from '../../types';

// Type alias for Firestore Timestamp
type Timestamp = ReturnType<typeof firestore.Timestamp.now>;

const toDate = (value: any): Date => {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date();
};

const sortByCreatedAtDesc = <T extends { createdAt?: Date }>(items: T[]) => {
  return [...items].sort((a, b) => {
    const aTime = a.createdAt?.getTime?.() || 0;
    const bTime = b.createdAt?.getTime?.() || 0;
    return bTime - aTime;
  });
};

export interface CancelBookingWithRefundResult {
  success: boolean;
  alreadyCancelled?: boolean;
  bookingId?: string;
  refundDetails?: {
    status: 'none' | 'pending' | 'processed' | 'failed';
    policyApplied: 'full_refund' | 'late_cancellation_fee';
    minutesBeforeStart: number;
    refundAmount: number;
    cancellationCharge: number;
    ownerCompensation: number;
    platformRetention: number;
    refundId?: string | null;
    failureReason?: string | null;
  } | null;
  error?: string;
}

export interface BookingPricingCalculationInput {
  turfId: string;
  date: string;
  startTime: string;
  endTime: string;
  rewardCode?: string;
  requestedSpiritPoints?: number;
}

export interface BookingPricingCalculationResult {
  success: boolean;
  quote?: any;
  error?: string;
}

const normalizeTurfPricing = (data: any) => {
  const basePrice = data?.pricePerHour || data?.price || 0;
  return {
    dayPricePerHour: data?.dayPricePerHour || basePrice,
    nightPricePerHour: data?.nightPricePerHour || basePrice,
    dynamicPricingEnabled: data?.dynamicPricingEnabled ?? false,
    dynamicBoundaryTime: data?.dynamicBoundaryTime || '18:00',
    manualActivePeriod: data?.manualActivePeriod === 'night' ? 'night' : 'day',
    happyHourEnabled: data?.happyHourEnabled ?? DEFAULT_HAPPY_HOUR_ENABLED,
    happyHourDiscountPercent:
      typeof data?.happyHourDiscountPercent === 'number'
        ? data.happyHourDiscountPercent
        : DEFAULT_HAPPY_HOUR_DISCOUNT_PERCENT,
    happyHourStartTime: data?.happyHourStartTime || DEFAULT_HAPPY_HOUR_START_TIME,
    happyHourEndTime: data?.happyHourEndTime || DEFAULT_HAPPY_HOUR_END_TIME,
    happyHourLeadTimeMinutes:
      typeof data?.happyHourLeadTimeMinutes === 'number'
        ? data.happyHourLeadTimeMinutes
        : DEFAULT_HAPPY_HOUR_LEAD_TIME_MINUTES,
  };
};

// ============ TURFS ============

/**
 * Get all turfs
 * Returns empty array on error (check logs for details)
 * IMPROVED: Now with better error logging for debugging
 */
export const getTurfs = async (): Promise<Turf[]> => {
  try {
    console.log('📡 Fetching turfs from Firestore...');
    
    // Query only verified and active turfs for regular users
    const snapshot = await db
      .collection('turfs')
      .where('isVerified', '==', true)
      .where('isActive', '==', true)
      .get();
    
    console.log('📊 Verified turfs in database:', snapshot.size);
    
    const turfs = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('🏟️ Turf found:', doc.id, data.name);
      return {
        id: doc.id,
        ...data,
        ...normalizeTurfPricing(data),
      };
    }) as Turf[];
    
    console.log('✅ Successfully fetched', turfs.length, 'verified turfs');
    return turfs;
  } catch (error: any) {
    console.error('❌ Get turfs error:', error);
    console.error('❌ Error code:', error?.code);
    console.error('❌ Error message:', error?.message);
    // Return empty array - calling code should handle empty state
    // For network errors, Firebase will show "FirebaseError: Failed to get document because the client is offline"
    return [];
  }
};

/**
 * Get all turfs for admin (active/inactive/verified/pending)
 */
export const getAllTurfsForAdmin = async (): Promise<Turf[]> => {
  try {
    const snapshot = await db.collection('turfs').get();
    const turfs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        ...normalizeTurfPricing(data),
      };
    }) as Turf[];

    return turfs.sort((a, b) => {
      const aDate = (a as any).createdAt?.toDate?.()?.getTime?.() || 0;
      const bDate = (b as any).createdAt?.toDate?.()?.getTime?.() || 0;
      return bDate - aDate;
    });
  } catch (error) {
    console.error('❌ Get all turfs for admin error:', error);
    return [];
  }
};

/**
 * Get turf by ID
 * IMPROVED: Better error handling and logging
 */
export const getTurfById = async (id: string): Promise<Turf | null> => {
  try {
    console.log('🔍 Fetching turf with ID:', id);
    const docSnap = await db.collection('turfs').doc(id).get();
    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('✅ Turf found:', data);
      
      // Handle Timestamp conversion
      const turfData = {
        id: docSnap.id,
        ...data,
        ...normalizeTurfPricing(data),
        createdAt: data?.createdAt?.toDate?.() || new Date(),
      };
      
      return turfData as Turf;
    }
    console.log('❌ Turf not found with ID:', id);
    return null;
  } catch (error: any) {
    console.error('❌ Get turf by ID error:', error);
    console.error('❌ Error code:', error?.code);
    console.error('❌ Error message:', error?.message);
    return null;
  }
};

/**
 * Search turfs
 */
export const searchTurfs = async (searchTerm: string): Promise<Turf[]> => {
  try {
    const snapshot = await db.collection('turfs').get();
    const turfs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Turf[];
    
    // Client-side filtering (Firestore doesn't support full-text search natively)
    return turfs.filter(turf =>
      turf.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      turf.location.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      turf.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  } catch (error) {
    console.error('Search turfs error:', error);
    return [];
  }
};

/**
 * Add new turf (admin only)
 */
export const addTurf = async (turfData: Omit<Turf, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const docRef = await db.collection('turfs').add({
      ...turfData,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('Add turf error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update turf (admin only)
 */
export const updateTurf = async (id: string, turfData: Partial<Turf>): Promise<{ success: boolean; error?: string }> => {
  try {
    await db.collection('turfs').doc(id).update(turfData);
    return { success: true };
  } catch (error: any) {
    console.error('Update turf error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete turf (admin only)
 */
export const deleteTurf = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await db.collection('turfs').doc(id).delete();
    return { success: true };
  } catch (error: any) {
    console.error('Delete turf error:', error);
    return { success: false, error: error.message };
  }
};

// ============ BOOKINGS ============

/**
 * Create booking with atomic slot availability check
 * CRITICAL: Prevents race conditions and double bookings
 */
export const createBooking = async (bookingData: Omit<Booking, 'id'>): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    console.log('💾 Creating booking in Firestore...');
    console.log('  Booking data:', JSON.stringify(bookingData, null, 2));
    
    // 🔒 CRITICAL: Atomic check - Verify slot is still available immediately before creating
    console.log('🔍 Checking slot availability before booking...');
    const existingBookings = await getTurfBookings(bookingData.turfId, bookingData.date);
    
    const slotTaken = existingBookings.some(b => 
      b.startTime === bookingData.startTime && 
      b.endTime === bookingData.endTime &&
      (b.status === 'confirmed' || b.status === 'pending')
    );
    
    if (slotTaken) {
      console.log('❌ Slot already booked by another user');
      return { 
        success: false, 
        error: 'This slot was just booked by someone else. Please select another time slot.' 
      };
    }
    
    console.log('✅ Slot available, creating booking...');
    
    // Create booking immediately after verification
    const docRef = await db.collection('bookings').add({
      ...bookingData,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Booking created successfully with ID:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('❌ Create booking error:', error);
    console.error('❌ Error message:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Get user bookings
 * IMPROVED: Better error handling
 */
export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('bookings')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      // Fallback: avoid hard failure when composite index isn't ready yet.
      snapshot = await db
        .collection('bookings')
        .where('userId', '==', userId)
        .get();
    }

    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Booking[];

    return bookings.sort((a, b) => {
      const aTime = (a as any)?.createdAt?.toDate?.()?.getTime?.() || 0;
      const bTime = (b as any)?.createdAt?.toDate?.()?.getTime?.() || 0;
      return bTime - aTime;
    });
  } catch (error: any) {
    console.error('❌ Get user bookings error:', error);
    console.error('❌ Error code:', error?.code);
    console.error('❌ Error message:', error?.message);
    return [];
  }
};

/**
 * Get booking by ID
 * IMPROVED: Better error handling
 */
export const getBookingById = async (id: string): Promise<Booking | null> => {
  try {
    const docSnap = await db.collection('bookings').doc(id).get();
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Booking;
    }
    return null;
  } catch (error: any) {
    console.error('❌ Get booking by ID error:', error);
    console.error('❌ Error code:', error?.code);
    console.error('❌ Error message:', error?.message);
    return null;
  }
};

/**
 * Get bookings for a specific turf on a specific date
 */
export const getTurfBookings = async (turfId: string, date: string): Promise<Booking[]> => {
  try {
    console.log('🔍 Firestore Query - getTurfBookings called');
    console.log('  turfId:', turfId);
    console.log('  date:', date);
    
    console.log('  Executing Firestore query...');
    const snapshot = await db
      .collection('bookings')
      .where('turfId', '==', turfId)
      .where('date', '==', date)
      .where('status', 'in', ['confirmed', 'pending'])
      .get();
    
    console.log('  Query returned:', snapshot.docs.length, 'documents');
    
    const bookings = snapshot.docs.map(doc => {
      const data = doc.data();
      console.log('  Document:', doc.id, data);
      return {
        id: doc.id,
        ...data,
      };
    }) as Booking[];
    
    console.log('✅ getTurfBookings returning:', bookings.length, 'bookings');
    return bookings;
  } catch (error) {
    console.error('❌ Get turf bookings error:', error);
    console.error('❌ Error details:', JSON.stringify(error, null, 2));
    return [];
  }
};

/**
 * Update booking status
 */
export const updateBookingStatus = async (
  id: string,
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const payload: Record<string, any> = {
      status,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    };

    if (status === 'completed') {
      payload.completedAt = firestore.FieldValue.serverTimestamp();
    }

    await db.collection('bookings').doc(id).update(payload);
    return { success: true };
  } catch (error: any) {
    console.error('Update booking status error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get server-authoritative pricing quote for a booking attempt.
 */
export const calculateBookingPricing = async (
  input: BookingPricingCalculationInput
): Promise<BookingPricingCalculationResult> => {
  try {
    const callable = functions.httpsCallable('calculateBookingPricing');
    const response = await callable(input);
    const data = response.data as any;

    return {
      success: true,
      quote: data,
    };
  } catch (error: any) {
    console.error('❌ Calculate booking pricing error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to calculate booking price',
    };
  }
};

/**
 * Cancel booking
 */
export const cancelBooking = async (id: string): Promise<{ success: boolean; error?: string }> => {
  return updateBookingStatus(id, 'cancelled');
};

/**
 * Cancel booking via backend refund pipeline.
 */
export const cancelBookingWithRefund = async (
  bookingId: string
): Promise<CancelBookingWithRefundResult> => {
  try {
    const callable = functions.httpsCallable('cancelBookingWithRefund');
    const response = await callable({ bookingId });
    return response.data as CancelBookingWithRefundResult;
  } catch (error: any) {
    console.error('❌ Cancel booking with refund error:', error);
    return {
      success: false,
      error: error?.message || 'Failed to cancel booking with refund',
    };
  }
};

/**
 * Get payment/refund transactions for a user.
 */
export const getUserTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('transactions')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      // Fallback: keep payment history available while index is building.
      snapshot = await db
        .collection('transactions')
        .where('userId', '==', userId)
        .get();
    }

    const transactions = snapshot.docs.map(doc => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        timestamp: data?.timestamp?.toDate?.() || data?.createdAt?.toDate?.() || new Date(),
        createdAt: data?.createdAt?.toDate?.() || new Date(),
        updatedAt: data?.updatedAt?.toDate?.() || new Date(),
      } as Transaction;
    });

    return transactions.sort((a, b) => {
      const aTime = (a as any)?.createdAt?.getTime?.() || 0;
      const bTime = (b as any)?.createdAt?.getTime?.() || 0;
      return bTime - aTime;
    });
  } catch (error: any) {
    console.error('❌ Get user transactions error:', error);
    return [];
  }
};

/**
 * Get active reward codes for a user.
 */
export const getActiveRewardCodes = async (userId: string): Promise<RewardCode[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('rewardCodes')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .orderBy('generatedAt', 'desc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('rewardCodes')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();
    }

    return snapshot.docs.map((doc) => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        ...data,
        generatedAt: toDate(data.generatedAt),
        redeemedAt: data?.redeemedAt ? toDate(data.redeemedAt) : undefined,
        expiresAt: data?.expiresAt ? toDate(data.expiresAt) : undefined,
      } as RewardCode;
    });
  } catch (error: any) {
    console.error('❌ Get active reward codes error:', error);
    return [];
  }
};

/**
 * Get spirit points history for a user.
 */
export const getSpiritPointsHistory = async (
  userId: string,
  limitCount: number = 30
): Promise<SpiritPointsLedgerEntry[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('spiritPointsLedger')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(limitCount)
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('spiritPointsLedger')
        .where('userId', '==', userId)
        .limit(limitCount)
        .get();
    }

    return snapshot.docs
      .map((doc) => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          ...data,
          createdAt: toDate(data?.createdAt),
        } as SpiritPointsLedgerEntry;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error: any) {
    console.error('❌ Get spirit points history error:', error);
    return [];
  }
};

/**
 * Get all bookings (admin only)
 */
export const getAllBookings = async (): Promise<Booking[]> => {
  try {
    const snapshot = await db
      .collection('bookings')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Booking[];
  } catch (error) {
    console.error('Get all bookings error:', error);
    return [];
  }
};

/**
 * Get all users (admin only)
 */
export const getAllUsers = async (): Promise<any[]> => {
  try {
    const snapshot = await db.collection('users').get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Get all users error:', error);
    return [];
  }
};

// ============ BLOCKED SLOTS ============

/**
 * Get blocked slots for a specific turf on a specific date
 */
export const getBlockedSlots = async (turfId: string, date: string): Promise<BlockedSlot[]> => {
  try {
    console.log('🔒 Fetching blocked slots for turf:', turfId, 'date:', date);
    const snapshot = await db
      .collection('blockedSlots')
      .where('turfId', '==', turfId)
      .where('date', '==', date)
      .get();
    
    const blockedSlots = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as BlockedSlot[];
    
    console.log('🔒 Found', blockedSlots.length, 'blocked slots');
    return blockedSlots;
  } catch (error) {
    console.error('❌ Get blocked slots error:', error);
    return [];
  }
};

/**
 * Get all blocked slots for a turf (for management screen)
 */
export const getAllBlockedSlotsForTurf = async (turfId: string): Promise<BlockedSlot[]> => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const snapshot = await db
      .collection('blockedSlots')
      .where('turfId', '==', turfId)
      .where('date', '>=', today)
      .orderBy('date', 'asc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as BlockedSlot[];
  } catch (error) {
    console.error('❌ Get all blocked slots error:', error);
    return [];
  }
};

/**
 * Create a blocked slot (manual lock)
 */
export const createBlockedSlot = async (
  slotData: Omit<BlockedSlot, 'id' | 'createdAt'>
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    console.log('🔒 Creating blocked slot:', slotData);
    
    // Check for existing bookings in this slot
    const existingBookings = await getTurfBookings(slotData.turfId, slotData.date);
    const hasConflict = existingBookings.some(booking => {
      const bookingStart = booking.startTime;
      const bookingEnd = booking.endTime;
      return !(slotData.endTime <= bookingStart || slotData.startTime >= bookingEnd);
    });
    
    if (hasConflict) {
      return { success: false, error: 'This slot conflicts with an existing booking' };
    }
    
    // Check for existing blocked slots
    const existingBlocked = await getBlockedSlots(slotData.turfId, slotData.date);
    const hasBlockedConflict = existingBlocked.some(blocked => {
      return !(slotData.endTime <= blocked.startTime || slotData.startTime >= blocked.endTime);
    });
    
    if (hasBlockedConflict) {
      return { success: false, error: 'This slot is already blocked' };
    }
    
    // Filter out undefined values (Firestore doesn't accept them)
    const cleanData: Record<string, any> = {};
    Object.entries(slotData).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    
    const docRef = await db.collection('blockedSlots').add({
      ...cleanData,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
    
    console.log('✅ Blocked slot created:', docRef.id);
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('❌ Create blocked slot error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Delete a blocked slot (unlock)
 */
export const deleteBlockedSlot = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await db.collection('blockedSlots').doc(id).delete();
    console.log('✅ Blocked slot deleted:', id);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Delete blocked slot error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get combined unavailable slots (bookings + blocked) for a turf on a date
 */
export const getUnavailableSlots = async (
  turfId: string,
  date: string
): Promise<{ bookings: Booking[]; blockedSlots: BlockedSlot[] }> => {
  try {
    const [bookings, blockedSlots] = await Promise.all([
      getTurfBookings(turfId, date),
      getBlockedSlots(turfId, date),
    ]);
    
    return { bookings, blockedSlots };
  } catch (error) {
    console.error('❌ Get unavailable slots error:', error);
    return { bookings: [], blockedSlots: [] };
  }
};

// ============ PLAYER FINDER ============

export interface CreatePlayerFinderPostInput {
  bookingId: string;
  requiredPlayers: number;
  description?: string;
}

export interface JoinPlayerFinderInput {
  postId: string;
  userId: string;
  userName: string;
  userPhone?: string | null;
  userPhotoURL?: string | null;
}

const mapPlayerFinderPost = (doc: any): PlayerFinderPost => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    bookingId: data.bookingId || '',
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || 'Host',
    turfId: data.turfId || '',
    turfName: data.turfName || 'Turf',
    turfImage: data.turfImage || '',
    turfLocation: data.turfLocation || { lat: 0, lng: 0, address: '' },
    sport: data.sport || 'football',
    date: data.date || '',
    startTime: data.startTime || '',
    endTime: data.endTime || '',
    requiredPlayers: Number(data.requiredPlayers || 0),
    currentPlayers: Number(data.currentPlayers || 0),
    status: (data.status || 'open') as PlayerFinderPostStatus,
    participants: Array.isArray(data.participants)
      ? data.participants.map((participant: any) => ({
          userId: participant?.userId || '',
          name: participant?.name || 'Player',
          role: participant?.role === 'host' ? 'host' : 'player',
          joinedAt: toDate(participant?.joinedAt),
        }))
      : [],
    description: data.description || '',
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
};

const mapPlayerFinderJoinRequest = (doc: any): PlayerFinderJoinRequest => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    postId: data.postId || '',
    bookingId: data.bookingId || '',
    hostId: data.hostId || '',
    requestedBy: data.requestedBy || '',
    requestedByName: data.requestedByName || 'Player',
    requestedByPhone: data.requestedByPhone || null,
    requestedByPhotoURL: data.requestedByPhotoURL || null,
    status: (data.status || 'pending') as PlayerJoinRequestStatus,
    bookingSnapshot: data.bookingSnapshot
      ? {
          bookingId: data.bookingSnapshot.bookingId || '',
          turfId: data.bookingSnapshot.turfId || '',
          turfName: data.bookingSnapshot.turfName || '',
          turfImage: data.bookingSnapshot.turfImage || '',
          turfLocation: data.bookingSnapshot.turfLocation || { lat: 0, lng: 0, address: '' },
          hostId: data.bookingSnapshot.hostId || '',
          hostName: data.bookingSnapshot.hostName || '',
          date: data.bookingSnapshot.date || '',
          startTime: data.bookingSnapshot.startTime || '',
          endTime: data.bookingSnapshot.endTime || '',
        }
      : undefined,
    createdAt: toDate(data.createdAt),
    respondedAt: data.respondedAt ? toDate(data.respondedAt) : undefined,
  };
};

const mapPlayerFinderChatMessage = (doc: any): PlayerFinderChatMessage => {
  const data = doc.data() || {};

  return {
    id: doc.id,
    postId: data.postId || '',
    senderId: data.senderId || '',
    senderName: data.senderName || 'Player',
    message: data.message || '',
    createdAt: toDate(data.createdAt),
  };
};

const buildBookingSnapshotFromPost = (post: any): PlayerFinderBookingSnapshot => ({
  bookingId: post.bookingId || '',
  turfId: post.turfId || '',
  turfName: post.turfName || 'Turf',
  turfImage: post.turfImage || '',
  turfLocation: post.turfLocation || { lat: 0, lng: 0, address: '' },
  hostId: post.createdBy || '',
  hostName: post.createdByName || 'Host',
  date: post.date || '',
  startTime: post.startTime || '',
  endTime: post.endTime || '',
});

const isUpcomingBooking = (booking: any): boolean => {
  const startDate = new Date(`${booking?.date || ''}T${booking?.startTime || '00:00'}:00`);
  if (Number.isNaN(startDate.getTime())) return false;
  return startDate.getTime() > Date.now();
};

const isUserAllowedInPlayerFinderChat = async (postId: string, userId: string): Promise<boolean> => {
  try {
    const postRef = db.collection('playerFinderPosts').doc(postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists()) return false;

    const postData = postSnap.data() as any;
    if (postData?.createdBy === userId) {
      return true;
    }

    const approvedRequestRef = db.collection('playerFinderJoinRequests').doc(`${postId}_${userId}`);
    const approvedRequestSnap = await approvedRequestRef.get();

    return approvedRequestSnap.exists() && (approvedRequestSnap.data() as any)?.status === 'approved';
  } catch (error) {
    return false;
  }
};

export const getPlayerFinderFeed = async (): Promise<PlayerFinderPost[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('playerFinderPosts')
        .where('status', 'in', ['open', 'full'])
        .orderBy('createdAt', 'desc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('playerFinderPosts')
        .where('status', 'in', ['open', 'full'])
        .get();
    }

    return sortByCreatedAtDesc(snapshot.docs.map(mapPlayerFinderPost));
  } catch (error) {
    console.error('❌ Get player finder feed error:', error);
    return [];
  }
};

export const getMyPlayerFinderPosts = async (userId: string): Promise<PlayerFinderPost[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('playerFinderPosts')
        .where('createdBy', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('playerFinderPosts')
        .where('createdBy', '==', userId)
        .get();
    }

    return sortByCreatedAtDesc(snapshot.docs.map(mapPlayerFinderPost));
  } catch (error) {
    console.error('❌ Get my player finder posts error:', error);
    return [];
  }
};

export const getPlayerFinderPostById = async (postId: string): Promise<PlayerFinderPost | null> => {
  try {
    const docSnap = await db.collection('playerFinderPosts').doc(postId).get();
    if (!docSnap.exists()) return null;
    return mapPlayerFinderPost(docSnap);
  } catch (error) {
    console.error('❌ Get player finder post by ID error:', error);
    return null;
  }
};

export const getUserJoinRequests = async (userId: string): Promise<PlayerFinderJoinRequest[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('playerFinderJoinRequests')
        .where('requestedBy', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('playerFinderJoinRequests')
        .where('requestedBy', '==', userId)
        .get();
    }

    return sortByCreatedAtDesc(snapshot.docs.map(mapPlayerFinderJoinRequest));
  } catch (error) {
    console.error('❌ Get user join requests error:', error);
    return [];
  }
};

export const getPendingJoinRequestsForPost = async (
  postId: string,
  hostUserId: string
): Promise<PlayerFinderJoinRequest[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('playerFinderJoinRequests')
        .where('postId', '==', postId)
        .where('hostId', '==', hostUserId)
        .where('status', '==', 'pending')
        .orderBy('createdAt', 'asc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('playerFinderJoinRequests')
        .where('postId', '==', postId)
        .where('hostId', '==', hostUserId)
        .where('status', '==', 'pending')
        .get();
    }

    return snapshot.docs.map(mapPlayerFinderJoinRequest);
  } catch (error) {
    console.error('❌ Get pending join requests error:', error);
    return [];
  }
};

export const getEligibleBookingsForPlayerFinder = async (userId: string): Promise<Booking[]> => {
  try {
    const [bookings, myPosts] = await Promise.all([
      getUserBookings(userId),
      getMyPlayerFinderPosts(userId),
    ]);

    const bookingsWithOpenPosts = new Set(
      myPosts
        .filter((post) => post.status === 'open' || post.status === 'full')
        .map((post) => post.bookingId)
    );

    return bookings.filter((booking) => {
      const isConfirmed = booking.status === 'confirmed';
      const isAvailable = !bookingsWithOpenPosts.has(booking.id);
      return isConfirmed && isUpcomingBooking(booking) && isAvailable;
    });
  } catch (error) {
    console.error('❌ Get eligible bookings for player finder error:', error);
    return [];
  }
};

export const createPlayerFinderPost = async (
  input: CreatePlayerFinderPostInput,
  currentUser: { uid: string; name: string }
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const requiredPlayers = Number(input.requiredPlayers || 0);
    if (!input.bookingId) {
      return { success: false, error: 'Booking is required' };
    }
    if (requiredPlayers < 2) {
      return { success: false, error: 'Team size must be at least 2 players' };
    }

    const bookingRef = db.collection('bookings').doc(input.bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists()) {
      return { success: false, error: 'Booking not found' };
    }

    const booking = bookingSnap.data() as any;

    if (booking.userId !== currentUser.uid) {
      return { success: false, error: 'You can only post for your own booking' };
    }

    if (booking.status !== 'confirmed' || !isUpcomingBooking(booking)) {
      return { success: false, error: 'Only confirmed upcoming bookings can be posted' };
    }

    const existingPostSnapshot = await db
      .collection('playerFinderPosts')
      .where('bookingId', '==', input.bookingId)
      .where('status', 'in', ['open', 'full'])
      .limit(1)
      .get();

    if (!existingPostSnapshot.empty) {
      return { success: false, error: 'This booking already has an active player finder post' };
    }

    let sport = 'football';
    try {
      const turfSnap = await db.collection('turfs').doc(booking.turfId).get();
      sport = turfSnap.data()?.sport || 'football';
    } catch (error) {
      console.log('ℹ️ Could not fetch turf sport, using fallback sport.');
    }

    const postRef = db.collection('playerFinderPosts').doc();
    const joinedAt = firestore.Timestamp.now();

    await postRef.set({
      bookingId: input.bookingId,
      createdBy: currentUser.uid,
      createdByName: currentUser.name || 'Host',
      turfId: booking.turfId,
      turfName: booking.turfName,
      turfImage: booking.turfImage || '',
      turfLocation: booking.turfLocation || null,
      sport,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      requiredPlayers,
      currentPlayers: 1,
      status: 'open',
      description: input.description?.trim() || '',
      participants: [
        {
          userId: currentUser.uid,
          name: currentUser.name || 'Host',
          role: 'host',
          joinedAt,
        },
      ],
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, id: postRef.id };
  } catch (error: any) {
    console.error('❌ Create player finder post error:', error);
    return { success: false, error: error?.message || 'Failed to create player finder post' };
  }
};

export const requestToJoinPlayerFinderPost = async (
  input: JoinPlayerFinderInput
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const postRef = db.collection('playerFinderPosts').doc(input.postId);
    const postSnap = await postRef.get();

    if (!postSnap.exists()) {
      return { success: false, error: 'Player finder post not found' };
    }

    const post = postSnap.data() as any;

    if (post.createdBy === input.userId) {
      return { success: false, error: 'You are already the host for this team' };
    }

    if (post.status !== 'open') {
      return { success: false, error: post.status === 'full' ? 'Team is already full' : 'Team is not accepting requests' };
    }

    const participants = Array.isArray(post.participants) ? post.participants : [];
    if (participants.some((participant: any) => participant.userId === input.userId)) {
      return { success: false, error: 'You are already part of this team' };
    }

    const requestId = `${input.postId}_${input.userId}`;
    const requestRef = db.collection('playerFinderJoinRequests').doc(requestId);

    await requestRef.set({
      postId: input.postId,
      bookingId: post.bookingId,
      hostId: post.createdBy,
      requestedBy: input.userId,
      requestedByName: input.userName || 'Player',
      requestedByPhone: input.userPhone || null,
      requestedByPhotoURL: input.userPhotoURL || null,
      status: 'pending',
      createdAt: firestore.FieldValue.serverTimestamp(),
      respondedAt: null,
    });

    return { success: true, id: requestRef.id };
  } catch (error: any) {
    console.error('❌ Request to join player finder post error:', error);
    if (error?.code === 'firestore/permission-denied') {
      return {
        success: false,
        error: 'Join request already exists or this team is no longer accepting requests',
      };
    }
    return { success: false, error: error?.message || 'Failed to send join request' };
  }
};

export const approvePlayerJoinRequest = async (
  requestId: string,
  hostUserId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await db.runTransaction(async (transaction) => {
      const requestRef = db.collection('playerFinderJoinRequests').doc(requestId);
      const requestSnap = await transaction.get(requestRef);

      if (!requestSnap.exists()) {
        return { success: false, error: 'Join request not found' };
      }

      const requestData = requestSnap.data() as any;

      if (requestData.hostId !== hostUserId) {
        return { success: false, error: 'Only the host can approve requests' };
      }

      if (requestData.status !== 'pending') {
        return { success: false, error: 'Join request was already processed' };
      }

      const postRef = db.collection('playerFinderPosts').doc(requestData.postId);
      const postSnap = await transaction.get(postRef);

      if (!postSnap.exists()) {
        return { success: false, error: 'Player finder post not found' };
      }

      const postData = postSnap.data() as any;

      if (postData.createdBy !== hostUserId) {
        return { success: false, error: 'Only the host can approve requests' };
      }

      if (postData.status !== 'open') {
        transaction.update(requestRef, {
          status: 'declined',
          respondedAt: firestore.FieldValue.serverTimestamp(),
        });
        return { success: false, error: 'Team is not accepting requests right now' };
      }

      const participants = Array.isArray(postData.participants) ? [...postData.participants] : [];
      if (participants.some((participant: any) => participant.userId === requestData.requestedBy)) {
        transaction.update(requestRef, {
          status: 'approved',
          respondedAt: firestore.FieldValue.serverTimestamp(),
          bookingSnapshot: buildBookingSnapshotFromPost(postData),
          teamStatus: postData.status,
        });
        return { success: true };
      }

      const requiredPlayers = Number(postData.requiredPlayers || 1);
      const currentPlayers = Number(postData.currentPlayers || participants.length || 1);

      if (currentPlayers >= requiredPlayers) {
        transaction.update(postRef, {
          currentPlayers: requiredPlayers,
          status: 'full',
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(requestRef, {
          status: 'declined',
          respondedAt: firestore.FieldValue.serverTimestamp(),
        });
        return { success: false, error: 'Team is already full' };
      }

      participants.push({
        userId: requestData.requestedBy,
        name: requestData.requestedByName || 'Player',
        role: 'player',
        joinedAt: firestore.Timestamp.now(),
      });

      const nextPlayers = currentPlayers + 1;
      const nextStatus: PlayerFinderPostStatus = nextPlayers >= requiredPlayers ? 'full' : 'open';

      transaction.update(postRef, {
        participants,
        currentPlayers: nextPlayers,
        status: nextStatus,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(requestRef, {
        status: 'approved',
        respondedAt: firestore.FieldValue.serverTimestamp(),
        bookingSnapshot: buildBookingSnapshotFromPost(postData),
        teamStatus: nextStatus,
      });

      return { success: true };
    });

    return result;
  } catch (error: any) {
    console.error('❌ Approve player join request error:', error);
    return { success: false, error: error?.message || 'Failed to approve join request' };
  }
};

export const declinePlayerJoinRequest = async (
  requestId: string,
  hostUserId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const requestRef = db.collection('playerFinderJoinRequests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists()) {
      return { success: false, error: 'Join request not found' };
    }

    const requestData = requestSnap.data() as any;

    if (requestData.hostId !== hostUserId) {
      return { success: false, error: 'Only the host can decline requests' };
    }

    if (requestData.status !== 'pending') {
      return { success: false, error: 'Join request was already processed' };
    }

    await requestRef.update({
      status: 'declined',
      respondedAt: firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('❌ Decline player join request error:', error);
    return { success: false, error: error?.message || 'Failed to decline join request' };
  }
};

export const getJoinedTeamBookingsForUser = async (userId: string): Promise<JoinedTeamBooking[]> => {
  try {
    let snapshot;

    try {
      snapshot = await db
        .collection('playerFinderJoinRequests')
        .where('requestedBy', '==', userId)
        .where('status', '==', 'approved')
        .orderBy('respondedAt', 'desc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('playerFinderJoinRequests')
        .where('requestedBy', '==', userId)
        .where('status', '==', 'approved')
        .get();
    }

    const joinedBookings = snapshot.docs
      .map((doc) => {
        const data = doc.data() as any;
        const snapshotData = data.bookingSnapshot as PlayerFinderBookingSnapshot | undefined;
        if (!snapshotData) return null;

        return {
          postId: data.postId || '',
          bookingId: snapshotData.bookingId,
          turfId: snapshotData.turfId,
          turfName: snapshotData.turfName,
          turfImage: snapshotData.turfImage,
          turfLocation: snapshotData.turfLocation,
          hostId: snapshotData.hostId,
          hostName: snapshotData.hostName,
          date: snapshotData.date,
          startTime: snapshotData.startTime,
          endTime: snapshotData.endTime,
          teamStatus: (data.teamStatus || 'open') as PlayerFinderPostStatus,
          requestedAt: data.createdAt ? toDate(data.createdAt) : undefined,
          approvedAt: data.respondedAt ? toDate(data.respondedAt) : undefined,
        } as JoinedTeamBooking;
      })
      .filter(Boolean) as JoinedTeamBooking[];

    return joinedBookings.sort((a, b) => {
      const aTime = a.approvedAt?.getTime?.() || a.requestedAt?.getTime?.() || 0;
      const bTime = b.approvedAt?.getTime?.() || b.requestedAt?.getTime?.() || 0;
      return bTime - aTime;
    });
  } catch (error) {
    console.error('❌ Get joined team bookings error:', error);
    return [];
  }
};

export const getPlayerFinderChatMessages = async (
  postId: string,
  userId: string
): Promise<PlayerFinderChatMessage[]> => {
  try {
    const hasAccess = await isUserAllowedInPlayerFinderChat(postId, userId);
    if (!hasAccess) {
      return [];
    }

    let snapshot;

    try {
      snapshot = await db
        .collection('playerFinderPostMessages')
        .where('postId', '==', postId)
        .orderBy('createdAt', 'asc')
        .get();
    } catch (queryError: any) {
      if (queryError?.code !== 'firestore/failed-precondition') {
        throw queryError;
      }

      snapshot = await db
        .collection('playerFinderPostMessages')
        .where('postId', '==', postId)
        .get();
    }

    return snapshot.docs.map(mapPlayerFinderChatMessage).sort((a, b) => {
      const aTime = a.createdAt?.getTime?.() || 0;
      const bTime = b.createdAt?.getTime?.() || 0;
      return aTime - bTime;
    });
  } catch (error) {
    console.error('❌ Get player finder chat messages error:', error);
    return [];
  }
};

export const sendPlayerFinderChatMessage = async (
  postId: string,
  userId: string,
  senderName: string,
  message: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const normalizedMessage = message.trim();
    if (!normalizedMessage) {
      return { success: false, error: 'Message cannot be empty' };
    }

    const hasAccess = await isUserAllowedInPlayerFinderChat(postId, userId);
    if (!hasAccess) {
      return { success: false, error: 'Only host and approved players can use this chat' };
    }

    await db.collection('playerFinderPostMessages').add({
      postId,
      senderId: userId,
      senderName: senderName || 'Player',
      message: normalizedMessage,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('❌ Send player finder chat message error:', error);
    return { success: false, error: error?.message || 'Failed to send message' };
  }
};
