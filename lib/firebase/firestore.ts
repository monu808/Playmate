// Firebase Firestore Functions
import firestore from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { Turf, Booking, User } from '../../types';

// Type alias for Firestore Timestamp
type Timestamp = ReturnType<typeof firestore.Timestamp.now>;

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
