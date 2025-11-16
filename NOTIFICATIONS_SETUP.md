# FCM Push Notifications Setup Guide

## 📋 Prerequisites
- React Native Firebase already installed ✅
- Firebase project configured ✅
- Google Services JSON configured ✅

## 🚀 Installation Steps

### 1. Install React Native Firebase Messaging
```bash
npm install @react-native-firebase/messaging
```

### 2. Android Configuration

#### a) Update `android/app/src/main/AndroidManifest.xml`
Add inside `<application>` tag:
```xml
<!-- FCM Permissions -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />

<application>
  <!-- ... existing code ... -->
  
  <!-- FCM Default Notification Channel -->
  <meta-data
    android:name="com.google.firebase.messaging.default_notification_channel_id"
    android:value="booking-updates" />
  
  <!-- FCM Default Icon -->
  <meta-data
    android:name="com.google.firebase.messaging.default_notification_icon"
    android:resource="@drawable/ic_notification" />
  
  <!-- FCM Default Color -->
  <meta-data
    android:name="com.google.firebase.messaging.default_notification_color"
    android:resource="@color/colorAccent" />

  <!-- ... existing code ... -->
</application>
```

#### b) Update `android/build.gradle`
Ensure you have Google Services plugin:
```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.3.15'
  }
}
```

#### c) Update `android/app/build.gradle`
At the bottom of the file:
```gradle
apply plugin: 'com.google.gms.google-services'
```

### 3. iOS Configuration (if supporting iOS)

#### a) Enable Push Notifications Capability
1. Open `ios/PlaymateApp.xcworkspace` in Xcode
2. Select your project target
3. Go to "Signing & Capabilities"
4. Click "+ Capability" and add "Push Notifications"
5. Add "Background Modes" and check "Remote notifications"

#### b) Upload APNs Certificate to Firebase
1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Under "Apple app configuration", upload your APNs certificate

## 📝 Usage in Your App

### 1. Notification permissions are automatically requested on login (already implemented in AuthContext)

### 2. Send Test Notification from Firebase Console
1. Go to Firebase Console → Cloud Messaging → Send your first message
2. Enter notification title and text
3. Select your app
4. Click "Send test message"
5. Enter FCM token from logs
6. Click "Test"

### 3. Handle Notification Tap in Your Components

Example in navigation or App.tsx:
```typescript
import { useEffect } from 'react';
import { setupNotificationOpenHandler } from './lib/notifications';

useEffect(() => {
  const unsubscribe = setupNotificationOpenHandler((notification) => {
    if (notification?.data) {
      // Navigate based on notification data
      switch (notification.data.type) {
        case 'booking':
          navigation.navigate('BookingDetail', { 
            id: notification.data.bookingId 
          });
          break;
        case 'turf':
          navigation.navigate('TurfDetail', { 
            id: notification.data.turfId 
          });
          break;
      }
    }
  });

  return unsubscribe;
}, []);
```

## 🔥 Deploy Cloud Functions (Server-side)

### 1. Initialize Firebase Functions
```bash
npm install -g firebase-tools
firebase login
firebase init functions
```

Select:
- TypeScript
- ESLint
- Install dependencies

### 2. Copy Cloud Functions Code
Copy the code from `scripts/cloudFunctions.ts` to `functions/src/index.ts`

### 3. Install Dependencies in Functions
```bash
cd functions
npm install firebase-admin firebase-functions
cd ..
```

### 4. Deploy Functions
```bash
firebase deploy --only functions
```

This will deploy:
- ✅ `sendBookingConfirmation` - Sends notification on booking creation
- ✅ `sendBookingStatusUpdate` - Sends notification on status change
- ✅ `notifyOwnerNewBooking` - Notifies turf owner of new bookings
- ✅ `sendPromotionalNotification` - Send promotions to all users
- ✅ `cleanupOldTokens` - Daily cleanup of expired tokens

## 📱 Testing Notifications

### Test Foreground Notifications
1. Open the app
2. Send a test notification from Firebase Console
3. Notification should appear as local notification

### Test Background Notifications
1. Put app in background (press home button)
2. Send a test notification from Firebase Console
3. Notification should appear in notification tray

### Test Notification Tap
1. Send notification while app is in background
2. Tap the notification
3. App should open and navigate to the correct screen

### Test Server-side Notifications
1. Create a booking
2. Check that you receive "Booking Confirmed" notification
3. Cancel the booking
4. Check that you receive "Booking Cancelled" notification

## 🎯 Notification Types

### User Notifications:
- ✅ Booking confirmed
- ✅ Booking cancelled
- ✅ Booking completed
- ✅ Payment received
- ✅ Promotional offers

### Owner Notifications:
- ✅ New booking received
- ✅ Booking cancelled by user
- ✅ Payment received
- ✅ Turf approved by admin

### Admin Notifications:
- ✅ New turf submitted for approval
- ✅ New user registered
- ✅ System alerts

## 🔧 Troubleshooting

### No notifications received?
1. Check FCM token is saved in Firestore:
   ```javascript
   db.collection('users').doc(userId).get()
   ```
2. Check app has notification permission
3. Check Firebase Console → Cloud Messaging → Send test message
4. Check Android notification channel is created

### Notifications not working in background?
1. Make sure `index.ts` has background handler
2. Check Android battery optimization is disabled for app
3. Check app has background data permission

### iOS notifications not working?
1. Check APNs certificate is uploaded to Firebase
2. Check Push Notifications capability is enabled
3. Check provisioning profile includes push notifications

## 📊 Monitor Notifications

### Firebase Console
1. Go to Cloud Messaging → Reports
2. View delivery statistics
3. Track notification performance

### Check User's FCM Token
```typescript
import { getFCMToken } from './lib/notifications';

const token = await getFCMToken();
console.log('FCM Token:', token);
```

### Check Firestore for Saved Tokens
```typescript
const userDoc = await db.collection('users').doc(userId).get();
console.log('FCM Token:', userDoc.data()?.fcmToken);
console.log('Last Updated:', userDoc.data()?.fcmTokenUpdatedAt);
```

## 🎉 You're All Set!

Notifications are now fully implemented:
- ✅ FCM integration
- ✅ Local notifications for foreground
- ✅ Background notifications
- ✅ Notification tap handling
- ✅ Server-side Cloud Functions
- ✅ Token management
- ✅ Topic subscriptions
