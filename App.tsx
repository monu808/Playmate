import React, { useState, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import Navigation from './navigation';
import { AuthProvider } from './contexts/AuthContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SplashScreen } from './components/SplashScreen';

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  // PERFORMANCE: Memoize splash finish handler
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <Navigation />
        <StatusBar style="auto" />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

