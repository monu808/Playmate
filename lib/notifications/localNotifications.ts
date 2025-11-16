/**
 * Local Notifications using Expo Notifications
 * For displaying notifications when app is in foreground
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Configure notification behavior
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request local notification permissions
 */
export const requestLocalNotificationPermission = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Local notification permission denied');
      return false;
    }

    console.log('✅ Local notification permission granted');
    return true;
  } catch (error) {
    console.error('❌ Error requesting local notification permission:', error);
    return false;
  }
};

/**
 * Show a local notification immediately
 */
export const showLocalNotification = async (
  title: string,
  body: string,
  data?: any
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Show immediately
    });
    console.log('✅ Local notification shown');
  } catch (error) {
    console.error('❌ Error showing local notification:', error);
  }
};

/**
 * Schedule a local notification for later
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  triggerDate: Date,
  data?: any
): Promise<string | null> => {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    console.log('✅ Local notification scheduled:', id);
    return id;
  } catch (error) {
    console.error('❌ Error scheduling local notification:', error);
    return null;
  }
};

/**
 * Cancel a scheduled notification
 */
export const cancelLocalNotification = async (notificationId: string): Promise<void> => {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    console.log('✅ Local notification cancelled');
  } catch (error) {
    console.error('❌ Error cancelling local notification:', error);
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllLocalNotifications = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All local notifications cancelled');
  } catch (error) {
    console.error('❌ Error cancelling all local notifications:', error);
  }
};

/**
 * Get all scheduled notifications
 */
export const getAllScheduledNotifications = async (): Promise<Notifications.NotificationRequest[]> => {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return notifications;
  } catch (error) {
    console.error('❌ Error getting scheduled notifications:', error);
    return [];
  }
};

/**
 * Set up notification response listener (when user taps notification)
 */
export const setupNotificationResponseListener = (
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Set up notification received listener (when notification arrives)
 */
export const setupNotificationReceivedListener = (
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Configure notification channels (Android only)
 */
export const setupNotificationChannel = async (): Promise<void> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('booking-updates', {
      name: 'Booking Updates',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('promotions', {
      name: 'Promotions',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('general', {
      name: 'General',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    console.log('✅ Notification channels configured');
  }
};
