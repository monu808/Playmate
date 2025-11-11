import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import Navigation from './navigation';
import { AuthProvider } from './contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary'; // ✅ FIX #10: Added Error Boundary
import { initializeCrashlytics } from './lib/crashlytics'; // ✅ PRODUCTION: Crashlytics

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [crashlyticsReady, setCrashlyticsReady] = useState(false);

  // Initialize Crashlytics on app start
  useEffect(() => {
    initializeCrashlytics().then((success) => {
      setCrashlyticsReady(success);
      if (success) {
        console.log('✅ App initialized with Crashlytics');
      }
    });
  }, []);

  // PERFORMANCE: Memoize splash finish handler
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <Navigation />
          <StatusBar style="auto" />
        </AuthProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

