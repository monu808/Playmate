# 🚀 Firebase Deployment Instructions

## 🔥 Deploy Firestore Rules

The updated `firestore.rules` file allows owners to create and manage turfs. Deploy it to Firebase:

### Method 1: Firebase Console (Recommended for now)
1. Go to [Firebase Console](https://console.firebase.google.com/project/turf-booking-63618/firestore/rules)
2. Copy the entire content of `firestore.rules`
3. Paste it into the rules editor
4. Click **"Publish"** button

### Method 2: Firebase CLI
```bash
# Install Firebase CLI if not installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase project (only needed once)
firebase init firestore

# Deploy rules
firebase deploy --only firestore:rules
```

---

## 📊 Create Firestore Composite Index

The owner turfs query requires a composite index. You have two options:

### Option 1: Click the Auto-Generated Link (Easiest)
When you see the error in the console, click the provided link. It will look like:
```
https://console.firebase.google.com/v1/r/project/turf-booking-63618/firestore/indexes?create_composite=...
```

This automatically creates the index with correct configuration.

### Option 2: Manual Creation
1. Go to [Firestore Indexes](https://console.firebase.google.com/project/turf-booking-63618/firestore/indexes)
2. Click **"Create Index"**
3. Configure:
   - **Collection ID**: `turfs`
   - **Field 1**: `ownerId` - Ascending
   - **Field 2**: `createdAt` - Descending
   - **Query scope**: Collection
4. Click **"Create Index"**
5. Wait 5-10 minutes for index to build

### Option 3: Use firestore.indexes.json (Future)
Create `firestore.indexes.json`:
```json
{
  "indexes": [
    {
      "collectionGroup": "turfs",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "ownerId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "createdAt",
          "order": "DESCENDING"
        }
      ]
    },
    {
      "collectionGroup": "bookings",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "turfId",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "date",
          "order": "ASCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy with:
```bash
firebase deploy --only firestore:indexes
```

---

## ✅ Verification Steps

After deploying:

1. **Test Owner Turf Creation**:
   - Login as owner
   - Go to "Add Turf" screen
   - Fill form and submit
   - Should see success message ✅

2. **Test Owner Turfs List**:
   - Go to "My Turfs" tab
   - Should load without index error ✅
   - Should show your created turfs

3. **Test Owner Dashboard**:
   - Go to "Dashboard" tab
   - Should show real stats ✅

4. **Test Owner Bookings**:
   - Go to "Bookings" tab
   - Should show bookings for your turfs ✅

---

## 🐛 Troubleshooting

### Still seeing "Missing or insufficient permissions"?
- Wait 30 seconds after deploying rules (propagation delay)
- Clear app cache: Delete app from device and reinstall
- Check user role in Firestore:
  ```javascript
  // In Firebase Console > Firestore
  // Check: users/{yourUserId}/role == 'owner'
  ```

### Still seeing "The query requires an index"?
- Index takes 5-10 minutes to build
- Check status: [Firestore Indexes](https://console.firebase.google.com/project/turf-booking-63618/firestore/indexes)
- Status should be "Enabled" (green check)

### Temporary Workaround
The code has been updated to sort client-side instead of using `orderBy()`, so the index error is no longer blocking. But creating the index will improve performance.

---

## 📝 Changes Made

### 1. `firestore.rules` - Updated Permissions
- ✅ Added `isOwnerRole()` helper function
- ✅ Added `isOwner(ownerId)` helper function
- ✅ Owners can now **create** turfs (with `isVerified=false`)
- ✅ Owners can **update** their own turfs (except `isVerified` field)
- ✅ Owners can **read** bookings for their turfs
- ✅ All users can read public profiles (needed for displaying owner info)

### 2. `lib/firebase/owner.ts` - Removed Index Dependency
- ✅ Removed `orderBy('createdAt', 'desc')` from query
- ✅ Added client-side sorting: `.sort((a, b) => b.createdAt - a.createdAt)`
- ✅ App now works without index (but slower for large datasets)

---

## 🎯 Next Steps

1. **Deploy the rules** (Method 1 above - takes 30 seconds)
2. **Create the index** (Option 1 above - takes 5-10 minutes)
3. **Test the app** (Follow verification steps)
4. If everything works, you're ready to implement admin approval screens!

---

## 🔒 Security Notes

The updated rules ensure:
- ✅ Owners can only create turfs with their own `ownerId`
- ✅ Owners cannot set `isVerified=true` (only admins can)
- ✅ Owners can only update their own turfs
- ✅ Owners cannot change the `ownerId` or `isVerified` fields
- ✅ All booking reads are tracked by user/owner ownership
- ✅ Admin role has full control for verification workflow
