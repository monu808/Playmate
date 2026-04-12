// Firebase Firestore Functions
import firestore from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { Turf, Booking, User, BlockedSlot } from '../../types';

// Type alias for Firestore Timestamp
type Timestamp = ReturnType<typeof firestore.Timestamp.now>;

const normalizeTurfPricing = (data: any) => {
  const basePrice = data?.pricePerHour || data?.price || 0;
  return {
    dayPricePerHour: data?.dayPricePerHour || basePrice,
    nightPricePerHour: data?.nightPricePerHour || basePrice,
    dynamicPricingEnabled: data?.dynamicPricingEnabled ?? false,
    dynamicBoundaryTime: data?.dynamicBoundaryTime || '18:00',
    manualActivePeriod: data?.manualActivePeriod === 'night' ? 'night' : 'day',
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
    const snapshot = await db
      .collection('bookings')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Booking[];
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
    await db.collection('bookings').doc(id).update({ status });
    return { success: true };
  } catch (error: any) {
    console.error('Update booking status error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel booking
 */
export const cancelBooking = async (id: string): Promise<{ success: boolean; error?: string }> => {
  return updateBookingStatus(id, 'cancelled');
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
