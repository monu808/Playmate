/**
 * Unified Notifications Module
 * Combines FCM and local notifications
 */

export * from './fcm';
export * from './localNotifications';

import { initializeFCM, setupForegroundNotificationHandler, setupNotificationOpenHandler } from './fcm';
import { showLocalNotification, setupNotificationChannel } from './localNotifications';
import { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

/**
 * Initialize complete notification system
 * Call this once when user logs in
 */
export const initializeNotifications = async (userId: string) => {
  try {
    console.log('🔔 Initializing notifications...');

    // Setup Android notification channels
    await setupNotificationChannel();

    // Initialize FCM
    await initializeFCM(userId);

    // Setup foreground notification handler
    const unsubscribeForeground = setupForegroundNotificationHandler(
      (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
        // Show local notification when app is in foreground
        if (remoteMessage.notification) {
          showLocalNotification(
            remoteMessage.notification.title || 'New Notification',
            remoteMessage.notification.body || '',
            remoteMessage.data
          );
        }
      }
    );

    // Setup notification tap handler
    const unsubscribeOpen = setupNotificationOpenHandler((remoteMessage) => {
      if (remoteMessage) {
        console.log('📱 User tapped notification:', remoteMessage);
        // Handle navigation based on notification data
        handleNotificationNavigation(remoteMessage.data);
      }
    });

    console.log('✅ Notifications initialized successfully');

    return () => {
      unsubscribeForeground();
      unsubscribeOpen();
    };
  } catch (error) {
    console.error('❌ Error initializing notifications:', error);
    return () => {};
  }
};

/**
 * Handle navigation based on notification data
 */
const handleNotificationNavigation = (data?: any) => {
  if (!data) return;

  // Example: Navigate based on notification type
  switch (data.type) {
    case 'booking':
      console.log('Navigate to booking:', data.bookingId);
      // navigation.navigate('BookingDetail', { id: data.bookingId });
      break;
    case 'promotion':
      console.log('Navigate to promotion:', data.promotionId);
      // navigation.navigate('Promotion', { id: data.promotionId });
      break;
    case 'turf':
      console.log('Navigate to turf:', data.turfId);
      // navigation.navigate('TurfDetail', { id: data.turfId });
      break;
    default:
      console.log('Unknown notification type:', data.type);
  }
};

/**
 * Send a booking confirmation notification (server-side)
 * This is just a structure - implement on Firebase Cloud Functions
 */
export const sendBookingNotification = async (
  userId: string,
  bookingData: {
    turfName: string;
    date: string;
    time: string;
    bookingId: string;
  }
) => {
  // This would be implemented in Firebase Cloud Functions
  console.log('📤 Send booking notification:', { userId, bookingData });
};
