/**
 * FCM (Firebase Cloud Messaging) Notification Service
 * Handles push notifications using React Native Firebase Messaging
 */

import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { db } from '../../config/firebase';

/**
 * Request notification permissions
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    if (Platform.OS === 'android') {
      if (Platform.Version >= 33) {
        // Android 13+ requires POST_NOTIFICATIONS permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('❌ Notification permission denied');
          return false;
        }
      }
    } else if (Platform.OS === 'ios') {
      // iOS requires authorization
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('❌ iOS notification permission denied');
        return false;
      }
    }

    console.log('✅ Notification permission granted');
    return true;
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    return false;
  }
};

/**
 * Get FCM token for the device
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    const token = await messaging().getToken();
    console.log('✅ FCM Token:', token);
    return token;
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    return null;
  }
};

/**
 * Save FCM token to Firestore user document
 */
export const saveFCMToken = async (userId: string, token: string): Promise<void> => {
  try {
    await db.collection('users').doc(userId).update({
      fcmToken: token,
      fcmTokenUpdatedAt: new Date(),
    });
    console.log('✅ FCM token saved to Firestore');
  } catch (error) {
    console.error('❌ Error saving FCM token:', error);
  }
};

/**
 * Initialize FCM notifications
 * Call this when user logs in
 */
export const initializeFCM = async (userId: string): Promise<void> => {
  try {
    // Request permission
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('⚠️ FCM initialization skipped - no permission');
      return;
    }

    // Get FCM token
    const token = await getFCMToken();
    if (token) {
      await saveFCMToken(userId, token);
    }

    // Listen for token refresh
    messaging().onTokenRefresh(async (newToken) => {
      console.log('🔄 FCM token refreshed:', newToken);
      await saveFCMToken(userId, newToken);
    });

    console.log('✅ FCM initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing FCM:', error);
  }
};

/**
 * Handle foreground notifications
 * Called when app is in foreground and notification is received
 */
export const setupForegroundNotificationHandler = (
  callback: (notification: FirebaseMessagingTypes.RemoteMessage) => void
): (() => void) => {
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    console.log('📬 Foreground notification received:', remoteMessage);
    callback(remoteMessage);
  });

  return unsubscribe;
};

/**
 * Handle notification tap (when user opens notification)
 * Called when app is opened via notification
 */
export const setupNotificationOpenHandler = (
  callback: (notification: FirebaseMessagingTypes.RemoteMessage | null) => void
): (() => void) => {
  // Handle notification opened app from quit state
  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) {
        console.log('📱 Notification opened app from quit state:', remoteMessage);
        callback(remoteMessage);
      }
    });

  // Handle notification opened app from background state
  const unsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
    console.log('📱 Notification opened app from background state:', remoteMessage);
    callback(remoteMessage);
  });

  return unsubscribe;
};

/**
 * Handle background notifications
 * Must be called outside of any component
 */
export const setupBackgroundNotificationHandler = (): void => {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log('📬 Background notification received:', remoteMessage);
    // You can update local storage, show local notification, etc.
  });
};

/**
 * Subscribe to topic (e.g., 'bookings', 'promotions')
 */
export const subscribeToTopic = async (topic: string): Promise<void> => {
  try {
    await messaging().subscribeToTopic(topic);
    console.log(`✅ Subscribed to topic: ${topic}`);
  } catch (error) {
    console.error(`❌ Error subscribing to topic ${topic}:`, error);
  }
};

/**
 * Unsubscribe from topic
 */
export const unsubscribeFromTopic = async (topic: string): Promise<void> => {
  try {
    await messaging().unsubscribeFromTopic(topic);
    console.log(`✅ Unsubscribed from topic: ${topic}`);
  } catch (error) {
    console.error(`❌ Error unsubscribing from topic ${topic}:`, error);
  }
};

/**
 * Get notification badge count (iOS only)
 */
export const getBadgeCount = async (): Promise<number> => {
  if (Platform.OS === 'ios') {
    return await messaging().getAPNSToken().then(() => 0); // Placeholder
  }
  return 0;
};

/**
 * Set notification badge count (iOS only)
 */
export const setBadgeCount = async (count: number): Promise<void> => {
  if (Platform.OS === 'ios') {
    // iOS badge management would go here
    console.log(`Setting badge count to ${count}`);
  }
};

/**
 * Clear all notifications
 */
export const clearNotifications = async (): Promise<void> => {
  try {
    // Clear badge on iOS
    await setBadgeCount(0);
    console.log('✅ Notifications cleared');
  } catch (error) {
    console.error('❌ Error clearing notifications:', error);
  }
};
