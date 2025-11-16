/**
 * Firebase Cloud Functions for Sending Push Notifications
 * Deploy this to Firebase Cloud Functions
 * 
 * Setup:
 * 1. npm install -g firebase-tools
 * 2. firebase init functions
 * 3. Copy this code to functions/src/index.ts
 * 4. firebase deploy --only functions
 * 
 * NOTE: This is a template file. Copy to Firebase Functions project before using.
 * Type checking disabled as dependencies are not installed in main project.
 */

// @ts-nocheck
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Send notification when a booking is created
 */
export const sendBookingConfirmation = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const bookingData = snap.data();
    const { userId, turfId, date, startTime, endTime, status } = bookingData;

    try {
      // Get user's FCM token
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (!fcmToken) {
        console.log('❌ No FCM token found for user:', userId);
        return;
      }

      // Get turf details
      const turfDoc = await admin.firestore().collection('turfs').doc(turfId).get();
      const turfName = turfDoc.data()?.name || 'Your Turf';

      // Send notification
      const message = {
        token: fcmToken,
        notification: {
          title: '🎉 Booking Confirmed!',
          body: `Your booking at ${turfName} for ${date} (${startTime}-${endTime}) is confirmed.`,
        },
        data: {
          type: 'booking',
          bookingId: snap.id,
          turfId,
          screen: 'BookingDetail',
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'booking-updates',
            sound: 'default',
            priority: 'high' as const,
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      await admin.messaging().send(message);
      console.log('✅ Booking confirmation sent to user:', userId);
    } catch (error) {
      console.error('❌ Error sending booking confirmation:', error);
    }
  });

/**
 * Send notification when booking status changes
 */
export const sendBookingStatusUpdate = functions.firestore
  .document('bookings/{bookingId}')
  .onUpdate(async (change, context) => {
    const beforeData = change.before.data();
    const afterData = change.after.data();

    // Check if status changed
    if (beforeData.status === afterData.status) {
      return;
    }

    const { userId, turfId, status } = afterData;

    try {
      // Get user's FCM token
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const fcmToken = userDoc.data()?.fcmToken;

      if (!fcmToken) {
        console.log('❌ No FCM token found for user:', userId);
        return;
      }

      // Get turf details
      const turfDoc = await admin.firestore().collection('turfs').doc(turfId).get();
      const turfName = turfDoc.data()?.name || 'Your Turf';

      // Determine notification message based on status
      let title = '';
      let body = '';

      switch (status) {
        case 'confirmed':
          title = '✅ Booking Confirmed';
          body = `Your booking at ${turfName} has been confirmed!`;
          break;
        case 'cancelled':
          title = '❌ Booking Cancelled';
          body = `Your booking at ${turfName} has been cancelled.`;
          break;
        case 'completed':
          title = '🏆 Booking Completed';
          body = `Thank you for using ${turfName}! Rate your experience.`;
          break;
        default:
          return;
      }

      // Send notification
      const message = {
        token: fcmToken,
        notification: { title, body },
        data: {
          type: 'booking',
          bookingId: context.params.bookingId,
          turfId,
          status,
          screen: 'BookingDetail',
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'booking-updates',
            sound: 'default',
          },
        },
      };

      await admin.messaging().send(message);
      console.log('✅ Booking status update sent to user:', userId);
    } catch (error) {
      console.error('❌ Error sending booking status update:', error);
    }
  });

/**
 * Send notification to turf owner when new booking is created
 */
export const notifyOwnerNewBooking = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const bookingData = snap.data();
    const { turfId, userId, date, startTime, endTime } = bookingData;

    try {
      // Get turf owner
      const turfDoc = await admin.firestore().collection('turfs').doc(turfId).get();
      const ownerId = turfDoc.data()?.ownerId;

      if (!ownerId) {
        console.log('❌ No owner found for turf:', turfId);
        return;
      }

      // Get owner's FCM token
      const ownerDoc = await admin.firestore().collection('users').doc(ownerId).get();
      const fcmToken = ownerDoc.data()?.fcmToken;

      if (!fcmToken) {
        console.log('❌ No FCM token found for owner:', ownerId);
        return;
      }

      // Get user details
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const userName = userDoc.data()?.name || 'A user';

      // Send notification
      const message = {
        token: fcmToken,
        notification: {
          title: '🆕 New Booking!',
          body: `${userName} booked your turf for ${date} (${startTime}-${endTime})`,
        },
        data: {
          type: 'owner-booking',
          bookingId: snap.id,
          turfId,
          screen: 'OwnerBookings',
        },
        android: {
          priority: 'high' as const,
          notification: {
            channelId: 'booking-updates',
            sound: 'default',
          },
        },
      };

      await admin.messaging().send(message);
      console.log('✅ New booking notification sent to owner:', ownerId);
    } catch (error) {
      console.error('❌ Error notifying owner:', error);
    }
  });

/**
 * Send promotional notification to all users (topic-based)
 */
export const sendPromotionalNotification = functions.https.onCall(async (data, context) => {
  // Verify admin
  if (!context.auth?.token?.isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can send promotional notifications'
    );
  }

  const { title, body, imageUrl } = data;

  try {
    const message = {
      notification: { title, body },
      topic: 'promotions',
      android: {
        notification: {
          channelId: 'promotions',
          imageUrl,
        },
      },
      apns: {
        payload: {
          aps: {
            'mutable-content': 1,
          },
        },
        fcmOptions: {
          imageUrl,
        },
      },
    };

    await admin.messaging().send(message);
    console.log('✅ Promotional notification sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending promotional notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send notification');
  }
});

/**
 * Clean up old FCM tokens (scheduled function - runs daily)
 */
export const cleanupOldTokens = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const snapshot = await admin
        .firestore()
        .collection('users')
        .where('fcmTokenUpdatedAt', '<', thirtyDaysAgo)
        .get();

      const batch = admin.firestore().batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {
          fcmToken: admin.firestore.FieldValue.delete(),
          fcmTokenUpdatedAt: admin.firestore.FieldValue.delete(),
        });
      });

      await batch.commit();
      console.log(`✅ Cleaned up ${snapshot.size} old FCM tokens`);
    } catch (error) {
      console.error('❌ Error cleaning up old tokens:', error);
    }
  });
