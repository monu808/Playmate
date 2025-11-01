// Application Constants

// Payment constants (EXACT values from website - CRITICAL)
export const PLATFORM_COMMISSION = 25; // Rs 25 per booking
export const RAZORPAY_FEE_PERCENTAGE = 2.07; // 1.75% + 18% GST

// Time slots
export const TIME_SLOTS = [
  { startTime: '06:00', endTime: '07:00' },
  { startTime: '07:00', endTime: '08:00' },
  { startTime: '08:00', endTime: '09:00' },
  { startTime: '09:00', endTime: '10:00' },
  { startTime: '10:00', endTime: '11:00' },
  { startTime: '11:00', endTime: '12:00' },
  { startTime: '12:00', endTime: '13:00' },
  { startTime: '13:00', endTime: '14:00' },
  { startTime: '14:00', endTime: '15:00' },
  { startTime: '15:00', endTime: '16:00' },
  { startTime: '16:00', endTime: '17:00' },
  { startTime: '17:00', endTime: '18:00' },
  { startTime: '18:00', endTime: '19:00' },
  { startTime: '19:00', endTime: '20:00' },
  { startTime: '20:00', endTime: '21:00' },
  { startTime: '21:00', endTime: '22:00' },
];

// Amenities options
export const AMENITIES = [
  'Floodlights',
  'Parking',
  'Changing Room',
  'Washroom',
  'First Aid',
  'Drinking Water',
  'Seating Area',
  'Scoreboard',
  'Equipment Rental',
  'Shower',
  'Locker Room',
  'Refreshments',
  'WiFi',
  'CCTV',
  'Security',
];

// Booking status
export const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
} as const;

// User roles
export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

// Filter options
export const PRICE_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: 'Under ₹500', min: 0, max: 500 },
  { label: '₹500 - ₹1000', min: 500, max: 1000 },
  { label: '₹1000 - ₹2000', min: 1000, max: 2000 },
  { label: 'Above ₹2000', min: 2000, max: Infinity },
];

// Sort options
export const SORT_OPTIONS = [
  { label: 'Recommended', value: 'recommended' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
  { label: 'Distance', value: 'distance' },
];

// Validation rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[6-9]\d{9}$/,
  PASSWORD_MIN_LENGTH: 6,
  NAME_MIN_LENGTH: 2,
  DESCRIPTION_MIN_LENGTH: 20,
  DESCRIPTION_MAX_LENGTH: 500,
};

// API endpoints (adjust based on your backend)
export const API_BASE_URL = 'https://your-api-url.com';
export const API_ENDPOINTS = {
  PAYMENT_INITIATE: '/api/payment/initiate',
  PAYMENT_VERIFY: '/api/payment/verify',
  BOOKING_CREATE: '/api/bookings/create',
  BOOKING_CANCEL: '/api/bookings/cancel',
};

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTH_FAILED: 'Authentication failed. Please try again.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_PHONE: 'Please enter a valid phone number.',
  WEAK_PASSWORD: 'Password must be at least 6 characters.',
  REQUIRED_FIELD: 'This field is required.',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  BOOKING_FAILED: 'Booking failed. Please try again.',
  SLOT_UNAVAILABLE: 'Selected slot is no longer available.',
};

// Success messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Logged in successfully!',
  SIGNUP_SUCCESS: 'Account created successfully!',
  BOOKING_SUCCESS: 'Booking confirmed successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  TURF_ADDED: 'Turf added successfully!',
  TURF_UPDATED: 'Turf updated successfully!',
};
