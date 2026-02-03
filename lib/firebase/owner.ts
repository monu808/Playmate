// Firebase Owner Functions
import { Timestamp } from '@react-native-firebase/firestore';
import { db } from '../../config/firebase';
import { Turf, Booking } from '../../types';

// ============ OWNER TURFS ============

/**
 * Get turfs owned by a specific owner
 */
export const getOwnerTurfs = async (ownerId: string): Promise<Turf[]> => {
  try {
    console.log('📡 Fetching turfs for owner:', ownerId);
    const snapshot = await db.collection('turfs').where('ownerId', '==', ownerId).get();
    
    console.log('📊 Found', snapshot.size, 'turfs for owner');
    
    const turfs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        verifiedAt: data.verifiedAt?.toDate?.(),
      };
    }) as Turf[];
    
    // Sort client-side by createdAt descending (newest first)
    return turfs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('❌ Get owner turfs error:', error);
    return [];
  }
};

/**
 * Create new turf (owner creates, pending admin verification)
 */
export const createOwnerTurf = async (
  turfData: Omit<Turf, 'id' | 'createdAt' | 'isVerified' | 'totalBookings' | 'totalReviews'>
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    console.log('📝 Creating new turf...');
    
    const newTurf = {
      ...turfData,
      isVerified: false, // Pending admin verification
      isActive: false,   // Inactive until verified
      totalBookings: 0,
      totalReviews: 0,
      rating: 0,
      reviews: 0,
      createdAt: Timestamp.now(),
    };
    
    const docRef = await db.collection('turfs').add(newTurf);
    console.log('✅ Turf created with ID:', docRef.id);
    
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error('❌ Create turf error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update owner's turf (only if not verified or owner fields)
 */
export const updateOwnerTurf = async (
  turfId: string,
  ownerId: string,
  turfData: Partial<Turf>
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Verify ownership first
    const turfSnap = await db.collection('turfs').doc(turfId).get();
    
    if (!turfSnap.exists) {
      return { success: false, error: 'Turf not found' };
    }
    
    const turf = turfSnap.data() as Turf;
    if (turf.ownerId !== ownerId) {
      return { success: false, error: 'Unauthorized: You do not own this turf' };
    }
    
    // Prevent updating verification status
    const { isVerified, verifiedAt, verifiedBy, ...safeData } = turfData;
    
    await db.collection('turfs').doc(turfId).update(safeData);
    console.log('✅ Turf updated:', turfId);
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Update turf error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle turf active status (owner can activate/deactivate)
 */
export const toggleTurfActive = async (
  turfId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const turfSnap = await db.collection('turfs').doc(turfId).get();
    
    if (!turfSnap.exists) {
      return { success: false, error: 'Turf not found' };
    }
    
    const turf = turfSnap.data() as Turf;
    if (turf.ownerId !== ownerId) {
      return { success: false, error: 'Unauthorized' };
    }
    
    // Can only activate if verified
    if (!turf.isVerified && !turf.isActive) {
      return { success: false, error: 'Cannot activate unverified turf' };
    }
    
    await db.collection('turfs').doc(turfId).update({
      isActive: !turf.isActive,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('❌ Toggle turf active error:', error);
    return { success: false, error: error.message };
  }
};

// ============ OWNER BOOKINGS ============

/**
 * Get all bookings for owner's turfs
 */
export const getOwnerBookings = async (ownerId: string): Promise<Booking[]> => {
  try {
    console.log('📡 Fetching bookings for owner:', ownerId);
    
    // First get all owner's turfs
    const turfs = await getOwnerTurfs(ownerId);
    const turfIds = turfs.map(t => t.id);
    
    if (turfIds.length === 0) {
      return [];
    }
    
    // Get bookings for these turfs
    // Note: Firestore 'in' query supports up to 10 items
    const bookings: Booking[] = [];
    
    // Process in batches of 10
    for (let i = 0; i < turfIds.length; i += 10) {
      const batch = turfIds.slice(i, i + 10);
      const snapshot = await db.collection('bookings').where('turfId', 'in', batch).get();
      
      const batchBookings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.() || new Date(),
      })) as Booking[];
      
      bookings.push(...batchBookings);
    }
    
    // Sort client-side by createdAt descending (newest first)
    bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    console.log('✅ Found', bookings.length, 'bookings');
    return bookings;
  } catch (error) {
    console.error('❌ Get owner bookings error:', error);
    return [];
  }
};

/**
 * Get bookings for a specific turf
 */
export const getTurfBookingsByOwner = async (
  turfId: string,
  ownerId: string
): Promise<Booking[]> => {
  try {
    // Verify ownership
    const turfSnap = await db.collection('turfs').doc(turfId).get();
    
    if (!turfSnap.exists) {
      throw new Error('Turf not found');
    }
    
    const turf = turfSnap.data() as Turf;
    if (turf.ownerId !== ownerId) {
      throw new Error('Unauthorized');
    }
    
    const snapshot = await db.collection('bookings').where('turfId', '==', turfId).get();
    const bookings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || new Date(),
    })) as Booking[];
    
    // Sort client-side by createdAt descending (newest first)
    return bookings.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  } catch (error) {
    console.error('❌ Get turf bookings error:', error);
    return [];
  }
};

// ============ OWNER ANALYTICS ============

/**
 * Get owner dashboard stats
 */
export const getOwnerStats = async (ownerId: string) => {
  try {
    console.log('📊 Fetching owner stats for:', ownerId);
    
    const turfs = await getOwnerTurfs(ownerId);
    const bookings = await getOwnerBookings(ownerId);
    
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = new Date().toISOString().substring(0, 7); // YYYY-MM
    
    // Calculate stats
    const activeTurfs = turfs.filter(t => t.isActive && t.isVerified).length;
    const pendingTurfs = turfs.filter(t => !t.isVerified).length;
    const inactiveTurfs = turfs.filter(t => !t.isActive && t.isVerified).length;
    
    const todayBookings = bookings.filter(b => b.date === today).length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const totalBookings = bookings.length;
    
    // Calculate revenue
    const totalRevenue = bookings
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.paymentBreakdown?.ownerShare || b.totalAmount || 0), 0);
    
    const todayRevenue = bookings
      .filter(b => b.date === today && (b.status === 'confirmed' || b.status === 'completed'))
      .reduce((sum, b) => sum + (b.paymentBreakdown?.ownerShare || b.totalAmount || 0), 0);
    
    const monthRevenue = bookings
      .filter(b => b.date?.startsWith(thisMonth) && (b.status === 'confirmed' || b.status === 'completed'))
      .reduce((sum, b) => sum + (b.paymentBreakdown?.ownerShare || b.totalAmount || 0), 0);
    
    console.log('✅ Stats calculated successfully');
    
    return {
      turfs: {
        total: turfs.length,
        active: activeTurfs,
        pending: pendingTurfs,
        inactive: inactiveTurfs,
      },
      bookings: {
        total: totalBookings,
        today: todayBookings,
        confirmed: confirmedBookings,
      },
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        thisMonth: monthRevenue,
      },
    };
  } catch (error) {
    console.error('❌ Get owner stats error:', error);
    return {
      turfs: { total: 0, active: 0, pending: 0, inactive: 0 },
      bookings: { total: 0, today: 0, confirmed: 0 },
      revenue: { total: 0, today: 0, thisMonth: 0 },
    };
  }
};

/**
 * Get revenue analytics for date range
 */
export const getOwnerRevenueAnalytics = async (
  ownerId: string,
  startDate: string,
  endDate: string
) => {
  try {
    const bookings = await getOwnerBookings(ownerId);
    
    // Filter by date range
    const filteredBookings = bookings.filter(b => {
      const bookingDate = b.date;
      return bookingDate >= startDate && bookingDate <= endDate;
    });
    
    // Group by date
    const revenueByDate: { [date: string]: number } = {};
    
    filteredBookings.forEach(booking => {
      if (booking.status === 'confirmed' || booking.status === 'completed') {
        const date = booking.date;
        const revenue = booking.paymentBreakdown?.ownerShare || booking.totalAmount || 0;
        revenueByDate[date] = (revenueByDate[date] || 0) + revenue;
      }
    });
    
    // Convert to array format for charts
    const revenueData = Object.entries(revenueByDate)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    return {
      revenueByDate: revenueData,
      totalRevenue: revenueData.reduce((sum, item) => sum + item.amount, 0),
      totalBookings: filteredBookings.length,
      averageBookingValue: filteredBookings.length > 0 
        ? revenueData.reduce((sum, item) => sum + item.amount, 0) / filteredBookings.length 
        : 0,
    };
  } catch (error) {
    console.error('❌ Get revenue analytics error:', error);
    return {
      revenueByDate: [],
      totalRevenue: 0,
      totalBookings: 0,
      averageBookingValue: 0,
    };
  }
};
