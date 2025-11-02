// Seed data for Firestore
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Turf } from '../../types';

/**
 * Delete all existing turfs
 */
export const deleteAllTurfs = async (): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    console.log('🗑️ Deleting all existing turfs...');
    const turfsCol = collection(db, 'turfs');
    const snapshot = await getDocs(turfsCol);
    
    const deletePromises = snapshot.docs.map(document => 
      deleteDoc(doc(db, 'turfs', document.id))
    );
    
    await Promise.all(deletePromises);
    console.log(`✅ Deleted ${snapshot.size} turfs`);
    
    return { success: true, count: snapshot.size };
  } catch (error: any) {
    console.error('❌ Error deleting turfs:', error);
    return { success: false, count: 0, error: error.message };
  }
};

/**
 * Seed turfs with proper data structure
 */
export const seedTurfs = async (): Promise<{ success: boolean; count: number; error?: string }> => {
  try {
    console.log('🌱 Seeding turfs...');
    
    const turfsData: Omit<Turf, 'id'>[] = [
      {
        name: 'Champions Football Arena',
        description: 'Premium football turf with professional-grade artificial grass, floodlights, and changing rooms. Perfect for competitive matches and training sessions.',
        sport: 'football',
        price: 1500,
        pricePerHour: 1500,
        images: [
          'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800',
          'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800',
        ],
        location: {
          lat: 28.7041,
          lng: 77.1025,
          address: 'Connaught Place',
          city: 'New Delhi',
        },
        amenities: ['Parking', 'Changing Room', 'Floodlights', 'Drinking Water', 'First Aid'],
        availableSlots: [],
        rating: 4.8,
        reviews: 45,
        totalBookings: 120,
        totalReviews: 45,
        createdAt: new Date(),
        isActive: true,
      },
      {
        name: 'Elite Cricket Ground',
        description: 'Well-maintained cricket pitch with professional turf wicket. Equipped with practice nets, pavilion, and all modern facilities.',
        sport: 'cricket',
        price: 2000,
        pricePerHour: 2000,
        images: [
          'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=800',
          'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800',
        ],
        location: {
          lat: 28.6139,
          lng: 77.2090,
          address: 'Nehru Place',
          city: 'New Delhi',
        },
        amenities: ['Parking', 'Changing Room', 'Practice Nets', 'Seating Area', 'Restrooms'],
        availableSlots: [],
        rating: 4.6,
        reviews: 38,
        totalBookings: 95,
        totalReviews: 38,
        createdAt: new Date(),
        isActive: true,
      },
      {
        name: 'Pro Basketball Arena',
        description: 'Indoor basketball court with wooden flooring, professional hoops, and air conditioning. Ideal for serious players and tournaments.',
        sport: 'basketball',
        price: 1200,
        pricePerHour: 1200,
        images: [
          'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800',
          'https://images.unsplash.com/photo-1608245449230-4ac19066d2d0?w=800',
        ],
        location: {
          lat: 28.5355,
          lng: 77.3910,
          address: 'Sector 18, Noida',
          city: 'Noida',
        },
        amenities: ['Indoor', 'Air Conditioning', 'Changing Room', 'Drinking Water', 'Lockers'],
        availableSlots: [],
        rating: 4.9,
        reviews: 67,
        totalBookings: 200,
        totalReviews: 67,
        createdAt: new Date(),
        isActive: true,
      },
      {
        name: 'Ace Badminton Center',
        description: 'Premium badminton facility with 6 courts, wooden flooring, and excellent lighting. Rackets and shuttlecocks available on rent.',
        sport: 'badminton',
        price: 800,
        pricePerHour: 800,
        images: [
          'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
          'https://images.unsplash.com/photo-1613918108466-292b78a8ef95?w=800',
        ],
        location: {
          lat: 28.4595,
          lng: 77.0266,
          address: 'Sector 29, Gurgaon',
          city: 'Gurgaon',
        },
        amenities: ['Indoor', 'Air Conditioning', 'Equipment Rental', 'Parking', 'Cafeteria'],
        availableSlots: [],
        rating: 4.7,
        reviews: 52,
        totalBookings: 145,
        totalReviews: 52,
        createdAt: new Date(),
        isActive: true,
      },
      {
        name: 'Green Valley Football Turf',
        description: 'Spacious football ground with natural grass and modern amenities. Great for weekend matches and corporate tournaments.',
        sport: 'football',
        price: 1800,
        pricePerHour: 1800,
        images: [
          'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800',
          'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800',
        ],
        location: {
          lat: 28.5494,
          lng: 77.2001,
          address: 'Greater Kailash',
          city: 'New Delhi',
        },
        amenities: ['Parking', 'Changing Room', 'Floodlights', 'Spectator Seating', 'Refreshments'],
        availableSlots: [],
        rating: 4.5,
        reviews: 31,
        totalBookings: 78,
        totalReviews: 31,
        createdAt: new Date(),
        isActive: true,
      },
      {
        name: 'Victory Cricket Stadium',
        description: 'Professional cricket stadium with international standard facilities. Perfect for tournaments and serious practice sessions.',
        sport: 'cricket',
        price: 2500,
        pricePerHour: 2500,
        images: [
          'https://images.unsplash.com/photo-1512719994953-eabf50895df7?w=800',
          'https://images.unsplash.com/photo-1593341646782-e0b495cff86d?w=800',
        ],
        location: {
          lat: 28.6692,
          lng: 77.4538,
          address: 'Sector 62, Noida',
          city: 'Noida',
        },
        amenities: ['Parking', 'Pavilion', 'Practice Nets', 'Dressing Room', 'Scoreboard', 'Cafeteria'],
        availableSlots: [],
        rating: 4.9,
        reviews: 89,
        totalBookings: 234,
        totalReviews: 89,
        createdAt: new Date(),
        isActive: true,
      },
      {
        name: 'Urban Sports Basketball Court',
        description: 'Modern outdoor basketball court with quality surface and equipment. Great for casual games and practice.',
        sport: 'basketball',
        price: 900,
        pricePerHour: 900,
        images: [
          'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=800',
          'https://images.unsplash.com/photo-1515523110800-9415d13b84a8?w=800',
        ],
        location: {
          lat: 28.5706,
          lng: 77.3272,
          address: 'Sector 15, Noida',
          city: 'Noida',
        },
        amenities: ['Parking', 'Drinking Water', 'Seating Area', 'Equipment Storage'],
        availableSlots: [],
        rating: 4.4,
        reviews: 28,
        totalBookings: 67,
        totalReviews: 28,
        createdAt: new Date(),
        isActive: true,
      },
      {
        name: 'Premium Badminton Hub',
        description: 'State-of-the-art badminton facility with 8 courts and professional coaching available. Equipment provided.',
        sport: 'badminton',
        price: 1000,
        pricePerHour: 1000,
        images: [
          'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800',
          'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800',
        ],
        location: {
          lat: 28.4089,
          lng: 77.3178,
          address: 'Sector 44, Gurgaon',
          city: 'Gurgaon',
        },
        amenities: ['Indoor', 'Air Conditioning', 'Coaching', 'Equipment Rental', 'Parking', 'Shower'],
        availableSlots: [],
        rating: 4.8,
        reviews: 76,
        totalBookings: 189,
        totalReviews: 76,
        createdAt: new Date(),
        isActive: true,
      },
    ];

    const addPromises = turfsData.map(turf => 
      addDoc(collection(db, 'turfs'), turf)
    );
    
    await Promise.all(addPromises);
    console.log(`✅ Successfully seeded ${turfsData.length} turfs`);
    
    return { success: true, count: turfsData.length };
  } catch (error: any) {
    console.error('❌ Error seeding turfs:', error);
    return { success: false, count: 0, error: error.message };
  }
};

/**
 * Reset turfs - delete all and seed new ones
 */
export const resetTurfs = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🔄 Resetting turfs...');
    
    // Delete all existing turfs
    const deleteResult = await deleteAllTurfs();
    if (!deleteResult.success) {
      return { success: false, message: deleteResult.error || 'Failed to delete turfs' };
    }
    
    // Seed new turfs
    const seedResult = await seedTurfs();
    if (!seedResult.success) {
      return { success: false, message: seedResult.error || 'Failed to seed turfs' };
    }
    
    console.log('✅ Turfs reset complete!');
    return { 
      success: true, 
      message: `Deleted ${deleteResult.count} old turfs and added ${seedResult.count} new turfs` 
    };
  } catch (error: any) {
    console.error('❌ Error resetting turfs:', error);
    return { success: false, message: error.message };
  }
};
