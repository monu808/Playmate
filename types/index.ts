// TypeScript Type Definitions for Playmate App

// Navigation types
export interface RootStackParamList extends Record<string, any> {
  Auth: undefined;
  Main: undefined;
  TurfDetail: { id: string };
  Admin: undefined;
  Owner: undefined;
  GroupDetail: { groupId: string };
  ReviewsGiven: undefined;
}

export interface MainTabParamList {
  Home: undefined;
  Bookings: undefined;
  Players: undefined;
  Profile: undefined;
}

export interface OwnerTabParamList {
  OwnerDashboard: undefined;
  MyTurfs: undefined;
  OwnerBookings: undefined;
  OwnerAnalytics: undefined;
  OwnerProfile: undefined;
}

// Sport types
export type TurfSport = 'football' | 'cricket' | 'basketball' | 'badminton' | 'tennis' | 'volleyball';

export interface User {
  uid: string;
  name?: string;
  email: string | null;
  role: 'user' | 'admin' | 'owner';
  createdAt: Date;
  phoneNumber?: string | null;
  photoURL?: string | null;
  displayName?: string | null;
  spiritPoints?: number;
  totalSpiritPointsEarned?: number;
  completedMatchesCount?: number;
  nextRewardAtCompletedCount?: number;
  // Admin-specific fields
  isAdmin?: boolean;
  adminSince?: Date;
  permissions?: {
    manageTurfs: boolean;
    manageBookings: boolean;
    manageUsers: boolean;
    viewAnalytics: boolean;
  };
  // Owner-specific fields
  businessName?: string;
  phone?: string;
  razorpayAccountId?: string;
  profileAchievements?: {
    firstMatchUnlocked?: boolean;
    fiveMatchesUnlocked?: boolean;
    tenMatchesUnlocked?: boolean;
  };
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

export type PricingPeriod = 'day' | 'night';

export type DiscountSource = 'none' | 'happy_hour' | 'reward_code' | 'spirit_points';

export interface AppliedDiscount {
  source: DiscountSource;
  label: string;
  amount: number;
  percentage?: number;
  rewardCode?: string;
  spiritPointsUsed?: number;
}

export interface Turf {
  id: string;
  name: string;
  description: string;
  sport: TurfSport;
  price: number;                 // Legacy field
  pricePerHour: number;         // New field
  dayPricePerHour?: number;     // Day pricing (owner/admin configurable)
  nightPricePerHour?: number;   // Night pricing (owner/admin configurable)
  dynamicPricingEnabled?: boolean;
  dynamicBoundaryTime?: string; // Format: "HH:MM", defaults to 18:00
  manualActivePeriod?: PricingPeriod; // Used when dynamic pricing is off
  happyHourEnabled?: boolean;
  happyHourDiscountPercent?: number;
  happyHourStartTime?: string; // Format: "HH:MM", defaults to 11:00
  happyHourEndTime?: string; // Format: "HH:MM", defaults to 16:00
  happyHourLeadTimeMinutes?: number; // Defaults to 120
  images: string[];
  location: Location;
  amenities: string[];
  availableSlots: TimeSlot[];
  rating?: number;
  reviews?: number;
  totalBookings?: number;
  totalReviews?: number;
  createdAt: Date;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  ownerRazorpayId?: string;
  isActive: boolean;
  isVerified: boolean;           // Admin verification status
  verifiedAt?: Date;
  verifiedBy?: string;           // Admin ID who verified
  rejectionReason?: string;      // If rejected by admin
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
  sport?: TurfSport;
  date: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  paymentId: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentBreakdown: PaymentBreakdown;
  appliedDiscount?: AppliedDiscount;
  requestedRewardCode?: string;
  redeemedRewardCode?: string;
  requestedSpiritPoints?: number;
  redeemedSpiritPoints?: number;
  createdAt: Date;
  completedAt?: Date;
  hasReview?: boolean;
  reviewId?: string;
  cancelledAt?: Date;
  cancelledBy?: 'user' | 'owner' | 'admin';
  refundDetails?: RefundDetails;
}

export type PlayerFinderPostStatus = 'open' | 'full' | 'cancelled' | 'completed';
export type PlayerJoinRequestStatus = 'pending' | 'approved' | 'declined' | 'cancelled';

export interface PlayerParticipant {
  userId: string;
  name: string;
  role: 'host' | 'player';
  joinedAt: Date;
}

export interface PlayerFinderPost {
  id: string;
  bookingId: string;
  createdBy: string;
  createdByName: string;
  turfId: string;
  turfName: string;
  turfImage: string;
  turfLocation: Location;
  sport: TurfSport;
  date: string;
  startTime: string;
  endTime: string;
  requiredPlayers: number;
  currentPlayers: number;
  status: PlayerFinderPostStatus;
  inviteScope?: 'public' | 'group';
  groupId?: string;
  groupName?: string;
  participants: PlayerParticipant[];
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type GroupInvitationStatus = 'pending' | 'accepted' | 'declined';

export interface PlayerGroupMember {
  userId: string;
  name: string;
  role: 'owner' | 'member';
  joinedAt: Date;
  photoURL?: string | null;
  email?: string | null;
}

export interface PlayerGroup {
  id: string;
  name: string;
  description?: string;
  sports?: TurfSport[];
  createdBy: string;
  createdByName: string;
  memberIds: string[];
  members: PlayerGroupMember[];
  memberCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupInvitation {
  id: string;
  groupId: string;
  groupName: string;
  groupOwnerId: string;
  invitedBy: string;
  invitedByName: string;
  invitedUserId: string;
  invitedUserEmail: string;
  status: GroupInvitationStatus;
  createdAt: Date;
  updatedAt?: Date;
  respondedAt?: Date;
}

export interface TurfReview {
  id: string;
  bookingId: string;
  turfId: string;
  turfName: string;
  userId: string;
  userName: string;
  rating: number;
  comment?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface PlayerFinderBookingSnapshot {
  bookingId: string;
  turfId: string;
  turfName: string;
  turfImage: string;
  turfLocation: Location;
  hostId: string;
  hostName: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface PlayerFinderJoinRequest {
  id: string;
  postId: string;
  bookingId: string;
  hostId: string;
  requestedBy: string;
  requestedByName: string;
  requestedByPhone?: string | null;
  requestedByPhotoURL?: string | null;
  status: PlayerJoinRequestStatus;
  bookingSnapshot?: PlayerFinderBookingSnapshot;
  createdAt: Date;
  respondedAt?: Date;
}

export interface PlayerFinderChatMessage {
  id: string;
  postId: string;
  senderId: string;
  senderName: string;
  message: string;
  createdAt: Date;
}

export interface JoinedTeamBooking extends PlayerFinderBookingSnapshot {
  postId: string;
  teamStatus: PlayerFinderPostStatus;
  requestedAt?: Date;
  approvedAt?: Date;
}

export type RefundStatus = 'none' | 'pending' | 'processed' | 'failed';
export type RefundPolicyApplied = 'full_refund' | 'late_cancellation_fee';

export interface RefundDetails {
  status: RefundStatus;
  policyApplied: RefundPolicyApplied;
  minutesBeforeStart: number;
  refundAmount: number;
  cancellationCharge: number;
  ownerCompensation: number;
  platformRetention: number;
  refundId?: string;
  initiatedAt?: Date;
  processedAt?: Date;
  failureReason?: string;
}

// Blocked/Locked slots for offline bookings
export interface BlockedSlot {
  id: string;
  turfId: string;
  turfName: string;
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;           // Optional reason (e.g., "Phone booking - John")
  blockedBy: string;         // Owner/Admin ID who blocked
  blockedByName: string;
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
  discountAmount?: number;
  discountSource?: DiscountSource;
  discountLabel?: string;
  originalSubtotal?: number;
  rewardCode?: string;
  spiritPointsRedeemed?: number;
  isHappyHourApplied?: boolean;
}

export interface Transaction {
  id: string;
  bookingId: string;
  type: 'payment' | 'refund';
  userId: string;
  turfId?: string;
  turfName?: string;
  paymentId: string;
  amount: number;
  currency?: string;
  method: 'razorpay' | 'stripe';
  status: 'pending' | 'success' | 'processed' | 'failed';
  timestamp: Date;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  breakdown: PaymentBreakdown;
  transferId?: string;
  transferStatus?: 'pending' | 'processed' | 'failed';
  refundAmount?: number;
  cancellationCharge?: number;
  ownerCompensation?: number;
  platformRetention?: number;
  refundStatus?: RefundStatus;
  refundId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface RewardCode {
  id: string;
  code: string;
  userId: string;
  discountPercent: number;
  maxDiscountAmount?: number;
  milestoneCompletedCount: number;
  status: 'active' | 'redeemed' | 'expired';
  generatedAt: Date;
  redeemedAt?: Date;
  redeemedBookingId?: string;
  expiresAt?: Date;
}

export interface SpiritPointsLedgerEntry {
  id: string;
  userId: string;
  bookingId?: string;
  type: 'earned' | 'redeemed' | 'adjusted';
  points: number;
  rupeeValue: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string;
  createdAt: Date;
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

