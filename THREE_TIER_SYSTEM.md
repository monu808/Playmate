# 🏗️ Three-Tier System Implementation Guide

## System Overview

The Playmate app now has a **three-tier role-based access control (RBAC)** system:

### 1. **👤 Users** (Regular Customers)
- Browse and search for turfs
- View turf details with map location
- Book turfs and make payments
- View booking history
- Generate and show QR codes for bookings
- Cancel bookings
- Rate and review turfs

### 2. **🏪 Turf Owners** (Business Owners)
- Add new turfs (requires admin verification)
- Manage their own turfs
- Edit turf details and pricing
- Scan QR codes to verify bookings
- View turf-specific analytics and revenue
- Track bookings for their turfs
- Activate/deactivate turfs
- Respond to customer reviews

### 3. **👑 Admins** (Super Users - Full Control)
- Verify/reject turf listings
- Manage all turfs across platform
- Manage all users (user, owner, admin roles)
- Access platform-wide analytics
- View all bookings system-wide
- Scan QR codes anywhere
- Handle disputes and refunds
- System configuration and settings

---

## 🗂️ Project Structure

```
screens/
├── Auth/
│   ├── LoginScreen.tsx          # Common login for all roles
│   └── SignupScreen.tsx         # Common signup
│
├── Owner/                        # 🆕 OWNER SCREENS
│   ├── OwnerDashboardScreen.tsx # Owner dashboard with revenue stats
│   ├── MyTurfsScreen.tsx        # List of owner's turfs
│   ├── AddTurfScreen.tsx        # Create new turf (pending verification)
│   ├── EditTurfScreen.tsx       # Edit existing turf
│   ├── OwnerScanQRScreen.tsx    # QR scanner for booking verification
│   ├── TurfBookingsScreen.tsx   # Bookings for specific turf
│   └── TurfAnalyticsScreen.tsx  # Revenue & analytics per turf
│
├── Admin/                        # ADMIN SCREENS
│   ├── AdminDashboardScreen.tsx # Platform-wide stats
│   ├── ManageTurfsScreen.tsx    # Verify/manage all turfs
│   ├── PendingTurfsScreen.tsx   # 🆕 Approve/reject new turfs
│   ├── ManageUsersScreen.tsx    # 🆕 User role management
│   ├── AdminBookingsScreen.tsx  # All bookings
│   ├── AnalyticsScreen.tsx      # Platform analytics
│   ├── ScanQRScreen.tsx         # QR verification
│   └── AddTurfScreen.tsx        # Direct turf creation (auto-verified)
│
└── User/                         # USER SCREENS
    ├── HomeScreen.tsx            # Browse turfs with map
    ├── TurfDetailScreen.tsx      # View turf details
    ├── BookingsScreen.tsx        # User's bookings
    └── ProfileScreen.tsx         # User profile

navigation/
└── index.tsx                     # 🆕 Three-tier navigation logic

types/
└── index.ts                      # 🆕 Updated with OwnerTabParamList & verification fields
```

---

## 🔐 User Role Definitions

### Database Schema (Firestore `users` collection)

```typescript
interface User {
  uid: string;
  email: string;
  displayName?: string;
  phoneNumber?: string;
  photoURL?: string;
  role: 'user' | 'owner' | 'admin';  // 🔑 KEY FIELD
  createdAt: Date;
  
  // Owner-specific fields
  businessName?: string;
  phone?: string;
  razorpayAccountId?: string;
  
  // Admin-specific fields
  isAdmin?: boolean;
  adminSince?: Date;
  permissions?: {
    manageTurfs: boolean;
    manageBookings: boolean;
    manageUsers: boolean;
    viewAnalytics: boolean;
  };
}
```

### Turf Schema (Updated)

```typescript
interface Turf {
  id: string;
  name: string;
  description: string;
  sport: TurfSport;
  pricePerHour: number;
  images: string[];
  location: Location;
  amenities: string[];
  
  // Owner information
  ownerId: string;              // 🔑 Links to owner
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  
  // Verification fields (🆕)
  isActive: boolean;            // Owner can toggle
  isVerified: boolean;          // 🔑 Only admin can approve
  verifiedAt?: Date;
  verifiedBy?: string;          // Admin ID
  rejectionReason?: string;     // If rejected by admin
  
  // Stats
  rating?: number;
  totalBookings?: number;
  totalReviews?: number;
  createdAt: Date;
}
```

---

## 🔄 Turf Verification Workflow

### Step 1: Owner Creates Turf
```
Owner adds new turf → 
Status: isVerified = false, isActive = false → 
Turf appears in "Pending Verification" for admins
```

### Step 2: Admin Reviews
```
Admin views pending turfs → 
Admin can:
  ✅ Approve → isVerified = true, isActive = true
  ❌ Reject → isVerified = false, rejectionReason = "..."
```

### Step 3: Post-Verification
```
✅ Approved → Turf visible to all users, owner can manage
❌ Rejected → Owner notified, can edit and resubmit
```

---

## 🚀 Implementation Steps

### ✅ Phase 1: Core Structure (COMPLETED)
- [x] Update types with role system
- [x] Create OwnerDashboardScreen
- [x] Create MyTurfsScreen
- [x] Update navigation with three tiers
- [x] Add verification fields to Turf type

### 🔨 Phase 2: Owner Features (TODO)
- [ ] Create AddTurfScreen for owners
- [ ] Create EditTurfScreen
- [ ] Create OwnerScanQRScreen (copy from Admin)
- [ ] Create TurfBookingsScreen (filtered by turf)
- [ ] Create TurfAnalyticsScreen with revenue charts
- [ ] Update Profile screen to show owner-specific options

### 🔨 Phase 3: Admin Enhancements (TODO)
- [ ] Create PendingTurfsScreen for verification
- [ ] Add "Verify" and "Reject" actions to ManageTurfsScreen
- [ ] Create ManageUsersScreen (assign roles)
- [ ] Add role change functionality
- [ ] Platform-wide analytics dashboard
- [ ] System settings screen

### 🔨 Phase 4: Firestore Functions (TODO)
- [ ] Create `verifyTurf(turfId, adminId)` function
- [ ] Create `rejectTurf(turfId, reason)` function
- [ ] Create `changeUserRole(userId, newRole)` function
- [ ] Update `getTurfs()` to filter by verification status
- [ ] Create `getOwnerTurfs(ownerId)` function
- [ ] Create `getPendingTurfs()` for admins
- [ ] Create `getTurfRevenue(turfId, dateRange)` function

### 🔨 Phase 5: Firestore Security Rules (TODO)
```javascript
// Turfs collection
match /turfs/{turfId} {
  // Anyone can read verified turfs
  allow read: if resource.data.isVerified == true;
  
  // Owners can read their own turfs (even if not verified)
  allow read: if request.auth.uid == resource.data.ownerId;
  
  // Admins can read all turfs
  allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  
  // Only owners can create turfs (auto-unverified)
  allow create: if request.auth != null && 
                   request.resource.data.ownerId == request.auth.uid &&
                   request.resource.data.isVerified == false;
  
  // Owners can update their own turfs (except verification status)
  allow update: if request.auth.uid == resource.data.ownerId &&
                   request.resource.data.isVerified == resource.data.isVerified;
  
  // Only admins can verify/reject turfs
  allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  
  // Only admins can delete turfs
  allow delete: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// Users collection
match /users/{userId} {
  // Users can read their own profile
  allow read: if request.auth.uid == userId;
  
  // Admins can read all users
  allow read: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  
  // Users can update their own profile (except role)
  allow update: if request.auth.uid == userId &&
                   request.resource.data.role == resource.data.role;
  
  // Only admins can change user roles
  allow update: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

---

## 🎨 Owner Dashboard Features

### Revenue Card
```
┌─────────────────────────────────┐
│ 💰 Total Revenue                │
│ ₹4,50,000                       │
│                                  │
│ Today: ₹7,500 | Month: ₹1,25,000│
└─────────────────────────────────┘
```

### Stats Grid
```
┌─────────┬─────────┐
│ Active  │ Pending │
│ 2/3     │    1    │
└─────────┴─────────┘
┌─────────┬─────────┐
│ Today   │  Total  │
│   5     │   156   │
└─────────┴─────────┘
```

### Quick Actions
```
┌──────────┬──────────┐
│ Add Turf │ Scan QR  │
└──────────┴──────────┘
┌──────────┬──────────┐
│ My Turfs │ Bookings │
└──────────┴──────────┘
```

---

## 📱 Owner Screens Details

### 1. Add Turf Screen
```
Form Fields:
- Turf Name
- Description
- Sport Type (dropdown)
- Price per Hour
- Location (with map picker)
- Upload Images (up to 5)
- Amenities (multi-select)
- Operating Hours

Button: Submit for Verification
Status: Pending until admin approves
```

### 2. My Turfs Screen
```
Turf List Items:
- Turf Image
- Status Badge (Active/Pending/Inactive)
- Name & Location
- Bookings count
- Rating
- Price
- Quick Actions:
  → View Bookings
  → Analytics
  → Settings/Edit
```

### 3. Turf Analytics Screen
```
Charts:
- Revenue Trend (Line chart)
- Bookings by Day (Bar chart)
- Peak Hours (Heatmap)
- Popular Sports (Pie chart)

Stats:
- Total Revenue
- Average Booking Value
- Occupancy Rate
- Customer Ratings
```

### 4. Owner QR Scanner
```
Features:
- Same QR scanning functionality as admin
- Only verifies bookings for owner's turfs
- Shows booking details
- Mark as "Checked In" or "Completed"
- Cannot access bookings from other turfs
```

---

## 👑 Admin Enhancements

### Pending Turfs Screen
```
┌───────────────────────────────────┐
│ 🔍 Pending Verification (3)      │
├───────────────────────────────────┤
│ Green Valley Football Arena       │
│ Owner: John Doe                   │
│ Location: MG Road, Sehore         │
│ Price: ₹1,500/hr                  │
│                                    │
│ [✅ Approve]  [❌ Reject]          │
└───────────────────────────────────┘
```

### Manage Users Screen
```
User List:
- Name & Email
- Current Role Badge
- Registration Date
- Total Bookings (if user)
- Total Turfs (if owner)

Actions:
- Change Role (dropdown)
- Suspend Account
- Delete User
- View Activity
```

### Platform Analytics
```
Metrics:
- Total Users: 10,234
- Total Owners: 156
- Total Turfs: 453
- Total Bookings: 45,678
- Total Revenue: ₹1.2Cr
- Platform Commission: ₹15L

Charts:
- User Growth
- Revenue Trend
- Top Performing Turfs
- City-wise Distribution
```

---

## 🔧 Firestore Functions to Implement

### lib/firebase/turfs.ts
```typescript
// Owner creates turf (unverified)
export async function createTurf(turfData: TurfFormData, ownerId: string) {
  const turf = {
    ...turfData,
    ownerId,
    isVerified: false,
    isActive: false,
    createdAt: new Date(),
  };
  return await addDoc(collection(db, 'turfs'), turf);
}

// Get owner's turfs
export async function getOwnerTurfs(ownerId: string) {
  const q = query(
    collection(db, 'turfs'),
    where('ownerId', '==', ownerId)
  );
  return await getDocs(q);
}

// Get pending turfs (admin only)
export async function getPendingTurfs() {
  const q = query(
    collection(db, 'turfs'),
    where('isVerified', '==', false)
  );
  return await getDocs(q);
}

// Verify turf (admin only)
export async function verifyTurf(turfId: string, adminId: string) {
  await updateDoc(doc(db, 'turfs', turfId), {
    isVerified: true,
    isActive: true,
    verifiedAt: new Date(),
    verifiedBy: adminId,
  });
}

// Reject turf (admin only)
export async function rejectTurf(turfId: string, reason: string) {
  await updateDoc(doc(db, 'turfs', turfId), {
    isVerified: false,
    rejectionReason: reason,
  });
}

// Toggle turf active status (owner only)
export async function toggleTurfStatus(turfId: string, isActive: boolean) {
  await updateDoc(doc(db, 'turfs', turfId), {
    isActive,
  });
}
```

### lib/firebase/analytics.ts
```typescript
// Get turf revenue
export async function getTurfRevenue(
  turfId: string,
  startDate: Date,
  endDate: Date
) {
  const q = query(
    collection(db, 'bookings'),
    where('turfId', '==', turfId),
    where('status', '==', 'completed'),
    where('createdAt', '>=', startDate),
    where('createdAt', '<=', endDate)
  );
  
  const snapshot = await getDocs(q);
  let totalRevenue = 0;
  
  snapshot.forEach((doc) => {
    const booking = doc.data();
    totalRevenue += booking.paymentBreakdown.ownerShare;
  });
  
  return totalRevenue;
}

// Get turf booking stats
export async function getTurfStats(turfId: string) {
  const bookingsQuery = query(
    collection(db, 'bookings'),
    where('turfId', '==', turfId)
  );
  
  const bookings = await getDocs(bookingsQuery);
  
  return {
    totalBookings: bookings.size,
    completedBookings: bookings.docs.filter(d => d.data().status === 'completed').length,
    cancelledBookings: bookings.docs.filter(d => d.data().status === 'cancelled').length,
    upcomingBookings: bookings.docs.filter(d => d.data().status === 'confirmed').length,
  };
}
```

---

## 🎯 Key Differences Between Roles

### User vs Owner vs Admin

| Feature | User | Owner | Admin |
|---------|------|-------|-------|
| Browse Turfs | ✅ Verified only | ✅ All | ✅ All |
| Book Turfs | ✅ Yes | ✅ Yes | ✅ Yes |
| Add Turfs | ❌ No | ✅ Yes (pending verification) | ✅ Yes (auto-verified) |
| Edit Turfs | ❌ No | ✅ Own turfs only | ✅ All turfs |
| Delete Turfs | ❌ No | ❌ No | ✅ All turfs |
| Verify Turfs | ❌ No | ❌ No | ✅ Yes |
| Scan QR | ❌ No | ✅ Own turfs only | ✅ All turfs |
| View Analytics | ❌ Personal only | ✅ Own turfs | ✅ Platform-wide |
| Manage Users | ❌ No | ❌ No | ✅ Yes |
| Change Roles | ❌ No | ❌ No | ✅ Yes |

---

## 🚦 Next Steps to Complete Implementation

### Immediate (Priority 1)
1. ✅ Create `PendingTurfsScreen.tsx` for admin
2. ✅ Create `AddTurfScreen.tsx` for owners (copy from admin, set isVerified=false)
3. ✅ Create `EditTurfScreen.tsx` for owners
4. ✅ Create `ManageUsersScreen.tsx` for admin
5. ✅ Implement `verifyTurf()` and `rejectTurf()` functions

### Soon (Priority 2)
6. ✅ Create `TurfAnalyticsScreen.tsx` with charts
7. ✅ Create `OwnerScanQRScreen.tsx`
8. ✅ Implement revenue tracking functions
9. ✅ Update Firestore security rules
10. ✅ Add notification system for verification status

### Later (Priority 3)
11. ✅ Email notifications for verification
12. ✅ Push notifications for booking updates
13. ✅ Admin dispute resolution system
14. ✅ Owner payout management
15. ✅ Advanced analytics dashboard

---

## 📊 Testing Checklist

### User Flow
- [ ] User can browse only verified turfs
- [ ] User can book any verified turf
- [ ] User cannot see owner-only features
- [ ] User cannot access admin features

### Owner Flow
- [ ] Owner can add new turf (goes to pending)
- [ ] Owner can see all their turfs (verified/pending/rejected)
- [ ] Owner can edit own turfs
- [ ] Owner can scan QR for own turfs only
- [ ] Owner can see revenue for own turfs
- [ ] Owner cannot verify own turfs
- [ ] Owner cannot access admin features

### Admin Flow
- [ ] Admin can see all turfs (all statuses)
- [ ] Admin can verify pending turfs
- [ ] Admin can reject turfs with reason
- [ ] Admin can edit any turf
- [ ] Admin can delete any turf
- [ ] Admin can change user roles
- [ ] Admin can scan QR for any turf
- [ ] Admin can see platform-wide analytics

---

## 🎉 Benefits of Three-Tier System

### For Users
✅ Verified turf listings (quality control)  
✅ No spam or fake listings  
✅ Better user experience  

### For Owners
✅ Self-service turf management  
✅ Real-time booking notifications  
✅ Revenue tracking and analytics  
✅ Direct QR verification  

### For Admins
✅ Full platform control  
✅ Quality assurance workflow  
✅ Fraud prevention  
✅ System-wide visibility  

### For Platform
✅ Scalable business model  
✅ Quality control mechanism  
✅ Clear separation of concerns  
✅ Professional appearance  

---

**Status**: ✅ Foundation Complete | 🔨 Features In Progress  
**Last Updated**: November 3, 2025  
**Next Milestone**: Complete all Owner screens and Admin verification flow
