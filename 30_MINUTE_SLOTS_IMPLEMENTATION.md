# 30-Minute Slot Intervals Implementation

## Overview
Your booking system now supports **30-minute time slots** instead of 1-hour slots. Users can book turfs from any 30-minute interval (e.g., 10:00, 10:30, 11:00, 11:30, etc.).

## Changes Made

### 1. **Updated TIME_SLOTS Constant** (`lib/constants.ts`)
- Changed from 16 hourly slots (6 AM - 10 PM) to **32 half-hour slots**
- Each slot is now 30 minutes long
- Examples: `06:00-06:30`, `06:30-07:00`, `10:00-10:30`, `10:30-11:00`, etc.

### 2. **Updated generateDefaultSlots** (`screens/Owner/AddTurfScreen.tsx`)
- Generates 30-minute slots for new turfs
- Creates 32 slots per day (6:00 AM to 10:00 PM)
- Each hour now has 2 slots

### 3. **Enhanced calculateDuration** (`lib/utils.ts`)
- Now handles minutes, not just hours
- Correctly calculates durations like:
  - 10:00 to 11:00 = 1 hour
  - 10:00 to 10:30 = 0.5 hours
  - 10:30 to 12:00 = 1.5 hours
  - 10:00 to 11:30 = 1.5 hours

### 4. **Updated calculateBaseTurfAmount** (`lib/utils.ts`)
- Uses the enhanced `calculateDuration` function
- Properly calculates pricing for partial hours
- Examples (assuming ₹1000/hour):
  - 1 hour booking = ₹1000
  - 30 minutes = ₹500
  - 1.5 hours = ₹1500
  - 2.5 hours = ₹2500

## How It Works

### Booking Examples

**Example 1: Book 10:00 AM to 11:30 AM**
- Start Time: 10:00
- End Time: 11:30
- Duration: 1.5 hours
- Price: ₹1000/hr × 1.5 = ₹1500 (base amount)

**Example 2: Book 2:30 PM to 4:00 PM**
- Start Time: 14:30
- End Time: 16:00
- Duration: 1.5 hours
- Price: ₹1000/hr × 1.5 = ₹1500 (base amount)

**Example 3: Book 9:00 PM to 9:30 PM**
- Start Time: 21:00
- End Time: 21:30
- Duration: 0.5 hours
- Price: ₹1000/hr × 0.5 = ₹500 (base amount)

### Overlap Detection
The booking system automatically prevents overlapping bookings:
- If slot 10:00-11:00 is booked, users cannot book 10:30-11:30
- If slot 10:00-10:30 is booked, users can still book 10:30-11:00
- The system checks all 30-minute intervals between start and end time

### Payment Calculation
All existing payment logic still works:
1. **Base Turf Amount** = Price per hour × Duration in hours
2. **Platform Commission** = ₹25 (fixed)
3. **Razorpay Fee** = 2.07% of (Base + Commission)
4. **Total Amount** = Base + Commission + Razorpay Fee

## User Experience

### Before (1-hour slots):
- Users could only book: 10:00-11:00, 11:00-12:00, etc.
- Fixed hourly pricing

### After (30-minute slots):
- Users can book: 10:00-10:30, 10:30-11:00, 10:00-11:30, etc.
- Flexible timing
- Pro-rated pricing (e.g., 30 mins = half price)

## Benefits

1. ✅ **More Flexibility**: Users can book exactly when they want
2. ✅ **Better Utilization**: Fill gaps between bookings
3. ✅ **Fair Pricing**: Pay only for time used
4. ✅ **Competitive Advantage**: Most competitors only offer hourly slots
5. ✅ **Higher Revenue**: More booking opportunities per day

## Technical Notes

- **Backward Compatible**: Existing hourly bookings still work
- **No Database Changes**: Works with existing data structure
- **Performance**: Minimal impact (32 slots vs 16 slots)
- **UI**: Existing time picker automatically shows all available slots

## Testing Recommendations

1. Test booking 30-minute slots (e.g., 10:00-10:30)
2. Test booking 1.5-hour slots (e.g., 10:00-11:30)
3. Test overlap prevention (book 10:00-11:00, then try 10:30-11:30)
4. Verify pricing calculations for partial hours
5. Test on both iOS and Android

## Future Enhancements (Optional)

- **15-minute intervals**: Could reduce further to 15-min slots
- **Custom durations**: Let users pick exactly 45 mins, 75 mins, etc.
- **Dynamic pricing**: Different rates for peak/off-peak half-hours
- **Minimum duration**: Enforce minimum booking (e.g., 1 hour minimum)

## Support

If you encounter any issues:
1. Check that TIME_SLOTS has 32 entries
2. Verify calculateDuration returns correct decimal values
3. Ensure pricing calculations use the updated functions
4. Test with real bookings to confirm overlap detection works

---

**Implementation Date**: November 10, 2025
**Status**: ✅ Complete and Ready for Testing
