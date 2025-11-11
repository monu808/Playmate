/**
 * Firebase Crashlytics Integration
 * 
 * ✅ Production-ready crash reporting
 * Automatically reports crashes, errors, and custom logs
 */

import crashlytics from '@react-native-firebase/crashlytics';

/**
 * Initialize Crashlytics
 * Call this once at app startup
 */
export const initializeCrashlytics = async () => {
  try {
    // Enable crash collection using the crashlytics instance directly
    await crashlytics().setCrashlyticsCollectionEnabled(true);
    
    console.log('✅ Firebase Crashlytics initialized');
    
    // Crashlytics is now enabled - no need to check status
    console.log('📊 Crashlytics collection enabled: true');
    
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Crashlytics:', error);
    return false;
  }
};

/**
 * Set user identifier for crash reports
 */
export const setCrashlyticsUser = async (userId: string, email?: string, name?: string) => {
  try {
    await crashlytics().setUserId(userId);
    
    if (email) {
      await crashlytics().setAttribute('email', email);
    }
    
    if (name) {
      await crashlytics().setAttribute('name', name);
    }
    
    console.log('✅ Crashlytics user set:', userId);
  } catch (error) {
    console.error('❌ Failed to set Crashlytics user:', error);
  }
};

/**
 * Log a non-fatal error to Crashlytics
 */
export const logError = (error: Error, context?: string) => {
  try {
    if (context) {
      crashlytics().log(`Error context: ${context}`);
    }
    
    crashlytics().recordError(error);
    console.log('📝 Error logged to Crashlytics:', error.message);
  } catch (err) {
    console.error('❌ Failed to log error to Crashlytics:', err);
  }
};

/**
 * Log a custom message to Crashlytics
 */
export const logMessage = (message: string) => {
  try {
    crashlytics().log(message);
    console.log('📝 Message logged to Crashlytics:', message);
  } catch (error) {
    console.error('❌ Failed to log message to Crashlytics:', error);
  }
};

/**
 * Set custom attributes for crash context
 */
export const setCrashlyticsAttributes = async (attributes: Record<string, string>) => {
  try {
    for (const [key, value] of Object.entries(attributes)) {
      await crashlytics().setAttribute(key, value);
    }
    console.log('✅ Crashlytics attributes set:', Object.keys(attributes));
  } catch (error) {
    console.error('❌ Failed to set Crashlytics attributes:', error);
  }
};

/**
/**
 * Force a test crash (for testing only - DO NOT use in production)
 */
export const testCrash = () => {
  if (__DEV__) {
    console.warn('⚠️ This will crash the app for testing Crashlytics');
    // Use the correct method to trigger a crash
    crashlytics().crash();
  } else {
    console.error('❌ Test crashes are disabled in production');
  }
};
/**
 * Log breadcrumb for debugging
 */
export const logBreadcrumb = (message: string, data?: Record<string, any>) => {
  try {
    let logMessage = message;
    if (data) {
      logMessage += ` | Data: ${JSON.stringify(data)}`;
    }
    crashlytics().log(logMessage);
  } catch (error) {
    console.error('❌ Failed to log breadcrumb:', error);
  }
};

/**
 * Wrapper to catch and log async errors
 */
export const withCrashlytics = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: string
): T => {
  return (async (...args: any[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      logError(error as Error, context);
      throw error; // Re-throw to maintain original behavior
    }
  }) as T;
};

export default crashlytics;
