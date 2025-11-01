// TypeScript Type Definitions for Playmate App

// Navigation types
export interface RootStackParamList {
  Auth: undefined;
  Main: undefined;
  TurfDetail: { id: string };
  Admin: undefined;
}

export interface MainTabParamList {
  Home: undefined;
  Bookings: undefined;
  Explore: undefined;
  Profile: undefined;
}

export interface User {
  uid: string;
  name: string;
  email: string;
  role: 'user' | 'admin' | 'owner';
  createdAt: Date;
  phoneNumber?: string;
  photoURL?: string;
  // Owner-specific fields
  businessName?: string;
  phone?: string;
  razorpayAccountId?: string;
}

export interface Location {
  lat: number;
  lng: number;
  address: string;
  city?: string;
  placeId?: string;
}

export interface TimeSlot {
  startTime: string; // Format: "HH:MM"
  endTime: string;
  isBooked: boolean;
  bookingId?: string;
}

export interface Turf {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  location: Location;
  amenities: string[];
  availableSlots: TimeSlot[];
  rating?: number;
  reviews?: number;
  createdAt: Date;
  ownerId?: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerRazorpayId?: string;
  isActive?: boolean;
}

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  turfId: string;
  turfName: string;
  turfImage: string;
  turfLocation: Location;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  paymentId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentBreakdown: PaymentBreakdown;
  createdAt: Date;
}

// Payment breakdown type (CRITICAL)
export interface PaymentBreakdown {
  baseTurfAmount: number;        // Original turf price
  platformCommission: number;    // Rs 25
  razorpayFee: number;          // Payment gateway fee
  subtotal: number;
  totalAmount: number;           // Final amount user pays
  ownerShare: number;            // Amount for turf owner
  platformShare: number;         // Net platform earnings
}

export interface Transaction {
  id: string;
  bookingId: string;
  paymentId: string;
  amount: number;
  method: 'razorpay' | 'stripe';
  status: 'pending' | 'success' | 'failed';
  timestamp: Date;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  breakdown: PaymentBreakdown;
  transferId?: string;
  transferStatus?: 'pending' | 'processed' | 'failed';
}

// Form types
export interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignupFormData {
  fullName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

export interface TurfFormData {
  name: string;
  description: string;
  price: string;
  location: Location;
  images: string[];
  amenities: string[];
}

export interface BookingFormData {
  date: string;
  startTime: string;
  endTime: string;
  agreedToTerms: boolean;
}

